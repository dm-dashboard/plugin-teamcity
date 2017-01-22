'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    BBPromise = require('bluebird'),
    _ = require('lodash');


/**
 * TeamcityBuildChainSchema Schema
 */
var TeamcityBuildChainSchema = new Schema({
    id: {
        type: String
    },
    name : {
        type: String
    },
    links : [{
        projectId: {type: Schema.Types.ObjectId},
        buildTypeId: {type: Schema.Types.ObjectId}
    }],
    server : {
        name: {type : String},
        url: {type : String}
    }
});

TeamcityBuildChainSchema.statics.getById = function(chainId) {
    return this
        .findOne({id:chainId})
        .execAsync();
};

TeamcityBuildChainSchema.statics.all = function() {
    return this
        .find()
        .execAsync();
};

TeamcityBuildChainSchema.statics.allForServer = function(serverName) {
    return this
        .find({'server.name' : serverName})
        .execAsync();
};

mongoose.model('TeamcityBuildChain', TeamcityBuildChainSchema);
