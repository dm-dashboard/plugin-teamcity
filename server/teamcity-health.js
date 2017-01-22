'use strict';

var _ = require('lodash');
var moment = require('moment');
var socketIO;
var logger;
var settingsGetter;
var lastSettings;
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(require('mongoose'));
var util;

var Build = mongoose.model('TeamcityBuild');
var _requestInProgress = false;
var _cachedMessage = {};

var sendToSockets = function () {
    var message = {
        name: 'teamcity-health',
        payload: _cachedMessage
    };
    socketIO.sendMessageToAllSockets(message);
};

var calculateStats = function(builds){
    var today = moment().startOf('day');
    var beginningWeek = moment().startOf('week');

    var message = {
        today : {
            commits : 0,
            builds : 0,
            graph : [[]]
        },
        thisweek : {
            commits : 0,
            builds : 0,
            graph : [[]]
        },
        thismonth : {
            commits : 0,
            builds : 0,
            graph : [[]]
        }
    };

    var classifiedBuilds = {
        today : {
            SUCCESS : 0,
            FAILURE : 0,
            'TEST-FAILURE' : 0
        },
        week : {
            SUCCESS : 0,
            FAILURE : 0,
            'TEST-FAILURE' : 0
        },
        month : {
            SUCCESS : 0,
            FAILURE : 0,
            'TEST-FAILURE' : 0
        }
    }

    _.forEach(builds, function(build){
        if (build.finishDate > today){
            message.today.builds++;
            classifiedBuilds.today[build.status]++;
        }
        if (build.finishDate > beginningWeek){
            message.thisweek.builds++;
            classifiedBuilds.week[build.status]++;
        }
        message.thismonth.builds++;
        classifiedBuilds.month[build.status]++;
    });

    message.today.graph = [[
       ['Success' ,classifiedBuilds.today.SUCCESS],
       ['Failure' ,classifiedBuilds.today.FAILURE],
       ['Tests Failed' ,classifiedBuilds.today['TEST-FAILURE']]
    ]];

    message.thisweek.graph = [[
        ['Success' ,classifiedBuilds.week.SUCCESS],
        ['Failure' ,classifiedBuilds.week.FAILURE],
        ['Tests Failed' ,classifiedBuilds.week['TEST-FAILURE']]
    ]];

    message.thismonth.graph = [[
        ['Success' ,classifiedBuilds.month.SUCCESS],
        ['Failure' ,classifiedBuilds.month.FAILURE],
        ['Tests Failed' ,classifiedBuilds.month['TEST-FAILURE']]
    ]];

    _cachedMessage = message;
};

var getAllBuildsThisWeek = function(){
    var startOfMonth = moment().startOf('month');
    return Build.getForDateRange(startOfMonth)
        .then(calculateStats)
        .then(sendToSockets);
};

var refreshCache = function (done) {
    if (_requestInProgress) {
        //done();
        return;
    }
    _watchdogKicker();
    _requestInProgress = true;
    logger.debug('Calculating build health');
    getAllBuildsThisWeek()
        //.then(function(){
        //    done();
        //})
        .catch(function (err) {
            logger.error(err);
            //done(err);
        })
        .finally(function () {
            _requestInProgress = false;
        });
};


var messageReceived = function (message) {
    refresh();
};

var refresh = function () {
    sendToSockets();
};

var _watchdogKicker;

var init = function (core, io, settings, assignedLogger, scheduler, watchdogKicker) {
    _requestInProgress = false;
    logger = assignedLogger;
    util = require('./util')(core, logger);
    settingsGetter = settings;
    socketIO = io;
    socketIO.registerListener('teamcity-health', messageReceived);
    _watchdogKicker = watchdogKicker;
    setInterval(refreshCache, 60000);
    refreshCache();
    //scheduler.schedule('calculate-build-health','1 minute',refreshCache);
    //scheduler.runNow('calculate-build-health-startup',refreshCache);
};

module.exports = {
    init: init,
    refresh: refresh
};