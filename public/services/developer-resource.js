'use strict';

angular.module('mean.edp-teamcity')
    .factory('Developer', ['$resource',
        function($resource) {
            return $resource('edpTeamcity/users/:id',{ id: '@_id' }, {
                    update : {method : 'PUT'}
            });
        }]);
