'use strict';


var _ = require('lodash');
var moment = require('moment');
var client, url, socketIO;
var logger;
var settingsGetter;
var lastSettings;
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(require('mongoose'));
var Client = require('node-rest-client').Client;
var wrapRestCall;
var automapper;
var util,
    _watchdogKicker;
var targetBuildTypes = [];

var request_args = {
    headers: {
        'Accept': 'application/json'
    }
};

var teamCityServers = [];

var parseTeamcityDate = function (src, dest, key) {
    dest[key] = moment(src[key], 'YYYYMMDDTHHmmssZZ');
};

var formatAsTeamcityDate = function (date) {
    return moment(date).format('YYYYMMDDTHHmmssZZ');
};

var buildObjectFactory = function (type) {
    var object = {
        id : 0,
        project: '',
        build: '',
        status: '',
        developer: '',
        changes: {},
        lastChanges: {},
        buildTypeId : ''
    };

    if (type === 'running') {
        object.runningInfo = {};
        object.startDate = null;
        object.statusText = '';
    } else if (type === 'queued') {
        object.queuedDate = null;
        object.compatibleAgents = '';
        object.status = 'queued';
    }
    return object;
};

var refreshSettings = function () {
    return new BBPromise(function (resolve, reject) {
        settingsGetter()
            .then(function (newSettings) {
                if (newSettings === null) {
                    reject(new Error('Plugin load error - missing settings [teamcity]'));
                }
                if (!_.isEqual(lastSettings, newSettings)) {
                    logger.debug('Settings changed, recreating client');

                    teamCityServers = util.loadServerDetails(newSettings, function (newServer) {
                        newServer.rest_building = wrapRestCall(newServer.client, 'building', newServer.url + '/httpAuth/app/rest/builds?locator=running:true,personal:any', 'GET');
                        newServer.rest_building_nondefault = wrapRestCall(newServer.client, 'building', newServer.url + '/httpAuth/app/rest/builds?locator=running:true,branch:(default:false),personal:any', 'GET');
                    });
                    if (newSettings.eventNotify) {
                        targetBuildTypes = newSettings.eventNotify.targetBuildTypes;
                    }
                    util.REST.setParams(request_args);
                    lastSettings = newSettings;
                    resolve(true);
                }
                resolve(false);
            })
            .catch(reject);
    });
};

var mapChange = function (change) {
    return automapper.mapToNew('', '', change);
};

var getAgents = function (server, build) {
    return new BBPromise(function (resolve, reject) {
        return server.rest_generic_get(server.url + build.compatibleAgents.href, request_args)
            .then(function(response){
                build.compatibleAgents = response.count?response.count : 0;
                resolve();
            })
            .catch(reject);
    });
};

var getBuildDetails = function (server, href, type) {
    return new BBPromise(function (resolve, reject) {
        var detailedBuild;

        return server.rest_generic_get(server.url + href, request_args)
            .then(function (buildDetails) {
                var realtimeBuild = buildObjectFactory(type);
                automapper.map('restbuild', 'realtimebuild', buildDetails, realtimeBuild);
                detailedBuild = realtimeBuild;
                detailedBuild.serverName = server.name;
            })
            .then(function () {
                return util.REST.getChanges(server, detailedBuild.changes.href, detailedBuild.lastChanges, mapChange).then(function (changes) {
                    if (changes.length === 0 && detailedBuild.lastChanges.change && detailedBuild.lastChanges.change.length > 0) {
                        return util.REST.getDetailedChanges(server, detailedBuild.lastChanges.change, mapChange);
                    }
                    return changes;
                });
            })
            .then(function (changes) {
                return util.getDeveloper(changes);
            })
            .then(function (developer) {
                detailedBuild.developer = developer ? developer.username : 'No Changes';
            })
            .then(function () {
                if (type == 'queued') {
                    return getAgents(server, detailedBuild);
                }
            })
            .then(function () {
                resolve(detailedBuild);
            })
            .catch(reject);

    });
};

var getBuildList = function (server, restCall, type) {
    return new BBPromise(function (resolve, reject) {
        return restCall(request_args)
            .then(function (response) {
                if (response.build && response.build.length > 0) {
                    BBPromise.map(response.build, function (build) {
                        return getBuildDetails(server, build.href, type);
                    }, {concurrency: 1})
                        .then(function (builds) {
                            resolve(builds.sort(function(a,b){
                                return a.id - b.id;
                            }));
                        });
                } else {
                    resolve([]);
                }
            })
            .catch(reject);
    });
};

var _requestInProgress = false;
var _cachedMessage = {};
var _newCache = {};

function filterForTargets(runningBuilds) {
    return _.filter(runningBuilds, function(build){
        var target = false;
        _.forEach(targetBuildTypes, function(targetid) {
            if (build.buildTypeId === targetid) {
                target = true;
            }
        });
        return target;
    });
}

var getRunningBuilds = function (server, setLocalMessage) {
    if (setLocalMessage !== false){
        setLocalMessage = true;
    }
    return new BBPromise(function (resolve, reject) {
        return getBuildList(server, server.rest_building, 'running')
            .then(function (builds) {
                builds = filterForTargets(builds);
                if (setLocalMessage) {
                    _newCache[server.name].builds = builds;
                }
                return(builds);
            })
            .then(function(defaultBuilds){
                return getBuildList(server, server.rest_building_nondefault, 'running')
                    .then(function (nonDefaultBuilds){
                        nonDefaultBuilds = filterForTargets(nonDefaultBuilds);
                        if (setLocalMessage) {
                            _newCache[server.name].builds = _newCache[server.name].builds.concat(nonDefaultBuilds);
                        }
                        resolve(defaultBuilds.concat(nonDefaultBuilds));
                    });
            })
            .catch(reject);
    });
};


var createMessage = function () {
    _cachedMessage = _newCache;
};

var sendToSockets = function () {
    var message = {
        name: 'teamcity-eventnotify',
        payload: _cachedMessage
    };
    socketIO.sendMessageToAllSockets(message);
};

var refreshForServer = function (server) {
    _newCache[server.name] = {
        server : server.name,
        builds : []
    };

    return getRunningBuilds(server);
};

var refreshCache = function () {
    _requestInProgress = true;
    _watchdogKicker();
    refreshSettings()
        .then(function () {
            return BBPromise.map(teamCityServers, function (server) {
                return refreshForServer(server);
            });
        })
        .then(createMessage)
        .then(sendToSockets)
        .catch(function (err) {
            logger.error(err);
        })
        .finally(function () {
            _requestInProgress = false;
        });
};


var messageReceived = function (message, callback) {
};

var refresh = function () {
};

var setupAutoMapper = function () {
    automapper.createCustomMapping('restbuild', 'realtimebuild')
        .forMember('buildType', function (src, dest) {
            dest.project = src.buildType.projectName;
            dest.build = src.buildType.name;
            dest.buildTypeId = src.buildType.id;
        })
        .forMember('running-info', function (src, dest) {
            dest.runningInfo = src['running-info'];
        })
        .forMember('startDate', util.dates.parseTeamcityDate)
        .forMember('queuedDate', util.dates.parseTeamcityDate);

};

var init = function (core, io, settings, assignedLogger, scheduler, watchdogKicker, noStart) {
    automapper = core.util.autoMapper;
    wrapRestCall= core.util.promiseRestWrapper;
    logger = assignedLogger;
    util = require('./util')(core, logger);
    settingsGetter = settings;
    socketIO = io;
    _watchdogKicker = watchdogKicker;
    socketIO.registerListener('teamcity-eventnotify', messageReceived);
    setupAutoMapper();
    _requestInProgress = false;
    _cachedMessage = {
    };
    refreshSettings().then(function () {
        setInterval(refreshCache, 5000);
    });
};

module.exports = {
    init: init,
    refresh: refresh,
    messageReceived : messageReceived
};