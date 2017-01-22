'use strict'

var moment = require('moment');
var _ = require('lodash');

var util, _logger;

var gamerScoreAchievement = function (developer, target, name) {
    if (util.gamification.gamerScore(developer) >= target) {
        return {
            name: name,
            reason: target + ' Gamerscore'
        };
    }
};


var buildsOnADayAchievement = function (builds, target, name) {
    var generate = function (totalBuilds, date) {
        return {
            name: name,
            reason: 'Queued ' + target + '+ builds in one day',
            amount: totalBuilds
        };
    };

    var lastQueueDate;
    var countOnDay = 0;
    var achievement;
    _.all(builds, function (build) {
        if (!lastQueueDate) {
            lastQueueDate = moment(build.queuedDate);
            countOnDay = 1;
            return true;
        }
        if (moment(build.queuedDate).isSame(lastQueueDate, 'day')) {
            //Still the same day, so increment counter
            countOnDay++;
        } else {
            //Day has changed, check if over threshold
            if (countOnDay >= target) {
                achievement = generate(countOnDay, lastQueueDate);
                //Achievement earned, so we can stop looking now
                return false;
            }
            //No achievement on previous day, so reset counter for this new day
            countOnDay = 1;
        }
        lastQueueDate = moment(build.queuedDate);
        return true;
    });
    //Check the last count from when loop ended
    if (countOnDay >= target) {
        achievement = generate(countOnDay, lastQueueDate);
    }
    return achievement;
};

var backToBackSuccessfulAchievement = function (builds, target, name) {
    var achievement;
    var backToBackSuccess = 0;
    _.all(builds, function (build) {
        if (util.builds.successful(build)) {
            backToBackSuccess++;
            if (backToBackSuccess >= target) {
                achievement = {
                    name: name,
                    reason: target + ' successful builds back to back',
                    builds: backToBackSuccess
                };
                return false;
            }
        } else {
            backToBackSuccess = 0;
        }
        return true;
    });
    return achievement;
};

var cumulativeBuildtimeAchievement = function (builds, target, name) {
    var buildTimeInHours = _.reduce(builds, function (result, build) {
        return result + moment(build.finishDate).diff(moment(build.startDate), 'hours', true);
    }, 0.0);
    if (buildTimeInHours >= target) {
        return {
            name: name,
            reason: target + ' hours of cumulative build time'
        };
    }
};

var successRatioAchievement = function (builds, target, name) {
    if (builds.length >= 50) {
        var result = _.reduce(builds, function (result, build) {
            if (util.builds.successful(build)) {
                result.success++;
            } else {
                result.failed++;
            }
            return result;
        }, {success: 0, failed: 0});
        var successRatio = result.success / (result.success + result.failed) * 100;
        if (successRatio >= target) {
            return {
                name: name,
                reason: 'Over ' + target + '% success build ratio after 50 builds',
                ratio: successRatio
            };
        }
    }
};

var achievmentTests = {
    InTheZone: function (developer, builds) {
        return buildsOnADayAchievement(builds, 5, 'In the zone');
    },
    Terminator: function (developer, builds) {
        return buildsOnADayAchievement(builds, 10, 'Terminator');
    },
    TimeWarrior: function (developer, builds) {
        return cumulativeBuildtimeAchievement(builds, 24, 'Time Warrior');
    },
    Apprentice: function (developer, builds) {
        return gamerScoreAchievement(developer, 25, 'Apprentice');
    },
    Critical: function (developer, builds) {
        return successRatioAchievement(builds, 90, 'Critical');
    },
    ChronMaster: function (developer, builds) {
        return cumulativeBuildtimeAchievement(builds, 48, 'Chron Master');
    },
    Perfectionist: function (developer, builds) {
        return successRatioAchievement(builds, 95, 'Perfectionist');
    },
    ReputationRebound: function (developer, builds) {
        //Reputation Rebound 
        // 3 consecutive fails but recovered reputation
    },
    Assassin: function (developer, builds) {
        if (developer.fixedSomeoneElsesBuildCount >= 10){
            return {
                name : 'Assassin',
                reason : 'Fixed someone elses failed build 10+ times'
            };
        }
    },
    Neophyte: function (developer) {
        return gamerScoreAchievement(developer, 100, 'Neophyte');
    },
    ChronGrandMaster: function (developer, builds) {
        return cumulativeBuildtimeAchievement(builds, 96, 'Chron Grand Master');
    },
    Master: function (developer) {
        return gamerScoreAchievement(developer, 250, 'Master');
    },
    Napoleon: function (developer, builds) {
        //Napoleon 
        // 100 more reputation that anyone else
    },
    AndGotAwayWithIt: function (developer, builds) {
        var achievement;
        var lastOneFailed = false;
        var lastFinishTime;
        _.all(builds,function(build){
            if (lastOneFailed && util.builds.successful(build)){
                var timeToFix = moment(build.startDate).diff(lastFinishTime,'seconds');
                if (timeToFix <= 60){
                    achievement = {
                        name: 'And got away with it',
                        reason: 'Fixed a broken build within 60 seconds'
                    };
                    return false;
                }
            }
            lastOneFailed = util.builds.failed(build);
            lastFinishTime = moment(build.finishDate);
            return true;
        });
        return achievement;
    },
    GrandMaster: function (developer) {
        return gamerScoreAchievement(developer, 500, 'Grand Master');
    },
    LikeLightning: function (developer, builds) {
        return backToBackSuccessfulAchievement(builds, 3, 'Like lightning');
    },
    Legend: function (developer) {
        return gamerScoreAchievement(developer, 1000, 'Legend');
    }
};

var achievementAlreadyAwarded = function (achievementName, developer) {
    return _.find(developer.achievement, function (oldAchievement) {
        return oldAchievement.id === achievementName;
    });
};

var addAchievementIfEarned = function (name, developer, builds) {
    var achievement = achievmentTests[name](developer, builds);
    if (achievement) {
        developer.achievements.push({
            id : name,
            dateAwarded: moment(),
            achievement: achievement
        });
    }
};

var checkAchievements = function (developer, builds) {
    _logger.debug('Checking for achievements for ' + developer.username);
    if (!developer.achievements) {
        developer.achievements = [];
    }
    _.forEach(achievmentTests, function (test, name) {
        if (!achievementAlreadyAwarded(name, developer)) {
            addAchievementIfEarned(name, developer, builds);
        }
    });
};

var awardCustom = function (developer,id, achievement) {
    if (!developer.achievements) {
        developer.achievements = [];
    }
    if (!achievementAlreadyAwarded(id, developer)) {
        developer.achievements.push({
            id : id,
            dateAwarded: moment(),
            achievement: achievement
        });
    }
};

module.exports = function (core,logger) {
    _logger = logger;
    util = require('./util.js')(core,logger);
    return {
        checkAchievements: checkAchievements,
        award: awardCustom,
        addAchievementIfEarned : addAchievementIfEarned
    };
};


