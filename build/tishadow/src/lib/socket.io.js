var io = {};

module.exports = io;

(function() {
    (function(exports, global) {
        var io = exports;
        io.version = "0.9.11";
        io.protocol = 1;
        io.transports = [];
        io.j = [];
        io.sockets = {};
        io.connect = function(host, details) {
            var uri = io.util.parseUri(host), uuri, socket;
            uuri = io.util.uniqueUri(uri);
            var options = {
                host: uri.host,
                secure: "https" == uri.protocol,
                port: uri.port || ("https" == uri.protocol ? 443 : 80),
                query: uri.query || ""
            };
            io.util.merge(options, details);
            if (options["force new connection"] || !io.sockets[uuri]) {
                socket = new io.Socket(options);
            }
            if (!options["force new connection"] && socket) {
                io.sockets[uuri] = socket;
            }
            socket = socket || io.sockets[uuri];
            return socket.of(uri.path.length > 1 ? uri.path : "");
        };
    })(io, this);
    (function(exports, global) {
        var util = exports.util = {};
        var re = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
        var parts = [ "source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor" ];
        util.parseUri = function(str) {
            var m = re.exec(str || ""), uri = {}, i = 14;
            while (i--) {
                uri[parts[i]] = m[i] || "";
            }
            return uri;
        };
        util.uniqueUri = function(uri) {
            var protocol = uri.protocol, host = uri.host, port = uri.port;
            host = host || "localhost";
            if (!port && protocol == "https") {
                port = 443;
            }
            return (protocol || "http") + "://" + host + ":" + (port || 80);
        };
        util.query = function(base, addition) {
            var query = util.chunkQuery(base || ""), components = [];
            util.merge(query, util.chunkQuery(addition || ""));
            for (var part in query) {
                if (query.hasOwnProperty(part)) {
                    components.push(part + "=" + query[part]);
                }
            }
            return components.length ? "?" + components.join("&") : "";
        };
        util.chunkQuery = function(qs) {
            var query = {}, params = qs.split("&"), i = 0, l = params.length, kv;
            for (;i < l; ++i) {
                kv = params[i].split("=");
                if (kv[0]) {
                    query[kv[0]] = kv[1];
                }
            }
            return query;
        };
        util.load = function(fn) {
            fn();
        };
        util.on = function(element, event, fn, capture) {
            if (element.attachEvent) {
                element.attachEvent("on" + event, fn);
            } else if (element.addEventListener) {
                element.addEventListener(event, fn, capture);
            }
        };
        util.request = function(xdomain) {
            var request = Ti.Network.createHTTPClient();
            return request;
        };
        util.defer = function(fn) {
            fn();
        };
        util.merge = function merge(target, additional, deep, lastseen) {
            var seen = lastseen || [], depth = typeof deep == "undefined" ? 2 : deep, prop;
            for (prop in additional) {
                if (additional.hasOwnProperty(prop) && util.indexOf(seen, prop) < 0) {
                    if (typeof target[prop] !== "object" || !depth) {
                        target[prop] = additional[prop];
                        seen.push(additional[prop]);
                    } else {
                        util.merge(target[prop], additional[prop], depth - 1, seen);
                    }
                }
            }
            return target;
        };
        util.mixin = function(ctor, ctor2) {
            util.merge(ctor.prototype, ctor2.prototype);
        };
        util.inherit = function(ctor, ctor2) {
            function f() {}
            f.prototype = ctor2.prototype;
            ctor.prototype = new f();
        };
        util.isArray = Array.isArray || function(obj) {
            return Object.prototype.toString.call(obj) === "[object Array]";
        };
        util.intersect = function(arr, arr2) {
            var ret = [], longest = arr.length > arr2.length ? arr : arr2, shortest = arr.length > arr2.length ? arr2 : arr;
            for (var i = 0, l = shortest.length; i < l; i++) {
                if (~util.indexOf(longest, shortest[i])) ret.push(shortest[i]);
            }
            return ret;
        };
        util.indexOf = function(arr, o, i) {
            for (var j = arr.length, i = i < 0 ? i + j < 0 ? 0 : i + j : i || 0; i < j && arr[i] !== o; i++) {}
            return j <= i ? -1 : i;
        };
        util.toArray = function(enu) {
            var arr = [];
            for (var i = 0, l = enu.length; i < l; i++) arr.push(enu[i]);
            return arr;
        };
        util.ua = {};
        util.ua.hasCORS = true;
        util.ua.webkit = false;
        util.ua.iDevice = false;
    })("undefined" != typeof io ? io : module.exports, this);
    (function(exports, io) {
        exports.EventEmitter = EventEmitter;
        function EventEmitter() {}
        EventEmitter.prototype.on = function(name, fn) {
            if (!this.$events) {
                this.$events = {};
            }
            if (!this.$events[name]) {
                this.$events[name] = fn;
            } else if (io.util.isArray(this.$events[name])) {
                this.$events[name].push(fn);
            } else {
                this.$events[name] = [ this.$events[name], fn ];
            }
            return this;
        };
        EventEmitter.prototype.addListener = EventEmitter.prototype.on;
        EventEmitter.prototype.once = function(name, fn) {
            var self = this;
            function on() {
                self.removeListener(name, on);
                fn.apply(this, arguments);
            }
            on.listener = fn;
            this.on(name, on);
            return this;
        };
        EventEmitter.prototype.removeListener = function(name, fn) {
            if (this.$events && this.$events[name]) {
                var list = this.$events[name];
                if (io.util.isArray(list)) {
                    var pos = -1;
                    for (var i = 0, l = list.length; i < l; i++) {
                        if (list[i] === fn || list[i].listener && list[i].listener === fn) {
                            pos = i;
                            break;
                        }
                    }
                    if (pos < 0) {
                        return this;
                    }
                    list.splice(pos, 1);
                    if (!list.length) {
                        delete this.$events[name];
                    }
                } else if (list === fn || list.listener && list.listener === fn) {
                    delete this.$events[name];
                }
            }
            return this;
        };
        EventEmitter.prototype.removeAllListeners = function(name) {
            if (name === undefined) {
                this.$events = {};
                return this;
            }
            if (this.$events && this.$events[name]) {
                this.$events[name] = null;
            }
            return this;
        };
        EventEmitter.prototype.listeners = function(name) {
            if (!this.$events) {
                this.$events = {};
            }
            if (!this.$events[name]) {
                this.$events[name] = [];
            }
            if (!io.util.isArray(this.$events[name])) {
                this.$events[name] = [ this.$events[name] ];
            }
            return this.$events[name];
        };
        EventEmitter.prototype.emit = function(name) {
            if (!this.$events) {
                return false;
            }
            var handler = this.$events[name];
            if (!handler) {
                return false;
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if ("function" == typeof handler) {
                handler.apply(this, args);
            } else if (io.util.isArray(handler)) {
                var listeners = handler.slice();
                for (var i = 0, l = listeners.length; i < l; i++) {
                    listeners[i].apply(this, args);
                }
            } else {
                return false;
            }
            return true;
        };
    })("undefined" != typeof io ? io : module.exports, "undefined" != typeof io ? io : module.parent.exports);
    (function(exports, nativeJSON) {
        "use strict";
        return exports.JSON = {
            parse: nativeJSON.parse,
            stringify: nativeJSON.stringify
        };
    })("undefined" != typeof io ? io : module.exports, typeof JSON !== "undefined" ? JSON : undefined);
    (function(exports, io) {
        var parser = exports.parser = {};
        var packets = parser.packets = [ "disconnect", "connect", "heartbeat", "message", "json", "event", "ack", "error", "noop" ];
        var reasons = parser.reasons = [ "transport not supported", "client not handshaken", "unauthorized" ];
        var advice = parser.advice = [ "reconnect" ];
        var JSON = io.JSON, indexOf = io.util.indexOf;
        parser.encodePacket = function(packet) {
            var type = indexOf(packets, packet.type), id = packet.id || "", endpoint = packet.endpoint || "", ack = packet.ack, data = null;
            switch (packet.type) {
              case "error":
                var reason = packet.reason ? indexOf(reasons, packet.reason) : "", adv = packet.advice ? indexOf(advice, packet.advice) : "";
                if (reason !== "" || adv !== "") data = reason + (adv !== "" ? "+" + adv : "");
                break;

              case "message":
                if (packet.data !== "") data = packet.data;
                break;

              case "event":
                var ev = {
                    name: packet.name
                };
                if (packet.args && packet.args.length) {
                    ev.args = packet.args;
                }
                data = JSON.stringify(ev);
                break;

              case "json":
                data = JSON.stringify(packet.data);
                break;

              case "connect":
                if (packet.qs) data = packet.qs;
                break;

              case "ack":
                data = packet.ackId + (packet.args && packet.args.length ? "+" + JSON.stringify(packet.args) : "");
                break;
            }
            var encoded = [ type, id + (ack == "data" ? "+" : ""), endpoint ];
            if (data !== null && data !== undefined) encoded.push(data);
            return encoded.join(":");
        };
        parser.encodePayload = function(packets) {
            var decoded = "";
            if (packets.length == 1) return packets[0];
            for (var i = 0, l = packets.length; i < l; i++) {
                var packet = packets[i];
                decoded += "�" + packet.length + "�" + packets[i];
            }
            return decoded;
        };
        var regexp = /([^:]+):([0-9]+)?(\+)?:([^:]+)?:?([\s\S]*)?/;
        parser.decodePacket = function(data) {
            var pieces = data.match(regexp);
            if (!pieces) return {};
            var id = pieces[2] || "", data = pieces[5] || "", packet = {
                type: packets[pieces[1]],
                endpoint: pieces[4] || ""
            };
            if (id) {
                packet.id = id;
                if (pieces[3]) packet.ack = "data"; else packet.ack = true;
            }
            switch (packet.type) {
              case "error":
                var pieces = data.split("+");
                packet.reason = reasons[pieces[0]] || "";
                packet.advice = advice[pieces[1]] || "";
                break;

              case "message":
                packet.data = data || "";
                break;

              case "event":
                try {
                    var opts = JSON.parse(data);
                    packet.name = opts.name;
                    packet.args = opts.args;
                } catch (e) {}
                packet.args = packet.args || [];
                break;

              case "json":
                try {
                    packet.data = JSON.parse(data);
                } catch (e) {}
                break;

              case "connect":
                packet.qs = data || "";
                break;

              case "ack":
                var pieces = data.match(/^([0-9]+)(\+)?(.*)/);
                if (pieces) {
                    packet.ackId = pieces[1];
                    packet.args = [];
                    if (pieces[3]) {
                        try {
                            packet.args = pieces[3] ? JSON.parse(pieces[3]) : [];
                        } catch (e) {}
                    }
                }
                break;

              case "disconnect":
              case "heartbeat":
                break;
            }
            return packet;
        };
        parser.decodePayload = function(data) {
            if (data.charAt(0) == "�") {
                var ret = [];
                for (var i = 1, length = ""; i < data.length; i++) {
                    if (data.charAt(i) == "�") {
                        ret.push(parser.decodePacket(data.substr(i + 1).substr(0, length)));
                        i += Number(length) + 1;
                        length = "";
                    } else {
                        length += data.charAt(i);
                    }
                }
                return ret;
            } else {
                return [ parser.decodePacket(data) ];
            }
        };
    })("undefined" != typeof io ? io : module.exports, "undefined" != typeof io ? io : module.parent.exports);
    (function(exports, io) {
        exports.Transport = Transport;
        function Transport(socket, sessid) {
            this.socket = socket;
            this.sessid = sessid;
        }
        io.util.mixin(Transport, io.EventEmitter);
        Transport.prototype.heartbeats = function() {
            return true;
        };
        Transport.prototype.onData = function(data) {
            this.clearCloseTimeout();
            if (this.socket.connected || this.socket.connecting || this.socket.reconnecting) {
                this.setCloseTimeout();
            }
            if (data !== "") {
                var msgs = io.parser.decodePayload(data);
                if (msgs && msgs.length) {
                    for (var i = 0, l = msgs.length; i < l; i++) {
                        this.onPacket(msgs[i]);
                    }
                }
            }
            return this;
        };
        Transport.prototype.onPacket = function(packet) {
            this.socket.setHeartbeatTimeout();
            if (packet.type == "heartbeat") {
                return this.onHeartbeat();
            }
            if (packet.type == "connect" && packet.endpoint == "") {
                this.onConnect();
            }
            if (packet.type == "error" && packet.advice == "reconnect") {
                this.isOpen = false;
            }
            this.socket.onPacket(packet);
            return this;
        };
        Transport.prototype.setCloseTimeout = function() {
            if (!this.closeTimeout) {
                var self = this;
                this.closeTimeout = setTimeout(function() {
                    self.onDisconnect();
                }, this.socket.closeTimeout);
            }
        };
        Transport.prototype.onDisconnect = function() {
            if (this.isOpen) this.close();
            this.clearTimeouts();
            this.socket.onDisconnect();
            return this;
        };
        Transport.prototype.onConnect = function() {
            this.socket.onConnect();
            return this;
        };
        Transport.prototype.clearCloseTimeout = function() {
            if (this.closeTimeout && typeof this.closeTimeout === "number") {
                clearTimeout(this.closeTimeout);
                this.closeTimeout = null;
            }
        };
        Transport.prototype.clearTimeouts = function() {
            this.clearCloseTimeout();
            if (this.reopenTimeout && typeof this.reopenTimeout === "number") {
                clearTimeout(this.reopenTimeout);
            }
        };
        Transport.prototype.packet = function(packet) {
            this.send(io.parser.encodePacket(packet));
        };
        Transport.prototype.onHeartbeat = function(heartbeat) {
            this.packet({
                type: "heartbeat"
            });
        };
        Transport.prototype.onOpen = function() {
            this.isOpen = true;
            this.clearCloseTimeout();
            this.socket.onOpen();
        };
        Transport.prototype.onClose = function() {
            var self = this;
            this.isOpen = false;
            this.socket.onClose();
            this.onDisconnect();
        };
        Transport.prototype.prepareUrl = function() {
            var options = this.socket.options;
            return this.scheme() + "://" + options.host + ":" + options.port + "/" + options.resource + "/" + io.protocol + "/" + this.name + "/" + this.sessid;
        };
        Transport.prototype.ready = function(socket, fn) {
            fn.call(this);
        };
    })("undefined" != typeof io ? io : module.exports, "undefined" != typeof io ? io : module.parent.exports);
    (function(exports, io, global) {
        exports.Socket = Socket;
        function Socket(options) {
            this.options = {
                port: 80,
                secure: false,
                document: "document" in global ? document : false,
                resource: "socket.io",
                transports: io.transports,
                "connect timeout": 1e4,
                "try multiple transports": true,
                reconnect: true,
                "reconnection delay": 500,
                "reconnection limit": Infinity,
                "reopen delay": 3e3,
                "max reconnection attempts": 10,
                "sync disconnect on unload": false,
                "auto connect": true,
                "flash policy port": 10843,
                manualFlush: false
            };
            io.util.merge(this.options, options);
            this.connected = false;
            this.open = false;
            this.connecting = false;
            this.reconnecting = false;
            this.namespaces = {};
            this.buffer = [];
            this.doBuffer = false;
            if (this.options["sync disconnect on unload"] && (!this.isXDomain() || io.util.ua.hasCORS)) {
                var self = this;
                io.util.on(global, "beforeunload", function() {
                    self.disconnectSync();
                }, false);
            }
            if (this.options["auto connect"]) {
                this.connect();
            }
        }
        io.util.mixin(Socket, io.EventEmitter);
        Socket.prototype.of = function(name) {
            if (!this.namespaces[name]) {
                this.namespaces[name] = new io.SocketNamespace(this, name);
                if (name !== "") {
                    this.namespaces[name].packet({
                        type: "connect"
                    });
                }
            }
            return this.namespaces[name];
        };
        Socket.prototype.publish = function() {
            this.emit.apply(this, arguments);
            var nsp;
            for (var i in this.namespaces) {
                if (this.namespaces.hasOwnProperty(i)) {
                    nsp = this.of(i);
                    nsp.$emit.apply(nsp, arguments);
                }
            }
        };
        function empty() {}
        Socket.prototype.handshake = function(fn) {
            var self = this, options = this.options;
            function complete(data) {
                if (data instanceof Error) {
                    self.connecting = false;
                    self.onError(data.message);
                } else {
                    fn.apply(null, data.split(":"));
                }
            }
            var url = [ "http" + (options.secure ? "s" : "") + ":/", options.host + ":" + options.port, options.resource, io.protocol, io.util.query(this.options.query, "t=" + new Date()) ].join("/");
            var xhr = io.util.request();
            xhr.open("GET", url, true);
            if (this.isXDomain()) {
                xhr.withCredentials = true;
            }
            function readyStateChanged() {
                if (xhr.readyState == 4) {
                    xhr.onreadystatechange = empty;
                    xhr.onreadystatechanged = empty;
                    if (xhr.status == 200) {
                        complete(xhr.responseText);
                    } else if (xhr.status == 403) {
                        self.onError(xhr.responseText);
                    } else {
                        self.connecting = false;
                        !self.reconnecting && self.onError(xhr.responseText);
                    }
                }
            }
            xhr.onreadystatechange = readyStateChanged;
            xhr.onreadystatechanged = readyStateChanged;
            xhr.onerror = function(ev) {
                self.connecting = false;
                !self.reconnecting && self.onError(ev.error);
            };
            xhr.send(null);
        };
        Socket.prototype.getTransport = function(override) {
            var transports = override || this.transports, match;
            for (var i = 0, transport; transport = transports[i]; i++) {
                if (io.Transport[transport] && io.Transport[transport].check(this) && (!this.isXDomain() || io.Transport[transport].xdomainCheck(this))) {
                    return new io.Transport[transport](this, this.sessionid);
                }
            }
            return null;
        };
        Socket.prototype.connect = function(fn) {
            if (this.connecting) {
                return this;
            }
            var self = this;
            self.connecting = true;
            this.handshake(function(sid, heartbeat, close, transports) {
                self.sessionid = sid;
                self.closeTimeout = close * 1e3;
                self.heartbeatTimeout = heartbeat * 1e3;
                if (!self.transports) self.transports = self.origTransports = transports ? io.util.intersect(transports.split(","), self.options.transports) : self.options.transports;
                self.setHeartbeatTimeout();
                function connect(transports) {
                    if (self.transport) self.transport.clearTimeouts();
                    self.transport = self.getTransport(transports);
                    if (!self.transport) return self.publish("connect_failed");
                    self.transport.ready(self, function() {
                        self.connecting = true;
                        self.publish("connecting", self.transport.name);
                        self.transport.open();
                        if (self.options["connect timeout"]) {
                            self.connectTimeoutTimer = setTimeout(function() {
                                if (!self.connected) {
                                    self.connecting = false;
                                    if (self.options["try multiple transports"]) {
                                        var remaining = self.transports;
                                        while (remaining.length > 0 && remaining.splice(0, 1)[0] != self.transport.name) {}
                                        if (remaining.length) {
                                            connect(remaining);
                                        } else {
                                            self.publish("connect_failed");
                                        }
                                    } else self.publish("connect_failed");
                                } else {
                                    self.publish("connect_failed");
                                }
                            }, self.options["connect timeout"]);
                        }
                    });
                }
                connect(self.transports);
                self.once("connect", function() {
                    if (typeof self.connectTimeoutTimer === "number") {
                        clearTimeout(self.connectTimeoutTimer);
                    }
                    fn && typeof fn == "function" && fn();
                });
            });
            return this;
        };
        Socket.prototype.setHeartbeatTimeout = function() {
            if (typeof this.heartbeatTimeoutTimer === "number") {
                clearTimeout(this.heartbeatTimeoutTimer);
            }
            if (this.transport && !this.transport.heartbeats()) return;
            var self = this;
            this.heartbeatTimeoutTimer = setTimeout(function() {
                self.transport.onClose();
            }, this.heartbeatTimeout);
        };
        Socket.prototype.packet = function(data) {
            if (this.connected && !this.doBuffer) {
                this.transport.packet(data);
            } else {
                this.buffer.push(data);
            }
            return this;
        };
        Socket.prototype.setBuffer = function(v) {
            this.doBuffer = v;
            if (!v && this.connected && this.buffer.length) {
                if (!this.options["manualFlush"]) {
                    this.flushBuffer();
                }
            }
        };
        Socket.prototype.flushBuffer = function() {
            this.transport.payload(this.buffer);
            this.buffer = [];
        };
        Socket.prototype.disconnect = function() {
            if (this.connected || this.connecting) {
                if (this.open) {
                    this.of("").packet({
                        type: "disconnect"
                    });
                }
                this.onDisconnect("booted");
            }
            return this;
        };
        Socket.prototype.disconnectSync = function() {
            var xhr = io.util.request();
            var uri = [ "http" + (this.options.secure ? "s" : "") + ":/", this.options.host + ":" + this.options.port, this.options.resource, io.protocol, "", this.sessionid ].join("/") + "/?disconnect=1";
            xhr.open("GET", uri, false);
            xhr.send(null);
            this.onDisconnect("booted");
        };
        Socket.prototype.isXDomain = function() {
            return false;
        };
        Socket.prototype.onConnect = function() {
            if (!this.connected) {
                this.connected = true;
                this.connecting = false;
                if (!this.doBuffer) {
                    this.setBuffer(false);
                }
                this.emit("connect");
            }
        };
        Socket.prototype.onOpen = function() {
            this.open = true;
        };
        Socket.prototype.onClose = function() {
            this.open = false;
            if (typeof this.heartbeatTimeoutTimer === "number") {
                clearTimeout(this.heartbeatTimeoutTimer);
            }
        };
        Socket.prototype.onPacket = function(packet) {
            this.of(packet.endpoint).onPacket(packet);
        };
        Socket.prototype.onError = function(err) {
            if (err && err.advice) {
                if (err.advice === "reconnect" && (this.connected || this.connecting)) {
                    this.disconnect();
                    if (this.options.reconnect) {
                        this.reconnect();
                    }
                }
            }
            this.publish("error", err && err.reason ? err.reason : err);
        };
        Socket.prototype.onDisconnect = function(reason) {
            var wasConnected = this.connected, wasConnecting = this.connecting;
            this.connected = false;
            this.connecting = false;
            this.open = false;
            if (wasConnected || wasConnecting) {
                if (this.transport) {
                    this.transport.close();
                    this.transport.clearTimeouts();
                }
                if (wasConnected) {
                    this.publish("disconnect", reason);
                    if ("booted" != reason && this.options.reconnect && !this.reconnecting) {
                        this.reconnect();
                    }
                }
            }
        };
        Socket.prototype.reconnect = function() {
            this.reconnecting = true;
            this.reconnectionAttempts = 0;
            this.reconnectionDelay = this.options["reconnection delay"];
            var self = this, maxAttempts = this.options["max reconnection attempts"], tryMultiple = this.options["try multiple transports"], limit = this.options["reconnection limit"];
            function reset() {
                if (self.connected) {
                    for (var i in self.namespaces) {
                        if (self.namespaces.hasOwnProperty(i) && "" !== i) {
                            self.namespaces[i].packet({
                                type: "connect"
                            });
                        }
                    }
                    self.publish("reconnect", self.transport.name, self.reconnectionAttempts);
                }
                if (typeof self.reconnectionTimer === "number") {
                    clearTimeout(self.reconnectionTimer);
                }
                self.removeListener("connect_failed", maybeReconnect);
                self.removeListener("connect", maybeReconnect);
                self.reconnecting = false;
                delete self.reconnectionAttempts;
                delete self.reconnectionDelay;
                delete self.reconnectionTimer;
                delete self.redoTransports;
                self.options["try multiple transports"] = tryMultiple;
            }
            function maybeReconnect() {
                if (!self.reconnecting) {
                    return;
                }
                if (self.connected) {
                    return reset();
                }
                if (self.connecting && self.reconnecting) {
                    return self.reconnectionTimer = setTimeout(maybeReconnect, 1e3);
                }
                if (self.reconnectionAttempts++ >= maxAttempts) {
                    self.publish("reconnect_failed");
                    reset();
                } else {
                    if (self.reconnectionDelay < limit) {
                        self.reconnectionDelay *= 2;
                    }
                    self.connect();
                    self.publish("reconnecting", self.reconnectionDelay, self.reconnectionAttempts);
                    self.reconnectionTimer = setTimeout(maybeReconnect, self.reconnectionDelay);
                }
            }
            this.options["try multiple transports"] = false;
            this.reconnectionTimer = setTimeout(maybeReconnect, this.reconnectionDelay);
            this.on("connect", maybeReconnect);
        };
    })("undefined" != typeof io ? io : module.exports, "undefined" != typeof io ? io : module.parent.exports, this);
    (function(exports, io) {
        exports.SocketNamespace = SocketNamespace;
        function SocketNamespace(socket, name) {
            this.socket = socket;
            this.name = name || "";
            this.flags = {};
            this.json = new Flag(this, "json");
            this.ackPackets = 0;
            this.acks = {};
        }
        io.util.mixin(SocketNamespace, io.EventEmitter);
        SocketNamespace.prototype.$emit = io.EventEmitter.prototype.emit;
        SocketNamespace.prototype.of = function() {
            return this.socket.of.apply(this.socket, arguments);
        };
        SocketNamespace.prototype.packet = function(packet) {
            packet.endpoint = this.name;
            this.socket.packet(packet);
            this.flags = {};
            return this;
        };
        SocketNamespace.prototype.send = function(data, fn) {
            var packet = {
                type: this.flags.json ? "json" : "message",
                data: data
            };
            if ("function" == typeof fn) {
                packet.id = ++this.ackPackets;
                packet.ack = true;
                this.acks[packet.id] = fn;
            }
            return this.packet(packet);
        };
        SocketNamespace.prototype.emit = function(name) {
            var args = Array.prototype.slice.call(arguments, 1), lastArg = args[args.length - 1], packet = {
                type: "event",
                name: name
            };
            if ("function" == typeof lastArg) {
                packet.id = ++this.ackPackets;
                packet.ack = "data";
                this.acks[packet.id] = lastArg;
                args = args.slice(0, args.length - 1);
            }
            packet.args = args;
            return this.packet(packet);
        };
        SocketNamespace.prototype.disconnect = function() {
            if (this.name === "") {
                this.socket.disconnect();
            } else {
                this.packet({
                    type: "disconnect"
                });
                this.$emit("disconnect");
            }
            return this;
        };
        SocketNamespace.prototype.onPacket = function(packet) {
            var self = this;
            function ack() {
                self.packet({
                    type: "ack",
                    args: io.util.toArray(arguments),
                    ackId: packet.id
                });
            }
            switch (packet.type) {
              case "connect":
                this.$emit("connect");
                break;

              case "disconnect":
                if (this.name === "") {
                    this.socket.onDisconnect(packet.reason || "booted");
                } else {
                    this.$emit("disconnect", packet.reason);
                }
                break;

              case "message":
              case "json":
                var params = [ "message", packet.data ];
                if (packet.ack == "data") {
                    params.push(ack);
                } else if (packet.ack) {
                    this.packet({
                        type: "ack",
                        ackId: packet.id
                    });
                }
                this.$emit.apply(this, params);
                break;

              case "event":
                var params = [ packet.name ].concat(packet.args);
                if (packet.ack == "data") params.push(ack);
                this.$emit.apply(this, params);
                break;

              case "ack":
                if (this.acks[packet.ackId]) {
                    this.acks[packet.ackId].apply(this, packet.args);
                    delete this.acks[packet.ackId];
                }
                break;

              case "error":
                if (packet.advice) {
                    this.socket.onError(packet);
                } else {
                    if (packet.reason == "unauthorized") {
                        this.$emit("connect_failed", packet.reason);
                    } else {
                        this.$emit("error", packet.reason);
                    }
                }
                break;
            }
        };
        function Flag(nsp, name) {
            this.namespace = nsp;
            this.name = name;
        }
        Flag.prototype.send = function() {
            this.namespace.flags[this.name] = true;
            this.namespace.send.apply(this.namespace, arguments);
        };
        Flag.prototype.emit = function() {
            this.namespace.flags[this.name] = true;
            this.namespace.emit.apply(this.namespace, arguments);
        };
    })("undefined" != typeof io ? io : module.exports, "undefined" != typeof io ? io : module.parent.exports);
    (function(exports, io, global) {
        exports.websocket = WS;
        function WS(socket) {
            io.Transport.apply(this, arguments);
        }
        io.util.inherit(WS, io.Transport);
        WS.prototype.name = "websocket";
        WS.prototype.open = function() {
            var query = io.util.query(this.socket.options.query), self = this, Socket;
            this.websocket = __p.require("net.iamyellow.tiws").createWS();
            this.websocket.addEventListener("open", function() {
                self.onOpen();
                self.socket.setBuffer(false);
            });
            this.websocket.addEventListener("message", function(ev) {
                self.onData(ev.data);
            });
            this.websocket.addEventListener("close", function(ev) {
                self.onClose();
                self.socket.setBuffer(true);
            });
            this.websocket.addEventListener("error", function(ev) {
                self.onError({
                    advice: "reconnect"
                });
            });
            this.websocket.open(this.prepareUrl() + query);
            return this;
        };
        WS.prototype.send = function(data) {
            this.websocket.send(data);
            return this;
        };
        WS.prototype.payload = function(arr) {
            for (var i = 0, l = arr.length; i < l; i++) {
                this.packet(arr[i]);
            }
            return this;
        };
        WS.prototype.close = function() {
            if (this.websocket) {
                this.websocket.close();
            }
            return this;
        };
        WS.prototype.onError = function(e) {
            this.socket.onError(e);
        };
        WS.prototype.scheme = function() {
            return this.socket.options.secure ? "wss" : "ws";
        };
        WS.check = function() {
            return true;
        };
        WS.xdomainCheck = function() {
            return true;
        };
        io.transports.push("websocket");
    })("undefined" != typeof io ? io.Transport : module.exports, "undefined" != typeof io ? io : module.parent.exports, this);
    (function(exports, io, global) {
        exports.XHR = XHR;
        function XHR(socket) {
            if (!socket) return;
            io.Transport.apply(this, arguments);
            this.sendBuffer = [];
        }
        io.util.inherit(XHR, io.Transport);
        XHR.prototype.open = function() {
            this.socket.setBuffer(false);
            this.onOpen();
            this.get();
            this.setCloseTimeout();
            return this;
        };
        XHR.prototype.payload = function(payload) {
            var msgs = [];
            for (var i = 0, l = payload.length; i < l; i++) {
                msgs.push(io.parser.encodePacket(payload[i]));
            }
            this.send(io.parser.encodePayload(msgs));
        };
        XHR.prototype.send = function(data) {
            this.post(data);
            return this;
        };
        function empty() {}
        XHR.prototype.post = function(data) {
            var self = this;
            this.socket.setBuffer(true);
            function stateChange() {
                if (this.readyState == 4) {
                    this.onreadystatechange = empty;
                    this.onreadystatechanged = empty;
                    self.posting = false;
                    if (this.status == 200) {
                        self.socket.setBuffer(false);
                    } else {
                        self.onClose();
                    }
                }
            }
            function onerror() {
                this.onerror = empty;
                self.onClose();
            }
            this.sendXHR = this.request("POST");
            this.sendXHR.onerror = onerror;
            this.sendXHR.onreadystatechange = stateChange;
            this.sendXHR.onreadystatechanged = stateChange;
            this.sendXHR.send(data);
        };
        XHR.prototype.close = function() {
            this.onClose();
            return this;
        };
        XHR.prototype.request = function(method) {
            var req = io.util.request(this.socket.isXDomain()), query = io.util.query(this.socket.options.query, "t=" + new Date());
            req.timeout = 0;
            req.enableKeepAlive = true;
            req.open(method || "GET", this.prepareUrl() + query, true);
            if (method == "POST") {
                req.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
            }
            return req;
        };
        XHR.prototype.scheme = function() {
            return this.socket.options.secure ? "https" : "http";
        };
        XHR.check = function(socket, xdomain) {
            return true;
        };
        XHR.xdomainCheck = function(socket) {
            return XHR.check(socket, true);
        };
    })("undefined" != typeof io ? io.Transport : module.exports, "undefined" != typeof io ? io : module.parent.exports, this);
    (function(exports, io, global) {
        exports["xhr-polling"] = XHRPolling;
        function XHRPolling() {
            io.Transport.XHR.apply(this, arguments);
        }
        io.util.inherit(XHRPolling, io.Transport.XHR);
        io.util.merge(XHRPolling, io.Transport.XHR);
        XHRPolling.prototype.name = "xhr-polling";
        XHRPolling.prototype.heartbeats = function() {
            return false;
        };
        XHRPolling.prototype.open = function() {
            var self = this;
            io.Transport.XHR.prototype.open.call(self);
            return false;
        };
        function empty() {}
        XHRPolling.prototype.get = function() {
            if (!this.isOpen) return;
            var self = this;
            function stateChange() {
                if (this.readyState == 4) {
                    this.onreadystatechange = empty;
                    if (this.status == 200) {
                        self.onData(this.responseText);
                        self.get();
                    } else {
                        self.onClose();
                    }
                }
            }
            function onerror() {
                self.retryCounter++;
                if (!self.retryCounter || self.retryCounter > 3) {
                    self.onClose();
                } else {
                    self.get();
                }
            }
            this.xhr = this.request();
            this.xhr.onerror = onerror;
            this.xhr.onreadystatechange = stateChange;
            this.xhr.send(null);
        };
        XHRPolling.prototype.onClose = function() {
            io.Transport.XHR.prototype.onClose.call(this);
            if (this.xhr) {
                this.xhr.onreadystatechange = this.xhr.onload = this.xhr.onerror = empty;
                try {
                    this.xhr.abort();
                } catch (e) {}
                this.xhr = null;
            }
        };
        XHRPolling.prototype.ready = function(socket, fn) {
            var self = this;
            io.util.defer(function() {
                fn.call(self);
            });
        };
        io.transports.push("xhr-polling");
    })("undefined" != typeof io ? io.Transport : module.exports, "undefined" != typeof io ? io : module.parent.exports, this);
})();