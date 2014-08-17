var p = __p.require("/api/PlatformRequire");

var log = __p.require("/api/Log");

var TiShadowReporter = __p.require("/api/TiShadowReporter");

var JUnitXMLReporter = __p.require("/api/JUnitXMLReporter");

function loadSpecs(name, base, filter) {
    var dir = Ti.Filesystem.getFile(__p.file(Ti.Filesystem.applicationDataDirectory + name + "/spec/" + base));
    var files = dir.getDirectoryListing();
    if (!files) {
        return;
    }
    files.forEach(function(file) {
        if (file.match(/_spec.js$/)) {
            p.require("/spec/" + base + "/" + file.replace(".js", ""));
        } else if (filter === {} || filter[file]) {
            loadSpecs(name, base + "/" + file, filter);
        }
    });
}

exports.run = function(name, junitxml, type, clearSpecFiles, runCoverage) {
    var jasmine;
    if (clearSpecFiles) {
        p.clearCacheWithRegEx(/_spec\.js/);
    } else {
        p.clearCache();
    }
    var onComplete = function() {
        if (runCoverage) {
            var coverage = __p.require("/lib/coverage").getCoverage();
            if (coverage) {
                log.cover(coverage);
            }
        }
    };
    type = type || "jasmine";
    if (type === "jasmine") {
        jasmine = __p.require("/lib/jasmine").jasmine;
        jasmine.currentEnv_ = new jasmine.Env();
        if (junitxml) {
            jasmine.getEnv().addReporter(new JUnitXMLReporter(true, true, onComplete));
        } else {
            jasmine.getEnv().addReporter(new TiShadowReporter(onComplete));
        }
    } else if (type === "jasmine2") {
        jasmine = function() {
            this.should = __p.require("/lib/should");
            var jasmineRequire = __p.require("/lib/jasmine-2.0.0/jasmine");
            var jasmineBoot = __p.require("/lib/jasmine-2.0.0/node_boot");
            return jasmineBoot(jasmineRequire, this);
        }();
        var TiShadowReporter2 = __p.require("/api/TiShadowReporter2");
        jasmine.getEnv().addReporter(new TiShadowReporter2({
            log: log.test,
            showColors: true,
            timer: new jasmine.Timer(),
            onComplete: function() {
                onComplete();
                log.test("Runner Finished");
            }
        }));
    }
    var filter_file = Ti.Filesystem.getFile(__p.file(Ti.Filesystem.applicationDataDirectory + name + "/spec/specs"));
    var filter = {};
    if (filter_file.exists()) {
        filter_file.read().text.split("\n").forEach(function(dir) {
            filter[dir.trim()] = 1;
        });
    }
    __p.require("/api/Localisation").clear();
    loadSpecs(name, "", filter);
    if (type === "jasmine" || type === "jasmine2") {
        jasmine.getEnv().execute();
    } else {
        mocha.run(function() {
            onComplete();
            log.test("Runner Finished");
        });
    }
};