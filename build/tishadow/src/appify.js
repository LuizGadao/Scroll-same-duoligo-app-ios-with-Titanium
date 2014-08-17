Titanium.App.idleTimerDisabled = true;

var TiShadow = __p.require("/api/TiShadow");

TiShadow.Appify = "{{app_name}}";

var Compression = __p.require("ti.compression");

__p.require("/lib/ti-mocha");

if (Ti.App.Properties.getString("tishadow::container_version", 0) !== "{{date}}") {
    TiShadow.clearCache(true);
    Ti.App.Properties.setString("tishadow::container_version", "{{date}}");
}

var path_name = "{{app_name}}".replace(/ /g, "_");

var target = Ti.Filesystem.getFile(__p.file(Ti.Filesystem.applicationDataDirectory + path_name));

if (!target.exists()) {
    target.createDirectory();
    Compression.unzip(Ti.Filesystem.applicationDataDirectory + "/" + path_name, Ti.Filesystem.applicationDataDirectory + require("/api/TiShadow").currentApp + "/" + "/" + path_name + ".zip", true);
}

TiShadow.connect({
    proto: "{{proto}}",
    host: "{{host}}",
    port: "{{port}}",
    room: "{{room}}",
    name: Ti.Platform.osname + ", " + Ti.Platform.version + ", " + Ti.Platform.address
});

var Logger = __p.require("yy.logcatcher");

Logger.addEventListener("error", function(e) {
    var Log = __p.require("/api/Log");
    delete e.source;
    delete e.type;
    delete e.bubbles;
    delete e.cancelBubble;
    Log.error(JSON.stringify(e, null, "  "));
});

TiShadow.launchApp(path_name);