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
  //new StartScreen().open();
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
	backgroundColor:"#fff",
	width:Ti.UI.FILL,
	height:Ti.UI.FILL,
	fullscreen:true
});

var img = Ti.UI.createImageView({
	image:"/imgs/duolingo.png",
	top:-300,
	width:213,
	height:300	
});

win.add(img);

var scroll = Ti.UI.createScrollView({
	top:0,
	width:Ti.UI.FILL,
	height:Ti.UI.FILL,
	contentHeight:"auto"
});

for( var i = 0; i < 20; i++ )
{
	scroll.add( 
		Ti.UI.createView({
			width:Ti.UI.FILL,
			height:50,
			top:i * 60,
			bottom:10,
			opacity:0.3,
			backgroundColor:"#0f0"
		}) 
	);
}

scroll.addEventListener( "scroll", function(e){
	//Ti.API.info('y: ' + e.y  );
	Ti.API.info('y: ' + e.y  );
	var y = -300 + (e.y * -1);
	Ti.API.info('yy: ' + img.ge );
	img.applyProperties({ top:y });
	
} );

win.add(scroll);

win.open();

