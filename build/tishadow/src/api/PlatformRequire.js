var log = __p.require("/api/Log"), utils = __p.require("/api/Utils"), densityFile = __p.require("/api/DensityAssets"), os = Ti.Platform.osname, _ = __p.require("/lib/underscore"), global_context = this, global_keys, cache = {}, spys = {};

function custom_require(file) {
    try {
        log.info("Requiring: " + file);
        var rfile = Ti.Filesystem.getFile(__p.file(file));
        var contents = rfile.read().text;
        return eval("(function(exports){var __OXP=exports;var module={'exports':exports};" + contents + ";if(module.exports !== __OXP){return module.exports;}return exports;})({})");
    } catch (e) {
        e.file = __p.file(file);
        log.error(utils.extractExceptionData(e));
    }
}

exports.require = function(extension) {
    try {
        var path = exports.file(extension + ".js");
        if (!Ti.Filesystem.getFile(__p.file(path)).exists()) {
            log.debug("Native module:" + extension);
            return __p.require(extension);
        }
        if (cache[path]) {
            return cache[path];
        }
        var mod = custom_require(path);
        cache[path] = mod;
        return mod;
    } catch (e) {
        log.error(utils.extractExceptionData(e));
    }
};

exports.include = function(context, file) {
    try {
        var path = exports.file(file);
        var ifile = Ti.Filesystem.getFile(__p.file(path));
        var contents = ifile.read().text;
        eval.call(context || global_context, contents);
    } catch (e) {
        log.error(utils.extractExceptionData(e));
    }
};

exports.fileContent = function(context) {
    var contents = "";
    for (var i = 0, length = arguments.length; i < length; i++) {
        var path = exports.file(arguments[i]);
        var ifile = Ti.Filesystem.getFile(__p.file(path));
        contents += ifile.read().text + "\n";
    }
    return contents;
};

exports.file = function(extension) {
    if (_.isArray(extension)) {
        return extension.map(exports.file);
    } else if (typeof extension !== "string") {
        return extension;
    }
    extension = extension.replace(/^\//, "");
    var base = Ti.Filesystem.applicationDataDirectory + __p.require("/api/TiShadow").currentApp + "/";
    if (extension.indexOf(base) !== -1) {
        extension = extension.replace(base, "");
    }
    var path = base + extension, platform_path = base + (os === "android" ? "android" : "iphone") + "/" + extension;
    var isImage = extension.toLowerCase().match("\\.(png|jpg)$");
    if (!isImage) {
        var file = Ti.Filesystem.getFile(__p.file(platform_path));
        if (file.exists()) {
            return platform_path;
        }
    } else {
        var platform_dense = densityFile.find(platform_path);
        if (null !== platform_dense) {
            return platform_dense;
        }
    }
    if (Ti.Filesystem.getFile(__p.file(path)).exists()) {
        return path;
    }
    return extension;
};

exports.clearCache = function(list) {
    if (_.isArray(list)) {
        list.forEach(function(file) {
            if (file.match(".js$")) {
                cache[exports.file(file.replace(/.js$/, ""))] = null;
                cache[exports.file("/" + file.replace(/.js$/, ""))] = null;
            }
        });
    } else {
        cache = {};
    }
    for (var a in global_context) {
        if (global_context.hasOwnProperty(a) && !_.contains(global_keys, a)) {
            delete global_context[a];
        }
    }
};

exports.clearCacheWithRegEx = function(regex) {
    for (var key in cache) {
        if (cache.hasOwnProperty(key) && key.match(regex)) {
            log.debug("Clearing: " + key + " from the require cache");
            delete cache[key];
        }
    }
    for (var a in global_context) {
        if (global_context.hasOwnProperty(a) && !_.contains(global_keys, a) && a.match(regex)) {
            log.debug("Clearing: " + a + " from global context");
            delete global_context[a];
        }
    }
};

exports.eval = function(message) {
    try {
        __log.repl(eval.call(global_context, message.code));
    } catch (e) {
        __log.error(__p.require("/api/Utils").extractExceptionData(e));
    }
};

exports.addSpy = function(name, spy) {
    spys[name] = spy;
};

(function(context) {
    context.__log = __p.require("/api/Log");
    context.__p = exports;
    context.__ui = __p.require("/api/UI");
    context.__app = __p.require("/api/App");
    context.L = __p.require("/api/Localisation").fetchString;
    context.assert = __p.require("/api/Assert");
    context.closeApp = __p.require("/api/TiShadow").closeApp;
    context.launchApp = __p.require("/api/TiShadow").nextApp;
    context.clearCache = __p.require("/api/TiShadow").clearCache;
    context.runSpec = function() {
        var path_name = __p.require("/api/TiShadow").currentApp.replace(/ /g, "_");
        __p.require("/api/Spec").run(path_name, false);
    };
    context.addSpy = exports.addSpy;
    context.getSpy = function(name) {
        return spys[name];
    };
    context.Ti.Shadow = true;
})(global_context);

Ti.Shadow = true;

global_keys = _.keys(global_context);