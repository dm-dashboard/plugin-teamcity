'use strict';

var components = [];

var blacklist = [
    'teamcity-build-status',
    'teamcity-health',
    'teamcity-realtime',
    'teamcity-stats-fetcher'
];

var refresh = function () {
    for (var index in components){
        components[index].refresh();
    }
};

var init = function(core, io, settings, assignedLogger, scheduler,watchdog){
    assignedLogger.info('Teamcity package loaded, loading plugins');
    components = core.util.submoduleLoader(__dirname,'teamcity-*.js',function(moduleName, module, watchdogKicker){
        module.init(core, io,settings,assignedLogger.fork(moduleName.replace('teamcity-','')),scheduler, watchdogKicker);
    },assignedLogger, blacklist, watchdog, 'edp-teamcity');
};

module.exports = {
    init : init,
    refresh : refresh
};