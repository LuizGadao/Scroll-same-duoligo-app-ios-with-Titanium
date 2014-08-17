var log = __p.require("/api/Log");

var TiShadow = __p.require("/api/TiShadow");

var TiDynamicFont = __p.require("yy.tidynamicfont");

function loadAll(root) {
    var dir = Ti.Filesystem.getFile(__p.file(root));
    var files = dir.getDirectoryListing();
    if (!files) {
        return;
    }
    files.forEach(function(file_name) {
        if (file_name.toLowerCase().match(/\.otf$/) || file_name.toLowerCase().match(/\.ttf$/)) {
            log.debug("Registering Font: " + file_name);
            var file = Ti.Filesystem.getFile(__p.file(root + file_name));
            TiDynamicFont.registerFont(file);
        }
    });
}

exports.loadCustomFonts = function(name) {
    loadAll(Ti.Filesystem.applicationDataDirectory + name + "/fonts/");
    loadAll(Ti.Filesystem.applicationDataDirectory + name + "/iphone/fonts/");
};