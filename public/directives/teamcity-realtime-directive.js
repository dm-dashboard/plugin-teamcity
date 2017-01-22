(function () {
    'use strict';

    angular.module('mean.edp-teamcity')
        .directive('teamcityRealtime', function (messageService, $timeout, $window) {
            var link = function ($scope, element, attrs) {

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

                    },100);
                };

                messageService.registerPlugin('teamcity-realtime', function (data) {
                    $scope.realtimeStatus = data;
                });
                $scope.$watch('realtimeStatus', function (newValue, oldValue) {
                    if ($scope.realtimeStatus) {
                        if (!oldValue) {
                            calculateMetrics();
                            messageService.ready('teamcity-realtime');
                        }
                    }
                });

                $scope.timeAgo = function (dateString) {
                    return window.moment(new Date(dateString)).fromNow();
                };

                angular.element($window).bind('resize', function () {
                    calculateMetrics();
                });
            };

            return {
                restrict: 'A',
                link: link,
                templateUrl: '/edp-teamcity/views/teamcity-realtime.html'
            };
        });
})();
