'use strict';

/**
 * Module dependencies.
 */
var should = require('should'),
    mongoose = require('mongoose'),
    moment = require('moment'),
    achievements = require('../../server/achievements')();

describe('Achievements', function () {
    describe('Detection', function () {

        var developer = {
        };

        beforeEach(function (done) {
            developer.achievements = [];
            done();
        });

        describe('InTheZone', function () {

            it('should NOT award if 4 builds on the same day', function (done) {
                var builds = [
                    {queuedDate : moment('2014-01-04 00:01:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:01:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:02:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:03:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:04:00').toDate()},
                    {queuedDate : moment('2014-01-06 00:01:00').toDate()}
                ];
                achievements.addAchievementIfEarned('InTheZone',developer,builds);
                developer.achievements.should.have.length(0);
                done();
            });

            it('should award if 5 builds on the same day', function (done) {
                var builds = [
                    {queuedDate : moment('2014-01-04 00:01:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:01:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:02:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:03:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:04:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:05:00').toDate()},
                    {queuedDate : moment('2014-01-06 00:01:00').toDate()}
                ];
                achievements.addAchievementIfEarned('InTheZone',developer,builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','InTheZone');
                developer.achievements[0].achievement.should.have.property('amount',5);
                done();
            });

            it('should award if 6 builds on the same day', function (done) {
                var builds = [
                    {queuedDate : moment('2014-01-04 00:01:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:01:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:02:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:03:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:04:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:05:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:06:00').toDate()},
                    {queuedDate : moment('2014-01-06 00:01:00').toDate()}
                ];
                achievements.addAchievementIfEarned('InTheZone',developer,builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','InTheZone');
                developer.achievements[0].achievement.should.have.property('amount',6);
                done();
            });

            it('should award if 5 builds on the same day at end of array', function (done) {
                var builds = [
                    {queuedDate : moment('2014-01-04 00:01:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:01:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:02:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:03:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:04:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:05:00').toDate()}
                ];
                achievements.addAchievementIfEarned('InTheZone',developer,builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','InTheZone');
                developer.achievements[0].achievement.should.have.property('amount',5);
                done();
            });
        });

        describe('Terminator', function () {

            it('should award if 10 builds on the same day', function (done) {
                var builds = [
                    {queuedDate : moment('2014-01-04 00:01:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:01:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:02:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:03:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:04:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:05:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:06:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:07:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:08:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:09:00').toDate()},
                    {queuedDate : moment('2014-01-05 00:10:00').toDate()},
                    {queuedDate : moment('2014-01-06 00:01:00').toDate()}
                ];
                achievements.addAchievementIfEarned('Terminator',developer,builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','Terminator');
                developer.achievements[0].achievement.should.have.property('amount',10);
                done();
            });

        });

        describe('TimeWarrior', function () {
            it('should NOT award if time is less than 24 hours', function (done) {
                var builds = [
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 6:00:00').toDate()}
                ];
                achievements.addAchievementIfEarned('TimeWarrior',developer, builds);
                developer.achievements.should.have.length(0);
                done();
            });

            it('should award if time is equal to 24 hours', function (done) {
                var builds = [
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()}
                ];
                achievements.addAchievementIfEarned('TimeWarrior',developer, builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','TimeWarrior');
                done();
            });

            it('should award if time is over than 24 hours', function (done) {
                var builds = [
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()}
                ];
                achievements.addAchievementIfEarned('TimeWarrior',developer, builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','TimeWarrior');
                done();
            });
        });

        describe('Apprentice', function () {
            it('should NOT award for score of 24', function(done){
                developer.scores = [
                    {amount:24}
                ];
                achievements.addAchievementIfEarned('Apprentice',developer);
                developer.achievements.should.have.length(0);
                done();
            });

            it('should award for score of 25', function(done){
                developer.scores = [
                    {amount:25}
                ];
                achievements.addAchievementIfEarned('Apprentice',developer);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','Apprentice');
                done();
            });

            it('should award for score of more than 25', function(done){
                developer.scores = [
                    {amount:30}
                ];
                achievements.addAchievementIfEarned('Apprentice',developer);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','Apprentice');
                done();
            });
        });

        describe('Critical', function () {
            it('should NOT award if total builds is less than 50', function (done) {
                var builds = [
                    {status : 'SUCCESS'},
                    {status : 'SUCCESS'},
                    {status : 'SUCCESS'},
                    {status : 'SUCCESS'},
                    {status : 'SUCCESS'}
                ];
                achievements.addAchievementIfEarned('Critical',developer, builds);
                developer.achievements.should.have.length(0);
                done();
            });

            it('should NOT award if ratio is less than 90%', function (done) {
                var builds = [

                ];
                for (var i = 0; i < 40; i++){
                    builds.push({status : 'SUCCESS'});
                }
                for (var i = 0; i < 10; i++){
                    builds.push({status : 'FAILURE'});
                }
                achievements.addAchievementIfEarned('Critical',developer, builds);
                developer.achievements.should.have.length(0);
                done();
            });

            it('should award if ratio is equals to 90%', function (done) {
                var builds = [

                ];
                for (var i = 0; i < 45; i++){
                    builds.push({status : 'SUCCESS'});
                }
                for (var i = 0; i < 5; i++){
                    builds.push({status : 'FAILURE'});
                }
                achievements.addAchievementIfEarned('Critical',developer, builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','Critical');
                developer.achievements[0].achievement.should.have.property('ratio',90);
                done();
            });

            it('should award if ratio is more than 90%', function (done) {
                var builds = [];
                for (var i = 0; i < 50; i++){
                    builds.push({status : 'SUCCESS'});
                }
                achievements.addAchievementIfEarned('Critical',developer, builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','Critical');
                developer.achievements[0].achievement.should.have.property('ratio',100);
                done();
            });
        });

        describe('ChronMaster', function () {
            it('should award if time is equal to 48 hours', function (done) {
                var builds = [
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()}
                ];
                achievements.addAchievementIfEarned('ChronMaster',developer, builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','ChronMaster');
                done();
            });
        });

        describe('Perfectionist', function () {
            it('should award if ratio is equals to 90%', function (done) {
                var builds = [

                ];
                for (var i = 0; i < 95; i++){
                    builds.push({status : 'SUCCESS'});
                }
                for (var i = 0; i < 5; i++){
                    builds.push({status : 'FAILURE'});
                }
                achievements.addAchievementIfEarned('Perfectionist',developer, builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','Perfectionist');
                developer.achievements[0].achievement.should.have.property('ratio',95);
                done();
            });
        });

        describe('ReputationRebound', function () {
            it('', function (done) {
                done();
            });
        });

        describe('Assassin', function () {
            it('should NOT award when count is less than 10', function (done) {
                developer.fixedSomeoneElsesBuildCount = 8;
                achievements.addAchievementIfEarned('Assassin',developer);
                developer.achievements.should.have.length(0);
                done();
            });

            it('should award when count is equal to 10', function (done) {
                developer.fixedSomeoneElsesBuildCount = 10;
                achievements.addAchievementIfEarned('Assassin',developer);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','Assassin');
                done();
            });

            it('should award when count is more than 10', function (done) {
                developer.fixedSomeoneElsesBuildCount = 11;
                achievements.addAchievementIfEarned('Assassin',developer);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','Assassin');
                done();
            });
        });

        describe('Neophyte', function () {
            it('should award for score of 100', function (done) {
                developer.scores = [
                    {amount: 100}
                ];
                achievements.addAchievementIfEarned('Neophyte', developer);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id', 'Neophyte');
                done();
            });
        });

        describe('ChronGrandMaster', function () {
            it('should award if time is equal to 96 hours', function (done) {
                var builds = [
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()},
                    {startDate: moment('2014-01-01 00:00:00').toDate(), finishDate: moment('2014-01-01 12:00:00').toDate()}
                ];
                achievements.addAchievementIfEarned('ChronGrandMaster',developer, builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','ChronGrandMaster');
                done();
            });
        });

        describe('Master', function () {
            it('should award for score of 250', function (done) {
                developer.scores = [
                    {amount: 250}
                ];
                achievements.addAchievementIfEarned('Master', developer);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id', 'Master');
                done();
            });
        });

        describe('Napoleon', function () {
            it('', function (done) {
                done();
            });
        });

        describe('AndGotAwayWithIt', function () {
            it('should NOT award if fix build was after 60 seconds', function (done) {
                var builds = [
                    {finishDate : moment('2014-01-04 00:01:00').toDate(), status :'FAILURE'},
                    {startDate : moment('2014-01-05 00:01:00').toDate(), status :'SUCCESS'}
                ];
                achievements.addAchievementIfEarned('AndGotAwayWithIt',developer,builds);
                developer.achievements.should.have.length(0);
                done();
            });

            it('should award if fix build was exactly 60 seconds', function (done) {
                var builds = [
                    {finishDate : moment('2014-01-04 00:01:00').toDate(), status :'FAILURE'},
                    {startDate : moment('2014-01-04 00:02:00').toDate(), status :'SUCCESS'}
                ];
                achievements.addAchievementIfEarned('AndGotAwayWithIt',developer,builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','AndGotAwayWithIt');
                done();
            });

            it('should award if fix build was less than 60 seconds', function (done) {
                var builds = [
                    {finishDate : moment('2014-01-04 00:01:00').toDate(), status :'FAILURE'},
                    {startDate : moment('2014-01-04 00:00:30').toDate(), status :'SUCCESS'}
                ];
                achievements.addAchievementIfEarned('AndGotAwayWithIt',developer,builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','AndGotAwayWithIt');
                done();
            });
        });

        describe('GrandMaster', function () {
            it('should award for score of 500', function (done) {
                developer.scores = [
                    {amount: 500}
                ];
                achievements.addAchievementIfEarned('GrandMaster', developer);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id', 'GrandMaster');
                done();
            });
        });

        describe('LikeLightning', function () {
            it('should NOT award if less than 3 back to back successes', function (done) {
                var builds = [
                    {finishDate : moment('2014-01-04 00:01:00').toDate(), status :'SUCCESS'},
                    {startDate : moment('2014-01-04 00:02:00').toDate(), status :'SUCCESS'}
                ];
                achievements.addAchievementIfEarned('LikeLightning',developer,builds);
                developer.achievements.should.have.length(0);
                done();
            });

            it('should award if exactly 3 back to back successes', function (done) {
                var builds = [
                    {finishDate : moment('2014-01-04 00:01:00').toDate(), status :'SUCCESS'},
                    {startDate : moment('2014-01-04 00:02:00').toDate(), status :'SUCCESS'},
                    {startDate : moment('2014-01-04 00:02:00').toDate(), status :'SUCCESS'}
                ];
                achievements.addAchievementIfEarned('LikeLightning',developer,builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','LikeLightning');
                done();
            });

            it('should award if more than 3 back to back successes', function (done) {
                var builds = [
                    {finishDate : moment('2014-01-04 00:01:00').toDate(), status :'SUCCESS'},
                    {startDate : moment('2014-01-04 00:02:00').toDate(), status :'SUCCESS'},
                    {startDate : moment('2014-01-04 00:02:00').toDate(), status :'SUCCESS'},
                    {startDate : moment('2014-01-04 00:02:00').toDate(), status :'SUCCESS'}
                ];
                achievements.addAchievementIfEarned('LikeLightning',developer,builds);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id','LikeLightning');
                done();
            });
        });

        describe('Legend', function () {
            it('should award for score of 1000', function (done) {
                developer.scores = [
                    {amount: 1000}
                ];
                achievements.addAchievementIfEarned('Legend', developer);
                developer.achievements.should.have.length(1);
                developer.achievements[0].should.have.property('id', 'Legend');
                done();
            });
        });

        after(function (done) {
            done();
        });
    });
});
