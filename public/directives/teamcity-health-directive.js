(function () {
    'use strict';

    angular.module('mean.edp-teamcity')
        .directive('teamcityHealth', function (messageService, $timeout, $window) {
            var link = function ($scope, element, attrs) {

                var calculateMetrics = function () {
                    $timeout(function() {
                        var calculatedWidth = Math.floor(element.width());
                        if (!calculatedWidth){
                            setTimeout(calculateMetrics,100);
                            return;
                        }
                        $scope.health_value = calculatedWidth * 0.08;
                    },100);
                };

                $scope.showPie = false;

                messageService.registerPlugin('teamcity-health', function (data) {
                    $scope.health = data;
                });


                $scope.$watch('health', function(newValue, oldValue){
                   if ($scope.health && !oldValue){
                       messageService.ready('teamcity-health');
                       $timeout(function () {
                           $scope.showPie = true;
                           calculateMetrics();
                       }, 2000);
                   }
                });



                $scope.chartOptions = {
                    seriesDefaults: {
                        renderer: jQuery.jqplot.PieRenderer,
                        rendererOptions: {
                            showDataLabels: true,
                            padding : 0
                        }
                    },
                    grid : {
                        background : 'transparent',
                        borderWidth : 0,
                        shadow : false
                    },
                    seriesColors : [
                        '#4E824E','#C05151','#D67733'
                    ],
                    legend: { show: false, location: 's' }
                };

            };

            return {
                restrict: 'A',
                link: link,
                templateUrl: '/edp-teamcity/views/teamcity-health.html'
            };
        });
})();
