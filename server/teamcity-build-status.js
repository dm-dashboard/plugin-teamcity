'use strict';

var _ = require('lodash');
var moment = require('moment');
var socketIO;
var logger;
var settingsGetter;

var _requestInProgress = false;
var _cachedMessage = null;
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(require('mongoose'));
//mongoose.set('debug', true);

var Build = mongoose.model('TeamcityBuild');
var Project = mongoose.model('TeamcityProject');
var Developer = mongoose.model('TeamcityDeveloper');

var timePoint;
var timeSection;
function startTimer(section){
    //timeSection = section;
    //timePoint = moment();
    //logger.info("Starting timing on " + section);
}

function endTimer(){
    //var now = moment();
    //var diff = now.diff(timePoint,'seconds');
    //logger.info("Timing ended on " + timeSection + ", " + diff + " seconds");
}

function switchTimer(newSection){
    //endTimer();
    //startTimer(newSection);
}

var sortOrder = {
    failure : 0,
    'test-failure' : 1,
    success : 2
};

var parseDate = function(dateString){
    return moment(dateString,'YYYYMMDDTHHmmssZZ');
};

var prepareForUI = function(build){
    return {
        status : build.status,
        projectName : build.buildType.projectName,
        name : build.buildType.name,
        finishDate : build.finishDate,
        username : build.developer ? build.developer.username : 'Unknown',
        id : build.id
    };
};

var filterOutNullBuilds = function(build){
    return build !== null;
};

var sortByStatusAndThenDate = function(build1, build2){
    var sortInt = sortOrder[build1.status.toLowerCase()] - sortOrder[build2.status.toLowerCase()];
    if (sortInt === 0){
        sortInt =  build2.finishDate - build1.finishDate;
    }
    return sortInt;
};

var getDeveloperDetailsAndPrepareForUI = function(build){
    return Developer.getByMongoId(build.developer)
        .then(function(dev){
            build.developer = dev;
            return prepareForUI(build);
        });
};

var processBuilds = function(buildStatuses){
    switchTimer("ProcessBuilds");
    var filtered = buildStatuses.filter(filterOutNullBuilds);
    var latest = filtered.sort(sortByStatusAndThenDate).slice(0,9);
    return BBPromise.map(latest, getDeveloperDetailsAndPrepareForUI);
};

var getLatestBuildPerBuildType = function(buildTypes){
    switchTimer("LatestPerBuildType");
    return Build.getLatestDefaultBuildGroupByBuildType()
        .then(function(latestBuilds){
            return latestBuilds.map(function(buildGrouping){
                return buildGrouping.mostRecentBuild;
            });   
        });
};

var refreshCache = function(done){
    if (_requestInProgress){
        logger.debug('Not refreshing, already in progress');
        return;
    }
    _requestInProgress = true;
    _watchdogKicker();
    startTimer("buildTypes");
    Project.allBuildTypes(true)
        .then(getLatestBuildPerBuildType)
        .then(processBuilds)
        .then(function (builds) {
            switchTimer("CreateCache");
            _cachedMessage = {
                name: 'teamcity-status',
                payload: {
                    freshBuilds: builds
                }
            };
        })
        .then(refresh)
        .catch(function(error){
            logger.error('Could not calculate build status: ' , error);
        })
        .finally(function(){
            _requestInProgress = false;
        });
};

var refresh = function () {
    endTimer();
    if (_cachedMessage !== null){
        socketIO.sendMessageToAllSockets(_cachedMessage);
    }
};

var messageReceived = function (message, replyCallback) {
    refresh();
};

var _watchdogKicker;
var init = function(core, io, settings, assignedLogger, scheduler, watchdogKicker){
    _requestInProgress = false;
    logger = assignedLogger;
    settingsGetter = settings;
    socketIO = io;
    _watchdogKicker = watchdogKicker;
    socketIO.registerListener('teamcity-status', messageReceived);
    refreshCache();
    setInterval(refreshCache, 60000);
};

module.exports = {
    init : init,
    refresh : refresh
};