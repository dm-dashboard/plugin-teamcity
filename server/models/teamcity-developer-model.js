'use strict';

/**
 * Module dependencies.
 */
var BBPromise = require('bluebird'),
    mongoose = BBPromise.promisifyAll(require('mongoose')),
    Schema = mongoose.Schema;



/**
 * Article Schema
 */
var TeamcityDeveloperSchema = new Schema({
    id: {
        type : Number
    },
    username : {
        type : String
    },
    href: {
        type : String
    },
    lastLogin : {
        type : Date
    },
    email : {
        type : String
    },
    fixedSomeoneElsesBuildCount: {
        type: Number
    },
    linkSlave : {type : Boolean},
    linkedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'TeamcityDeveloper'
    }],
    scores : [
        {
            dateAwarded : { type : Date},
            reason : {type : String},
            amount : {type : Number},
            buildId : {type : Number}
        }
    ],
    achievements: [
        {
            dateAwarded: { type: Date},
            achievement: {type: Schema.Types.Mixed}
        }
    ],
    server : {
        name: {type : String},
        url: {type : String}
    }
});


TeamcityDeveloperSchema.statics.exists = function(userId) {
    var self = this;
    return new BBPromise(function(resolve, reject){
        self.findOne({id:userId}).execAsync()
            .then(resolve).catch(reject).done();
    });
};

TeamcityDeveloperSchema.statics.getById = function(userId) {
    return this.findOneAsync({id:userId});
};

TeamcityDeveloperSchema.statics.getByMongoId = function(id) {
    return this.findOneAsync({_id:id});
};

TeamcityDeveloperSchema.statics.getByUsername = function(username) {
    return this.findOneAsync({username:username});
};

TeamcityDeveloperSchema.statics.leaderboard = function () {
    var o = {
        map: function () {
            for (var index in this.scores) {
                emit(this.username, this.scores[index].amount);
            }
        },
        reduce: function (key, values) {
            return Array.sum(values);
        },
        out: {replace: 'teamcityleaderboard'}
    };

    return this.mapReduce(o);
    };

TeamcityDeveloperSchema.statics.getAllLinked = function (serverName) {
    return this.find(
        {
            $or : [{linkSlave: false},{linkSlave:null}],
            'server.name': serverName,
            href :{$ne: null}
        },
        {
            achievements: 0,
            scores: 0,
            href: 0,
            __v: 0,
            'server.url' : 0
        })
        .populate('linkedUsers')
        .sort('username')
        .execAsync();
};

TeamcityDeveloperSchema.statics.getOrphanDevelopers = function (serverName) {
    return this.find({
            $and : [
//                {id:null},
                {
                    $or : [
                        {linkSlave : false},
                        {linkSlave : null}
                    ]
                }
            ],
            'server.name': serverName
        },
        {
            achievements: 0,
            scores: 0,
            href: 0,
            __v: 0,
            'server.url' : 0
        })
        .sort('username')
        .execAsync();
};

TeamcityDeveloperSchema.statics.allForServer = function(serverName) {
    return this
        .find({'server.name' : serverName})
        .sort('username')
        .execAsync();
};

mongoose.model('TeamcityDeveloper', TeamcityDeveloperSchema);
