'use strict';

/*
 * Defining the Package
 */
var Module = require('meanio').Module;

var EdpTeamcity = new Module('edp-teamcity');

/*
 * All MEAN packages require registration
 * Dependency injection is used to define required modules
 */
EdpTeamcity.register(function(app, auth, database, dashcore) {

    //We enable routing. By default the Package Object is passed to the routes
    EdpTeamcity.routes(app, auth, database);

    //We are adding a link to the main menu for all authenticated users
    EdpTeamcity.menus.add({
        title: 'TeamCity',
        link: 'edpTeamcity admin',
        roles: ['admin'],
        menu: 'plugins'
    });

    EdpTeamcity.aggregateAsset('css', 'edpTeamcity.css');


    return EdpTeamcity;
});
