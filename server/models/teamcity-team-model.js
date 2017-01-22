'use strict';
var BBPromise = require('bluebird');

var mongoose = BBPromise.promisifyAll(require('mongoose')),
    Schema = mongoose.Schema;

var TeamcityTeamSchema = new Schema({
    _id : {type : String},
    value : {
        developers : [{
            type: Schema.Types.ObjectId,
            ref: 'TeamcityDeveloper'
        }],
        usernames : [
            {type : String}
        ]
    }
});

TeamcityTeamSchema.statics.list = function(){
    return this.find().populate('value.developers').execAsync();
};

mongoose.model('TeamcityTeam', TeamcityTeamSchema);
