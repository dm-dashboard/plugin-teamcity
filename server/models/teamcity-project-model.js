'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    BBPromise = require('bluebird'),
    _ = require('lodash');


/**
 * Article Schema
 */
var TeamcityProjectSchema = new Schema({
    id: {
        type: String
    },
    name : {
        type: String
    },
    href : {
        type: String
    },
    webUrl : {
        type: String
    },
    buildTypes : [{
        id: {type: String},
        name: {type: String},
        projectName: {type: String},
        projectId: {type: String},
        href: {type: String},
        webUrl: {type: String},
        paused: {type: Boolean},
        "snapshot-dependencies": [{
            "source-buildType": {
                "id": {type: String},
                "name": {type: String},
                "projectName": {type: String},
                "projectId": {type: String},
                "href": {type: String},
                "webUrl": {type: String}
            }
        }],
        partOfChain : {type : Boolean}
    }],
    builds: [{
        type: Schema.Types.ObjectId,
        ref: 'TeamcityBuild'
    }],
    server : {
        name: {type : String},
        url: {type : String}
    }
});

/**
 * Statics
 */
TeamcityProjectSchema.statics.exists = function(projectId) {
    var self = this;
    return new BBPromise(function(resolve, reject){
        self.findOne({id:projectId}).execAsync()
            .then(resolve).catch(reject).done();
    });

};

TeamcityProjectSchema.statics.getById = function(projectId) {
    return this
        .findOne({id:projectId})
        .populate('builds')
        .execAsync();
};

TeamcityProjectSchema.statics.all = function() {
    return this
        .find()
        .sort('id')
        .execAsync();
};

TeamcityProjectSchema.statics.allForServer = function(serverName) {
    return this
        .find({'server.name' : serverName})
        .sort('name')
        .execAsync();
};

TeamcityProjectSchema.statics.findBuildType = function(buildTypeId){
    var self = this;
    return new BBPromise(function(resolve){
        self
            .findOne( { buildTypes : {$elemMatch : {id : buildTypeId}}})
            .select ( { buildTypes : {$elemMatch : {id : buildTypeId}}})
            .execAsync()
            .then(function(result){
                if (result && result.buildTypes && result.buildTypes.length > 0){
                    resolve(result.buildTypes[0]);
                } else{
                    resolve({
                        projectName : 'Unknown',
                        name : buildTypeId
                    });
                }
            });
    });
};

TeamcityProjectSchema.statics.allBuildTypes = function(excludePaused){
    var self = this;
    return new BBPromise(function(resolve){
        self
            .find()
            .select( { buildTypes : 1})
            .execAsync()
            .then(function(result){
                var buildTypes = [];
                _.forEach(result, function(type){
                    buildTypes = buildTypes.concat(type.buildTypes.filter(function(type){
                        if (excludePaused){
                            return !type.paused;
                        }
                        return true;
                    }));
                });
                buildTypes = _.uniq(buildTypes,false, function(bt){
                    return bt.id;
                });
                resolve(buildTypes);
            });
    });
};

TeamcityProjectSchema.statics.buildTypesForProjects = function(projectIds, filter){
    var self = this;

    return BBPromise.map(projectIds, function(projectId){
        return self
            .findOne({id : projectId})
            .select( { buildTypes : 1})
            .execAsync()
            .then(function(result){
                if (filter) {
                    return result.buildTypes.filter(function (buildType) {
                        return filter.test(buildType.id);
                    });
                }
                return result.buildTypes;
            });
    });
};

mongoose.model('TeamcityProject', TeamcityProjectSchema);
