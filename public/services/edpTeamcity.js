'use strict';

angular.module('mean.edp-teamcity')
    .factory('EdpTeamcity', ['$resource',
        function($resource) {
            return $resource('edpTeamcity/admin/settings');
        }])
    .service('util', function($http){
        return {
            testServer : function(server){
                return $http.post('edpTeamcity/admin/serverCheck',server)
                    .then(function(response){
                        return response.data;
                    });
            },
            getProjects : function (server) {
                return $http.get('edpTeamCity/admin/' + server.name + '/projects')
                    .then(function(response){
                        return response.data;
                    });
            },
            getDevelopers : function (server) {
                return $http.get('edpTeamCity/admin/' + server.name + '/developers')
                    .then(function(response){
                        return response.data;
                    });
            }
        }
    });
