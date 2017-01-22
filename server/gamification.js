'use strict';

var moment = require('moment');
var _ = require('lodash');
var _logger;
var util;
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(require('mongoose'));
var Build = mongoose.model('TeamcityBuild');
var achievements;


var scoreLookup = {
    'SUCCESS': {
        reason: 'Successful build',
        amount: 1
    },
    'FAILURE': {
        reason: 'Failed build',
        amount: -4
    },
    'TEST-FAILURE': {
        reason: 'Failed Tests',
        amount: -4
    },
    'FIXED_BUILD' : {
        reason: 'Fixed someone elses build',
        amount : 1
    }
};


var getScore = function(key, buildId){
    var points = scoreLookup[key];
    if (points) {
        return {
            dateAwarded: new moment(),
            buildId: buildId,
            reason : points.reason,
            amount : points.amount
        };
    } else {
        _logger.debug('Unknown score key: ' + key);
    }
};

var awardGamerScore_SuccessFail = function (build, developer) {
    if (util.builds.isDefault(build)) {

        if (!developer.scores) {
            developer.scores = [];
        }

        var scoreForBuildAlready = function (score) {
            if (score) {
                return score.buildId === build.id;
            }
            _logger.error('score is null!');
            return false;
        };

        if (_.find(developer.scores, scoreForBuildAlready)) {
            return;
        }
        var score = getScore(build.status,build.id);
        if (score) {
            developer.scores.push();
        }
    }
};

var checkFixingOtherPersonsBuild = function(build, developer){
    return new BBPromise(function(resolve){
        if (util.builds.isDefault(build) && util.builds.successful(build)) {
            return Build.getMostRecentDefaultBuild(build.buildType.id, build.id)
                .then(function (previousBuild) {
                    if (previousBuild){
                        if (util.builds.failed(previousBuild) && previousBuild.developer && previousBuild.developer.id !== developer.id) {
                            developer.scores.push(getScore('FIXED_BUILD',build.id));
                            achievements.award(developer, 'CINinja', {
                                name: 'CI Ninja',
                                reason: 'Fixed someone else\'s build',
                                buildId : build.id
                            });
                            if (!developer.fixedSomeoneElsesBuildCount){
                                developer.fixedSomeoneElsesBuildCount = 0;
                            }
                            developer.fixedSomeoneElsesBuildCount++;
                        }
                    }
                    resolve();
                });
        }
        resolve();
    });
};

var checkAchievements = function () {
    checkAchievements
};

var processBuild = function (build, developer) {
    if (!developer){
        return new BBPromise(function(resolve){
            resolve();
        });
    }
    awardGamerScore_SuccessFail(build, developer);
    return checkFixingOtherPersonsBuild(build,developer)
//        .then(function () {
//            return Build.getForDeveloperOnServer(developer, build.server);
//        })
//        .then(function (builds) {
//            achievements.checkAchievements(developer, builds)
//        })
        .then(function(){
            return developer.saveAsync();
        });
};

module.exports = function (core,logger) {
    _logger = logger;
    util = require('./util.js')(core,logger);
    achievements = require('./achievements')(core,logger);
    return {
        processBuild: processBuild,
        checkAchievements : checkAchievements
    };
};