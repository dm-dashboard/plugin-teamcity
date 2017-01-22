'use strict';

var _ = require('lodash');
var moment = require('moment');

var Client = require('node-rest-client').Client;
var wrapRestCall;
var automapper;

var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(require('mongoose'));
var Build = mongoose.model('TeamcityBuild');
var Project = mongoose.model('TeamcityProject');
var Developer = mongoose.model('TeamcityDeveloper');
var Team = mongoose.model('TeamcityTeam');

var logger;
var util, gamification;
var settingsGetter;
var lastSettings;
var teamCityServers = [];
var _requestInProgress = false;
var timeBetweenFullSyncs = 60;
var _watchdogKicker;

var request_args = {
    headers: {
        'Accept': 'application/json'
    }
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

                    teamCityServers = util.loadServerDetails(newSettings, function(newServer){
                        newServer.rest_projects = wrapRestCall(newServer.client, 'projects', newServer.url + '/httpAuth/app/rest/projects', 'GET');
                        newServer.rest_builds = wrapRestCall(newServer.client, 'builds', newServer.url + '/httpAuth/app/rest/builds', 'GET');
                        newServer.rest_users = wrapRestCall(newServer.client, 'users', newServer.url + '/httpAuth/app/rest/users', 'GET');
                    });

                    util.REST.setParams(request_args);
                    lastSettings = newSettings;
                    resolve(true);
                }
                resolve(false);
            });
    });
};

var saveProject = function (server, projectDetails, existingProject) {
    var project = existingProject?existingProject:new Project();
    logger.debug((existingProject ? 'Force refreshing project ': 'New project found: ') + projectDetails.name);
    automapper.map('restproject', 'mongoproject', projectDetails, project);
    project.server = {
        name : server.name,
        url : server.url
    };
    project.save();
};

var updateBuildTypes = function(server,project){
  return BBPromise.map(project.buildTypes.buildType, function (buildType){
    return server.rest_generic_get(server.url + buildType.href, request_args)
        .then(function(detailedBuildType){
          buildType["snapshot-dependencies"] = detailedBuildType["snapshot-dependencies"]["snapshot-dependency"];
        })
        .catch(function(error){
            logger.error("Could not get build type details for [" + buildType.href + "]", error);
        });
  });
};

var findBuildChains = function(server, projects){
    return Project.allBuildTypes(true)
        .then(function(buildTypes){

        });
};

var processProjects = function (data, server, doFullSync) {
    var projects = data.project;
    return BBPromise.map(projects, function (project) {
        return Project.exists(project.id).then(function (existingProject) {
            if (doFullSync || !existingProject) {
                return server.rest_generic_get(server.url + project.href, request_args)
                    .then(function(projectDetails){
                        if (projectDetails.buildTypes) {
                            updateBuildTypes(server,projectDetails)
                                .then(function(){
                                    saveProject(server, projectDetails, existingProject);
                                });
                        }
                    }).catch(function(error){
                        logger.error("Could not get project details for [" + project.id + "]", error);
                    });
            }
        });
    }, {concurrency: 5})
        .then(function(result){
            return findBuildChains(server,projects)
                .then(function(){
                    return result
                });
        })
        .then(function(result){
            if (!server.lastFullSync){
                server.lastFullSync = {};
            }
            server.lastFullSync.projects = moment();
            return result;
        });
};

var getStatistics = function (statsObject, server) {
    return new BBPromise(function (resolve, reject) {
        if (!statsObject || !statsObject.href){
            resolve({
                location : 'NO STATS',
                stats : []
            });
            return;
        }
        return server.rest_generic_get(server.url + statsObject.href, request_args)
            .then(function (stats) {
                resolve({
                    location: statsObject.href,
                    stats: stats.property
                });
            })
            .catch(function(error){
                logger.error("Could not get stats for [" + statsObject.href + "]", error);
                reject();
            });
        });
};

var saveBuild = function (detailedBuild, project, server, saveEvenIfExists) {
    return new BBPromise(function (resolve) {
        return Build.getById(detailedBuild.id)
            .then(function (existingBuild) {
                if (existingBuild && !saveEvenIfExists) {
                    resolve();
                    return;
                }
                var build = new Build();
                automapper.map('restbuild', 'mongobuild', detailedBuild, build);
                build.project = project;
                var developerModel;

                return util.REST.getChanges(server, detailedBuild.changes.href, detailedBuild.lastChanges, function (change) {
                    return automapper.mapToNew('restchange', 'mongochange', change);
                })
                    .then(function (changes) {
                        build.changes = changes;
                        build.server = {
                            name : server.name,
                            url : server.url
                        };
                        return util.getDeveloper(build);
                    })
                    .then(function (developer) {
                        build.developer = developer;
                        developerModel = developer;
                        return getStatistics(detailedBuild.statistics, server);
                    })
                    .then(function (stats) {
                        if (build.testDetails.testsRun){
                            if (build.status === 'FAILURE' && !build.testDetails.allPassed){
                                build.status = 'TEST-FAILURE';
                            }
                        }
                        build.statistics = stats;

                        build.saveAsync()
                            .then(function () {
                                gamification.processBuild(build, developerModel)
                                    .then(function(){
                                        resolve(build);
                                    });
                            });
                    }).catch(function(error){
                        logger.error("Could not get changes for build [" + build.id + "]", error);
                    });
            });

    });
};

var addBuildsToProject = function (project, builds) {
    return Project.getById(project.id)
        .then(function (mongoProject) {
            var validBuilds = builds.filter(function(build){
                return !!build;
            });
            if (validBuilds.length > 0) {
                mongoProject.builds = mongoProject.builds.concat(validBuilds);
                logger.debug('Got and saving ' + validBuilds.length + ' new builds for ' + project.name);
                return mongoProject.saveAsync();
            }else{
                return new BBPromise(function(resolve){resolve();});
            }
        });
};

var getDetailsAndSaveBuilds = function (project, server, builds) {
    return new BBPromise(function (resolve) {
        return BBPromise.map(builds, function (build) {
            return server.rest_generic_get(server.url + build.href, request_args)
                .then(function (detailedBuild) {
                    return saveBuild(detailedBuild, project, server);
                }).catch(function(error){
                    logger.error("Could not get build [" + build.href + "]", error);
                });
        }, {concurrency: 5})
            .then(function (newBuilds) {
                return addBuildsToProject(project, newBuilds)
                    .then(resolve);
            });
    });
};

var getNewBuildsForProjects = function (project, server) {
    return new BBPromise(function (resolve, reject) {
        if (project.id === '_Root') {
            resolve();
            return;
        }

        return Build.mostRecentForProject(project._id)
            .then(function (mostRecentBuild) {
                var locator = 'branch:(default:any),project:' + project.id;
                if (mostRecentBuild) {
                    locator += ',sinceDate:' + util.dates.formatAsTeamcityDate(mostRecentBuild.startDate);
                }else{
                    locator += ',sinceDate:' + util.dates.formatAsTeamcityDate('2014-07-01T00:00:00.000+0200');
                }
                //logger.debug(locator);
                return util.REST.getAllPages(server, server.rest_builds, 'build', locator)
                    .then(function (builds) {
                        return getDetailsAndSaveBuilds(project,server, builds)
                            .then(resolve);
                    })
                    .catch(reject);
            })
            .catch(reject);

    });
};

var getLatestBuilds = function (server) {
    logger.debug('Getting latest builds');
    return new BBPromise(function (resolve, reject) {

        return Project.allForServer(server.name)
            .map(function (project) {
                return getNewBuildsForProjects(project, server);
            }, {concurrency: 1})
            .then(resolve)
            .catch(reject);
    });
};

var saveUser = function (userDetails, server, existingUser) {
    var user = existingUser ? existingUser : new Developer();
    logger.debug((existingUser ? 'Force refreshing developer: ' : 'New developer found: ') + userDetails.username);
    automapper.map('restdeveloper', 'mongodeveloper', userDetails, user);
    user.linkSlave = false;
    user.server = {
        name : server.name,
        url : server.url
    };
    user.save();
};

var processUsers = function (userList, server, forceRefresh) {
    var users = userList.user;
    return BBPromise.map(users, function (user) {
        return Developer.exists(user.id)
            .then(function (userExists) {
                if (forceRefresh || !userExists) {
                    return server.rest_generic_get(server.url + user.href, request_args)
                        .then(function(user){
                            saveUser(user,server, userExists);
                        })
                        .catch(function(error){
                            logger.error("Could not get user for [" + user.href + "]", error);
                        });
                }
            });
    }, {concurrency: 1})
        .then(function (result) {
            if (!server.lastFullSync){
                server.lastFullSync = {};
            }
            server.lastFullSync.developers = moment();
            return result;
        });
};

var getAllUsers = function (server) {
    logger.debug('Checking for new TeamCity users');
    var doFullSync = timeSinceLastSync(server, 'developers') >= timeBetweenFullSyncs;
    return server.rest_users(request_args)
        .then(function(users){
            return processUsers(users, server, doFullSync);
        })
        .then(function(){
            return server;
        }).catch(function(error){
            logger.error("Could not get users", error);
        });
};

var timeSinceLastSync = function (server, area) {
    if (server && server.lastFullSync && server.lastFullSync[area]) {
        return moment().diff(server.lastFullSync[area], 'minutes');
    }
    return timeBetweenFullSyncs;
};

var getAllProjects = function (server) {
    logger.debug('Checking for new TeamCity projects');
    var doFullSync = timeSinceLastSync(server, 'projects') >= timeBetweenFullSyncs;

    return server.rest_projects(request_args)
        .then(function(projects){
            return processProjects(projects, server, doFullSync)
        })
        .then(function(){
            return server;
        }).catch(function(error){
            logger.error("Could not get projects for [" + server.url + "]", error);
        });
};

var refreshForServer = function (teamCityServer) {
    logger.debug('Teamcity update for [' + teamCityServer.name + ']');
    return new BBPromise(function (resolve, reject) {
        return getAllUsers(teamCityServer)
            .then(getAllProjects)
            .then(getLatestBuilds)
            .then(resolve)
            .catch(reject);
    });
};

var checkAchievementsForServer = function (server) {
    return BBPromise.map(Developer.findAsync(), function (developer) {
        return gamification.checkAchievements(developer, server.name);
    });
};

var checkAchievements = function(done){
    logger.debug('Checking for new achievements');
    return BBPromise.map(teamCityServers, function (server) {
        return checkAchievementsForServer(server);
    }, {concurrency: 1})
        .then(function () {
            logger.debug('Finished checking achievements');
            done();
        })
        .catch(function (err) {
            logger.error('Could not check achievements -' + err);
            done(err);
        });
};

var refreshCache = function () {
    if (_requestInProgress){
        logger.debug('Not refreshing as a request is already in progress');
        return;
    }
    _requestInProgress = true;

    logger.debug('Refreshing TeamCity Statistics');
    _watchdogKicker();

    refreshSettings()
        .then(function(){
            return BBPromise.map(teamCityServers, function(server){
                    return refreshForServer(server);
            }, {concurrency : 1});
        })
        .catch(function (err) {
            logger.error(err);
        })
        .finally(function () {
            _requestInProgress = false;
        });
};

var refresh = function () {
   //Do nothing here, this is just a background job updating the database
};

var messageReceived = function (message, replyCallback) {


};

var setupAutoMapper = function (core) {
    automapper = core.util.autoMapper;
    automapper.createCustomMapping('restproject', 'mongoproject', {createInDestination: true})
        .forMember('buildTypes', function (src, dest, key) {
            dest[key] = src[key].buildType;
        });
    automapper.createCustomMapping('restdeveloper', 'mongodeveloper', {createInDestination: true})
        .forMember('lastLogin', util.dates.parseTeamcityDate);

    automapper.createCustomMapping('restchange', 'mongochange', {createInDestination: true})
        .forMember('date', util.dates.parseTeamcityDate)
        .forMember('user', function (src, dest, key) {
            dest.userId = src.user.id;
        });

    automapper.createCustomMapping('trigger', 'trigger', {createInDestination: true})
        .forMember('date', util.dates.parseTeamcityDate);

    automapper.createCustomMapping('restbuild', 'mongobuild', {createInDestination: true})
        .forMember('queuedDate', util.dates.parseTeamcityDate)
        .forMember('startDate', util.dates.parseTeamcityDate)
        .forMember('finishDate', util.dates.parseTeamcityDate)
        .forMember('triggered', function (src, dest, key) {
            var srcTrigger = src[key];
            var destTrigger = {};
            automapper.map('trigger', 'trigger', srcTrigger, destTrigger);
            dest[key] = destTrigger;
        })
        .forMember('testOccurrences', function(src,dest){
            dest.testDetails = {
                testsRun : src.testOccurrences.count,
                testsPassed : src.testOccurrences.passed,
                href : src.testOccurrences.href,
                allPassed : src.testOccurrences.count === src.testOccurrences.passed
            };
        });

};

var init = function (core, io, settings, assignedLogger, scheduler, watchdogKicker) {
    logger = assignedLogger;
    util = require('./util')(core, logger);
    gamification = require('./gamification')(core,logger);
    settingsGetter = settings;
    wrapRestCall = core.util.promiseRestWrapper;
    setupAutoMapper(core);
    _requestInProgress = false;
    _watchdogKicker = watchdogKicker;

    refreshSettings().then(function () {
        setInterval(refreshCache, 5*1000);
        //scheduler.schedule('fetch-latest-stats','5 seconds',refreshCache);
        //scheduler.schedule('calculate-achievements','10 minutes',checkAchievements);
    });
};

module.exports = {
    init: init,
    refresh: refresh,
    messageReceived: messageReceived
};