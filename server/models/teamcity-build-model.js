'use strict';
var BBPromise = require('bluebird');

var mongoose = BBPromise.promisifyAll(require('mongoose')),
    Schema = mongoose.Schema;

//mongoose.set('debug', function (collectionName, method, query, doc, options) {
//    console.log(query);
//});

/**
 * Article Schema
 */
var TeamcityBuildSchema = new Schema({
    id: {
        type: Number
    },
    buildType : {
        id: {type: String},
        name: {type: String},
        description: {type: String},
        projectName: {type: String},
        projectId: {type: String},
        href: {type: String},
        webUrl: {type: String},
        paused : {type : Boolean}
    },
    number : {
        type : String
    },
    status : {
        type : String
    },
    state : {
        type : String
    },
    branchName : {
        type : String
    },
    defaultBranch : {
        type : Boolean
    },
    href : {
        type : String
    },
    webUrl : {
        type : String
    },
    statusText : {
        type : String
    },
    queuedDate: {
        type : Date
    },
    startDate: {
        type : Date
    },
    finishDate: {
        type : Date
    },
    triggered: {
        type: { type: String },
        details: { type: String },
        date: { type: Date }
    },
    changes : [{
        id: {type: Number},
        version : {type : String},
        username  : {type : String},
        userId : {type: Number},
        date  : {type : Date},
        href  : {type : String},
        webLink  : {type : String},
        comment  : {type : String}
    }],

    agent : {
        id: {type: Number},
        name : {type : String},
        typeId : {type : Number},
        href: {type : String}
    },
    tests : {
        count : {type : Number},
        passed : {type : Number},
        detail : {type : String}
    },
    statistics : {
        location: {type: String },
        stats: [
            {
                name: { type: String },
                value: {type: String}
            }
        ]
    },
    developer : {
        type: Schema.Types.ObjectId,
        ref: 'TeamcityDeveloper'
    },
    project : {
        type: Schema.Types.ObjectId,
        ref: 'TeamcityProject'
    },
    testDetails: {
        testsRun: {type: Number},
        testsPassed: {type: Number},
        href: {type: String},
        allPassed: {type: Boolean}
    },
    canceledInfo: {
        user: {
            username: {type : String},
            name: {type : String},
            id: {type : Number},
            href: {type : String}
        },
        timestamp: {type : Date}
    },
    personal: {type : Boolean},
    server : {
        name: {type : String},
        url: {type : String}
    }
});

TeamcityBuildSchema.statics.getById = function(buildId) {
    return this.findOneAsync({id:buildId});
};

TeamcityBuildSchema.statics.mostRecentForProject = function(projectId) {
    return this
        .findOne({project:projectId})
        .sort('-startDate')
        .execAsync();
};

var regex_development_branch = /.*develop.*/i;
var regex_master_branch = /.*master/i;

var defaultBuildQuery = {
    $and: [
        {'buildType.paused': {$exists: false}},
        {
            $or: [
                {'defaultBranch': true},
                {'branchName': {$exists: false}},
                {'branchName': regex_development_branch},
                {'branchName': regex_master_branch}]
        }
    ]
};

var nonPausedBuilds = {
    $and: [
        {'buildType.paused': {$exists: false}}
    ]
};

TeamcityBuildSchema.statics.getMostRecentDefaultBuild = function (buildTypeId, excludeThisBuild) {
    excludeThisBuild = excludeThisBuild?excludeThisBuild:-1;
    return this
        .findOne()
        .and([defaultBuildQuery ,
            {
                'buildType.id' : buildTypeId
            },
            {
                id : {
                    $ne : excludeThisBuild
                }
            }])
        .populate('developer')
        .sort('-finishDate')
        .execAsync()
};

TeamcityBuildSchema.statics.getMostRecentBuild = function (buildTypeId, excludeThisBuild) {
    excludeThisBuild = excludeThisBuild?excludeThisBuild:-1;
    return this
        .findOne()
        .and([nonPausedBuilds ,
            {
                'buildType.id' : buildTypeId
            },
            {
                id : {
                    $ne : excludeThisBuild
                }
            }])
        .populate('developer')
        .sort('-finishDate')
        .execAsync()
};

TeamcityBuildSchema.statics.getMostRecentDefaultBuildsForListOfTypes = function (buildTypeIds, excludeThisBuild) {
    excludeThisBuild = excludeThisBuild?excludeThisBuild:-1;
    return this
        .findOne()
        .and([defaultBuildQuery ,
            {
                'buildType.id' : { $in : buildTypeIds}
            },
            {
                id : {
                    $ne : excludeThisBuild
                }
            }])
        .populate('developer')
        .sort('-finishDate')
        .execAsync()
};

TeamcityBuildSchema.statics.getLatestDefaultBuildGroupByBuildType = function() {
    var self = this;
    return new BBPromise(function(resolve, reject){
        var aggregation = self.aggregate([
                {$match : {
                        '$and':[
                                { 'buildType.paused': { '$ne': true } }, 
                                   {'$or': [ 
                                            { defaultBranch: true },
                                            { branchName: { '$exists': false } },
                                            { branchName: /.*[develop|master].*/i }
                                        ]
                                    }
                                ]
                            }
                },
                {$sort : { "finishDate" : -1 } },
                {$group:
                     {
                       _id: "$buildType.id",
                       mostRecentBuild: { "$first" : "$$ROOT" } 
                     }
                }
        ]); 
        aggregation.options = { allowDiskUse: true };

        aggregation.exec(function(error, result) {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
};

TeamcityBuildSchema.statics.getForDateRange = function(fromDate, toDate) {
    var query = this.find()
        .where('finishDate')
        .gt(fromDate)
        .where(defaultBuildQuery);
    if (toDate){
        query = query
            .where('finishDate')
            .lt(toDate);
    }
    return query.sort('finishDate')
        .execAsync();
};


TeamcityBuildSchema.statics.getForDeveloperOnServer = function(developer, server) {
    return this.find()
        .and([
            {
                $or: [
                    {developer: developer._id},
                    {linkedUser: developer._id}
                ]
            },
            {'server.name' : server.name},
            {'linkSlave' : false}
        ])
        .sort('finishDate')
        .execAsync();
};

var mapByBuild = function () {
    emit(this.buildType.projectId, {_id: this.developer});
};

var reduceFunction = function (valuesPropertyName, objectRef) {

    return 'function(key, values){ ' +
    '   var devs = [];' +
    '   for (var devIndex in values){' +
    '       var dev = values[devIndex];' +
    '       if (dev.' + valuesPropertyName + '){' +
    '           devs = devs.concat(dev.' + valuesPropertyName + ');' +
    '       }else{' +
    '           if (dev){' +  (objectRef ? ('devs.push(dev._id);}') : ('devs.push(dev);}')) +
    '       }' +
    '   }' +
    '   var seen = {};' +
    '   var unique = devs.filter(function(elem) {' +
    '       var k = JSON.stringify(elem);' +
    '       return (seen[k] === 1) ? 0 : seen[k] = 1;' +
    '   });' +
    '   return {' + valuesPropertyName + ': unique' + '};' +
    '}';
};


TeamcityBuildSchema.statics.generateByBuild = function () {
    var o = {
        map: mapByBuild,
        reduce: reduceFunction('developers', true),
        out: {replace: 'teamcityteams'}
    };

    return this.mapReduce(o);
};


var mapByChanges = function () {
    for (var index in this.changes) {
        emit(this.buildType.projectId, this.changes[index].username);
    }
};

TeamcityBuildSchema.statics.generateByChanges = function () {
    var o = {
        map: mapByChanges,
        reduce: reduceFunction('usernames'),
        out: {replace: 'teamcityteams'}
    };

    return this.mapReduce(o);
};

mongoose.model('TeamcityBuild', TeamcityBuildSchema);
