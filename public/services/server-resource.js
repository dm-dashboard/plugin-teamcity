'use strict';

angular.module('mean.edp-teamcity')
    .factory('Server', ['$resource',
        function($resource) {
            return $resource('edpTeamcity/servers/:id');
        }]);
