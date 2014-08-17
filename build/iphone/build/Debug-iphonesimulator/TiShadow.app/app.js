/*
 * Copyright (c) 2011-2014 YY Digital Pty Ltd. All Rights Reserved.
 * Please see the LICENSE file included with this distribution for details.
 */


var current_app = Ti.App.Properties.getString("tishadow::currentApp","");
if (current_app !== "") { 
  var TiShadow = require('/api/TiShadow');
  TiShadow.connect({
    host: Ti.App.Properties.getString("tishadow:address", "localhost"),
    port: Ti.App.Properties.getString("tishadow:port", "3000"),
    room: Ti.App.Properties.getString("tishadow:room", "default").trim() || "default",
    name: Ti.Platform.osname + ", " + Ti.Platform.version + ", " + Ti.Platform.address
  });
  TiShadow.launchApp(current_app);
} else {
  var StartScreen = require("/ui/StartScreen").StartScreen;
  new StartScreen().open();
}

var Logger = require("yy.logcatcher");
Logger.addEventListener("error", function(e) {
  var Log = require("/api/Log");
  delete e.source;
  delete e.type;
  delete e.bubbles;
  delete e.cancelBubble;
  Log.error(JSON.stringify(e, null, "  "));
});

require("/lib/ti-mocha");


var win = Ti.UI.createWindow({
	backgroundColor:"#00f",
	width:Ti.UI.FILL,
	height:Ti.UI.FILL
});

var scroll = Ti.UI.createScrollView({
	backgroundColor:"#ccc",
	width:Ti.UI.FILL,
	height:Ti.UI.FILL,
	contentHeight:auto
});

/*for( var i = 0; i < 20; i++ )
{
	scroll.add( 
		Ti.UI.createView({
			width:Ti.UI.FILL,
			height:50,
			bottom:10,
			backgroundColor:"#000"
		}) 
	);
}*/

//win.add(scroll);

win.open();

