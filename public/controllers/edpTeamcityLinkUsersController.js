'use strict';

angular.module('mean.edp-teamcity').controller('EdpTeamcityLinkUsersController',
    ['$scope', 'Global', 'Server', 'Developer', 'OrphanDeveloper', '$q','$filter',
        function ($scope, Global, Server, Developer, OrphanDeveloper, $q, $filter) {
            $scope.global = Global;
            $scope.package = {
                name: 'edp-teamcity'
            };

            Server.query().$promise.then(function (result) {
                $scope.servers = result;
                $scope.selectedServer = $scope.servers[0];
            });

            $scope.orphanUsers = function (query, current) {
                var d = $q.defer();
                var results = [];
                angular.forEach($scope.orphans, function (orphan) {
                    if (orphan.id === current.id || orphan.hidden) {
                        return;
                    }
                    if (orphan.username.indexOf(query) >= 0) {
                        results.push(orphan);
                    }
                });
                d.resolve(results);
                return d.promise;
            };

            $scope.tagAdded = function(tag, current){
                var itemInOrphans = $filter('filter')($scope.orphans, {id : tag.id})[0];
                itemInOrphans.hidden = true;
                current.dirty = true;
            };

            $scope.tagRemoved = function(tag, current){
                var itemInOrphans = $filter('filter')($scope.orphans, {id : tag.id})[0];
                if (itemInOrphans) {
                    itemInOrphans.hidden = false;
                }else{
                    $scope.orphans.push(tag);
                }
                current.dirty = true;
            };

            $scope.$watch('selectedServer', function () {
                Developer.query({
                    serverName: $scope.selectedServer
                }).$promise.then(function (result) {
                        $scope.users = result;
                    })
                    .then(function () {
                        return OrphanDeveloper.query({
                            serverName: $scope.selectedServer
                        }).$promise;
                    })
                    .then(function (orphans) {
                        $scope.orphans = orphans;
                    });
            });

            $scope.save = function (user) {
                var saveAll = [];
                angular.forEach($filter('filter')($scope.users, {dirty:true}), function(dirtyUser){
                    var orphanIds = dirtyUser.linkedUsers.map(function(link){
                        return link._id;
                    });
                    dirtyUser.linkedUsers = orphanIds;

                    saveAll.push(dirtyUser.$update().$promise);
                });
                $q.all(saveAll)
                    .then(function(){
                       console.log('All Saved');
                    });
                console.log('save');
            };

            $scope.timeAgo = function (dateString) {
                return window.moment(new Date(dateString)).fromNow();
            };

        }
    ]);
