'use strict';

angular.module('mean.edp-teamcity').controller('EdpTeamcityController', ['$scope', 'Global', 'EdpTeamcity',
    function($scope, Global, EdpTeamcity) {
        $scope.global = Global;
        $scope.package = {
            name: 'edp-teamcity'
        };
    }
]);
