"use strict";

function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var PENDING = void 0,
    FULFILLED = true,
    REJECTED = false;

var Promifill = /*#__PURE__*/function () {
  _createClass(Promifill, [{
    key: "state",
    get: function get() {
      return PENDING;
    }
  }, {
    key: "value",
    get: function get() {
      return void 0;
    }
  }, {
    key: "settled",
    get: function get() {
      return false;
    }
  }]);

  function Promifill(executor) {
    var _this = this;

    _classCallCheck(this, Promifill);

    if (typeof executor != "function") {
      throw new TypeError("Promise resolver ".concat(Object.prototype.toString.call(executor), " is not a function"));
    }

    defineProperty(this, "chain", []);
    defineProperty(this, "observers", []);
    var secret = [];

    var resolve = function resolve(value, bypassKey) {
      if (_this.settled && bypassKey !== secret) {
        return;
      }

      defineProperty(_this, "settled", true);
      var then_ = value && value.then;
      var thenable = typeof then_ == "function";

      if (thenable) {
        defineProperty(value, "preventThrow", true);
      }

      if (thenable && value.state === PENDING) {
        then_.call(value, function (v) {
          return resolve(v, secret);
        }, function (r) {
          return reject(r, secret);
        });
      } else {
        defineProperty(_this, "value", thenable ? value.value : value);
        defineProperty(_this, "state", thenable ? value.state : FULFILLED);
        schedule(_this.observers.map(function (observer) {
          return {
            handler: _this.state === FULFILLED ? observer.onfulfill : observer.onreject,
            value: _this.value
          };
        }));

        if (_this.state === REJECTED) {
          raiseUnhandledPromiseRejectionException(_this.value, _this);
        }
      }
    };

    var reject = function reject(reason, bypassKey) {
      if (_this.settled && bypassKey !== secret) {
        return;
      }

      defineProperty(_this, "settled", true);
      defineProperty(_this, "value", reason);
      defineProperty(_this, "state", REJECTED);
      schedule(_this.observers.map(function (observer) {
        return {
          handler: observer.onreject,
          value: _this.value
        };
      }));
      raiseUnhandledPromiseRejectionException(_this.value, _this);
    };

    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  _createClass(Promifill, [{
    key: "then",
    value: function then(onfulfill, onreject) {
      var _this2 = this;

      var chainedPromise = new this.constructor(function (resolve, reject) {
        var internalOnfulfill = function internalOnfulfill(value) {
          try {
            resolve(typeof onfulfill == "function" ? onfulfill(value) : value);
          } catch (error) {
            reject(error);
          }
        };

        var internalOnreject = function internalOnreject(reason) {
          try {
            if (typeof onreject == "function") {
              resolve(onreject(reason));
            } else {
              reject(reason);
            }
          } catch (error) {
            reject(error);
          }
        };

        if (_this2.state === PENDING) {
          _this2.observers.push({
            onfulfill: internalOnfulfill,
            onreject: internalOnreject
          });
        } else {
          schedule([{
            handler: _this2.state === FULFILLED ? internalOnfulfill : internalOnreject,
            value: _this2.value
          }]);
        }
      });
      this.chain.push(chainedPromise);
      return chainedPromise;
    }
  }, {
    key: "catch",
    value: function _catch(onreject) {
      return this.then(null, onreject);
    }
  }, {
    key: "finally",
    value: function _finally(oncomplete) {
      var _this3 = this;

      var chainedPromise = new this.constructor(function (resolve, reject) {
        var internalOncomplete = function internalOncomplete() {
          try {
            oncomplete();

            if (_this3.state === FULFILLED) {
              resolve(_this3.value);
            } else {
              reject(_this3.value);
            }
          } catch (error) {
            reject(error);
          }
        };

        if (_this3.state === PENDING) {
          _this3.observers.push({
            onfulfill: internalOncomplete,
            onreject: internalOncomplete
          });
        } else {
          schedule([{
            handler: internalOncomplete
          }]);
        }
      });
      this.chain.push(chainedPromise);
      return chainedPromise;
    }
  }], [{
    key: "resolve",
    value: function resolve(value) {
      return value && value.constructor === Promifill ? value : new Promifill(function (resolve) {
        resolve(value);
      });
    }
  }, {
    key: "reject",
    value: function reject(reason) {
      return new Promifill(function (_, reject) {
        reject(reason);
      });
    }
  }, {
    key: "all",
    value: function all(iterable) {
      return new Promifill(function (resolve, reject) {
        validateIterable(iterable);
        var iterableSize = 0;
        var values = [];

        if (isEmptyIterable(iterable)) {
          return resolve(values);
        }

        var add = function add(value, index) {
          values[index] = value;

          if (values.filter(function () {
            return true;
          }).length === iterableSize) {
            resolve(values);
          }
        };

        var _iterator = _createForOfIteratorHelper(iterable),
            _step;

        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var item = _step.value;

            (function (entry, index) {
              Promifill.resolve(entry).then(function (value) {
                return add(value, index);
              }, reject);
            })(item, iterableSize++);
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
      });
    }
  }, {
    key: "race",
    value: function race(iterable) {
      return new Promifill(function (resolve, reject) {
        validateIterable(iterable);

        if (isEmptyIterable(iterable)) {
          return;
        }

        var _iterator2 = _createForOfIteratorHelper(iterable),
            _step2;

        try {
          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
            var entry = _step2.value;
            Promifill.resolve(entry).then(resolve, reject);
          }
        } catch (err) {
          _iterator2.e(err);
        } finally {
          _iterator2.f();
        }
      });
    }
  }, {
    key: "flushQueue",
    value: function flushQueue() {
        console.log("running promise sync by flushing queue");
      schedule.flushQueue();
    }
  }]);

  return Promifill;
}();

var defineProperty = function defineProperty(obj, propName, propValue) {
  Object.defineProperty(obj, propName, {
    value: propValue
  });
};

var defer = function defer(handler) {
  return function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    setTimeout.apply(void 0, [handler, 0].concat(args));
  };
};

var thrower = function thrower(error) {
  throw error instanceof Error ? error : new Error(error);
};

var raiseUnhandledPromiseRejectionException = defer(function (error, promise) {
  if (promise.preventThrow || promise.chain.length > 0) {
    return;
  }

  thrower(error);
});

var MutationObserverStrategy = /*#__PURE__*/function () {
  function MutationObserverStrategy(handler) {
    _classCallCheck(this, MutationObserverStrategy);

    var observer = new MutationObserver(handler);
    var node = this.node = document.createTextNode("");
    observer.observe(node, {
      characterData: true
    });
  }

  _createClass(MutationObserverStrategy, [{
    key: "trigger",
    value: function trigger() {
      this.node.data = this.node.data === 1 ? 0 : 1;
    }
  }]);

  return MutationObserverStrategy;
}();

var NextTickStrategy = /*#__PURE__*/function () {
  function NextTickStrategy(handler) {
    _classCallCheck(this, NextTickStrategy);

    this.scheduleNextTick = function () {
      return process.nextTick(handler);
    };
  }

  _createClass(NextTickStrategy, [{
    key: "trigger",
    value: function trigger() {
      this.scheduleNextTick();
    }
  }]);

  return NextTickStrategy;
}();

var BetterThanNothingStrategy = /*#__PURE__*/function () {
  function BetterThanNothingStrategy(handler) {
    _classCallCheck(this, BetterThanNothingStrategy);

    this.scheduleAsap = function () {
      return setTimeout(handler, 0);
    };
  }

  _createClass(BetterThanNothingStrategy, [{
    key: "trigger",
    value: function trigger() {
      this.scheduleAsap();
    }
  }]);

  return BetterThanNothingStrategy;
}();

var getStrategy = function getStrategy() {
  if (typeof window != "undefined" && typeof window.MutationObserver == "function") {
    return MutationObserverStrategy;
  }

  if (typeof global != "undefined" && typeof process != "undefined" && typeof process.nextTick == "function") {
    return NextTickStrategy;
  }

  return BetterThanNothingStrategy;
};

var schedule = function () {
  var microtasks = [];

  var run = function run() {
    var handler, value;

    while (microtasks.length > 0 && (_microtasks$shift = microtasks.shift(), handler = _microtasks$shift.handler, value = _microtasks$shift.value, _microtasks$shift)) {
      var _microtasks$shift;
      console.log("running handler with", value);
      handler(value);
    }
  };

  var Strategy = getStrategy();
  var ctrl = new Strategy(run);

  var scheduleFn = function scheduleFn(observers) {
    if (observers.length == 0) {
      return;
    }

    microtasks = microtasks.concat(observers);
    observers.length = 0;
    ctrl.trigger();
  };

  scheduleFn.flushQueue = function () {
    run();
  };

  return scheduleFn;
}();

var isIterable = function isIterable(subject) {
  return subject != null && typeof subject[Symbol.iterator] == "function";
};

var validateIterable = function validateIterable(subject) {
  if (isIterable(subject)) {
    return;
  }

  throw new TypeError("Cannot read property 'Symbol(Symbol.iterator)' of ".concat(Object.prototype.toString.call(subject), "."));
};

var isEmptyIterable = function isEmptyIterable(subject) {
  var _iterator3 = _createForOfIteratorHelper(subject),
      _step3;

  try {
    for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
      var _ = _step3.value;
      // eslint-disable-line no-unused-vars
      return false;
    }
  } catch (err) {
    _iterator3.e(err);
  } finally {
    _iterator3.f();
  }

  return true;
};

window.Promifill = Promifill;
