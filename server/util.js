'use strict';

var _ = require('lodash');
require('./models/teamcity-developer-model');
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(require('mongoose'));
var Developer = mongoose.model('TeamcityDeveloper');
var moment = require('moment');
var Client = require('node-rest-client').Client;
var wrapRestCall;

var _logger, _request_args;

var getAllPages = function (server, firstCall, dataField, locator) {

    return new BBPromise(function (resolve, reject) {
        var allItems = [];
        var getPage = function (data, first) {
            var nextPage = data ? data.nextHref : null;
            if (first || nextPage) {
                if (!first) {
                    var items = data[dataField];
                    allItems = allItems.concat(items);
                }

                var onReturn = function (result) {
                    getPage(result, false);
                };
                var onError = function (err) {
                    _logger.error('Could not get items [' + err + ']');
                    reject();
                };

                var args = _.extend({}, _request_args);
                if (!args.parameters) {
                    args.parameters = {};
                }
                if (!nextPage) {
                    args.parameters.locator = locator;
                    firstCall(args).then(onReturn).catch(onError);
                } else {
                    server.rest_generic_get(server.url + nextPage, args).then(onReturn).catch(onError);
                }
            } else {
                if ( data[dataField]) {
                    allItems = allItems.concat( data[dataField]);
                }
                resolve(allItems);
            }
        };
        getPage(null, true);
    });
};

var getDetailedChanges = function(server, simpleChanges, mappingFunction){
    return BBPromise.map(simpleChanges, function (change) {
        return server.rest_generic_get(server.url + change.href, _request_args)
            .then(function (detailedChange) {
                return mappingFunction(detailedChange);
            });
    }, {concurrency: 5});
};

var getChanges = function (server, href, lastChanges, mappingFunction) {
    return new BBPromise(function (resolve, reject) {
        server.rest_generic_get(server.url + href, _request_args)
            .then(function (response) {
                var changes = response.change;
                if (changes) {
                    resolve(getDetailedChanges(server, changes, mappingFunction));
                } else {
                    if (lastChanges && lastChanges.change){
                        resolve(getDetailedChanges(server, lastChanges.change,mappingFunction));
                    }else {
                        resolve([]);
                    }
                }
            });
    });
};

var parseTeamcityDate = function (src, dest, key) {
    dest[key] = moment(src[key], 'YYYYMMDDTHHmmssZZ');
};

var formatAsTeamcityDate = function (date) {
    return moment(date).format('YYYYMMDDTHHmmssZZ');
};

var mergeRequest = 'Merge branch \'assembla-';
var getDeveloper = function (build) {
    var changes = [];
    if (build instanceof Array){
        changes = build;
    } else if (build !== undefined){
        changes = build.changes;
    }
    var sortedChanges = _.sortBy(changes,'date');
    sortedChanges.reverse();

    var latestChange;

    //If there's only 1 change, we just use it, no matter if its a merge request or not
    if (sortedChanges.length === 1){
        latestChange = sortedChanges[0];
    }else {
        for (var i = 0; i < sortedChanges.length && !latestChange; i++) {
            var change = sortedChanges[i];
            if (build.defaultBranch && change.comment.indexOf(mergeRequest) === 0) {
                //This is a merge request commit, ignore it as this is not the dev
                continue;
            }
            latestChange = change;
        }
    }
    if (latestChange) {
        var promise;
        if (!latestChange.user && latestChange.username){
            promise = Developer.getByUsername(latestChange.username);
        } else if (latestChange.user){
            promise = Developer.getById(latestChange.user.id);
        }
        promise.then(function (developer) {
            if (developer) {
                return developer
            }
            var newDev = new Developer();
            newDev.username = latestChange.username;
            newDev.server = build.server;
            return newDev.saveAsync();
        });
        return promise;
    }
    return new BBPromise(function (resolve, reject) {
        //No user found
        resolve(null);
    });
};

var regex_development_branch = /.*develop.*/i;
var regex_master_branch = /.*master/i;

var isDefaultBuild = function(build){
    return !build.buildType.paused &&
    (
        build.defaultBranch ||
        build.branchName === undefined ||
        regex_development_branch.test(build.branchName) ||
        regex_master_branch.test(build.branchName)
    );
};

var defaultBuildQuery = function(){
    return {
        $and : [
            {'buildType.paused' :{$exists : false}},
            {$or : [
                {'defaultBranch' : true},
                {'branchName' : {$exists : false}},
                {'branchName' : regex_development_branch},
                {'branchName' : regex_master_branch}]
            }
        ]
    };
};


var loadServerDetails = function(newSettings, customCallback){
    var teamCityServers = [];
    _.forEach(newSettings.servers, function (server) {
        if (server.active) {
            var client = new Client({user: server.username, password: server.password})
            var newServer = {
                name: server.name,
                url: server.url,
                client: client
            };
            newServer.rest_generic_get = wrapRestCall(client.get);
            customCallback(newServer);
            teamCityServers.push(newServer);
        }
    });
    return teamCityServers;
};

var successfulBuild = function (build) {
    return build.status === 'SUCCESS';
};

var failedBuild = function (build) {
    return !successfulBuild(build);
};

var calculateGamerScore = function (developer) {
    return developer.scores.reduce(function (sum, score) {
        return sum + score.amount;
    }, 0);
};

function setup(restParams){
    _request_args = restParams;
}

module.exports = function(core, logger){
    if (logger) {
        _logger = logger;
    }
    wrapRestCall = core.util.promiseRestWrapper;

    return {
        REST: {
            getAllPages: getAllPages,
            getChanges: getChanges,
            getDetailedChanges: getDetailedChanges,
            setParams: setup
        },
        dates: {
            parseTeamcityDate: parseTeamcityDate,
            formatAsTeamcityDate: formatAsTeamcityDate
        },
        getDeveloper : getDeveloper,
        loadServerDetails: loadServerDetails,
        builds: {
            successful: successfulBuild,
            failed: failedBuild,
            isDefault: isDefaultBuild,
            defaultBuildQuery: defaultBuildQuery
        },
        gamification: {
            gamerScore: calculateGamerScore
        }
    };
};