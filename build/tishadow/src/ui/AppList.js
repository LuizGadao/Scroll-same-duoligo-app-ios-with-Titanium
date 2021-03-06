var log = __p.require("/api/Log");

var width = "80dp";

var icon_width = "60dp";

function createIcon(o, idx) {
    var view = Ti.UI.createView({
        width: width,
        height: "110dp",
        app: o.app
    });
    view.add(Ti.UI.createView({
        touchEnabled: false,
        backgroundImage: __p.file(o.image),
        borderRadius: 10,
        top: "10dp",
        width: icon_width,
        height: icon_width
    }));
    view.add(Ti.UI.createLabel({
        top: "70dp",
        font: {
            fontSize: "10dp",
            fontWeight: "bold"
        },
        height: 20 + "dp",
        textAlign: "center",
        color: "black",
        text: o.title,
        touchEnabled: false
    }));
    return view;
}

function AppList() {
    var view = Ti.UI.createScrollView({
        top: "50dp",
        bottom: "20dp",
        left: 0,
        right: 0,
        contentHeight: "auto"
    });
    var container = Ti.UI.createView({
        top: 0,
        height: Ti.UI.SIZE,
        layout: "horizontal"
    });
    view.add(container);
    function refreshList() {
        if (container.children != null && container.children.length > 0) {
            container.children.forEach(function(child) {
                container.remove(child);
            });
        }
        var data = [];
        var count = 0;
        var files = Ti.Filesystem.getFile(__p.file(Ti.Filesystem.applicationDataDirectory)).getDirectoryListing();
        files.forEach(function(file_name) {
            if (file_name.indexOf(".") === -1) {
                var app_js = Ti.Filesystem.getFile(__p.file(Ti.Filesystem.applicationDataDirectory + (file_name + "/") + "app.js"));
                if (app_js.exists()) {
                    var icon_path = Ti.Filesystem.applicationDataDirectory + file_name + "/iphone/appicon.png";
                    var icon = Ti.Filesystem.getFile(__p.file(icon_path));
                    if (!icon.exists()) {
                        icon_path = Ti.Filesystem.applicationDataDirectory + file_name + "/android/appicon.png";
                    }
                    container.add(createIcon({
                        title: file_name.replace(/_/g, " "),
                        image: __p.file(icon_path),
                        color: "black",
                        app: file_name
                    }, count++));
                }
            }
        });
    }
    refreshList();
    view.addEventListener("click", function(e) {
        if (e.source.app !== undefined) {
            view.fireEvent("launch", {
                app: e.source.app
            });
        }
    });
    view.refreshList = refreshList;
    return view;
}

module.exports = AppList;