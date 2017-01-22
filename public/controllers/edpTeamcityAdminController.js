'use strict';

angular.module('mean.edp-teamcity').controller('EdpTeamcityAdminController', ['$scope', 'Global', 'EdpTeamcity','util','$modal',
    function($scope, Global, EdpTeamcity,util, $modal) {
        $scope.global = Global;
        $scope.package = {
            name: 'edp-teamcity'
        };

        $scope.save = function(){
            $scope.saving = true;
            $scope.settings.$save(function(){
                $scope.saving = false;
            });
            return $scope.settings.$promise;
        };

        $scope.finishedLoading = false;
        $scope.saving = false;
        $scope.settings = EdpTeamcity.get(function(){
            $scope.finishedLoading = true;
        });

        $scope.addServer = function(){
            $scope.settings.servers.push({
                url : 'http://',
                username : '',
                password : '',
                name : '',
                active : true
            })
        };

        $scope.removeServer = function(server){
          var index = $scope.settings.servers.indexOf(server);
            $scope.settings.servers.splice(index,1);
        };

        var testResults = {};
        $scope.testServer = function(server){
            util.testServer(server)
                .then(function(response){
                    testResults[server.name] = response;
                });
        };

        $scope.testResults = function(server){
            var results =testResults[server.name];
            if(results){
                return results.connected?'Success. v' + results.version : 'Failed: ' + (results.error.code?results.error.code:results.error);
            }
            return '';
        };


        $scope.viewServer = function(server){
            $scope.save()
                .then(function(){
                    util.getDevelopers(server)
                        .then(function(developers) {
                            var results = {developers : developers};
                            util.getProjects(server)
                                .then(function (projects) {
                                    results.projects = projects;
                                    results.name = server.name;
                                    var modal = $modal.open({

                                        templateUrl: 'serverDetails.html',
                                        size: 'lg',
                                        controller: 'modalController',
                                        resolve: {
                                            server: function () {
                                                return results;
                                            }
                                        }
                                    });
                                    modal.result.then(function (selected) {

                                    })
                                });
                        });
                });
        };


    }
]);
angular.module('mean.edp-teamcity').controller('modalController', function ($scope, $modalInstance, server) {

    $scope.server = server;

    $scope.ok = function () {
        $modalInstance.close();
    };

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
});