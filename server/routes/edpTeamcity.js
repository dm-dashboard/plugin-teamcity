'use strict';

var url = require('url');
var realtime = require('../teamcity-realtime');
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(require('mongoose'));
var Developer = mongoose.model('TeamcityDeveloper');
var _ = require('lodash');

// The Package is past automatically as first parameter
module.exports = function(EdpTeamcity, app, auth, database) {

    app.get('/edpTeamcity/admin/settings', function(req, res, next) {
        EdpTeamcity.settings(function(err, settings){
            //Migrate to multipleources
            var tcSettings = settings.settings
            if (!tcSettings.servers){
                tcSettings.servers = [];
                tcSettings.servers.push({
                    url : tcSettings.url,
                    username : tcSettings.username,
                    password : tcSettings.password,
                    name : url.parse(tcSettings.url).hostname   ,
                    active : true
                });
                delete tcSettings.url;
                delete tcSettings.username;
                delete tcSettings.password;
            }
            res.json(tcSettings);
        });
    });

    app.post('/edpTeamcity/admin/settings', function(req, res, next){
        var settings = req.body;

        EdpTeamcity.settings(settings, function(err, settings){
            res.json();
        });
    });

    app.post('/edpTeamcity/admin/serverCheck', function (req, res, next) {
        realtime.messageReceived({
            command: 'checkServer',
            details: req.body
        }, function (response) {
            res.jsonp(response);
        });
    });

    app.get('/edpTeamcity/admin/:serverName/projects', function (req, res, next) {
        var serverName = req.params.serverName;
        realtime.messageReceived({
            command: 'getProjects',
            details: serverName
        }, function (response) {
            res.jsonp(response);
        });
    });

    app.get('/edpTeamcity/admin/:serverName/developers', function (req, res, next) {
        var serverName = req.params.serverName;
        realtime.messageReceived({
            command: 'getDevelopers',
            details: serverName
        }, function (response) {
            res.jsonp(response);
        });
    });

    app.get('/edpTeamcity/servers', function(req, res, next) {
        EdpTeamcity.settings(function(err, settings){
            var tcSettings = settings.settings;
            res.json(_.pluck(tcSettings.servers,'name'));
        });
    });

    app.get('/edpTeamcity/users', function(req, res, next) {
        Developer.getAllLinked(req.query.serverName)
            .then(function(developers){
                res.jsonp(developers);
            });
    });

    app.get('/edpTeamcity/users/orphan', function(req, res, next) {
        Developer.getOrphanDevelopers(req.query.serverName)
            .then(function(developers){
                res.jsonp(developers);
            });
    });

    app.put('/edpTeamcity/users/:id', function (req, res, next) {
        var postedDeveloper = req.body;
        Developer.findOneAsync({_id: postedDeveloper._id})
            .then(function (developer) {
                if (developer) {
                    var linkPromises = [];
                    _.forEach(developer.linkedUsers, function (linked) {
                        var promise = Developer.findOneAsync({_id: linked})
                            .then(function (linkedDev) {
                                linkedDev.linkSlave = false;
                                return linkedDev.saveAsync();
                            });
                        linkPromises.push(promise);
                    });
                    return BBPromise.all(linkPromises).then(function () {
                        developer = _.extend(developer, postedDeveloper);
                        linkPromises = [];
                        var links = [];
                        _.forEach(developer.linkedUsers, function (linked) {
                            var promise = Developer.findOneAsync({_id: linked})
                                .then(function (linkedDev) {
                                    linkedDev.linkSlave = true;
                                    return linkedDev.saveAsync();
                                });
                            linkPromises.push(promise);
                        });
                        return BBPromise.all(linkPromises)
                            .then(function () {
                                developer.saveAsync().then(function () {
                                    return developer;
                                });
                            });
                    });
                }
                return postedDeveloper;
            })
            .then(function (developer) {
                res.jsonp(developer);
            });
    });
};
