'use strict';

angular.module('mean.edp-teamcity')
    .factory('OrphanDeveloper', ['$resource',
        function($resource) {
            return $resource('edpTeamcity/users/orphan');
        }]);
