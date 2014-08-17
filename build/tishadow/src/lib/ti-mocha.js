var logger = __p.require("/api/Log");

(function() {
    function require(p) {
        var path = require.resolve(p), mod = require.modules[path];
        if (!mod) throw new Error('failed to require "' + p + '"');
        if (!mod.exports) {
            mod.exports = {};
            mod.call(mod.exports, mod, mod.exports, require.relative(path));
        }
        return mod.exports;
    }
    require.modules = {};
    require.resolve = function(path) {
        var orig = path, reg = path + ".js", index = path + "/index.js";
        return require.modules[reg] && reg || require.modules[index] && index || orig;
    };
    require.register = function(path, fn) {
        require.modules[path] = fn;
    };
    require.relative = function(parent) {
        return function(p) {
            if ("." != p.charAt(0)) return __p.require(p);
            var path = parent.split("/"), segs = p.split("/");
            path.pop();
            for (var i = 0; i < segs.length; i++) {
                var seg = segs[i];
                if (".." == seg) path.pop(); else if ("." != seg) path.push(seg);
            }
            return __p.require(path.join("/"));
        };
    };
    require.register("browser/debug.js", function(module, exports, require) {
        module.exports = function(type) {
            return function() {};
        };
    });
    require.register("browser/diff.js", function(module, exports, require) {
        var JsDiff = function() {
            function clonePath(path) {
                return {
                    newPos: path.newPos,
                    components: path.components.slice(0)
                };
            }
            function removeEmpty(array) {
                var ret = [];
                for (var i = 0; i < array.length; i++) {
                    if (array[i]) {
                        ret.push(array[i]);
                    }
                }
                return ret;
            }
            function escapeHTML(s) {
                var n = s;
                n = n.replace(/&/g, "&amp;");
                n = n.replace(/</g, "&lt;");
                n = n.replace(/>/g, "&gt;");
                n = n.replace(/"/g, "&quot;");
                return n;
            }
            var Diff = function(ignoreWhitespace) {
                this.ignoreWhitespace = ignoreWhitespace;
            };
            Diff.prototype = {
                diff: function(oldString, newString) {
                    if (newString === oldString) {
                        return [ {
                            value: newString
                        } ];
                    }
                    if (!newString) {
                        return [ {
                            value: oldString,
                            removed: true
                        } ];
                    }
                    if (!oldString) {
                        return [ {
                            value: newString,
                            added: true
                        } ];
                    }
                    newString = this.tokenize(newString);
                    oldString = this.tokenize(oldString);
                    var newLen = newString.length, oldLen = oldString.length;
                    var maxEditLength = newLen + oldLen;
                    var bestPath = [ {
                        newPos: -1,
                        components: []
                    } ];
                    var oldPos = this.extractCommon(bestPath[0], newString, oldString, 0);
                    if (bestPath[0].newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
                        return bestPath[0].components;
                    }
                    for (var editLength = 1; editLength <= maxEditLength; editLength++) {
                        for (var diagonalPath = -1 * editLength; diagonalPath <= editLength; diagonalPath += 2) {
                            var basePath;
                            var addPath = bestPath[diagonalPath - 1], removePath = bestPath[diagonalPath + 1];
                            oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;
                            if (addPath) {
                                bestPath[diagonalPath - 1] = undefined;
                            }
                            var canAdd = addPath && addPath.newPos + 1 < newLen;
                            var canRemove = removePath && 0 <= oldPos && oldPos < oldLen;
                            if (!canAdd && !canRemove) {
                                bestPath[diagonalPath] = undefined;
                                continue;
                            }
                            if (!canAdd || canRemove && addPath.newPos < removePath.newPos) {
                                basePath = clonePath(removePath);
                                this.pushComponent(basePath.components, oldString[oldPos], undefined, true);
                            } else {
                                basePath = clonePath(addPath);
                                basePath.newPos++;
                                this.pushComponent(basePath.components, newString[basePath.newPos], true, undefined);
                            }
                            var oldPos = this.extractCommon(basePath, newString, oldString, diagonalPath);
                            if (basePath.newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
                                return basePath.components;
                            } else {
                                bestPath[diagonalPath] = basePath;
                            }
                        }
                    }
                },
                pushComponent: function(components, value, added, removed) {
                    var last = components[components.length - 1];
                    if (last && last.added === added && last.removed === removed) {
                        components[components.length - 1] = {
                            value: this.join(last.value, value),
                            added: added,
                            removed: removed
                        };
                    } else {
                        components.push({
                            value: value,
                            added: added,
                            removed: removed
                        });
                    }
                },
                extractCommon: function(basePath, newString, oldString, diagonalPath) {
                    var newLen = newString.length, oldLen = oldString.length, newPos = basePath.newPos, oldPos = newPos - diagonalPath;
                    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(newString[newPos + 1], oldString[oldPos + 1])) {
                        newPos++;
                        oldPos++;
                        this.pushComponent(basePath.components, newString[newPos], undefined, undefined);
                    }
                    basePath.newPos = newPos;
                    return oldPos;
                },
                equals: function(left, right) {
                    var reWhitespace = /\S/;
                    if (this.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right)) {
                        return true;
                    } else {
                        return left === right;
                    }
                },
                join: function(left, right) {
                    return left + right;
                },
                tokenize: function(value) {
                    return value;
                }
            };
            var CharDiff = new Diff();
            var WordDiff = new Diff(true);
            var WordWithSpaceDiff = new Diff();
            WordDiff.tokenize = WordWithSpaceDiff.tokenize = function(value) {
                return removeEmpty(value.split(/(\s+|\b)/));
            };
            var CssDiff = new Diff(true);
            CssDiff.tokenize = function(value) {
                return removeEmpty(value.split(/([{}:;,]|\s+)/));
            };
            var LineDiff = new Diff();
            LineDiff.tokenize = function(value) {
                return value.split(/^/m);
            };
            return {
                Diff: Diff,
                diffChars: function(oldStr, newStr) {
                    return CharDiff.diff(oldStr, newStr);
                },
                diffWords: function(oldStr, newStr) {
                    return WordDiff.diff(oldStr, newStr);
                },
                diffWordsWithSpace: function(oldStr, newStr) {
                    return WordWithSpaceDiff.diff(oldStr, newStr);
                },
                diffLines: function(oldStr, newStr) {
                    return LineDiff.diff(oldStr, newStr);
                },
                diffCss: function(oldStr, newStr) {
                    return CssDiff.diff(oldStr, newStr);
                },
                createPatch: function(fileName, oldStr, newStr, oldHeader, newHeader) {
                    var ret = [];
                    ret.push("Index: " + fileName);
                    ret.push("===================================================================");
                    ret.push("--- " + fileName + (typeof oldHeader === "undefined" ? "" : "	" + oldHeader));
                    ret.push("+++ " + fileName + (typeof newHeader === "undefined" ? "" : "	" + newHeader));
                    var diff = LineDiff.diff(oldStr, newStr);
                    if (!diff[diff.length - 1].value) {
                        diff.pop();
                    }
                    diff.push({
                        value: "",
                        lines: []
                    });
                    function contextLines(lines) {
                        return lines.map(function(entry) {
                            return " " + entry;
                        });
                    }
                    function eofNL(curRange, i, current) {
                        var last = diff[diff.length - 2], isLast = i === diff.length - 2, isLastOfType = i === diff.length - 3 && (current.added !== last.added || current.removed !== last.removed);
                        if (!/\n$/.test(current.value) && (isLast || isLastOfType)) {
                            curRange.push("\\ No newline at end of file");
                        }
                    }
                    var oldRangeStart = 0, newRangeStart = 0, curRange = [], oldLine = 1, newLine = 1;
                    for (var i = 0; i < diff.length; i++) {
                        var current = diff[i], lines = current.lines || current.value.replace(/\n$/, "").split("\n");
                        current.lines = lines;
                        if (current.added || current.removed) {
                            if (!oldRangeStart) {
                                var prev = diff[i - 1];
                                oldRangeStart = oldLine;
                                newRangeStart = newLine;
                                if (prev) {
                                    curRange = contextLines(prev.lines.slice(-4));
                                    oldRangeStart -= curRange.length;
                                    newRangeStart -= curRange.length;
                                }
                            }
                            curRange.push.apply(curRange, lines.map(function(entry) {
                                return (current.added ? "+" : "-") + entry;
                            }));
                            eofNL(curRange, i, current);
                            if (current.added) {
                                newLine += lines.length;
                            } else {
                                oldLine += lines.length;
                            }
                        } else {
                            if (oldRangeStart) {
                                if (lines.length <= 8 && i < diff.length - 2) {
                                    curRange.push.apply(curRange, contextLines(lines));
                                } else {
                                    var contextSize = Math.min(lines.length, 4);
                                    ret.push("@@ -" + oldRangeStart + "," + (oldLine - oldRangeStart + contextSize) + " +" + newRangeStart + "," + (newLine - newRangeStart + contextSize) + " @@");
                                    ret.push.apply(ret, curRange);
                                    ret.push.apply(ret, contextLines(lines.slice(0, contextSize)));
                                    if (lines.length <= 4) {
                                        eofNL(ret, i, current);
                                    }
                                    oldRangeStart = 0;
                                    newRangeStart = 0;
                                    curRange = [];
                                }
                            }
                            oldLine += lines.length;
                            newLine += lines.length;
                        }
                    }
                    return ret.join("\n") + "\n";
                },
                applyPatch: function(oldStr, uniDiff) {
                    var diffstr = uniDiff.split("\n");
                    var diff = [];
                    var remEOFNL = false, addEOFNL = false;
                    for (var i = diffstr[0][0] === "I" ? 4 : 0; i < diffstr.length; i++) {
                        if (diffstr[i][0] === "@") {
                            var meh = diffstr[i].split(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
                            diff.unshift({
                                start: meh[3],
                                oldlength: meh[2],
                                oldlines: [],
                                newlength: meh[4],
                                newlines: []
                            });
                        } else if (diffstr[i][0] === "+") {
                            diff[0].newlines.push(diffstr[i].substr(1));
                        } else if (diffstr[i][0] === "-") {
                            diff[0].oldlines.push(diffstr[i].substr(1));
                        } else if (diffstr[i][0] === " ") {
                            diff[0].newlines.push(diffstr[i].substr(1));
                            diff[0].oldlines.push(diffstr[i].substr(1));
                        } else if (diffstr[i][0] === "\\") {
                            if (diffstr[i - 1][0] === "+") {
                                remEOFNL = true;
                            } else if (diffstr[i - 1][0] === "-") {
                                addEOFNL = true;
                            }
                        }
                    }
                    var str = oldStr.split("\n");
                    for (var i = diff.length - 1; i >= 0; i--) {
                        var d = diff[i];
                        for (var j = 0; j < d.oldlength; j++) {
                            if (str[d.start - 1 + j] !== d.oldlines[j]) {
                                return false;
                            }
                        }
                        Array.prototype.splice.apply(str, [ d.start - 1, +d.oldlength ].concat(d.newlines));
                    }
                    if (remEOFNL) {
                        while (!str[str.length - 1]) {
                            str.pop();
                        }
                    } else if (addEOFNL) {
                        str.push("");
                    }
                    return str.join("\n");
                },
                convertChangesToXML: function(changes) {
                    var ret = [];
                    for (var i = 0; i < changes.length; i++) {
                        var change = changes[i];
                        if (change.added) {
                            ret.push("<ins>");
                        } else if (change.removed) {
                            ret.push("<del>");
                        }
                        ret.push(escapeHTML(change.value));
                        if (change.added) {
                            ret.push("</ins>");
                        } else if (change.removed) {
                            ret.push("</del>");
                        }
                    }
                    return ret.join("");
                },
                convertChangesToDMP: function(changes) {
                    var ret = [], change;
                    for (var i = 0; i < changes.length; i++) {
                        change = changes[i];
                        ret.push([ change.added ? 1 : change.removed ? -1 : 0, change.value ]);
                    }
                    return ret;
                }
            };
        }();
        if (typeof module !== "undefined") {
            module.exports = JsDiff;
        }
    });
    require.register("browser/events.js", function(module, exports, require) {
        exports.EventEmitter = EventEmitter;
        function isArray(obj) {
            return "[object Array]" == {}.toString.call(obj);
        }
        function EventEmitter() {}
        EventEmitter.prototype.on = function(name, fn) {
            if (!this.$events) {
                this.$events = {};
            }
            if (!this.$events[name]) {
                this.$events[name] = fn;
            } else if (isArray(this.$events[name])) {
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
                if (isArray(list)) {
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
            if (!isArray(this.$events[name])) {
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
            var args = [].slice.call(arguments, 1);
            if ("function" == typeof handler) {
                handler.apply(this, args);
            } else if (isArray(handler)) {
                var listeners = handler.slice();
                for (var i = 0, l = listeners.length; i < l; i++) {
                    listeners[i].apply(this, args);
                }
            } else {
                return false;
            }
            return true;
        };
    });
    require.register("browser/fs.js", function(module, exports, require) {});
    require.register("browser/path.js", function(module, exports, require) {});
    require.register("browser/progress.js", function(module, exports, require) {
        module.exports = Progress;
        function Progress() {
            this.percent = 0;
            this.size(0);
            this.fontSize(11);
            this.font("helvetica, arial, sans-serif");
        }
        Progress.prototype.size = function(n) {
            this._size = n;
            return this;
        };
        Progress.prototype.text = function(str) {
            this._text = str;
            return this;
        };
        Progress.prototype.fontSize = function(n) {
            this._fontSize = n;
            return this;
        };
        Progress.prototype.font = function(family) {
            this._font = family;
            return this;
        };
        Progress.prototype.update = function(n) {
            this.percent = n;
            return this;
        };
        Progress.prototype.draw = function(ctx) {
            var percent = Math.min(this.percent, 100), size = this._size, half = size / 2, x = half, y = half, rad = half - 1, fontSize = this._fontSize;
            ctx.font = fontSize + "px " + this._font;
            var angle = Math.PI * 2 * (percent / 100);
            ctx.clearRect(0, 0, size, size);
            ctx.strokeStyle = "#9f9f9f";
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, angle, false);
            ctx.stroke();
            ctx.strokeStyle = "#eee";
            ctx.beginPath();
            ctx.arc(x, y, rad - 1, 0, angle, true);
            ctx.stroke();
            var text = this._text || (percent | 0) + "%", w = ctx.measureText(text).width;
            ctx.fillText(text, x - w / 2 + 1, y + fontSize / 2 - 1);
            return this;
        };
    });
    require.register("browser/tty.js", function(module, exports, require) {
        exports.isatty = function() {
            return true;
        };
        exports.getWindowSize = function() {
            if ("innerHeight" in global) {
                return [ global.innerHeight, global.innerWidth ];
            } else {
                return [ 640, 480 ];
            }
        };
    });
    require.register("context.js", function(module, exports, require) {
        module.exports = Context;
        function Context() {}
        Context.prototype.runnable = function(runnable) {
            if (0 == arguments.length) return this._runnable;
            this.test = this._runnable = runnable;
            return this;
        };
        Context.prototype.timeout = function(ms) {
            this.runnable().timeout(ms);
            return this;
        };
        Context.prototype.slow = function(ms) {
            this.runnable().slow(ms);
            return this;
        };
        Context.prototype.inspect = function() {
            return JSON.stringify(this, function(key, val) {
                if ("_runnable" == key) return;
                if ("test" == key) return;
                return val;
            }, 2);
        };
    });
    require.register("hook.js", function(module, exports, require) {
        var Runnable = __p.require("lib/runnable");
        module.exports = Hook;
        function Hook(title, fn) {
            Runnable.call(this, title, fn);
            this.type = "hook";
        }
        function F() {}
        F.prototype = Runnable.prototype;
        Hook.prototype = new F();
        Hook.prototype.constructor = Hook;
        Hook.prototype.error = function(err) {
            if (0 == arguments.length) {
                var err = this._error;
                this._error = null;
                return err;
            }
            this._error = err;
        };
    });
    require.register("interfaces/bdd.js", function(module, exports, require) {
        var Suite = __p.require("suite"), Test = __p.require("test"), utils = __p.require("utils");
        module.exports = function(suite) {
            var suites = [ suite ];
            suite.on("pre-require", function(context, file, mocha) {
                context.before = function(fn) {
                    suites[0].beforeAll(fn);
                };
                context.after = function(fn) {
                    suites[0].afterAll(fn);
                };
                context.beforeEach = function(fn) {
                    suites[0].beforeEach(fn);
                };
                context.afterEach = function(fn) {
                    suites[0].afterEach(fn);
                };
                context.describe = context.context = function(title, fn) {
                    var suite = Suite.create(suites[0], title);
                    suites.unshift(suite);
                    fn.call(suite);
                    suites.shift();
                    return suite;
                };
                context.xdescribe = context.xcontext = context.describe.skip = function(title, fn) {
                    var suite = Suite.create(suites[0], title);
                    suite.pending = true;
                    suites.unshift(suite);
                    fn.call(suite);
                    suites.shift();
                };
                context.describe.only = function(title, fn) {
                    var suite = context.describe(title, fn);
                    mocha.grep(suite.fullTitle());
                    return suite;
                };
                context.it = context.specify = function(title, fn) {
                    var suite = suites[0];
                    if (suite.pending) var fn = null;
                    var test = new Test(title, fn);
                    suite.addTest(test);
                    return test;
                };
                context.it.only = function(title, fn) {
                    var test = context.it(title, fn);
                    var reString = "^" + utils.escapeRegexp(test.fullTitle()) + "$";
                    mocha.grep(new RegExp(reString));
                    return test;
                };
                context.xit = context.xspecify = context.it.skip = function(title) {
                    context.it(title);
                };
            });
        };
    });
    require.register("interfaces/exports.js", function(module, exports, require) {
        var Suite = __p.require("suite"), Test = __p.require("test");
        module.exports = function(suite) {
            var suites = [ suite ];
            suite.on("require", visit);
            function visit(obj) {
                var suite;
                for (var key in obj) {
                    if ("function" == typeof obj[key]) {
                        var fn = obj[key];
                        switch (key) {
                          case "before":
                            suites[0].beforeAll(fn);
                            break;

                          case "after":
                            suites[0].afterAll(fn);
                            break;

                          case "beforeEach":
                            suites[0].beforeEach(fn);
                            break;

                          case "afterEach":
                            suites[0].afterEach(fn);
                            break;

                          default:
                            suites[0].addTest(new Test(key, fn));
                        }
                    } else {
                        var suite = Suite.create(suites[0], key);
                        suites.unshift(suite);
                        visit(obj[key]);
                        suites.shift();
                    }
                }
            }
        };
    });
    require.register("interfaces/index.js", function(module, exports, require) {
        exports.bdd = __p.require("lib/bdd");
        exports.tdd = __p.require("lib/tdd");
        exports.qunit = __p.require("lib/qunit");
        exports.exports = __p.require("lib/exports");
    });
    require.register("interfaces/qunit.js", function(module, exports, require) {
        var Suite = __p.require("suite"), Test = __p.require("test"), utils = __p.require("utils");
        module.exports = function(suite) {
            var suites = [ suite ];
            suite.on("pre-require", function(context, file, mocha) {
                context.before = function(fn) {
                    suites[0].beforeAll(fn);
                };
                context.after = function(fn) {
                    suites[0].afterAll(fn);
                };
                context.beforeEach = function(fn) {
                    suites[0].beforeEach(fn);
                };
                context.afterEach = function(fn) {
                    suites[0].afterEach(fn);
                };
                context.suite = function(title) {
                    if (suites.length > 1) suites.shift();
                    var suite = Suite.create(suites[0], title);
                    suites.unshift(suite);
                    return suite;
                };
                context.suite.only = function(title, fn) {
                    var suite = context.suite(title, fn);
                    mocha.grep(suite.fullTitle());
                };
                context.test = function(title, fn) {
                    var test = new Test(title, fn);
                    suites[0].addTest(test);
                    return test;
                };
                context.test.only = function(title, fn) {
                    var test = context.test(title, fn);
                    var reString = "^" + utils.escapeRegexp(test.fullTitle()) + "$";
                    mocha.grep(new RegExp(reString));
                };
                context.test.skip = function(title) {
                    context.test(title);
                };
            });
        };
    });
    require.register("interfaces/tdd.js", function(module, exports, require) {
        var Suite = __p.require("suite"), Test = __p.require("test"), utils = __p.require("utils");
        module.exports = function(suite) {
            var suites = [ suite ];
            suite.on("pre-require", function(context, file, mocha) {
                context.setup = function(fn) {
                    suites[0].beforeEach(fn);
                };
                context.teardown = function(fn) {
                    suites[0].afterEach(fn);
                };
                context.suiteSetup = function(fn) {
                    suites[0].beforeAll(fn);
                };
                context.suiteTeardown = function(fn) {
                    suites[0].afterAll(fn);
                };
                context.suite = function(title, fn) {
                    var suite = Suite.create(suites[0], title);
                    suites.unshift(suite);
                    fn.call(suite);
                    suites.shift();
                    return suite;
                };
                context.suite.skip = function(title, fn) {
                    var suite = Suite.create(suites[0], title);
                    suite.pending = true;
                    suites.unshift(suite);
                    fn.call(suite);
                    suites.shift();
                };
                context.suite.only = function(title, fn) {
                    var suite = context.suite(title, fn);
                    mocha.grep(suite.fullTitle());
                };
                context.test = function(title, fn) {
                    var suite = suites[0];
                    if (suite.pending) var fn = null;
                    var test = new Test(title, fn);
                    suite.addTest(test);
                    return test;
                };
                context.test.only = function(title, fn) {
                    var test = context.test(title, fn);
                    var reString = "^" + utils.escapeRegexp(test.fullTitle()) + "$";
                    mocha.grep(new RegExp(reString));
                };
                context.test.skip = function(title) {
                    context.test(title);
                };
            });
        };
    });
    require.register("mocha.js", function(module, exports, require) {
        var path = __p.require("browser/path"), utils = __p.require("lib/utils");
        exports = module.exports = Mocha;
        exports.utils = utils;
        exports.interfaces = __p.require("lib/interfaces");
        exports.reporters = __p.require("lib/reporters");
        exports.Runnable = __p.require("lib/runnable");
        exports.Context = __p.require("lib/context");
        exports.Runner = __p.require("lib/runner");
        exports.Suite = __p.require("lib/suite");
        exports.Hook = __p.require("lib/hook");
        exports.Test = __p.require("lib/test");
        function image(name) {
            return __dirname + "/../images/" + name + ".png";
        }
        function Mocha(options) {
            options = options || {};
            this.files = [];
            this.options = options;
            this.grep(options.grep);
            this.suite = new exports.Suite("", new exports.Context());
            this.ui(options.ui);
            this.bail(options.bail);
            this.reporter(options.reporter);
            if (null != options.timeout) this.timeout(options.timeout);
            this.useColors(options.useColors);
            if (options.slow) this.slow(options.slow);
        }
        Mocha.prototype.bail = function(bail) {
            if (0 == arguments.length) bail = true;
            this.suite.bail(bail);
            return this;
        };
        Mocha.prototype.addFile = function(file) {
            this.files.push(file);
            return this;
        };
        Mocha.prototype.reporter = function(reporter) {
            if ("function" == typeof reporter) {
                this._reporter = reporter;
            } else {
                reporter = reporter || "dot";
                var _reporter;
                try {
                    _reporter = __p.require("./reporters/" + reporter);
                } catch (err) {}
                if (!_reporter) try {
                    _reporter = __p.require(reporter);
                } catch (err) {}
                if (!_reporter && reporter === "teamcity") __log.warn("The Teamcity reporter was moved to a package named " + "mocha-teamcity-reporter " + "(https://npmjs.org/package/mocha-teamcity-reporter).");
                if (!_reporter) throw new Error('invalid reporter "' + reporter + '"');
                this._reporter = _reporter;
            }
            return this;
        };
        Mocha.prototype.ui = function(name) {
            name = name || "bdd";
            this._ui = exports.interfaces[name];
            if (!this._ui) try {
                this._ui = __p.require(name);
            } catch (err) {}
            if (!this._ui) throw new Error('invalid interface "' + name + '"');
            this._ui = this._ui(this.suite);
            return this;
        };
        Mocha.prototype.loadFiles = function(fn) {
            var self = this;
            var suite = this.suite;
            var pending = this.files.length;
            this.files.forEach(function(file) {
                file = path.resolve(file);
                suite.emit("pre-require", global, file, self);
                suite.emit("require", __p.require(file), file, self);
                suite.emit("post-require", global, file, self);
                --pending || fn && fn();
            });
        };
        Mocha.prototype._growl = function(runner, reporter) {
            var notify = __p.require("growl");
            runner.on("end", function() {
                var stats = reporter.stats;
                if (stats.failures) {
                    var msg = stats.failures + " of " + runner.total + " tests failed";
                    notify(msg, {
                        name: "mocha",
                        title: "Failed",
                        image: __p.file(image("error"))
                    });
                } else {
                    notify(stats.passes + " tests passed in " + stats.duration + "ms", {
                        name: "mocha",
                        title: "Passed",
                        image: __p.file(image("ok"))
                    });
                }
            });
        };
        Mocha.prototype.grep = function(re) {
            this.options.grep = "string" == typeof re ? new RegExp(utils.escapeRegexp(re)) : re;
            return this;
        };
        Mocha.prototype.invert = function() {
            this.options.invert = true;
            return this;
        };
        Mocha.prototype.ignoreLeaks = function(ignore) {
            this.options.ignoreLeaks = !!ignore;
            return this;
        };
        Mocha.prototype.checkLeaks = function() {
            this.options.ignoreLeaks = false;
            return this;
        };
        Mocha.prototype.growl = function() {
            this.options.growl = true;
            return this;
        };
        Mocha.prototype.globals = function(globals) {
            this.options.globals = (this.options.globals || []).concat(globals);
            return this;
        };
        Mocha.prototype.useColors = function(colors) {
            this.options.useColors = arguments.length && colors != undefined ? colors : true;
            return this;
        };
        Mocha.prototype.useInlineDiffs = function(inlineDiffs) {
            this.options.useInlineDiffs = arguments.length && inlineDiffs != undefined ? inlineDiffs : false;
            return this;
        };
        Mocha.prototype.timeout = function(timeout) {
            this.suite.timeout(timeout);
            return this;
        };
        Mocha.prototype.slow = function(slow) {
            this.suite.slow(slow);
            return this;
        };
        Mocha.prototype.asyncOnly = function() {
            this.options.asyncOnly = true;
            return this;
        };
        Mocha.prototype.run = function(fn) {
            if (this.files.length) this.loadFiles();
            var suite = this.suite;
            var options = this.options;
            var runner = new exports.Runner(suite);
            var reporter = new this._reporter(runner);
            runner.ignoreLeaks = false !== options.ignoreLeaks;
            runner.asyncOnly = options.asyncOnly;
            if (options.grep) runner.grep(options.grep, options.invert);
            if (options.globals) runner.globals(options.globals);
            if (options.growl) this._growl(runner, reporter);
            exports.reporters.Base.useColors = options.useColors;
            exports.reporters.Base.inlineDiffs = options.useInlineDiffs;
            return runner.run(fn);
        };
    });
    require.register("ms.js", function(module, exports, require) {
        var s = 1e3;
        var m = s * 60;
        var h = m * 60;
        var d = h * 24;
        var y = d * 365.25;
        module.exports = function(val, options) {
            options = options || {};
            if ("string" == typeof val) return parse(val);
            return options.long ? longFormat(val) : shortFormat(val);
        };
        function parse(str) {
            var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
            if (!match) return;
            var n = parseFloat(match[1]);
            var type = (match[2] || "ms").toLowerCase();
            switch (type) {
              case "years":
              case "year":
              case "y":
                return n * y;

              case "days":
              case "day":
              case "d":
                return n * d;

              case "hours":
              case "hour":
              case "h":
                return n * h;

              case "minutes":
              case "minute":
              case "m":
                return n * m;

              case "seconds":
              case "second":
              case "s":
                return n * s;

              case "ms":
                return n;
            }
        }
        function shortFormat(ms) {
            if (ms >= d) return Math.round(ms / d) + "d";
            if (ms >= h) return Math.round(ms / h) + "h";
            if (ms >= m) return Math.round(ms / m) + "m";
            if (ms >= s) return Math.round(ms / s) + "s";
            return ms + "ms";
        }
        function longFormat(ms) {
            return plural(ms, d, "day") || plural(ms, h, "hour") || plural(ms, m, "minute") || plural(ms, s, "second") || ms + " ms";
        }
        function plural(ms, n, name) {
            if (ms < n) return;
            if (ms < n * 1.5) return Math.floor(ms / n) + " " + name;
            return Math.ceil(ms / n) + " " + name + "s";
        }
    });
    require.register("reporters/base.js", function(module, exports, require) {
        var tty = __p.require("browser/tty"), diff = __p.require("browser/diff"), ms = __p.require("ms");
        var Date = global.Date, setTimeout = global.setTimeout, setInterval = global.setInterval, clearTimeout = global.clearTimeout, clearInterval = global.clearInterval;
        var isatty = tty.isatty(1) && tty.isatty(2);
        exports = module.exports = Base;
        exports.useColors = isatty || process.env.MOCHA_COLORS !== undefined;
        exports.inlineDiffs = false;
        exports.colors = {
            pass: 90,
            fail: 31,
            "bright pass": 92,
            "bright fail": 91,
            "bright yellow": 93,
            pending: 36,
            suite: 0,
            "error title": 0,
            "error message": 31,
            "error stack": 90,
            checkmark: 32,
            fast: 90,
            medium: 33,
            slow: 31,
            green: 32,
            light: 90,
            "diff gutter": 90,
            "diff added": 42,
            "diff removed": 41
        };
        exports.symbols = {
            ok: "✓",
            err: "✖",
            dot: "․"
        };
        if ("win32" == process.platform) {
            exports.symbols.ok = "√";
            exports.symbols.err = "×";
            exports.symbols.dot = ".";
        }
        var color = exports.color = function(type, str) {
            if (!exports.useColors) return str;
            return "[" + exports.colors[type] + "m" + str + "[0m";
        };
        exports.window = {
            width: isatty ? process.stdout.getWindowSize ? process.stdout.getWindowSize(1)[0] : tty.getWindowSize()[1] : 75
        };
        exports.cursor = {
            hide: function() {
                isatty && process.stdout.write("[?25l");
            },
            show: function() {
                isatty && process.stdout.write("[?25h");
            },
            deleteLine: function() {
                isatty && process.stdout.write("[2K");
            },
            beginningOfLine: function() {
                isatty && process.stdout.write("[0G");
            },
            CR: function() {
                if (isatty) {
                    exports.cursor.deleteLine();
                    exports.cursor.beginningOfLine();
                } else {
                    process.stdout.write("\n");
                }
            }
        };
        exports.list = function(failures) {
            __log.error();
            failures.forEach(function(test, i) {
                var fmt = color("error title", "  %s) %s:\n") + color("error message", "     %s") + color("error stack", "\n%s\n");
                var err = test.err, message = err.message || "", stack = err.stack || message, index = stack.indexOf(message) + message.length, msg = stack.slice(0, index), actual = err.actual, expected = err.expected, escape = true;
                if (err.uncaught) {
                    msg = "Uncaught " + msg;
                }
                if (err.showDiff && sameType(actual, expected)) {
                    escape = false;
                    err.actual = actual = stringify(actual);
                    err.expected = expected = stringify(expected);
                }
                if ("string" == typeof actual && "string" == typeof expected) {
                    fmt = color("error title", "  %s) %s:\n%s") + color("error stack", "\n%s\n");
                    var match = message.match(/^([^:]+): expected/);
                    msg = match ? "\n      " + color("error message", match[1]) : "";
                    if (exports.inlineDiffs) {
                        msg += inlineDiff(err, escape);
                    } else {
                        msg += unifiedDiff(err, escape);
                    }
                }
                stack = stack.slice(index ? index + 1 : index).replace(/^/gm, "  ");
                __log.error(fmt, i + 1, test.fullTitle(), msg, stack);
            });
        };
        function Base(runner) {
            var self = this, stats = this.stats = {
                suites: 0,
                tests: 0,
                passes: 0,
                pending: 0,
                failures: 0
            }, failures = this.failures = [];
            if (!runner) return;
            this.runner = runner;
            runner.stats = stats;
            runner.on("start", function() {
                stats.start = new Date();
            });
            runner.on("suite", function(suite) {
                stats.suites = stats.suites || 0;
                suite.root || stats.suites++;
            });
            runner.on("test end", function(test) {
                stats.tests = stats.tests || 0;
                stats.tests++;
            });
            runner.on("pass", function(test) {
                stats.passes = stats.passes || 0;
                var medium = test.slow() / 2;
                test.speed = test.duration > test.slow() ? "slow" : test.duration > medium ? "medium" : "fast";
                stats.passes++;
            });
            runner.on("fail", function(test, err) {
                stats.failures = stats.failures || 0;
                stats.failures++;
                test.err = err;
                failures.push(test);
            });
            runner.on("end", function() {
                stats.end = new Date();
                stats.duration = new Date() - stats.start;
            });
            runner.on("pending", function() {
                stats.pending++;
            });
        }
        Base.prototype.epilogue = function() {
            var stats = this.stats;
            var tests;
            var fmt;
            __log.log("info");
            fmt = color("bright pass", " ") + color("green", " %d passing") + color("light", " (%s)");
            __log.log("info", fmt, stats.passes || 0, ms(stats.duration));
            if (stats.pending) {
                fmt = color("pending", " ") + color("pending", " %d pending");
                __log.log("info", fmt, stats.pending);
            }
            if (stats.failures) {
                fmt = color("fail", "  %d failing");
                __log.error(fmt, stats.failures);
                Base.list(this.failures);
                __log.error();
            }
            __log.log("info");
        };
        function pad(str, len) {
            str = String(str);
            return Array(len - str.length + 1).join(" ") + str;
        }
        function inlineDiff(err, escape) {
            var msg = errorDiff(err, "WordsWithSpace", escape);
            var lines = msg.split("\n");
            if (lines.length > 4) {
                var width = String(lines.length).length;
                msg = lines.map(function(str, i) {
                    return pad(++i, width) + " |" + " " + str;
                }).join("\n");
            }
            msg = "\n" + color("diff removed", "actual") + " " + color("diff added", "expected") + "\n\n" + msg + "\n";
            msg = msg.replace(/^/gm, "      ");
            return msg;
        }
        function unifiedDiff(err, escape) {
            var indent = "      ";
            function cleanUp(line) {
                if (escape) {
                    line = escapeInvisibles(line);
                }
                if (line[0] === "+") return indent + colorLines("diff added", line);
                if (line[0] === "-") return indent + colorLines("diff removed", line);
                if (line.match(/\@\@/)) return null;
                if (line.match(/\\ No newline/)) return null; else return indent + line;
            }
            function notBlank(line) {
                return line != null;
            }
            msg = diff.createPatch("string", err.actual, err.expected);
            var lines = msg.split("\n").splice(4);
            return "\n      " + colorLines("diff added", "+ expected") + " " + colorLines("diff removed", "- actual") + "\n\n" + lines.map(cleanUp).filter(notBlank).join("\n");
        }
        function errorDiff(err, type, escape) {
            var actual = escape ? escapeInvisibles(err.actual) : err.actual;
            var expected = escape ? escapeInvisibles(err.expected) : err.expected;
            return diff["diff" + type](actual, expected).map(function(str) {
                if (str.added) return colorLines("diff added", str.value);
                if (str.removed) return colorLines("diff removed", str.value);
                return str.value;
            }).join("");
        }
        function escapeInvisibles(line) {
            return line.replace(/\t/g, "<tab>").replace(/\r/g, "<CR>").replace(/\n/g, "<LF>\n");
        }
        function colorLines(name, str) {
            return str.split("\n").map(function(str) {
                return color(name, str);
            }).join("\n");
        }
        function stringify(obj) {
            if (obj instanceof RegExp) return obj.toString();
            return JSON.stringify(obj, null, 2);
        }
        function sameType(a, b) {
            a = Object.prototype.toString.call(a);
            b = Object.prototype.toString.call(b);
            return a == b;
        }
    });
    require.register("reporters/doc.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), utils = __p.require("utils");
        exports = module.exports = Doc;
        function Doc(runner) {
            Base.call(this, runner);
            var self = this, stats = this.stats, total = runner.total, indents = 2;
            function indent() {
                return Array(indents).join("  ");
            }
            runner.on("suite", function(suite) {
                if (suite.root) return;
                ++indents;
                __log.log("info", '%s<section class="suite">', indent());
                ++indents;
                __log.log("info", "%s<h1>%s</h1>", indent(), utils.escape(suite.title));
                __log.log("info", "%s<dl>", indent());
            });
            runner.on("suite end", function(suite) {
                if (suite.root) return;
                __log.log("info", "%s</dl>", indent());
                --indents;
                __log.log("info", "%s</section>", indent());
                --indents;
            });
            runner.on("pass", function(test) {
                __log.log("info", "%s  <dt>%s</dt>", indent(), utils.escape(test.title));
                var code = utils.escape(utils.clean(test.fn.toString()));
                __log.log("info", "%s  <dd><pre><code>%s</code></pre></dd>", indent(), code);
            });
        }
    });
    require.register("reporters/dot.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), color = Base.color;
        exports = module.exports = Dot;
        function Dot(runner) {
            Base.call(this, runner);
            var self = this, stats = this.stats, width = Base.window.width * .75 | 0, n = 0;
            runner.on("start", function() {
                process.stdout.write("\n  ");
            });
            runner.on("pending", function(test) {
                process.stdout.write(color("pending", Base.symbols.dot));
            });
            runner.on("pass", function(test) {
                if (++n % width == 0) process.stdout.write("\n  ");
                if ("slow" == test.speed) {
                    process.stdout.write(color("bright yellow", Base.symbols.dot));
                } else {
                    process.stdout.write(color(test.speed, Base.symbols.dot));
                }
            });
            runner.on("fail", function(test, err) {
                if (++n % width == 0) process.stdout.write("\n  ");
                process.stdout.write(color("fail", Base.symbols.dot));
            });
            runner.on("end", function() {
                __log.log("info");
                self.epilogue();
            });
        }
        function F() {}
        F.prototype = Base.prototype;
        Dot.prototype = new F();
        Dot.prototype.constructor = Dot;
    });
    require.register("reporters/html-cov.js", function(module, exports, require) {
        var JSONCov = __p.require("lib/json-cov"), fs = __p.require("browser/fs");
        exports = module.exports = HTMLCov;
        function HTMLCov(runner) {
            var jade = __p.require("jade"), file = __dirname + "/templates/coverage.jade", str = fs.readFileSync(file, "utf8"), fn = jade.compile(str, {
                filename: file
            }), self = this;
            JSONCov.call(this, runner, false);
            runner.on("end", function() {
                process.stdout.write(fn({
                    cov: self.cov,
                    coverageClass: coverageClass
                }));
            });
        }
        function coverageClass(n) {
            if (n >= 75) return "high";
            if (n >= 50) return "medium";
            if (n >= 25) return "low";
            return "terrible";
        }
    });
    require.register("reporters/html.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), utils = __p.require("utils"), Progress = __p.require("browser/progress"), escape = utils.escape;
        var Date = global.Date, setTimeout = global.setTimeout, setInterval = global.setInterval, clearTimeout = global.clearTimeout, clearInterval = global.clearInterval;
        exports = module.exports = HTML;
        var statsTemplate = '<ul id="mocha-stats">' + '<li class="progress"><canvas width="40" height="40"></canvas></li>' + '<li class="passes"><a href="#">passes:</a> <em>0</em></li>' + '<li class="failures"><a href="#">failures:</a> <em>0</em></li>' + '<li class="duration">duration: <em>0</em>s</li>' + "</ul>";
        function HTML(runner, root) {
            Base.call(this, runner);
            var self = this, stats = this.stats, total = runner.total, stat = fragment(statsTemplate), items = stat.getElementsByTagName("li"), passes = items[1].getElementsByTagName("em")[0], passesLink = items[1].getElementsByTagName("a")[0], failures = items[2].getElementsByTagName("em")[0], failuresLink = items[2].getElementsByTagName("a")[0], duration = items[3].getElementsByTagName("em")[0], canvas = stat.getElementsByTagName("canvas")[0], report = fragment('<ul id="mocha-report"></ul>'), stack = [ report ], progress, ctx;
            root = root || document.getElementById("mocha");
            if (canvas.getContext) {
                var ratio = window.devicePixelRatio || 1;
                canvas.style.width = canvas.width;
                canvas.style.height = canvas.height;
                canvas.width *= ratio;
                canvas.height *= ratio;
                ctx = canvas.getContext("2d");
                ctx.scale(ratio, ratio);
                progress = new Progress();
            }
            if (!root) return error("#mocha div missing, add it to your document");
            on(passesLink, "click", function() {
                unhide();
                var name = /pass/.test(report.className) ? "" : " pass";
                report.className = report.className.replace(/fail|pass/g, "") + name;
                if (report.className.trim()) hideSuitesWithout("test pass");
            });
            on(failuresLink, "click", function() {
                unhide();
                var name = /fail/.test(report.className) ? "" : " fail";
                report.className = report.className.replace(/fail|pass/g, "") + name;
                if (report.className.trim()) hideSuitesWithout("test fail");
            });
            root.appendChild(stat);
            root.appendChild(report);
            if (progress) progress.size(40);
            runner.on("suite", function(suite) {
                if (suite.root) return;
                var url = self.suiteURL(suite);
                var el = fragment('<li class="suite"><h1><a href="%s">%s</a></h1></li>', url, escape(suite.title));
                stack[0].appendChild(el);
                stack.unshift(document.createElement("ul"));
                el.appendChild(stack[0]);
            });
            runner.on("suite end", function(suite) {
                if (suite.root) return;
                stack.shift();
            });
            runner.on("fail", function(test, err) {
                if ("hook" == test.type) runner.emit("test end", test);
            });
            runner.on("test end", function(test) {
                var percent = stats.tests / this.total * 100 | 0;
                if (progress) progress.update(percent).draw(ctx);
                var ms = new Date() - stats.start;
                text(passes, stats.passes);
                text(failures, stats.failures);
                text(duration, (ms / 1e3).toFixed(2));
                if ("passed" == test.state) {
                    var url = self.testURL(test);
                    var el = fragment('<li class="test pass %e"><h2>%e<span class="duration">%ems</span> <a href="%s" class="replay">‣</a></h2></li>', test.speed, test.title, test.duration, url);
                } else if (test.pending) {
                    var el = fragment('<li class="test pass pending"><h2>%e</h2></li>', test.title);
                } else {
                    var el = fragment('<li class="test fail"><h2>%e <a href="?grep=%e" class="replay">‣</a></h2></li>', test.title, encodeURIComponent(test.fullTitle()));
                    var str = test.err.stack || test.err.toString();
                    if (!~str.indexOf(test.err.message)) {
                        str = test.err.message + "\n" + str;
                    }
                    if ("[object Error]" == str) str = test.err.message;
                    if (!test.err.stack && test.err.sourceURL && test.err.line !== undefined) {
                        str += "\n(" + test.err.sourceURL + ":" + test.err.line + ")";
                    }
                    el.appendChild(fragment('<pre class="error">%e</pre>', str));
                }
                if (!test.pending) {
                    var h2 = el.getElementsByTagName("h2")[0];
                    on(h2, "click", function() {
                        pre.style.display = "none" == pre.style.display ? "block" : "none";
                    });
                    var pre = fragment("<pre><code>%e</code></pre>", utils.clean(test.fn.toString()));
                    el.appendChild(pre);
                    pre.style.display = "none";
                }
                if (stack[0]) stack[0].appendChild(el);
            });
        }
        HTML.prototype.suiteURL = function(suite) {
            return "?grep=" + encodeURIComponent(suite.fullTitle());
        };
        HTML.prototype.testURL = function(test) {
            return "?grep=" + encodeURIComponent(test.fullTitle());
        };
        function error(msg) {
            document.body.appendChild(fragment('<div id="mocha-error">%s</div>', msg));
        }
        function fragment(html) {
            var args = arguments, div = document.createElement("div"), i = 1;
            div.innerHTML = html.replace(/%([se])/g, function(_, type) {
                switch (type) {
                  case "s":
                    return String(args[i++]);

                  case "e":
                    return escape(args[i++]);
                }
            });
            return div.firstChild;
        }
        function hideSuitesWithout(classname) {
            var suites = document.getElementsByClassName("suite");
            for (var i = 0; i < suites.length; i++) {
                var els = suites[i].getElementsByClassName(classname);
                if (0 == els.length) suites[i].className += " hidden";
            }
        }
        function unhide() {
            var els = document.getElementsByClassName("suite hidden");
            for (var i = 0; i < els.length; ++i) {
                els[i].className = els[i].className.replace("suite hidden", "suite");
            }
        }
        function text(el, str) {
            if (el.textContent) {
                el.textContent = str;
            } else {
                el.innerText = str;
            }
        }
        function on(el, event, fn) {
            if (el.addEventListener) {
                el.addEventListener(event, fn, false);
            } else {
                el.attachEvent("on" + event, fn);
            }
        }
    });
    require.register("reporters/index.js", function(module, exports, require) {
        exports.Base = __p.require("lib/base");
        exports.Dot = __p.require("lib/dot");
        exports.Doc = __p.require("lib/doc");
        exports.TAP = __p.require("lib/tap");
        exports.JSON = __p.require("lib/json");
        exports.HTML = __p.require("lib/html");
        exports.List = __p.require("lib/list");
        exports.Min = __p.require("lib/min");
        exports.Spec = __p.require("lib/spec");
        exports.Nyan = __p.require("lib/nyan");
        exports.XUnit = __p.require("lib/xunit");
        exports.Markdown = __p.require("lib/markdown");
        exports.Progress = __p.require("lib/progress");
        exports.Landing = __p.require("lib/landing");
        exports.JSONCov = __p.require("lib/json-cov");
        exports.HTMLCov = __p.require("lib/html-cov");
        exports.JSONStream = __p.require("lib/json-stream");
    });
    require.register("reporters/json-cov.js", function(module, exports, require) {
        var Base = __p.require("lib/base");
        exports = module.exports = JSONCov;
        function JSONCov(runner, output) {
            var self = this, output = 1 == arguments.length ? true : output;
            Base.call(this, runner);
            var tests = [], failures = [], passes = [];
            runner.on("test end", function(test) {
                tests.push(test);
            });
            runner.on("pass", function(test) {
                passes.push(test);
            });
            runner.on("fail", function(test) {
                failures.push(test);
            });
            runner.on("end", function() {
                var cov = global._$jscoverage || {};
                var result = self.cov = map(cov);
                result.stats = self.stats;
                result.tests = tests.map(clean);
                result.failures = failures.map(clean);
                result.passes = passes.map(clean);
                if (!output) return;
                process.stdout.write(JSON.stringify(result, null, 2));
            });
        }
        function map(cov) {
            var ret = {
                instrumentation: "node-jscoverage",
                sloc: 0,
                hits: 0,
                misses: 0,
                coverage: 0,
                files: []
            };
            for (var filename in cov) {
                var data = coverage(filename, cov[filename]);
                ret.files.push(data);
                ret.hits += data.hits;
                ret.misses += data.misses;
                ret.sloc += data.sloc;
            }
            ret.files.sort(function(a, b) {
                return a.filename.localeCompare(b.filename);
            });
            if (ret.sloc > 0) {
                ret.coverage = ret.hits / ret.sloc * 100;
            }
            return ret;
        }
        function coverage(filename, data) {
            var ret = {
                filename: filename,
                coverage: 0,
                hits: 0,
                misses: 0,
                sloc: 0,
                source: {}
            };
            data.source.forEach(function(line, num) {
                num++;
                if (data[num] === 0) {
                    ret.misses++;
                    ret.sloc++;
                } else if (data[num] !== undefined) {
                    ret.hits++;
                    ret.sloc++;
                }
                ret.source[num] = {
                    source: line,
                    coverage: data[num] === undefined ? "" : data[num]
                };
            });
            ret.coverage = ret.hits / ret.sloc * 100;
            return ret;
        }
        function clean(test) {
            return {
                title: test.title,
                fullTitle: test.fullTitle(),
                duration: test.duration
            };
        }
    });
    require.register("reporters/json-stream.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), color = Base.color;
        exports = module.exports = List;
        function List(runner) {
            Base.call(this, runner);
            var self = this, stats = this.stats, total = runner.total;
            runner.on("start", function() {
                __log.log("info", JSON.stringify([ "start", {
                    total: total
                } ]));
            });
            runner.on("pass", function(test) {
                __log.log("info", JSON.stringify([ "pass", clean(test) ]));
            });
            runner.on("fail", function(test, err) {
                __log.log("info", JSON.stringify([ "fail", clean(test) ]));
            });
            runner.on("end", function() {
                process.stdout.write(JSON.stringify([ "end", self.stats ]));
            });
        }
        function clean(test) {
            return {
                title: test.title,
                fullTitle: test.fullTitle(),
                duration: test.duration
            };
        }
    });
    require.register("reporters/json.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), cursor = Base.cursor, color = Base.color;
        exports = module.exports = JSONReporter;
        function JSONReporter(runner) {
            var self = this;
            Base.call(this, runner);
            var tests = [], failures = [], passes = [];
            runner.on("test end", function(test) {
                tests.push(test);
            });
            runner.on("pass", function(test) {
                passes.push(test);
            });
            runner.on("fail", function(test) {
                failures.push(test);
            });
            runner.on("end", function() {
                var obj = {
                    stats: self.stats,
                    tests: tests.map(clean),
                    failures: failures.map(clean),
                    passes: passes.map(clean)
                };
                process.stdout.write(JSON.stringify(obj, null, 2));
            });
        }
        function clean(test) {
            return {
                title: test.title,
                fullTitle: test.fullTitle(),
                duration: test.duration
            };
        }
    });
    require.register("reporters/landing.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), cursor = Base.cursor, color = Base.color;
        exports = module.exports = Landing;
        Base.colors.plane = 0;
        Base.colors["plane crash"] = 31;
        Base.colors.runway = 90;
        function Landing(runner) {
            Base.call(this, runner);
            var self = this, stats = this.stats, width = Base.window.width * .75 | 0, total = runner.total, stream = process.stdout, plane = color("plane", "✈"), crashed = -1, n = 0;
            function runway() {
                var buf = Array(width).join("-");
                return "  " + color("runway", buf);
            }
            runner.on("start", function() {
                stream.write("\n  ");
                cursor.hide();
            });
            runner.on("test end", function(test) {
                var col = -1 == crashed ? width * ++n / total | 0 : crashed;
                if ("failed" == test.state) {
                    plane = color("plane crash", "✈");
                    crashed = col;
                }
                stream.write("[4F\n\n");
                stream.write(runway());
                stream.write("\n  ");
                stream.write(color("runway", Array(col).join("⋅")));
                stream.write(plane);
                stream.write(color("runway", Array(width - col).join("⋅") + "\n"));
                stream.write(runway());
                stream.write("[0m");
            });
            runner.on("end", function() {
                cursor.show();
                __log.log("info");
                self.epilogue();
            });
        }
        function F() {}
        F.prototype = Base.prototype;
        Landing.prototype = new F();
        Landing.prototype.constructor = Landing;
    });
    require.register("reporters/list.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), cursor = Base.cursor, color = Base.color;
        exports = module.exports = List;
        function List(runner) {
            Base.call(this, runner);
            var self = this, stats = this.stats, n = 0;
            runner.on("start", function() {
                __log.log("info");
            });
            runner.on("test", function(test) {
                process.stdout.write(color("pass", "    " + test.fullTitle() + ": "));
            });
            runner.on("pending", function(test) {
                var fmt = color("checkmark", "  -") + color("pending", " %s");
                __log.log("info", fmt, test.fullTitle());
            });
            runner.on("pass", function(test) {
                var fmt = color("checkmark", "  " + Base.symbols.dot) + color("pass", " %s: ") + color(test.speed, "%dms");
                cursor.CR();
                __log.log("info", fmt, test.fullTitle(), test.duration);
            });
            runner.on("fail", function(test, err) {
                cursor.CR();
                __log.log("info", color("fail", "  %d) %s"), ++n, test.fullTitle());
            });
            runner.on("end", self.epilogue.bind(self));
        }
        function F() {}
        F.prototype = Base.prototype;
        List.prototype = new F();
        List.prototype.constructor = List;
    });
    require.register("reporters/markdown.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), utils = __p.require("utils");
        exports = module.exports = Markdown;
        function Markdown(runner) {
            Base.call(this, runner);
            var self = this, stats = this.stats, level = 0, buf = "";
            function title(str) {
                return Array(level).join("#") + " " + str;
            }
            function indent() {
                return Array(level).join("  ");
            }
            function mapTOC(suite, obj) {
                var ret = obj;
                obj = obj[suite.title] = obj[suite.title] || {
                    suite: suite
                };
                suite.suites.forEach(function(suite) {
                    mapTOC(suite, obj);
                });
                return ret;
            }
            function stringifyTOC(obj, level) {
                ++level;
                var buf = "";
                var link;
                for (var key in obj) {
                    if ("suite" == key) continue;
                    if (key) link = " - [" + key + "](#" + utils.slug(obj[key].suite.fullTitle()) + ")\n";
                    if (key) buf += Array(level).join("  ") + link;
                    buf += stringifyTOC(obj[key], level);
                }
                --level;
                return buf;
            }
            function generateTOC(suite) {
                var obj = mapTOC(suite, {});
                return stringifyTOC(obj, 0);
            }
            generateTOC(runner.suite);
            runner.on("suite", function(suite) {
                ++level;
                var slug = utils.slug(suite.fullTitle());
                buf += '<a name="' + slug + '"></a>' + "\n";
                buf += title(suite.title) + "\n";
            });
            runner.on("suite end", function(suite) {
                --level;
            });
            runner.on("pass", function(test) {
                var code = utils.clean(test.fn.toString());
                buf += test.title + ".\n";
                buf += "\n```js\n";
                buf += code + "\n";
                buf += "```\n\n";
            });
            runner.on("end", function() {
                process.stdout.write("# TOC\n");
                process.stdout.write(generateTOC(runner.suite));
                process.stdout.write(buf);
            });
        }
    });
    require.register("reporters/min.js", function(module, exports, require) {
        var Base = __p.require("lib/base");
        exports = module.exports = Min;
        function Min(runner) {
            Base.call(this, runner);
            runner.on("start", function() {
                process.stdout.write("[2J");
                process.stdout.write("[1;3H");
            });
            runner.on("end", this.epilogue.bind(this));
        }
        function F() {}
        F.prototype = Base.prototype;
        Min.prototype = new F();
        Min.prototype.constructor = Min;
    });
    require.register("reporters/nyan.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), color = Base.color;
        exports = module.exports = NyanCat;
        function NyanCat(runner) {
            Base.call(this, runner);
            var self = this, stats = this.stats, width = Base.window.width * .75 | 0, rainbowColors = this.rainbowColors = self.generateColors(), colorIndex = this.colorIndex = 0, numerOfLines = this.numberOfLines = 4, trajectories = this.trajectories = [ [], [], [], [] ], nyanCatWidth = this.nyanCatWidth = 11, trajectoryWidthMax = this.trajectoryWidthMax = width - nyanCatWidth, scoreboardWidth = this.scoreboardWidth = 5, tick = this.tick = 0, n = 0;
            runner.on("start", function() {
                Base.cursor.hide();
                self.draw();
            });
            runner.on("pending", function(test) {
                self.draw();
            });
            runner.on("pass", function(test) {
                self.draw();
            });
            runner.on("fail", function(test, err) {
                self.draw();
            });
            runner.on("end", function() {
                Base.cursor.show();
                for (var i = 0; i < self.numberOfLines; i++) write("\n");
                self.epilogue();
            });
        }
        NyanCat.prototype.draw = function() {
            this.appendRainbow();
            this.drawScoreboard();
            this.drawRainbow();
            this.drawNyanCat();
            this.tick = !this.tick;
        };
        NyanCat.prototype.drawScoreboard = function() {
            var stats = this.stats;
            var colors = Base.colors;
            function draw(color, n) {
                write(" ");
                write("[" + color + "m" + n + "[0m");
                write("\n");
            }
            draw(colors.green, stats.passes);
            draw(colors.fail, stats.failures);
            draw(colors.pending, stats.pending);
            write("\n");
            this.cursorUp(this.numberOfLines);
        };
        NyanCat.prototype.appendRainbow = function() {
            var segment = this.tick ? "_" : "-";
            var rainbowified = this.rainbowify(segment);
            for (var index = 0; index < this.numberOfLines; index++) {
                var trajectory = this.trajectories[index];
                if (trajectory.length >= this.trajectoryWidthMax) trajectory.shift();
                trajectory.push(rainbowified);
            }
        };
        NyanCat.prototype.drawRainbow = function() {
            var self = this;
            this.trajectories.forEach(function(line, index) {
                write("[" + self.scoreboardWidth + "C");
                write(line.join(""));
                write("\n");
            });
            this.cursorUp(this.numberOfLines);
        };
        NyanCat.prototype.drawNyanCat = function() {
            var self = this;
            var startWidth = this.scoreboardWidth + this.trajectories[0].length;
            var color = "[" + startWidth + "C";
            var padding = "";
            write(color);
            write("_,------,");
            write("\n");
            write(color);
            padding = self.tick ? "  " : "   ";
            write("_|" + padding + "/\\_/\\ ");
            write("\n");
            write(color);
            padding = self.tick ? "_" : "__";
            var tail = self.tick ? "~" : "^";
            var face;
            write(tail + "|" + padding + this.face() + " ");
            write("\n");
            write(color);
            padding = self.tick ? " " : "  ";
            write(padding + '""  "" ');
            write("\n");
            this.cursorUp(this.numberOfLines);
        };
        NyanCat.prototype.face = function() {
            var stats = this.stats;
            if (stats.failures) {
                return "( x .x)";
            } else if (stats.pending) {
                return "( o .o)";
            } else if (stats.passes) {
                return "( ^ .^)";
            } else {
                return "( - .-)";
            }
        };
        NyanCat.prototype.cursorUp = function(n) {
            write("[" + n + "A");
        };
        NyanCat.prototype.cursorDown = function(n) {
            write("[" + n + "B");
        };
        NyanCat.prototype.generateColors = function() {
            var colors = [];
            for (var i = 0; i < 6 * 7; i++) {
                var pi3 = Math.floor(Math.PI / 3);
                var n = i * (1 / 6);
                var r = Math.floor(3 * Math.sin(n) + 3);
                var g = Math.floor(3 * Math.sin(n + 2 * pi3) + 3);
                var b = Math.floor(3 * Math.sin(n + 4 * pi3) + 3);
                colors.push(36 * r + 6 * g + b + 16);
            }
            return colors;
        };
        NyanCat.prototype.rainbowify = function(str) {
            var color = this.rainbowColors[this.colorIndex % this.rainbowColors.length];
            this.colorIndex += 1;
            return "[38;5;" + color + "m" + str + "[0m";
        };
        function write(string) {
            process.stdout.write(string);
        }
        function F() {}
        F.prototype = Base.prototype;
        NyanCat.prototype = new F();
        NyanCat.prototype.constructor = NyanCat;
    });
    require.register("reporters/progress.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), cursor = Base.cursor, color = Base.color;
        exports = module.exports = Progress;
        Base.colors.progress = 90;
        function Progress(runner, options) {
            Base.call(this, runner);
            var self = this, options = options || {}, stats = this.stats, width = Base.window.width * .5 | 0, total = runner.total, complete = 0, max = Math.max;
            options.open = options.open || "[";
            options.complete = options.complete || "▬";
            options.incomplete = options.incomplete || Base.symbols.dot;
            options.close = options.close || "]";
            options.verbose = false;
            runner.on("start", function() {
                __log.log("info");
                cursor.hide();
            });
            runner.on("test end", function() {
                complete++;
                var incomplete = total - complete, percent = complete / total, n = width * percent | 0, i = width - n;
                cursor.CR();
                process.stdout.write("[J");
                process.stdout.write(color("progress", "  " + options.open));
                process.stdout.write(Array(n).join(options.complete));
                process.stdout.write(Array(i).join(options.incomplete));
                process.stdout.write(color("progress", options.close));
                if (options.verbose) {
                    process.stdout.write(color("progress", " " + complete + " of " + total));
                }
            });
            runner.on("end", function() {
                cursor.show();
                __log.log("info");
                self.epilogue();
            });
        }
        function F() {}
        F.prototype = Base.prototype;
        Progress.prototype = new F();
        Progress.prototype.constructor = Progress;
    });
    require.register("reporters/spec.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), cursor = Base.cursor, color = Base.color;
        exports = module.exports = Spec;
        function Spec(runner) {
            Base.call(this, runner);
            var self = this, stats = this.stats, indents = 0, n = 0;
            function indent() {
                return Array(indents).join("  ");
            }
            runner.on("start", function() {
                __log.log("info");
            });
            runner.on("suite", function(suite) {
                ++indents;
                __log.log("info", color("suite", "%s%s"), indent(), suite.title);
            });
            runner.on("suite end", function(suite) {
                --indents;
                if (1 == indents) __log.log("info");
            });
            runner.on("pending", function(test) {
                var fmt = indent() + color("pending", "  - %s");
                __log.log("info", fmt, test.title);
            });
            runner.on("pass", function(test) {
                if ("fast" == test.speed) {
                    var fmt = indent() + color("checkmark", "  " + Base.symbols.ok) + color("pass", " %s ");
                    cursor.CR();
                    __log.log("info", fmt, test.title);
                } else {
                    var fmt = indent() + color("checkmark", "  " + Base.symbols.ok) + color("pass", " %s ") + color(test.speed, "(%dms)");
                    cursor.CR();
                    __log.log("info", fmt, test.title, test.duration);
                }
            });
            runner.on("fail", function(test, err) {
                cursor.CR();
                __log.log("info", indent() + color("fail", "  %d) %s"), ++n, test.title);
            });
            runner.on("end", self.epilogue.bind(self));
        }
        function F() {}
        F.prototype = Base.prototype;
        Spec.prototype = new F();
        Spec.prototype.constructor = Spec;
    });
    require.register("reporters/tap.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), cursor = Base.cursor, color = Base.color;
        exports = module.exports = TAP;
        function TAP(runner) {
            Base.call(this, runner);
            var self = this, stats = this.stats, n = 1, passes = 0, failures = 0;
            runner.on("start", function() {
                var total = runner.grepTotal(runner.suite);
                __log.log("info", "%d..%d", 1, total);
            });
            runner.on("test end", function() {
                ++n;
            });
            runner.on("pending", function(test) {
                __log.log("info", "ok %d %s # SKIP -", n, title(test));
            });
            runner.on("pass", function(test) {
                passes++;
                __log.log("info", "ok %d %s", n, title(test));
            });
            runner.on("fail", function(test, err) {
                failures++;
                __log.log("info", "not ok %d %s", n, title(test));
                if (err.stack) __log.log("info", err.stack.replace(/^/gm, "  "));
            });
            runner.on("end", function() {
                __log.log("info", "# tests " + (passes + failures));
                __log.log("info", "# pass " + passes);
                __log.log("info", "# fail " + failures);
            });
        }
        function title(test) {
            return test.fullTitle().replace(/#/g, "");
        }
    });
    require.register("reporters/xunit.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), utils = __p.require("utils"), escape = utils.escape;
        var Date = global.Date, setTimeout = global.setTimeout, setInterval = global.setInterval, clearTimeout = global.clearTimeout, clearInterval = global.clearInterval;
        exports = module.exports = XUnit;
        function XUnit(runner) {
            Base.call(this, runner);
            var stats = this.stats, tests = [], self = this;
            runner.on("pending", function(test) {
                tests.push(test);
            });
            runner.on("pass", function(test) {
                tests.push(test);
            });
            runner.on("fail", function(test) {
                tests.push(test);
            });
            runner.on("end", function() {
                process.stdout.write(tag("testsuite", {
                    name: "Mocha Tests",
                    tests: stats.tests,
                    failures: stats.failures,
                    errors: stats.failures,
                    skipped: stats.tests - stats.failures - stats.passes,
                    timestamp: new Date().toUTCString(),
                    time: stats.duration / 1e3 || 0
                }, false));
                tests.forEach(test);
                process.stdout.write("</testsuite>");
            });
        }
        function F() {}
        F.prototype = Base.prototype;
        XUnit.prototype = new F();
        XUnit.prototype.constructor = XUnit;
        function test(test) {
            var attrs = {
                classname: test.parent.fullTitle(),
                name: test.title,
                time: test.duration / 1e3 || 0
            };
            if ("failed" == test.state) {
                var err = test.err;
                attrs.message = escape(err.message);
                process.stdout.write(tag("testcase", attrs, false, tag("failure", attrs, false, cdata(err.stack))));
            } else if (test.pending) {
                process.stdout.write(tag("testcase", attrs, false, tag("skipped", {}, true)));
            } else {
                process.stdout.write(tag("testcase", attrs, true));
            }
        }
        function tag(name, attrs, close, content) {
            var end = close ? "/>" : ">", pairs = [], tag;
            for (var key in attrs) {
                pairs.push(key + '="' + escape(attrs[key]) + '"');
            }
            tag = "<" + name + (pairs.length ? " " + pairs.join(" ") : "") + end;
            if (content) tag += content + "</" + name + end;
            return tag;
        }
        function cdata(str) {
            return "<![CDATA[" + escape(str) + "]]>";
        }
    });
    require.register("runnable.js", function(module, exports, require) {
        var EventEmitter = __p.require("browser/events").EventEmitter, debug = __p.require("browser/debug")("mocha:runnable"), milliseconds = __p.require("lib/ms");
        var Date = global.Date, setTimeout = global.setTimeout, setInterval = global.setInterval, clearTimeout = global.clearTimeout, clearInterval = global.clearInterval;
        var toString = Object.prototype.toString;
        module.exports = Runnable;
        function Runnable(title, fn) {
            this.title = title;
            this.fn = fn;
            this.async = fn && fn.length;
            this.sync = !this.async;
            this._timeout = 2e3;
            this._slow = 75;
            this.timedOut = false;
        }
        function F() {}
        F.prototype = EventEmitter.prototype;
        Runnable.prototype = new F();
        Runnable.prototype.constructor = Runnable;
        Runnable.prototype.timeout = function(ms) {
            if (0 == arguments.length) return this._timeout;
            if ("string" == typeof ms) ms = milliseconds(ms);
            debug("timeout %d", ms);
            this._timeout = ms;
            if (this.timer) this.resetTimeout();
            return this;
        };
        Runnable.prototype.slow = function(ms) {
            if (0 === arguments.length) return this._slow;
            if ("string" == typeof ms) ms = milliseconds(ms);
            debug("timeout %d", ms);
            this._slow = ms;
            return this;
        };
        Runnable.prototype.fullTitle = function() {
            return this.parent.fullTitle() + " " + this.title;
        };
        Runnable.prototype.clearTimeout = function() {
            clearTimeout(this.timer);
        };
        Runnable.prototype.inspect = function() {
            return JSON.stringify(this, function(key, val) {
                if ("_" == key[0]) return;
                if ("parent" == key) return "#<Suite>";
                if ("ctx" == key) return "#<Context>";
                return val;
            }, 2);
        };
        Runnable.prototype.resetTimeout = function() {
            var self = this;
            var ms = this.timeout() || 1e9;
            this.clearTimeout();
            this.timer = setTimeout(function() {
                self.callback(new Error("timeout of " + ms + "ms exceeded"));
                self.timedOut = true;
            }, ms);
        };
        Runnable.prototype.globals = function(arr) {
            var self = this;
            this._allowedGlobals = arr;
        };
        Runnable.prototype.run = function(fn) {
            var self = this, ms = this.timeout(), start = new Date(), ctx = this.ctx, finished, emitted;
            if (ctx) ctx.runnable(this);
            if (this.async) {
                if (ms) {
                    this.timer = setTimeout(function() {
                        done(new Error("timeout of " + ms + "ms exceeded"));
                        self.timedOut = true;
                    }, ms);
                }
            }
            function multiple(err) {
                if (emitted) return;
                emitted = true;
                self.emit("error", err || new Error("done() called multiple times"));
            }
            function done(err) {
                if (self.timedOut) return;
                if (finished) return multiple(err);
                self.clearTimeout();
                self.duration = new Date() - start;
                finished = true;
                fn(err);
            }
            this.callback = done;
            if (this.async) {
                try {
                    this.fn.call(ctx, function(err) {
                        if (err instanceof Error || toString.call(err) === "[object Error]") return done(err);
                        if (null != err) return done(new Error("done() invoked with non-Error: " + err));
                        done();
                    });
                } catch (err) {
                    done(err);
                }
                return;
            }
            if (this.asyncOnly) {
                return done(new Error("--async-only option in use without declaring `done()`"));
            }
            try {
                if (!this.pending) this.fn.call(ctx);
                this.duration = new Date() - start;
                fn();
            } catch (err) {
                fn(err);
            }
        };
    });
    require.register("runner.js", function(module, exports, require) {
        var EventEmitter = __p.require("browser/events").EventEmitter, debug = __p.require("browser/debug")("mocha:runner"), Test = __p.require("lib/test"), utils = __p.require("lib/utils"), filter = utils.filter, keys = utils.keys;
        var globals = [ "setTimeout", "clearTimeout", "setInterval", "clearInterval", "XMLHttpRequest", "Date" ];
        module.exports = Runner;
        function Runner(suite) {
            var self = this;
            this._globals = [];
            this._abort = false;
            this.suite = suite;
            this.total = suite.total();
            this.failures = 0;
            this.on("test end", function(test) {
                self.checkGlobals(test);
            });
            this.on("hook end", function(hook) {
                self.checkGlobals(hook);
            });
            this.grep(/.*/);
            this.globals(this.globalProps().concat([ "errno" ]));
        }
        Runner.immediately = global.setImmediate || process.nextTick;
        function F() {}
        F.prototype = EventEmitter.prototype;
        Runner.prototype = new F();
        Runner.prototype.constructor = Runner;
        Runner.prototype.grep = function(re, invert) {
            debug("grep %s", re);
            this._grep = re;
            this._invert = invert;
            this.total = this.grepTotal(this.suite);
            return this;
        };
        Runner.prototype.grepTotal = function(suite) {
            var self = this;
            var total = 0;
            suite.eachTest(function(test) {
                var match = self._grep.test(test.fullTitle());
                if (self._invert) match = !match;
                if (match) total++;
            });
            return total;
        };
        Runner.prototype.globalProps = function() {
            var props = utils.keys(global);
            for (var i = 0; i < globals.length; ++i) {
                if (~utils.indexOf(props, globals[i])) continue;
                props.push(globals[i]);
            }
            return props;
        };
        Runner.prototype.globals = function(arr) {
            if (0 == arguments.length) return this._globals;
            debug("globals %j", arr);
            this._globals = this._globals.concat(arr);
            return this;
        };
        Runner.prototype.checkGlobals = function(test) {
            if (this.ignoreLeaks) return;
            var ok = this._globals;
            var globals = this.globalProps();
            var isNode = process.kill;
            var leaks;
            if (test) {
                ok = ok.concat(test._allowedGlobals || []);
            }
            if (isNode && 1 == ok.length - globals.length) return; else if (2 == ok.length - globals.length) return;
            if (this.prevGlobalsLength == globals.length) return;
            this.prevGlobalsLength = globals.length;
            leaks = filterLeaks(ok, globals);
            this._globals = this._globals.concat(leaks);
            if (leaks.length > 1) {
                this.fail(test, new Error("global leaks detected: " + leaks.join(", ") + ""));
            } else if (leaks.length) {
                this.fail(test, new Error("global leak detected: " + leaks[0]));
            }
        };
        Runner.prototype.fail = function(test, err) {
            ++this.failures;
            test.state = "failed";
            if ("string" == typeof err) {
                err = new Error('the string "' + err + '" was thrown, throw an Error :)');
            }
            this.emit("fail", test, err);
        };
        Runner.prototype.failHook = function(hook, err) {
            this.fail(hook, err);
            if (this.suite.bail()) {
                this.emit("end");
            }
        };
        Runner.prototype.hook = function(name, fn) {
            var suite = this.suite, hooks = suite["_" + name], self = this, timer;
            function next(i) {
                var hook = hooks[i];
                if (!hook) return fn();
                if (self.failures && suite.bail()) return fn();
                self.currentRunnable = hook;
                hook.ctx.currentTest = self.test;
                self.emit("hook", hook);
                hook.on("error", function(err) {
                    self.failHook(hook, err);
                });
                hook.run(function(err) {
                    hook.removeAllListeners("error");
                    var testError = hook.error();
                    if (testError) self.fail(self.test, testError);
                    if (err) {
                        self.failHook(hook, err);
                        return fn(err);
                    }
                    self.emit("hook end", hook);
                    delete hook.ctx.currentTest;
                    next(++i);
                });
            }
            Runner.immediately(function() {
                next(0);
            });
        };
        Runner.prototype.hooks = function(name, suites, fn) {
            var self = this, orig = this.suite;
            function next(suite) {
                self.suite = suite;
                if (!suite) {
                    self.suite = orig;
                    return fn();
                }
                self.hook(name, function(err) {
                    if (err) {
                        var errSuite = self.suite;
                        self.suite = orig;
                        return fn(err, errSuite);
                    }
                    next(suites.pop());
                });
            }
            next(suites.pop());
        };
        Runner.prototype.hookUp = function(name, fn) {
            var suites = [ this.suite ].concat(this.parents()).reverse();
            this.hooks(name, suites, fn);
        };
        Runner.prototype.hookDown = function(name, fn) {
            var suites = [ this.suite ].concat(this.parents());
            this.hooks(name, suites, fn);
        };
        Runner.prototype.parents = function() {
            var suite = this.suite, suites = [];
            while (suite = suite.parent) suites.push(suite);
            return suites;
        };
        Runner.prototype.runTest = function(fn) {
            var test = this.test, self = this;
            if (this.asyncOnly) test.asyncOnly = true;
            try {
                test.on("error", function(err) {
                    self.fail(test, err);
                });
                test.run(fn);
            } catch (err) {
                fn(err);
            }
        };
        Runner.prototype.runTests = function(suite, fn) {
            var self = this, tests = suite.tests.slice(), test;
            function hookErr(err, errSuite, after) {
                var orig = self.suite;
                self.suite = after ? errSuite.parent : errSuite;
                if (self.suite) {
                    self.hookUp("afterEach", function(err2, errSuite2) {
                        self.suite = orig;
                        if (err2) return hookErr(err2, errSuite2, true);
                        fn(errSuite);
                    });
                } else {
                    self.suite = orig;
                    fn(errSuite);
                }
            }
            function next(err, errSuite) {
                if (self.failures && suite._bail) return fn();
                if (self._abort) return fn();
                if (err) return hookErr(err, errSuite, true);
                test = tests.shift();
                if (!test) return fn();
                var match = self._grep.test(test.fullTitle());
                if (self._invert) match = !match;
                if (!match) return next();
                if (test.pending) {
                    self.emit("pending", test);
                    self.emit("test end", test);
                    return next();
                }
                self.emit("test", self.test = test);
                self.hookDown("beforeEach", function(err, errSuite) {
                    if (err) return hookErr(err, errSuite, false);
                    self.currentRunnable = self.test;
                    self.runTest(function(err) {
                        test = self.test;
                        if (err) {
                            self.fail(test, err);
                            self.emit("test end", test);
                            return self.hookUp("afterEach", next);
                        }
                        test.state = "passed";
                        self.emit("pass", test);
                        self.emit("test end", test);
                        self.hookUp("afterEach", next);
                    });
                });
            }
            this.next = next;
            next();
        };
        Runner.prototype.runSuite = function(suite, fn) {
            var total = this.grepTotal(suite), self = this, i = 0;
            debug("run suite %s", suite.fullTitle());
            if (!total) return fn();
            this.emit("suite", this.suite = suite);
            function next(errSuite) {
                if (errSuite) {
                    if (errSuite == suite) {
                        return done();
                    } else {
                        return done(errSuite);
                    }
                }
                if (self._abort) return done();
                var curr = suite.suites[i++];
                if (!curr) return done();
                self.runSuite(curr, next);
            }
            function done(errSuite) {
                self.suite = suite;
                self.hook("afterAll", function() {
                    self.emit("suite end", suite);
                    fn(errSuite);
                });
            }
            this.hook("beforeAll", function(err) {
                if (err) return done();
                self.runTests(suite, next);
            });
        };
        Runner.prototype.uncaught = function(err) {
            debug("uncaught exception %s", err.message);
            var runnable = this.currentRunnable;
            if (!runnable || "failed" == runnable.state) return;
            runnable.clearTimeout();
            err.uncaught = true;
            this.fail(runnable, err);
            if ("test" == runnable.type) {
                this.emit("test end", runnable);
                this.hookUp("afterEach", this.next);
                return;
            }
            this.emit("end");
        };
        Runner.prototype.run = function(fn) {
            var self = this, fn = fn || function() {};
            function uncaught(err) {
                self.uncaught(err);
            }
            debug("start");
            this.on("end", function() {
                debug("end");
                process.removeListener("uncaughtException", uncaught);
                fn(self.failures);
            });
            this.emit("start");
            this.runSuite(this.suite, function() {
                debug("finished running");
                self.emit("end");
            });
            process.on("uncaughtException", uncaught);
            return this;
        };
        Runner.prototype.abort = function() {
            debug("aborting");
            this._abort = true;
        };
        function filterLeaks(ok, globals) {
            return filter(globals, function(key) {
                if (/^d+/.test(key)) return false;
                if (global.navigator && /^getInterface/.test(key)) return false;
                if (global.navigator && /^\d+/.test(key)) return false;
                if (/^mocha-/.test(key)) return false;
                var matched = filter(ok, function(ok) {
                    if (~ok.indexOf("*")) return 0 == key.indexOf(ok.split("*")[0]);
                    return key == ok;
                });
                return matched.length == 0 && (!global.navigator || "onerror" !== key);
            });
        }
    });
    require.register("suite.js", function(module, exports, require) {
        var EventEmitter = __p.require("browser/events").EventEmitter, debug = __p.require("browser/debug")("mocha:suite"), milliseconds = __p.require("lib/ms"), utils = __p.require("lib/utils"), Hook = __p.require("lib/hook");
        exports = module.exports = Suite;
        exports.create = function(parent, title) {
            var suite = new Suite(title, parent.ctx);
            suite.parent = parent;
            if (parent.pending) suite.pending = true;
            title = suite.fullTitle();
            parent.addSuite(suite);
            return suite;
        };
        function Suite(title, ctx) {
            this.title = title;
            this.ctx = ctx;
            this.suites = [];
            this.tests = [];
            this.pending = false;
            this._beforeEach = [];
            this._beforeAll = [];
            this._afterEach = [];
            this._afterAll = [];
            this.root = !title;
            this._timeout = 2e3;
            this._slow = 75;
            this._bail = false;
        }
        function F() {}
        F.prototype = EventEmitter.prototype;
        Suite.prototype = new F();
        Suite.prototype.constructor = Suite;
        Suite.prototype.clone = function() {
            var suite = new Suite(this.title);
            debug("clone");
            suite.ctx = this.ctx;
            suite.timeout(this.timeout());
            suite.slow(this.slow());
            suite.bail(this.bail());
            return suite;
        };
        Suite.prototype.timeout = function(ms) {
            if (0 == arguments.length) return this._timeout;
            if ("string" == typeof ms) ms = milliseconds(ms);
            debug("timeout %d", ms);
            this._timeout = parseInt(ms, 10);
            return this;
        };
        Suite.prototype.slow = function(ms) {
            if (0 === arguments.length) return this._slow;
            if ("string" == typeof ms) ms = milliseconds(ms);
            debug("slow %d", ms);
            this._slow = ms;
            return this;
        };
        Suite.prototype.bail = function(bail) {
            if (0 == arguments.length) return this._bail;
            debug("bail %s", bail);
            this._bail = bail;
            return this;
        };
        Suite.prototype.beforeAll = function(fn) {
            if (this.pending) return this;
            var hook = new Hook('"before all" hook', fn);
            hook.parent = this;
            hook.timeout(this.timeout());
            hook.slow(this.slow());
            hook.ctx = this.ctx;
            this._beforeAll.push(hook);
            this.emit("beforeAll", hook);
            return this;
        };
        Suite.prototype.afterAll = function(fn) {
            if (this.pending) return this;
            var hook = new Hook('"after all" hook', fn);
            hook.parent = this;
            hook.timeout(this.timeout());
            hook.slow(this.slow());
            hook.ctx = this.ctx;
            this._afterAll.push(hook);
            this.emit("afterAll", hook);
            return this;
        };
        Suite.prototype.beforeEach = function(fn) {
            if (this.pending) return this;
            var hook = new Hook('"before each" hook', fn);
            hook.parent = this;
            hook.timeout(this.timeout());
            hook.slow(this.slow());
            hook.ctx = this.ctx;
            this._beforeEach.push(hook);
            this.emit("beforeEach", hook);
            return this;
        };
        Suite.prototype.afterEach = function(fn) {
            if (this.pending) return this;
            var hook = new Hook('"after each" hook', fn);
            hook.parent = this;
            hook.timeout(this.timeout());
            hook.slow(this.slow());
            hook.ctx = this.ctx;
            this._afterEach.push(hook);
            this.emit("afterEach", hook);
            return this;
        };
        Suite.prototype.addSuite = function(suite) {
            suite.parent = this;
            suite.timeout(this.timeout());
            suite.slow(this.slow());
            suite.bail(this.bail());
            this.suites.push(suite);
            this.emit("suite", suite);
            return this;
        };
        Suite.prototype.addTest = function(test) {
            test.parent = this;
            test.timeout(this.timeout());
            test.slow(this.slow());
            test.ctx = this.ctx;
            this.tests.push(test);
            this.emit("test", test);
            return this;
        };
        Suite.prototype.fullTitle = function() {
            if (this.parent) {
                var full = this.parent.fullTitle();
                if (full) return full + " " + this.title;
            }
            return this.title;
        };
        Suite.prototype.total = function() {
            return utils.reduce(this.suites, function(sum, suite) {
                return sum + suite.total();
            }, 0) + this.tests.length;
        };
        Suite.prototype.eachTest = function(fn) {
            utils.forEach(this.tests, fn);
            utils.forEach(this.suites, function(suite) {
                suite.eachTest(fn);
            });
            return this;
        };
    });
    require.register("test.js", function(module, exports, require) {
        var Runnable = __p.require("lib/runnable");
        module.exports = Test;
        function Test(title, fn) {
            Runnable.call(this, title, fn);
            this.pending = !fn;
            this.type = "test";
        }
        function F() {}
        F.prototype = Runnable.prototype;
        Test.prototype = new F();
        Test.prototype.constructor = Test;
    });
    require.register("utils.js", function(module, exports, require) {
        var fs = __p.require("browser/fs"), path = __p.require("browser/path"), join = path.join, debug = __p.require("browser/debug")("mocha:watch");
        var ignore = [ "node_modules", ".git" ];
        exports.escape = function(html) {
            return String(html).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        };
        exports.forEach = function(arr, fn, scope) {
            for (var i = 0, l = arr.length; i < l; i++) fn.call(scope, arr[i], i);
        };
        exports.indexOf = function(arr, obj, start) {
            for (var i = start || 0, l = arr.length; i < l; i++) {
                if (arr[i] === obj) return i;
            }
            return -1;
        };
        exports.reduce = function(arr, fn, val) {
            var rval = val;
            for (var i = 0, l = arr.length; i < l; i++) {
                rval = fn(rval, arr[i], i, arr);
            }
            return rval;
        };
        exports.filter = function(arr, fn) {
            var ret = [];
            for (var i = 0, l = arr.length; i < l; i++) {
                var val = arr[i];
                if (fn(val, i, arr)) ret.push(val);
            }
            return ret;
        };
        exports.keys = Object.keys || function(obj) {
            var keys = [], has = Object.prototype.hasOwnProperty;
            for (var key in obj) {
                if (has.call(obj, key)) {
                    keys.push(key);
                }
            }
            return keys;
        };
        exports.watch = function(files, fn) {
            var options = {
                interval: 100
            };
            files.forEach(function(file) {
                debug("file %s", file);
                fs.watchFile(file, options, function(curr, prev) {
                    if (prev.mtime < curr.mtime) fn(file);
                });
            });
        };
        function ignored(path) {
            return !~ignore.indexOf(path);
        }
        exports.files = function(dir, ret) {
            ret = ret || [];
            fs.readdirSync(dir).filter(ignored).forEach(function(path) {
                path = join(dir, path);
                if (fs.statSync(path).isDirectory()) {
                    exports.files(path, ret);
                } else if (path.match(/\.(js|coffee|litcoffee|coffee.md)$/)) {
                    ret.push(path);
                }
            });
            return ret;
        };
        exports.slug = function(str) {
            return str.toLowerCase().replace(/ +/g, "-").replace(/[^-\w]/g, "");
        };
        exports.clean = function(str) {
            str = str.replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/^\uFEFF/, "").replace(/^function *\(.*\) *{/, "").replace(/\s+\}$/, "");
            var spaces = str.match(/^\n?( *)/)[1].length, tabs = str.match(/^\n?(\t*)/)[1].length, re = new RegExp("^\n?" + (tabs ? "	" : " ") + "{" + (tabs ? tabs : spaces) + "}", "gm");
            str = str.replace(re, "");
            return exports.trim(str);
        };
        exports.escapeRegexp = function(str) {
            return str.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
        };
        exports.trim = function(str) {
            return str.replace(/^\s+|\s+$/g, "");
        };
        exports.parseQuery = function(qs) {
            return exports.reduce(qs.replace("?", "").split("&"), function(obj, pair) {
                var i = pair.indexOf("="), key = pair.slice(0, i), val = pair.slice(++i);
                obj[key] = decodeURIComponent(val);
                return obj;
            }, {});
        };
        function highlight(js) {
            return js.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\/\/(.*)/gm, '<span class="comment">//$1</span>').replace(/('.*?')/gm, '<span class="string">$1</span>').replace(/(\d+\.\d+)/gm, '<span class="number">$1</span>').replace(/(\d+)/gm, '<span class="number">$1</span>').replace(/\bnew *(\w+)/gm, '<span class="keyword">new</span> <span class="init">$1</span>').replace(/\b(function|new|throw|return|var|if|else)\b/gm, '<span class="keyword">$1</span>');
        }
        exports.highlightTags = function(name) {
            var code = document.getElementsByTagName(name);
            for (var i = 0, len = code.length; i < len; ++i) {
                code[i].innerHTML = highlight(code[i].innerHTML);
            }
        };
    });
    global = function() {
        return this;
    }();
    var Date = global.Date;
    var setTimeout = global.setTimeout;
    var setInterval = global.setInterval;
    var clearTimeout = global.clearTimeout;
    var clearInterval = global.clearInterval;
    var process = {};
    process.exit = function(status) {};
    process.stdout = {};
    var uncaughtExceptionHandlers = [];
    process.removeListener = function(e, fn) {
        if ("uncaughtException" == e) {
            global.onerror = function() {};
            var i = uncaughtExceptionHandlers.indexOf(fn);
            if (i != -1) {
                uncaughtExceptionHandlers.splice(i, 1);
            }
        }
    };
    process.on = function(e, fn) {
        if ("uncaughtException" == e) {
            global.onerror = function(err, url, line) {
                fn(new Error(err + " (" + url + ":" + line + ")"));
                return true;
            };
            uncaughtExceptionHandlers.push(fn);
        }
    };
    var Mocha = global.Mocha = __p.require("mocha"), mocha = global.mocha = new Mocha({
        reporter: "html"
    });
    mocha.suite.removeAllListeners("pre-require");
    var immediateQueue = [], immediateTimeout;
    function timeslice() {
        var immediateStart = new Date().getTime();
        while (immediateQueue.length && new Date().getTime() - immediateStart < 100) {
            immediateQueue.shift()();
        }
        if (immediateQueue.length) {
            immediateTimeout = setTimeout(timeslice, 0);
        } else {
            immediateTimeout = null;
        }
    }
    Mocha.Runner.immediately = function(callback) {
        immediateQueue.push(callback);
        if (!immediateTimeout) {
            immediateTimeout = setTimeout(timeslice, 0);
        }
    };
    mocha.throwError = function(err) {
        uncaughtExceptionHandlers.forEach(function(fn) {
            fn(err);
        });
        throw err;
    };
    mocha.ui = function(ui) {
        Mocha.prototype.ui.call(this, ui);
        this.suite.emit("pre-require", global, null, this);
        return this;
    };
    mocha.setup = function(opts) {
        if ("string" == typeof opts) opts = {
            ui: opts
        };
        for (var opt in opts) this[opt](opts[opt]);
        return this;
    };
    mocha.run = function(fn) {
        var options = mocha.options;
        mocha.globals("location");
        var query = Mocha.utils.parseQuery(global.location.search || "");
        if (query.grep) mocha.grep(query.grep);
        if (query.invert) mocha.invert();
        return Mocha.prototype.run.call(mocha, function() {
            if (global.document) {
                Mocha.utils.highlightTags("code");
            }
            if (fn) fn();
        });
    };
    Mocha.process = process;
    require.register("titanium/util.js", function(module, exports, require) {
        function objectToString(o) {
            return Object.prototype.toString.call(o);
        }
        function isArray(ar) {
            return Array.isArray(ar);
        }
        function isString(o) {
            return typeof o === "string";
        }
        function isBoolean(o) {
            return typeof o === "boolean";
        }
        function isUndefined(arg) {
            return arg === void 0;
        }
        function isNull(arg) {
            return arg === null;
        }
        function isObject(arg) {
            return typeof arg === "object" && arg !== null;
        }
        function isFunction(arg) {
            return typeof arg === "function";
        }
        function isNumber(arg) {
            return typeof arg === "number";
        }
        function isRegExp(re) {
            return isObject(re) && objectToString(re) === "[object RegExp]";
        }
        function isDate(d) {
            return isObject(d) && objectToString(d) === "[object Date]";
        }
        function isError(e) {
            return isObject(e) && (objectToString(e) === "[object Error]" || e instanceof Error);
        }
        function formatError(value) {
            return "[" + Error.prototype.toString.call(value) + "]";
        }
        function arrayToHash(array) {
            var hash = {};
            array.forEach(function(val, idx) {
                hash[val] = true;
            });
            return hash;
        }
        function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
            var output = [];
            for (var i = 0, l = value.length; i < l; ++i) {
                if (hasOwnProperty(value, String(i))) {
                    output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
                } else {
                    output.push("");
                }
            }
            keys.forEach(function(key) {
                if (!key.match(/^\d+$/)) {
                    output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
                }
            });
            return output;
        }
        function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
            var name, str, desc;
            desc = Object.getOwnPropertyDescriptor(value, key) || {
                value: value[key]
            };
            if (desc.get) {
                if (desc.set) {
                    str = ctx.stylize("[Getter/Setter]", "special");
                } else {
                    str = ctx.stylize("[Getter]", "special");
                }
            } else {
                if (desc.set) {
                    str = ctx.stylize("[Setter]", "special");
                }
            }
            if (!hasOwnProperty(visibleKeys, key)) {
                name = "[" + key + "]";
            }
            if (!str) {
                if (ctx.seen.indexOf(desc.value) < 0) {
                    if (isNull(recurseTimes)) {
                        str = formatValue(ctx, desc.value, null);
                    } else {
                        str = formatValue(ctx, desc.value, recurseTimes - 1);
                    }
                    if (str.indexOf("\n") > -1) {
                        if (array) {
                            str = str.split("\n").map(function(line) {
                                return "  " + line;
                            }).join("\n").substr(2);
                        } else {
                            str = "\n" + str.split("\n").map(function(line) {
                                return "   " + line;
                            }).join("\n");
                        }
                    }
                } else {
                    str = ctx.stylize("[Circular]", "special");
                }
            }
            if (isUndefined(name)) {
                if (array && key.match(/^\d+$/)) {
                    return str;
                }
                name = JSON.stringify("" + key);
                if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
                    name = name.substr(1, name.length - 2);
                    name = ctx.stylize(name, "name");
                } else {
                    name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
                    name = ctx.stylize(name, "string");
                }
            }
            return name + ": " + str;
        }
        var formatRegExp = /%[sdj%]/g;
        exports.format = function(f) {
            var i;
            if (!isString(f)) {
                var objects = [];
                for (i = 0; i < arguments.length; i++) {
                    objects.push(inspect(arguments[i]));
                }
                return objects.join(" ");
            }
            i = 1;
            var args = arguments;
            var len = args.length;
            var str = String(f).replace(formatRegExp, function(x) {
                if (x === "%%") return "%";
                if (i >= len) return x;
                switch (x) {
                  case "%s":
                    return String(args[i++]);

                  case "%d":
                    return Number(args[i++]);

                  case "%j":
                    try {
                        return JSON.stringify(args[i++]);
                    } catch (_) {
                        return "[Circular]";
                    }

                  default:
                    return x;
                }
            });
            for (var x = args[i]; i < len; x = args[++i]) {
                if (isNull(x) || !isObject(x)) {
                    str += " " + x;
                } else {
                    str += " " + inspect(x);
                }
            }
            return str;
        };
        function stylizeWithColor(str, styleType) {
            var style = inspect.styles[styleType];
            if (style) {
                return "[" + inspect.colors[style][0] + "m" + str + "[" + inspect.colors[style][1] + "m";
            } else {
                return str;
            }
        }
        function inspect(obj, opts) {
            var ctx = {
                seen: [],
                stylize: function(s) {
                    return s;
                }
            };
            if (arguments.length >= 3) ctx.depth = arguments[2];
            if (arguments.length >= 4) ctx.colors = arguments[3];
            if (isBoolean(opts)) {
                ctx.showHidden = opts;
            } else if (opts) {
                exports._extend(ctx, opts);
            }
            if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
            if (isUndefined(ctx.depth)) ctx.depth = 2;
            if (isUndefined(ctx.colors)) ctx.colors = false;
            if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
            if (ctx.colors) ctx.stylize = stylizeWithColor;
            return formatValue(ctx, obj, ctx.depth);
        }
        function formatValue(ctx, value, recurseTimes) {
            if (ctx.customInspect && value && isFunction(value.inspect) && value.inspect !== exports.inspect && !(value.constructor && value.constructor.prototype === value)) {
                var ret = value.inspect(recurseTimes, ctx);
                if (!isString(ret)) {
                    ret = formatValue(ctx, ret, recurseTimes);
                }
                return ret;
            }
            var primitive = formatPrimitive(ctx, value);
            if (primitive) {
                return primitive;
            }
            var keys = Object.keys(value);
            var visibleKeys = arrayToHash(keys);
            if (ctx.showHidden) {
                keys = Object.getOwnPropertyNames(value);
            }
            if (keys.length === 0) {
                if (isFunction(value)) {
                    var name = value.name ? ": " + value.name : "";
                    return ctx.stylize("[Function" + name + "]", "special");
                }
                if (isRegExp(value)) {
                    return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
                }
                if (isDate(value)) {
                    return ctx.stylize(Date.prototype.toString.call(value), "date");
                }
                if (isError(value)) {
                    return formatError(value);
                }
            }
            var base = "", array = false, braces = [ "{", "}" ];
            if (isArray(value)) {
                array = true;
                braces = [ "[", "]" ];
            }
            if (isFunction(value)) {
                var n = value.name ? ": " + value.name : "";
                base = " [Function" + n + "]";
            }
            if (isRegExp(value)) {
                base = " " + RegExp.prototype.toString.call(value);
            }
            if (isDate(value)) {
                base = " " + Date.prototype.toUTCString.call(value);
            }
            if (isError(value)) {
                base = " " + formatError(value);
            }
            if (keys.length === 0 && (!array || value.length === 0)) {
                return braces[0] + base + braces[1];
            }
            if (recurseTimes < 0) {
                if (isRegExp(value)) {
                    return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
                } else {
                    return ctx.stylize("[Object]", "special");
                }
            }
            ctx.seen.push(value);
            var output;
            if (array) {
                output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
            } else {
                output = keys.map(function(key) {
                    return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
                });
            }
            ctx.seen.pop();
            return reduceToSingleString(output, base, braces);
        }
        function reduceToSingleString(output, base, braces) {
            var numLinesEst = 0;
            var length = output.reduce(function(prev, cur) {
                numLinesEst++;
                if (cur.indexOf("\n") >= 0) numLinesEst++;
                return prev + cur.replace(/\u001b\[\d\d?m/g, "").length + 1;
            }, 0);
            if (length > 60) {
                return braces[0] + (base === "" ? "" : base + "\n ") + " " + output.join(",\n  ") + " " + braces[1];
            }
            return braces[0] + base + " " + output.join(", ") + " " + braces[1];
        }
        function formatPrimitive(ctx, value) {
            if (isUndefined(value)) return ctx.stylize("undefined", "undefined");
            if (isString(value)) {
                var simple = "'" + JSON.stringify(value).replace(/^"|"$/g, "").replace(/'/g, "\\'").replace(/\\"/g, '"') + "'";
                return ctx.stylize(simple, "string");
            }
            if (isNumber(value)) {
                if (value === 0 && 1 / value < 0) return ctx.stylize("-0", "number");
                return ctx.stylize("" + value, "number");
            }
            if (isBoolean(value)) return ctx.stylize("" + value, "boolean");
            if (isNull(value)) return ctx.stylize("null", "null");
        }
    });
    require.register("reporters/ti-spec.js", function(module, exports, require) {
        var Base = __p.require("lib/base"), color = Base.color;
        exports = module.exports = TiSpec;
        function TiSpec(runner) {
            Base.call(this, runner);
            var self = this, stats = this.stats, indents = 0, n = 0;
            function CR() {
                return "[2K" + "[0G";
            }
            function NL() {
                log(color("pass", ""));
            }
            function upOne() {
                return "[1F" + CR();
            }
            function indent() {
                return new Array(indents).join("  ");
            }
            function log(msg) {
                __log.log("info", CR() + msg);
            }
            runner.on("start", function() {
                NL();
            });
            runner.on("suite", function(suite) {
                ++indents;
                log(color("suite", indent() + suite.title));
            });
            runner.on("suite end", function(suite) {
                --indents;
                if (1 === indents) {
                    NL();
                }
            });
            runner.on("test", function(test) {
                log(color("pass", indent() + "  o " + test.title + ": "));
            });
            runner.on("pending", function(test) {
                log(color("pending", indent() + "  - " + test.title));
            });
            runner.on("pass", function(test) {
                if ("fast" === test.speed) {
                    log(upOne() + color("checkmark", indent() + "  +") + color("pass", " " + test.title + " "));
                } else {
                    log(upOne() + color("checkmark", indent() + "  +") + color("pass", " " + test.title + " ") + color(test.speed, "(" + test.duration + "ms)"));
                }
            });
            runner.on("fail", function(test, err) {
                log(color("fail", upOne() + indent() + "  " + ++n + ") " + test.title));
            });
            runner.on("end", function() {
                self.epilogue();
            });
        }
        function F() {}
        F.prototype = Base.prototype;
        TiSpec.prototype = new F();
        TiSpec.prototype.constructor = TiSpec;
    });
    global.location = {};
    mocha.setup({
        ui: "bdd",
        reporter: "ti-spec"
    });
    var _mochaRun = mocha.run;
    mocha.run = function(fn) {
        _mochaRun(function() {
            mocha.suite.suites.length = 0;
            if (fn) {
                fn();
            }
        });
    };
    var console = {};
    var types = [ "info", "log", "error", "warn", "trace" ];
    var LINE_RESET = "[2K" + "[0G";
    function createConsoleLogger(type) {
        console[type] = function() {
            var args = Array.prototype.slice.call(arguments, 0);
            if (args.length === 0) {
                args.push(LINE_RESET);
            } else {
                args[0] = LINE_RESET + args[0].toString().split(/(?:\r\n|\n|\r)/).join("\n" + LINE_RESET);
            }
            logger.log(type === "log" ? "info" : type, __p.require("titanium/util").format.apply(this, args));
        };
    }
    for (var i = 0; i < types.length; i++) {
        createConsoleLogger(types[i]);
    }
})();