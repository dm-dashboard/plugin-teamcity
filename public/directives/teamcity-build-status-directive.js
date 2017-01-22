(function(){
    'use strict';

    angular.module('mean.edp-teamcity')
        .directive('teamcityBuildStatus', function(messageService, $timeout, $window){
            var link = function($scope, element, attrs){
                /*Status*/
                function resizeText(){
                    $timeout(function() {

                        var latestBuildHeight = angular.element('.finished-build').height();
                        if (!latestBuildHeight){
                            setTimeout(resizeText,100);
                            return;
                        }
                        var projectName = latestBuildHeight * 0.5;
                        var buildName = latestBuildHeight * 0.3;

                        $scope.projectFontSize = projectName;
                        $scope.smallerTextFontSize = buildName;

                    },100);
                }


                messageService.registerPlugin('teamcity-status', function(data){
                    if (!$scope.builds) {
                        $scope.builds = data;
                    }
                    else{
                        updateArray($scope.builds.freshBuilds, data.freshBuilds, 'unshift');
                    }
                    $timeout(resizeText,1000);
                });

                $scope.$watch('builds', function(newValue, oldValue){
                    if ($scope.builds && !oldValue){
                        messageService.ready('teamcity-status');
                        resizeText();
                    }
                });
                /********************************/
                /*Realtime*/

                var minHeight = 50;
                var calculateMetrics = function () {
                    $timeout(function() {
                        var calculatedHeight = Math.floor(element.parent().parent().height() * 0.1);
                        if (!calculatedHeight){
                            setTimeout(calculateMetrics,100);
                            return;
                        }
                        $scope.rt_buildHeight = calculatedHeight < minHeight ? minHeight : calculatedHeight;

                        $scope.rt_projectFontSize = calculatedHeight * 0.45;
                        $scope.rt_smallerTextFontSize = calculatedHeight * 0.23;
                        $scope.rt_serverFontSize = $scope.rt_projectFontSize * 0.5;

                    },100);
                };

                $scope.showQueues = false;

                function updateArray(currentArray, newArray, addMethod) {
                    //Update items already there
                    angular.forEach(newArray, function (newItem) {
                        var existingItem = currentArray.filter(function (item) {
                            return newItem.id === item.id;
                        })[0];
                        if (existingItem) {
                            angular.copy(newItem,existingItem);
                        }
                    });

                    var removedItems = currentArray.filter(function(item){
                       return newArray.filter(function(item2){
                           return item2.id === item.id;
                       }).length == 0;
                    });

                    var index = 0;
                    var addedItems = newArray.filter(function(item){
                        var itemAdded = currentArray.filter(function(item2){
                                return item2.id === item.id;
                            }).length == 0;
                        if (itemAdded){
                            item.insertIndex = index;
                        }
                        index++;
                        return itemAdded;
                    });

                    angular.forEach(removedItems, function(toRemove){
                        var pos = currentArray.map(function(e) { return e.id; }).indexOf(toRemove.id);
                        currentArray.splice(pos,1);
                    });

                    angular.forEach(addedItems, function(newItem){
                       currentArray.splice(newItem.insertIndex,0,newItem);
                    });
                }

                messageService.registerPlugin('teamcity-realtime', function (data) {
                    if (!$scope.realtimeStatus) {
                        $scope.realtimeStatus = data;
                    } else {
                        angular.forEach($scope.realtimeStatus.running, function (running) {
                            updateArray(running.builds, data.running[running.server].builds, 'push');
                        });
                        angular.forEach($scope.realtimeStatus.queue, function (queue) {
                            updateArray(queue.builds, data.queue[queue.server].builds, 'push');
                        });
                    }
                });

                $scope.$watch('realtimeStatus', function (newValue, oldValue) {
                    if ($scope.realtimeStatus) {
                        if (!oldValue) {
                            calculateMetrics();
                            messageService.ready('teamcity-realtime');
                        }
                        var somethingToShow = false;
                        angular.forEach($scope.realtimeStatus.running, function(running){
                           if (running.builds && running.builds.length > 0){
                               somethingToShow = true;
                           }
                        });
                        angular.forEach($scope.realtimeStatus.queue, function(queue){
                            if (queue.builds && queue.builds.length > 0){
                                somethingToShow = true;
                            }
                        });
                        $scope.showQueues = somethingToShow && ($scope.builds && $scope.builds.freshBuilds && $scope.builds.freshBuilds.length > 0);
                    }
                },true);
                /********************************/

                $scope.timeAgo = function(dateString){
                    return window.moment(new Date(dateString)).fromNow();
                };

                angular.element($window).bind('resize', function(){
                    resizeText();
                    calculateMetrics();
                });
            };

            return {
                restrict : 'A',
                link : link,
                templateUrl : '/edp-teamcity/views/teamcity-build-status.html'
            };
        });
})();
