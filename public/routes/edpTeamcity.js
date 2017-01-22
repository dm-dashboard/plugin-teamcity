'use strict';

angular.module('mean.edp-teamcity').config(['$stateProvider',
    function($stateProvider) {
        $stateProvider.state('edpTeamcity admin', {
            url: '/edpTeamcity/admin',
            templateUrl: 'edp-teamcity/views/admin.html'
        });

        $stateProvider.state('edpTeamcity linkusers', {
            url: '/edpTeamcity/users/link',
            templateUrl: 'edp-teamcity/views/linkUsers.html'
        });
    }
]);
