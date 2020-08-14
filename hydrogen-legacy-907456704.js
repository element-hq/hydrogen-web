var hydrogenBundle = (function (exports) {
	'use strict';

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, basedir, module) {
		return module = {
		  path: basedir,
		  exports: {},
		  require: function (path, base) {
	      return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
	    }
		}, fn(module, module.exports), module.exports;
	}

	function commonjsRequire () {
		throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
	}

	var check = function (it) {
	  return it && it.Math == Math && it;
	};

	// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
	var global_1 =
	  // eslint-disable-next-line no-undef
	  check(typeof globalThis == 'object' && globalThis) ||
	  check(typeof window == 'object' && window) ||
	  check(typeof self == 'object' && self) ||
	  check(typeof commonjsGlobal == 'object' && commonjsGlobal) ||
	  // eslint-disable-next-line no-new-func
	  Function('return this')();

	var fails = function (exec) {
	  try {
	    return !!exec();
	  } catch (error) {
	    return true;
	  }
	};

	// Thank's IE8 for his funny defineProperty
	var descriptors = !fails(function () {
	  return Object.defineProperty({}, 1, { get: function () { return 7; } })[1] != 7;
	});

	var nativePropertyIsEnumerable = {}.propertyIsEnumerable;
	var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

	// Nashorn ~ JDK8 bug
	var NASHORN_BUG = getOwnPropertyDescriptor && !nativePropertyIsEnumerable.call({ 1: 2 }, 1);

	// `Object.prototype.propertyIsEnumerable` method implementation
	// https://tc39.github.io/ecma262/#sec-object.prototype.propertyisenumerable
	var f = NASHORN_BUG ? function propertyIsEnumerable(V) {
	  var descriptor = getOwnPropertyDescriptor(this, V);
	  return !!descriptor && descriptor.enumerable;
	} : nativePropertyIsEnumerable;

	var objectPropertyIsEnumerable = {
		f: f
	};

	var createPropertyDescriptor = function (bitmap, value) {
	  return {
	    enumerable: !(bitmap & 1),
	    configurable: !(bitmap & 2),
	    writable: !(bitmap & 4),
	    value: value
	  };
	};

	var toString = {}.toString;

	var classofRaw = function (it) {
	  return toString.call(it).slice(8, -1);
	};

	var split = ''.split;

	// fallback for non-array-like ES3 and non-enumerable old V8 strings
	var indexedObject = fails(function () {
	  // throws an error in rhino, see https://github.com/mozilla/rhino/issues/346
	  // eslint-disable-next-line no-prototype-builtins
	  return !Object('z').propertyIsEnumerable(0);
	}) ? function (it) {
	  return classofRaw(it) == 'String' ? split.call(it, '') : Object(it);
	} : Object;

	// `RequireObjectCoercible` abstract operation
	// https://tc39.github.io/ecma262/#sec-requireobjectcoercible
	var requireObjectCoercible = function (it) {
	  if (it == undefined) throw TypeError("Can't call method on " + it);
	  return it;
	};

	// toObject with fallback for non-array-like ES3 strings



	var toIndexedObject = function (it) {
	  return indexedObject(requireObjectCoercible(it));
	};

	var isObject = function (it) {
	  return typeof it === 'object' ? it !== null : typeof it === 'function';
	};

	// `ToPrimitive` abstract operation
	// https://tc39.github.io/ecma262/#sec-toprimitive
	// instead of the ES6 spec version, we didn't implement @@toPrimitive case
	// and the second argument - flag - preferred type is a string
	var toPrimitive = function (input, PREFERRED_STRING) {
	  if (!isObject(input)) return input;
	  var fn, val;
	  if (PREFERRED_STRING && typeof (fn = input.toString) == 'function' && !isObject(val = fn.call(input))) return val;
	  if (typeof (fn = input.valueOf) == 'function' && !isObject(val = fn.call(input))) return val;
	  if (!PREFERRED_STRING && typeof (fn = input.toString) == 'function' && !isObject(val = fn.call(input))) return val;
	  throw TypeError("Can't convert object to primitive value");
	};

	var hasOwnProperty = {}.hasOwnProperty;

	var has = function (it, key) {
	  return hasOwnProperty.call(it, key);
	};

	var document$1 = global_1.document;
	// typeof document.createElement is 'object' in old IE
	var EXISTS = isObject(document$1) && isObject(document$1.createElement);

	var documentCreateElement = function (it) {
	  return EXISTS ? document$1.createElement(it) : {};
	};

	// Thank's IE8 for his funny defineProperty
	var ie8DomDefine = !descriptors && !fails(function () {
	  return Object.defineProperty(documentCreateElement('div'), 'a', {
	    get: function () { return 7; }
	  }).a != 7;
	});

	var nativeGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

	// `Object.getOwnPropertyDescriptor` method
	// https://tc39.github.io/ecma262/#sec-object.getownpropertydescriptor
	var f$1 = descriptors ? nativeGetOwnPropertyDescriptor : function getOwnPropertyDescriptor(O, P) {
	  O = toIndexedObject(O);
	  P = toPrimitive(P, true);
	  if (ie8DomDefine) try {
	    return nativeGetOwnPropertyDescriptor(O, P);
	  } catch (error) { /* empty */ }
	  if (has(O, P)) return createPropertyDescriptor(!objectPropertyIsEnumerable.f.call(O, P), O[P]);
	};

	var objectGetOwnPropertyDescriptor = {
		f: f$1
	};

	var anObject = function (it) {
	  if (!isObject(it)) {
	    throw TypeError(String(it) + ' is not an object');
	  } return it;
	};

	var nativeDefineProperty = Object.defineProperty;

	// `Object.defineProperty` method
	// https://tc39.github.io/ecma262/#sec-object.defineproperty
	var f$2 = descriptors ? nativeDefineProperty : function defineProperty(O, P, Attributes) {
	  anObject(O);
	  P = toPrimitive(P, true);
	  anObject(Attributes);
	  if (ie8DomDefine) try {
	    return nativeDefineProperty(O, P, Attributes);
	  } catch (error) { /* empty */ }
	  if ('get' in Attributes || 'set' in Attributes) throw TypeError('Accessors not supported');
	  if ('value' in Attributes) O[P] = Attributes.value;
	  return O;
	};

	var objectDefineProperty = {
		f: f$2
	};

	var createNonEnumerableProperty = descriptors ? function (object, key, value) {
	  return objectDefineProperty.f(object, key, createPropertyDescriptor(1, value));
	} : function (object, key, value) {
	  object[key] = value;
	  return object;
	};

	var setGlobal = function (key, value) {
	  try {
	    createNonEnumerableProperty(global_1, key, value);
	  } catch (error) {
	    global_1[key] = value;
	  } return value;
	};

	var SHARED = '__core-js_shared__';
	var store = global_1[SHARED] || setGlobal(SHARED, {});

	var sharedStore = store;

	var functionToString = Function.toString;

	// this helper broken in `3.4.1-3.4.4`, so we can't use `shared` helper
	if (typeof sharedStore.inspectSource != 'function') {
	  sharedStore.inspectSource = function (it) {
	    return functionToString.call(it);
	  };
	}

	var inspectSource = sharedStore.inspectSource;

	var WeakMap = global_1.WeakMap;

	var nativeWeakMap = typeof WeakMap === 'function' && /native code/.test(inspectSource(WeakMap));

	var isPure = false;

	var shared = createCommonjsModule(function (module) {
	(module.exports = function (key, value) {
	  return sharedStore[key] || (sharedStore[key] = value !== undefined ? value : {});
	})('versions', []).push({
	  version: '3.6.5',
	  mode:  'global',
	  copyright: '© 2020 Denis Pushkarev (zloirock.ru)'
	});
	});

	var id = 0;
	var postfix = Math.random();

	var uid = function (key) {
	  return 'Symbol(' + String(key === undefined ? '' : key) + ')_' + (++id + postfix).toString(36);
	};

	var keys = shared('keys');

	var sharedKey = function (key) {
	  return keys[key] || (keys[key] = uid(key));
	};

	var hiddenKeys = {};

	var WeakMap$1 = global_1.WeakMap;
	var set, get, has$1;

	var enforce = function (it) {
	  return has$1(it) ? get(it) : set(it, {});
	};

	var getterFor = function (TYPE) {
	  return function (it) {
	    var state;
	    if (!isObject(it) || (state = get(it)).type !== TYPE) {
	      throw TypeError('Incompatible receiver, ' + TYPE + ' required');
	    } return state;
	  };
	};

	if (nativeWeakMap) {
	  var store$1 = new WeakMap$1();
	  var wmget = store$1.get;
	  var wmhas = store$1.has;
	  var wmset = store$1.set;
	  set = function (it, metadata) {
	    wmset.call(store$1, it, metadata);
	    return metadata;
	  };
	  get = function (it) {
	    return wmget.call(store$1, it) || {};
	  };
	  has$1 = function (it) {
	    return wmhas.call(store$1, it);
	  };
	} else {
	  var STATE = sharedKey('state');
	  hiddenKeys[STATE] = true;
	  set = function (it, metadata) {
	    createNonEnumerableProperty(it, STATE, metadata);
	    return metadata;
	  };
	  get = function (it) {
	    return has(it, STATE) ? it[STATE] : {};
	  };
	  has$1 = function (it) {
	    return has(it, STATE);
	  };
	}

	var internalState = {
	  set: set,
	  get: get,
	  has: has$1,
	  enforce: enforce,
	  getterFor: getterFor
	};

	var redefine = createCommonjsModule(function (module) {
	var getInternalState = internalState.get;
	var enforceInternalState = internalState.enforce;
	var TEMPLATE = String(String).split('String');

	(module.exports = function (O, key, value, options) {
	  var unsafe = options ? !!options.unsafe : false;
	  var simple = options ? !!options.enumerable : false;
	  var noTargetGet = options ? !!options.noTargetGet : false;
	  if (typeof value == 'function') {
	    if (typeof key == 'string' && !has(value, 'name')) createNonEnumerableProperty(value, 'name', key);
	    enforceInternalState(value).source = TEMPLATE.join(typeof key == 'string' ? key : '');
	  }
	  if (O === global_1) {
	    if (simple) O[key] = value;
	    else setGlobal(key, value);
	    return;
	  } else if (!unsafe) {
	    delete O[key];
	  } else if (!noTargetGet && O[key]) {
	    simple = true;
	  }
	  if (simple) O[key] = value;
	  else createNonEnumerableProperty(O, key, value);
	// add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative
	})(Function.prototype, 'toString', function toString() {
	  return typeof this == 'function' && getInternalState(this).source || inspectSource(this);
	});
	});

	var path = global_1;

	var aFunction = function (variable) {
	  return typeof variable == 'function' ? variable : undefined;
	};

	var getBuiltIn = function (namespace, method) {
	  return arguments.length < 2 ? aFunction(path[namespace]) || aFunction(global_1[namespace])
	    : path[namespace] && path[namespace][method] || global_1[namespace] && global_1[namespace][method];
	};

	var ceil = Math.ceil;
	var floor = Math.floor;

	// `ToInteger` abstract operation
	// https://tc39.github.io/ecma262/#sec-tointeger
	var toInteger = function (argument) {
	  return isNaN(argument = +argument) ? 0 : (argument > 0 ? floor : ceil)(argument);
	};

	var min = Math.min;

	// `ToLength` abstract operation
	// https://tc39.github.io/ecma262/#sec-tolength
	var toLength = function (argument) {
	  return argument > 0 ? min(toInteger(argument), 0x1FFFFFFFFFFFFF) : 0; // 2 ** 53 - 1 == 9007199254740991
	};

	var max = Math.max;
	var min$1 = Math.min;

	// Helper for a popular repeating case of the spec:
	// Let integer be ? ToInteger(index).
	// If integer < 0, let result be max((length + integer), 0); else let result be min(integer, length).
	var toAbsoluteIndex = function (index, length) {
	  var integer = toInteger(index);
	  return integer < 0 ? max(integer + length, 0) : min$1(integer, length);
	};

	// `Array.prototype.{ indexOf, includes }` methods implementation
	var createMethod = function (IS_INCLUDES) {
	  return function ($this, el, fromIndex) {
	    var O = toIndexedObject($this);
	    var length = toLength(O.length);
	    var index = toAbsoluteIndex(fromIndex, length);
	    var value;
	    // Array#includes uses SameValueZero equality algorithm
	    // eslint-disable-next-line no-self-compare
	    if (IS_INCLUDES && el != el) while (length > index) {
	      value = O[index++];
	      // eslint-disable-next-line no-self-compare
	      if (value != value) return true;
	    // Array#indexOf ignores holes, Array#includes - not
	    } else for (;length > index; index++) {
	      if ((IS_INCLUDES || index in O) && O[index] === el) return IS_INCLUDES || index || 0;
	    } return !IS_INCLUDES && -1;
	  };
	};

	var arrayIncludes = {
	  // `Array.prototype.includes` method
	  // https://tc39.github.io/ecma262/#sec-array.prototype.includes
	  includes: createMethod(true),
	  // `Array.prototype.indexOf` method
	  // https://tc39.github.io/ecma262/#sec-array.prototype.indexof
	  indexOf: createMethod(false)
	};

	var indexOf = arrayIncludes.indexOf;


	var objectKeysInternal = function (object, names) {
	  var O = toIndexedObject(object);
	  var i = 0;
	  var result = [];
	  var key;
	  for (key in O) !has(hiddenKeys, key) && has(O, key) && result.push(key);
	  // Don't enum bug & hidden keys
	  while (names.length > i) if (has(O, key = names[i++])) {
	    ~indexOf(result, key) || result.push(key);
	  }
	  return result;
	};

	// IE8- don't enum bug keys
	var enumBugKeys = [
	  'constructor',
	  'hasOwnProperty',
	  'isPrototypeOf',
	  'propertyIsEnumerable',
	  'toLocaleString',
	  'toString',
	  'valueOf'
	];

	var hiddenKeys$1 = enumBugKeys.concat('length', 'prototype');

	// `Object.getOwnPropertyNames` method
	// https://tc39.github.io/ecma262/#sec-object.getownpropertynames
	var f$3 = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
	  return objectKeysInternal(O, hiddenKeys$1);
	};

	var objectGetOwnPropertyNames = {
		f: f$3
	};

	var f$4 = Object.getOwnPropertySymbols;

	var objectGetOwnPropertySymbols = {
		f: f$4
	};

	// all object keys, includes non-enumerable and symbols
	var ownKeys = getBuiltIn('Reflect', 'ownKeys') || function ownKeys(it) {
	  var keys = objectGetOwnPropertyNames.f(anObject(it));
	  var getOwnPropertySymbols = objectGetOwnPropertySymbols.f;
	  return getOwnPropertySymbols ? keys.concat(getOwnPropertySymbols(it)) : keys;
	};

	var copyConstructorProperties = function (target, source) {
	  var keys = ownKeys(source);
	  var defineProperty = objectDefineProperty.f;
	  var getOwnPropertyDescriptor = objectGetOwnPropertyDescriptor.f;
	  for (var i = 0; i < keys.length; i++) {
	    var key = keys[i];
	    if (!has(target, key)) defineProperty(target, key, getOwnPropertyDescriptor(source, key));
	  }
	};

	var replacement = /#|\.prototype\./;

	var isForced = function (feature, detection) {
	  var value = data[normalize(feature)];
	  return value == POLYFILL ? true
	    : value == NATIVE ? false
	    : typeof detection == 'function' ? fails(detection)
	    : !!detection;
	};

	var normalize = isForced.normalize = function (string) {
	  return String(string).replace(replacement, '.').toLowerCase();
	};

	var data = isForced.data = {};
	var NATIVE = isForced.NATIVE = 'N';
	var POLYFILL = isForced.POLYFILL = 'P';

	var isForced_1 = isForced;

	var getOwnPropertyDescriptor$1 = objectGetOwnPropertyDescriptor.f;






	/*
	  options.target      - name of the target object
	  options.global      - target is the global object
	  options.stat        - export as static methods of target
	  options.proto       - export as prototype methods of target
	  options.real        - real prototype method for the `pure` version
	  options.forced      - export even if the native feature is available
	  options.bind        - bind methods to the target, required for the `pure` version
	  options.wrap        - wrap constructors to preventing global pollution, required for the `pure` version
	  options.unsafe      - use the simple assignment of property instead of delete + defineProperty
	  options.sham        - add a flag to not completely full polyfills
	  options.enumerable  - export as enumerable property
	  options.noTargetGet - prevent calling a getter on target
	*/
	var _export = function (options, source) {
	  var TARGET = options.target;
	  var GLOBAL = options.global;
	  var STATIC = options.stat;
	  var FORCED, target, key, targetProperty, sourceProperty, descriptor;
	  if (GLOBAL) {
	    target = global_1;
	  } else if (STATIC) {
	    target = global_1[TARGET] || setGlobal(TARGET, {});
	  } else {
	    target = (global_1[TARGET] || {}).prototype;
	  }
	  if (target) for (key in source) {
	    sourceProperty = source[key];
	    if (options.noTargetGet) {
	      descriptor = getOwnPropertyDescriptor$1(target, key);
	      targetProperty = descriptor && descriptor.value;
	    } else targetProperty = target[key];
	    FORCED = isForced_1(GLOBAL ? key : TARGET + (STATIC ? '.' : '#') + key, options.forced);
	    // contained in target
	    if (!FORCED && targetProperty !== undefined) {
	      if (typeof sourceProperty === typeof targetProperty) continue;
	      copyConstructorProperties(sourceProperty, targetProperty);
	    }
	    // add a flag to not completely full polyfills
	    if (options.sham || (targetProperty && targetProperty.sham)) {
	      createNonEnumerableProperty(sourceProperty, 'sham', true);
	    }
	    // extend global
	    redefine(target, key, sourceProperty, options);
	  }
	};

	var nativeSymbol = !!Object.getOwnPropertySymbols && !fails(function () {
	  // Chrome 38 Symbol has incorrect toString conversion
	  // eslint-disable-next-line no-undef
	  return !String(Symbol());
	});

	var useSymbolAsUid = nativeSymbol
	  // eslint-disable-next-line no-undef
	  && !Symbol.sham
	  // eslint-disable-next-line no-undef
	  && typeof Symbol.iterator == 'symbol';

	// `IsArray` abstract operation
	// https://tc39.github.io/ecma262/#sec-isarray
	var isArray = Array.isArray || function isArray(arg) {
	  return classofRaw(arg) == 'Array';
	};

	// `ToObject` abstract operation
	// https://tc39.github.io/ecma262/#sec-toobject
	var toObject = function (argument) {
	  return Object(requireObjectCoercible(argument));
	};

	// `Object.keys` method
	// https://tc39.github.io/ecma262/#sec-object.keys
	var objectKeys = Object.keys || function keys(O) {
	  return objectKeysInternal(O, enumBugKeys);
	};

	// `Object.defineProperties` method
	// https://tc39.github.io/ecma262/#sec-object.defineproperties
	var objectDefineProperties = descriptors ? Object.defineProperties : function defineProperties(O, Properties) {
	  anObject(O);
	  var keys = objectKeys(Properties);
	  var length = keys.length;
	  var index = 0;
	  var key;
	  while (length > index) objectDefineProperty.f(O, key = keys[index++], Properties[key]);
	  return O;
	};

	var html = getBuiltIn('document', 'documentElement');

	var GT = '>';
	var LT = '<';
	var PROTOTYPE = 'prototype';
	var SCRIPT = 'script';
	var IE_PROTO = sharedKey('IE_PROTO');

	var EmptyConstructor = function () { /* empty */ };

	var scriptTag = function (content) {
	  return LT + SCRIPT + GT + content + LT + '/' + SCRIPT + GT;
	};

	// Create object with fake `null` prototype: use ActiveX Object with cleared prototype
	var NullProtoObjectViaActiveX = function (activeXDocument) {
	  activeXDocument.write(scriptTag(''));
	  activeXDocument.close();
	  var temp = activeXDocument.parentWindow.Object;
	  activeXDocument = null; // avoid memory leak
	  return temp;
	};

	// Create object with fake `null` prototype: use iframe Object with cleared prototype
	var NullProtoObjectViaIFrame = function () {
	  // Thrash, waste and sodomy: IE GC bug
	  var iframe = documentCreateElement('iframe');
	  var JS = 'java' + SCRIPT + ':';
	  var iframeDocument;
	  iframe.style.display = 'none';
	  html.appendChild(iframe);
	  // https://github.com/zloirock/core-js/issues/475
	  iframe.src = String(JS);
	  iframeDocument = iframe.contentWindow.document;
	  iframeDocument.open();
	  iframeDocument.write(scriptTag('document.F=Object'));
	  iframeDocument.close();
	  return iframeDocument.F;
	};

	// Check for document.domain and active x support
	// No need to use active x approach when document.domain is not set
	// see https://github.com/es-shims/es5-shim/issues/150
	// variation of https://github.com/kitcambridge/es5-shim/commit/4f738ac066346
	// avoid IE GC bug
	var activeXDocument;
	var NullProtoObject = function () {
	  try {
	    /* global ActiveXObject */
	    activeXDocument = document.domain && new ActiveXObject('htmlfile');
	  } catch (error) { /* ignore */ }
	  NullProtoObject = activeXDocument ? NullProtoObjectViaActiveX(activeXDocument) : NullProtoObjectViaIFrame();
	  var length = enumBugKeys.length;
	  while (length--) delete NullProtoObject[PROTOTYPE][enumBugKeys[length]];
	  return NullProtoObject();
	};

	hiddenKeys[IE_PROTO] = true;

	// `Object.create` method
	// https://tc39.github.io/ecma262/#sec-object.create
	var objectCreate = Object.create || function create(O, Properties) {
	  var result;
	  if (O !== null) {
	    EmptyConstructor[PROTOTYPE] = anObject(O);
	    result = new EmptyConstructor();
	    EmptyConstructor[PROTOTYPE] = null;
	    // add "__proto__" for Object.getPrototypeOf polyfill
	    result[IE_PROTO] = O;
	  } else result = NullProtoObject();
	  return Properties === undefined ? result : objectDefineProperties(result, Properties);
	};

	var nativeGetOwnPropertyNames = objectGetOwnPropertyNames.f;

	var toString$1 = {}.toString;

	var windowNames = typeof window == 'object' && window && Object.getOwnPropertyNames
	  ? Object.getOwnPropertyNames(window) : [];

	var getWindowNames = function (it) {
	  try {
	    return nativeGetOwnPropertyNames(it);
	  } catch (error) {
	    return windowNames.slice();
	  }
	};

	// fallback for IE11 buggy Object.getOwnPropertyNames with iframe and window
	var f$5 = function getOwnPropertyNames(it) {
	  return windowNames && toString$1.call(it) == '[object Window]'
	    ? getWindowNames(it)
	    : nativeGetOwnPropertyNames(toIndexedObject(it));
	};

	var objectGetOwnPropertyNamesExternal = {
		f: f$5
	};

	var WellKnownSymbolsStore = shared('wks');
	var Symbol$1 = global_1.Symbol;
	var createWellKnownSymbol = useSymbolAsUid ? Symbol$1 : Symbol$1 && Symbol$1.withoutSetter || uid;

	var wellKnownSymbol = function (name) {
	  if (!has(WellKnownSymbolsStore, name)) {
	    if (nativeSymbol && has(Symbol$1, name)) WellKnownSymbolsStore[name] = Symbol$1[name];
	    else WellKnownSymbolsStore[name] = createWellKnownSymbol('Symbol.' + name);
	  } return WellKnownSymbolsStore[name];
	};

	var f$6 = wellKnownSymbol;

	var wellKnownSymbolWrapped = {
		f: f$6
	};

	var defineProperty = objectDefineProperty.f;

	var defineWellKnownSymbol = function (NAME) {
	  var Symbol = path.Symbol || (path.Symbol = {});
	  if (!has(Symbol, NAME)) defineProperty(Symbol, NAME, {
	    value: wellKnownSymbolWrapped.f(NAME)
	  });
	};

	var defineProperty$1 = objectDefineProperty.f;



	var TO_STRING_TAG = wellKnownSymbol('toStringTag');

	var setToStringTag = function (it, TAG, STATIC) {
	  if (it && !has(it = STATIC ? it : it.prototype, TO_STRING_TAG)) {
	    defineProperty$1(it, TO_STRING_TAG, { configurable: true, value: TAG });
	  }
	};

	var aFunction$1 = function (it) {
	  if (typeof it != 'function') {
	    throw TypeError(String(it) + ' is not a function');
	  } return it;
	};

	// optional / simple context binding
	var functionBindContext = function (fn, that, length) {
	  aFunction$1(fn);
	  if (that === undefined) return fn;
	  switch (length) {
	    case 0: return function () {
	      return fn.call(that);
	    };
	    case 1: return function (a) {
	      return fn.call(that, a);
	    };
	    case 2: return function (a, b) {
	      return fn.call(that, a, b);
	    };
	    case 3: return function (a, b, c) {
	      return fn.call(that, a, b, c);
	    };
	  }
	  return function (/* ...args */) {
	    return fn.apply(that, arguments);
	  };
	};

	var SPECIES = wellKnownSymbol('species');

	// `ArraySpeciesCreate` abstract operation
	// https://tc39.github.io/ecma262/#sec-arrayspeciescreate
	var arraySpeciesCreate = function (originalArray, length) {
	  var C;
	  if (isArray(originalArray)) {
	    C = originalArray.constructor;
	    // cross-realm fallback
	    if (typeof C == 'function' && (C === Array || isArray(C.prototype))) C = undefined;
	    else if (isObject(C)) {
	      C = C[SPECIES];
	      if (C === null) C = undefined;
	    }
	  } return new (C === undefined ? Array : C)(length === 0 ? 0 : length);
	};

	var push = [].push;

	// `Array.prototype.{ forEach, map, filter, some, every, find, findIndex }` methods implementation
	var createMethod$1 = function (TYPE) {
	  var IS_MAP = TYPE == 1;
	  var IS_FILTER = TYPE == 2;
	  var IS_SOME = TYPE == 3;
	  var IS_EVERY = TYPE == 4;
	  var IS_FIND_INDEX = TYPE == 6;
	  var NO_HOLES = TYPE == 5 || IS_FIND_INDEX;
	  return function ($this, callbackfn, that, specificCreate) {
	    var O = toObject($this);
	    var self = indexedObject(O);
	    var boundFunction = functionBindContext(callbackfn, that, 3);
	    var length = toLength(self.length);
	    var index = 0;
	    var create = specificCreate || arraySpeciesCreate;
	    var target = IS_MAP ? create($this, length) : IS_FILTER ? create($this, 0) : undefined;
	    var value, result;
	    for (;length > index; index++) if (NO_HOLES || index in self) {
	      value = self[index];
	      result = boundFunction(value, index, O);
	      if (TYPE) {
	        if (IS_MAP) target[index] = result; // map
	        else if (result) switch (TYPE) {
	          case 3: return true;              // some
	          case 5: return value;             // find
	          case 6: return index;             // findIndex
	          case 2: push.call(target, value); // filter
	        } else if (IS_EVERY) return false;  // every
	      }
	    }
	    return IS_FIND_INDEX ? -1 : IS_SOME || IS_EVERY ? IS_EVERY : target;
	  };
	};

	var arrayIteration = {
	  // `Array.prototype.forEach` method
	  // https://tc39.github.io/ecma262/#sec-array.prototype.foreach
	  forEach: createMethod$1(0),
	  // `Array.prototype.map` method
	  // https://tc39.github.io/ecma262/#sec-array.prototype.map
	  map: createMethod$1(1),
	  // `Array.prototype.filter` method
	  // https://tc39.github.io/ecma262/#sec-array.prototype.filter
	  filter: createMethod$1(2),
	  // `Array.prototype.some` method
	  // https://tc39.github.io/ecma262/#sec-array.prototype.some
	  some: createMethod$1(3),
	  // `Array.prototype.every` method
	  // https://tc39.github.io/ecma262/#sec-array.prototype.every
	  every: createMethod$1(4),
	  // `Array.prototype.find` method
	  // https://tc39.github.io/ecma262/#sec-array.prototype.find
	  find: createMethod$1(5),
	  // `Array.prototype.findIndex` method
	  // https://tc39.github.io/ecma262/#sec-array.prototype.findIndex
	  findIndex: createMethod$1(6)
	};

	var $forEach = arrayIteration.forEach;

	var HIDDEN = sharedKey('hidden');
	var SYMBOL = 'Symbol';
	var PROTOTYPE$1 = 'prototype';
	var TO_PRIMITIVE = wellKnownSymbol('toPrimitive');
	var setInternalState = internalState.set;
	var getInternalState = internalState.getterFor(SYMBOL);
	var ObjectPrototype = Object[PROTOTYPE$1];
	var $Symbol = global_1.Symbol;
	var $stringify = getBuiltIn('JSON', 'stringify');
	var nativeGetOwnPropertyDescriptor$1 = objectGetOwnPropertyDescriptor.f;
	var nativeDefineProperty$1 = objectDefineProperty.f;
	var nativeGetOwnPropertyNames$1 = objectGetOwnPropertyNamesExternal.f;
	var nativePropertyIsEnumerable$1 = objectPropertyIsEnumerable.f;
	var AllSymbols = shared('symbols');
	var ObjectPrototypeSymbols = shared('op-symbols');
	var StringToSymbolRegistry = shared('string-to-symbol-registry');
	var SymbolToStringRegistry = shared('symbol-to-string-registry');
	var WellKnownSymbolsStore$1 = shared('wks');
	var QObject = global_1.QObject;
	// Don't use setters in Qt Script, https://github.com/zloirock/core-js/issues/173
	var USE_SETTER = !QObject || !QObject[PROTOTYPE$1] || !QObject[PROTOTYPE$1].findChild;

	// fallback for old Android, https://code.google.com/p/v8/issues/detail?id=687
	var setSymbolDescriptor = descriptors && fails(function () {
	  return objectCreate(nativeDefineProperty$1({}, 'a', {
	    get: function () { return nativeDefineProperty$1(this, 'a', { value: 7 }).a; }
	  })).a != 7;
	}) ? function (O, P, Attributes) {
	  var ObjectPrototypeDescriptor = nativeGetOwnPropertyDescriptor$1(ObjectPrototype, P);
	  if (ObjectPrototypeDescriptor) delete ObjectPrototype[P];
	  nativeDefineProperty$1(O, P, Attributes);
	  if (ObjectPrototypeDescriptor && O !== ObjectPrototype) {
	    nativeDefineProperty$1(ObjectPrototype, P, ObjectPrototypeDescriptor);
	  }
	} : nativeDefineProperty$1;

	var wrap = function (tag, description) {
	  var symbol = AllSymbols[tag] = objectCreate($Symbol[PROTOTYPE$1]);
	  setInternalState(symbol, {
	    type: SYMBOL,
	    tag: tag,
	    description: description
	  });
	  if (!descriptors) symbol.description = description;
	  return symbol;
	};

	var isSymbol = useSymbolAsUid ? function (it) {
	  return typeof it == 'symbol';
	} : function (it) {
	  return Object(it) instanceof $Symbol;
	};

	var $defineProperty = function defineProperty(O, P, Attributes) {
	  if (O === ObjectPrototype) $defineProperty(ObjectPrototypeSymbols, P, Attributes);
	  anObject(O);
	  var key = toPrimitive(P, true);
	  anObject(Attributes);
	  if (has(AllSymbols, key)) {
	    if (!Attributes.enumerable) {
	      if (!has(O, HIDDEN)) nativeDefineProperty$1(O, HIDDEN, createPropertyDescriptor(1, {}));
	      O[HIDDEN][key] = true;
	    } else {
	      if (has(O, HIDDEN) && O[HIDDEN][key]) O[HIDDEN][key] = false;
	      Attributes = objectCreate(Attributes, { enumerable: createPropertyDescriptor(0, false) });
	    } return setSymbolDescriptor(O, key, Attributes);
	  } return nativeDefineProperty$1(O, key, Attributes);
	};

	var $defineProperties = function defineProperties(O, Properties) {
	  anObject(O);
	  var properties = toIndexedObject(Properties);
	  var keys = objectKeys(properties).concat($getOwnPropertySymbols(properties));
	  $forEach(keys, function (key) {
	    if (!descriptors || $propertyIsEnumerable.call(properties, key)) $defineProperty(O, key, properties[key]);
	  });
	  return O;
	};

	var $create = function create(O, Properties) {
	  return Properties === undefined ? objectCreate(O) : $defineProperties(objectCreate(O), Properties);
	};

	var $propertyIsEnumerable = function propertyIsEnumerable(V) {
	  var P = toPrimitive(V, true);
	  var enumerable = nativePropertyIsEnumerable$1.call(this, P);
	  if (this === ObjectPrototype && has(AllSymbols, P) && !has(ObjectPrototypeSymbols, P)) return false;
	  return enumerable || !has(this, P) || !has(AllSymbols, P) || has(this, HIDDEN) && this[HIDDEN][P] ? enumerable : true;
	};

	var $getOwnPropertyDescriptor = function getOwnPropertyDescriptor(O, P) {
	  var it = toIndexedObject(O);
	  var key = toPrimitive(P, true);
	  if (it === ObjectPrototype && has(AllSymbols, key) && !has(ObjectPrototypeSymbols, key)) return;
	  var descriptor = nativeGetOwnPropertyDescriptor$1(it, key);
	  if (descriptor && has(AllSymbols, key) && !(has(it, HIDDEN) && it[HIDDEN][key])) {
	    descriptor.enumerable = true;
	  }
	  return descriptor;
	};

	var $getOwnPropertyNames = function getOwnPropertyNames(O) {
	  var names = nativeGetOwnPropertyNames$1(toIndexedObject(O));
	  var result = [];
	  $forEach(names, function (key) {
	    if (!has(AllSymbols, key) && !has(hiddenKeys, key)) result.push(key);
	  });
	  return result;
	};

	var $getOwnPropertySymbols = function getOwnPropertySymbols(O) {
	  var IS_OBJECT_PROTOTYPE = O === ObjectPrototype;
	  var names = nativeGetOwnPropertyNames$1(IS_OBJECT_PROTOTYPE ? ObjectPrototypeSymbols : toIndexedObject(O));
	  var result = [];
	  $forEach(names, function (key) {
	    if (has(AllSymbols, key) && (!IS_OBJECT_PROTOTYPE || has(ObjectPrototype, key))) {
	      result.push(AllSymbols[key]);
	    }
	  });
	  return result;
	};

	// `Symbol` constructor
	// https://tc39.github.io/ecma262/#sec-symbol-constructor
	if (!nativeSymbol) {
	  $Symbol = function Symbol() {
	    if (this instanceof $Symbol) throw TypeError('Symbol is not a constructor');
	    var description = !arguments.length || arguments[0] === undefined ? undefined : String(arguments[0]);
	    var tag = uid(description);
	    var setter = function (value) {
	      if (this === ObjectPrototype) setter.call(ObjectPrototypeSymbols, value);
	      if (has(this, HIDDEN) && has(this[HIDDEN], tag)) this[HIDDEN][tag] = false;
	      setSymbolDescriptor(this, tag, createPropertyDescriptor(1, value));
	    };
	    if (descriptors && USE_SETTER) setSymbolDescriptor(ObjectPrototype, tag, { configurable: true, set: setter });
	    return wrap(tag, description);
	  };

	  redefine($Symbol[PROTOTYPE$1], 'toString', function toString() {
	    return getInternalState(this).tag;
	  });

	  redefine($Symbol, 'withoutSetter', function (description) {
	    return wrap(uid(description), description);
	  });

	  objectPropertyIsEnumerable.f = $propertyIsEnumerable;
	  objectDefineProperty.f = $defineProperty;
	  objectGetOwnPropertyDescriptor.f = $getOwnPropertyDescriptor;
	  objectGetOwnPropertyNames.f = objectGetOwnPropertyNamesExternal.f = $getOwnPropertyNames;
	  objectGetOwnPropertySymbols.f = $getOwnPropertySymbols;

	  wellKnownSymbolWrapped.f = function (name) {
	    return wrap(wellKnownSymbol(name), name);
	  };

	  if (descriptors) {
	    // https://github.com/tc39/proposal-Symbol-description
	    nativeDefineProperty$1($Symbol[PROTOTYPE$1], 'description', {
	      configurable: true,
	      get: function description() {
	        return getInternalState(this).description;
	      }
	    });
	    {
	      redefine(ObjectPrototype, 'propertyIsEnumerable', $propertyIsEnumerable, { unsafe: true });
	    }
	  }
	}

	_export({ global: true, wrap: true, forced: !nativeSymbol, sham: !nativeSymbol }, {
	  Symbol: $Symbol
	});

	$forEach(objectKeys(WellKnownSymbolsStore$1), function (name) {
	  defineWellKnownSymbol(name);
	});

	_export({ target: SYMBOL, stat: true, forced: !nativeSymbol }, {
	  // `Symbol.for` method
	  // https://tc39.github.io/ecma262/#sec-symbol.for
	  'for': function (key) {
	    var string = String(key);
	    if (has(StringToSymbolRegistry, string)) return StringToSymbolRegistry[string];
	    var symbol = $Symbol(string);
	    StringToSymbolRegistry[string] = symbol;
	    SymbolToStringRegistry[symbol] = string;
	    return symbol;
	  },
	  // `Symbol.keyFor` method
	  // https://tc39.github.io/ecma262/#sec-symbol.keyfor
	  keyFor: function keyFor(sym) {
	    if (!isSymbol(sym)) throw TypeError(sym + ' is not a symbol');
	    if (has(SymbolToStringRegistry, sym)) return SymbolToStringRegistry[sym];
	  },
	  useSetter: function () { USE_SETTER = true; },
	  useSimple: function () { USE_SETTER = false; }
	});

	_export({ target: 'Object', stat: true, forced: !nativeSymbol, sham: !descriptors }, {
	  // `Object.create` method
	  // https://tc39.github.io/ecma262/#sec-object.create
	  create: $create,
	  // `Object.defineProperty` method
	  // https://tc39.github.io/ecma262/#sec-object.defineproperty
	  defineProperty: $defineProperty,
	  // `Object.defineProperties` method
	  // https://tc39.github.io/ecma262/#sec-object.defineproperties
	  defineProperties: $defineProperties,
	  // `Object.getOwnPropertyDescriptor` method
	  // https://tc39.github.io/ecma262/#sec-object.getownpropertydescriptors
	  getOwnPropertyDescriptor: $getOwnPropertyDescriptor
	});

	_export({ target: 'Object', stat: true, forced: !nativeSymbol }, {
	  // `Object.getOwnPropertyNames` method
	  // https://tc39.github.io/ecma262/#sec-object.getownpropertynames
	  getOwnPropertyNames: $getOwnPropertyNames,
	  // `Object.getOwnPropertySymbols` method
	  // https://tc39.github.io/ecma262/#sec-object.getownpropertysymbols
	  getOwnPropertySymbols: $getOwnPropertySymbols
	});

	// Chrome 38 and 39 `Object.getOwnPropertySymbols` fails on primitives
	// https://bugs.chromium.org/p/v8/issues/detail?id=3443
	_export({ target: 'Object', stat: true, forced: fails(function () { objectGetOwnPropertySymbols.f(1); }) }, {
	  getOwnPropertySymbols: function getOwnPropertySymbols(it) {
	    return objectGetOwnPropertySymbols.f(toObject(it));
	  }
	});

	// `JSON.stringify` method behavior with symbols
	// https://tc39.github.io/ecma262/#sec-json.stringify
	if ($stringify) {
	  var FORCED_JSON_STRINGIFY = !nativeSymbol || fails(function () {
	    var symbol = $Symbol();
	    // MS Edge converts symbol values to JSON as {}
	    return $stringify([symbol]) != '[null]'
	      // WebKit converts symbol values to JSON as null
	      || $stringify({ a: symbol }) != '{}'
	      // V8 throws on boxed symbols
	      || $stringify(Object(symbol)) != '{}';
	  });

	  _export({ target: 'JSON', stat: true, forced: FORCED_JSON_STRINGIFY }, {
	    // eslint-disable-next-line no-unused-vars
	    stringify: function stringify(it, replacer, space) {
	      var args = [it];
	      var index = 1;
	      var $replacer;
	      while (arguments.length > index) args.push(arguments[index++]);
	      $replacer = replacer;
	      if (!isObject(replacer) && it === undefined || isSymbol(it)) return; // IE8 returns string on undefined
	      if (!isArray(replacer)) replacer = function (key, value) {
	        if (typeof $replacer == 'function') value = $replacer.call(this, key, value);
	        if (!isSymbol(value)) return value;
	      };
	      args[1] = replacer;
	      return $stringify.apply(null, args);
	    }
	  });
	}

	// `Symbol.prototype[@@toPrimitive]` method
	// https://tc39.github.io/ecma262/#sec-symbol.prototype-@@toprimitive
	if (!$Symbol[PROTOTYPE$1][TO_PRIMITIVE]) {
	  createNonEnumerableProperty($Symbol[PROTOTYPE$1], TO_PRIMITIVE, $Symbol[PROTOTYPE$1].valueOf);
	}
	// `Symbol.prototype[@@toStringTag]` property
	// https://tc39.github.io/ecma262/#sec-symbol.prototype-@@tostringtag
	setToStringTag($Symbol, SYMBOL);

	hiddenKeys[HIDDEN] = true;

	var defineProperty$2 = objectDefineProperty.f;


	var NativeSymbol = global_1.Symbol;

	if (descriptors && typeof NativeSymbol == 'function' && (!('description' in NativeSymbol.prototype) ||
	  // Safari 12 bug
	  NativeSymbol().description !== undefined
	)) {
	  var EmptyStringDescriptionStore = {};
	  // wrap Symbol constructor for correct work with undefined description
	  var SymbolWrapper = function Symbol() {
	    var description = arguments.length < 1 || arguments[0] === undefined ? undefined : String(arguments[0]);
	    var result = this instanceof SymbolWrapper
	      ? new NativeSymbol(description)
	      // in Edge 13, String(Symbol(undefined)) === 'Symbol(undefined)'
	      : description === undefined ? NativeSymbol() : NativeSymbol(description);
	    if (description === '') EmptyStringDescriptionStore[result] = true;
	    return result;
	  };
	  copyConstructorProperties(SymbolWrapper, NativeSymbol);
	  var symbolPrototype = SymbolWrapper.prototype = NativeSymbol.prototype;
	  symbolPrototype.constructor = SymbolWrapper;

	  var symbolToString = symbolPrototype.toString;
	  var native = String(NativeSymbol('test')) == 'Symbol(test)';
	  var regexp = /^Symbol\((.*)\)[^)]+$/;
	  defineProperty$2(symbolPrototype, 'description', {
	    configurable: true,
	    get: function description() {
	      var symbol = isObject(this) ? this.valueOf() : this;
	      var string = symbolToString.call(symbol);
	      if (has(EmptyStringDescriptionStore, symbol)) return '';
	      var desc = native ? string.slice(7, -1) : string.replace(regexp, '$1');
	      return desc === '' ? undefined : desc;
	    }
	  });

	  _export({ global: true, forced: true }, {
	    Symbol: SymbolWrapper
	  });
	}

	// `Symbol.asyncIterator` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.asynciterator
	defineWellKnownSymbol('asyncIterator');

	// `Symbol.hasInstance` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.hasinstance
	defineWellKnownSymbol('hasInstance');

	// `Symbol.isConcatSpreadable` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.isconcatspreadable
	defineWellKnownSymbol('isConcatSpreadable');

	// `Symbol.iterator` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.iterator
	defineWellKnownSymbol('iterator');

	// `Symbol.match` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.match
	defineWellKnownSymbol('match');

	// `Symbol.replace` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.replace
	defineWellKnownSymbol('replace');

	// `Symbol.search` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.search
	defineWellKnownSymbol('search');

	// `Symbol.species` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.species
	defineWellKnownSymbol('species');

	// `Symbol.split` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.split
	defineWellKnownSymbol('split');

	// `Symbol.toPrimitive` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.toprimitive
	defineWellKnownSymbol('toPrimitive');

	// `Symbol.toStringTag` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.tostringtag
	defineWellKnownSymbol('toStringTag');

	// `Symbol.unscopables` well-known symbol
	// https://tc39.github.io/ecma262/#sec-symbol.unscopables
	defineWellKnownSymbol('unscopables');

	var createProperty = function (object, key, value) {
	  var propertyKey = toPrimitive(key);
	  if (propertyKey in object) objectDefineProperty.f(object, propertyKey, createPropertyDescriptor(0, value));
	  else object[propertyKey] = value;
	};

	var engineUserAgent = getBuiltIn('navigator', 'userAgent') || '';

	var process = global_1.process;
	var versions = process && process.versions;
	var v8 = versions && versions.v8;
	var match, version;

	if (v8) {
	  match = v8.split('.');
	  version = match[0] + match[1];
	} else if (engineUserAgent) {
	  match = engineUserAgent.match(/Edge\/(\d+)/);
	  if (!match || match[1] >= 74) {
	    match = engineUserAgent.match(/Chrome\/(\d+)/);
	    if (match) version = match[1];
	  }
	}

	var engineV8Version = version && +version;

	var SPECIES$1 = wellKnownSymbol('species');

	var arrayMethodHasSpeciesSupport = function (METHOD_NAME) {
	  // We can't use this feature detection in V8 since it causes
	  // deoptimization and serious performance degradation
	  // https://github.com/zloirock/core-js/issues/677
	  return engineV8Version >= 51 || !fails(function () {
	    var array = [];
	    var constructor = array.constructor = {};
	    constructor[SPECIES$1] = function () {
	      return { foo: 1 };
	    };
	    return array[METHOD_NAME](Boolean).foo !== 1;
	  });
	};

	var IS_CONCAT_SPREADABLE = wellKnownSymbol('isConcatSpreadable');
	var MAX_SAFE_INTEGER = 0x1FFFFFFFFFFFFF;
	var MAXIMUM_ALLOWED_INDEX_EXCEEDED = 'Maximum allowed index exceeded';

	// We can't use this feature detection in V8 since it causes
	// deoptimization and serious performance degradation
	// https://github.com/zloirock/core-js/issues/679
	var IS_CONCAT_SPREADABLE_SUPPORT = engineV8Version >= 51 || !fails(function () {
	  var array = [];
	  array[IS_CONCAT_SPREADABLE] = false;
	  return array.concat()[0] !== array;
	});

	var SPECIES_SUPPORT = arrayMethodHasSpeciesSupport('concat');

	var isConcatSpreadable = function (O) {
	  if (!isObject(O)) return false;
	  var spreadable = O[IS_CONCAT_SPREADABLE];
	  return spreadable !== undefined ? !!spreadable : isArray(O);
	};

	var FORCED = !IS_CONCAT_SPREADABLE_SUPPORT || !SPECIES_SUPPORT;

	// `Array.prototype.concat` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.concat
	// with adding support of @@isConcatSpreadable and @@species
	_export({ target: 'Array', proto: true, forced: FORCED }, {
	  concat: function concat(arg) { // eslint-disable-line no-unused-vars
	    var O = toObject(this);
	    var A = arraySpeciesCreate(O, 0);
	    var n = 0;
	    var i, k, length, len, E;
	    for (i = -1, length = arguments.length; i < length; i++) {
	      E = i === -1 ? O : arguments[i];
	      if (isConcatSpreadable(E)) {
	        len = toLength(E.length);
	        if (n + len > MAX_SAFE_INTEGER) throw TypeError(MAXIMUM_ALLOWED_INDEX_EXCEEDED);
	        for (k = 0; k < len; k++, n++) if (k in E) createProperty(A, n, E[k]);
	      } else {
	        if (n >= MAX_SAFE_INTEGER) throw TypeError(MAXIMUM_ALLOWED_INDEX_EXCEEDED);
	        createProperty(A, n++, E);
	      }
	    }
	    A.length = n;
	    return A;
	  }
	});

	var min$2 = Math.min;

	// `Array.prototype.copyWithin` method implementation
	// https://tc39.github.io/ecma262/#sec-array.prototype.copywithin
	var arrayCopyWithin = [].copyWithin || function copyWithin(target /* = 0 */, start /* = 0, end = @length */) {
	  var O = toObject(this);
	  var len = toLength(O.length);
	  var to = toAbsoluteIndex(target, len);
	  var from = toAbsoluteIndex(start, len);
	  var end = arguments.length > 2 ? arguments[2] : undefined;
	  var count = min$2((end === undefined ? len : toAbsoluteIndex(end, len)) - from, len - to);
	  var inc = 1;
	  if (from < to && to < from + count) {
	    inc = -1;
	    from += count - 1;
	    to += count - 1;
	  }
	  while (count-- > 0) {
	    if (from in O) O[to] = O[from];
	    else delete O[to];
	    to += inc;
	    from += inc;
	  } return O;
	};

	var UNSCOPABLES = wellKnownSymbol('unscopables');
	var ArrayPrototype = Array.prototype;

	// Array.prototype[@@unscopables]
	// https://tc39.github.io/ecma262/#sec-array.prototype-@@unscopables
	if (ArrayPrototype[UNSCOPABLES] == undefined) {
	  objectDefineProperty.f(ArrayPrototype, UNSCOPABLES, {
	    configurable: true,
	    value: objectCreate(null)
	  });
	}

	// add a key to Array.prototype[@@unscopables]
	var addToUnscopables = function (key) {
	  ArrayPrototype[UNSCOPABLES][key] = true;
	};

	// `Array.prototype.copyWithin` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.copywithin
	_export({ target: 'Array', proto: true }, {
	  copyWithin: arrayCopyWithin
	});

	// https://tc39.github.io/ecma262/#sec-array.prototype-@@unscopables
	addToUnscopables('copyWithin');

	var arrayMethodIsStrict = function (METHOD_NAME, argument) {
	  var method = [][METHOD_NAME];
	  return !!method && fails(function () {
	    // eslint-disable-next-line no-useless-call,no-throw-literal
	    method.call(null, argument || function () { throw 1; }, 1);
	  });
	};

	var defineProperty$3 = Object.defineProperty;
	var cache = {};

	var thrower = function (it) { throw it; };

	var arrayMethodUsesToLength = function (METHOD_NAME, options) {
	  if (has(cache, METHOD_NAME)) return cache[METHOD_NAME];
	  if (!options) options = {};
	  var method = [][METHOD_NAME];
	  var ACCESSORS = has(options, 'ACCESSORS') ? options.ACCESSORS : false;
	  var argument0 = has(options, 0) ? options[0] : thrower;
	  var argument1 = has(options, 1) ? options[1] : undefined;

	  return cache[METHOD_NAME] = !!method && !fails(function () {
	    if (ACCESSORS && !descriptors) return true;
	    var O = { length: -1 };

	    if (ACCESSORS) defineProperty$3(O, 1, { enumerable: true, get: thrower });
	    else O[1] = 1;

	    method.call(O, argument0, argument1);
	  });
	};

	var $every = arrayIteration.every;



	var STRICT_METHOD = arrayMethodIsStrict('every');
	var USES_TO_LENGTH = arrayMethodUsesToLength('every');

	// `Array.prototype.every` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.every
	_export({ target: 'Array', proto: true, forced: !STRICT_METHOD || !USES_TO_LENGTH }, {
	  every: function every(callbackfn /* , thisArg */) {
	    return $every(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	// `Array.prototype.fill` method implementation
	// https://tc39.github.io/ecma262/#sec-array.prototype.fill
	var arrayFill = function fill(value /* , start = 0, end = @length */) {
	  var O = toObject(this);
	  var length = toLength(O.length);
	  var argumentsLength = arguments.length;
	  var index = toAbsoluteIndex(argumentsLength > 1 ? arguments[1] : undefined, length);
	  var end = argumentsLength > 2 ? arguments[2] : undefined;
	  var endPos = end === undefined ? length : toAbsoluteIndex(end, length);
	  while (endPos > index) O[index++] = value;
	  return O;
	};

	// `Array.prototype.fill` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.fill
	_export({ target: 'Array', proto: true }, {
	  fill: arrayFill
	});

	// https://tc39.github.io/ecma262/#sec-array.prototype-@@unscopables
	addToUnscopables('fill');

	var $filter = arrayIteration.filter;



	var HAS_SPECIES_SUPPORT = arrayMethodHasSpeciesSupport('filter');
	// Edge 14- issue
	var USES_TO_LENGTH$1 = arrayMethodUsesToLength('filter');

	// `Array.prototype.filter` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.filter
	// with adding support of @@species
	_export({ target: 'Array', proto: true, forced: !HAS_SPECIES_SUPPORT || !USES_TO_LENGTH$1 }, {
	  filter: function filter(callbackfn /* , thisArg */) {
	    return $filter(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	var $find = arrayIteration.find;



	var FIND = 'find';
	var SKIPS_HOLES = true;

	var USES_TO_LENGTH$2 = arrayMethodUsesToLength(FIND);

	// Shouldn't skip holes
	if (FIND in []) Array(1)[FIND](function () { SKIPS_HOLES = false; });

	// `Array.prototype.find` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.find
	_export({ target: 'Array', proto: true, forced: SKIPS_HOLES || !USES_TO_LENGTH$2 }, {
	  find: function find(callbackfn /* , that = undefined */) {
	    return $find(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	// https://tc39.github.io/ecma262/#sec-array.prototype-@@unscopables
	addToUnscopables(FIND);

	var $findIndex = arrayIteration.findIndex;



	var FIND_INDEX = 'findIndex';
	var SKIPS_HOLES$1 = true;

	var USES_TO_LENGTH$3 = arrayMethodUsesToLength(FIND_INDEX);

	// Shouldn't skip holes
	if (FIND_INDEX in []) Array(1)[FIND_INDEX](function () { SKIPS_HOLES$1 = false; });

	// `Array.prototype.findIndex` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.findindex
	_export({ target: 'Array', proto: true, forced: SKIPS_HOLES$1 || !USES_TO_LENGTH$3 }, {
	  findIndex: function findIndex(callbackfn /* , that = undefined */) {
	    return $findIndex(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	// https://tc39.github.io/ecma262/#sec-array.prototype-@@unscopables
	addToUnscopables(FIND_INDEX);

	// `FlattenIntoArray` abstract operation
	// https://tc39.github.io/proposal-flatMap/#sec-FlattenIntoArray
	var flattenIntoArray = function (target, original, source, sourceLen, start, depth, mapper, thisArg) {
	  var targetIndex = start;
	  var sourceIndex = 0;
	  var mapFn = mapper ? functionBindContext(mapper, thisArg, 3) : false;
	  var element;

	  while (sourceIndex < sourceLen) {
	    if (sourceIndex in source) {
	      element = mapFn ? mapFn(source[sourceIndex], sourceIndex, original) : source[sourceIndex];

	      if (depth > 0 && isArray(element)) {
	        targetIndex = flattenIntoArray(target, original, element, toLength(element.length), targetIndex, depth - 1) - 1;
	      } else {
	        if (targetIndex >= 0x1FFFFFFFFFFFFF) throw TypeError('Exceed the acceptable array length');
	        target[targetIndex] = element;
	      }

	      targetIndex++;
	    }
	    sourceIndex++;
	  }
	  return targetIndex;
	};

	var flattenIntoArray_1 = flattenIntoArray;

	// `Array.prototype.flat` method
	// https://github.com/tc39/proposal-flatMap
	_export({ target: 'Array', proto: true }, {
	  flat: function flat(/* depthArg = 1 */) {
	    var depthArg = arguments.length ? arguments[0] : undefined;
	    var O = toObject(this);
	    var sourceLen = toLength(O.length);
	    var A = arraySpeciesCreate(O, 0);
	    A.length = flattenIntoArray_1(A, O, O, sourceLen, 0, depthArg === undefined ? 1 : toInteger(depthArg));
	    return A;
	  }
	});

	// `Array.prototype.flatMap` method
	// https://github.com/tc39/proposal-flatMap
	_export({ target: 'Array', proto: true }, {
	  flatMap: function flatMap(callbackfn /* , thisArg */) {
	    var O = toObject(this);
	    var sourceLen = toLength(O.length);
	    var A;
	    aFunction$1(callbackfn);
	    A = arraySpeciesCreate(O, 0);
	    A.length = flattenIntoArray_1(A, O, O, sourceLen, 0, 1, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	    return A;
	  }
	});

	var $forEach$1 = arrayIteration.forEach;



	var STRICT_METHOD$1 = arrayMethodIsStrict('forEach');
	var USES_TO_LENGTH$4 = arrayMethodUsesToLength('forEach');

	// `Array.prototype.forEach` method implementation
	// https://tc39.github.io/ecma262/#sec-array.prototype.foreach
	var arrayForEach = (!STRICT_METHOD$1 || !USES_TO_LENGTH$4) ? function forEach(callbackfn /* , thisArg */) {
	  return $forEach$1(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	} : [].forEach;

	// `Array.prototype.forEach` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.foreach
	_export({ target: 'Array', proto: true, forced: [].forEach != arrayForEach }, {
	  forEach: arrayForEach
	});

	// call something on iterator step with safe closing on error
	var callWithSafeIterationClosing = function (iterator, fn, value, ENTRIES) {
	  try {
	    return ENTRIES ? fn(anObject(value)[0], value[1]) : fn(value);
	  // 7.4.6 IteratorClose(iterator, completion)
	  } catch (error) {
	    var returnMethod = iterator['return'];
	    if (returnMethod !== undefined) anObject(returnMethod.call(iterator));
	    throw error;
	  }
	};

	var iterators = {};

	var ITERATOR = wellKnownSymbol('iterator');
	var ArrayPrototype$1 = Array.prototype;

	// check on default Array iterator
	var isArrayIteratorMethod = function (it) {
	  return it !== undefined && (iterators.Array === it || ArrayPrototype$1[ITERATOR] === it);
	};

	var TO_STRING_TAG$1 = wellKnownSymbol('toStringTag');
	var test = {};

	test[TO_STRING_TAG$1] = 'z';

	var toStringTagSupport = String(test) === '[object z]';

	var TO_STRING_TAG$2 = wellKnownSymbol('toStringTag');
	// ES3 wrong here
	var CORRECT_ARGUMENTS = classofRaw(function () { return arguments; }()) == 'Arguments';

	// fallback for IE11 Script Access Denied error
	var tryGet = function (it, key) {
	  try {
	    return it[key];
	  } catch (error) { /* empty */ }
	};

	// getting tag from ES6+ `Object.prototype.toString`
	var classof = toStringTagSupport ? classofRaw : function (it) {
	  var O, tag, result;
	  return it === undefined ? 'Undefined' : it === null ? 'Null'
	    // @@toStringTag case
	    : typeof (tag = tryGet(O = Object(it), TO_STRING_TAG$2)) == 'string' ? tag
	    // builtinTag case
	    : CORRECT_ARGUMENTS ? classofRaw(O)
	    // ES3 arguments fallback
	    : (result = classofRaw(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : result;
	};

	var ITERATOR$1 = wellKnownSymbol('iterator');

	var getIteratorMethod = function (it) {
	  if (it != undefined) return it[ITERATOR$1]
	    || it['@@iterator']
	    || iterators[classof(it)];
	};

	// `Array.from` method implementation
	// https://tc39.github.io/ecma262/#sec-array.from
	var arrayFrom = function from(arrayLike /* , mapfn = undefined, thisArg = undefined */) {
	  var O = toObject(arrayLike);
	  var C = typeof this == 'function' ? this : Array;
	  var argumentsLength = arguments.length;
	  var mapfn = argumentsLength > 1 ? arguments[1] : undefined;
	  var mapping = mapfn !== undefined;
	  var iteratorMethod = getIteratorMethod(O);
	  var index = 0;
	  var length, result, step, iterator, next, value;
	  if (mapping) mapfn = functionBindContext(mapfn, argumentsLength > 2 ? arguments[2] : undefined, 2);
	  // if the target is not iterable or it's an array with the default iterator - use a simple case
	  if (iteratorMethod != undefined && !(C == Array && isArrayIteratorMethod(iteratorMethod))) {
	    iterator = iteratorMethod.call(O);
	    next = iterator.next;
	    result = new C();
	    for (;!(step = next.call(iterator)).done; index++) {
	      value = mapping ? callWithSafeIterationClosing(iterator, mapfn, [step.value, index], true) : step.value;
	      createProperty(result, index, value);
	    }
	  } else {
	    length = toLength(O.length);
	    result = new C(length);
	    for (;length > index; index++) {
	      value = mapping ? mapfn(O[index], index) : O[index];
	      createProperty(result, index, value);
	    }
	  }
	  result.length = index;
	  return result;
	};

	var ITERATOR$2 = wellKnownSymbol('iterator');
	var SAFE_CLOSING = false;

	try {
	  var called = 0;
	  var iteratorWithReturn = {
	    next: function () {
	      return { done: !!called++ };
	    },
	    'return': function () {
	      SAFE_CLOSING = true;
	    }
	  };
	  iteratorWithReturn[ITERATOR$2] = function () {
	    return this;
	  };
	  // eslint-disable-next-line no-throw-literal
	  Array.from(iteratorWithReturn, function () { throw 2; });
	} catch (error) { /* empty */ }

	var checkCorrectnessOfIteration = function (exec, SKIP_CLOSING) {
	  if (!SKIP_CLOSING && !SAFE_CLOSING) return false;
	  var ITERATION_SUPPORT = false;
	  try {
	    var object = {};
	    object[ITERATOR$2] = function () {
	      return {
	        next: function () {
	          return { done: ITERATION_SUPPORT = true };
	        }
	      };
	    };
	    exec(object);
	  } catch (error) { /* empty */ }
	  return ITERATION_SUPPORT;
	};

	var INCORRECT_ITERATION = !checkCorrectnessOfIteration(function (iterable) {
	  Array.from(iterable);
	});

	// `Array.from` method
	// https://tc39.github.io/ecma262/#sec-array.from
	_export({ target: 'Array', stat: true, forced: INCORRECT_ITERATION }, {
	  from: arrayFrom
	});

	var $includes = arrayIncludes.includes;



	var USES_TO_LENGTH$5 = arrayMethodUsesToLength('indexOf', { ACCESSORS: true, 1: 0 });

	// `Array.prototype.includes` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.includes
	_export({ target: 'Array', proto: true, forced: !USES_TO_LENGTH$5 }, {
	  includes: function includes(el /* , fromIndex = 0 */) {
	    return $includes(this, el, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	// https://tc39.github.io/ecma262/#sec-array.prototype-@@unscopables
	addToUnscopables('includes');

	var $indexOf = arrayIncludes.indexOf;



	var nativeIndexOf = [].indexOf;

	var NEGATIVE_ZERO = !!nativeIndexOf && 1 / [1].indexOf(1, -0) < 0;
	var STRICT_METHOD$2 = arrayMethodIsStrict('indexOf');
	var USES_TO_LENGTH$6 = arrayMethodUsesToLength('indexOf', { ACCESSORS: true, 1: 0 });

	// `Array.prototype.indexOf` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.indexof
	_export({ target: 'Array', proto: true, forced: NEGATIVE_ZERO || !STRICT_METHOD$2 || !USES_TO_LENGTH$6 }, {
	  indexOf: function indexOf(searchElement /* , fromIndex = 0 */) {
	    return NEGATIVE_ZERO
	      // convert -0 to +0
	      ? nativeIndexOf.apply(this, arguments) || 0
	      : $indexOf(this, searchElement, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	var correctPrototypeGetter = !fails(function () {
	  function F() { /* empty */ }
	  F.prototype.constructor = null;
	  return Object.getPrototypeOf(new F()) !== F.prototype;
	});

	var IE_PROTO$1 = sharedKey('IE_PROTO');
	var ObjectPrototype$1 = Object.prototype;

	// `Object.getPrototypeOf` method
	// https://tc39.github.io/ecma262/#sec-object.getprototypeof
	var objectGetPrototypeOf = correctPrototypeGetter ? Object.getPrototypeOf : function (O) {
	  O = toObject(O);
	  if (has(O, IE_PROTO$1)) return O[IE_PROTO$1];
	  if (typeof O.constructor == 'function' && O instanceof O.constructor) {
	    return O.constructor.prototype;
	  } return O instanceof Object ? ObjectPrototype$1 : null;
	};

	var ITERATOR$3 = wellKnownSymbol('iterator');
	var BUGGY_SAFARI_ITERATORS = false;

	var returnThis = function () { return this; };

	// `%IteratorPrototype%` object
	// https://tc39.github.io/ecma262/#sec-%iteratorprototype%-object
	var IteratorPrototype, PrototypeOfArrayIteratorPrototype, arrayIterator;

	if ([].keys) {
	  arrayIterator = [].keys();
	  // Safari 8 has buggy iterators w/o `next`
	  if (!('next' in arrayIterator)) BUGGY_SAFARI_ITERATORS = true;
	  else {
	    PrototypeOfArrayIteratorPrototype = objectGetPrototypeOf(objectGetPrototypeOf(arrayIterator));
	    if (PrototypeOfArrayIteratorPrototype !== Object.prototype) IteratorPrototype = PrototypeOfArrayIteratorPrototype;
	  }
	}

	if (IteratorPrototype == undefined) IteratorPrototype = {};

	// 25.1.2.1.1 %IteratorPrototype%[@@iterator]()
	if ( !has(IteratorPrototype, ITERATOR$3)) {
	  createNonEnumerableProperty(IteratorPrototype, ITERATOR$3, returnThis);
	}

	var iteratorsCore = {
	  IteratorPrototype: IteratorPrototype,
	  BUGGY_SAFARI_ITERATORS: BUGGY_SAFARI_ITERATORS
	};

	var IteratorPrototype$1 = iteratorsCore.IteratorPrototype;





	var returnThis$1 = function () { return this; };

	var createIteratorConstructor = function (IteratorConstructor, NAME, next) {
	  var TO_STRING_TAG = NAME + ' Iterator';
	  IteratorConstructor.prototype = objectCreate(IteratorPrototype$1, { next: createPropertyDescriptor(1, next) });
	  setToStringTag(IteratorConstructor, TO_STRING_TAG, false);
	  iterators[TO_STRING_TAG] = returnThis$1;
	  return IteratorConstructor;
	};

	var aPossiblePrototype = function (it) {
	  if (!isObject(it) && it !== null) {
	    throw TypeError("Can't set " + String(it) + ' as a prototype');
	  } return it;
	};

	// `Object.setPrototypeOf` method
	// https://tc39.github.io/ecma262/#sec-object.setprototypeof
	// Works with __proto__ only. Old v8 can't work with null proto objects.
	/* eslint-disable no-proto */
	var objectSetPrototypeOf = Object.setPrototypeOf || ('__proto__' in {} ? function () {
	  var CORRECT_SETTER = false;
	  var test = {};
	  var setter;
	  try {
	    setter = Object.getOwnPropertyDescriptor(Object.prototype, '__proto__').set;
	    setter.call(test, []);
	    CORRECT_SETTER = test instanceof Array;
	  } catch (error) { /* empty */ }
	  return function setPrototypeOf(O, proto) {
	    anObject(O);
	    aPossiblePrototype(proto);
	    if (CORRECT_SETTER) setter.call(O, proto);
	    else O.__proto__ = proto;
	    return O;
	  };
	}() : undefined);

	var IteratorPrototype$2 = iteratorsCore.IteratorPrototype;
	var BUGGY_SAFARI_ITERATORS$1 = iteratorsCore.BUGGY_SAFARI_ITERATORS;
	var ITERATOR$4 = wellKnownSymbol('iterator');
	var KEYS = 'keys';
	var VALUES = 'values';
	var ENTRIES = 'entries';

	var returnThis$2 = function () { return this; };

	var defineIterator = function (Iterable, NAME, IteratorConstructor, next, DEFAULT, IS_SET, FORCED) {
	  createIteratorConstructor(IteratorConstructor, NAME, next);

	  var getIterationMethod = function (KIND) {
	    if (KIND === DEFAULT && defaultIterator) return defaultIterator;
	    if (!BUGGY_SAFARI_ITERATORS$1 && KIND in IterablePrototype) return IterablePrototype[KIND];
	    switch (KIND) {
	      case KEYS: return function keys() { return new IteratorConstructor(this, KIND); };
	      case VALUES: return function values() { return new IteratorConstructor(this, KIND); };
	      case ENTRIES: return function entries() { return new IteratorConstructor(this, KIND); };
	    } return function () { return new IteratorConstructor(this); };
	  };

	  var TO_STRING_TAG = NAME + ' Iterator';
	  var INCORRECT_VALUES_NAME = false;
	  var IterablePrototype = Iterable.prototype;
	  var nativeIterator = IterablePrototype[ITERATOR$4]
	    || IterablePrototype['@@iterator']
	    || DEFAULT && IterablePrototype[DEFAULT];
	  var defaultIterator = !BUGGY_SAFARI_ITERATORS$1 && nativeIterator || getIterationMethod(DEFAULT);
	  var anyNativeIterator = NAME == 'Array' ? IterablePrototype.entries || nativeIterator : nativeIterator;
	  var CurrentIteratorPrototype, methods, KEY;

	  // fix native
	  if (anyNativeIterator) {
	    CurrentIteratorPrototype = objectGetPrototypeOf(anyNativeIterator.call(new Iterable()));
	    if (IteratorPrototype$2 !== Object.prototype && CurrentIteratorPrototype.next) {
	      if ( objectGetPrototypeOf(CurrentIteratorPrototype) !== IteratorPrototype$2) {
	        if (objectSetPrototypeOf) {
	          objectSetPrototypeOf(CurrentIteratorPrototype, IteratorPrototype$2);
	        } else if (typeof CurrentIteratorPrototype[ITERATOR$4] != 'function') {
	          createNonEnumerableProperty(CurrentIteratorPrototype, ITERATOR$4, returnThis$2);
	        }
	      }
	      // Set @@toStringTag to native iterators
	      setToStringTag(CurrentIteratorPrototype, TO_STRING_TAG, true);
	    }
	  }

	  // fix Array#{values, @@iterator}.name in V8 / FF
	  if (DEFAULT == VALUES && nativeIterator && nativeIterator.name !== VALUES) {
	    INCORRECT_VALUES_NAME = true;
	    defaultIterator = function values() { return nativeIterator.call(this); };
	  }

	  // define iterator
	  if ( IterablePrototype[ITERATOR$4] !== defaultIterator) {
	    createNonEnumerableProperty(IterablePrototype, ITERATOR$4, defaultIterator);
	  }
	  iterators[NAME] = defaultIterator;

	  // export additional methods
	  if (DEFAULT) {
	    methods = {
	      values: getIterationMethod(VALUES),
	      keys: IS_SET ? defaultIterator : getIterationMethod(KEYS),
	      entries: getIterationMethod(ENTRIES)
	    };
	    if (FORCED) for (KEY in methods) {
	      if (BUGGY_SAFARI_ITERATORS$1 || INCORRECT_VALUES_NAME || !(KEY in IterablePrototype)) {
	        redefine(IterablePrototype, KEY, methods[KEY]);
	      }
	    } else _export({ target: NAME, proto: true, forced: BUGGY_SAFARI_ITERATORS$1 || INCORRECT_VALUES_NAME }, methods);
	  }

	  return methods;
	};

	var ARRAY_ITERATOR = 'Array Iterator';
	var setInternalState$1 = internalState.set;
	var getInternalState$1 = internalState.getterFor(ARRAY_ITERATOR);

	// `Array.prototype.entries` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.entries
	// `Array.prototype.keys` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.keys
	// `Array.prototype.values` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.values
	// `Array.prototype[@@iterator]` method
	// https://tc39.github.io/ecma262/#sec-array.prototype-@@iterator
	// `CreateArrayIterator` internal method
	// https://tc39.github.io/ecma262/#sec-createarrayiterator
	var es_array_iterator = defineIterator(Array, 'Array', function (iterated, kind) {
	  setInternalState$1(this, {
	    type: ARRAY_ITERATOR,
	    target: toIndexedObject(iterated), // target
	    index: 0,                          // next index
	    kind: kind                         // kind
	  });
	// `%ArrayIteratorPrototype%.next` method
	// https://tc39.github.io/ecma262/#sec-%arrayiteratorprototype%.next
	}, function () {
	  var state = getInternalState$1(this);
	  var target = state.target;
	  var kind = state.kind;
	  var index = state.index++;
	  if (!target || index >= target.length) {
	    state.target = undefined;
	    return { value: undefined, done: true };
	  }
	  if (kind == 'keys') return { value: index, done: false };
	  if (kind == 'values') return { value: target[index], done: false };
	  return { value: [index, target[index]], done: false };
	}, 'values');

	// argumentsList[@@iterator] is %ArrayProto_values%
	// https://tc39.github.io/ecma262/#sec-createunmappedargumentsobject
	// https://tc39.github.io/ecma262/#sec-createmappedargumentsobject
	iterators.Arguments = iterators.Array;

	// https://tc39.github.io/ecma262/#sec-array.prototype-@@unscopables
	addToUnscopables('keys');
	addToUnscopables('values');
	addToUnscopables('entries');

	var nativeJoin = [].join;

	var ES3_STRINGS = indexedObject != Object;
	var STRICT_METHOD$3 = arrayMethodIsStrict('join', ',');

	// `Array.prototype.join` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.join
	_export({ target: 'Array', proto: true, forced: ES3_STRINGS || !STRICT_METHOD$3 }, {
	  join: function join(separator) {
	    return nativeJoin.call(toIndexedObject(this), separator === undefined ? ',' : separator);
	  }
	});

	var min$3 = Math.min;
	var nativeLastIndexOf = [].lastIndexOf;
	var NEGATIVE_ZERO$1 = !!nativeLastIndexOf && 1 / [1].lastIndexOf(1, -0) < 0;
	var STRICT_METHOD$4 = arrayMethodIsStrict('lastIndexOf');
	// For preventing possible almost infinite loop in non-standard implementations, test the forward version of the method
	var USES_TO_LENGTH$7 = arrayMethodUsesToLength('indexOf', { ACCESSORS: true, 1: 0 });
	var FORCED$1 = NEGATIVE_ZERO$1 || !STRICT_METHOD$4 || !USES_TO_LENGTH$7;

	// `Array.prototype.lastIndexOf` method implementation
	// https://tc39.github.io/ecma262/#sec-array.prototype.lastindexof
	var arrayLastIndexOf = FORCED$1 ? function lastIndexOf(searchElement /* , fromIndex = @[*-1] */) {
	  // convert -0 to +0
	  if (NEGATIVE_ZERO$1) return nativeLastIndexOf.apply(this, arguments) || 0;
	  var O = toIndexedObject(this);
	  var length = toLength(O.length);
	  var index = length - 1;
	  if (arguments.length > 1) index = min$3(index, toInteger(arguments[1]));
	  if (index < 0) index = length + index;
	  for (;index >= 0; index--) if (index in O && O[index] === searchElement) return index || 0;
	  return -1;
	} : nativeLastIndexOf;

	// `Array.prototype.lastIndexOf` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.lastindexof
	_export({ target: 'Array', proto: true, forced: arrayLastIndexOf !== [].lastIndexOf }, {
	  lastIndexOf: arrayLastIndexOf
	});

	var $map = arrayIteration.map;



	var HAS_SPECIES_SUPPORT$1 = arrayMethodHasSpeciesSupport('map');
	// FF49- issue
	var USES_TO_LENGTH$8 = arrayMethodUsesToLength('map');

	// `Array.prototype.map` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.map
	// with adding support of @@species
	_export({ target: 'Array', proto: true, forced: !HAS_SPECIES_SUPPORT$1 || !USES_TO_LENGTH$8 }, {
	  map: function map(callbackfn /* , thisArg */) {
	    return $map(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	var ISNT_GENERIC = fails(function () {
	  function F() { /* empty */ }
	  return !(Array.of.call(F) instanceof F);
	});

	// `Array.of` method
	// https://tc39.github.io/ecma262/#sec-array.of
	// WebKit Array.of isn't generic
	_export({ target: 'Array', stat: true, forced: ISNT_GENERIC }, {
	  of: function of(/* ...args */) {
	    var index = 0;
	    var argumentsLength = arguments.length;
	    var result = new (typeof this == 'function' ? this : Array)(argumentsLength);
	    while (argumentsLength > index) createProperty(result, index, arguments[index++]);
	    result.length = argumentsLength;
	    return result;
	  }
	});

	// `Array.prototype.{ reduce, reduceRight }` methods implementation
	var createMethod$2 = function (IS_RIGHT) {
	  return function (that, callbackfn, argumentsLength, memo) {
	    aFunction$1(callbackfn);
	    var O = toObject(that);
	    var self = indexedObject(O);
	    var length = toLength(O.length);
	    var index = IS_RIGHT ? length - 1 : 0;
	    var i = IS_RIGHT ? -1 : 1;
	    if (argumentsLength < 2) while (true) {
	      if (index in self) {
	        memo = self[index];
	        index += i;
	        break;
	      }
	      index += i;
	      if (IS_RIGHT ? index < 0 : length <= index) {
	        throw TypeError('Reduce of empty array with no initial value');
	      }
	    }
	    for (;IS_RIGHT ? index >= 0 : length > index; index += i) if (index in self) {
	      memo = callbackfn(memo, self[index], index, O);
	    }
	    return memo;
	  };
	};

	var arrayReduce = {
	  // `Array.prototype.reduce` method
	  // https://tc39.github.io/ecma262/#sec-array.prototype.reduce
	  left: createMethod$2(false),
	  // `Array.prototype.reduceRight` method
	  // https://tc39.github.io/ecma262/#sec-array.prototype.reduceright
	  right: createMethod$2(true)
	};

	var $reduce = arrayReduce.left;



	var STRICT_METHOD$5 = arrayMethodIsStrict('reduce');
	var USES_TO_LENGTH$9 = arrayMethodUsesToLength('reduce', { 1: 0 });

	// `Array.prototype.reduce` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.reduce
	_export({ target: 'Array', proto: true, forced: !STRICT_METHOD$5 || !USES_TO_LENGTH$9 }, {
	  reduce: function reduce(callbackfn /* , initialValue */) {
	    return $reduce(this, callbackfn, arguments.length, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	var $reduceRight = arrayReduce.right;



	var STRICT_METHOD$6 = arrayMethodIsStrict('reduceRight');
	// For preventing possible almost infinite loop in non-standard implementations, test the forward version of the method
	var USES_TO_LENGTH$a = arrayMethodUsesToLength('reduce', { 1: 0 });

	// `Array.prototype.reduceRight` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.reduceright
	_export({ target: 'Array', proto: true, forced: !STRICT_METHOD$6 || !USES_TO_LENGTH$a }, {
	  reduceRight: function reduceRight(callbackfn /* , initialValue */) {
	    return $reduceRight(this, callbackfn, arguments.length, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	var HAS_SPECIES_SUPPORT$2 = arrayMethodHasSpeciesSupport('slice');
	var USES_TO_LENGTH$b = arrayMethodUsesToLength('slice', { ACCESSORS: true, 0: 0, 1: 2 });

	var SPECIES$2 = wellKnownSymbol('species');
	var nativeSlice = [].slice;
	var max$1 = Math.max;

	// `Array.prototype.slice` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.slice
	// fallback for not array-like ES3 strings and DOM objects
	_export({ target: 'Array', proto: true, forced: !HAS_SPECIES_SUPPORT$2 || !USES_TO_LENGTH$b }, {
	  slice: function slice(start, end) {
	    var O = toIndexedObject(this);
	    var length = toLength(O.length);
	    var k = toAbsoluteIndex(start, length);
	    var fin = toAbsoluteIndex(end === undefined ? length : end, length);
	    // inline `ArraySpeciesCreate` for usage native `Array#slice` where it's possible
	    var Constructor, result, n;
	    if (isArray(O)) {
	      Constructor = O.constructor;
	      // cross-realm fallback
	      if (typeof Constructor == 'function' && (Constructor === Array || isArray(Constructor.prototype))) {
	        Constructor = undefined;
	      } else if (isObject(Constructor)) {
	        Constructor = Constructor[SPECIES$2];
	        if (Constructor === null) Constructor = undefined;
	      }
	      if (Constructor === Array || Constructor === undefined) {
	        return nativeSlice.call(O, k, fin);
	      }
	    }
	    result = new (Constructor === undefined ? Array : Constructor)(max$1(fin - k, 0));
	    for (n = 0; k < fin; k++, n++) if (k in O) createProperty(result, n, O[k]);
	    result.length = n;
	    return result;
	  }
	});

	var $some = arrayIteration.some;



	var STRICT_METHOD$7 = arrayMethodIsStrict('some');
	var USES_TO_LENGTH$c = arrayMethodUsesToLength('some');

	// `Array.prototype.some` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.some
	_export({ target: 'Array', proto: true, forced: !STRICT_METHOD$7 || !USES_TO_LENGTH$c }, {
	  some: function some(callbackfn /* , thisArg */) {
	    return $some(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	var SPECIES$3 = wellKnownSymbol('species');

	var setSpecies = function (CONSTRUCTOR_NAME) {
	  var Constructor = getBuiltIn(CONSTRUCTOR_NAME);
	  var defineProperty = objectDefineProperty.f;

	  if (descriptors && Constructor && !Constructor[SPECIES$3]) {
	    defineProperty(Constructor, SPECIES$3, {
	      configurable: true,
	      get: function () { return this; }
	    });
	  }
	};

	// `Array[@@species]` getter
	// https://tc39.github.io/ecma262/#sec-get-array-@@species
	setSpecies('Array');

	var HAS_SPECIES_SUPPORT$3 = arrayMethodHasSpeciesSupport('splice');
	var USES_TO_LENGTH$d = arrayMethodUsesToLength('splice', { ACCESSORS: true, 0: 0, 1: 2 });

	var max$2 = Math.max;
	var min$4 = Math.min;
	var MAX_SAFE_INTEGER$1 = 0x1FFFFFFFFFFFFF;
	var MAXIMUM_ALLOWED_LENGTH_EXCEEDED = 'Maximum allowed length exceeded';

	// `Array.prototype.splice` method
	// https://tc39.github.io/ecma262/#sec-array.prototype.splice
	// with adding support of @@species
	_export({ target: 'Array', proto: true, forced: !HAS_SPECIES_SUPPORT$3 || !USES_TO_LENGTH$d }, {
	  splice: function splice(start, deleteCount /* , ...items */) {
	    var O = toObject(this);
	    var len = toLength(O.length);
	    var actualStart = toAbsoluteIndex(start, len);
	    var argumentsLength = arguments.length;
	    var insertCount, actualDeleteCount, A, k, from, to;
	    if (argumentsLength === 0) {
	      insertCount = actualDeleteCount = 0;
	    } else if (argumentsLength === 1) {
	      insertCount = 0;
	      actualDeleteCount = len - actualStart;
	    } else {
	      insertCount = argumentsLength - 2;
	      actualDeleteCount = min$4(max$2(toInteger(deleteCount), 0), len - actualStart);
	    }
	    if (len + insertCount - actualDeleteCount > MAX_SAFE_INTEGER$1) {
	      throw TypeError(MAXIMUM_ALLOWED_LENGTH_EXCEEDED);
	    }
	    A = arraySpeciesCreate(O, actualDeleteCount);
	    for (k = 0; k < actualDeleteCount; k++) {
	      from = actualStart + k;
	      if (from in O) createProperty(A, k, O[from]);
	    }
	    A.length = actualDeleteCount;
	    if (insertCount < actualDeleteCount) {
	      for (k = actualStart; k < len - actualDeleteCount; k++) {
	        from = k + actualDeleteCount;
	        to = k + insertCount;
	        if (from in O) O[to] = O[from];
	        else delete O[to];
	      }
	      for (k = len; k > len - actualDeleteCount + insertCount; k--) delete O[k - 1];
	    } else if (insertCount > actualDeleteCount) {
	      for (k = len - actualDeleteCount; k > actualStart; k--) {
	        from = k + actualDeleteCount - 1;
	        to = k + insertCount - 1;
	        if (from in O) O[to] = O[from];
	        else delete O[to];
	      }
	    }
	    for (k = 0; k < insertCount; k++) {
	      O[k + actualStart] = arguments[k + 2];
	    }
	    O.length = len - actualDeleteCount + insertCount;
	    return A;
	  }
	});

	// this method was added to unscopables after implementation
	// in popular engines, so it's moved to a separate module


	addToUnscopables('flat');

	// this method was added to unscopables after implementation
	// in popular engines, so it's moved to a separate module


	addToUnscopables('flatMap');

	var arrayBufferNative = typeof ArrayBuffer !== 'undefined' && typeof DataView !== 'undefined';

	var redefineAll = function (target, src, options) {
	  for (var key in src) redefine(target, key, src[key], options);
	  return target;
	};

	var anInstance = function (it, Constructor, name) {
	  if (!(it instanceof Constructor)) {
	    throw TypeError('Incorrect ' + (name ? name + ' ' : '') + 'invocation');
	  } return it;
	};

	// `ToIndex` abstract operation
	// https://tc39.github.io/ecma262/#sec-toindex
	var toIndex = function (it) {
	  if (it === undefined) return 0;
	  var number = toInteger(it);
	  var length = toLength(number);
	  if (number !== length) throw RangeError('Wrong length or index');
	  return length;
	};

	// IEEE754 conversions based on https://github.com/feross/ieee754
	// eslint-disable-next-line no-shadow-restricted-names
	var Infinity$1 = 1 / 0;
	var abs = Math.abs;
	var pow = Math.pow;
	var floor$1 = Math.floor;
	var log = Math.log;
	var LN2 = Math.LN2;

	var pack = function (number, mantissaLength, bytes) {
	  var buffer = new Array(bytes);
	  var exponentLength = bytes * 8 - mantissaLength - 1;
	  var eMax = (1 << exponentLength) - 1;
	  var eBias = eMax >> 1;
	  var rt = mantissaLength === 23 ? pow(2, -24) - pow(2, -77) : 0;
	  var sign = number < 0 || number === 0 && 1 / number < 0 ? 1 : 0;
	  var index = 0;
	  var exponent, mantissa, c;
	  number = abs(number);
	  // eslint-disable-next-line no-self-compare
	  if (number != number || number === Infinity$1) {
	    // eslint-disable-next-line no-self-compare
	    mantissa = number != number ? 1 : 0;
	    exponent = eMax;
	  } else {
	    exponent = floor$1(log(number) / LN2);
	    if (number * (c = pow(2, -exponent)) < 1) {
	      exponent--;
	      c *= 2;
	    }
	    if (exponent + eBias >= 1) {
	      number += rt / c;
	    } else {
	      number += rt * pow(2, 1 - eBias);
	    }
	    if (number * c >= 2) {
	      exponent++;
	      c /= 2;
	    }
	    if (exponent + eBias >= eMax) {
	      mantissa = 0;
	      exponent = eMax;
	    } else if (exponent + eBias >= 1) {
	      mantissa = (number * c - 1) * pow(2, mantissaLength);
	      exponent = exponent + eBias;
	    } else {
	      mantissa = number * pow(2, eBias - 1) * pow(2, mantissaLength);
	      exponent = 0;
	    }
	  }
	  for (; mantissaLength >= 8; buffer[index++] = mantissa & 255, mantissa /= 256, mantissaLength -= 8);
	  exponent = exponent << mantissaLength | mantissa;
	  exponentLength += mantissaLength;
	  for (; exponentLength > 0; buffer[index++] = exponent & 255, exponent /= 256, exponentLength -= 8);
	  buffer[--index] |= sign * 128;
	  return buffer;
	};

	var unpack = function (buffer, mantissaLength) {
	  var bytes = buffer.length;
	  var exponentLength = bytes * 8 - mantissaLength - 1;
	  var eMax = (1 << exponentLength) - 1;
	  var eBias = eMax >> 1;
	  var nBits = exponentLength - 7;
	  var index = bytes - 1;
	  var sign = buffer[index--];
	  var exponent = sign & 127;
	  var mantissa;
	  sign >>= 7;
	  for (; nBits > 0; exponent = exponent * 256 + buffer[index], index--, nBits -= 8);
	  mantissa = exponent & (1 << -nBits) - 1;
	  exponent >>= -nBits;
	  nBits += mantissaLength;
	  for (; nBits > 0; mantissa = mantissa * 256 + buffer[index], index--, nBits -= 8);
	  if (exponent === 0) {
	    exponent = 1 - eBias;
	  } else if (exponent === eMax) {
	    return mantissa ? NaN : sign ? -Infinity$1 : Infinity$1;
	  } else {
	    mantissa = mantissa + pow(2, mantissaLength);
	    exponent = exponent - eBias;
	  } return (sign ? -1 : 1) * mantissa * pow(2, exponent - mantissaLength);
	};

	var ieee754 = {
	  pack: pack,
	  unpack: unpack
	};

	var getOwnPropertyNames = objectGetOwnPropertyNames.f;
	var defineProperty$4 = objectDefineProperty.f;




	var getInternalState$2 = internalState.get;
	var setInternalState$2 = internalState.set;
	var ARRAY_BUFFER = 'ArrayBuffer';
	var DATA_VIEW = 'DataView';
	var PROTOTYPE$2 = 'prototype';
	var WRONG_LENGTH = 'Wrong length';
	var WRONG_INDEX = 'Wrong index';
	var NativeArrayBuffer = global_1[ARRAY_BUFFER];
	var $ArrayBuffer = NativeArrayBuffer;
	var $DataView = global_1[DATA_VIEW];
	var $DataViewPrototype = $DataView && $DataView[PROTOTYPE$2];
	var ObjectPrototype$2 = Object.prototype;
	var RangeError$1 = global_1.RangeError;

	var packIEEE754 = ieee754.pack;
	var unpackIEEE754 = ieee754.unpack;

	var packInt8 = function (number) {
	  return [number & 0xFF];
	};

	var packInt16 = function (number) {
	  return [number & 0xFF, number >> 8 & 0xFF];
	};

	var packInt32 = function (number) {
	  return [number & 0xFF, number >> 8 & 0xFF, number >> 16 & 0xFF, number >> 24 & 0xFF];
	};

	var unpackInt32 = function (buffer) {
	  return buffer[3] << 24 | buffer[2] << 16 | buffer[1] << 8 | buffer[0];
	};

	var packFloat32 = function (number) {
	  return packIEEE754(number, 23, 4);
	};

	var packFloat64 = function (number) {
	  return packIEEE754(number, 52, 8);
	};

	var addGetter = function (Constructor, key) {
	  defineProperty$4(Constructor[PROTOTYPE$2], key, { get: function () { return getInternalState$2(this)[key]; } });
	};

	var get$1 = function (view, count, index, isLittleEndian) {
	  var intIndex = toIndex(index);
	  var store = getInternalState$2(view);
	  if (intIndex + count > store.byteLength) throw RangeError$1(WRONG_INDEX);
	  var bytes = getInternalState$2(store.buffer).bytes;
	  var start = intIndex + store.byteOffset;
	  var pack = bytes.slice(start, start + count);
	  return isLittleEndian ? pack : pack.reverse();
	};

	var set$1 = function (view, count, index, conversion, value, isLittleEndian) {
	  var intIndex = toIndex(index);
	  var store = getInternalState$2(view);
	  if (intIndex + count > store.byteLength) throw RangeError$1(WRONG_INDEX);
	  var bytes = getInternalState$2(store.buffer).bytes;
	  var start = intIndex + store.byteOffset;
	  var pack = conversion(+value);
	  for (var i = 0; i < count; i++) bytes[start + i] = pack[isLittleEndian ? i : count - i - 1];
	};

	if (!arrayBufferNative) {
	  $ArrayBuffer = function ArrayBuffer(length) {
	    anInstance(this, $ArrayBuffer, ARRAY_BUFFER);
	    var byteLength = toIndex(length);
	    setInternalState$2(this, {
	      bytes: arrayFill.call(new Array(byteLength), 0),
	      byteLength: byteLength
	    });
	    if (!descriptors) this.byteLength = byteLength;
	  };

	  $DataView = function DataView(buffer, byteOffset, byteLength) {
	    anInstance(this, $DataView, DATA_VIEW);
	    anInstance(buffer, $ArrayBuffer, DATA_VIEW);
	    var bufferLength = getInternalState$2(buffer).byteLength;
	    var offset = toInteger(byteOffset);
	    if (offset < 0 || offset > bufferLength) throw RangeError$1('Wrong offset');
	    byteLength = byteLength === undefined ? bufferLength - offset : toLength(byteLength);
	    if (offset + byteLength > bufferLength) throw RangeError$1(WRONG_LENGTH);
	    setInternalState$2(this, {
	      buffer: buffer,
	      byteLength: byteLength,
	      byteOffset: offset
	    });
	    if (!descriptors) {
	      this.buffer = buffer;
	      this.byteLength = byteLength;
	      this.byteOffset = offset;
	    }
	  };

	  if (descriptors) {
	    addGetter($ArrayBuffer, 'byteLength');
	    addGetter($DataView, 'buffer');
	    addGetter($DataView, 'byteLength');
	    addGetter($DataView, 'byteOffset');
	  }

	  redefineAll($DataView[PROTOTYPE$2], {
	    getInt8: function getInt8(byteOffset) {
	      return get$1(this, 1, byteOffset)[0] << 24 >> 24;
	    },
	    getUint8: function getUint8(byteOffset) {
	      return get$1(this, 1, byteOffset)[0];
	    },
	    getInt16: function getInt16(byteOffset /* , littleEndian */) {
	      var bytes = get$1(this, 2, byteOffset, arguments.length > 1 ? arguments[1] : undefined);
	      return (bytes[1] << 8 | bytes[0]) << 16 >> 16;
	    },
	    getUint16: function getUint16(byteOffset /* , littleEndian */) {
	      var bytes = get$1(this, 2, byteOffset, arguments.length > 1 ? arguments[1] : undefined);
	      return bytes[1] << 8 | bytes[0];
	    },
	    getInt32: function getInt32(byteOffset /* , littleEndian */) {
	      return unpackInt32(get$1(this, 4, byteOffset, arguments.length > 1 ? arguments[1] : undefined));
	    },
	    getUint32: function getUint32(byteOffset /* , littleEndian */) {
	      return unpackInt32(get$1(this, 4, byteOffset, arguments.length > 1 ? arguments[1] : undefined)) >>> 0;
	    },
	    getFloat32: function getFloat32(byteOffset /* , littleEndian */) {
	      return unpackIEEE754(get$1(this, 4, byteOffset, arguments.length > 1 ? arguments[1] : undefined), 23);
	    },
	    getFloat64: function getFloat64(byteOffset /* , littleEndian */) {
	      return unpackIEEE754(get$1(this, 8, byteOffset, arguments.length > 1 ? arguments[1] : undefined), 52);
	    },
	    setInt8: function setInt8(byteOffset, value) {
	      set$1(this, 1, byteOffset, packInt8, value);
	    },
	    setUint8: function setUint8(byteOffset, value) {
	      set$1(this, 1, byteOffset, packInt8, value);
	    },
	    setInt16: function setInt16(byteOffset, value /* , littleEndian */) {
	      set$1(this, 2, byteOffset, packInt16, value, arguments.length > 2 ? arguments[2] : undefined);
	    },
	    setUint16: function setUint16(byteOffset, value /* , littleEndian */) {
	      set$1(this, 2, byteOffset, packInt16, value, arguments.length > 2 ? arguments[2] : undefined);
	    },
	    setInt32: function setInt32(byteOffset, value /* , littleEndian */) {
	      set$1(this, 4, byteOffset, packInt32, value, arguments.length > 2 ? arguments[2] : undefined);
	    },
	    setUint32: function setUint32(byteOffset, value /* , littleEndian */) {
	      set$1(this, 4, byteOffset, packInt32, value, arguments.length > 2 ? arguments[2] : undefined);
	    },
	    setFloat32: function setFloat32(byteOffset, value /* , littleEndian */) {
	      set$1(this, 4, byteOffset, packFloat32, value, arguments.length > 2 ? arguments[2] : undefined);
	    },
	    setFloat64: function setFloat64(byteOffset, value /* , littleEndian */) {
	      set$1(this, 8, byteOffset, packFloat64, value, arguments.length > 2 ? arguments[2] : undefined);
	    }
	  });
	} else {
	  if (!fails(function () {
	    NativeArrayBuffer(1);
	  }) || !fails(function () {
	    new NativeArrayBuffer(-1); // eslint-disable-line no-new
	  }) || fails(function () {
	    new NativeArrayBuffer(); // eslint-disable-line no-new
	    new NativeArrayBuffer(1.5); // eslint-disable-line no-new
	    new NativeArrayBuffer(NaN); // eslint-disable-line no-new
	    return NativeArrayBuffer.name != ARRAY_BUFFER;
	  })) {
	    $ArrayBuffer = function ArrayBuffer(length) {
	      anInstance(this, $ArrayBuffer);
	      return new NativeArrayBuffer(toIndex(length));
	    };
	    var ArrayBufferPrototype = $ArrayBuffer[PROTOTYPE$2] = NativeArrayBuffer[PROTOTYPE$2];
	    for (var keys$1 = getOwnPropertyNames(NativeArrayBuffer), j = 0, key; keys$1.length > j;) {
	      if (!((key = keys$1[j++]) in $ArrayBuffer)) {
	        createNonEnumerableProperty($ArrayBuffer, key, NativeArrayBuffer[key]);
	      }
	    }
	    ArrayBufferPrototype.constructor = $ArrayBuffer;
	  }

	  // WebKit bug - the same parent prototype for typed arrays and data view
	  if (objectSetPrototypeOf && objectGetPrototypeOf($DataViewPrototype) !== ObjectPrototype$2) {
	    objectSetPrototypeOf($DataViewPrototype, ObjectPrototype$2);
	  }

	  // iOS Safari 7.x bug
	  var testView = new $DataView(new $ArrayBuffer(2));
	  var nativeSetInt8 = $DataViewPrototype.setInt8;
	  testView.setInt8(0, 2147483648);
	  testView.setInt8(1, 2147483649);
	  if (testView.getInt8(0) || !testView.getInt8(1)) redefineAll($DataViewPrototype, {
	    setInt8: function setInt8(byteOffset, value) {
	      nativeSetInt8.call(this, byteOffset, value << 24 >> 24);
	    },
	    setUint8: function setUint8(byteOffset, value) {
	      nativeSetInt8.call(this, byteOffset, value << 24 >> 24);
	    }
	  }, { unsafe: true });
	}

	setToStringTag($ArrayBuffer, ARRAY_BUFFER);
	setToStringTag($DataView, DATA_VIEW);

	var arrayBuffer = {
	  ArrayBuffer: $ArrayBuffer,
	  DataView: $DataView
	};

	var ARRAY_BUFFER$1 = 'ArrayBuffer';
	var ArrayBuffer$1 = arrayBuffer[ARRAY_BUFFER$1];
	var NativeArrayBuffer$1 = global_1[ARRAY_BUFFER$1];

	// `ArrayBuffer` constructor
	// https://tc39.github.io/ecma262/#sec-arraybuffer-constructor
	_export({ global: true, forced: NativeArrayBuffer$1 !== ArrayBuffer$1 }, {
	  ArrayBuffer: ArrayBuffer$1
	});

	setSpecies(ARRAY_BUFFER$1);

	var dateToPrimitive = function (hint) {
	  if (hint !== 'string' && hint !== 'number' && hint !== 'default') {
	    throw TypeError('Incorrect hint');
	  } return toPrimitive(anObject(this), hint !== 'number');
	};

	var TO_PRIMITIVE$1 = wellKnownSymbol('toPrimitive');
	var DatePrototype = Date.prototype;

	// `Date.prototype[@@toPrimitive]` method
	// https://tc39.github.io/ecma262/#sec-date.prototype-@@toprimitive
	if (!(TO_PRIMITIVE$1 in DatePrototype)) {
	  createNonEnumerableProperty(DatePrototype, TO_PRIMITIVE$1, dateToPrimitive);
	}

	var HAS_INSTANCE = wellKnownSymbol('hasInstance');
	var FunctionPrototype = Function.prototype;

	// `Function.prototype[@@hasInstance]` method
	// https://tc39.github.io/ecma262/#sec-function.prototype-@@hasinstance
	if (!(HAS_INSTANCE in FunctionPrototype)) {
	  objectDefineProperty.f(FunctionPrototype, HAS_INSTANCE, { value: function (O) {
	    if (typeof this != 'function' || !isObject(O)) return false;
	    if (!isObject(this.prototype)) return O instanceof this;
	    // for environment w/o native `@@hasInstance` logic enough `instanceof`, but add this:
	    while (O = objectGetPrototypeOf(O)) if (this.prototype === O) return true;
	    return false;
	  } });
	}

	var defineProperty$5 = objectDefineProperty.f;

	var FunctionPrototype$1 = Function.prototype;
	var FunctionPrototypeToString = FunctionPrototype$1.toString;
	var nameRE = /^\s*function ([^ (]*)/;
	var NAME = 'name';

	// Function instances `.name` property
	// https://tc39.github.io/ecma262/#sec-function-instances-name
	if (descriptors && !(NAME in FunctionPrototype$1)) {
	  defineProperty$5(FunctionPrototype$1, NAME, {
	    configurable: true,
	    get: function () {
	      try {
	        return FunctionPrototypeToString.call(this).match(nameRE)[1];
	      } catch (error) {
	        return '';
	      }
	    }
	  });
	}

	// JSON[@@toStringTag] property
	// https://tc39.github.io/ecma262/#sec-json-@@tostringtag
	setToStringTag(global_1.JSON, 'JSON', true);

	var freezing = !fails(function () {
	  return Object.isExtensible(Object.preventExtensions({}));
	});

	var internalMetadata = createCommonjsModule(function (module) {
	var defineProperty = objectDefineProperty.f;



	var METADATA = uid('meta');
	var id = 0;

	var isExtensible = Object.isExtensible || function () {
	  return true;
	};

	var setMetadata = function (it) {
	  defineProperty(it, METADATA, { value: {
	    objectID: 'O' + ++id, // object ID
	    weakData: {}          // weak collections IDs
	  } });
	};

	var fastKey = function (it, create) {
	  // return a primitive with prefix
	  if (!isObject(it)) return typeof it == 'symbol' ? it : (typeof it == 'string' ? 'S' : 'P') + it;
	  if (!has(it, METADATA)) {
	    // can't set metadata to uncaught frozen object
	    if (!isExtensible(it)) return 'F';
	    // not necessary to add metadata
	    if (!create) return 'E';
	    // add missing metadata
	    setMetadata(it);
	  // return object ID
	  } return it[METADATA].objectID;
	};

	var getWeakData = function (it, create) {
	  if (!has(it, METADATA)) {
	    // can't set metadata to uncaught frozen object
	    if (!isExtensible(it)) return true;
	    // not necessary to add metadata
	    if (!create) return false;
	    // add missing metadata
	    setMetadata(it);
	  // return the store of weak collections IDs
	  } return it[METADATA].weakData;
	};

	// add metadata on freeze-family methods calling
	var onFreeze = function (it) {
	  if (freezing && meta.REQUIRED && isExtensible(it) && !has(it, METADATA)) setMetadata(it);
	  return it;
	};

	var meta = module.exports = {
	  REQUIRED: false,
	  fastKey: fastKey,
	  getWeakData: getWeakData,
	  onFreeze: onFreeze
	};

	hiddenKeys[METADATA] = true;
	});

	var iterate_1 = createCommonjsModule(function (module) {
	var Result = function (stopped, result) {
	  this.stopped = stopped;
	  this.result = result;
	};

	var iterate = module.exports = function (iterable, fn, that, AS_ENTRIES, IS_ITERATOR) {
	  var boundFunction = functionBindContext(fn, that, AS_ENTRIES ? 2 : 1);
	  var iterator, iterFn, index, length, result, next, step;

	  if (IS_ITERATOR) {
	    iterator = iterable;
	  } else {
	    iterFn = getIteratorMethod(iterable);
	    if (typeof iterFn != 'function') throw TypeError('Target is not iterable');
	    // optimisation for array iterators
	    if (isArrayIteratorMethod(iterFn)) {
	      for (index = 0, length = toLength(iterable.length); length > index; index++) {
	        result = AS_ENTRIES
	          ? boundFunction(anObject(step = iterable[index])[0], step[1])
	          : boundFunction(iterable[index]);
	        if (result && result instanceof Result) return result;
	      } return new Result(false);
	    }
	    iterator = iterFn.call(iterable);
	  }

	  next = iterator.next;
	  while (!(step = next.call(iterator)).done) {
	    result = callWithSafeIterationClosing(iterator, boundFunction, step.value, AS_ENTRIES);
	    if (typeof result == 'object' && result && result instanceof Result) return result;
	  } return new Result(false);
	};

	iterate.stop = function (result) {
	  return new Result(true, result);
	};
	});

	// makes subclassing work correct for wrapped built-ins
	var inheritIfRequired = function ($this, dummy, Wrapper) {
	  var NewTarget, NewTargetPrototype;
	  if (
	    // it can work only with native `setPrototypeOf`
	    objectSetPrototypeOf &&
	    // we haven't completely correct pre-ES6 way for getting `new.target`, so use this
	    typeof (NewTarget = dummy.constructor) == 'function' &&
	    NewTarget !== Wrapper &&
	    isObject(NewTargetPrototype = NewTarget.prototype) &&
	    NewTargetPrototype !== Wrapper.prototype
	  ) objectSetPrototypeOf($this, NewTargetPrototype);
	  return $this;
	};

	var collection = function (CONSTRUCTOR_NAME, wrapper, common) {
	  var IS_MAP = CONSTRUCTOR_NAME.indexOf('Map') !== -1;
	  var IS_WEAK = CONSTRUCTOR_NAME.indexOf('Weak') !== -1;
	  var ADDER = IS_MAP ? 'set' : 'add';
	  var NativeConstructor = global_1[CONSTRUCTOR_NAME];
	  var NativePrototype = NativeConstructor && NativeConstructor.prototype;
	  var Constructor = NativeConstructor;
	  var exported = {};

	  var fixMethod = function (KEY) {
	    var nativeMethod = NativePrototype[KEY];
	    redefine(NativePrototype, KEY,
	      KEY == 'add' ? function add(value) {
	        nativeMethod.call(this, value === 0 ? 0 : value);
	        return this;
	      } : KEY == 'delete' ? function (key) {
	        return IS_WEAK && !isObject(key) ? false : nativeMethod.call(this, key === 0 ? 0 : key);
	      } : KEY == 'get' ? function get(key) {
	        return IS_WEAK && !isObject(key) ? undefined : nativeMethod.call(this, key === 0 ? 0 : key);
	      } : KEY == 'has' ? function has(key) {
	        return IS_WEAK && !isObject(key) ? false : nativeMethod.call(this, key === 0 ? 0 : key);
	      } : function set(key, value) {
	        nativeMethod.call(this, key === 0 ? 0 : key, value);
	        return this;
	      }
	    );
	  };

	  // eslint-disable-next-line max-len
	  if (isForced_1(CONSTRUCTOR_NAME, typeof NativeConstructor != 'function' || !(IS_WEAK || NativePrototype.forEach && !fails(function () {
	    new NativeConstructor().entries().next();
	  })))) {
	    // create collection constructor
	    Constructor = common.getConstructor(wrapper, CONSTRUCTOR_NAME, IS_MAP, ADDER);
	    internalMetadata.REQUIRED = true;
	  } else if (isForced_1(CONSTRUCTOR_NAME, true)) {
	    var instance = new Constructor();
	    // early implementations not supports chaining
	    var HASNT_CHAINING = instance[ADDER](IS_WEAK ? {} : -0, 1) != instance;
	    // V8 ~ Chromium 40- weak-collections throws on primitives, but should return false
	    var THROWS_ON_PRIMITIVES = fails(function () { instance.has(1); });
	    // most early implementations doesn't supports iterables, most modern - not close it correctly
	    // eslint-disable-next-line no-new
	    var ACCEPT_ITERABLES = checkCorrectnessOfIteration(function (iterable) { new NativeConstructor(iterable); });
	    // for early implementations -0 and +0 not the same
	    var BUGGY_ZERO = !IS_WEAK && fails(function () {
	      // V8 ~ Chromium 42- fails only with 5+ elements
	      var $instance = new NativeConstructor();
	      var index = 5;
	      while (index--) $instance[ADDER](index, index);
	      return !$instance.has(-0);
	    });

	    if (!ACCEPT_ITERABLES) {
	      Constructor = wrapper(function (dummy, iterable) {
	        anInstance(dummy, Constructor, CONSTRUCTOR_NAME);
	        var that = inheritIfRequired(new NativeConstructor(), dummy, Constructor);
	        if (iterable != undefined) iterate_1(iterable, that[ADDER], that, IS_MAP);
	        return that;
	      });
	      Constructor.prototype = NativePrototype;
	      NativePrototype.constructor = Constructor;
	    }

	    if (THROWS_ON_PRIMITIVES || BUGGY_ZERO) {
	      fixMethod('delete');
	      fixMethod('has');
	      IS_MAP && fixMethod('get');
	    }

	    if (BUGGY_ZERO || HASNT_CHAINING) fixMethod(ADDER);

	    // weak collections should not contains .clear method
	    if (IS_WEAK && NativePrototype.clear) delete NativePrototype.clear;
	  }

	  exported[CONSTRUCTOR_NAME] = Constructor;
	  _export({ global: true, forced: Constructor != NativeConstructor }, exported);

	  setToStringTag(Constructor, CONSTRUCTOR_NAME);

	  if (!IS_WEAK) common.setStrong(Constructor, CONSTRUCTOR_NAME, IS_MAP);

	  return Constructor;
	};

	var defineProperty$6 = objectDefineProperty.f;








	var fastKey = internalMetadata.fastKey;


	var setInternalState$3 = internalState.set;
	var internalStateGetterFor = internalState.getterFor;

	var collectionStrong = {
	  getConstructor: function (wrapper, CONSTRUCTOR_NAME, IS_MAP, ADDER) {
	    var C = wrapper(function (that, iterable) {
	      anInstance(that, C, CONSTRUCTOR_NAME);
	      setInternalState$3(that, {
	        type: CONSTRUCTOR_NAME,
	        index: objectCreate(null),
	        first: undefined,
	        last: undefined,
	        size: 0
	      });
	      if (!descriptors) that.size = 0;
	      if (iterable != undefined) iterate_1(iterable, that[ADDER], that, IS_MAP);
	    });

	    var getInternalState = internalStateGetterFor(CONSTRUCTOR_NAME);

	    var define = function (that, key, value) {
	      var state = getInternalState(that);
	      var entry = getEntry(that, key);
	      var previous, index;
	      // change existing entry
	      if (entry) {
	        entry.value = value;
	      // create new entry
	      } else {
	        state.last = entry = {
	          index: index = fastKey(key, true),
	          key: key,
	          value: value,
	          previous: previous = state.last,
	          next: undefined,
	          removed: false
	        };
	        if (!state.first) state.first = entry;
	        if (previous) previous.next = entry;
	        if (descriptors) state.size++;
	        else that.size++;
	        // add to index
	        if (index !== 'F') state.index[index] = entry;
	      } return that;
	    };

	    var getEntry = function (that, key) {
	      var state = getInternalState(that);
	      // fast case
	      var index = fastKey(key);
	      var entry;
	      if (index !== 'F') return state.index[index];
	      // frozen object case
	      for (entry = state.first; entry; entry = entry.next) {
	        if (entry.key == key) return entry;
	      }
	    };

	    redefineAll(C.prototype, {
	      // 23.1.3.1 Map.prototype.clear()
	      // 23.2.3.2 Set.prototype.clear()
	      clear: function clear() {
	        var that = this;
	        var state = getInternalState(that);
	        var data = state.index;
	        var entry = state.first;
	        while (entry) {
	          entry.removed = true;
	          if (entry.previous) entry.previous = entry.previous.next = undefined;
	          delete data[entry.index];
	          entry = entry.next;
	        }
	        state.first = state.last = undefined;
	        if (descriptors) state.size = 0;
	        else that.size = 0;
	      },
	      // 23.1.3.3 Map.prototype.delete(key)
	      // 23.2.3.4 Set.prototype.delete(value)
	      'delete': function (key) {
	        var that = this;
	        var state = getInternalState(that);
	        var entry = getEntry(that, key);
	        if (entry) {
	          var next = entry.next;
	          var prev = entry.previous;
	          delete state.index[entry.index];
	          entry.removed = true;
	          if (prev) prev.next = next;
	          if (next) next.previous = prev;
	          if (state.first == entry) state.first = next;
	          if (state.last == entry) state.last = prev;
	          if (descriptors) state.size--;
	          else that.size--;
	        } return !!entry;
	      },
	      // 23.2.3.6 Set.prototype.forEach(callbackfn, thisArg = undefined)
	      // 23.1.3.5 Map.prototype.forEach(callbackfn, thisArg = undefined)
	      forEach: function forEach(callbackfn /* , that = undefined */) {
	        var state = getInternalState(this);
	        var boundFunction = functionBindContext(callbackfn, arguments.length > 1 ? arguments[1] : undefined, 3);
	        var entry;
	        while (entry = entry ? entry.next : state.first) {
	          boundFunction(entry.value, entry.key, this);
	          // revert to the last existing entry
	          while (entry && entry.removed) entry = entry.previous;
	        }
	      },
	      // 23.1.3.7 Map.prototype.has(key)
	      // 23.2.3.7 Set.prototype.has(value)
	      has: function has(key) {
	        return !!getEntry(this, key);
	      }
	    });

	    redefineAll(C.prototype, IS_MAP ? {
	      // 23.1.3.6 Map.prototype.get(key)
	      get: function get(key) {
	        var entry = getEntry(this, key);
	        return entry && entry.value;
	      },
	      // 23.1.3.9 Map.prototype.set(key, value)
	      set: function set(key, value) {
	        return define(this, key === 0 ? 0 : key, value);
	      }
	    } : {
	      // 23.2.3.1 Set.prototype.add(value)
	      add: function add(value) {
	        return define(this, value = value === 0 ? 0 : value, value);
	      }
	    });
	    if (descriptors) defineProperty$6(C.prototype, 'size', {
	      get: function () {
	        return getInternalState(this).size;
	      }
	    });
	    return C;
	  },
	  setStrong: function (C, CONSTRUCTOR_NAME, IS_MAP) {
	    var ITERATOR_NAME = CONSTRUCTOR_NAME + ' Iterator';
	    var getInternalCollectionState = internalStateGetterFor(CONSTRUCTOR_NAME);
	    var getInternalIteratorState = internalStateGetterFor(ITERATOR_NAME);
	    // add .keys, .values, .entries, [@@iterator]
	    // 23.1.3.4, 23.1.3.8, 23.1.3.11, 23.1.3.12, 23.2.3.5, 23.2.3.8, 23.2.3.10, 23.2.3.11
	    defineIterator(C, CONSTRUCTOR_NAME, function (iterated, kind) {
	      setInternalState$3(this, {
	        type: ITERATOR_NAME,
	        target: iterated,
	        state: getInternalCollectionState(iterated),
	        kind: kind,
	        last: undefined
	      });
	    }, function () {
	      var state = getInternalIteratorState(this);
	      var kind = state.kind;
	      var entry = state.last;
	      // revert to the last existing entry
	      while (entry && entry.removed) entry = entry.previous;
	      // get next entry
	      if (!state.target || !(state.last = entry = entry ? entry.next : state.state.first)) {
	        // or finish the iteration
	        state.target = undefined;
	        return { value: undefined, done: true };
	      }
	      // return step by kind
	      if (kind == 'keys') return { value: entry.key, done: false };
	      if (kind == 'values') return { value: entry.value, done: false };
	      return { value: [entry.key, entry.value], done: false };
	    }, IS_MAP ? 'entries' : 'values', !IS_MAP, true);

	    // add [@@species], 23.1.2.2, 23.2.2.2
	    setSpecies(CONSTRUCTOR_NAME);
	  }
	};

	// `Map` constructor
	// https://tc39.github.io/ecma262/#sec-map-objects
	var es_map = collection('Map', function (init) {
	  return function Map() { return init(this, arguments.length ? arguments[0] : undefined); };
	}, collectionStrong);

	var log$1 = Math.log;

	// `Math.log1p` method implementation
	// https://tc39.github.io/ecma262/#sec-math.log1p
	var mathLog1p = Math.log1p || function log1p(x) {
	  return (x = +x) > -1e-8 && x < 1e-8 ? x - x * x / 2 : log$1(1 + x);
	};

	var nativeAcosh = Math.acosh;
	var log$2 = Math.log;
	var sqrt = Math.sqrt;
	var LN2$1 = Math.LN2;

	var FORCED$2 = !nativeAcosh
	  // V8 bug: https://code.google.com/p/v8/issues/detail?id=3509
	  || Math.floor(nativeAcosh(Number.MAX_VALUE)) != 710
	  // Tor Browser bug: Math.acosh(Infinity) -> NaN
	  || nativeAcosh(Infinity) != Infinity;

	// `Math.acosh` method
	// https://tc39.github.io/ecma262/#sec-math.acosh
	_export({ target: 'Math', stat: true, forced: FORCED$2 }, {
	  acosh: function acosh(x) {
	    return (x = +x) < 1 ? NaN : x > 94906265.62425156
	      ? log$2(x) + LN2$1
	      : mathLog1p(x - 1 + sqrt(x - 1) * sqrt(x + 1));
	  }
	});

	var nativeAsinh = Math.asinh;
	var log$3 = Math.log;
	var sqrt$1 = Math.sqrt;

	function asinh(x) {
	  return !isFinite(x = +x) || x == 0 ? x : x < 0 ? -asinh(-x) : log$3(x + sqrt$1(x * x + 1));
	}

	// `Math.asinh` method
	// https://tc39.github.io/ecma262/#sec-math.asinh
	// Tor Browser bug: Math.asinh(0) -> -0
	_export({ target: 'Math', stat: true, forced: !(nativeAsinh && 1 / nativeAsinh(0) > 0) }, {
	  asinh: asinh
	});

	var nativeAtanh = Math.atanh;
	var log$4 = Math.log;

	// `Math.atanh` method
	// https://tc39.github.io/ecma262/#sec-math.atanh
	// Tor Browser bug: Math.atanh(-0) -> 0
	_export({ target: 'Math', stat: true, forced: !(nativeAtanh && 1 / nativeAtanh(-0) < 0) }, {
	  atanh: function atanh(x) {
	    return (x = +x) == 0 ? x : log$4((1 + x) / (1 - x)) / 2;
	  }
	});

	// `Math.sign` method implementation
	// https://tc39.github.io/ecma262/#sec-math.sign
	var mathSign = Math.sign || function sign(x) {
	  // eslint-disable-next-line no-self-compare
	  return (x = +x) == 0 || x != x ? x : x < 0 ? -1 : 1;
	};

	var abs$1 = Math.abs;
	var pow$1 = Math.pow;

	// `Math.cbrt` method
	// https://tc39.github.io/ecma262/#sec-math.cbrt
	_export({ target: 'Math', stat: true }, {
	  cbrt: function cbrt(x) {
	    return mathSign(x = +x) * pow$1(abs$1(x), 1 / 3);
	  }
	});

	var floor$2 = Math.floor;
	var log$5 = Math.log;
	var LOG2E = Math.LOG2E;

	// `Math.clz32` method
	// https://tc39.github.io/ecma262/#sec-math.clz32
	_export({ target: 'Math', stat: true }, {
	  clz32: function clz32(x) {
	    return (x >>>= 0) ? 31 - floor$2(log$5(x + 0.5) * LOG2E) : 32;
	  }
	});

	var nativeExpm1 = Math.expm1;
	var exp = Math.exp;

	// `Math.expm1` method implementation
	// https://tc39.github.io/ecma262/#sec-math.expm1
	var mathExpm1 = (!nativeExpm1
	  // Old FF bug
	  || nativeExpm1(10) > 22025.465794806719 || nativeExpm1(10) < 22025.4657948067165168
	  // Tor Browser bug
	  || nativeExpm1(-2e-17) != -2e-17
	) ? function expm1(x) {
	  return (x = +x) == 0 ? x : x > -1e-6 && x < 1e-6 ? x + x * x / 2 : exp(x) - 1;
	} : nativeExpm1;

	var nativeCosh = Math.cosh;
	var abs$2 = Math.abs;
	var E = Math.E;

	// `Math.cosh` method
	// https://tc39.github.io/ecma262/#sec-math.cosh
	_export({ target: 'Math', stat: true, forced: !nativeCosh || nativeCosh(710) === Infinity }, {
	  cosh: function cosh(x) {
	    var t = mathExpm1(abs$2(x) - 1) + 1;
	    return (t + 1 / (t * E * E)) * (E / 2);
	  }
	});

	// `Math.expm1` method
	// https://tc39.github.io/ecma262/#sec-math.expm1
	_export({ target: 'Math', stat: true, forced: mathExpm1 != Math.expm1 }, { expm1: mathExpm1 });

	var abs$3 = Math.abs;
	var pow$2 = Math.pow;
	var EPSILON = pow$2(2, -52);
	var EPSILON32 = pow$2(2, -23);
	var MAX32 = pow$2(2, 127) * (2 - EPSILON32);
	var MIN32 = pow$2(2, -126);

	var roundTiesToEven = function (n) {
	  return n + 1 / EPSILON - 1 / EPSILON;
	};

	// `Math.fround` method implementation
	// https://tc39.github.io/ecma262/#sec-math.fround
	var mathFround = Math.fround || function fround(x) {
	  var $abs = abs$3(x);
	  var $sign = mathSign(x);
	  var a, result;
	  if ($abs < MIN32) return $sign * roundTiesToEven($abs / MIN32 / EPSILON32) * MIN32 * EPSILON32;
	  a = (1 + EPSILON32 / EPSILON) * $abs;
	  result = a - (a - $abs);
	  // eslint-disable-next-line no-self-compare
	  if (result > MAX32 || result != result) return $sign * Infinity;
	  return $sign * result;
	};

	// `Math.fround` method
	// https://tc39.github.io/ecma262/#sec-math.fround
	_export({ target: 'Math', stat: true }, { fround: mathFround });

	var $hypot = Math.hypot;
	var abs$4 = Math.abs;
	var sqrt$2 = Math.sqrt;

	// Chrome 77 bug
	// https://bugs.chromium.org/p/v8/issues/detail?id=9546
	var BUGGY = !!$hypot && $hypot(Infinity, NaN) !== Infinity;

	// `Math.hypot` method
	// https://tc39.github.io/ecma262/#sec-math.hypot
	_export({ target: 'Math', stat: true, forced: BUGGY }, {
	  hypot: function hypot(value1, value2) { // eslint-disable-line no-unused-vars
	    var sum = 0;
	    var i = 0;
	    var aLen = arguments.length;
	    var larg = 0;
	    var arg, div;
	    while (i < aLen) {
	      arg = abs$4(arguments[i++]);
	      if (larg < arg) {
	        div = larg / arg;
	        sum = sum * div * div + 1;
	        larg = arg;
	      } else if (arg > 0) {
	        div = arg / larg;
	        sum += div * div;
	      } else sum += arg;
	    }
	    return larg === Infinity ? Infinity : larg * sqrt$2(sum);
	  }
	});

	var nativeImul = Math.imul;

	var FORCED$3 = fails(function () {
	  return nativeImul(0xFFFFFFFF, 5) != -5 || nativeImul.length != 2;
	});

	// `Math.imul` method
	// https://tc39.github.io/ecma262/#sec-math.imul
	// some WebKit versions fails with big numbers, some has wrong arity
	_export({ target: 'Math', stat: true, forced: FORCED$3 }, {
	  imul: function imul(x, y) {
	    var UINT16 = 0xFFFF;
	    var xn = +x;
	    var yn = +y;
	    var xl = UINT16 & xn;
	    var yl = UINT16 & yn;
	    return 0 | xl * yl + ((UINT16 & xn >>> 16) * yl + xl * (UINT16 & yn >>> 16) << 16 >>> 0);
	  }
	});

	var log$6 = Math.log;
	var LOG10E = Math.LOG10E;

	// `Math.log10` method
	// https://tc39.github.io/ecma262/#sec-math.log10
	_export({ target: 'Math', stat: true }, {
	  log10: function log10(x) {
	    return log$6(x) * LOG10E;
	  }
	});

	// `Math.log1p` method
	// https://tc39.github.io/ecma262/#sec-math.log1p
	_export({ target: 'Math', stat: true }, { log1p: mathLog1p });

	var log$7 = Math.log;
	var LN2$2 = Math.LN2;

	// `Math.log2` method
	// https://tc39.github.io/ecma262/#sec-math.log2
	_export({ target: 'Math', stat: true }, {
	  log2: function log2(x) {
	    return log$7(x) / LN2$2;
	  }
	});

	// `Math.sign` method
	// https://tc39.github.io/ecma262/#sec-math.sign
	_export({ target: 'Math', stat: true }, {
	  sign: mathSign
	});

	var abs$5 = Math.abs;
	var exp$1 = Math.exp;
	var E$1 = Math.E;

	var FORCED$4 = fails(function () {
	  return Math.sinh(-2e-17) != -2e-17;
	});

	// `Math.sinh` method
	// https://tc39.github.io/ecma262/#sec-math.sinh
	// V8 near Chromium 38 has a problem with very small numbers
	_export({ target: 'Math', stat: true, forced: FORCED$4 }, {
	  sinh: function sinh(x) {
	    return abs$5(x = +x) < 1 ? (mathExpm1(x) - mathExpm1(-x)) / 2 : (exp$1(x - 1) - exp$1(-x - 1)) * (E$1 / 2);
	  }
	});

	var exp$2 = Math.exp;

	// `Math.tanh` method
	// https://tc39.github.io/ecma262/#sec-math.tanh
	_export({ target: 'Math', stat: true }, {
	  tanh: function tanh(x) {
	    var a = mathExpm1(x = +x);
	    var b = mathExpm1(-x);
	    return a == Infinity ? 1 : b == Infinity ? -1 : (a - b) / (exp$2(x) + exp$2(-x));
	  }
	});

	// Math[@@toStringTag] property
	// https://tc39.github.io/ecma262/#sec-math-@@tostringtag
	setToStringTag(Math, 'Math', true);

	var ceil$1 = Math.ceil;
	var floor$3 = Math.floor;

	// `Math.trunc` method
	// https://tc39.github.io/ecma262/#sec-math.trunc
	_export({ target: 'Math', stat: true }, {
	  trunc: function trunc(it) {
	    return (it > 0 ? floor$3 : ceil$1)(it);
	  }
	});

	// a string of all valid unicode whitespaces
	// eslint-disable-next-line max-len
	var whitespaces = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

	var whitespace = '[' + whitespaces + ']';
	var ltrim = RegExp('^' + whitespace + whitespace + '*');
	var rtrim = RegExp(whitespace + whitespace + '*$');

	// `String.prototype.{ trim, trimStart, trimEnd, trimLeft, trimRight }` methods implementation
	var createMethod$3 = function (TYPE) {
	  return function ($this) {
	    var string = String(requireObjectCoercible($this));
	    if (TYPE & 1) string = string.replace(ltrim, '');
	    if (TYPE & 2) string = string.replace(rtrim, '');
	    return string;
	  };
	};

	var stringTrim = {
	  // `String.prototype.{ trimLeft, trimStart }` methods
	  // https://tc39.github.io/ecma262/#sec-string.prototype.trimstart
	  start: createMethod$3(1),
	  // `String.prototype.{ trimRight, trimEnd }` methods
	  // https://tc39.github.io/ecma262/#sec-string.prototype.trimend
	  end: createMethod$3(2),
	  // `String.prototype.trim` method
	  // https://tc39.github.io/ecma262/#sec-string.prototype.trim
	  trim: createMethod$3(3)
	};

	var getOwnPropertyNames$1 = objectGetOwnPropertyNames.f;
	var getOwnPropertyDescriptor$2 = objectGetOwnPropertyDescriptor.f;
	var defineProperty$7 = objectDefineProperty.f;
	var trim = stringTrim.trim;

	var NUMBER = 'Number';
	var NativeNumber = global_1[NUMBER];
	var NumberPrototype = NativeNumber.prototype;

	// Opera ~12 has broken Object#toString
	var BROKEN_CLASSOF = classofRaw(objectCreate(NumberPrototype)) == NUMBER;

	// `ToNumber` abstract operation
	// https://tc39.github.io/ecma262/#sec-tonumber
	var toNumber = function (argument) {
	  var it = toPrimitive(argument, false);
	  var first, third, radix, maxCode, digits, length, index, code;
	  if (typeof it == 'string' && it.length > 2) {
	    it = trim(it);
	    first = it.charCodeAt(0);
	    if (first === 43 || first === 45) {
	      third = it.charCodeAt(2);
	      if (third === 88 || third === 120) return NaN; // Number('+0x1') should be NaN, old V8 fix
	    } else if (first === 48) {
	      switch (it.charCodeAt(1)) {
	        case 66: case 98: radix = 2; maxCode = 49; break; // fast equal of /^0b[01]+$/i
	        case 79: case 111: radix = 8; maxCode = 55; break; // fast equal of /^0o[0-7]+$/i
	        default: return +it;
	      }
	      digits = it.slice(2);
	      length = digits.length;
	      for (index = 0; index < length; index++) {
	        code = digits.charCodeAt(index);
	        // parseInt parses a string to a first unavailable symbol
	        // but ToNumber should return NaN if a string contains unavailable symbols
	        if (code < 48 || code > maxCode) return NaN;
	      } return parseInt(digits, radix);
	    }
	  } return +it;
	};

	// `Number` constructor
	// https://tc39.github.io/ecma262/#sec-number-constructor
	if (isForced_1(NUMBER, !NativeNumber(' 0o1') || !NativeNumber('0b1') || NativeNumber('+0x1'))) {
	  var NumberWrapper = function Number(value) {
	    var it = arguments.length < 1 ? 0 : value;
	    var dummy = this;
	    return dummy instanceof NumberWrapper
	      // check on 1..constructor(foo) case
	      && (BROKEN_CLASSOF ? fails(function () { NumberPrototype.valueOf.call(dummy); }) : classofRaw(dummy) != NUMBER)
	        ? inheritIfRequired(new NativeNumber(toNumber(it)), dummy, NumberWrapper) : toNumber(it);
	  };
	  for (var keys$2 = descriptors ? getOwnPropertyNames$1(NativeNumber) : (
	    // ES3:
	    'MAX_VALUE,MIN_VALUE,NaN,NEGATIVE_INFINITY,POSITIVE_INFINITY,' +
	    // ES2015 (in case, if modules with ES2015 Number statics required before):
	    'EPSILON,isFinite,isInteger,isNaN,isSafeInteger,MAX_SAFE_INTEGER,' +
	    'MIN_SAFE_INTEGER,parseFloat,parseInt,isInteger'
	  ).split(','), j$1 = 0, key$1; keys$2.length > j$1; j$1++) {
	    if (has(NativeNumber, key$1 = keys$2[j$1]) && !has(NumberWrapper, key$1)) {
	      defineProperty$7(NumberWrapper, key$1, getOwnPropertyDescriptor$2(NativeNumber, key$1));
	    }
	  }
	  NumberWrapper.prototype = NumberPrototype;
	  NumberPrototype.constructor = NumberWrapper;
	  redefine(global_1, NUMBER, NumberWrapper);
	}

	// `Number.EPSILON` constant
	// https://tc39.github.io/ecma262/#sec-number.epsilon
	_export({ target: 'Number', stat: true }, {
	  EPSILON: Math.pow(2, -52)
	});

	var globalIsFinite = global_1.isFinite;

	// `Number.isFinite` method
	// https://tc39.github.io/ecma262/#sec-number.isfinite
	var numberIsFinite = Number.isFinite || function isFinite(it) {
	  return typeof it == 'number' && globalIsFinite(it);
	};

	// `Number.isFinite` method
	// https://tc39.github.io/ecma262/#sec-number.isfinite
	_export({ target: 'Number', stat: true }, { isFinite: numberIsFinite });

	var floor$4 = Math.floor;

	// `Number.isInteger` method implementation
	// https://tc39.github.io/ecma262/#sec-number.isinteger
	var isInteger = function isInteger(it) {
	  return !isObject(it) && isFinite(it) && floor$4(it) === it;
	};

	// `Number.isInteger` method
	// https://tc39.github.io/ecma262/#sec-number.isinteger
	_export({ target: 'Number', stat: true }, {
	  isInteger: isInteger
	});

	// `Number.isNaN` method
	// https://tc39.github.io/ecma262/#sec-number.isnan
	_export({ target: 'Number', stat: true }, {
	  isNaN: function isNaN(number) {
	    // eslint-disable-next-line no-self-compare
	    return number != number;
	  }
	});

	var abs$6 = Math.abs;

	// `Number.isSafeInteger` method
	// https://tc39.github.io/ecma262/#sec-number.issafeinteger
	_export({ target: 'Number', stat: true }, {
	  isSafeInteger: function isSafeInteger(number) {
	    return isInteger(number) && abs$6(number) <= 0x1FFFFFFFFFFFFF;
	  }
	});

	// `Number.MAX_SAFE_INTEGER` constant
	// https://tc39.github.io/ecma262/#sec-number.max_safe_integer
	_export({ target: 'Number', stat: true }, {
	  MAX_SAFE_INTEGER: 0x1FFFFFFFFFFFFF
	});

	// `Number.MIN_SAFE_INTEGER` constant
	// https://tc39.github.io/ecma262/#sec-number.min_safe_integer
	_export({ target: 'Number', stat: true }, {
	  MIN_SAFE_INTEGER: -0x1FFFFFFFFFFFFF
	});

	var trim$1 = stringTrim.trim;


	var $parseFloat = global_1.parseFloat;
	var FORCED$5 = 1 / $parseFloat(whitespaces + '-0') !== -Infinity;

	// `parseFloat` method
	// https://tc39.github.io/ecma262/#sec-parsefloat-string
	var numberParseFloat = FORCED$5 ? function parseFloat(string) {
	  var trimmedString = trim$1(String(string));
	  var result = $parseFloat(trimmedString);
	  return result === 0 && trimmedString.charAt(0) == '-' ? -0 : result;
	} : $parseFloat;

	// `Number.parseFloat` method
	// https://tc39.github.io/ecma262/#sec-number.parseFloat
	_export({ target: 'Number', stat: true, forced: Number.parseFloat != numberParseFloat }, {
	  parseFloat: numberParseFloat
	});

	var trim$2 = stringTrim.trim;


	var $parseInt = global_1.parseInt;
	var hex = /^[+-]?0[Xx]/;
	var FORCED$6 = $parseInt(whitespaces + '08') !== 8 || $parseInt(whitespaces + '0x16') !== 22;

	// `parseInt` method
	// https://tc39.github.io/ecma262/#sec-parseint-string-radix
	var numberParseInt = FORCED$6 ? function parseInt(string, radix) {
	  var S = trim$2(String(string));
	  return $parseInt(S, (radix >>> 0) || (hex.test(S) ? 16 : 10));
	} : $parseInt;

	// `Number.parseInt` method
	// https://tc39.github.io/ecma262/#sec-number.parseint
	_export({ target: 'Number', stat: true, forced: Number.parseInt != numberParseInt }, {
	  parseInt: numberParseInt
	});

	// `thisNumberValue` abstract operation
	// https://tc39.github.io/ecma262/#sec-thisnumbervalue
	var thisNumberValue = function (value) {
	  if (typeof value != 'number' && classofRaw(value) != 'Number') {
	    throw TypeError('Incorrect invocation');
	  }
	  return +value;
	};

	// `String.prototype.repeat` method implementation
	// https://tc39.github.io/ecma262/#sec-string.prototype.repeat
	var stringRepeat = ''.repeat || function repeat(count) {
	  var str = String(requireObjectCoercible(this));
	  var result = '';
	  var n = toInteger(count);
	  if (n < 0 || n == Infinity) throw RangeError('Wrong number of repetitions');
	  for (;n > 0; (n >>>= 1) && (str += str)) if (n & 1) result += str;
	  return result;
	};

	var nativeToFixed = 1.0.toFixed;
	var floor$5 = Math.floor;

	var pow$3 = function (x, n, acc) {
	  return n === 0 ? acc : n % 2 === 1 ? pow$3(x, n - 1, acc * x) : pow$3(x * x, n / 2, acc);
	};

	var log$8 = function (x) {
	  var n = 0;
	  var x2 = x;
	  while (x2 >= 4096) {
	    n += 12;
	    x2 /= 4096;
	  }
	  while (x2 >= 2) {
	    n += 1;
	    x2 /= 2;
	  } return n;
	};

	var FORCED$7 = nativeToFixed && (
	  0.00008.toFixed(3) !== '0.000' ||
	  0.9.toFixed(0) !== '1' ||
	  1.255.toFixed(2) !== '1.25' ||
	  1000000000000000128.0.toFixed(0) !== '1000000000000000128'
	) || !fails(function () {
	  // V8 ~ Android 4.3-
	  nativeToFixed.call({});
	});

	// `Number.prototype.toFixed` method
	// https://tc39.github.io/ecma262/#sec-number.prototype.tofixed
	_export({ target: 'Number', proto: true, forced: FORCED$7 }, {
	  // eslint-disable-next-line max-statements
	  toFixed: function toFixed(fractionDigits) {
	    var number = thisNumberValue(this);
	    var fractDigits = toInteger(fractionDigits);
	    var data = [0, 0, 0, 0, 0, 0];
	    var sign = '';
	    var result = '0';
	    var e, z, j, k;

	    var multiply = function (n, c) {
	      var index = -1;
	      var c2 = c;
	      while (++index < 6) {
	        c2 += n * data[index];
	        data[index] = c2 % 1e7;
	        c2 = floor$5(c2 / 1e7);
	      }
	    };

	    var divide = function (n) {
	      var index = 6;
	      var c = 0;
	      while (--index >= 0) {
	        c += data[index];
	        data[index] = floor$5(c / n);
	        c = (c % n) * 1e7;
	      }
	    };

	    var dataToString = function () {
	      var index = 6;
	      var s = '';
	      while (--index >= 0) {
	        if (s !== '' || index === 0 || data[index] !== 0) {
	          var t = String(data[index]);
	          s = s === '' ? t : s + stringRepeat.call('0', 7 - t.length) + t;
	        }
	      } return s;
	    };

	    if (fractDigits < 0 || fractDigits > 20) throw RangeError('Incorrect fraction digits');
	    // eslint-disable-next-line no-self-compare
	    if (number != number) return 'NaN';
	    if (number <= -1e21 || number >= 1e21) return String(number);
	    if (number < 0) {
	      sign = '-';
	      number = -number;
	    }
	    if (number > 1e-21) {
	      e = log$8(number * pow$3(2, 69, 1)) - 69;
	      z = e < 0 ? number * pow$3(2, -e, 1) : number / pow$3(2, e, 1);
	      z *= 0x10000000000000;
	      e = 52 - e;
	      if (e > 0) {
	        multiply(0, z);
	        j = fractDigits;
	        while (j >= 7) {
	          multiply(1e7, 0);
	          j -= 7;
	        }
	        multiply(pow$3(10, j, 1), 0);
	        j = e - 1;
	        while (j >= 23) {
	          divide(1 << 23);
	          j -= 23;
	        }
	        divide(1 << j);
	        multiply(1, 1);
	        divide(2);
	        result = dataToString();
	      } else {
	        multiply(0, z);
	        multiply(1 << -e, 0);
	        result = dataToString() + stringRepeat.call('0', fractDigits);
	      }
	    }
	    if (fractDigits > 0) {
	      k = result.length;
	      result = sign + (k <= fractDigits
	        ? '0.' + stringRepeat.call('0', fractDigits - k) + result
	        : result.slice(0, k - fractDigits) + '.' + result.slice(k - fractDigits));
	    } else {
	      result = sign + result;
	    } return result;
	  }
	});

	var nativeAssign = Object.assign;
	var defineProperty$8 = Object.defineProperty;

	// `Object.assign` method
	// https://tc39.github.io/ecma262/#sec-object.assign
	var objectAssign = !nativeAssign || fails(function () {
	  // should have correct order of operations (Edge bug)
	  if (descriptors && nativeAssign({ b: 1 }, nativeAssign(defineProperty$8({}, 'a', {
	    enumerable: true,
	    get: function () {
	      defineProperty$8(this, 'b', {
	        value: 3,
	        enumerable: false
	      });
	    }
	  }), { b: 2 })).b !== 1) return true;
	  // should work with symbols and should have deterministic property order (V8 bug)
	  var A = {};
	  var B = {};
	  // eslint-disable-next-line no-undef
	  var symbol = Symbol();
	  var alphabet = 'abcdefghijklmnopqrst';
	  A[symbol] = 7;
	  alphabet.split('').forEach(function (chr) { B[chr] = chr; });
	  return nativeAssign({}, A)[symbol] != 7 || objectKeys(nativeAssign({}, B)).join('') != alphabet;
	}) ? function assign(target, source) { // eslint-disable-line no-unused-vars
	  var T = toObject(target);
	  var argumentsLength = arguments.length;
	  var index = 1;
	  var getOwnPropertySymbols = objectGetOwnPropertySymbols.f;
	  var propertyIsEnumerable = objectPropertyIsEnumerable.f;
	  while (argumentsLength > index) {
	    var S = indexedObject(arguments[index++]);
	    var keys = getOwnPropertySymbols ? objectKeys(S).concat(getOwnPropertySymbols(S)) : objectKeys(S);
	    var length = keys.length;
	    var j = 0;
	    var key;
	    while (length > j) {
	      key = keys[j++];
	      if (!descriptors || propertyIsEnumerable.call(S, key)) T[key] = S[key];
	    }
	  } return T;
	} : nativeAssign;

	// `Object.assign` method
	// https://tc39.github.io/ecma262/#sec-object.assign
	_export({ target: 'Object', stat: true, forced: Object.assign !== objectAssign }, {
	  assign: objectAssign
	});

	// Forced replacement object prototype accessors methods
	var objectPrototypeAccessorsForced =  !fails(function () {
	  var key = Math.random();
	  // In FF throws only define methods
	  // eslint-disable-next-line no-undef, no-useless-call
	  __defineSetter__.call(null, key, function () { /* empty */ });
	  delete global_1[key];
	});

	// `Object.prototype.__defineGetter__` method
	// https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__
	if (descriptors) {
	  _export({ target: 'Object', proto: true, forced: objectPrototypeAccessorsForced }, {
	    __defineGetter__: function __defineGetter__(P, getter) {
	      objectDefineProperty.f(toObject(this), P, { get: aFunction$1(getter), enumerable: true, configurable: true });
	    }
	  });
	}

	// `Object.prototype.__defineSetter__` method
	// https://tc39.github.io/ecma262/#sec-object.prototype.__defineSetter__
	if (descriptors) {
	  _export({ target: 'Object', proto: true, forced: objectPrototypeAccessorsForced }, {
	    __defineSetter__: function __defineSetter__(P, setter) {
	      objectDefineProperty.f(toObject(this), P, { set: aFunction$1(setter), enumerable: true, configurable: true });
	    }
	  });
	}

	var propertyIsEnumerable = objectPropertyIsEnumerable.f;

	// `Object.{ entries, values }` methods implementation
	var createMethod$4 = function (TO_ENTRIES) {
	  return function (it) {
	    var O = toIndexedObject(it);
	    var keys = objectKeys(O);
	    var length = keys.length;
	    var i = 0;
	    var result = [];
	    var key;
	    while (length > i) {
	      key = keys[i++];
	      if (!descriptors || propertyIsEnumerable.call(O, key)) {
	        result.push(TO_ENTRIES ? [key, O[key]] : O[key]);
	      }
	    }
	    return result;
	  };
	};

	var objectToArray = {
	  // `Object.entries` method
	  // https://tc39.github.io/ecma262/#sec-object.entries
	  entries: createMethod$4(true),
	  // `Object.values` method
	  // https://tc39.github.io/ecma262/#sec-object.values
	  values: createMethod$4(false)
	};

	var $entries = objectToArray.entries;

	// `Object.entries` method
	// https://tc39.github.io/ecma262/#sec-object.entries
	_export({ target: 'Object', stat: true }, {
	  entries: function entries(O) {
	    return $entries(O);
	  }
	});

	var onFreeze = internalMetadata.onFreeze;

	var nativeFreeze = Object.freeze;
	var FAILS_ON_PRIMITIVES = fails(function () { nativeFreeze(1); });

	// `Object.freeze` method
	// https://tc39.github.io/ecma262/#sec-object.freeze
	_export({ target: 'Object', stat: true, forced: FAILS_ON_PRIMITIVES, sham: !freezing }, {
	  freeze: function freeze(it) {
	    return nativeFreeze && isObject(it) ? nativeFreeze(onFreeze(it)) : it;
	  }
	});

	// `Object.fromEntries` method
	// https://github.com/tc39/proposal-object-from-entries
	_export({ target: 'Object', stat: true }, {
	  fromEntries: function fromEntries(iterable) {
	    var obj = {};
	    iterate_1(iterable, function (k, v) {
	      createProperty(obj, k, v);
	    }, undefined, true);
	    return obj;
	  }
	});

	var nativeGetOwnPropertyDescriptor$2 = objectGetOwnPropertyDescriptor.f;


	var FAILS_ON_PRIMITIVES$1 = fails(function () { nativeGetOwnPropertyDescriptor$2(1); });
	var FORCED$8 = !descriptors || FAILS_ON_PRIMITIVES$1;

	// `Object.getOwnPropertyDescriptor` method
	// https://tc39.github.io/ecma262/#sec-object.getownpropertydescriptor
	_export({ target: 'Object', stat: true, forced: FORCED$8, sham: !descriptors }, {
	  getOwnPropertyDescriptor: function getOwnPropertyDescriptor(it, key) {
	    return nativeGetOwnPropertyDescriptor$2(toIndexedObject(it), key);
	  }
	});

	// `Object.getOwnPropertyDescriptors` method
	// https://tc39.github.io/ecma262/#sec-object.getownpropertydescriptors
	_export({ target: 'Object', stat: true, sham: !descriptors }, {
	  getOwnPropertyDescriptors: function getOwnPropertyDescriptors(object) {
	    var O = toIndexedObject(object);
	    var getOwnPropertyDescriptor = objectGetOwnPropertyDescriptor.f;
	    var keys = ownKeys(O);
	    var result = {};
	    var index = 0;
	    var key, descriptor;
	    while (keys.length > index) {
	      descriptor = getOwnPropertyDescriptor(O, key = keys[index++]);
	      if (descriptor !== undefined) createProperty(result, key, descriptor);
	    }
	    return result;
	  }
	});

	var nativeGetOwnPropertyNames$2 = objectGetOwnPropertyNamesExternal.f;

	var FAILS_ON_PRIMITIVES$2 = fails(function () { return !Object.getOwnPropertyNames(1); });

	// `Object.getOwnPropertyNames` method
	// https://tc39.github.io/ecma262/#sec-object.getownpropertynames
	_export({ target: 'Object', stat: true, forced: FAILS_ON_PRIMITIVES$2 }, {
	  getOwnPropertyNames: nativeGetOwnPropertyNames$2
	});

	var FAILS_ON_PRIMITIVES$3 = fails(function () { objectGetPrototypeOf(1); });

	// `Object.getPrototypeOf` method
	// https://tc39.github.io/ecma262/#sec-object.getprototypeof
	_export({ target: 'Object', stat: true, forced: FAILS_ON_PRIMITIVES$3, sham: !correctPrototypeGetter }, {
	  getPrototypeOf: function getPrototypeOf(it) {
	    return objectGetPrototypeOf(toObject(it));
	  }
	});

	// `SameValue` abstract operation
	// https://tc39.github.io/ecma262/#sec-samevalue
	var sameValue = Object.is || function is(x, y) {
	  // eslint-disable-next-line no-self-compare
	  return x === y ? x !== 0 || 1 / x === 1 / y : x != x && y != y;
	};

	// `Object.is` method
	// https://tc39.github.io/ecma262/#sec-object.is
	_export({ target: 'Object', stat: true }, {
	  is: sameValue
	});

	var nativeIsExtensible = Object.isExtensible;
	var FAILS_ON_PRIMITIVES$4 = fails(function () { nativeIsExtensible(1); });

	// `Object.isExtensible` method
	// https://tc39.github.io/ecma262/#sec-object.isextensible
	_export({ target: 'Object', stat: true, forced: FAILS_ON_PRIMITIVES$4 }, {
	  isExtensible: function isExtensible(it) {
	    return isObject(it) ? nativeIsExtensible ? nativeIsExtensible(it) : true : false;
	  }
	});

	var nativeIsFrozen = Object.isFrozen;
	var FAILS_ON_PRIMITIVES$5 = fails(function () { nativeIsFrozen(1); });

	// `Object.isFrozen` method
	// https://tc39.github.io/ecma262/#sec-object.isfrozen
	_export({ target: 'Object', stat: true, forced: FAILS_ON_PRIMITIVES$5 }, {
	  isFrozen: function isFrozen(it) {
	    return isObject(it) ? nativeIsFrozen ? nativeIsFrozen(it) : false : true;
	  }
	});

	var nativeIsSealed = Object.isSealed;
	var FAILS_ON_PRIMITIVES$6 = fails(function () { nativeIsSealed(1); });

	// `Object.isSealed` method
	// https://tc39.github.io/ecma262/#sec-object.issealed
	_export({ target: 'Object', stat: true, forced: FAILS_ON_PRIMITIVES$6 }, {
	  isSealed: function isSealed(it) {
	    return isObject(it) ? nativeIsSealed ? nativeIsSealed(it) : false : true;
	  }
	});

	var FAILS_ON_PRIMITIVES$7 = fails(function () { objectKeys(1); });

	// `Object.keys` method
	// https://tc39.github.io/ecma262/#sec-object.keys
	_export({ target: 'Object', stat: true, forced: FAILS_ON_PRIMITIVES$7 }, {
	  keys: function keys(it) {
	    return objectKeys(toObject(it));
	  }
	});

	var getOwnPropertyDescriptor$3 = objectGetOwnPropertyDescriptor.f;

	// `Object.prototype.__lookupGetter__` method
	// https://tc39.github.io/ecma262/#sec-object.prototype.__lookupGetter__
	if (descriptors) {
	  _export({ target: 'Object', proto: true, forced: objectPrototypeAccessorsForced }, {
	    __lookupGetter__: function __lookupGetter__(P) {
	      var O = toObject(this);
	      var key = toPrimitive(P, true);
	      var desc;
	      do {
	        if (desc = getOwnPropertyDescriptor$3(O, key)) return desc.get;
	      } while (O = objectGetPrototypeOf(O));
	    }
	  });
	}

	var getOwnPropertyDescriptor$4 = objectGetOwnPropertyDescriptor.f;

	// `Object.prototype.__lookupSetter__` method
	// https://tc39.github.io/ecma262/#sec-object.prototype.__lookupSetter__
	if (descriptors) {
	  _export({ target: 'Object', proto: true, forced: objectPrototypeAccessorsForced }, {
	    __lookupSetter__: function __lookupSetter__(P) {
	      var O = toObject(this);
	      var key = toPrimitive(P, true);
	      var desc;
	      do {
	        if (desc = getOwnPropertyDescriptor$4(O, key)) return desc.set;
	      } while (O = objectGetPrototypeOf(O));
	    }
	  });
	}

	var onFreeze$1 = internalMetadata.onFreeze;



	var nativePreventExtensions = Object.preventExtensions;
	var FAILS_ON_PRIMITIVES$8 = fails(function () { nativePreventExtensions(1); });

	// `Object.preventExtensions` method
	// https://tc39.github.io/ecma262/#sec-object.preventextensions
	_export({ target: 'Object', stat: true, forced: FAILS_ON_PRIMITIVES$8, sham: !freezing }, {
	  preventExtensions: function preventExtensions(it) {
	    return nativePreventExtensions && isObject(it) ? nativePreventExtensions(onFreeze$1(it)) : it;
	  }
	});

	var onFreeze$2 = internalMetadata.onFreeze;



	var nativeSeal = Object.seal;
	var FAILS_ON_PRIMITIVES$9 = fails(function () { nativeSeal(1); });

	// `Object.seal` method
	// https://tc39.github.io/ecma262/#sec-object.seal
	_export({ target: 'Object', stat: true, forced: FAILS_ON_PRIMITIVES$9, sham: !freezing }, {
	  seal: function seal(it) {
	    return nativeSeal && isObject(it) ? nativeSeal(onFreeze$2(it)) : it;
	  }
	});

	// `Object.prototype.toString` method implementation
	// https://tc39.github.io/ecma262/#sec-object.prototype.tostring
	var objectToString = toStringTagSupport ? {}.toString : function toString() {
	  return '[object ' + classof(this) + ']';
	};

	// `Object.prototype.toString` method
	// https://tc39.github.io/ecma262/#sec-object.prototype.tostring
	if (!toStringTagSupport) {
	  redefine(Object.prototype, 'toString', objectToString, { unsafe: true });
	}

	var $values = objectToArray.values;

	// `Object.values` method
	// https://tc39.github.io/ecma262/#sec-object.values
	_export({ target: 'Object', stat: true }, {
	  values: function values(O) {
	    return $values(O);
	  }
	});

	var nativePromiseConstructor = global_1.Promise;

	var SPECIES$4 = wellKnownSymbol('species');

	// `SpeciesConstructor` abstract operation
	// https://tc39.github.io/ecma262/#sec-speciesconstructor
	var speciesConstructor = function (O, defaultConstructor) {
	  var C = anObject(O).constructor;
	  var S;
	  return C === undefined || (S = anObject(C)[SPECIES$4]) == undefined ? defaultConstructor : aFunction$1(S);
	};

	var engineIsIos = /(iphone|ipod|ipad).*applewebkit/i.test(engineUserAgent);

	var location = global_1.location;
	var set$2 = global_1.setImmediate;
	var clear = global_1.clearImmediate;
	var process$1 = global_1.process;
	var MessageChannel = global_1.MessageChannel;
	var Dispatch = global_1.Dispatch;
	var counter = 0;
	var queue = {};
	var ONREADYSTATECHANGE = 'onreadystatechange';
	var defer, channel, port;

	var run = function (id) {
	  // eslint-disable-next-line no-prototype-builtins
	  if (queue.hasOwnProperty(id)) {
	    var fn = queue[id];
	    delete queue[id];
	    fn();
	  }
	};

	var runner = function (id) {
	  return function () {
	    run(id);
	  };
	};

	var listener = function (event) {
	  run(event.data);
	};

	var post = function (id) {
	  // old engines have not location.origin
	  global_1.postMessage(id + '', location.protocol + '//' + location.host);
	};

	// Node.js 0.9+ & IE10+ has setImmediate, otherwise:
	if (!set$2 || !clear) {
	  set$2 = function setImmediate(fn) {
	    var args = [];
	    var i = 1;
	    while (arguments.length > i) args.push(arguments[i++]);
	    queue[++counter] = function () {
	      // eslint-disable-next-line no-new-func
	      (typeof fn == 'function' ? fn : Function(fn)).apply(undefined, args);
	    };
	    defer(counter);
	    return counter;
	  };
	  clear = function clearImmediate(id) {
	    delete queue[id];
	  };
	  // Node.js 0.8-
	  if (classofRaw(process$1) == 'process') {
	    defer = function (id) {
	      process$1.nextTick(runner(id));
	    };
	  // Sphere (JS game engine) Dispatch API
	  } else if (Dispatch && Dispatch.now) {
	    defer = function (id) {
	      Dispatch.now(runner(id));
	    };
	  // Browsers with MessageChannel, includes WebWorkers
	  // except iOS - https://github.com/zloirock/core-js/issues/624
	  } else if (MessageChannel && !engineIsIos) {
	    channel = new MessageChannel();
	    port = channel.port2;
	    channel.port1.onmessage = listener;
	    defer = functionBindContext(port.postMessage, port, 1);
	  // Browsers with postMessage, skip WebWorkers
	  // IE8 has postMessage, but it's sync & typeof its postMessage is 'object'
	  } else if (
	    global_1.addEventListener &&
	    typeof postMessage == 'function' &&
	    !global_1.importScripts &&
	    !fails(post) &&
	    location.protocol !== 'file:'
	  ) {
	    defer = post;
	    global_1.addEventListener('message', listener, false);
	  // IE8-
	  } else if (ONREADYSTATECHANGE in documentCreateElement('script')) {
	    defer = function (id) {
	      html.appendChild(documentCreateElement('script'))[ONREADYSTATECHANGE] = function () {
	        html.removeChild(this);
	        run(id);
	      };
	    };
	  // Rest old browsers
	  } else {
	    defer = function (id) {
	      setTimeout(runner(id), 0);
	    };
	  }
	}

	var task = {
	  set: set$2,
	  clear: clear
	};

	var getOwnPropertyDescriptor$5 = objectGetOwnPropertyDescriptor.f;

	var macrotask = task.set;


	var MutationObserver = global_1.MutationObserver || global_1.WebKitMutationObserver;
	var process$2 = global_1.process;
	var Promise$1 = global_1.Promise;
	var IS_NODE = classofRaw(process$2) == 'process';
	// Node.js 11 shows ExperimentalWarning on getting `queueMicrotask`
	var queueMicrotaskDescriptor = getOwnPropertyDescriptor$5(global_1, 'queueMicrotask');
	var queueMicrotask = queueMicrotaskDescriptor && queueMicrotaskDescriptor.value;

	var flush, head, last, notify, toggle, node, promise, then;

	// modern engines have queueMicrotask method
	if (!queueMicrotask) {
	  flush = function () {
	    var parent, fn;
	    if (IS_NODE && (parent = process$2.domain)) parent.exit();
	    while (head) {
	      fn = head.fn;
	      head = head.next;
	      try {
	        fn();
	      } catch (error) {
	        if (head) notify();
	        else last = undefined;
	        throw error;
	      }
	    } last = undefined;
	    if (parent) parent.enter();
	  };

	  // Node.js
	  if (IS_NODE) {
	    notify = function () {
	      process$2.nextTick(flush);
	    };
	  // browsers with MutationObserver, except iOS - https://github.com/zloirock/core-js/issues/339
	  } else if (MutationObserver && !engineIsIos) {
	    toggle = true;
	    node = document.createTextNode('');
	    new MutationObserver(flush).observe(node, { characterData: true });
	    notify = function () {
	      node.data = toggle = !toggle;
	    };
	  // environments with maybe non-completely correct, but existent Promise
	  } else if (Promise$1 && Promise$1.resolve) {
	    // Promise.resolve without an argument throws an error in LG WebOS 2
	    promise = Promise$1.resolve(undefined);
	    then = promise.then;
	    notify = function () {
	      then.call(promise, flush);
	    };
	  // for other environments - macrotask based on:
	  // - setImmediate
	  // - MessageChannel
	  // - window.postMessag
	  // - onreadystatechange
	  // - setTimeout
	  } else {
	    notify = function () {
	      // strange IE + webpack dev server bug - use .call(global)
	      macrotask.call(global_1, flush);
	    };
	  }
	}

	var microtask = queueMicrotask || function (fn) {
	  var task = { fn: fn, next: undefined };
	  if (last) last.next = task;
	  if (!head) {
	    head = task;
	    notify();
	  } last = task;
	};

	var PromiseCapability = function (C) {
	  var resolve, reject;
	  this.promise = new C(function ($$resolve, $$reject) {
	    if (resolve !== undefined || reject !== undefined) throw TypeError('Bad Promise constructor');
	    resolve = $$resolve;
	    reject = $$reject;
	  });
	  this.resolve = aFunction$1(resolve);
	  this.reject = aFunction$1(reject);
	};

	// 25.4.1.5 NewPromiseCapability(C)
	var f$7 = function (C) {
	  return new PromiseCapability(C);
	};

	var newPromiseCapability = {
		f: f$7
	};

	var promiseResolve = function (C, x) {
	  anObject(C);
	  if (isObject(x) && x.constructor === C) return x;
	  var promiseCapability = newPromiseCapability.f(C);
	  var resolve = promiseCapability.resolve;
	  resolve(x);
	  return promiseCapability.promise;
	};

	var hostReportErrors = function (a, b) {
	  var console = global_1.console;
	  if (console && console.error) {
	    arguments.length === 1 ? console.error(a) : console.error(a, b);
	  }
	};

	var perform = function (exec) {
	  try {
	    return { error: false, value: exec() };
	  } catch (error) {
	    return { error: true, value: error };
	  }
	};

	var task$1 = task.set;










	var SPECIES$5 = wellKnownSymbol('species');
	var PROMISE = 'Promise';
	var getInternalState$3 = internalState.get;
	var setInternalState$4 = internalState.set;
	var getInternalPromiseState = internalState.getterFor(PROMISE);
	var PromiseConstructor = nativePromiseConstructor;
	var TypeError$1 = global_1.TypeError;
	var document$2 = global_1.document;
	var process$3 = global_1.process;
	var $fetch = getBuiltIn('fetch');
	var newPromiseCapability$1 = newPromiseCapability.f;
	var newGenericPromiseCapability = newPromiseCapability$1;
	var IS_NODE$1 = classofRaw(process$3) == 'process';
	var DISPATCH_EVENT = !!(document$2 && document$2.createEvent && global_1.dispatchEvent);
	var UNHANDLED_REJECTION = 'unhandledrejection';
	var REJECTION_HANDLED = 'rejectionhandled';
	var PENDING = 0;
	var FULFILLED = 1;
	var REJECTED = 2;
	var HANDLED = 1;
	var UNHANDLED = 2;
	var Internal, OwnPromiseCapability, PromiseWrapper, nativeThen;

	var FORCED$9 = isForced_1(PROMISE, function () {
	  var GLOBAL_CORE_JS_PROMISE = inspectSource(PromiseConstructor) !== String(PromiseConstructor);
	  if (!GLOBAL_CORE_JS_PROMISE) {
	    // V8 6.6 (Node 10 and Chrome 66) have a bug with resolving custom thenables
	    // https://bugs.chromium.org/p/chromium/issues/detail?id=830565
	    // We can't detect it synchronously, so just check versions
	    if (engineV8Version === 66) return true;
	    // Unhandled rejections tracking support, NodeJS Promise without it fails @@species test
	    if (!IS_NODE$1 && typeof PromiseRejectionEvent != 'function') return true;
	  }
	  // We can't use @@species feature detection in V8 since it causes
	  // deoptimization and performance degradation
	  // https://github.com/zloirock/core-js/issues/679
	  if (engineV8Version >= 51 && /native code/.test(PromiseConstructor)) return false;
	  // Detect correctness of subclassing with @@species support
	  var promise = PromiseConstructor.resolve(1);
	  var FakePromise = function (exec) {
	    exec(function () { /* empty */ }, function () { /* empty */ });
	  };
	  var constructor = promise.constructor = {};
	  constructor[SPECIES$5] = FakePromise;
	  return !(promise.then(function () { /* empty */ }) instanceof FakePromise);
	});

	var INCORRECT_ITERATION$1 = FORCED$9 || !checkCorrectnessOfIteration(function (iterable) {
	  PromiseConstructor.all(iterable)['catch'](function () { /* empty */ });
	});

	// helpers
	var isThenable = function (it) {
	  var then;
	  return isObject(it) && typeof (then = it.then) == 'function' ? then : false;
	};

	var notify$1 = function (promise, state, isReject) {
	  if (state.notified) return;
	  state.notified = true;
	  var chain = state.reactions;
	  microtask(function () {
	    var value = state.value;
	    var ok = state.state == FULFILLED;
	    var index = 0;
	    // variable length - can't use forEach
	    while (chain.length > index) {
	      var reaction = chain[index++];
	      var handler = ok ? reaction.ok : reaction.fail;
	      var resolve = reaction.resolve;
	      var reject = reaction.reject;
	      var domain = reaction.domain;
	      var result, then, exited;
	      try {
	        if (handler) {
	          if (!ok) {
	            if (state.rejection === UNHANDLED) onHandleUnhandled(promise, state);
	            state.rejection = HANDLED;
	          }
	          if (handler === true) result = value;
	          else {
	            if (domain) domain.enter();
	            result = handler(value); // can throw
	            if (domain) {
	              domain.exit();
	              exited = true;
	            }
	          }
	          if (result === reaction.promise) {
	            reject(TypeError$1('Promise-chain cycle'));
	          } else if (then = isThenable(result)) {
	            then.call(result, resolve, reject);
	          } else resolve(result);
	        } else reject(value);
	      } catch (error) {
	        if (domain && !exited) domain.exit();
	        reject(error);
	      }
	    }
	    state.reactions = [];
	    state.notified = false;
	    if (isReject && !state.rejection) onUnhandled(promise, state);
	  });
	};

	var dispatchEvent = function (name, promise, reason) {
	  var event, handler;
	  if (DISPATCH_EVENT) {
	    event = document$2.createEvent('Event');
	    event.promise = promise;
	    event.reason = reason;
	    event.initEvent(name, false, true);
	    global_1.dispatchEvent(event);
	  } else event = { promise: promise, reason: reason };
	  if (handler = global_1['on' + name]) handler(event);
	  else if (name === UNHANDLED_REJECTION) hostReportErrors('Unhandled promise rejection', reason);
	};

	var onUnhandled = function (promise, state) {
	  task$1.call(global_1, function () {
	    var value = state.value;
	    var IS_UNHANDLED = isUnhandled(state);
	    var result;
	    if (IS_UNHANDLED) {
	      result = perform(function () {
	        if (IS_NODE$1) {
	          process$3.emit('unhandledRejection', value, promise);
	        } else dispatchEvent(UNHANDLED_REJECTION, promise, value);
	      });
	      // Browsers should not trigger `rejectionHandled` event if it was handled here, NodeJS - should
	      state.rejection = IS_NODE$1 || isUnhandled(state) ? UNHANDLED : HANDLED;
	      if (result.error) throw result.value;
	    }
	  });
	};

	var isUnhandled = function (state) {
	  return state.rejection !== HANDLED && !state.parent;
	};

	var onHandleUnhandled = function (promise, state) {
	  task$1.call(global_1, function () {
	    if (IS_NODE$1) {
	      process$3.emit('rejectionHandled', promise);
	    } else dispatchEvent(REJECTION_HANDLED, promise, state.value);
	  });
	};

	var bind = function (fn, promise, state, unwrap) {
	  return function (value) {
	    fn(promise, state, value, unwrap);
	  };
	};

	var internalReject = function (promise, state, value, unwrap) {
	  if (state.done) return;
	  state.done = true;
	  if (unwrap) state = unwrap;
	  state.value = value;
	  state.state = REJECTED;
	  notify$1(promise, state, true);
	};

	var internalResolve = function (promise, state, value, unwrap) {
	  if (state.done) return;
	  state.done = true;
	  if (unwrap) state = unwrap;
	  try {
	    if (promise === value) throw TypeError$1("Promise can't be resolved itself");
	    var then = isThenable(value);
	    if (then) {
	      microtask(function () {
	        var wrapper = { done: false };
	        try {
	          then.call(value,
	            bind(internalResolve, promise, wrapper, state),
	            bind(internalReject, promise, wrapper, state)
	          );
	        } catch (error) {
	          internalReject(promise, wrapper, error, state);
	        }
	      });
	    } else {
	      state.value = value;
	      state.state = FULFILLED;
	      notify$1(promise, state, false);
	    }
	  } catch (error) {
	    internalReject(promise, { done: false }, error, state);
	  }
	};

	// constructor polyfill
	if (FORCED$9) {
	  // 25.4.3.1 Promise(executor)
	  PromiseConstructor = function Promise(executor) {
	    anInstance(this, PromiseConstructor, PROMISE);
	    aFunction$1(executor);
	    Internal.call(this);
	    var state = getInternalState$3(this);
	    try {
	      executor(bind(internalResolve, this, state), bind(internalReject, this, state));
	    } catch (error) {
	      internalReject(this, state, error);
	    }
	  };
	  // eslint-disable-next-line no-unused-vars
	  Internal = function Promise(executor) {
	    setInternalState$4(this, {
	      type: PROMISE,
	      done: false,
	      notified: false,
	      parent: false,
	      reactions: [],
	      rejection: false,
	      state: PENDING,
	      value: undefined
	    });
	  };
	  Internal.prototype = redefineAll(PromiseConstructor.prototype, {
	    // `Promise.prototype.then` method
	    // https://tc39.github.io/ecma262/#sec-promise.prototype.then
	    then: function then(onFulfilled, onRejected) {
	      var state = getInternalPromiseState(this);
	      var reaction = newPromiseCapability$1(speciesConstructor(this, PromiseConstructor));
	      reaction.ok = typeof onFulfilled == 'function' ? onFulfilled : true;
	      reaction.fail = typeof onRejected == 'function' && onRejected;
	      reaction.domain = IS_NODE$1 ? process$3.domain : undefined;
	      state.parent = true;
	      state.reactions.push(reaction);
	      if (state.state != PENDING) notify$1(this, state, false);
	      return reaction.promise;
	    },
	    // `Promise.prototype.catch` method
	    // https://tc39.github.io/ecma262/#sec-promise.prototype.catch
	    'catch': function (onRejected) {
	      return this.then(undefined, onRejected);
	    }
	  });
	  OwnPromiseCapability = function () {
	    var promise = new Internal();
	    var state = getInternalState$3(promise);
	    this.promise = promise;
	    this.resolve = bind(internalResolve, promise, state);
	    this.reject = bind(internalReject, promise, state);
	  };
	  newPromiseCapability.f = newPromiseCapability$1 = function (C) {
	    return C === PromiseConstructor || C === PromiseWrapper
	      ? new OwnPromiseCapability(C)
	      : newGenericPromiseCapability(C);
	  };

	  if ( typeof nativePromiseConstructor == 'function') {
	    nativeThen = nativePromiseConstructor.prototype.then;

	    // wrap native Promise#then for native async functions
	    redefine(nativePromiseConstructor.prototype, 'then', function then(onFulfilled, onRejected) {
	      var that = this;
	      return new PromiseConstructor(function (resolve, reject) {
	        nativeThen.call(that, resolve, reject);
	      }).then(onFulfilled, onRejected);
	    // https://github.com/zloirock/core-js/issues/640
	    }, { unsafe: true });

	    // wrap fetch result
	    if (typeof $fetch == 'function') _export({ global: true, enumerable: true, forced: true }, {
	      // eslint-disable-next-line no-unused-vars
	      fetch: function fetch(input /* , init */) {
	        return promiseResolve(PromiseConstructor, $fetch.apply(global_1, arguments));
	      }
	    });
	  }
	}

	_export({ global: true, wrap: true, forced: FORCED$9 }, {
	  Promise: PromiseConstructor
	});

	setToStringTag(PromiseConstructor, PROMISE, false);
	setSpecies(PROMISE);

	PromiseWrapper = getBuiltIn(PROMISE);

	// statics
	_export({ target: PROMISE, stat: true, forced: FORCED$9 }, {
	  // `Promise.reject` method
	  // https://tc39.github.io/ecma262/#sec-promise.reject
	  reject: function reject(r) {
	    var capability = newPromiseCapability$1(this);
	    capability.reject.call(undefined, r);
	    return capability.promise;
	  }
	});

	_export({ target: PROMISE, stat: true, forced:  FORCED$9 }, {
	  // `Promise.resolve` method
	  // https://tc39.github.io/ecma262/#sec-promise.resolve
	  resolve: function resolve(x) {
	    return promiseResolve( this, x);
	  }
	});

	_export({ target: PROMISE, stat: true, forced: INCORRECT_ITERATION$1 }, {
	  // `Promise.all` method
	  // https://tc39.github.io/ecma262/#sec-promise.all
	  all: function all(iterable) {
	    var C = this;
	    var capability = newPromiseCapability$1(C);
	    var resolve = capability.resolve;
	    var reject = capability.reject;
	    var result = perform(function () {
	      var $promiseResolve = aFunction$1(C.resolve);
	      var values = [];
	      var counter = 0;
	      var remaining = 1;
	      iterate_1(iterable, function (promise) {
	        var index = counter++;
	        var alreadyCalled = false;
	        values.push(undefined);
	        remaining++;
	        $promiseResolve.call(C, promise).then(function (value) {
	          if (alreadyCalled) return;
	          alreadyCalled = true;
	          values[index] = value;
	          --remaining || resolve(values);
	        }, reject);
	      });
	      --remaining || resolve(values);
	    });
	    if (result.error) reject(result.value);
	    return capability.promise;
	  },
	  // `Promise.race` method
	  // https://tc39.github.io/ecma262/#sec-promise.race
	  race: function race(iterable) {
	    var C = this;
	    var capability = newPromiseCapability$1(C);
	    var reject = capability.reject;
	    var result = perform(function () {
	      var $promiseResolve = aFunction$1(C.resolve);
	      iterate_1(iterable, function (promise) {
	        $promiseResolve.call(C, promise).then(capability.resolve, reject);
	      });
	    });
	    if (result.error) reject(result.value);
	    return capability.promise;
	  }
	});

	// Safari bug https://bugs.webkit.org/show_bug.cgi?id=200829
	var NON_GENERIC = !!nativePromiseConstructor && fails(function () {
	  nativePromiseConstructor.prototype['finally'].call({ then: function () { /* empty */ } }, function () { /* empty */ });
	});

	// `Promise.prototype.finally` method
	// https://tc39.github.io/ecma262/#sec-promise.prototype.finally
	_export({ target: 'Promise', proto: true, real: true, forced: NON_GENERIC }, {
	  'finally': function (onFinally) {
	    var C = speciesConstructor(this, getBuiltIn('Promise'));
	    var isFunction = typeof onFinally == 'function';
	    return this.then(
	      isFunction ? function (x) {
	        return promiseResolve(C, onFinally()).then(function () { return x; });
	      } : onFinally,
	      isFunction ? function (e) {
	        return promiseResolve(C, onFinally()).then(function () { throw e; });
	      } : onFinally
	    );
	  }
	});

	// patch native Promise.prototype for native async functions
	if ( typeof nativePromiseConstructor == 'function' && !nativePromiseConstructor.prototype['finally']) {
	  redefine(nativePromiseConstructor.prototype, 'finally', getBuiltIn('Promise').prototype['finally']);
	}

	var nativeApply = getBuiltIn('Reflect', 'apply');
	var functionApply = Function.apply;

	// MS Edge argumentsList argument is optional
	var OPTIONAL_ARGUMENTS_LIST = !fails(function () {
	  nativeApply(function () { /* empty */ });
	});

	// `Reflect.apply` method
	// https://tc39.github.io/ecma262/#sec-reflect.apply
	_export({ target: 'Reflect', stat: true, forced: OPTIONAL_ARGUMENTS_LIST }, {
	  apply: function apply(target, thisArgument, argumentsList) {
	    aFunction$1(target);
	    anObject(argumentsList);
	    return nativeApply
	      ? nativeApply(target, thisArgument, argumentsList)
	      : functionApply.call(target, thisArgument, argumentsList);
	  }
	});

	var slice = [].slice;
	var factories = {};

	var construct = function (C, argsLength, args) {
	  if (!(argsLength in factories)) {
	    for (var list = [], i = 0; i < argsLength; i++) list[i] = 'a[' + i + ']';
	    // eslint-disable-next-line no-new-func
	    factories[argsLength] = Function('C,a', 'return new C(' + list.join(',') + ')');
	  } return factories[argsLength](C, args);
	};

	// `Function.prototype.bind` method implementation
	// https://tc39.github.io/ecma262/#sec-function.prototype.bind
	var functionBind = Function.bind || function bind(that /* , ...args */) {
	  var fn = aFunction$1(this);
	  var partArgs = slice.call(arguments, 1);
	  var boundFunction = function bound(/* args... */) {
	    var args = partArgs.concat(slice.call(arguments));
	    return this instanceof boundFunction ? construct(fn, args.length, args) : fn.apply(that, args);
	  };
	  if (isObject(fn.prototype)) boundFunction.prototype = fn.prototype;
	  return boundFunction;
	};

	var nativeConstruct = getBuiltIn('Reflect', 'construct');

	// `Reflect.construct` method
	// https://tc39.github.io/ecma262/#sec-reflect.construct
	// MS Edge supports only 2 arguments and argumentsList argument is optional
	// FF Nightly sets third argument as `new.target`, but does not create `this` from it
	var NEW_TARGET_BUG = fails(function () {
	  function F() { /* empty */ }
	  return !(nativeConstruct(function () { /* empty */ }, [], F) instanceof F);
	});
	var ARGS_BUG = !fails(function () {
	  nativeConstruct(function () { /* empty */ });
	});
	var FORCED$a = NEW_TARGET_BUG || ARGS_BUG;

	_export({ target: 'Reflect', stat: true, forced: FORCED$a, sham: FORCED$a }, {
	  construct: function construct(Target, args /* , newTarget */) {
	    aFunction$1(Target);
	    anObject(args);
	    var newTarget = arguments.length < 3 ? Target : aFunction$1(arguments[2]);
	    if (ARGS_BUG && !NEW_TARGET_BUG) return nativeConstruct(Target, args, newTarget);
	    if (Target == newTarget) {
	      // w/o altered newTarget, optimization for 0-4 arguments
	      switch (args.length) {
	        case 0: return new Target();
	        case 1: return new Target(args[0]);
	        case 2: return new Target(args[0], args[1]);
	        case 3: return new Target(args[0], args[1], args[2]);
	        case 4: return new Target(args[0], args[1], args[2], args[3]);
	      }
	      // w/o altered newTarget, lot of arguments case
	      var $args = [null];
	      $args.push.apply($args, args);
	      return new (functionBind.apply(Target, $args))();
	    }
	    // with altered newTarget, not support built-in constructors
	    var proto = newTarget.prototype;
	    var instance = objectCreate(isObject(proto) ? proto : Object.prototype);
	    var result = Function.apply.call(Target, instance, args);
	    return isObject(result) ? result : instance;
	  }
	});

	// MS Edge has broken Reflect.defineProperty - throwing instead of returning false
	var ERROR_INSTEAD_OF_FALSE = fails(function () {
	  // eslint-disable-next-line no-undef
	  Reflect.defineProperty(objectDefineProperty.f({}, 1, { value: 1 }), 1, { value: 2 });
	});

	// `Reflect.defineProperty` method
	// https://tc39.github.io/ecma262/#sec-reflect.defineproperty
	_export({ target: 'Reflect', stat: true, forced: ERROR_INSTEAD_OF_FALSE, sham: !descriptors }, {
	  defineProperty: function defineProperty(target, propertyKey, attributes) {
	    anObject(target);
	    var key = toPrimitive(propertyKey, true);
	    anObject(attributes);
	    try {
	      objectDefineProperty.f(target, key, attributes);
	      return true;
	    } catch (error) {
	      return false;
	    }
	  }
	});

	var getOwnPropertyDescriptor$6 = objectGetOwnPropertyDescriptor.f;

	// `Reflect.deleteProperty` method
	// https://tc39.github.io/ecma262/#sec-reflect.deleteproperty
	_export({ target: 'Reflect', stat: true }, {
	  deleteProperty: function deleteProperty(target, propertyKey) {
	    var descriptor = getOwnPropertyDescriptor$6(anObject(target), propertyKey);
	    return descriptor && !descriptor.configurable ? false : delete target[propertyKey];
	  }
	});

	// `Reflect.get` method
	// https://tc39.github.io/ecma262/#sec-reflect.get
	function get$2(target, propertyKey /* , receiver */) {
	  var receiver = arguments.length < 3 ? target : arguments[2];
	  var descriptor, prototype;
	  if (anObject(target) === receiver) return target[propertyKey];
	  if (descriptor = objectGetOwnPropertyDescriptor.f(target, propertyKey)) return has(descriptor, 'value')
	    ? descriptor.value
	    : descriptor.get === undefined
	      ? undefined
	      : descriptor.get.call(receiver);
	  if (isObject(prototype = objectGetPrototypeOf(target))) return get$2(prototype, propertyKey, receiver);
	}

	_export({ target: 'Reflect', stat: true }, {
	  get: get$2
	});

	// `Reflect.getOwnPropertyDescriptor` method
	// https://tc39.github.io/ecma262/#sec-reflect.getownpropertydescriptor
	_export({ target: 'Reflect', stat: true, sham: !descriptors }, {
	  getOwnPropertyDescriptor: function getOwnPropertyDescriptor(target, propertyKey) {
	    return objectGetOwnPropertyDescriptor.f(anObject(target), propertyKey);
	  }
	});

	// `Reflect.getPrototypeOf` method
	// https://tc39.github.io/ecma262/#sec-reflect.getprototypeof
	_export({ target: 'Reflect', stat: true, sham: !correctPrototypeGetter }, {
	  getPrototypeOf: function getPrototypeOf(target) {
	    return objectGetPrototypeOf(anObject(target));
	  }
	});

	// `Reflect.has` method
	// https://tc39.github.io/ecma262/#sec-reflect.has
	_export({ target: 'Reflect', stat: true }, {
	  has: function has(target, propertyKey) {
	    return propertyKey in target;
	  }
	});

	var objectIsExtensible = Object.isExtensible;

	// `Reflect.isExtensible` method
	// https://tc39.github.io/ecma262/#sec-reflect.isextensible
	_export({ target: 'Reflect', stat: true }, {
	  isExtensible: function isExtensible(target) {
	    anObject(target);
	    return objectIsExtensible ? objectIsExtensible(target) : true;
	  }
	});

	// `Reflect.ownKeys` method
	// https://tc39.github.io/ecma262/#sec-reflect.ownkeys
	_export({ target: 'Reflect', stat: true }, {
	  ownKeys: ownKeys
	});

	// `Reflect.preventExtensions` method
	// https://tc39.github.io/ecma262/#sec-reflect.preventextensions
	_export({ target: 'Reflect', stat: true, sham: !freezing }, {
	  preventExtensions: function preventExtensions(target) {
	    anObject(target);
	    try {
	      var objectPreventExtensions = getBuiltIn('Object', 'preventExtensions');
	      if (objectPreventExtensions) objectPreventExtensions(target);
	      return true;
	    } catch (error) {
	      return false;
	    }
	  }
	});

	// `Reflect.set` method
	// https://tc39.github.io/ecma262/#sec-reflect.set
	function set$3(target, propertyKey, V /* , receiver */) {
	  var receiver = arguments.length < 4 ? target : arguments[3];
	  var ownDescriptor = objectGetOwnPropertyDescriptor.f(anObject(target), propertyKey);
	  var existingDescriptor, prototype;
	  if (!ownDescriptor) {
	    if (isObject(prototype = objectGetPrototypeOf(target))) {
	      return set$3(prototype, propertyKey, V, receiver);
	    }
	    ownDescriptor = createPropertyDescriptor(0);
	  }
	  if (has(ownDescriptor, 'value')) {
	    if (ownDescriptor.writable === false || !isObject(receiver)) return false;
	    if (existingDescriptor = objectGetOwnPropertyDescriptor.f(receiver, propertyKey)) {
	      if (existingDescriptor.get || existingDescriptor.set || existingDescriptor.writable === false) return false;
	      existingDescriptor.value = V;
	      objectDefineProperty.f(receiver, propertyKey, existingDescriptor);
	    } else objectDefineProperty.f(receiver, propertyKey, createPropertyDescriptor(0, V));
	    return true;
	  }
	  return ownDescriptor.set === undefined ? false : (ownDescriptor.set.call(receiver, V), true);
	}

	// MS Edge 17-18 Reflect.set allows setting the property to object
	// with non-writable property on the prototype
	var MS_EDGE_BUG = fails(function () {
	  var object = objectDefineProperty.f({}, 'a', { configurable: true });
	  // eslint-disable-next-line no-undef
	  return Reflect.set(objectGetPrototypeOf(object), 'a', 1, object) !== false;
	});

	_export({ target: 'Reflect', stat: true, forced: MS_EDGE_BUG }, {
	  set: set$3
	});

	// `Reflect.setPrototypeOf` method
	// https://tc39.github.io/ecma262/#sec-reflect.setprototypeof
	if (objectSetPrototypeOf) _export({ target: 'Reflect', stat: true }, {
	  setPrototypeOf: function setPrototypeOf(target, proto) {
	    anObject(target);
	    aPossiblePrototype(proto);
	    try {
	      objectSetPrototypeOf(target, proto);
	      return true;
	    } catch (error) {
	      return false;
	    }
	  }
	});

	var MATCH = wellKnownSymbol('match');

	// `IsRegExp` abstract operation
	// https://tc39.github.io/ecma262/#sec-isregexp
	var isRegexp = function (it) {
	  var isRegExp;
	  return isObject(it) && ((isRegExp = it[MATCH]) !== undefined ? !!isRegExp : classofRaw(it) == 'RegExp');
	};

	// `RegExp.prototype.flags` getter implementation
	// https://tc39.github.io/ecma262/#sec-get-regexp.prototype.flags
	var regexpFlags = function () {
	  var that = anObject(this);
	  var result = '';
	  if (that.global) result += 'g';
	  if (that.ignoreCase) result += 'i';
	  if (that.multiline) result += 'm';
	  if (that.dotAll) result += 's';
	  if (that.unicode) result += 'u';
	  if (that.sticky) result += 'y';
	  return result;
	};

	// babel-minify transpiles RegExp('a', 'y') -> /a/y and it causes SyntaxError,
	// so we use an intermediate function.
	function RE(s, f) {
	  return RegExp(s, f);
	}

	var UNSUPPORTED_Y = fails(function () {
	  // babel-minify transpiles RegExp('a', 'y') -> /a/y and it causes SyntaxError
	  var re = RE('a', 'y');
	  re.lastIndex = 2;
	  return re.exec('abcd') != null;
	});

	var BROKEN_CARET = fails(function () {
	  // https://bugzilla.mozilla.org/show_bug.cgi?id=773687
	  var re = RE('^r', 'gy');
	  re.lastIndex = 2;
	  return re.exec('str') != null;
	});

	var regexpStickyHelpers = {
		UNSUPPORTED_Y: UNSUPPORTED_Y,
		BROKEN_CARET: BROKEN_CARET
	};

	var defineProperty$9 = objectDefineProperty.f;
	var getOwnPropertyNames$2 = objectGetOwnPropertyNames.f;





	var setInternalState$5 = internalState.set;



	var MATCH$1 = wellKnownSymbol('match');
	var NativeRegExp = global_1.RegExp;
	var RegExpPrototype = NativeRegExp.prototype;
	var re1 = /a/g;
	var re2 = /a/g;

	// "new" should create a new object, old webkit bug
	var CORRECT_NEW = new NativeRegExp(re1) !== re1;

	var UNSUPPORTED_Y$1 = regexpStickyHelpers.UNSUPPORTED_Y;

	var FORCED$b = descriptors && isForced_1('RegExp', (!CORRECT_NEW || UNSUPPORTED_Y$1 || fails(function () {
	  re2[MATCH$1] = false;
	  // RegExp constructor can alter flags and IsRegExp works correct with @@match
	  return NativeRegExp(re1) != re1 || NativeRegExp(re2) == re2 || NativeRegExp(re1, 'i') != '/a/i';
	})));

	// `RegExp` constructor
	// https://tc39.github.io/ecma262/#sec-regexp-constructor
	if (FORCED$b) {
	  var RegExpWrapper = function RegExp(pattern, flags) {
	    var thisIsRegExp = this instanceof RegExpWrapper;
	    var patternIsRegExp = isRegexp(pattern);
	    var flagsAreUndefined = flags === undefined;
	    var sticky;

	    if (!thisIsRegExp && patternIsRegExp && pattern.constructor === RegExpWrapper && flagsAreUndefined) {
	      return pattern;
	    }

	    if (CORRECT_NEW) {
	      if (patternIsRegExp && !flagsAreUndefined) pattern = pattern.source;
	    } else if (pattern instanceof RegExpWrapper) {
	      if (flagsAreUndefined) flags = regexpFlags.call(pattern);
	      pattern = pattern.source;
	    }

	    if (UNSUPPORTED_Y$1) {
	      sticky = !!flags && flags.indexOf('y') > -1;
	      if (sticky) flags = flags.replace(/y/g, '');
	    }

	    var result = inheritIfRequired(
	      CORRECT_NEW ? new NativeRegExp(pattern, flags) : NativeRegExp(pattern, flags),
	      thisIsRegExp ? this : RegExpPrototype,
	      RegExpWrapper
	    );

	    if (UNSUPPORTED_Y$1 && sticky) setInternalState$5(result, { sticky: sticky });

	    return result;
	  };
	  var proxy = function (key) {
	    key in RegExpWrapper || defineProperty$9(RegExpWrapper, key, {
	      configurable: true,
	      get: function () { return NativeRegExp[key]; },
	      set: function (it) { NativeRegExp[key] = it; }
	    });
	  };
	  var keys$3 = getOwnPropertyNames$2(NativeRegExp);
	  var index = 0;
	  while (keys$3.length > index) proxy(keys$3[index++]);
	  RegExpPrototype.constructor = RegExpWrapper;
	  RegExpWrapper.prototype = RegExpPrototype;
	  redefine(global_1, 'RegExp', RegExpWrapper);
	}

	// https://tc39.github.io/ecma262/#sec-get-regexp-@@species
	setSpecies('RegExp');

	var nativeExec = RegExp.prototype.exec;
	// This always refers to the native implementation, because the
	// String#replace polyfill uses ./fix-regexp-well-known-symbol-logic.js,
	// which loads this file before patching the method.
	var nativeReplace = String.prototype.replace;

	var patchedExec = nativeExec;

	var UPDATES_LAST_INDEX_WRONG = (function () {
	  var re1 = /a/;
	  var re2 = /b*/g;
	  nativeExec.call(re1, 'a');
	  nativeExec.call(re2, 'a');
	  return re1.lastIndex !== 0 || re2.lastIndex !== 0;
	})();

	var UNSUPPORTED_Y$2 = regexpStickyHelpers.UNSUPPORTED_Y || regexpStickyHelpers.BROKEN_CARET;

	// nonparticipating capturing group, copied from es5-shim's String#split patch.
	var NPCG_INCLUDED = /()??/.exec('')[1] !== undefined;

	var PATCH = UPDATES_LAST_INDEX_WRONG || NPCG_INCLUDED || UNSUPPORTED_Y$2;

	if (PATCH) {
	  patchedExec = function exec(str) {
	    var re = this;
	    var lastIndex, reCopy, match, i;
	    var sticky = UNSUPPORTED_Y$2 && re.sticky;
	    var flags = regexpFlags.call(re);
	    var source = re.source;
	    var charsAdded = 0;
	    var strCopy = str;

	    if (sticky) {
	      flags = flags.replace('y', '');
	      if (flags.indexOf('g') === -1) {
	        flags += 'g';
	      }

	      strCopy = String(str).slice(re.lastIndex);
	      // Support anchored sticky behavior.
	      if (re.lastIndex > 0 && (!re.multiline || re.multiline && str[re.lastIndex - 1] !== '\n')) {
	        source = '(?: ' + source + ')';
	        strCopy = ' ' + strCopy;
	        charsAdded++;
	      }
	      // ^(? + rx + ) is needed, in combination with some str slicing, to
	      // simulate the 'y' flag.
	      reCopy = new RegExp('^(?:' + source + ')', flags);
	    }

	    if (NPCG_INCLUDED) {
	      reCopy = new RegExp('^' + source + '$(?!\\s)', flags);
	    }
	    if (UPDATES_LAST_INDEX_WRONG) lastIndex = re.lastIndex;

	    match = nativeExec.call(sticky ? reCopy : re, strCopy);

	    if (sticky) {
	      if (match) {
	        match.input = match.input.slice(charsAdded);
	        match[0] = match[0].slice(charsAdded);
	        match.index = re.lastIndex;
	        re.lastIndex += match[0].length;
	      } else re.lastIndex = 0;
	    } else if (UPDATES_LAST_INDEX_WRONG && match) {
	      re.lastIndex = re.global ? match.index + match[0].length : lastIndex;
	    }
	    if (NPCG_INCLUDED && match && match.length > 1) {
	      // Fix browsers whose `exec` methods don't consistently return `undefined`
	      // for NPCG, like IE8. NOTE: This doesn' work for /(.?)?/
	      nativeReplace.call(match[0], reCopy, function () {
	        for (i = 1; i < arguments.length - 2; i++) {
	          if (arguments[i] === undefined) match[i] = undefined;
	        }
	      });
	    }

	    return match;
	  };
	}

	var regexpExec = patchedExec;

	_export({ target: 'RegExp', proto: true, forced: /./.exec !== regexpExec }, {
	  exec: regexpExec
	});

	var UNSUPPORTED_Y$3 = regexpStickyHelpers.UNSUPPORTED_Y;

	// `RegExp.prototype.flags` getter
	// https://tc39.github.io/ecma262/#sec-get-regexp.prototype.flags
	if (descriptors && (/./g.flags != 'g' || UNSUPPORTED_Y$3)) {
	  objectDefineProperty.f(RegExp.prototype, 'flags', {
	    configurable: true,
	    get: regexpFlags
	  });
	}

	var TO_STRING = 'toString';
	var RegExpPrototype$1 = RegExp.prototype;
	var nativeToString = RegExpPrototype$1[TO_STRING];

	var NOT_GENERIC = fails(function () { return nativeToString.call({ source: 'a', flags: 'b' }) != '/a/b'; });
	// FF44- RegExp#toString has a wrong name
	var INCORRECT_NAME = nativeToString.name != TO_STRING;

	// `RegExp.prototype.toString` method
	// https://tc39.github.io/ecma262/#sec-regexp.prototype.tostring
	if (NOT_GENERIC || INCORRECT_NAME) {
	  redefine(RegExp.prototype, TO_STRING, function toString() {
	    var R = anObject(this);
	    var p = String(R.source);
	    var rf = R.flags;
	    var f = String(rf === undefined && R instanceof RegExp && !('flags' in RegExpPrototype$1) ? regexpFlags.call(R) : rf);
	    return '/' + p + '/' + f;
	  }, { unsafe: true });
	}

	// `Set` constructor
	// https://tc39.github.io/ecma262/#sec-set-objects
	var es_set = collection('Set', function (init) {
	  return function Set() { return init(this, arguments.length ? arguments[0] : undefined); };
	}, collectionStrong);

	// `String.prototype.{ codePointAt, at }` methods implementation
	var createMethod$5 = function (CONVERT_TO_STRING) {
	  return function ($this, pos) {
	    var S = String(requireObjectCoercible($this));
	    var position = toInteger(pos);
	    var size = S.length;
	    var first, second;
	    if (position < 0 || position >= size) return CONVERT_TO_STRING ? '' : undefined;
	    first = S.charCodeAt(position);
	    return first < 0xD800 || first > 0xDBFF || position + 1 === size
	      || (second = S.charCodeAt(position + 1)) < 0xDC00 || second > 0xDFFF
	        ? CONVERT_TO_STRING ? S.charAt(position) : first
	        : CONVERT_TO_STRING ? S.slice(position, position + 2) : (first - 0xD800 << 10) + (second - 0xDC00) + 0x10000;
	  };
	};

	var stringMultibyte = {
	  // `String.prototype.codePointAt` method
	  // https://tc39.github.io/ecma262/#sec-string.prototype.codepointat
	  codeAt: createMethod$5(false),
	  // `String.prototype.at` method
	  // https://github.com/mathiasbynens/String.prototype.at
	  charAt: createMethod$5(true)
	};

	var codeAt = stringMultibyte.codeAt;

	// `String.prototype.codePointAt` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.codepointat
	_export({ target: 'String', proto: true }, {
	  codePointAt: function codePointAt(pos) {
	    return codeAt(this, pos);
	  }
	});

	var notARegexp = function (it) {
	  if (isRegexp(it)) {
	    throw TypeError("The method doesn't accept regular expressions");
	  } return it;
	};

	var MATCH$2 = wellKnownSymbol('match');

	var correctIsRegexpLogic = function (METHOD_NAME) {
	  var regexp = /./;
	  try {
	    '/./'[METHOD_NAME](regexp);
	  } catch (e) {
	    try {
	      regexp[MATCH$2] = false;
	      return '/./'[METHOD_NAME](regexp);
	    } catch (f) { /* empty */ }
	  } return false;
	};

	var getOwnPropertyDescriptor$7 = objectGetOwnPropertyDescriptor.f;






	var nativeEndsWith = ''.endsWith;
	var min$5 = Math.min;

	var CORRECT_IS_REGEXP_LOGIC = correctIsRegexpLogic('endsWith');
	// https://github.com/zloirock/core-js/pull/702
	var MDN_POLYFILL_BUG =  !CORRECT_IS_REGEXP_LOGIC && !!function () {
	  var descriptor = getOwnPropertyDescriptor$7(String.prototype, 'endsWith');
	  return descriptor && !descriptor.writable;
	}();

	// `String.prototype.endsWith` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.endswith
	_export({ target: 'String', proto: true, forced: !MDN_POLYFILL_BUG && !CORRECT_IS_REGEXP_LOGIC }, {
	  endsWith: function endsWith(searchString /* , endPosition = @length */) {
	    var that = String(requireObjectCoercible(this));
	    notARegexp(searchString);
	    var endPosition = arguments.length > 1 ? arguments[1] : undefined;
	    var len = toLength(that.length);
	    var end = endPosition === undefined ? len : min$5(toLength(endPosition), len);
	    var search = String(searchString);
	    return nativeEndsWith
	      ? nativeEndsWith.call(that, search, end)
	      : that.slice(end - search.length, end) === search;
	  }
	});

	var fromCharCode = String.fromCharCode;
	var nativeFromCodePoint = String.fromCodePoint;

	// length should be 1, old FF problem
	var INCORRECT_LENGTH = !!nativeFromCodePoint && nativeFromCodePoint.length != 1;

	// `String.fromCodePoint` method
	// https://tc39.github.io/ecma262/#sec-string.fromcodepoint
	_export({ target: 'String', stat: true, forced: INCORRECT_LENGTH }, {
	  fromCodePoint: function fromCodePoint(x) { // eslint-disable-line no-unused-vars
	    var elements = [];
	    var length = arguments.length;
	    var i = 0;
	    var code;
	    while (length > i) {
	      code = +arguments[i++];
	      if (toAbsoluteIndex(code, 0x10FFFF) !== code) throw RangeError(code + ' is not a valid code point');
	      elements.push(code < 0x10000
	        ? fromCharCode(code)
	        : fromCharCode(((code -= 0x10000) >> 10) + 0xD800, code % 0x400 + 0xDC00)
	      );
	    } return elements.join('');
	  }
	});

	// `String.prototype.includes` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.includes
	_export({ target: 'String', proto: true, forced: !correctIsRegexpLogic('includes') }, {
	  includes: function includes(searchString /* , position = 0 */) {
	    return !!~String(requireObjectCoercible(this))
	      .indexOf(notARegexp(searchString), arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	var charAt = stringMultibyte.charAt;



	var STRING_ITERATOR = 'String Iterator';
	var setInternalState$6 = internalState.set;
	var getInternalState$4 = internalState.getterFor(STRING_ITERATOR);

	// `String.prototype[@@iterator]` method
	// https://tc39.github.io/ecma262/#sec-string.prototype-@@iterator
	defineIterator(String, 'String', function (iterated) {
	  setInternalState$6(this, {
	    type: STRING_ITERATOR,
	    string: String(iterated),
	    index: 0
	  });
	// `%StringIteratorPrototype%.next` method
	// https://tc39.github.io/ecma262/#sec-%stringiteratorprototype%.next
	}, function next() {
	  var state = getInternalState$4(this);
	  var string = state.string;
	  var index = state.index;
	  var point;
	  if (index >= string.length) return { value: undefined, done: true };
	  point = charAt(string, index);
	  state.index += point.length;
	  return { value: point, done: false };
	});

	// TODO: Remove from `core-js@4` since it's moved to entry points







	var SPECIES$6 = wellKnownSymbol('species');

	var REPLACE_SUPPORTS_NAMED_GROUPS = !fails(function () {
	  // #replace needs built-in support for named groups.
	  // #match works fine because it just return the exec results, even if it has
	  // a "grops" property.
	  var re = /./;
	  re.exec = function () {
	    var result = [];
	    result.groups = { a: '7' };
	    return result;
	  };
	  return ''.replace(re, '$<a>') !== '7';
	});

	// IE <= 11 replaces $0 with the whole match, as if it was $&
	// https://stackoverflow.com/questions/6024666/getting-ie-to-replace-a-regex-with-the-literal-string-0
	var REPLACE_KEEPS_$0 = (function () {
	  return 'a'.replace(/./, '$0') === '$0';
	})();

	var REPLACE = wellKnownSymbol('replace');
	// Safari <= 13.0.3(?) substitutes nth capture where n>m with an empty string
	var REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE = (function () {
	  if (/./[REPLACE]) {
	    return /./[REPLACE]('a', '$0') === '';
	  }
	  return false;
	})();

	// Chrome 51 has a buggy "split" implementation when RegExp#exec !== nativeExec
	// Weex JS has frozen built-in prototypes, so use try / catch wrapper
	var SPLIT_WORKS_WITH_OVERWRITTEN_EXEC = !fails(function () {
	  var re = /(?:)/;
	  var originalExec = re.exec;
	  re.exec = function () { return originalExec.apply(this, arguments); };
	  var result = 'ab'.split(re);
	  return result.length !== 2 || result[0] !== 'a' || result[1] !== 'b';
	});

	var fixRegexpWellKnownSymbolLogic = function (KEY, length, exec, sham) {
	  var SYMBOL = wellKnownSymbol(KEY);

	  var DELEGATES_TO_SYMBOL = !fails(function () {
	    // String methods call symbol-named RegEp methods
	    var O = {};
	    O[SYMBOL] = function () { return 7; };
	    return ''[KEY](O) != 7;
	  });

	  var DELEGATES_TO_EXEC = DELEGATES_TO_SYMBOL && !fails(function () {
	    // Symbol-named RegExp methods call .exec
	    var execCalled = false;
	    var re = /a/;

	    if (KEY === 'split') {
	      // We can't use real regex here since it causes deoptimization
	      // and serious performance degradation in V8
	      // https://github.com/zloirock/core-js/issues/306
	      re = {};
	      // RegExp[@@split] doesn't call the regex's exec method, but first creates
	      // a new one. We need to return the patched regex when creating the new one.
	      re.constructor = {};
	      re.constructor[SPECIES$6] = function () { return re; };
	      re.flags = '';
	      re[SYMBOL] = /./[SYMBOL];
	    }

	    re.exec = function () { execCalled = true; return null; };

	    re[SYMBOL]('');
	    return !execCalled;
	  });

	  if (
	    !DELEGATES_TO_SYMBOL ||
	    !DELEGATES_TO_EXEC ||
	    (KEY === 'replace' && !(
	      REPLACE_SUPPORTS_NAMED_GROUPS &&
	      REPLACE_KEEPS_$0 &&
	      !REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE
	    )) ||
	    (KEY === 'split' && !SPLIT_WORKS_WITH_OVERWRITTEN_EXEC)
	  ) {
	    var nativeRegExpMethod = /./[SYMBOL];
	    var methods = exec(SYMBOL, ''[KEY], function (nativeMethod, regexp, str, arg2, forceStringMethod) {
	      if (regexp.exec === regexpExec) {
	        if (DELEGATES_TO_SYMBOL && !forceStringMethod) {
	          // The native String method already delegates to @@method (this
	          // polyfilled function), leasing to infinite recursion.
	          // We avoid it by directly calling the native @@method method.
	          return { done: true, value: nativeRegExpMethod.call(regexp, str, arg2) };
	        }
	        return { done: true, value: nativeMethod.call(str, regexp, arg2) };
	      }
	      return { done: false };
	    }, {
	      REPLACE_KEEPS_$0: REPLACE_KEEPS_$0,
	      REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE: REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE
	    });
	    var stringMethod = methods[0];
	    var regexMethod = methods[1];

	    redefine(String.prototype, KEY, stringMethod);
	    redefine(RegExp.prototype, SYMBOL, length == 2
	      // 21.2.5.8 RegExp.prototype[@@replace](string, replaceValue)
	      // 21.2.5.11 RegExp.prototype[@@split](string, limit)
	      ? function (string, arg) { return regexMethod.call(string, this, arg); }
	      // 21.2.5.6 RegExp.prototype[@@match](string)
	      // 21.2.5.9 RegExp.prototype[@@search](string)
	      : function (string) { return regexMethod.call(string, this); }
	    );
	  }

	  if (sham) createNonEnumerableProperty(RegExp.prototype[SYMBOL], 'sham', true);
	};

	var charAt$1 = stringMultibyte.charAt;

	// `AdvanceStringIndex` abstract operation
	// https://tc39.github.io/ecma262/#sec-advancestringindex
	var advanceStringIndex = function (S, index, unicode) {
	  return index + (unicode ? charAt$1(S, index).length : 1);
	};

	// `RegExpExec` abstract operation
	// https://tc39.github.io/ecma262/#sec-regexpexec
	var regexpExecAbstract = function (R, S) {
	  var exec = R.exec;
	  if (typeof exec === 'function') {
	    var result = exec.call(R, S);
	    if (typeof result !== 'object') {
	      throw TypeError('RegExp exec method returned something other than an Object or null');
	    }
	    return result;
	  }

	  if (classofRaw(R) !== 'RegExp') {
	    throw TypeError('RegExp#exec called on incompatible receiver');
	  }

	  return regexpExec.call(R, S);
	};

	// @@match logic
	fixRegexpWellKnownSymbolLogic('match', 1, function (MATCH, nativeMatch, maybeCallNative) {
	  return [
	    // `String.prototype.match` method
	    // https://tc39.github.io/ecma262/#sec-string.prototype.match
	    function match(regexp) {
	      var O = requireObjectCoercible(this);
	      var matcher = regexp == undefined ? undefined : regexp[MATCH];
	      return matcher !== undefined ? matcher.call(regexp, O) : new RegExp(regexp)[MATCH](String(O));
	    },
	    // `RegExp.prototype[@@match]` method
	    // https://tc39.github.io/ecma262/#sec-regexp.prototype-@@match
	    function (regexp) {
	      var res = maybeCallNative(nativeMatch, regexp, this);
	      if (res.done) return res.value;

	      var rx = anObject(regexp);
	      var S = String(this);

	      if (!rx.global) return regexpExecAbstract(rx, S);

	      var fullUnicode = rx.unicode;
	      rx.lastIndex = 0;
	      var A = [];
	      var n = 0;
	      var result;
	      while ((result = regexpExecAbstract(rx, S)) !== null) {
	        var matchStr = String(result[0]);
	        A[n] = matchStr;
	        if (matchStr === '') rx.lastIndex = advanceStringIndex(S, toLength(rx.lastIndex), fullUnicode);
	        n++;
	      }
	      return n === 0 ? null : A;
	    }
	  ];
	});

	// https://github.com/tc39/proposal-string-pad-start-end




	var ceil$2 = Math.ceil;

	// `String.prototype.{ padStart, padEnd }` methods implementation
	var createMethod$6 = function (IS_END) {
	  return function ($this, maxLength, fillString) {
	    var S = String(requireObjectCoercible($this));
	    var stringLength = S.length;
	    var fillStr = fillString === undefined ? ' ' : String(fillString);
	    var intMaxLength = toLength(maxLength);
	    var fillLen, stringFiller;
	    if (intMaxLength <= stringLength || fillStr == '') return S;
	    fillLen = intMaxLength - stringLength;
	    stringFiller = stringRepeat.call(fillStr, ceil$2(fillLen / fillStr.length));
	    if (stringFiller.length > fillLen) stringFiller = stringFiller.slice(0, fillLen);
	    return IS_END ? S + stringFiller : stringFiller + S;
	  };
	};

	var stringPad = {
	  // `String.prototype.padStart` method
	  // https://tc39.github.io/ecma262/#sec-string.prototype.padstart
	  start: createMethod$6(false),
	  // `String.prototype.padEnd` method
	  // https://tc39.github.io/ecma262/#sec-string.prototype.padend
	  end: createMethod$6(true)
	};

	// https://github.com/zloirock/core-js/issues/280


	// eslint-disable-next-line unicorn/no-unsafe-regex
	var stringPadWebkitBug = /Version\/10\.\d+(\.\d+)?( Mobile\/\w+)? Safari\//.test(engineUserAgent);

	var $padEnd = stringPad.end;


	// `String.prototype.padEnd` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.padend
	_export({ target: 'String', proto: true, forced: stringPadWebkitBug }, {
	  padEnd: function padEnd(maxLength /* , fillString = ' ' */) {
	    return $padEnd(this, maxLength, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	var $padStart = stringPad.start;


	// `String.prototype.padStart` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.padstart
	_export({ target: 'String', proto: true, forced: stringPadWebkitBug }, {
	  padStart: function padStart(maxLength /* , fillString = ' ' */) {
	    return $padStart(this, maxLength, arguments.length > 1 ? arguments[1] : undefined);
	  }
	});

	// `String.raw` method
	// https://tc39.github.io/ecma262/#sec-string.raw
	_export({ target: 'String', stat: true }, {
	  raw: function raw(template) {
	    var rawTemplate = toIndexedObject(template.raw);
	    var literalSegments = toLength(rawTemplate.length);
	    var argumentsLength = arguments.length;
	    var elements = [];
	    var i = 0;
	    while (literalSegments > i) {
	      elements.push(String(rawTemplate[i++]));
	      if (i < argumentsLength) elements.push(String(arguments[i]));
	    } return elements.join('');
	  }
	});

	// `String.prototype.repeat` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.repeat
	_export({ target: 'String', proto: true }, {
	  repeat: stringRepeat
	});

	var max$3 = Math.max;
	var min$6 = Math.min;
	var floor$6 = Math.floor;
	var SUBSTITUTION_SYMBOLS = /\$([$&'`]|\d\d?|<[^>]*>)/g;
	var SUBSTITUTION_SYMBOLS_NO_NAMED = /\$([$&'`]|\d\d?)/g;

	var maybeToString = function (it) {
	  return it === undefined ? it : String(it);
	};

	// @@replace logic
	fixRegexpWellKnownSymbolLogic('replace', 2, function (REPLACE, nativeReplace, maybeCallNative, reason) {
	  var REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE = reason.REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE;
	  var REPLACE_KEEPS_$0 = reason.REPLACE_KEEPS_$0;
	  var UNSAFE_SUBSTITUTE = REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE ? '$' : '$0';

	  return [
	    // `String.prototype.replace` method
	    // https://tc39.github.io/ecma262/#sec-string.prototype.replace
	    function replace(searchValue, replaceValue) {
	      var O = requireObjectCoercible(this);
	      var replacer = searchValue == undefined ? undefined : searchValue[REPLACE];
	      return replacer !== undefined
	        ? replacer.call(searchValue, O, replaceValue)
	        : nativeReplace.call(String(O), searchValue, replaceValue);
	    },
	    // `RegExp.prototype[@@replace]` method
	    // https://tc39.github.io/ecma262/#sec-regexp.prototype-@@replace
	    function (regexp, replaceValue) {
	      if (
	        (!REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE && REPLACE_KEEPS_$0) ||
	        (typeof replaceValue === 'string' && replaceValue.indexOf(UNSAFE_SUBSTITUTE) === -1)
	      ) {
	        var res = maybeCallNative(nativeReplace, regexp, this, replaceValue);
	        if (res.done) return res.value;
	      }

	      var rx = anObject(regexp);
	      var S = String(this);

	      var functionalReplace = typeof replaceValue === 'function';
	      if (!functionalReplace) replaceValue = String(replaceValue);

	      var global = rx.global;
	      if (global) {
	        var fullUnicode = rx.unicode;
	        rx.lastIndex = 0;
	      }
	      var results = [];
	      while (true) {
	        var result = regexpExecAbstract(rx, S);
	        if (result === null) break;

	        results.push(result);
	        if (!global) break;

	        var matchStr = String(result[0]);
	        if (matchStr === '') rx.lastIndex = advanceStringIndex(S, toLength(rx.lastIndex), fullUnicode);
	      }

	      var accumulatedResult = '';
	      var nextSourcePosition = 0;
	      for (var i = 0; i < results.length; i++) {
	        result = results[i];

	        var matched = String(result[0]);
	        var position = max$3(min$6(toInteger(result.index), S.length), 0);
	        var captures = [];
	        // NOTE: This is equivalent to
	        //   captures = result.slice(1).map(maybeToString)
	        // but for some reason `nativeSlice.call(result, 1, result.length)` (called in
	        // the slice polyfill when slicing native arrays) "doesn't work" in safari 9 and
	        // causes a crash (https://pastebin.com/N21QzeQA) when trying to debug it.
	        for (var j = 1; j < result.length; j++) captures.push(maybeToString(result[j]));
	        var namedCaptures = result.groups;
	        if (functionalReplace) {
	          var replacerArgs = [matched].concat(captures, position, S);
	          if (namedCaptures !== undefined) replacerArgs.push(namedCaptures);
	          var replacement = String(replaceValue.apply(undefined, replacerArgs));
	        } else {
	          replacement = getSubstitution(matched, S, position, captures, namedCaptures, replaceValue);
	        }
	        if (position >= nextSourcePosition) {
	          accumulatedResult += S.slice(nextSourcePosition, position) + replacement;
	          nextSourcePosition = position + matched.length;
	        }
	      }
	      return accumulatedResult + S.slice(nextSourcePosition);
	    }
	  ];

	  // https://tc39.github.io/ecma262/#sec-getsubstitution
	  function getSubstitution(matched, str, position, captures, namedCaptures, replacement) {
	    var tailPos = position + matched.length;
	    var m = captures.length;
	    var symbols = SUBSTITUTION_SYMBOLS_NO_NAMED;
	    if (namedCaptures !== undefined) {
	      namedCaptures = toObject(namedCaptures);
	      symbols = SUBSTITUTION_SYMBOLS;
	    }
	    return nativeReplace.call(replacement, symbols, function (match, ch) {
	      var capture;
	      switch (ch.charAt(0)) {
	        case '$': return '$';
	        case '&': return matched;
	        case '`': return str.slice(0, position);
	        case "'": return str.slice(tailPos);
	        case '<':
	          capture = namedCaptures[ch.slice(1, -1)];
	          break;
	        default: // \d\d?
	          var n = +ch;
	          if (n === 0) return match;
	          if (n > m) {
	            var f = floor$6(n / 10);
	            if (f === 0) return match;
	            if (f <= m) return captures[f - 1] === undefined ? ch.charAt(1) : captures[f - 1] + ch.charAt(1);
	            return match;
	          }
	          capture = captures[n - 1];
	      }
	      return capture === undefined ? '' : capture;
	    });
	  }
	});

	// @@search logic
	fixRegexpWellKnownSymbolLogic('search', 1, function (SEARCH, nativeSearch, maybeCallNative) {
	  return [
	    // `String.prototype.search` method
	    // https://tc39.github.io/ecma262/#sec-string.prototype.search
	    function search(regexp) {
	      var O = requireObjectCoercible(this);
	      var searcher = regexp == undefined ? undefined : regexp[SEARCH];
	      return searcher !== undefined ? searcher.call(regexp, O) : new RegExp(regexp)[SEARCH](String(O));
	    },
	    // `RegExp.prototype[@@search]` method
	    // https://tc39.github.io/ecma262/#sec-regexp.prototype-@@search
	    function (regexp) {
	      var res = maybeCallNative(nativeSearch, regexp, this);
	      if (res.done) return res.value;

	      var rx = anObject(regexp);
	      var S = String(this);

	      var previousLastIndex = rx.lastIndex;
	      if (!sameValue(previousLastIndex, 0)) rx.lastIndex = 0;
	      var result = regexpExecAbstract(rx, S);
	      if (!sameValue(rx.lastIndex, previousLastIndex)) rx.lastIndex = previousLastIndex;
	      return result === null ? -1 : result.index;
	    }
	  ];
	});

	var arrayPush = [].push;
	var min$7 = Math.min;
	var MAX_UINT32 = 0xFFFFFFFF;

	// babel-minify transpiles RegExp('x', 'y') -> /x/y and it causes SyntaxError
	var SUPPORTS_Y = !fails(function () { return !RegExp(MAX_UINT32, 'y'); });

	// @@split logic
	fixRegexpWellKnownSymbolLogic('split', 2, function (SPLIT, nativeSplit, maybeCallNative) {
	  var internalSplit;
	  if (
	    'abbc'.split(/(b)*/)[1] == 'c' ||
	    'test'.split(/(?:)/, -1).length != 4 ||
	    'ab'.split(/(?:ab)*/).length != 2 ||
	    '.'.split(/(.?)(.?)/).length != 4 ||
	    '.'.split(/()()/).length > 1 ||
	    ''.split(/.?/).length
	  ) {
	    // based on es5-shim implementation, need to rework it
	    internalSplit = function (separator, limit) {
	      var string = String(requireObjectCoercible(this));
	      var lim = limit === undefined ? MAX_UINT32 : limit >>> 0;
	      if (lim === 0) return [];
	      if (separator === undefined) return [string];
	      // If `separator` is not a regex, use native split
	      if (!isRegexp(separator)) {
	        return nativeSplit.call(string, separator, lim);
	      }
	      var output = [];
	      var flags = (separator.ignoreCase ? 'i' : '') +
	                  (separator.multiline ? 'm' : '') +
	                  (separator.unicode ? 'u' : '') +
	                  (separator.sticky ? 'y' : '');
	      var lastLastIndex = 0;
	      // Make `global` and avoid `lastIndex` issues by working with a copy
	      var separatorCopy = new RegExp(separator.source, flags + 'g');
	      var match, lastIndex, lastLength;
	      while (match = regexpExec.call(separatorCopy, string)) {
	        lastIndex = separatorCopy.lastIndex;
	        if (lastIndex > lastLastIndex) {
	          output.push(string.slice(lastLastIndex, match.index));
	          if (match.length > 1 && match.index < string.length) arrayPush.apply(output, match.slice(1));
	          lastLength = match[0].length;
	          lastLastIndex = lastIndex;
	          if (output.length >= lim) break;
	        }
	        if (separatorCopy.lastIndex === match.index) separatorCopy.lastIndex++; // Avoid an infinite loop
	      }
	      if (lastLastIndex === string.length) {
	        if (lastLength || !separatorCopy.test('')) output.push('');
	      } else output.push(string.slice(lastLastIndex));
	      return output.length > lim ? output.slice(0, lim) : output;
	    };
	  // Chakra, V8
	  } else if ('0'.split(undefined, 0).length) {
	    internalSplit = function (separator, limit) {
	      return separator === undefined && limit === 0 ? [] : nativeSplit.call(this, separator, limit);
	    };
	  } else internalSplit = nativeSplit;

	  return [
	    // `String.prototype.split` method
	    // https://tc39.github.io/ecma262/#sec-string.prototype.split
	    function split(separator, limit) {
	      var O = requireObjectCoercible(this);
	      var splitter = separator == undefined ? undefined : separator[SPLIT];
	      return splitter !== undefined
	        ? splitter.call(separator, O, limit)
	        : internalSplit.call(String(O), separator, limit);
	    },
	    // `RegExp.prototype[@@split]` method
	    // https://tc39.github.io/ecma262/#sec-regexp.prototype-@@split
	    //
	    // NOTE: This cannot be properly polyfilled in engines that don't support
	    // the 'y' flag.
	    function (regexp, limit) {
	      var res = maybeCallNative(internalSplit, regexp, this, limit, internalSplit !== nativeSplit);
	      if (res.done) return res.value;

	      var rx = anObject(regexp);
	      var S = String(this);
	      var C = speciesConstructor(rx, RegExp);

	      var unicodeMatching = rx.unicode;
	      var flags = (rx.ignoreCase ? 'i' : '') +
	                  (rx.multiline ? 'm' : '') +
	                  (rx.unicode ? 'u' : '') +
	                  (SUPPORTS_Y ? 'y' : 'g');

	      // ^(? + rx + ) is needed, in combination with some S slicing, to
	      // simulate the 'y' flag.
	      var splitter = new C(SUPPORTS_Y ? rx : '^(?:' + rx.source + ')', flags);
	      var lim = limit === undefined ? MAX_UINT32 : limit >>> 0;
	      if (lim === 0) return [];
	      if (S.length === 0) return regexpExecAbstract(splitter, S) === null ? [S] : [];
	      var p = 0;
	      var q = 0;
	      var A = [];
	      while (q < S.length) {
	        splitter.lastIndex = SUPPORTS_Y ? q : 0;
	        var z = regexpExecAbstract(splitter, SUPPORTS_Y ? S : S.slice(q));
	        var e;
	        if (
	          z === null ||
	          (e = min$7(toLength(splitter.lastIndex + (SUPPORTS_Y ? 0 : q)), S.length)) === p
	        ) {
	          q = advanceStringIndex(S, q, unicodeMatching);
	        } else {
	          A.push(S.slice(p, q));
	          if (A.length === lim) return A;
	          for (var i = 1; i <= z.length - 1; i++) {
	            A.push(z[i]);
	            if (A.length === lim) return A;
	          }
	          q = p = e;
	        }
	      }
	      A.push(S.slice(p));
	      return A;
	    }
	  ];
	}, !SUPPORTS_Y);

	var getOwnPropertyDescriptor$8 = objectGetOwnPropertyDescriptor.f;






	var nativeStartsWith = ''.startsWith;
	var min$8 = Math.min;

	var CORRECT_IS_REGEXP_LOGIC$1 = correctIsRegexpLogic('startsWith');
	// https://github.com/zloirock/core-js/pull/702
	var MDN_POLYFILL_BUG$1 =  !CORRECT_IS_REGEXP_LOGIC$1 && !!function () {
	  var descriptor = getOwnPropertyDescriptor$8(String.prototype, 'startsWith');
	  return descriptor && !descriptor.writable;
	}();

	// `String.prototype.startsWith` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.startswith
	_export({ target: 'String', proto: true, forced: !MDN_POLYFILL_BUG$1 && !CORRECT_IS_REGEXP_LOGIC$1 }, {
	  startsWith: function startsWith(searchString /* , position = 0 */) {
	    var that = String(requireObjectCoercible(this));
	    notARegexp(searchString);
	    var index = toLength(min$8(arguments.length > 1 ? arguments[1] : undefined, that.length));
	    var search = String(searchString);
	    return nativeStartsWith
	      ? nativeStartsWith.call(that, search, index)
	      : that.slice(index, index + search.length) === search;
	  }
	});

	var non = '\u200B\u0085\u180E';

	// check that a method works with the correct list
	// of whitespaces and has a correct name
	var stringTrimForced = function (METHOD_NAME) {
	  return fails(function () {
	    return !!whitespaces[METHOD_NAME]() || non[METHOD_NAME]() != non || whitespaces[METHOD_NAME].name !== METHOD_NAME;
	  });
	};

	var $trim = stringTrim.trim;


	// `String.prototype.trim` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.trim
	_export({ target: 'String', proto: true, forced: stringTrimForced('trim') }, {
	  trim: function trim() {
	    return $trim(this);
	  }
	});

	var $trimEnd = stringTrim.end;


	var FORCED$c = stringTrimForced('trimEnd');

	var trimEnd = FORCED$c ? function trimEnd() {
	  return $trimEnd(this);
	} : ''.trimEnd;

	// `String.prototype.{ trimEnd, trimRight }` methods
	// https://github.com/tc39/ecmascript-string-left-right-trim
	_export({ target: 'String', proto: true, forced: FORCED$c }, {
	  trimEnd: trimEnd,
	  trimRight: trimEnd
	});

	var $trimStart = stringTrim.start;


	var FORCED$d = stringTrimForced('trimStart');

	var trimStart = FORCED$d ? function trimStart() {
	  return $trimStart(this);
	} : ''.trimStart;

	// `String.prototype.{ trimStart, trimLeft }` methods
	// https://github.com/tc39/ecmascript-string-left-right-trim
	_export({ target: 'String', proto: true, forced: FORCED$d }, {
	  trimStart: trimStart,
	  trimLeft: trimStart
	});

	var quot = /"/g;

	// B.2.3.2.1 CreateHTML(string, tag, attribute, value)
	// https://tc39.github.io/ecma262/#sec-createhtml
	var createHtml = function (string, tag, attribute, value) {
	  var S = String(requireObjectCoercible(string));
	  var p1 = '<' + tag;
	  if (attribute !== '') p1 += ' ' + attribute + '="' + String(value).replace(quot, '&quot;') + '"';
	  return p1 + '>' + S + '</' + tag + '>';
	};

	// check the existence of a method, lowercase
	// of a tag and escaping quotes in arguments
	var stringHtmlForced = function (METHOD_NAME) {
	  return fails(function () {
	    var test = ''[METHOD_NAME]('"');
	    return test !== test.toLowerCase() || test.split('"').length > 3;
	  });
	};

	// `String.prototype.anchor` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.anchor
	_export({ target: 'String', proto: true, forced: stringHtmlForced('anchor') }, {
	  anchor: function anchor(name) {
	    return createHtml(this, 'a', 'name', name);
	  }
	});

	// `String.prototype.big` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.big
	_export({ target: 'String', proto: true, forced: stringHtmlForced('big') }, {
	  big: function big() {
	    return createHtml(this, 'big', '', '');
	  }
	});

	// `String.prototype.blink` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.blink
	_export({ target: 'String', proto: true, forced: stringHtmlForced('blink') }, {
	  blink: function blink() {
	    return createHtml(this, 'blink', '', '');
	  }
	});

	// `String.prototype.bold` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.bold
	_export({ target: 'String', proto: true, forced: stringHtmlForced('bold') }, {
	  bold: function bold() {
	    return createHtml(this, 'b', '', '');
	  }
	});

	// `String.prototype.fixed` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.fixed
	_export({ target: 'String', proto: true, forced: stringHtmlForced('fixed') }, {
	  fixed: function fixed() {
	    return createHtml(this, 'tt', '', '');
	  }
	});

	// `String.prototype.fontcolor` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.fontcolor
	_export({ target: 'String', proto: true, forced: stringHtmlForced('fontcolor') }, {
	  fontcolor: function fontcolor(color) {
	    return createHtml(this, 'font', 'color', color);
	  }
	});

	// `String.prototype.fontsize` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.fontsize
	_export({ target: 'String', proto: true, forced: stringHtmlForced('fontsize') }, {
	  fontsize: function fontsize(size) {
	    return createHtml(this, 'font', 'size', size);
	  }
	});

	// `String.prototype.italics` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.italics
	_export({ target: 'String', proto: true, forced: stringHtmlForced('italics') }, {
	  italics: function italics() {
	    return createHtml(this, 'i', '', '');
	  }
	});

	// `String.prototype.link` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.link
	_export({ target: 'String', proto: true, forced: stringHtmlForced('link') }, {
	  link: function link(url) {
	    return createHtml(this, 'a', 'href', url);
	  }
	});

	// `String.prototype.small` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.small
	_export({ target: 'String', proto: true, forced: stringHtmlForced('small') }, {
	  small: function small() {
	    return createHtml(this, 'small', '', '');
	  }
	});

	// `String.prototype.strike` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.strike
	_export({ target: 'String', proto: true, forced: stringHtmlForced('strike') }, {
	  strike: function strike() {
	    return createHtml(this, 'strike', '', '');
	  }
	});

	// `String.prototype.sub` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.sub
	_export({ target: 'String', proto: true, forced: stringHtmlForced('sub') }, {
	  sub: function sub() {
	    return createHtml(this, 'sub', '', '');
	  }
	});

	// `String.prototype.sup` method
	// https://tc39.github.io/ecma262/#sec-string.prototype.sup
	_export({ target: 'String', proto: true, forced: stringHtmlForced('sup') }, {
	  sup: function sup() {
	    return createHtml(this, 'sup', '', '');
	  }
	});

	var defineProperty$a = objectDefineProperty.f;





	var Int8Array$1 = global_1.Int8Array;
	var Int8ArrayPrototype = Int8Array$1 && Int8Array$1.prototype;
	var Uint8ClampedArray = global_1.Uint8ClampedArray;
	var Uint8ClampedArrayPrototype = Uint8ClampedArray && Uint8ClampedArray.prototype;
	var TypedArray = Int8Array$1 && objectGetPrototypeOf(Int8Array$1);
	var TypedArrayPrototype = Int8ArrayPrototype && objectGetPrototypeOf(Int8ArrayPrototype);
	var ObjectPrototype$3 = Object.prototype;
	var isPrototypeOf = ObjectPrototype$3.isPrototypeOf;

	var TO_STRING_TAG$3 = wellKnownSymbol('toStringTag');
	var TYPED_ARRAY_TAG = uid('TYPED_ARRAY_TAG');
	// Fixing native typed arrays in Opera Presto crashes the browser, see #595
	var NATIVE_ARRAY_BUFFER_VIEWS = arrayBufferNative && !!objectSetPrototypeOf && classof(global_1.opera) !== 'Opera';
	var TYPED_ARRAY_TAG_REQIRED = false;
	var NAME$1;

	var TypedArrayConstructorsList = {
	  Int8Array: 1,
	  Uint8Array: 1,
	  Uint8ClampedArray: 1,
	  Int16Array: 2,
	  Uint16Array: 2,
	  Int32Array: 4,
	  Uint32Array: 4,
	  Float32Array: 4,
	  Float64Array: 8
	};

	var isView = function isView(it) {
	  var klass = classof(it);
	  return klass === 'DataView' || has(TypedArrayConstructorsList, klass);
	};

	var isTypedArray = function (it) {
	  return isObject(it) && has(TypedArrayConstructorsList, classof(it));
	};

	var aTypedArray = function (it) {
	  if (isTypedArray(it)) return it;
	  throw TypeError('Target is not a typed array');
	};

	var aTypedArrayConstructor = function (C) {
	  if (objectSetPrototypeOf) {
	    if (isPrototypeOf.call(TypedArray, C)) return C;
	  } else for (var ARRAY in TypedArrayConstructorsList) if (has(TypedArrayConstructorsList, NAME$1)) {
	    var TypedArrayConstructor = global_1[ARRAY];
	    if (TypedArrayConstructor && (C === TypedArrayConstructor || isPrototypeOf.call(TypedArrayConstructor, C))) {
	      return C;
	    }
	  } throw TypeError('Target is not a typed array constructor');
	};

	var exportTypedArrayMethod = function (KEY, property, forced) {
	  if (!descriptors) return;
	  if (forced) for (var ARRAY in TypedArrayConstructorsList) {
	    var TypedArrayConstructor = global_1[ARRAY];
	    if (TypedArrayConstructor && has(TypedArrayConstructor.prototype, KEY)) {
	      delete TypedArrayConstructor.prototype[KEY];
	    }
	  }
	  if (!TypedArrayPrototype[KEY] || forced) {
	    redefine(TypedArrayPrototype, KEY, forced ? property
	      : NATIVE_ARRAY_BUFFER_VIEWS && Int8ArrayPrototype[KEY] || property);
	  }
	};

	var exportTypedArrayStaticMethod = function (KEY, property, forced) {
	  var ARRAY, TypedArrayConstructor;
	  if (!descriptors) return;
	  if (objectSetPrototypeOf) {
	    if (forced) for (ARRAY in TypedArrayConstructorsList) {
	      TypedArrayConstructor = global_1[ARRAY];
	      if (TypedArrayConstructor && has(TypedArrayConstructor, KEY)) {
	        delete TypedArrayConstructor[KEY];
	      }
	    }
	    if (!TypedArray[KEY] || forced) {
	      // V8 ~ Chrome 49-50 `%TypedArray%` methods are non-writable non-configurable
	      try {
	        return redefine(TypedArray, KEY, forced ? property : NATIVE_ARRAY_BUFFER_VIEWS && Int8Array$1[KEY] || property);
	      } catch (error) { /* empty */ }
	    } else return;
	  }
	  for (ARRAY in TypedArrayConstructorsList) {
	    TypedArrayConstructor = global_1[ARRAY];
	    if (TypedArrayConstructor && (!TypedArrayConstructor[KEY] || forced)) {
	      redefine(TypedArrayConstructor, KEY, property);
	    }
	  }
	};

	for (NAME$1 in TypedArrayConstructorsList) {
	  if (!global_1[NAME$1]) NATIVE_ARRAY_BUFFER_VIEWS = false;
	}

	// WebKit bug - typed arrays constructors prototype is Object.prototype
	if (!NATIVE_ARRAY_BUFFER_VIEWS || typeof TypedArray != 'function' || TypedArray === Function.prototype) {
	  // eslint-disable-next-line no-shadow
	  TypedArray = function TypedArray() {
	    throw TypeError('Incorrect invocation');
	  };
	  if (NATIVE_ARRAY_BUFFER_VIEWS) for (NAME$1 in TypedArrayConstructorsList) {
	    if (global_1[NAME$1]) objectSetPrototypeOf(global_1[NAME$1], TypedArray);
	  }
	}

	if (!NATIVE_ARRAY_BUFFER_VIEWS || !TypedArrayPrototype || TypedArrayPrototype === ObjectPrototype$3) {
	  TypedArrayPrototype = TypedArray.prototype;
	  if (NATIVE_ARRAY_BUFFER_VIEWS) for (NAME$1 in TypedArrayConstructorsList) {
	    if (global_1[NAME$1]) objectSetPrototypeOf(global_1[NAME$1].prototype, TypedArrayPrototype);
	  }
	}

	// WebKit bug - one more object in Uint8ClampedArray prototype chain
	if (NATIVE_ARRAY_BUFFER_VIEWS && objectGetPrototypeOf(Uint8ClampedArrayPrototype) !== TypedArrayPrototype) {
	  objectSetPrototypeOf(Uint8ClampedArrayPrototype, TypedArrayPrototype);
	}

	if (descriptors && !has(TypedArrayPrototype, TO_STRING_TAG$3)) {
	  TYPED_ARRAY_TAG_REQIRED = true;
	  defineProperty$a(TypedArrayPrototype, TO_STRING_TAG$3, { get: function () {
	    return isObject(this) ? this[TYPED_ARRAY_TAG] : undefined;
	  } });
	  for (NAME$1 in TypedArrayConstructorsList) if (global_1[NAME$1]) {
	    createNonEnumerableProperty(global_1[NAME$1], TYPED_ARRAY_TAG, NAME$1);
	  }
	}

	var arrayBufferViewCore = {
	  NATIVE_ARRAY_BUFFER_VIEWS: NATIVE_ARRAY_BUFFER_VIEWS,
	  TYPED_ARRAY_TAG: TYPED_ARRAY_TAG_REQIRED && TYPED_ARRAY_TAG,
	  aTypedArray: aTypedArray,
	  aTypedArrayConstructor: aTypedArrayConstructor,
	  exportTypedArrayMethod: exportTypedArrayMethod,
	  exportTypedArrayStaticMethod: exportTypedArrayStaticMethod,
	  isView: isView,
	  isTypedArray: isTypedArray,
	  TypedArray: TypedArray,
	  TypedArrayPrototype: TypedArrayPrototype
	};

	/* eslint-disable no-new */



	var NATIVE_ARRAY_BUFFER_VIEWS$1 = arrayBufferViewCore.NATIVE_ARRAY_BUFFER_VIEWS;

	var ArrayBuffer$2 = global_1.ArrayBuffer;
	var Int8Array$2 = global_1.Int8Array;

	var typedArrayConstructorsRequireWrappers = !NATIVE_ARRAY_BUFFER_VIEWS$1 || !fails(function () {
	  Int8Array$2(1);
	}) || !fails(function () {
	  new Int8Array$2(-1);
	}) || !checkCorrectnessOfIteration(function (iterable) {
	  new Int8Array$2();
	  new Int8Array$2(null);
	  new Int8Array$2(1.5);
	  new Int8Array$2(iterable);
	}, true) || fails(function () {
	  // Safari (11+) bug - a reason why even Safari 13 should load a typed array polyfill
	  return new Int8Array$2(new ArrayBuffer$2(2), 1, undefined).length !== 1;
	});

	var toPositiveInteger = function (it) {
	  var result = toInteger(it);
	  if (result < 0) throw RangeError("The argument can't be less than 0");
	  return result;
	};

	var toOffset = function (it, BYTES) {
	  var offset = toPositiveInteger(it);
	  if (offset % BYTES) throw RangeError('Wrong offset');
	  return offset;
	};

	var aTypedArrayConstructor$1 = arrayBufferViewCore.aTypedArrayConstructor;

	var typedArrayFrom = function from(source /* , mapfn, thisArg */) {
	  var O = toObject(source);
	  var argumentsLength = arguments.length;
	  var mapfn = argumentsLength > 1 ? arguments[1] : undefined;
	  var mapping = mapfn !== undefined;
	  var iteratorMethod = getIteratorMethod(O);
	  var i, length, result, step, iterator, next;
	  if (iteratorMethod != undefined && !isArrayIteratorMethod(iteratorMethod)) {
	    iterator = iteratorMethod.call(O);
	    next = iterator.next;
	    O = [];
	    while (!(step = next.call(iterator)).done) {
	      O.push(step.value);
	    }
	  }
	  if (mapping && argumentsLength > 2) {
	    mapfn = functionBindContext(mapfn, arguments[2], 2);
	  }
	  length = toLength(O.length);
	  result = new (aTypedArrayConstructor$1(this))(length);
	  for (i = 0; length > i; i++) {
	    result[i] = mapping ? mapfn(O[i], i) : O[i];
	  }
	  return result;
	};

	var typedArrayConstructor = createCommonjsModule(function (module) {


















	var getOwnPropertyNames = objectGetOwnPropertyNames.f;

	var forEach = arrayIteration.forEach;






	var getInternalState = internalState.get;
	var setInternalState = internalState.set;
	var nativeDefineProperty = objectDefineProperty.f;
	var nativeGetOwnPropertyDescriptor = objectGetOwnPropertyDescriptor.f;
	var round = Math.round;
	var RangeError = global_1.RangeError;
	var ArrayBuffer = arrayBuffer.ArrayBuffer;
	var DataView = arrayBuffer.DataView;
	var NATIVE_ARRAY_BUFFER_VIEWS = arrayBufferViewCore.NATIVE_ARRAY_BUFFER_VIEWS;
	var TYPED_ARRAY_TAG = arrayBufferViewCore.TYPED_ARRAY_TAG;
	var TypedArray = arrayBufferViewCore.TypedArray;
	var TypedArrayPrototype = arrayBufferViewCore.TypedArrayPrototype;
	var aTypedArrayConstructor = arrayBufferViewCore.aTypedArrayConstructor;
	var isTypedArray = arrayBufferViewCore.isTypedArray;
	var BYTES_PER_ELEMENT = 'BYTES_PER_ELEMENT';
	var WRONG_LENGTH = 'Wrong length';

	var fromList = function (C, list) {
	  var index = 0;
	  var length = list.length;
	  var result = new (aTypedArrayConstructor(C))(length);
	  while (length > index) result[index] = list[index++];
	  return result;
	};

	var addGetter = function (it, key) {
	  nativeDefineProperty(it, key, { get: function () {
	    return getInternalState(this)[key];
	  } });
	};

	var isArrayBuffer = function (it) {
	  var klass;
	  return it instanceof ArrayBuffer || (klass = classof(it)) == 'ArrayBuffer' || klass == 'SharedArrayBuffer';
	};

	var isTypedArrayIndex = function (target, key) {
	  return isTypedArray(target)
	    && typeof key != 'symbol'
	    && key in target
	    && String(+key) == String(key);
	};

	var wrappedGetOwnPropertyDescriptor = function getOwnPropertyDescriptor(target, key) {
	  return isTypedArrayIndex(target, key = toPrimitive(key, true))
	    ? createPropertyDescriptor(2, target[key])
	    : nativeGetOwnPropertyDescriptor(target, key);
	};

	var wrappedDefineProperty = function defineProperty(target, key, descriptor) {
	  if (isTypedArrayIndex(target, key = toPrimitive(key, true))
	    && isObject(descriptor)
	    && has(descriptor, 'value')
	    && !has(descriptor, 'get')
	    && !has(descriptor, 'set')
	    // TODO: add validation descriptor w/o calling accessors
	    && !descriptor.configurable
	    && (!has(descriptor, 'writable') || descriptor.writable)
	    && (!has(descriptor, 'enumerable') || descriptor.enumerable)
	  ) {
	    target[key] = descriptor.value;
	    return target;
	  } return nativeDefineProperty(target, key, descriptor);
	};

	if (descriptors) {
	  if (!NATIVE_ARRAY_BUFFER_VIEWS) {
	    objectGetOwnPropertyDescriptor.f = wrappedGetOwnPropertyDescriptor;
	    objectDefineProperty.f = wrappedDefineProperty;
	    addGetter(TypedArrayPrototype, 'buffer');
	    addGetter(TypedArrayPrototype, 'byteOffset');
	    addGetter(TypedArrayPrototype, 'byteLength');
	    addGetter(TypedArrayPrototype, 'length');
	  }

	  _export({ target: 'Object', stat: true, forced: !NATIVE_ARRAY_BUFFER_VIEWS }, {
	    getOwnPropertyDescriptor: wrappedGetOwnPropertyDescriptor,
	    defineProperty: wrappedDefineProperty
	  });

	  module.exports = function (TYPE, wrapper, CLAMPED) {
	    var BYTES = TYPE.match(/\d+$/)[0] / 8;
	    var CONSTRUCTOR_NAME = TYPE + (CLAMPED ? 'Clamped' : '') + 'Array';
	    var GETTER = 'get' + TYPE;
	    var SETTER = 'set' + TYPE;
	    var NativeTypedArrayConstructor = global_1[CONSTRUCTOR_NAME];
	    var TypedArrayConstructor = NativeTypedArrayConstructor;
	    var TypedArrayConstructorPrototype = TypedArrayConstructor && TypedArrayConstructor.prototype;
	    var exported = {};

	    var getter = function (that, index) {
	      var data = getInternalState(that);
	      return data.view[GETTER](index * BYTES + data.byteOffset, true);
	    };

	    var setter = function (that, index, value) {
	      var data = getInternalState(that);
	      if (CLAMPED) value = (value = round(value)) < 0 ? 0 : value > 0xFF ? 0xFF : value & 0xFF;
	      data.view[SETTER](index * BYTES + data.byteOffset, value, true);
	    };

	    var addElement = function (that, index) {
	      nativeDefineProperty(that, index, {
	        get: function () {
	          return getter(this, index);
	        },
	        set: function (value) {
	          return setter(this, index, value);
	        },
	        enumerable: true
	      });
	    };

	    if (!NATIVE_ARRAY_BUFFER_VIEWS) {
	      TypedArrayConstructor = wrapper(function (that, data, offset, $length) {
	        anInstance(that, TypedArrayConstructor, CONSTRUCTOR_NAME);
	        var index = 0;
	        var byteOffset = 0;
	        var buffer, byteLength, length;
	        if (!isObject(data)) {
	          length = toIndex(data);
	          byteLength = length * BYTES;
	          buffer = new ArrayBuffer(byteLength);
	        } else if (isArrayBuffer(data)) {
	          buffer = data;
	          byteOffset = toOffset(offset, BYTES);
	          var $len = data.byteLength;
	          if ($length === undefined) {
	            if ($len % BYTES) throw RangeError(WRONG_LENGTH);
	            byteLength = $len - byteOffset;
	            if (byteLength < 0) throw RangeError(WRONG_LENGTH);
	          } else {
	            byteLength = toLength($length) * BYTES;
	            if (byteLength + byteOffset > $len) throw RangeError(WRONG_LENGTH);
	          }
	          length = byteLength / BYTES;
	        } else if (isTypedArray(data)) {
	          return fromList(TypedArrayConstructor, data);
	        } else {
	          return typedArrayFrom.call(TypedArrayConstructor, data);
	        }
	        setInternalState(that, {
	          buffer: buffer,
	          byteOffset: byteOffset,
	          byteLength: byteLength,
	          length: length,
	          view: new DataView(buffer)
	        });
	        while (index < length) addElement(that, index++);
	      });

	      if (objectSetPrototypeOf) objectSetPrototypeOf(TypedArrayConstructor, TypedArray);
	      TypedArrayConstructorPrototype = TypedArrayConstructor.prototype = objectCreate(TypedArrayPrototype);
	    } else if (typedArrayConstructorsRequireWrappers) {
	      TypedArrayConstructor = wrapper(function (dummy, data, typedArrayOffset, $length) {
	        anInstance(dummy, TypedArrayConstructor, CONSTRUCTOR_NAME);
	        return inheritIfRequired(function () {
	          if (!isObject(data)) return new NativeTypedArrayConstructor(toIndex(data));
	          if (isArrayBuffer(data)) return $length !== undefined
	            ? new NativeTypedArrayConstructor(data, toOffset(typedArrayOffset, BYTES), $length)
	            : typedArrayOffset !== undefined
	              ? new NativeTypedArrayConstructor(data, toOffset(typedArrayOffset, BYTES))
	              : new NativeTypedArrayConstructor(data);
	          if (isTypedArray(data)) return fromList(TypedArrayConstructor, data);
	          return typedArrayFrom.call(TypedArrayConstructor, data);
	        }(), dummy, TypedArrayConstructor);
	      });

	      if (objectSetPrototypeOf) objectSetPrototypeOf(TypedArrayConstructor, TypedArray);
	      forEach(getOwnPropertyNames(NativeTypedArrayConstructor), function (key) {
	        if (!(key in TypedArrayConstructor)) {
	          createNonEnumerableProperty(TypedArrayConstructor, key, NativeTypedArrayConstructor[key]);
	        }
	      });
	      TypedArrayConstructor.prototype = TypedArrayConstructorPrototype;
	    }

	    if (TypedArrayConstructorPrototype.constructor !== TypedArrayConstructor) {
	      createNonEnumerableProperty(TypedArrayConstructorPrototype, 'constructor', TypedArrayConstructor);
	    }

	    if (TYPED_ARRAY_TAG) {
	      createNonEnumerableProperty(TypedArrayConstructorPrototype, TYPED_ARRAY_TAG, CONSTRUCTOR_NAME);
	    }

	    exported[CONSTRUCTOR_NAME] = TypedArrayConstructor;

	    _export({
	      global: true, forced: TypedArrayConstructor != NativeTypedArrayConstructor, sham: !NATIVE_ARRAY_BUFFER_VIEWS
	    }, exported);

	    if (!(BYTES_PER_ELEMENT in TypedArrayConstructor)) {
	      createNonEnumerableProperty(TypedArrayConstructor, BYTES_PER_ELEMENT, BYTES);
	    }

	    if (!(BYTES_PER_ELEMENT in TypedArrayConstructorPrototype)) {
	      createNonEnumerableProperty(TypedArrayConstructorPrototype, BYTES_PER_ELEMENT, BYTES);
	    }

	    setSpecies(CONSTRUCTOR_NAME);
	  };
	} else module.exports = function () { /* empty */ };
	});

	// `Float32Array` constructor
	// https://tc39.github.io/ecma262/#sec-typedarray-objects
	typedArrayConstructor('Float32', function (init) {
	  return function Float32Array(data, byteOffset, length) {
	    return init(this, data, byteOffset, length);
	  };
	});

	// `Float64Array` constructor
	// https://tc39.github.io/ecma262/#sec-typedarray-objects
	typedArrayConstructor('Float64', function (init) {
	  return function Float64Array(data, byteOffset, length) {
	    return init(this, data, byteOffset, length);
	  };
	});

	// `Int8Array` constructor
	// https://tc39.github.io/ecma262/#sec-typedarray-objects
	typedArrayConstructor('Int8', function (init) {
	  return function Int8Array(data, byteOffset, length) {
	    return init(this, data, byteOffset, length);
	  };
	});

	// `Int16Array` constructor
	// https://tc39.github.io/ecma262/#sec-typedarray-objects
	typedArrayConstructor('Int16', function (init) {
	  return function Int16Array(data, byteOffset, length) {
	    return init(this, data, byteOffset, length);
	  };
	});

	// `Int32Array` constructor
	// https://tc39.github.io/ecma262/#sec-typedarray-objects
	typedArrayConstructor('Int32', function (init) {
	  return function Int32Array(data, byteOffset, length) {
	    return init(this, data, byteOffset, length);
	  };
	});

	// `Uint8Array` constructor
	// https://tc39.github.io/ecma262/#sec-typedarray-objects
	typedArrayConstructor('Uint8', function (init) {
	  return function Uint8Array(data, byteOffset, length) {
	    return init(this, data, byteOffset, length);
	  };
	});

	// `Uint8ClampedArray` constructor
	// https://tc39.github.io/ecma262/#sec-typedarray-objects
	typedArrayConstructor('Uint8', function (init) {
	  return function Uint8ClampedArray(data, byteOffset, length) {
	    return init(this, data, byteOffset, length);
	  };
	}, true);

	// `Uint16Array` constructor
	// https://tc39.github.io/ecma262/#sec-typedarray-objects
	typedArrayConstructor('Uint16', function (init) {
	  return function Uint16Array(data, byteOffset, length) {
	    return init(this, data, byteOffset, length);
	  };
	});

	// `Uint32Array` constructor
	// https://tc39.github.io/ecma262/#sec-typedarray-objects
	typedArrayConstructor('Uint32', function (init) {
	  return function Uint32Array(data, byteOffset, length) {
	    return init(this, data, byteOffset, length);
	  };
	});

	var aTypedArray$1 = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$1 = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.copyWithin` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.copywithin
	exportTypedArrayMethod$1('copyWithin', function copyWithin(target, start /* , end */) {
	  return arrayCopyWithin.call(aTypedArray$1(this), target, start, arguments.length > 2 ? arguments[2] : undefined);
	});

	var $every$1 = arrayIteration.every;

	var aTypedArray$2 = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$2 = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.every` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.every
	exportTypedArrayMethod$2('every', function every(callbackfn /* , thisArg */) {
	  return $every$1(aTypedArray$2(this), callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	});

	var aTypedArray$3 = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$3 = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.fill` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.fill
	// eslint-disable-next-line no-unused-vars
	exportTypedArrayMethod$3('fill', function fill(value /* , start, end */) {
	  return arrayFill.apply(aTypedArray$3(this), arguments);
	});

	var $filter$1 = arrayIteration.filter;


	var aTypedArray$4 = arrayBufferViewCore.aTypedArray;
	var aTypedArrayConstructor$2 = arrayBufferViewCore.aTypedArrayConstructor;
	var exportTypedArrayMethod$4 = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.filter` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.filter
	exportTypedArrayMethod$4('filter', function filter(callbackfn /* , thisArg */) {
	  var list = $filter$1(aTypedArray$4(this), callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	  var C = speciesConstructor(this, this.constructor);
	  var index = 0;
	  var length = list.length;
	  var result = new (aTypedArrayConstructor$2(C))(length);
	  while (length > index) result[index] = list[index++];
	  return result;
	});

	var $find$1 = arrayIteration.find;

	var aTypedArray$5 = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$5 = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.find` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.find
	exportTypedArrayMethod$5('find', function find(predicate /* , thisArg */) {
	  return $find$1(aTypedArray$5(this), predicate, arguments.length > 1 ? arguments[1] : undefined);
	});

	var $findIndex$1 = arrayIteration.findIndex;

	var aTypedArray$6 = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$6 = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.findIndex` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.findindex
	exportTypedArrayMethod$6('findIndex', function findIndex(predicate /* , thisArg */) {
	  return $findIndex$1(aTypedArray$6(this), predicate, arguments.length > 1 ? arguments[1] : undefined);
	});

	var $forEach$2 = arrayIteration.forEach;

	var aTypedArray$7 = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$7 = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.forEach` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.foreach
	exportTypedArrayMethod$7('forEach', function forEach(callbackfn /* , thisArg */) {
	  $forEach$2(aTypedArray$7(this), callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	});

	var exportTypedArrayStaticMethod$1 = arrayBufferViewCore.exportTypedArrayStaticMethod;


	// `%TypedArray%.from` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.from
	exportTypedArrayStaticMethod$1('from', typedArrayFrom, typedArrayConstructorsRequireWrappers);

	var $includes$1 = arrayIncludes.includes;

	var aTypedArray$8 = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$8 = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.includes` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.includes
	exportTypedArrayMethod$8('includes', function includes(searchElement /* , fromIndex */) {
	  return $includes$1(aTypedArray$8(this), searchElement, arguments.length > 1 ? arguments[1] : undefined);
	});

	var $indexOf$1 = arrayIncludes.indexOf;

	var aTypedArray$9 = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$9 = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.indexOf` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.indexof
	exportTypedArrayMethod$9('indexOf', function indexOf(searchElement /* , fromIndex */) {
	  return $indexOf$1(aTypedArray$9(this), searchElement, arguments.length > 1 ? arguments[1] : undefined);
	});

	var ITERATOR$5 = wellKnownSymbol('iterator');
	var Uint8Array = global_1.Uint8Array;
	var arrayValues = es_array_iterator.values;
	var arrayKeys = es_array_iterator.keys;
	var arrayEntries = es_array_iterator.entries;
	var aTypedArray$a = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$a = arrayBufferViewCore.exportTypedArrayMethod;
	var nativeTypedArrayIterator = Uint8Array && Uint8Array.prototype[ITERATOR$5];

	var CORRECT_ITER_NAME = !!nativeTypedArrayIterator
	  && (nativeTypedArrayIterator.name == 'values' || nativeTypedArrayIterator.name == undefined);

	var typedArrayValues = function values() {
	  return arrayValues.call(aTypedArray$a(this));
	};

	// `%TypedArray%.prototype.entries` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.entries
	exportTypedArrayMethod$a('entries', function entries() {
	  return arrayEntries.call(aTypedArray$a(this));
	});
	// `%TypedArray%.prototype.keys` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.keys
	exportTypedArrayMethod$a('keys', function keys() {
	  return arrayKeys.call(aTypedArray$a(this));
	});
	// `%TypedArray%.prototype.values` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.values
	exportTypedArrayMethod$a('values', typedArrayValues, !CORRECT_ITER_NAME);
	// `%TypedArray%.prototype[@@iterator]` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype-@@iterator
	exportTypedArrayMethod$a(ITERATOR$5, typedArrayValues, !CORRECT_ITER_NAME);

	var aTypedArray$b = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$b = arrayBufferViewCore.exportTypedArrayMethod;
	var $join = [].join;

	// `%TypedArray%.prototype.join` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.join
	// eslint-disable-next-line no-unused-vars
	exportTypedArrayMethod$b('join', function join(separator) {
	  return $join.apply(aTypedArray$b(this), arguments);
	});

	var aTypedArray$c = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$c = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.lastIndexOf` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.lastindexof
	// eslint-disable-next-line no-unused-vars
	exportTypedArrayMethod$c('lastIndexOf', function lastIndexOf(searchElement /* , fromIndex */) {
	  return arrayLastIndexOf.apply(aTypedArray$c(this), arguments);
	});

	var $map$1 = arrayIteration.map;


	var aTypedArray$d = arrayBufferViewCore.aTypedArray;
	var aTypedArrayConstructor$3 = arrayBufferViewCore.aTypedArrayConstructor;
	var exportTypedArrayMethod$d = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.map` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.map
	exportTypedArrayMethod$d('map', function map(mapfn /* , thisArg */) {
	  return $map$1(aTypedArray$d(this), mapfn, arguments.length > 1 ? arguments[1] : undefined, function (O, length) {
	    return new (aTypedArrayConstructor$3(speciesConstructor(O, O.constructor)))(length);
	  });
	});

	var aTypedArrayConstructor$4 = arrayBufferViewCore.aTypedArrayConstructor;
	var exportTypedArrayStaticMethod$2 = arrayBufferViewCore.exportTypedArrayStaticMethod;

	// `%TypedArray%.of` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.of
	exportTypedArrayStaticMethod$2('of', function of(/* ...items */) {
	  var index = 0;
	  var length = arguments.length;
	  var result = new (aTypedArrayConstructor$4(this))(length);
	  while (length > index) result[index] = arguments[index++];
	  return result;
	}, typedArrayConstructorsRequireWrappers);

	var $reduce$1 = arrayReduce.left;

	var aTypedArray$e = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$e = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.reduce` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.reduce
	exportTypedArrayMethod$e('reduce', function reduce(callbackfn /* , initialValue */) {
	  return $reduce$1(aTypedArray$e(this), callbackfn, arguments.length, arguments.length > 1 ? arguments[1] : undefined);
	});

	var $reduceRight$1 = arrayReduce.right;

	var aTypedArray$f = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$f = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.reduceRicht` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.reduceright
	exportTypedArrayMethod$f('reduceRight', function reduceRight(callbackfn /* , initialValue */) {
	  return $reduceRight$1(aTypedArray$f(this), callbackfn, arguments.length, arguments.length > 1 ? arguments[1] : undefined);
	});

	var aTypedArray$g = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$g = arrayBufferViewCore.exportTypedArrayMethod;
	var floor$7 = Math.floor;

	// `%TypedArray%.prototype.reverse` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.reverse
	exportTypedArrayMethod$g('reverse', function reverse() {
	  var that = this;
	  var length = aTypedArray$g(that).length;
	  var middle = floor$7(length / 2);
	  var index = 0;
	  var value;
	  while (index < middle) {
	    value = that[index];
	    that[index++] = that[--length];
	    that[length] = value;
	  } return that;
	});

	var aTypedArray$h = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$h = arrayBufferViewCore.exportTypedArrayMethod;

	var FORCED$e = fails(function () {
	  // eslint-disable-next-line no-undef
	  new Int8Array(1).set({});
	});

	// `%TypedArray%.prototype.set` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.set
	exportTypedArrayMethod$h('set', function set(arrayLike /* , offset */) {
	  aTypedArray$h(this);
	  var offset = toOffset(arguments.length > 1 ? arguments[1] : undefined, 1);
	  var length = this.length;
	  var src = toObject(arrayLike);
	  var len = toLength(src.length);
	  var index = 0;
	  if (len + offset > length) throw RangeError('Wrong length');
	  while (index < len) this[offset + index] = src[index++];
	}, FORCED$e);

	var aTypedArray$i = arrayBufferViewCore.aTypedArray;
	var aTypedArrayConstructor$5 = arrayBufferViewCore.aTypedArrayConstructor;
	var exportTypedArrayMethod$i = arrayBufferViewCore.exportTypedArrayMethod;
	var $slice = [].slice;

	var FORCED$f = fails(function () {
	  // eslint-disable-next-line no-undef
	  new Int8Array(1).slice();
	});

	// `%TypedArray%.prototype.slice` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.slice
	exportTypedArrayMethod$i('slice', function slice(start, end) {
	  var list = $slice.call(aTypedArray$i(this), start, end);
	  var C = speciesConstructor(this, this.constructor);
	  var index = 0;
	  var length = list.length;
	  var result = new (aTypedArrayConstructor$5(C))(length);
	  while (length > index) result[index] = list[index++];
	  return result;
	}, FORCED$f);

	var $some$1 = arrayIteration.some;

	var aTypedArray$j = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$j = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.some` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.some
	exportTypedArrayMethod$j('some', function some(callbackfn /* , thisArg */) {
	  return $some$1(aTypedArray$j(this), callbackfn, arguments.length > 1 ? arguments[1] : undefined);
	});

	var aTypedArray$k = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$k = arrayBufferViewCore.exportTypedArrayMethod;
	var $sort = [].sort;

	// `%TypedArray%.prototype.sort` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.sort
	exportTypedArrayMethod$k('sort', function sort(comparefn) {
	  return $sort.call(aTypedArray$k(this), comparefn);
	});

	var aTypedArray$l = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$l = arrayBufferViewCore.exportTypedArrayMethod;

	// `%TypedArray%.prototype.subarray` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.subarray
	exportTypedArrayMethod$l('subarray', function subarray(begin, end) {
	  var O = aTypedArray$l(this);
	  var length = O.length;
	  var beginIndex = toAbsoluteIndex(begin, length);
	  return new (speciesConstructor(O, O.constructor))(
	    O.buffer,
	    O.byteOffset + beginIndex * O.BYTES_PER_ELEMENT,
	    toLength((end === undefined ? length : toAbsoluteIndex(end, length)) - beginIndex)
	  );
	});

	var Int8Array$3 = global_1.Int8Array;
	var aTypedArray$m = arrayBufferViewCore.aTypedArray;
	var exportTypedArrayMethod$m = arrayBufferViewCore.exportTypedArrayMethod;
	var $toLocaleString = [].toLocaleString;
	var $slice$1 = [].slice;

	// iOS Safari 6.x fails here
	var TO_LOCALE_STRING_BUG = !!Int8Array$3 && fails(function () {
	  $toLocaleString.call(new Int8Array$3(1));
	});

	var FORCED$g = fails(function () {
	  return [1, 2].toLocaleString() != new Int8Array$3([1, 2]).toLocaleString();
	}) || !fails(function () {
	  Int8Array$3.prototype.toLocaleString.call([1, 2]);
	});

	// `%TypedArray%.prototype.toLocaleString` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.tolocalestring
	exportTypedArrayMethod$m('toLocaleString', function toLocaleString() {
	  return $toLocaleString.apply(TO_LOCALE_STRING_BUG ? $slice$1.call(aTypedArray$m(this)) : aTypedArray$m(this), arguments);
	}, FORCED$g);

	var exportTypedArrayMethod$n = arrayBufferViewCore.exportTypedArrayMethod;



	var Uint8Array$1 = global_1.Uint8Array;
	var Uint8ArrayPrototype = Uint8Array$1 && Uint8Array$1.prototype || {};
	var arrayToString = [].toString;
	var arrayJoin = [].join;

	if (fails(function () { arrayToString.call({}); })) {
	  arrayToString = function toString() {
	    return arrayJoin.call(this);
	  };
	}

	var IS_NOT_ARRAY_METHOD = Uint8ArrayPrototype.toString != arrayToString;

	// `%TypedArray%.prototype.toString` method
	// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.tostring
	exportTypedArrayMethod$n('toString', arrayToString, IS_NOT_ARRAY_METHOD);

	var getWeakData = internalMetadata.getWeakData;








	var setInternalState$7 = internalState.set;
	var internalStateGetterFor$1 = internalState.getterFor;
	var find = arrayIteration.find;
	var findIndex = arrayIteration.findIndex;
	var id$1 = 0;

	// fallback for uncaught frozen keys
	var uncaughtFrozenStore = function (store) {
	  return store.frozen || (store.frozen = new UncaughtFrozenStore());
	};

	var UncaughtFrozenStore = function () {
	  this.entries = [];
	};

	var findUncaughtFrozen = function (store, key) {
	  return find(store.entries, function (it) {
	    return it[0] === key;
	  });
	};

	UncaughtFrozenStore.prototype = {
	  get: function (key) {
	    var entry = findUncaughtFrozen(this, key);
	    if (entry) return entry[1];
	  },
	  has: function (key) {
	    return !!findUncaughtFrozen(this, key);
	  },
	  set: function (key, value) {
	    var entry = findUncaughtFrozen(this, key);
	    if (entry) entry[1] = value;
	    else this.entries.push([key, value]);
	  },
	  'delete': function (key) {
	    var index = findIndex(this.entries, function (it) {
	      return it[0] === key;
	    });
	    if (~index) this.entries.splice(index, 1);
	    return !!~index;
	  }
	};

	var collectionWeak = {
	  getConstructor: function (wrapper, CONSTRUCTOR_NAME, IS_MAP, ADDER) {
	    var C = wrapper(function (that, iterable) {
	      anInstance(that, C, CONSTRUCTOR_NAME);
	      setInternalState$7(that, {
	        type: CONSTRUCTOR_NAME,
	        id: id$1++,
	        frozen: undefined
	      });
	      if (iterable != undefined) iterate_1(iterable, that[ADDER], that, IS_MAP);
	    });

	    var getInternalState = internalStateGetterFor$1(CONSTRUCTOR_NAME);

	    var define = function (that, key, value) {
	      var state = getInternalState(that);
	      var data = getWeakData(anObject(key), true);
	      if (data === true) uncaughtFrozenStore(state).set(key, value);
	      else data[state.id] = value;
	      return that;
	    };

	    redefineAll(C.prototype, {
	      // 23.3.3.2 WeakMap.prototype.delete(key)
	      // 23.4.3.3 WeakSet.prototype.delete(value)
	      'delete': function (key) {
	        var state = getInternalState(this);
	        if (!isObject(key)) return false;
	        var data = getWeakData(key);
	        if (data === true) return uncaughtFrozenStore(state)['delete'](key);
	        return data && has(data, state.id) && delete data[state.id];
	      },
	      // 23.3.3.4 WeakMap.prototype.has(key)
	      // 23.4.3.4 WeakSet.prototype.has(value)
	      has: function has$1(key) {
	        var state = getInternalState(this);
	        if (!isObject(key)) return false;
	        var data = getWeakData(key);
	        if (data === true) return uncaughtFrozenStore(state).has(key);
	        return data && has(data, state.id);
	      }
	    });

	    redefineAll(C.prototype, IS_MAP ? {
	      // 23.3.3.3 WeakMap.prototype.get(key)
	      get: function get(key) {
	        var state = getInternalState(this);
	        if (isObject(key)) {
	          var data = getWeakData(key);
	          if (data === true) return uncaughtFrozenStore(state).get(key);
	          return data ? data[state.id] : undefined;
	        }
	      },
	      // 23.3.3.5 WeakMap.prototype.set(key, value)
	      set: function set(key, value) {
	        return define(this, key, value);
	      }
	    } : {
	      // 23.4.3.1 WeakSet.prototype.add(value)
	      add: function add(value) {
	        return define(this, value, true);
	      }
	    });

	    return C;
	  }
	};

	var es_weakMap = createCommonjsModule(function (module) {






	var enforceIternalState = internalState.enforce;


	var IS_IE11 = !global_1.ActiveXObject && 'ActiveXObject' in global_1;
	var isExtensible = Object.isExtensible;
	var InternalWeakMap;

	var wrapper = function (init) {
	  return function WeakMap() {
	    return init(this, arguments.length ? arguments[0] : undefined);
	  };
	};

	// `WeakMap` constructor
	// https://tc39.github.io/ecma262/#sec-weakmap-constructor
	var $WeakMap = module.exports = collection('WeakMap', wrapper, collectionWeak);

	// IE11 WeakMap frozen keys fix
	// We can't use feature detection because it crash some old IE builds
	// https://github.com/zloirock/core-js/issues/485
	if (nativeWeakMap && IS_IE11) {
	  InternalWeakMap = collectionWeak.getConstructor(wrapper, 'WeakMap', true);
	  internalMetadata.REQUIRED = true;
	  var WeakMapPrototype = $WeakMap.prototype;
	  var nativeDelete = WeakMapPrototype['delete'];
	  var nativeHas = WeakMapPrototype.has;
	  var nativeGet = WeakMapPrototype.get;
	  var nativeSet = WeakMapPrototype.set;
	  redefineAll(WeakMapPrototype, {
	    'delete': function (key) {
	      if (isObject(key) && !isExtensible(key)) {
	        var state = enforceIternalState(this);
	        if (!state.frozen) state.frozen = new InternalWeakMap();
	        return nativeDelete.call(this, key) || state.frozen['delete'](key);
	      } return nativeDelete.call(this, key);
	    },
	    has: function has(key) {
	      if (isObject(key) && !isExtensible(key)) {
	        var state = enforceIternalState(this);
	        if (!state.frozen) state.frozen = new InternalWeakMap();
	        return nativeHas.call(this, key) || state.frozen.has(key);
	      } return nativeHas.call(this, key);
	    },
	    get: function get(key) {
	      if (isObject(key) && !isExtensible(key)) {
	        var state = enforceIternalState(this);
	        if (!state.frozen) state.frozen = new InternalWeakMap();
	        return nativeHas.call(this, key) ? nativeGet.call(this, key) : state.frozen.get(key);
	      } return nativeGet.call(this, key);
	    },
	    set: function set(key, value) {
	      if (isObject(key) && !isExtensible(key)) {
	        var state = enforceIternalState(this);
	        if (!state.frozen) state.frozen = new InternalWeakMap();
	        nativeHas.call(this, key) ? nativeSet.call(this, key, value) : state.frozen.set(key, value);
	      } else nativeSet.call(this, key, value);
	      return this;
	    }
	  });
	}
	});

	// `WeakSet` constructor
	// https://tc39.github.io/ecma262/#sec-weakset-constructor
	collection('WeakSet', function (init) {
	  return function WeakSet() { return init(this, arguments.length ? arguments[0] : undefined); };
	}, collectionWeak);

	// iterable DOM collections
	// flag - `iterable` interface - 'entries', 'keys', 'values', 'forEach' methods
	var domIterables = {
	  CSSRuleList: 0,
	  CSSStyleDeclaration: 0,
	  CSSValueList: 0,
	  ClientRectList: 0,
	  DOMRectList: 0,
	  DOMStringList: 0,
	  DOMTokenList: 1,
	  DataTransferItemList: 0,
	  FileList: 0,
	  HTMLAllCollection: 0,
	  HTMLCollection: 0,
	  HTMLFormElement: 0,
	  HTMLSelectElement: 0,
	  MediaList: 0,
	  MimeTypeArray: 0,
	  NamedNodeMap: 0,
	  NodeList: 1,
	  PaintRequestList: 0,
	  Plugin: 0,
	  PluginArray: 0,
	  SVGLengthList: 0,
	  SVGNumberList: 0,
	  SVGPathSegList: 0,
	  SVGPointList: 0,
	  SVGStringList: 0,
	  SVGTransformList: 0,
	  SourceBufferList: 0,
	  StyleSheetList: 0,
	  TextTrackCueList: 0,
	  TextTrackList: 0,
	  TouchList: 0
	};

	for (var COLLECTION_NAME in domIterables) {
	  var Collection = global_1[COLLECTION_NAME];
	  var CollectionPrototype = Collection && Collection.prototype;
	  // some Chrome versions have non-configurable methods on DOMTokenList
	  if (CollectionPrototype && CollectionPrototype.forEach !== arrayForEach) try {
	    createNonEnumerableProperty(CollectionPrototype, 'forEach', arrayForEach);
	  } catch (error) {
	    CollectionPrototype.forEach = arrayForEach;
	  }
	}

	var ITERATOR$6 = wellKnownSymbol('iterator');
	var TO_STRING_TAG$4 = wellKnownSymbol('toStringTag');
	var ArrayValues = es_array_iterator.values;

	for (var COLLECTION_NAME$1 in domIterables) {
	  var Collection$1 = global_1[COLLECTION_NAME$1];
	  var CollectionPrototype$1 = Collection$1 && Collection$1.prototype;
	  if (CollectionPrototype$1) {
	    // some Chrome versions have non-configurable methods on DOMTokenList
	    if (CollectionPrototype$1[ITERATOR$6] !== ArrayValues) try {
	      createNonEnumerableProperty(CollectionPrototype$1, ITERATOR$6, ArrayValues);
	    } catch (error) {
	      CollectionPrototype$1[ITERATOR$6] = ArrayValues;
	    }
	    if (!CollectionPrototype$1[TO_STRING_TAG$4]) {
	      createNonEnumerableProperty(CollectionPrototype$1, TO_STRING_TAG$4, COLLECTION_NAME$1);
	    }
	    if (domIterables[COLLECTION_NAME$1]) for (var METHOD_NAME in es_array_iterator) {
	      // some Chrome versions have non-configurable methods on DOMTokenList
	      if (CollectionPrototype$1[METHOD_NAME] !== es_array_iterator[METHOD_NAME]) try {
	        createNonEnumerableProperty(CollectionPrototype$1, METHOD_NAME, es_array_iterator[METHOD_NAME]);
	      } catch (error) {
	        CollectionPrototype$1[METHOD_NAME] = es_array_iterator[METHOD_NAME];
	      }
	    }
	  }
	}

	var process$4 = global_1.process;
	var isNode = classofRaw(process$4) == 'process';

	// `queueMicrotask` method
	// https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#dom-queuemicrotask
	_export({ global: true, enumerable: true, noTargetGet: true }, {
	  queueMicrotask: function queueMicrotask(fn) {
	    var domain = isNode && process$4.domain;
	    microtask(domain ? domain.bind(fn) : fn);
	  }
	});

	var ITERATOR$7 = wellKnownSymbol('iterator');

	var nativeUrl = !fails(function () {
	  var url = new URL('b?a=1&b=2&c=3', 'http://a');
	  var searchParams = url.searchParams;
	  var result = '';
	  url.pathname = 'c%20d';
	  searchParams.forEach(function (value, key) {
	    searchParams['delete']('b');
	    result += key + value;
	  });
	  return (isPure && !url.toJSON)
	    || !searchParams.sort
	    || url.href !== 'http://a/c%20d?a=1&c=3'
	    || searchParams.get('c') !== '3'
	    || String(new URLSearchParams('?a=1')) !== 'a=1'
	    || !searchParams[ITERATOR$7]
	    // throws in Edge
	    || new URL('https://a@b').username !== 'a'
	    || new URLSearchParams(new URLSearchParams('a=b')).get('a') !== 'b'
	    // not punycoded in Edge
	    || new URL('http://тест').host !== 'xn--e1aybc'
	    // not escaped in Chrome 62-
	    || new URL('http://a#б').hash !== '#%D0%B1'
	    // fails in Chrome 66-
	    || result !== 'a1c3'
	    // throws in Safari
	    || new URL('http://x', undefined).host !== 'x';
	});

	// based on https://github.com/bestiejs/punycode.js/blob/master/punycode.js
	var maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1
	var base = 36;
	var tMin = 1;
	var tMax = 26;
	var skew = 38;
	var damp = 700;
	var initialBias = 72;
	var initialN = 128; // 0x80
	var delimiter = '-'; // '\x2D'
	var regexNonASCII = /[^\0-\u007E]/; // non-ASCII chars
	var regexSeparators = /[.\u3002\uFF0E\uFF61]/g; // RFC 3490 separators
	var OVERFLOW_ERROR = 'Overflow: input needs wider integers to process';
	var baseMinusTMin = base - tMin;
	var floor$8 = Math.floor;
	var stringFromCharCode = String.fromCharCode;

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 */
	var ucs2decode = function (string) {
	  var output = [];
	  var counter = 0;
	  var length = string.length;
	  while (counter < length) {
	    var value = string.charCodeAt(counter++);
	    if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
	      // It's a high surrogate, and there is a next character.
	      var extra = string.charCodeAt(counter++);
	      if ((extra & 0xFC00) == 0xDC00) { // Low surrogate.
	        output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
	      } else {
	        // It's an unmatched surrogate; only append this code unit, in case the
	        // next code unit is the high surrogate of a surrogate pair.
	        output.push(value);
	        counter--;
	      }
	    } else {
	      output.push(value);
	    }
	  }
	  return output;
	};

	/**
	 * Converts a digit/integer into a basic code point.
	 */
	var digitToBasic = function (digit) {
	  //  0..25 map to ASCII a..z or A..Z
	  // 26..35 map to ASCII 0..9
	  return digit + 22 + 75 * (digit < 26);
	};

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 */
	var adapt = function (delta, numPoints, firstTime) {
	  var k = 0;
	  delta = firstTime ? floor$8(delta / damp) : delta >> 1;
	  delta += floor$8(delta / numPoints);
	  for (; delta > baseMinusTMin * tMax >> 1; k += base) {
	    delta = floor$8(delta / baseMinusTMin);
	  }
	  return floor$8(k + (baseMinusTMin + 1) * delta / (delta + skew));
	};

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 */
	// eslint-disable-next-line  max-statements
	var encode = function (input) {
	  var output = [];

	  // Convert the input in UCS-2 to an array of Unicode code points.
	  input = ucs2decode(input);

	  // Cache the length.
	  var inputLength = input.length;

	  // Initialize the state.
	  var n = initialN;
	  var delta = 0;
	  var bias = initialBias;
	  var i, currentValue;

	  // Handle the basic code points.
	  for (i = 0; i < input.length; i++) {
	    currentValue = input[i];
	    if (currentValue < 0x80) {
	      output.push(stringFromCharCode(currentValue));
	    }
	  }

	  var basicLength = output.length; // number of basic code points.
	  var handledCPCount = basicLength; // number of code points that have been handled;

	  // Finish the basic string with a delimiter unless it's empty.
	  if (basicLength) {
	    output.push(delimiter);
	  }

	  // Main encoding loop:
	  while (handledCPCount < inputLength) {
	    // All non-basic code points < n have been handled already. Find the next larger one:
	    var m = maxInt;
	    for (i = 0; i < input.length; i++) {
	      currentValue = input[i];
	      if (currentValue >= n && currentValue < m) {
	        m = currentValue;
	      }
	    }

	    // Increase `delta` enough to advance the decoder's <n,i> state to <m,0>, but guard against overflow.
	    var handledCPCountPlusOne = handledCPCount + 1;
	    if (m - n > floor$8((maxInt - delta) / handledCPCountPlusOne)) {
	      throw RangeError(OVERFLOW_ERROR);
	    }

	    delta += (m - n) * handledCPCountPlusOne;
	    n = m;

	    for (i = 0; i < input.length; i++) {
	      currentValue = input[i];
	      if (currentValue < n && ++delta > maxInt) {
	        throw RangeError(OVERFLOW_ERROR);
	      }
	      if (currentValue == n) {
	        // Represent delta as a generalized variable-length integer.
	        var q = delta;
	        for (var k = base; /* no condition */; k += base) {
	          var t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
	          if (q < t) break;
	          var qMinusT = q - t;
	          var baseMinusT = base - t;
	          output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT)));
	          q = floor$8(qMinusT / baseMinusT);
	        }

	        output.push(stringFromCharCode(digitToBasic(q)));
	        bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
	        delta = 0;
	        ++handledCPCount;
	      }
	    }

	    ++delta;
	    ++n;
	  }
	  return output.join('');
	};

	var stringPunycodeToAscii = function (input) {
	  var encoded = [];
	  var labels = input.toLowerCase().replace(regexSeparators, '\u002E').split('.');
	  var i, label;
	  for (i = 0; i < labels.length; i++) {
	    label = labels[i];
	    encoded.push(regexNonASCII.test(label) ? 'xn--' + encode(label) : label);
	  }
	  return encoded.join('.');
	};

	var getIterator = function (it) {
	  var iteratorMethod = getIteratorMethod(it);
	  if (typeof iteratorMethod != 'function') {
	    throw TypeError(String(it) + ' is not iterable');
	  } return anObject(iteratorMethod.call(it));
	};

	// TODO: in core-js@4, move /modules/ dependencies to public entries for better optimization by tools like `preset-env`





















	var $fetch$1 = getBuiltIn('fetch');
	var Headers$1 = getBuiltIn('Headers');
	var ITERATOR$8 = wellKnownSymbol('iterator');
	var URL_SEARCH_PARAMS = 'URLSearchParams';
	var URL_SEARCH_PARAMS_ITERATOR = URL_SEARCH_PARAMS + 'Iterator';
	var setInternalState$8 = internalState.set;
	var getInternalParamsState = internalState.getterFor(URL_SEARCH_PARAMS);
	var getInternalIteratorState = internalState.getterFor(URL_SEARCH_PARAMS_ITERATOR);

	var plus = /\+/g;
	var sequences = Array(4);

	var percentSequence = function (bytes) {
	  return sequences[bytes - 1] || (sequences[bytes - 1] = RegExp('((?:%[\\da-f]{2}){' + bytes + '})', 'gi'));
	};

	var percentDecode = function (sequence) {
	  try {
	    return decodeURIComponent(sequence);
	  } catch (error) {
	    return sequence;
	  }
	};

	var deserialize = function (it) {
	  var result = it.replace(plus, ' ');
	  var bytes = 4;
	  try {
	    return decodeURIComponent(result);
	  } catch (error) {
	    while (bytes) {
	      result = result.replace(percentSequence(bytes--), percentDecode);
	    }
	    return result;
	  }
	};

	var find$1 = /[!'()~]|%20/g;

	var replace = {
	  '!': '%21',
	  "'": '%27',
	  '(': '%28',
	  ')': '%29',
	  '~': '%7E',
	  '%20': '+'
	};

	var replacer = function (match) {
	  return replace[match];
	};

	var serialize = function (it) {
	  return encodeURIComponent(it).replace(find$1, replacer);
	};

	var parseSearchParams = function (result, query) {
	  if (query) {
	    var attributes = query.split('&');
	    var index = 0;
	    var attribute, entry;
	    while (index < attributes.length) {
	      attribute = attributes[index++];
	      if (attribute.length) {
	        entry = attribute.split('=');
	        result.push({
	          key: deserialize(entry.shift()),
	          value: deserialize(entry.join('='))
	        });
	      }
	    }
	  }
	};

	var updateSearchParams = function (query) {
	  this.entries.length = 0;
	  parseSearchParams(this.entries, query);
	};

	var validateArgumentsLength = function (passed, required) {
	  if (passed < required) throw TypeError('Not enough arguments');
	};

	var URLSearchParamsIterator = createIteratorConstructor(function Iterator(params, kind) {
	  setInternalState$8(this, {
	    type: URL_SEARCH_PARAMS_ITERATOR,
	    iterator: getIterator(getInternalParamsState(params).entries),
	    kind: kind
	  });
	}, 'Iterator', function next() {
	  var state = getInternalIteratorState(this);
	  var kind = state.kind;
	  var step = state.iterator.next();
	  var entry = step.value;
	  if (!step.done) {
	    step.value = kind === 'keys' ? entry.key : kind === 'values' ? entry.value : [entry.key, entry.value];
	  } return step;
	});

	// `URLSearchParams` constructor
	// https://url.spec.whatwg.org/#interface-urlsearchparams
	var URLSearchParamsConstructor = function URLSearchParams(/* init */) {
	  anInstance(this, URLSearchParamsConstructor, URL_SEARCH_PARAMS);
	  var init = arguments.length > 0 ? arguments[0] : undefined;
	  var that = this;
	  var entries = [];
	  var iteratorMethod, iterator, next, step, entryIterator, entryNext, first, second, key;

	  setInternalState$8(that, {
	    type: URL_SEARCH_PARAMS,
	    entries: entries,
	    updateURL: function () { /* empty */ },
	    updateSearchParams: updateSearchParams
	  });

	  if (init !== undefined) {
	    if (isObject(init)) {
	      iteratorMethod = getIteratorMethod(init);
	      if (typeof iteratorMethod === 'function') {
	        iterator = iteratorMethod.call(init);
	        next = iterator.next;
	        while (!(step = next.call(iterator)).done) {
	          entryIterator = getIterator(anObject(step.value));
	          entryNext = entryIterator.next;
	          if (
	            (first = entryNext.call(entryIterator)).done ||
	            (second = entryNext.call(entryIterator)).done ||
	            !entryNext.call(entryIterator).done
	          ) throw TypeError('Expected sequence with length 2');
	          entries.push({ key: first.value + '', value: second.value + '' });
	        }
	      } else for (key in init) if (has(init, key)) entries.push({ key: key, value: init[key] + '' });
	    } else {
	      parseSearchParams(entries, typeof init === 'string' ? init.charAt(0) === '?' ? init.slice(1) : init : init + '');
	    }
	  }
	};

	var URLSearchParamsPrototype = URLSearchParamsConstructor.prototype;

	redefineAll(URLSearchParamsPrototype, {
	  // `URLSearchParams.prototype.appent` method
	  // https://url.spec.whatwg.org/#dom-urlsearchparams-append
	  append: function append(name, value) {
	    validateArgumentsLength(arguments.length, 2);
	    var state = getInternalParamsState(this);
	    state.entries.push({ key: name + '', value: value + '' });
	    state.updateURL();
	  },
	  // `URLSearchParams.prototype.delete` method
	  // https://url.spec.whatwg.org/#dom-urlsearchparams-delete
	  'delete': function (name) {
	    validateArgumentsLength(arguments.length, 1);
	    var state = getInternalParamsState(this);
	    var entries = state.entries;
	    var key = name + '';
	    var index = 0;
	    while (index < entries.length) {
	      if (entries[index].key === key) entries.splice(index, 1);
	      else index++;
	    }
	    state.updateURL();
	  },
	  // `URLSearchParams.prototype.get` method
	  // https://url.spec.whatwg.org/#dom-urlsearchparams-get
	  get: function get(name) {
	    validateArgumentsLength(arguments.length, 1);
	    var entries = getInternalParamsState(this).entries;
	    var key = name + '';
	    var index = 0;
	    for (; index < entries.length; index++) {
	      if (entries[index].key === key) return entries[index].value;
	    }
	    return null;
	  },
	  // `URLSearchParams.prototype.getAll` method
	  // https://url.spec.whatwg.org/#dom-urlsearchparams-getall
	  getAll: function getAll(name) {
	    validateArgumentsLength(arguments.length, 1);
	    var entries = getInternalParamsState(this).entries;
	    var key = name + '';
	    var result = [];
	    var index = 0;
	    for (; index < entries.length; index++) {
	      if (entries[index].key === key) result.push(entries[index].value);
	    }
	    return result;
	  },
	  // `URLSearchParams.prototype.has` method
	  // https://url.spec.whatwg.org/#dom-urlsearchparams-has
	  has: function has(name) {
	    validateArgumentsLength(arguments.length, 1);
	    var entries = getInternalParamsState(this).entries;
	    var key = name + '';
	    var index = 0;
	    while (index < entries.length) {
	      if (entries[index++].key === key) return true;
	    }
	    return false;
	  },
	  // `URLSearchParams.prototype.set` method
	  // https://url.spec.whatwg.org/#dom-urlsearchparams-set
	  set: function set(name, value) {
	    validateArgumentsLength(arguments.length, 1);
	    var state = getInternalParamsState(this);
	    var entries = state.entries;
	    var found = false;
	    var key = name + '';
	    var val = value + '';
	    var index = 0;
	    var entry;
	    for (; index < entries.length; index++) {
	      entry = entries[index];
	      if (entry.key === key) {
	        if (found) entries.splice(index--, 1);
	        else {
	          found = true;
	          entry.value = val;
	        }
	      }
	    }
	    if (!found) entries.push({ key: key, value: val });
	    state.updateURL();
	  },
	  // `URLSearchParams.prototype.sort` method
	  // https://url.spec.whatwg.org/#dom-urlsearchparams-sort
	  sort: function sort() {
	    var state = getInternalParamsState(this);
	    var entries = state.entries;
	    // Array#sort is not stable in some engines
	    var slice = entries.slice();
	    var entry, entriesIndex, sliceIndex;
	    entries.length = 0;
	    for (sliceIndex = 0; sliceIndex < slice.length; sliceIndex++) {
	      entry = slice[sliceIndex];
	      for (entriesIndex = 0; entriesIndex < sliceIndex; entriesIndex++) {
	        if (entries[entriesIndex].key > entry.key) {
	          entries.splice(entriesIndex, 0, entry);
	          break;
	        }
	      }
	      if (entriesIndex === sliceIndex) entries.push(entry);
	    }
	    state.updateURL();
	  },
	  // `URLSearchParams.prototype.forEach` method
	  forEach: function forEach(callback /* , thisArg */) {
	    var entries = getInternalParamsState(this).entries;
	    var boundFunction = functionBindContext(callback, arguments.length > 1 ? arguments[1] : undefined, 3);
	    var index = 0;
	    var entry;
	    while (index < entries.length) {
	      entry = entries[index++];
	      boundFunction(entry.value, entry.key, this);
	    }
	  },
	  // `URLSearchParams.prototype.keys` method
	  keys: function keys() {
	    return new URLSearchParamsIterator(this, 'keys');
	  },
	  // `URLSearchParams.prototype.values` method
	  values: function values() {
	    return new URLSearchParamsIterator(this, 'values');
	  },
	  // `URLSearchParams.prototype.entries` method
	  entries: function entries() {
	    return new URLSearchParamsIterator(this, 'entries');
	  }
	}, { enumerable: true });

	// `URLSearchParams.prototype[@@iterator]` method
	redefine(URLSearchParamsPrototype, ITERATOR$8, URLSearchParamsPrototype.entries);

	// `URLSearchParams.prototype.toString` method
	// https://url.spec.whatwg.org/#urlsearchparams-stringification-behavior
	redefine(URLSearchParamsPrototype, 'toString', function toString() {
	  var entries = getInternalParamsState(this).entries;
	  var result = [];
	  var index = 0;
	  var entry;
	  while (index < entries.length) {
	    entry = entries[index++];
	    result.push(serialize(entry.key) + '=' + serialize(entry.value));
	  } return result.join('&');
	}, { enumerable: true });

	setToStringTag(URLSearchParamsConstructor, URL_SEARCH_PARAMS);

	_export({ global: true, forced: !nativeUrl }, {
	  URLSearchParams: URLSearchParamsConstructor
	});

	// Wrap `fetch` for correct work with polyfilled `URLSearchParams`
	// https://github.com/zloirock/core-js/issues/674
	if (!nativeUrl && typeof $fetch$1 == 'function' && typeof Headers$1 == 'function') {
	  _export({ global: true, enumerable: true, forced: true }, {
	    fetch: function fetch(input /* , init */) {
	      var args = [input];
	      var init, body, headers;
	      if (arguments.length > 1) {
	        init = arguments[1];
	        if (isObject(init)) {
	          body = init.body;
	          if (classof(body) === URL_SEARCH_PARAMS) {
	            headers = init.headers ? new Headers$1(init.headers) : new Headers$1();
	            if (!headers.has('content-type')) {
	              headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
	            }
	            init = objectCreate(init, {
	              body: createPropertyDescriptor(0, String(body)),
	              headers: createPropertyDescriptor(0, headers)
	            });
	          }
	        }
	        args.push(init);
	      } return $fetch$1.apply(this, args);
	    }
	  });
	}

	var web_urlSearchParams = {
	  URLSearchParams: URLSearchParamsConstructor,
	  getState: getInternalParamsState
	};

	// TODO: in core-js@4, move /modules/ dependencies to public entries for better optimization by tools like `preset-env`











	var codeAt$1 = stringMultibyte.codeAt;





	var NativeURL = global_1.URL;
	var URLSearchParams$1 = web_urlSearchParams.URLSearchParams;
	var getInternalSearchParamsState = web_urlSearchParams.getState;
	var setInternalState$9 = internalState.set;
	var getInternalURLState = internalState.getterFor('URL');
	var floor$9 = Math.floor;
	var pow$4 = Math.pow;

	var INVALID_AUTHORITY = 'Invalid authority';
	var INVALID_SCHEME = 'Invalid scheme';
	var INVALID_HOST = 'Invalid host';
	var INVALID_PORT = 'Invalid port';

	var ALPHA = /[A-Za-z]/;
	var ALPHANUMERIC = /[\d+-.A-Za-z]/;
	var DIGIT = /\d/;
	var HEX_START = /^(0x|0X)/;
	var OCT = /^[0-7]+$/;
	var DEC = /^\d+$/;
	var HEX = /^[\dA-Fa-f]+$/;
	// eslint-disable-next-line no-control-regex
	var FORBIDDEN_HOST_CODE_POINT = /[\u0000\u0009\u000A\u000D #%/:?@[\\]]/;
	// eslint-disable-next-line no-control-regex
	var FORBIDDEN_HOST_CODE_POINT_EXCLUDING_PERCENT = /[\u0000\u0009\u000A\u000D #/:?@[\\]]/;
	// eslint-disable-next-line no-control-regex
	var LEADING_AND_TRAILING_C0_CONTROL_OR_SPACE = /^[\u0000-\u001F ]+|[\u0000-\u001F ]+$/g;
	// eslint-disable-next-line no-control-regex
	var TAB_AND_NEW_LINE = /[\u0009\u000A\u000D]/g;
	var EOF;

	var parseHost = function (url, input) {
	  var result, codePoints, index;
	  if (input.charAt(0) == '[') {
	    if (input.charAt(input.length - 1) != ']') return INVALID_HOST;
	    result = parseIPv6(input.slice(1, -1));
	    if (!result) return INVALID_HOST;
	    url.host = result;
	  // opaque host
	  } else if (!isSpecial(url)) {
	    if (FORBIDDEN_HOST_CODE_POINT_EXCLUDING_PERCENT.test(input)) return INVALID_HOST;
	    result = '';
	    codePoints = arrayFrom(input);
	    for (index = 0; index < codePoints.length; index++) {
	      result += percentEncode(codePoints[index], C0ControlPercentEncodeSet);
	    }
	    url.host = result;
	  } else {
	    input = stringPunycodeToAscii(input);
	    if (FORBIDDEN_HOST_CODE_POINT.test(input)) return INVALID_HOST;
	    result = parseIPv4(input);
	    if (result === null) return INVALID_HOST;
	    url.host = result;
	  }
	};

	var parseIPv4 = function (input) {
	  var parts = input.split('.');
	  var partsLength, numbers, index, part, radix, number, ipv4;
	  if (parts.length && parts[parts.length - 1] == '') {
	    parts.pop();
	  }
	  partsLength = parts.length;
	  if (partsLength > 4) return input;
	  numbers = [];
	  for (index = 0; index < partsLength; index++) {
	    part = parts[index];
	    if (part == '') return input;
	    radix = 10;
	    if (part.length > 1 && part.charAt(0) == '0') {
	      radix = HEX_START.test(part) ? 16 : 8;
	      part = part.slice(radix == 8 ? 1 : 2);
	    }
	    if (part === '') {
	      number = 0;
	    } else {
	      if (!(radix == 10 ? DEC : radix == 8 ? OCT : HEX).test(part)) return input;
	      number = parseInt(part, radix);
	    }
	    numbers.push(number);
	  }
	  for (index = 0; index < partsLength; index++) {
	    number = numbers[index];
	    if (index == partsLength - 1) {
	      if (number >= pow$4(256, 5 - partsLength)) return null;
	    } else if (number > 255) return null;
	  }
	  ipv4 = numbers.pop();
	  for (index = 0; index < numbers.length; index++) {
	    ipv4 += numbers[index] * pow$4(256, 3 - index);
	  }
	  return ipv4;
	};

	// eslint-disable-next-line max-statements
	var parseIPv6 = function (input) {
	  var address = [0, 0, 0, 0, 0, 0, 0, 0];
	  var pieceIndex = 0;
	  var compress = null;
	  var pointer = 0;
	  var value, length, numbersSeen, ipv4Piece, number, swaps, swap;

	  var char = function () {
	    return input.charAt(pointer);
	  };

	  if (char() == ':') {
	    if (input.charAt(1) != ':') return;
	    pointer += 2;
	    pieceIndex++;
	    compress = pieceIndex;
	  }
	  while (char()) {
	    if (pieceIndex == 8) return;
	    if (char() == ':') {
	      if (compress !== null) return;
	      pointer++;
	      pieceIndex++;
	      compress = pieceIndex;
	      continue;
	    }
	    value = length = 0;
	    while (length < 4 && HEX.test(char())) {
	      value = value * 16 + parseInt(char(), 16);
	      pointer++;
	      length++;
	    }
	    if (char() == '.') {
	      if (length == 0) return;
	      pointer -= length;
	      if (pieceIndex > 6) return;
	      numbersSeen = 0;
	      while (char()) {
	        ipv4Piece = null;
	        if (numbersSeen > 0) {
	          if (char() == '.' && numbersSeen < 4) pointer++;
	          else return;
	        }
	        if (!DIGIT.test(char())) return;
	        while (DIGIT.test(char())) {
	          number = parseInt(char(), 10);
	          if (ipv4Piece === null) ipv4Piece = number;
	          else if (ipv4Piece == 0) return;
	          else ipv4Piece = ipv4Piece * 10 + number;
	          if (ipv4Piece > 255) return;
	          pointer++;
	        }
	        address[pieceIndex] = address[pieceIndex] * 256 + ipv4Piece;
	        numbersSeen++;
	        if (numbersSeen == 2 || numbersSeen == 4) pieceIndex++;
	      }
	      if (numbersSeen != 4) return;
	      break;
	    } else if (char() == ':') {
	      pointer++;
	      if (!char()) return;
	    } else if (char()) return;
	    address[pieceIndex++] = value;
	  }
	  if (compress !== null) {
	    swaps = pieceIndex - compress;
	    pieceIndex = 7;
	    while (pieceIndex != 0 && swaps > 0) {
	      swap = address[pieceIndex];
	      address[pieceIndex--] = address[compress + swaps - 1];
	      address[compress + --swaps] = swap;
	    }
	  } else if (pieceIndex != 8) return;
	  return address;
	};

	var findLongestZeroSequence = function (ipv6) {
	  var maxIndex = null;
	  var maxLength = 1;
	  var currStart = null;
	  var currLength = 0;
	  var index = 0;
	  for (; index < 8; index++) {
	    if (ipv6[index] !== 0) {
	      if (currLength > maxLength) {
	        maxIndex = currStart;
	        maxLength = currLength;
	      }
	      currStart = null;
	      currLength = 0;
	    } else {
	      if (currStart === null) currStart = index;
	      ++currLength;
	    }
	  }
	  if (currLength > maxLength) {
	    maxIndex = currStart;
	    maxLength = currLength;
	  }
	  return maxIndex;
	};

	var serializeHost = function (host) {
	  var result, index, compress, ignore0;
	  // ipv4
	  if (typeof host == 'number') {
	    result = [];
	    for (index = 0; index < 4; index++) {
	      result.unshift(host % 256);
	      host = floor$9(host / 256);
	    } return result.join('.');
	  // ipv6
	  } else if (typeof host == 'object') {
	    result = '';
	    compress = findLongestZeroSequence(host);
	    for (index = 0; index < 8; index++) {
	      if (ignore0 && host[index] === 0) continue;
	      if (ignore0) ignore0 = false;
	      if (compress === index) {
	        result += index ? ':' : '::';
	        ignore0 = true;
	      } else {
	        result += host[index].toString(16);
	        if (index < 7) result += ':';
	      }
	    }
	    return '[' + result + ']';
	  } return host;
	};

	var C0ControlPercentEncodeSet = {};
	var fragmentPercentEncodeSet = objectAssign({}, C0ControlPercentEncodeSet, {
	  ' ': 1, '"': 1, '<': 1, '>': 1, '`': 1
	});
	var pathPercentEncodeSet = objectAssign({}, fragmentPercentEncodeSet, {
	  '#': 1, '?': 1, '{': 1, '}': 1
	});
	var userinfoPercentEncodeSet = objectAssign({}, pathPercentEncodeSet, {
	  '/': 1, ':': 1, ';': 1, '=': 1, '@': 1, '[': 1, '\\': 1, ']': 1, '^': 1, '|': 1
	});

	var percentEncode = function (char, set) {
	  var code = codeAt$1(char, 0);
	  return code > 0x20 && code < 0x7F && !has(set, char) ? char : encodeURIComponent(char);
	};

	var specialSchemes = {
	  ftp: 21,
	  file: null,
	  http: 80,
	  https: 443,
	  ws: 80,
	  wss: 443
	};

	var isSpecial = function (url) {
	  return has(specialSchemes, url.scheme);
	};

	var includesCredentials = function (url) {
	  return url.username != '' || url.password != '';
	};

	var cannotHaveUsernamePasswordPort = function (url) {
	  return !url.host || url.cannotBeABaseURL || url.scheme == 'file';
	};

	var isWindowsDriveLetter = function (string, normalized) {
	  var second;
	  return string.length == 2 && ALPHA.test(string.charAt(0))
	    && ((second = string.charAt(1)) == ':' || (!normalized && second == '|'));
	};

	var startsWithWindowsDriveLetter = function (string) {
	  var third;
	  return string.length > 1 && isWindowsDriveLetter(string.slice(0, 2)) && (
	    string.length == 2 ||
	    ((third = string.charAt(2)) === '/' || third === '\\' || third === '?' || third === '#')
	  );
	};

	var shortenURLsPath = function (url) {
	  var path = url.path;
	  var pathSize = path.length;
	  if (pathSize && (url.scheme != 'file' || pathSize != 1 || !isWindowsDriveLetter(path[0], true))) {
	    path.pop();
	  }
	};

	var isSingleDot = function (segment) {
	  return segment === '.' || segment.toLowerCase() === '%2e';
	};

	var isDoubleDot = function (segment) {
	  segment = segment.toLowerCase();
	  return segment === '..' || segment === '%2e.' || segment === '.%2e' || segment === '%2e%2e';
	};

	// States:
	var SCHEME_START = {};
	var SCHEME = {};
	var NO_SCHEME = {};
	var SPECIAL_RELATIVE_OR_AUTHORITY = {};
	var PATH_OR_AUTHORITY = {};
	var RELATIVE = {};
	var RELATIVE_SLASH = {};
	var SPECIAL_AUTHORITY_SLASHES = {};
	var SPECIAL_AUTHORITY_IGNORE_SLASHES = {};
	var AUTHORITY = {};
	var HOST = {};
	var HOSTNAME = {};
	var PORT = {};
	var FILE = {};
	var FILE_SLASH = {};
	var FILE_HOST = {};
	var PATH_START = {};
	var PATH = {};
	var CANNOT_BE_A_BASE_URL_PATH = {};
	var QUERY = {};
	var FRAGMENT = {};

	// eslint-disable-next-line max-statements
	var parseURL = function (url, input, stateOverride, base) {
	  var state = stateOverride || SCHEME_START;
	  var pointer = 0;
	  var buffer = '';
	  var seenAt = false;
	  var seenBracket = false;
	  var seenPasswordToken = false;
	  var codePoints, char, bufferCodePoints, failure;

	  if (!stateOverride) {
	    url.scheme = '';
	    url.username = '';
	    url.password = '';
	    url.host = null;
	    url.port = null;
	    url.path = [];
	    url.query = null;
	    url.fragment = null;
	    url.cannotBeABaseURL = false;
	    input = input.replace(LEADING_AND_TRAILING_C0_CONTROL_OR_SPACE, '');
	  }

	  input = input.replace(TAB_AND_NEW_LINE, '');

	  codePoints = arrayFrom(input);

	  while (pointer <= codePoints.length) {
	    char = codePoints[pointer];
	    switch (state) {
	      case SCHEME_START:
	        if (char && ALPHA.test(char)) {
	          buffer += char.toLowerCase();
	          state = SCHEME;
	        } else if (!stateOverride) {
	          state = NO_SCHEME;
	          continue;
	        } else return INVALID_SCHEME;
	        break;

	      case SCHEME:
	        if (char && (ALPHANUMERIC.test(char) || char == '+' || char == '-' || char == '.')) {
	          buffer += char.toLowerCase();
	        } else if (char == ':') {
	          if (stateOverride && (
	            (isSpecial(url) != has(specialSchemes, buffer)) ||
	            (buffer == 'file' && (includesCredentials(url) || url.port !== null)) ||
	            (url.scheme == 'file' && !url.host)
	          )) return;
	          url.scheme = buffer;
	          if (stateOverride) {
	            if (isSpecial(url) && specialSchemes[url.scheme] == url.port) url.port = null;
	            return;
	          }
	          buffer = '';
	          if (url.scheme == 'file') {
	            state = FILE;
	          } else if (isSpecial(url) && base && base.scheme == url.scheme) {
	            state = SPECIAL_RELATIVE_OR_AUTHORITY;
	          } else if (isSpecial(url)) {
	            state = SPECIAL_AUTHORITY_SLASHES;
	          } else if (codePoints[pointer + 1] == '/') {
	            state = PATH_OR_AUTHORITY;
	            pointer++;
	          } else {
	            url.cannotBeABaseURL = true;
	            url.path.push('');
	            state = CANNOT_BE_A_BASE_URL_PATH;
	          }
	        } else if (!stateOverride) {
	          buffer = '';
	          state = NO_SCHEME;
	          pointer = 0;
	          continue;
	        } else return INVALID_SCHEME;
	        break;

	      case NO_SCHEME:
	        if (!base || (base.cannotBeABaseURL && char != '#')) return INVALID_SCHEME;
	        if (base.cannotBeABaseURL && char == '#') {
	          url.scheme = base.scheme;
	          url.path = base.path.slice();
	          url.query = base.query;
	          url.fragment = '';
	          url.cannotBeABaseURL = true;
	          state = FRAGMENT;
	          break;
	        }
	        state = base.scheme == 'file' ? FILE : RELATIVE;
	        continue;

	      case SPECIAL_RELATIVE_OR_AUTHORITY:
	        if (char == '/' && codePoints[pointer + 1] == '/') {
	          state = SPECIAL_AUTHORITY_IGNORE_SLASHES;
	          pointer++;
	        } else {
	          state = RELATIVE;
	          continue;
	        } break;

	      case PATH_OR_AUTHORITY:
	        if (char == '/') {
	          state = AUTHORITY;
	          break;
	        } else {
	          state = PATH;
	          continue;
	        }

	      case RELATIVE:
	        url.scheme = base.scheme;
	        if (char == EOF) {
	          url.username = base.username;
	          url.password = base.password;
	          url.host = base.host;
	          url.port = base.port;
	          url.path = base.path.slice();
	          url.query = base.query;
	        } else if (char == '/' || (char == '\\' && isSpecial(url))) {
	          state = RELATIVE_SLASH;
	        } else if (char == '?') {
	          url.username = base.username;
	          url.password = base.password;
	          url.host = base.host;
	          url.port = base.port;
	          url.path = base.path.slice();
	          url.query = '';
	          state = QUERY;
	        } else if (char == '#') {
	          url.username = base.username;
	          url.password = base.password;
	          url.host = base.host;
	          url.port = base.port;
	          url.path = base.path.slice();
	          url.query = base.query;
	          url.fragment = '';
	          state = FRAGMENT;
	        } else {
	          url.username = base.username;
	          url.password = base.password;
	          url.host = base.host;
	          url.port = base.port;
	          url.path = base.path.slice();
	          url.path.pop();
	          state = PATH;
	          continue;
	        } break;

	      case RELATIVE_SLASH:
	        if (isSpecial(url) && (char == '/' || char == '\\')) {
	          state = SPECIAL_AUTHORITY_IGNORE_SLASHES;
	        } else if (char == '/') {
	          state = AUTHORITY;
	        } else {
	          url.username = base.username;
	          url.password = base.password;
	          url.host = base.host;
	          url.port = base.port;
	          state = PATH;
	          continue;
	        } break;

	      case SPECIAL_AUTHORITY_SLASHES:
	        state = SPECIAL_AUTHORITY_IGNORE_SLASHES;
	        if (char != '/' || buffer.charAt(pointer + 1) != '/') continue;
	        pointer++;
	        break;

	      case SPECIAL_AUTHORITY_IGNORE_SLASHES:
	        if (char != '/' && char != '\\') {
	          state = AUTHORITY;
	          continue;
	        } break;

	      case AUTHORITY:
	        if (char == '@') {
	          if (seenAt) buffer = '%40' + buffer;
	          seenAt = true;
	          bufferCodePoints = arrayFrom(buffer);
	          for (var i = 0; i < bufferCodePoints.length; i++) {
	            var codePoint = bufferCodePoints[i];
	            if (codePoint == ':' && !seenPasswordToken) {
	              seenPasswordToken = true;
	              continue;
	            }
	            var encodedCodePoints = percentEncode(codePoint, userinfoPercentEncodeSet);
	            if (seenPasswordToken) url.password += encodedCodePoints;
	            else url.username += encodedCodePoints;
	          }
	          buffer = '';
	        } else if (
	          char == EOF || char == '/' || char == '?' || char == '#' ||
	          (char == '\\' && isSpecial(url))
	        ) {
	          if (seenAt && buffer == '') return INVALID_AUTHORITY;
	          pointer -= arrayFrom(buffer).length + 1;
	          buffer = '';
	          state = HOST;
	        } else buffer += char;
	        break;

	      case HOST:
	      case HOSTNAME:
	        if (stateOverride && url.scheme == 'file') {
	          state = FILE_HOST;
	          continue;
	        } else if (char == ':' && !seenBracket) {
	          if (buffer == '') return INVALID_HOST;
	          failure = parseHost(url, buffer);
	          if (failure) return failure;
	          buffer = '';
	          state = PORT;
	          if (stateOverride == HOSTNAME) return;
	        } else if (
	          char == EOF || char == '/' || char == '?' || char == '#' ||
	          (char == '\\' && isSpecial(url))
	        ) {
	          if (isSpecial(url) && buffer == '') return INVALID_HOST;
	          if (stateOverride && buffer == '' && (includesCredentials(url) || url.port !== null)) return;
	          failure = parseHost(url, buffer);
	          if (failure) return failure;
	          buffer = '';
	          state = PATH_START;
	          if (stateOverride) return;
	          continue;
	        } else {
	          if (char == '[') seenBracket = true;
	          else if (char == ']') seenBracket = false;
	          buffer += char;
	        } break;

	      case PORT:
	        if (DIGIT.test(char)) {
	          buffer += char;
	        } else if (
	          char == EOF || char == '/' || char == '?' || char == '#' ||
	          (char == '\\' && isSpecial(url)) ||
	          stateOverride
	        ) {
	          if (buffer != '') {
	            var port = parseInt(buffer, 10);
	            if (port > 0xFFFF) return INVALID_PORT;
	            url.port = (isSpecial(url) && port === specialSchemes[url.scheme]) ? null : port;
	            buffer = '';
	          }
	          if (stateOverride) return;
	          state = PATH_START;
	          continue;
	        } else return INVALID_PORT;
	        break;

	      case FILE:
	        url.scheme = 'file';
	        if (char == '/' || char == '\\') state = FILE_SLASH;
	        else if (base && base.scheme == 'file') {
	          if (char == EOF) {
	            url.host = base.host;
	            url.path = base.path.slice();
	            url.query = base.query;
	          } else if (char == '?') {
	            url.host = base.host;
	            url.path = base.path.slice();
	            url.query = '';
	            state = QUERY;
	          } else if (char == '#') {
	            url.host = base.host;
	            url.path = base.path.slice();
	            url.query = base.query;
	            url.fragment = '';
	            state = FRAGMENT;
	          } else {
	            if (!startsWithWindowsDriveLetter(codePoints.slice(pointer).join(''))) {
	              url.host = base.host;
	              url.path = base.path.slice();
	              shortenURLsPath(url);
	            }
	            state = PATH;
	            continue;
	          }
	        } else {
	          state = PATH;
	          continue;
	        } break;

	      case FILE_SLASH:
	        if (char == '/' || char == '\\') {
	          state = FILE_HOST;
	          break;
	        }
	        if (base && base.scheme == 'file' && !startsWithWindowsDriveLetter(codePoints.slice(pointer).join(''))) {
	          if (isWindowsDriveLetter(base.path[0], true)) url.path.push(base.path[0]);
	          else url.host = base.host;
	        }
	        state = PATH;
	        continue;

	      case FILE_HOST:
	        if (char == EOF || char == '/' || char == '\\' || char == '?' || char == '#') {
	          if (!stateOverride && isWindowsDriveLetter(buffer)) {
	            state = PATH;
	          } else if (buffer == '') {
	            url.host = '';
	            if (stateOverride) return;
	            state = PATH_START;
	          } else {
	            failure = parseHost(url, buffer);
	            if (failure) return failure;
	            if (url.host == 'localhost') url.host = '';
	            if (stateOverride) return;
	            buffer = '';
	            state = PATH_START;
	          } continue;
	        } else buffer += char;
	        break;

	      case PATH_START:
	        if (isSpecial(url)) {
	          state = PATH;
	          if (char != '/' && char != '\\') continue;
	        } else if (!stateOverride && char == '?') {
	          url.query = '';
	          state = QUERY;
	        } else if (!stateOverride && char == '#') {
	          url.fragment = '';
	          state = FRAGMENT;
	        } else if (char != EOF) {
	          state = PATH;
	          if (char != '/') continue;
	        } break;

	      case PATH:
	        if (
	          char == EOF || char == '/' ||
	          (char == '\\' && isSpecial(url)) ||
	          (!stateOverride && (char == '?' || char == '#'))
	        ) {
	          if (isDoubleDot(buffer)) {
	            shortenURLsPath(url);
	            if (char != '/' && !(char == '\\' && isSpecial(url))) {
	              url.path.push('');
	            }
	          } else if (isSingleDot(buffer)) {
	            if (char != '/' && !(char == '\\' && isSpecial(url))) {
	              url.path.push('');
	            }
	          } else {
	            if (url.scheme == 'file' && !url.path.length && isWindowsDriveLetter(buffer)) {
	              if (url.host) url.host = '';
	              buffer = buffer.charAt(0) + ':'; // normalize windows drive letter
	            }
	            url.path.push(buffer);
	          }
	          buffer = '';
	          if (url.scheme == 'file' && (char == EOF || char == '?' || char == '#')) {
	            while (url.path.length > 1 && url.path[0] === '') {
	              url.path.shift();
	            }
	          }
	          if (char == '?') {
	            url.query = '';
	            state = QUERY;
	          } else if (char == '#') {
	            url.fragment = '';
	            state = FRAGMENT;
	          }
	        } else {
	          buffer += percentEncode(char, pathPercentEncodeSet);
	        } break;

	      case CANNOT_BE_A_BASE_URL_PATH:
	        if (char == '?') {
	          url.query = '';
	          state = QUERY;
	        } else if (char == '#') {
	          url.fragment = '';
	          state = FRAGMENT;
	        } else if (char != EOF) {
	          url.path[0] += percentEncode(char, C0ControlPercentEncodeSet);
	        } break;

	      case QUERY:
	        if (!stateOverride && char == '#') {
	          url.fragment = '';
	          state = FRAGMENT;
	        } else if (char != EOF) {
	          if (char == "'" && isSpecial(url)) url.query += '%27';
	          else if (char == '#') url.query += '%23';
	          else url.query += percentEncode(char, C0ControlPercentEncodeSet);
	        } break;

	      case FRAGMENT:
	        if (char != EOF) url.fragment += percentEncode(char, fragmentPercentEncodeSet);
	        break;
	    }

	    pointer++;
	  }
	};

	// `URL` constructor
	// https://url.spec.whatwg.org/#url-class
	var URLConstructor = function URL(url /* , base */) {
	  var that = anInstance(this, URLConstructor, 'URL');
	  var base = arguments.length > 1 ? arguments[1] : undefined;
	  var urlString = String(url);
	  var state = setInternalState$9(that, { type: 'URL' });
	  var baseState, failure;
	  if (base !== undefined) {
	    if (base instanceof URLConstructor) baseState = getInternalURLState(base);
	    else {
	      failure = parseURL(baseState = {}, String(base));
	      if (failure) throw TypeError(failure);
	    }
	  }
	  failure = parseURL(state, urlString, null, baseState);
	  if (failure) throw TypeError(failure);
	  var searchParams = state.searchParams = new URLSearchParams$1();
	  var searchParamsState = getInternalSearchParamsState(searchParams);
	  searchParamsState.updateSearchParams(state.query);
	  searchParamsState.updateURL = function () {
	    state.query = String(searchParams) || null;
	  };
	  if (!descriptors) {
	    that.href = serializeURL.call(that);
	    that.origin = getOrigin.call(that);
	    that.protocol = getProtocol.call(that);
	    that.username = getUsername.call(that);
	    that.password = getPassword.call(that);
	    that.host = getHost.call(that);
	    that.hostname = getHostname.call(that);
	    that.port = getPort.call(that);
	    that.pathname = getPathname.call(that);
	    that.search = getSearch.call(that);
	    that.searchParams = getSearchParams.call(that);
	    that.hash = getHash.call(that);
	  }
	};

	var URLPrototype = URLConstructor.prototype;

	var serializeURL = function () {
	  var url = getInternalURLState(this);
	  var scheme = url.scheme;
	  var username = url.username;
	  var password = url.password;
	  var host = url.host;
	  var port = url.port;
	  var path = url.path;
	  var query = url.query;
	  var fragment = url.fragment;
	  var output = scheme + ':';
	  if (host !== null) {
	    output += '//';
	    if (includesCredentials(url)) {
	      output += username + (password ? ':' + password : '') + '@';
	    }
	    output += serializeHost(host);
	    if (port !== null) output += ':' + port;
	  } else if (scheme == 'file') output += '//';
	  output += url.cannotBeABaseURL ? path[0] : path.length ? '/' + path.join('/') : '';
	  if (query !== null) output += '?' + query;
	  if (fragment !== null) output += '#' + fragment;
	  return output;
	};

	var getOrigin = function () {
	  var url = getInternalURLState(this);
	  var scheme = url.scheme;
	  var port = url.port;
	  if (scheme == 'blob') try {
	    return new URL(scheme.path[0]).origin;
	  } catch (error) {
	    return 'null';
	  }
	  if (scheme == 'file' || !isSpecial(url)) return 'null';
	  return scheme + '://' + serializeHost(url.host) + (port !== null ? ':' + port : '');
	};

	var getProtocol = function () {
	  return getInternalURLState(this).scheme + ':';
	};

	var getUsername = function () {
	  return getInternalURLState(this).username;
	};

	var getPassword = function () {
	  return getInternalURLState(this).password;
	};

	var getHost = function () {
	  var url = getInternalURLState(this);
	  var host = url.host;
	  var port = url.port;
	  return host === null ? ''
	    : port === null ? serializeHost(host)
	    : serializeHost(host) + ':' + port;
	};

	var getHostname = function () {
	  var host = getInternalURLState(this).host;
	  return host === null ? '' : serializeHost(host);
	};

	var getPort = function () {
	  var port = getInternalURLState(this).port;
	  return port === null ? '' : String(port);
	};

	var getPathname = function () {
	  var url = getInternalURLState(this);
	  var path = url.path;
	  return url.cannotBeABaseURL ? path[0] : path.length ? '/' + path.join('/') : '';
	};

	var getSearch = function () {
	  var query = getInternalURLState(this).query;
	  return query ? '?' + query : '';
	};

	var getSearchParams = function () {
	  return getInternalURLState(this).searchParams;
	};

	var getHash = function () {
	  var fragment = getInternalURLState(this).fragment;
	  return fragment ? '#' + fragment : '';
	};

	var accessorDescriptor = function (getter, setter) {
	  return { get: getter, set: setter, configurable: true, enumerable: true };
	};

	if (descriptors) {
	  objectDefineProperties(URLPrototype, {
	    // `URL.prototype.href` accessors pair
	    // https://url.spec.whatwg.org/#dom-url-href
	    href: accessorDescriptor(serializeURL, function (href) {
	      var url = getInternalURLState(this);
	      var urlString = String(href);
	      var failure = parseURL(url, urlString);
	      if (failure) throw TypeError(failure);
	      getInternalSearchParamsState(url.searchParams).updateSearchParams(url.query);
	    }),
	    // `URL.prototype.origin` getter
	    // https://url.spec.whatwg.org/#dom-url-origin
	    origin: accessorDescriptor(getOrigin),
	    // `URL.prototype.protocol` accessors pair
	    // https://url.spec.whatwg.org/#dom-url-protocol
	    protocol: accessorDescriptor(getProtocol, function (protocol) {
	      var url = getInternalURLState(this);
	      parseURL(url, String(protocol) + ':', SCHEME_START);
	    }),
	    // `URL.prototype.username` accessors pair
	    // https://url.spec.whatwg.org/#dom-url-username
	    username: accessorDescriptor(getUsername, function (username) {
	      var url = getInternalURLState(this);
	      var codePoints = arrayFrom(String(username));
	      if (cannotHaveUsernamePasswordPort(url)) return;
	      url.username = '';
	      for (var i = 0; i < codePoints.length; i++) {
	        url.username += percentEncode(codePoints[i], userinfoPercentEncodeSet);
	      }
	    }),
	    // `URL.prototype.password` accessors pair
	    // https://url.spec.whatwg.org/#dom-url-password
	    password: accessorDescriptor(getPassword, function (password) {
	      var url = getInternalURLState(this);
	      var codePoints = arrayFrom(String(password));
	      if (cannotHaveUsernamePasswordPort(url)) return;
	      url.password = '';
	      for (var i = 0; i < codePoints.length; i++) {
	        url.password += percentEncode(codePoints[i], userinfoPercentEncodeSet);
	      }
	    }),
	    // `URL.prototype.host` accessors pair
	    // https://url.spec.whatwg.org/#dom-url-host
	    host: accessorDescriptor(getHost, function (host) {
	      var url = getInternalURLState(this);
	      if (url.cannotBeABaseURL) return;
	      parseURL(url, String(host), HOST);
	    }),
	    // `URL.prototype.hostname` accessors pair
	    // https://url.spec.whatwg.org/#dom-url-hostname
	    hostname: accessorDescriptor(getHostname, function (hostname) {
	      var url = getInternalURLState(this);
	      if (url.cannotBeABaseURL) return;
	      parseURL(url, String(hostname), HOSTNAME);
	    }),
	    // `URL.prototype.port` accessors pair
	    // https://url.spec.whatwg.org/#dom-url-port
	    port: accessorDescriptor(getPort, function (port) {
	      var url = getInternalURLState(this);
	      if (cannotHaveUsernamePasswordPort(url)) return;
	      port = String(port);
	      if (port == '') url.port = null;
	      else parseURL(url, port, PORT);
	    }),
	    // `URL.prototype.pathname` accessors pair
	    // https://url.spec.whatwg.org/#dom-url-pathname
	    pathname: accessorDescriptor(getPathname, function (pathname) {
	      var url = getInternalURLState(this);
	      if (url.cannotBeABaseURL) return;
	      url.path = [];
	      parseURL(url, pathname + '', PATH_START);
	    }),
	    // `URL.prototype.search` accessors pair
	    // https://url.spec.whatwg.org/#dom-url-search
	    search: accessorDescriptor(getSearch, function (search) {
	      var url = getInternalURLState(this);
	      search = String(search);
	      if (search == '') {
	        url.query = null;
	      } else {
	        if ('?' == search.charAt(0)) search = search.slice(1);
	        url.query = '';
	        parseURL(url, search, QUERY);
	      }
	      getInternalSearchParamsState(url.searchParams).updateSearchParams(url.query);
	    }),
	    // `URL.prototype.searchParams` getter
	    // https://url.spec.whatwg.org/#dom-url-searchparams
	    searchParams: accessorDescriptor(getSearchParams),
	    // `URL.prototype.hash` accessors pair
	    // https://url.spec.whatwg.org/#dom-url-hash
	    hash: accessorDescriptor(getHash, function (hash) {
	      var url = getInternalURLState(this);
	      hash = String(hash);
	      if (hash == '') {
	        url.fragment = null;
	        return;
	      }
	      if ('#' == hash.charAt(0)) hash = hash.slice(1);
	      url.fragment = '';
	      parseURL(url, hash, FRAGMENT);
	    })
	  });
	}

	// `URL.prototype.toJSON` method
	// https://url.spec.whatwg.org/#dom-url-tojson
	redefine(URLPrototype, 'toJSON', function toJSON() {
	  return serializeURL.call(this);
	}, { enumerable: true });

	// `URL.prototype.toString` method
	// https://url.spec.whatwg.org/#URL-stringification-behavior
	redefine(URLPrototype, 'toString', function toString() {
	  return serializeURL.call(this);
	}, { enumerable: true });

	if (NativeURL) {
	  var nativeCreateObjectURL = NativeURL.createObjectURL;
	  var nativeRevokeObjectURL = NativeURL.revokeObjectURL;
	  // `URL.createObjectURL` method
	  // https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
	  // eslint-disable-next-line no-unused-vars
	  if (nativeCreateObjectURL) redefine(URLConstructor, 'createObjectURL', function createObjectURL(blob) {
	    return nativeCreateObjectURL.apply(NativeURL, arguments);
	  });
	  // `URL.revokeObjectURL` method
	  // https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL
	  // eslint-disable-next-line no-unused-vars
	  if (nativeRevokeObjectURL) redefine(URLConstructor, 'revokeObjectURL', function revokeObjectURL(url) {
	    return nativeRevokeObjectURL.apply(NativeURL, arguments);
	  });
	}

	setToStringTag(URLConstructor, 'URL');

	_export({ global: true, forced: !nativeUrl, sham: !descriptors }, {
	  URL: URLConstructor
	});

	// `URL.prototype.toJSON` method
	// https://url.spec.whatwg.org/#dom-url-tojson
	_export({ target: 'URL', proto: true, enumerable: true }, {
	  toJSON: function toJSON() {
	    return URL.prototype.toString.call(this);
	  }
	});

	var runtime_1 = createCommonjsModule(function (module) {
	/**
	 * Copyright (c) 2014-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	var runtime = (function (exports) {

	  var Op = Object.prototype;
	  var hasOwn = Op.hasOwnProperty;
	  var undefined$1; // More compressible than void 0.
	  var $Symbol = typeof Symbol === "function" ? Symbol : {};
	  var iteratorSymbol = $Symbol.iterator || "@@iterator";
	  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
	  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

	  function define(obj, key, value) {
	    Object.defineProperty(obj, key, {
	      value: value,
	      enumerable: true,
	      configurable: true,
	      writable: true
	    });
	    return obj[key];
	  }
	  try {
	    // IE 8 has a broken Object.defineProperty that only works on DOM objects.
	    define({}, "");
	  } catch (err) {
	    define = function(obj, key, value) {
	      return obj[key] = value;
	    };
	  }

	  function wrap(innerFn, outerFn, self, tryLocsList) {
	    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
	    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
	    var generator = Object.create(protoGenerator.prototype);
	    var context = new Context(tryLocsList || []);

	    // The ._invoke method unifies the implementations of the .next,
	    // .throw, and .return methods.
	    generator._invoke = makeInvokeMethod(innerFn, self, context);

	    return generator;
	  }
	  exports.wrap = wrap;

	  // Try/catch helper to minimize deoptimizations. Returns a completion
	  // record like context.tryEntries[i].completion. This interface could
	  // have been (and was previously) designed to take a closure to be
	  // invoked without arguments, but in all the cases we care about we
	  // already have an existing method we want to call, so there's no need
	  // to create a new function object. We can even get away with assuming
	  // the method takes exactly one argument, since that happens to be true
	  // in every case, so we don't have to touch the arguments object. The
	  // only additional allocation required is the completion record, which
	  // has a stable shape and so hopefully should be cheap to allocate.
	  function tryCatch(fn, obj, arg) {
	    try {
	      return { type: "normal", arg: fn.call(obj, arg) };
	    } catch (err) {
	      return { type: "throw", arg: err };
	    }
	  }

	  var GenStateSuspendedStart = "suspendedStart";
	  var GenStateSuspendedYield = "suspendedYield";
	  var GenStateExecuting = "executing";
	  var GenStateCompleted = "completed";

	  // Returning this object from the innerFn has the same effect as
	  // breaking out of the dispatch switch statement.
	  var ContinueSentinel = {};

	  // Dummy constructor functions that we use as the .constructor and
	  // .constructor.prototype properties for functions that return Generator
	  // objects. For full spec compliance, you may wish to configure your
	  // minifier not to mangle the names of these two functions.
	  function Generator() {}
	  function GeneratorFunction() {}
	  function GeneratorFunctionPrototype() {}

	  // This is a polyfill for %IteratorPrototype% for environments that
	  // don't natively support it.
	  var IteratorPrototype = {};
	  IteratorPrototype[iteratorSymbol] = function () {
	    return this;
	  };

	  var getProto = Object.getPrototypeOf;
	  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
	  if (NativeIteratorPrototype &&
	      NativeIteratorPrototype !== Op &&
	      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
	    // This environment has a native %IteratorPrototype%; use it instead
	    // of the polyfill.
	    IteratorPrototype = NativeIteratorPrototype;
	  }

	  var Gp = GeneratorFunctionPrototype.prototype =
	    Generator.prototype = Object.create(IteratorPrototype);
	  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
	  GeneratorFunctionPrototype.constructor = GeneratorFunction;
	  GeneratorFunction.displayName = define(
	    GeneratorFunctionPrototype,
	    toStringTagSymbol,
	    "GeneratorFunction"
	  );

	  // Helper for defining the .next, .throw, and .return methods of the
	  // Iterator interface in terms of a single ._invoke method.
	  function defineIteratorMethods(prototype) {
	    ["next", "throw", "return"].forEach(function(method) {
	      define(prototype, method, function(arg) {
	        return this._invoke(method, arg);
	      });
	    });
	  }

	  exports.isGeneratorFunction = function(genFun) {
	    var ctor = typeof genFun === "function" && genFun.constructor;
	    return ctor
	      ? ctor === GeneratorFunction ||
	        // For the native GeneratorFunction constructor, the best we can
	        // do is to check its .name property.
	        (ctor.displayName || ctor.name) === "GeneratorFunction"
	      : false;
	  };

	  exports.mark = function(genFun) {
	    if (Object.setPrototypeOf) {
	      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
	    } else {
	      genFun.__proto__ = GeneratorFunctionPrototype;
	      define(genFun, toStringTagSymbol, "GeneratorFunction");
	    }
	    genFun.prototype = Object.create(Gp);
	    return genFun;
	  };

	  // Within the body of any async function, `await x` is transformed to
	  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
	  // `hasOwn.call(value, "__await")` to determine if the yielded value is
	  // meant to be awaited.
	  exports.awrap = function(arg) {
	    return { __await: arg };
	  };

	  function AsyncIterator(generator, PromiseImpl) {
	    function invoke(method, arg, resolve, reject) {
	      var record = tryCatch(generator[method], generator, arg);
	      if (record.type === "throw") {
	        reject(record.arg);
	      } else {
	        var result = record.arg;
	        var value = result.value;
	        if (value &&
	            typeof value === "object" &&
	            hasOwn.call(value, "__await")) {
	          return PromiseImpl.resolve(value.__await).then(function(value) {
	            invoke("next", value, resolve, reject);
	          }, function(err) {
	            invoke("throw", err, resolve, reject);
	          });
	        }

	        return PromiseImpl.resolve(value).then(function(unwrapped) {
	          // When a yielded Promise is resolved, its final value becomes
	          // the .value of the Promise<{value,done}> result for the
	          // current iteration.
	          result.value = unwrapped;
	          resolve(result);
	        }, function(error) {
	          // If a rejected Promise was yielded, throw the rejection back
	          // into the async generator function so it can be handled there.
	          return invoke("throw", error, resolve, reject);
	        });
	      }
	    }

	    var previousPromise;

	    function enqueue(method, arg) {
	      function callInvokeWithMethodAndArg() {
	        return new PromiseImpl(function(resolve, reject) {
	          invoke(method, arg, resolve, reject);
	        });
	      }

	      return previousPromise =
	        // If enqueue has been called before, then we want to wait until
	        // all previous Promises have been resolved before calling invoke,
	        // so that results are always delivered in the correct order. If
	        // enqueue has not been called before, then it is important to
	        // call invoke immediately, without waiting on a callback to fire,
	        // so that the async generator function has the opportunity to do
	        // any necessary setup in a predictable way. This predictability
	        // is why the Promise constructor synchronously invokes its
	        // executor callback, and why async functions synchronously
	        // execute code before the first await. Since we implement simple
	        // async functions in terms of async generators, it is especially
	        // important to get this right, even though it requires care.
	        previousPromise ? previousPromise.then(
	          callInvokeWithMethodAndArg,
	          // Avoid propagating failures to Promises returned by later
	          // invocations of the iterator.
	          callInvokeWithMethodAndArg
	        ) : callInvokeWithMethodAndArg();
	    }

	    // Define the unified helper method that is used to implement .next,
	    // .throw, and .return (see defineIteratorMethods).
	    this._invoke = enqueue;
	  }

	  defineIteratorMethods(AsyncIterator.prototype);
	  AsyncIterator.prototype[asyncIteratorSymbol] = function () {
	    return this;
	  };
	  exports.AsyncIterator = AsyncIterator;

	  // Note that simple async functions are implemented on top of
	  // AsyncIterator objects; they just return a Promise for the value of
	  // the final result produced by the iterator.
	  exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
	    if (PromiseImpl === void 0) PromiseImpl = Promise;

	    var iter = new AsyncIterator(
	      wrap(innerFn, outerFn, self, tryLocsList),
	      PromiseImpl
	    );

	    return exports.isGeneratorFunction(outerFn)
	      ? iter // If outerFn is a generator, return the full iterator.
	      : iter.next().then(function(result) {
	          return result.done ? result.value : iter.next();
	        });
	  };

	  function makeInvokeMethod(innerFn, self, context) {
	    var state = GenStateSuspendedStart;

	    return function invoke(method, arg) {
	      if (state === GenStateExecuting) {
	        throw new Error("Generator is already running");
	      }

	      if (state === GenStateCompleted) {
	        if (method === "throw") {
	          throw arg;
	        }

	        // Be forgiving, per 25.3.3.3.3 of the spec:
	        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
	        return doneResult();
	      }

	      context.method = method;
	      context.arg = arg;

	      while (true) {
	        var delegate = context.delegate;
	        if (delegate) {
	          var delegateResult = maybeInvokeDelegate(delegate, context);
	          if (delegateResult) {
	            if (delegateResult === ContinueSentinel) continue;
	            return delegateResult;
	          }
	        }

	        if (context.method === "next") {
	          // Setting context._sent for legacy support of Babel's
	          // function.sent implementation.
	          context.sent = context._sent = context.arg;

	        } else if (context.method === "throw") {
	          if (state === GenStateSuspendedStart) {
	            state = GenStateCompleted;
	            throw context.arg;
	          }

	          context.dispatchException(context.arg);

	        } else if (context.method === "return") {
	          context.abrupt("return", context.arg);
	        }

	        state = GenStateExecuting;

	        var record = tryCatch(innerFn, self, context);
	        if (record.type === "normal") {
	          // If an exception is thrown from innerFn, we leave state ===
	          // GenStateExecuting and loop back for another invocation.
	          state = context.done
	            ? GenStateCompleted
	            : GenStateSuspendedYield;

	          if (record.arg === ContinueSentinel) {
	            continue;
	          }

	          return {
	            value: record.arg,
	            done: context.done
	          };

	        } else if (record.type === "throw") {
	          state = GenStateCompleted;
	          // Dispatch the exception by looping back around to the
	          // context.dispatchException(context.arg) call above.
	          context.method = "throw";
	          context.arg = record.arg;
	        }
	      }
	    };
	  }

	  // Call delegate.iterator[context.method](context.arg) and handle the
	  // result, either by returning a { value, done } result from the
	  // delegate iterator, or by modifying context.method and context.arg,
	  // setting context.delegate to null, and returning the ContinueSentinel.
	  function maybeInvokeDelegate(delegate, context) {
	    var method = delegate.iterator[context.method];
	    if (method === undefined$1) {
	      // A .throw or .return when the delegate iterator has no .throw
	      // method always terminates the yield* loop.
	      context.delegate = null;

	      if (context.method === "throw") {
	        // Note: ["return"] must be used for ES3 parsing compatibility.
	        if (delegate.iterator["return"]) {
	          // If the delegate iterator has a return method, give it a
	          // chance to clean up.
	          context.method = "return";
	          context.arg = undefined$1;
	          maybeInvokeDelegate(delegate, context);

	          if (context.method === "throw") {
	            // If maybeInvokeDelegate(context) changed context.method from
	            // "return" to "throw", let that override the TypeError below.
	            return ContinueSentinel;
	          }
	        }

	        context.method = "throw";
	        context.arg = new TypeError(
	          "The iterator does not provide a 'throw' method");
	      }

	      return ContinueSentinel;
	    }

	    var record = tryCatch(method, delegate.iterator, context.arg);

	    if (record.type === "throw") {
	      context.method = "throw";
	      context.arg = record.arg;
	      context.delegate = null;
	      return ContinueSentinel;
	    }

	    var info = record.arg;

	    if (! info) {
	      context.method = "throw";
	      context.arg = new TypeError("iterator result is not an object");
	      context.delegate = null;
	      return ContinueSentinel;
	    }

	    if (info.done) {
	      // Assign the result of the finished delegate to the temporary
	      // variable specified by delegate.resultName (see delegateYield).
	      context[delegate.resultName] = info.value;

	      // Resume execution at the desired location (see delegateYield).
	      context.next = delegate.nextLoc;

	      // If context.method was "throw" but the delegate handled the
	      // exception, let the outer generator proceed normally. If
	      // context.method was "next", forget context.arg since it has been
	      // "consumed" by the delegate iterator. If context.method was
	      // "return", allow the original .return call to continue in the
	      // outer generator.
	      if (context.method !== "return") {
	        context.method = "next";
	        context.arg = undefined$1;
	      }

	    } else {
	      // Re-yield the result returned by the delegate method.
	      return info;
	    }

	    // The delegate iterator is finished, so forget it and continue with
	    // the outer generator.
	    context.delegate = null;
	    return ContinueSentinel;
	  }

	  // Define Generator.prototype.{next,throw,return} in terms of the
	  // unified ._invoke helper method.
	  defineIteratorMethods(Gp);

	  define(Gp, toStringTagSymbol, "Generator");

	  // A Generator should always return itself as the iterator object when the
	  // @@iterator function is called on it. Some browsers' implementations of the
	  // iterator prototype chain incorrectly implement this, causing the Generator
	  // object to not be returned from this call. This ensures that doesn't happen.
	  // See https://github.com/facebook/regenerator/issues/274 for more details.
	  Gp[iteratorSymbol] = function() {
	    return this;
	  };

	  Gp.toString = function() {
	    return "[object Generator]";
	  };

	  function pushTryEntry(locs) {
	    var entry = { tryLoc: locs[0] };

	    if (1 in locs) {
	      entry.catchLoc = locs[1];
	    }

	    if (2 in locs) {
	      entry.finallyLoc = locs[2];
	      entry.afterLoc = locs[3];
	    }

	    this.tryEntries.push(entry);
	  }

	  function resetTryEntry(entry) {
	    var record = entry.completion || {};
	    record.type = "normal";
	    delete record.arg;
	    entry.completion = record;
	  }

	  function Context(tryLocsList) {
	    // The root entry object (effectively a try statement without a catch
	    // or a finally block) gives us a place to store values thrown from
	    // locations where there is no enclosing try statement.
	    this.tryEntries = [{ tryLoc: "root" }];
	    tryLocsList.forEach(pushTryEntry, this);
	    this.reset(true);
	  }

	  exports.keys = function(object) {
	    var keys = [];
	    for (var key in object) {
	      keys.push(key);
	    }
	    keys.reverse();

	    // Rather than returning an object with a next method, we keep
	    // things simple and return the next function itself.
	    return function next() {
	      while (keys.length) {
	        var key = keys.pop();
	        if (key in object) {
	          next.value = key;
	          next.done = false;
	          return next;
	        }
	      }

	      // To avoid creating an additional object, we just hang the .value
	      // and .done properties off the next function object itself. This
	      // also ensures that the minifier will not anonymize the function.
	      next.done = true;
	      return next;
	    };
	  };

	  function values(iterable) {
	    if (iterable) {
	      var iteratorMethod = iterable[iteratorSymbol];
	      if (iteratorMethod) {
	        return iteratorMethod.call(iterable);
	      }

	      if (typeof iterable.next === "function") {
	        return iterable;
	      }

	      if (!isNaN(iterable.length)) {
	        var i = -1, next = function next() {
	          while (++i < iterable.length) {
	            if (hasOwn.call(iterable, i)) {
	              next.value = iterable[i];
	              next.done = false;
	              return next;
	            }
	          }

	          next.value = undefined$1;
	          next.done = true;

	          return next;
	        };

	        return next.next = next;
	      }
	    }

	    // Return an iterator with no values.
	    return { next: doneResult };
	  }
	  exports.values = values;

	  function doneResult() {
	    return { value: undefined$1, done: true };
	  }

	  Context.prototype = {
	    constructor: Context,

	    reset: function(skipTempReset) {
	      this.prev = 0;
	      this.next = 0;
	      // Resetting context._sent for legacy support of Babel's
	      // function.sent implementation.
	      this.sent = this._sent = undefined$1;
	      this.done = false;
	      this.delegate = null;

	      this.method = "next";
	      this.arg = undefined$1;

	      this.tryEntries.forEach(resetTryEntry);

	      if (!skipTempReset) {
	        for (var name in this) {
	          // Not sure about the optimal order of these conditions:
	          if (name.charAt(0) === "t" &&
	              hasOwn.call(this, name) &&
	              !isNaN(+name.slice(1))) {
	            this[name] = undefined$1;
	          }
	        }
	      }
	    },

	    stop: function() {
	      this.done = true;

	      var rootEntry = this.tryEntries[0];
	      var rootRecord = rootEntry.completion;
	      if (rootRecord.type === "throw") {
	        throw rootRecord.arg;
	      }

	      return this.rval;
	    },

	    dispatchException: function(exception) {
	      if (this.done) {
	        throw exception;
	      }

	      var context = this;
	      function handle(loc, caught) {
	        record.type = "throw";
	        record.arg = exception;
	        context.next = loc;

	        if (caught) {
	          // If the dispatched exception was caught by a catch block,
	          // then let that catch block handle the exception normally.
	          context.method = "next";
	          context.arg = undefined$1;
	        }

	        return !! caught;
	      }

	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        var record = entry.completion;

	        if (entry.tryLoc === "root") {
	          // Exception thrown outside of any try block that could handle
	          // it, so set the completion value of the entire function to
	          // throw the exception.
	          return handle("end");
	        }

	        if (entry.tryLoc <= this.prev) {
	          var hasCatch = hasOwn.call(entry, "catchLoc");
	          var hasFinally = hasOwn.call(entry, "finallyLoc");

	          if (hasCatch && hasFinally) {
	            if (this.prev < entry.catchLoc) {
	              return handle(entry.catchLoc, true);
	            } else if (this.prev < entry.finallyLoc) {
	              return handle(entry.finallyLoc);
	            }

	          } else if (hasCatch) {
	            if (this.prev < entry.catchLoc) {
	              return handle(entry.catchLoc, true);
	            }

	          } else if (hasFinally) {
	            if (this.prev < entry.finallyLoc) {
	              return handle(entry.finallyLoc);
	            }

	          } else {
	            throw new Error("try statement without catch or finally");
	          }
	        }
	      }
	    },

	    abrupt: function(type, arg) {
	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        if (entry.tryLoc <= this.prev &&
	            hasOwn.call(entry, "finallyLoc") &&
	            this.prev < entry.finallyLoc) {
	          var finallyEntry = entry;
	          break;
	        }
	      }

	      if (finallyEntry &&
	          (type === "break" ||
	           type === "continue") &&
	          finallyEntry.tryLoc <= arg &&
	          arg <= finallyEntry.finallyLoc) {
	        // Ignore the finally entry if control is not jumping to a
	        // location outside the try/catch block.
	        finallyEntry = null;
	      }

	      var record = finallyEntry ? finallyEntry.completion : {};
	      record.type = type;
	      record.arg = arg;

	      if (finallyEntry) {
	        this.method = "next";
	        this.next = finallyEntry.finallyLoc;
	        return ContinueSentinel;
	      }

	      return this.complete(record);
	    },

	    complete: function(record, afterLoc) {
	      if (record.type === "throw") {
	        throw record.arg;
	      }

	      if (record.type === "break" ||
	          record.type === "continue") {
	        this.next = record.arg;
	      } else if (record.type === "return") {
	        this.rval = this.arg = record.arg;
	        this.method = "return";
	        this.next = "end";
	      } else if (record.type === "normal" && afterLoc) {
	        this.next = afterLoc;
	      }

	      return ContinueSentinel;
	    },

	    finish: function(finallyLoc) {
	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        if (entry.finallyLoc === finallyLoc) {
	          this.complete(entry.completion, entry.afterLoc);
	          resetTryEntry(entry);
	          return ContinueSentinel;
	        }
	      }
	    },

	    "catch": function(tryLoc) {
	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        if (entry.tryLoc === tryLoc) {
	          var record = entry.completion;
	          if (record.type === "throw") {
	            var thrown = record.arg;
	            resetTryEntry(entry);
	          }
	          return thrown;
	        }
	      }

	      // The context.catch method must only be called with a location
	      // argument that corresponds to a known catch block.
	      throw new Error("illegal catch attempt");
	    },

	    delegateYield: function(iterable, resultName, nextLoc) {
	      this.delegate = {
	        iterator: values(iterable),
	        resultName: resultName,
	        nextLoc: nextLoc
	      };

	      if (this.method === "next") {
	        // Deliberately forget the last sent value so that we don't
	        // accidentally pass it on to the delegate.
	        this.arg = undefined$1;
	      }

	      return ContinueSentinel;
	    }
	  };

	  // Regardless of whether this script is executing as a CommonJS module
	  // or not, return the runtime object so that we can declare the variable
	  // regeneratorRuntime in the outer scope, which allows this module to be
	  // injected easily by `bin/regenerator --include-runtime script.js`.
	  return exports;

	}(
	  // If this script is executing as a CommonJS module, use module.exports
	  // as the regeneratorRuntime namespace. Otherwise create a new empty
	  // object. Either way, the resulting object will be used to initialize
	  // the regeneratorRuntime variable at the top of this file.
	   module.exports 
	));

	try {
	  regeneratorRuntime = runtime;
	} catch (accidentalStrictMode) {
	  // This module should not be running in strict mode, so the above
	  // assignment should always work unless something is misconfigured. Just
	  // in case runtime.js accidentally runs in strict mode, we can escape
	  // strict mode using a global Function call. This could conceivably fail
	  // if a Content Security Policy forbids using Function, but in that case
	  // the proper solution is to fix the accidental strict mode problem. If
	  // you've misconfigured your bundler to force strict mode and applied a
	  // CSP to forbid Function, and you're not willing to fix either of those
	  // problems, please detail your unique predicament in a GitHub issue.
	  Function("r", "regeneratorRuntime = r")(runtime);
	}
	});

	Element.prototype.matches||(Element.prototype.matches=Element.prototype.msMatchesSelector||Element.prototype.webkitMatchesSelector),window.Element&&!Element.prototype.closest&&(Element.prototype.closest=function(e){var t=this;do{if(t.matches(e))return t;t=t.parentElement||t.parentNode;}while(null!==t&&1===t.nodeType);return null});

	if (!Element.prototype.remove) {
	  Element.prototype.remove = function remove() {
	    this.parentNode.removeChild(this);
	  };
	}

	function _typeof(obj) {
	  "@babel/helpers - typeof";

	  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
	    _typeof = function (obj) {
	      return typeof obj;
	    };
	  } else {
	    _typeof = function (obj) {
	      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	    };
	  }

	  return _typeof(obj);
	}

	function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
	  try {
	    var info = gen[key](arg);
	    var value = info.value;
	  } catch (error) {
	    reject(error);
	    return;
	  }

	  if (info.done) {
	    resolve(value);
	  } else {
	    Promise.resolve(value).then(_next, _throw);
	  }
	}

	function _asyncToGenerator(fn) {
	  return function () {
	    var self = this,
	        args = arguments;
	    return new Promise(function (resolve, reject) {
	      var gen = fn.apply(self, args);

	      function _next(value) {
	        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
	      }

	      function _throw(err) {
	        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
	      }

	      _next(undefined);
	    });
	  };
	}

	function _classCallCheck(instance, Constructor) {
	  if (!(instance instanceof Constructor)) {
	    throw new TypeError("Cannot call a class as a function");
	  }
	}

	function _defineProperties(target, props) {
	  for (var i = 0; i < props.length; i++) {
	    var descriptor = props[i];
	    descriptor.enumerable = descriptor.enumerable || false;
	    descriptor.configurable = true;
	    if ("value" in descriptor) descriptor.writable = true;
	    Object.defineProperty(target, descriptor.key, descriptor);
	  }
	}

	function _createClass(Constructor, protoProps, staticProps) {
	  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
	  if (staticProps) _defineProperties(Constructor, staticProps);
	  return Constructor;
	}

	function _defineProperty(obj, key, value) {
	  if (key in obj) {
	    Object.defineProperty(obj, key, {
	      value: value,
	      enumerable: true,
	      configurable: true,
	      writable: true
	    });
	  } else {
	    obj[key] = value;
	  }

	  return obj;
	}

	function _inherits(subClass, superClass) {
	  if (typeof superClass !== "function" && superClass !== null) {
	    throw new TypeError("Super expression must either be null or a function");
	  }

	  subClass.prototype = Object.create(superClass && superClass.prototype, {
	    constructor: {
	      value: subClass,
	      writable: true,
	      configurable: true
	    }
	  });
	  if (superClass) _setPrototypeOf(subClass, superClass);
	}

	function _getPrototypeOf(o) {
	  _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
	    return o.__proto__ || Object.getPrototypeOf(o);
	  };
	  return _getPrototypeOf(o);
	}

	function _setPrototypeOf(o, p) {
	  _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
	    o.__proto__ = p;
	    return o;
	  };

	  return _setPrototypeOf(o, p);
	}

	function _isNativeReflectConstruct() {
	  if (typeof Reflect === "undefined" || !Reflect.construct) return false;
	  if (Reflect.construct.sham) return false;
	  if (typeof Proxy === "function") return true;

	  try {
	    Date.prototype.toString.call(Reflect.construct(Date, [], function () {}));
	    return true;
	  } catch (e) {
	    return false;
	  }
	}

	function _construct(Parent, args, Class) {
	  if (_isNativeReflectConstruct()) {
	    _construct = Reflect.construct;
	  } else {
	    _construct = function _construct(Parent, args, Class) {
	      var a = [null];
	      a.push.apply(a, args);
	      var Constructor = Function.bind.apply(Parent, a);
	      var instance = new Constructor();
	      if (Class) _setPrototypeOf(instance, Class.prototype);
	      return instance;
	    };
	  }

	  return _construct.apply(null, arguments);
	}

	function _isNativeFunction(fn) {
	  return Function.toString.call(fn).indexOf("[native code]") !== -1;
	}

	function _wrapNativeSuper(Class) {
	  var _cache = typeof Map === "function" ? new Map() : undefined;

	  _wrapNativeSuper = function _wrapNativeSuper(Class) {
	    if (Class === null || !_isNativeFunction(Class)) return Class;

	    if (typeof Class !== "function") {
	      throw new TypeError("Super expression must either be null or a function");
	    }

	    if (typeof _cache !== "undefined") {
	      if (_cache.has(Class)) return _cache.get(Class);

	      _cache.set(Class, Wrapper);
	    }

	    function Wrapper() {
	      return _construct(Class, arguments, _getPrototypeOf(this).constructor);
	    }

	    Wrapper.prototype = Object.create(Class.prototype, {
	      constructor: {
	        value: Wrapper,
	        enumerable: false,
	        writable: true,
	        configurable: true
	      }
	    });
	    return _setPrototypeOf(Wrapper, Class);
	  };

	  return _wrapNativeSuper(Class);
	}

	function _objectWithoutPropertiesLoose(source, excluded) {
	  if (source == null) return {};
	  var target = {};
	  var sourceKeys = Object.keys(source);
	  var key, i;

	  for (i = 0; i < sourceKeys.length; i++) {
	    key = sourceKeys[i];
	    if (excluded.indexOf(key) >= 0) continue;
	    target[key] = source[key];
	  }

	  return target;
	}

	function _objectWithoutProperties(source, excluded) {
	  if (source == null) return {};

	  var target = _objectWithoutPropertiesLoose(source, excluded);

	  var key, i;

	  if (Object.getOwnPropertySymbols) {
	    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

	    for (i = 0; i < sourceSymbolKeys.length; i++) {
	      key = sourceSymbolKeys[i];
	      if (excluded.indexOf(key) >= 0) continue;
	      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
	      target[key] = source[key];
	    }
	  }

	  return target;
	}

	function _assertThisInitialized(self) {
	  if (self === void 0) {
	    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	  }

	  return self;
	}

	function _possibleConstructorReturn(self, call) {
	  if (call && (typeof call === "object" || typeof call === "function")) {
	    return call;
	  }

	  return _assertThisInitialized(self);
	}

	function _createSuper(Derived) {
	  var hasNativeReflectConstruct = _isNativeReflectConstruct();

	  return function _createSuperInternal() {
	    var Super = _getPrototypeOf(Derived),
	        result;

	    if (hasNativeReflectConstruct) {
	      var NewTarget = _getPrototypeOf(this).constructor;

	      result = Reflect.construct(Super, arguments, NewTarget);
	    } else {
	      result = Super.apply(this, arguments);
	    }

	    return _possibleConstructorReturn(this, result);
	  };
	}

	function _superPropBase(object, property) {
	  while (!Object.prototype.hasOwnProperty.call(object, property)) {
	    object = _getPrototypeOf(object);
	    if (object === null) break;
	  }

	  return object;
	}

	function _get(target, property, receiver) {
	  if (typeof Reflect !== "undefined" && Reflect.get) {
	    _get = Reflect.get;
	  } else {
	    _get = function _get(target, property, receiver) {
	      var base = _superPropBase(target, property);

	      if (!base) return;
	      var desc = Object.getOwnPropertyDescriptor(base, property);

	      if (desc.get) {
	        return desc.get.call(receiver);
	      }

	      return desc.value;
	    };
	  }

	  return _get(target, property, receiver || target);
	}

	function _taggedTemplateLiteral(strings, raw) {
	  if (!raw) {
	    raw = strings.slice(0);
	  }

	  return Object.freeze(Object.defineProperties(strings, {
	    raw: {
	      value: Object.freeze(raw)
	    }
	  }));
	}

	function _slicedToArray(arr, i) {
	  return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
	}

	function _toConsumableArray(arr) {
	  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
	}

	function _arrayWithoutHoles(arr) {
	  if (Array.isArray(arr)) return _arrayLikeToArray(arr);
	}

	function _arrayWithHoles(arr) {
	  if (Array.isArray(arr)) return arr;
	}

	function _iterableToArray(iter) {
	  if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
	}

	function _iterableToArrayLimit(arr, i) {
	  if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return;
	  var _arr = [];
	  var _n = true;
	  var _d = false;
	  var _e = undefined;

	  try {
	    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
	      _arr.push(_s.value);

	      if (i && _arr.length === i) break;
	    }
	  } catch (err) {
	    _d = true;
	    _e = err;
	  } finally {
	    try {
	      if (!_n && _i["return"] != null) _i["return"]();
	    } finally {
	      if (_d) throw _e;
	    }
	  }

	  return _arr;
	}

	function _unsupportedIterableToArray(o, minLen) {
	  if (!o) return;
	  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
	  var n = Object.prototype.toString.call(o).slice(8, -1);
	  if (n === "Object" && o.constructor) n = o.constructor.name;
	  if (n === "Map" || n === "Set") return Array.from(o);
	  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
	}

	function _arrayLikeToArray(arr, len) {
	  if (len == null || len > arr.length) len = arr.length;

	  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

	  return arr2;
	}

	function _nonIterableSpread() {
	  throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}

	function _nonIterableRest() {
	  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}

	function _createForOfIteratorHelper(o, allowArrayLike) {
	  var it;

	  if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) {
	    if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
	      if (it) o = it;
	      var i = 0;

	      var F = function () {};

	      return {
	        s: F,
	        n: function () {
	          if (i >= o.length) return {
	            done: true
	          };
	          return {
	            done: false,
	            value: o[i++]
	          };
	        },
	        e: function (e) {
	          throw e;
	        },
	        f: F
	      };
	    }

	    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	  }

	  var normalCompletion = true,
	      didErr = false,
	      err;
	  return {
	    s: function () {
	      it = o[Symbol.iterator]();
	    },
	    n: function () {
	      var step = it.next();
	      normalCompletion = step.done;
	      return step;
	    },
	    e: function (e) {
	      didErr = true;
	      err = e;
	    },
	    f: function () {
	      try {
	        if (!normalCompletion && it.return != null) it.return();
	      } finally {
	        if (didErr) throw err;
	      }
	    }
	  };
	}

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var AbortError = /*#__PURE__*/function (_Error) {
	  _inherits(AbortError, _Error);

	  var _super = _createSuper(AbortError);

	  function AbortError() {
	    _classCallCheck(this, AbortError);

	    return _super.apply(this, arguments);
	  }

	  _createClass(AbortError, [{
	    key: "name",
	    get: function get() {
	      return "AbortError";
	    }
	  }]);

	  return AbortError;
	}( /*#__PURE__*/_wrapNativeSuper(Error));

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var HomeServerError = /*#__PURE__*/function (_Error) {
	  _inherits(HomeServerError, _Error);

	  var _super = _createSuper(HomeServerError);

	  function HomeServerError(method, url, body, status) {
	    var _this;

	    _classCallCheck(this, HomeServerError);

	    _this = _super.call(this, "".concat(body ? body.error : status, " on ").concat(method, " ").concat(url));
	    _this.errcode = body ? body.errcode : null;
	    _this.retry_after_ms = body ? body.retry_after_ms : 0;
	    _this.statusCode = status;
	    return _this;
	  }

	  _createClass(HomeServerError, [{
	    key: "name",
	    get: function get() {
	      return "HomeServerError";
	    }
	  }]);

	  return HomeServerError;
	}( /*#__PURE__*/_wrapNativeSuper(Error));
	var ConnectionError = /*#__PURE__*/function (_Error2) {
	  _inherits(ConnectionError, _Error2);

	  var _super2 = _createSuper(ConnectionError);

	  function ConnectionError(message, isTimeout) {
	    var _this2;

	    _classCallCheck(this, ConnectionError);

	    _this2 = _super2.call(this, message || "ConnectionError");
	    _this2.isTimeout = isTimeout;
	    return _this2;
	  }

	  _createClass(ConnectionError, [{
	    key: "name",
	    get: function get() {
	      return "ConnectionError";
	    }
	  }]);

	  return ConnectionError;
	}( /*#__PURE__*/_wrapNativeSuper(Error));

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>
	Copyright 2020 The Matrix.org Foundation C.I.C.

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	function abortOnTimeout(createTimeout, timeoutAmount, requestResult, responsePromise) {
	  var timeout = createTimeout(timeoutAmount); // abort request if timeout finishes first

	  var timedOut = false;
	  timeout.elapsed().then(function () {
	    timedOut = true;
	    requestResult.abort();
	  }, function () {} // ignore AbortError when timeout is aborted
	  ); // abort timeout if request finishes first

	  return responsePromise.then(function (response) {
	    timeout.abort();
	    return response;
	  }, function (err) {
	    timeout.abort(); // map error to TimeoutError

	    if (err instanceof AbortError && timedOut) {
	      throw new ConnectionError("Request timed out after ".concat(timeoutAmount, "ms"), true);
	    } else {
	      throw err;
	    }
	  });
	}

	var RequestResult = /*#__PURE__*/function () {
	  function RequestResult(promise, controller) {
	    var _this = this;

	    _classCallCheck(this, RequestResult);

	    if (!controller) {
	      var abortPromise = new Promise(function (_, reject) {
	        _this._controller = {
	          abort: function abort() {
	            var err = new Error("fetch request aborted");
	            err.name = "AbortError";
	            reject(err);
	          }
	        };
	      });
	      this.promise = Promise.race([promise, abortPromise]);
	    } else {
	      this.promise = promise;
	      this._controller = controller;
	    }
	  }

	  _createClass(RequestResult, [{
	    key: "abort",
	    value: function abort() {
	      this._controller.abort();
	    }
	  }, {
	    key: "response",
	    value: function response() {
	      return this.promise;
	    }
	  }]);

	  return RequestResult;
	}();

	function createFetchRequest(createTimeout) {
	  return function fetchRequest(url, options) {
	    var controller = typeof AbortController === "function" ? new AbortController() : null;

	    if (controller) {
	      options = Object.assign(options, {
	        signal: controller.signal
	      });
	    }

	    options = Object.assign(options, {
	      mode: "cors",
	      credentials: "omit",
	      referrer: "no-referrer",
	      cache: "no-cache"
	    });

	    if (options.headers) {
	      var headers = new Headers();

	      var _iterator = _createForOfIteratorHelper(options.headers.entries()),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var _step$value = _slicedToArray(_step.value, 2),
	              name = _step$value[0],
	              value = _step$value[1];

	          headers.append(name, value);
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }

	      options.headers = headers;
	    }

	    var promise = fetch(url, options).then( /*#__PURE__*/function () {
	      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(response) {
	        var status, body;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                status = response.status;
	                _context.next = 3;
	                return response.json();

	              case 3:
	                body = _context.sent;
	                return _context.abrupt("return", {
	                  status: status,
	                  body: body
	                });

	              case 5:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee);
	      }));

	      return function (_x) {
	        return _ref.apply(this, arguments);
	      };
	    }(), function (err) {
	      if (err.name === "AbortError") {
	        throw new AbortError();
	      } else if (err instanceof TypeError) {
	        // Network errors are reported as TypeErrors, see
	        // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Checking_that_the_fetch_was_successful
	        // this can either mean user is offline, server is offline, or a CORS error (server misconfiguration).
	        // 
	        // One could check navigator.onLine to rule out the first
	        // but the 2 latter ones are indistinguishable from javascript.
	        throw new ConnectionError("".concat(options.method, " ").concat(url, ": ").concat(err.message));
	      }

	      throw err;
	    });
	    var result = new RequestResult(promise, controller);

	    if (options.timeout) {
	      result.promise = abortOnTimeout(createTimeout, options.timeout, result, result.promise);
	    }

	    return result;
	  };
	}

	var RequestResult$1 = /*#__PURE__*/function () {
	  function RequestResult(promise, xhr) {
	    _classCallCheck(this, RequestResult);

	    this._promise = promise;
	    this._xhr = xhr;
	  }

	  _createClass(RequestResult, [{
	    key: "abort",
	    value: function abort() {
	      this._xhr.abort();
	    }
	  }, {
	    key: "response",
	    value: function response() {
	      return this._promise;
	    }
	  }]);

	  return RequestResult;
	}();

	function send(url, options) {
	  var xhr = new XMLHttpRequest();
	  xhr.open(options.method, url);

	  if (options.headers) {
	    var _iterator = _createForOfIteratorHelper(options.headers.entries()),
	        _step;

	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var _step$value = _slicedToArray(_step.value, 2),
	            name = _step$value[0],
	            value = _step$value[1];

	        xhr.setRequestHeader(name, value);
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }
	  }

	  if (options.timeout) {
	    xhr.timeout = options.timeout;
	  }

	  xhr.send(options.body || null);
	  return xhr;
	}

	function xhrAsPromise(xhr, method, url) {
	  return new Promise(function (resolve, reject) {
	    xhr.addEventListener("load", function () {
	      return resolve(xhr);
	    });
	    xhr.addEventListener("abort", function () {
	      return reject(new AbortError());
	    });
	    xhr.addEventListener("error", function () {
	      return reject(new ConnectionError("Error ".concat(method, " ").concat(url)));
	    });
	    xhr.addEventListener("timeout", function () {
	      return reject(new ConnectionError("Timeout ".concat(method, " ").concat(url), true));
	    });
	  });
	}

	function _addCacheBuster(urlStr) {
	  var random = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Math.random;

	  // XHR doesn't have a good way to disable cache,
	  // so add a random query param
	  // see https://davidtranscend.com/blog/prevent-ie11-cache-ajax-requests/
	  if (urlStr.includes("?")) {
	    urlStr = urlStr + "&";
	  } else {
	    urlStr = urlStr + "?";
	  }

	  return urlStr + "_cacheBuster=".concat(Math.ceil(random() * Number.MAX_SAFE_INTEGER));
	}

	function xhrRequest(url, options) {
	  url = _addCacheBuster(url);
	  var xhr = send(url, options);
	  var promise = xhrAsPromise(xhr, options.method, url).then(function (xhr) {
	    var status = xhr.status;
	    var body = xhr.responseText;

	    if (xhr.getResponseHeader("Content-Type") === "application/json") {
	      body = JSON.parse(body);
	    }

	    return {
	      status: status,
	      body: body
	    };
	  });
	  return new RequestResult$1(promise, xhr);
	}

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	function createEnum() {
	  var obj = {};

	  for (var _len = arguments.length, values = new Array(_len), _key = 0; _key < _len; _key++) {
	    values[_key] = arguments[_key];
	  }

	  for (var _i = 0, _values = values; _i < _values.length; _i++) {
	    var value = _values[_i];
	    obj[value] = value;
	  }

	  return Object.freeze(obj);
	}

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var BaseObservable = /*#__PURE__*/function () {
	  function BaseObservable() {
	    _classCallCheck(this, BaseObservable);

	    this._handlers = new Set();
	  }

	  _createClass(BaseObservable, [{
	    key: "onSubscribeFirst",
	    value: function onSubscribeFirst() {}
	  }, {
	    key: "onUnsubscribeLast",
	    value: function onUnsubscribeLast() {}
	  }, {
	    key: "subscribe",
	    value: function subscribe(handler) {
	      var _this = this;

	      this._handlers.add(handler);

	      if (this._handlers.size === 1) {
	        this.onSubscribeFirst();
	      }

	      return function () {
	        return _this.unsubscribe(handler);
	      };
	    }
	  }, {
	    key: "unsubscribe",
	    value: function unsubscribe(handler) {
	      if (handler) {
	        this._handlers.delete(handler);

	        if (this._handlers.size === 0) {
	          this.onUnsubscribeLast();
	        }

	        handler = null;
	      }

	      return null;
	    } // Add iterator over handlers here

	  }]);

	  return BaseObservable;
	}();

	var BaseObservableValue = /*#__PURE__*/function (_BaseObservable) {
	  _inherits(BaseObservableValue, _BaseObservable);

	  var _super = _createSuper(BaseObservableValue);

	  function BaseObservableValue() {
	    _classCallCheck(this, BaseObservableValue);

	    return _super.apply(this, arguments);
	  }

	  _createClass(BaseObservableValue, [{
	    key: "emit",
	    value: function emit(argument) {
	      var _iterator = _createForOfIteratorHelper(this._handlers),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var h = _step.value;
	          h(argument);
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }
	    }
	  }]);

	  return BaseObservableValue;
	}(BaseObservable);

	var WaitForHandle = /*#__PURE__*/function () {
	  function WaitForHandle(observable, predicate) {
	    var _this = this;

	    _classCallCheck(this, WaitForHandle);

	    this._promise = new Promise(function (resolve, reject) {
	      _this._reject = reject;
	      _this._subscription = observable.subscribe(function (v) {
	        if (predicate(v)) {
	          _this._reject = null;
	          resolve(v);

	          _this.dispose();
	        }
	      });
	    });
	  }

	  _createClass(WaitForHandle, [{
	    key: "dispose",
	    value: function dispose() {
	      if (this._subscription) {
	        this._subscription();

	        this._subscription = null;
	      }

	      if (this._reject) {
	        this._reject(new AbortError());

	        this._reject = null;
	      }
	    }
	  }, {
	    key: "promise",
	    get: function get() {
	      return this._promise;
	    }
	  }]);

	  return WaitForHandle;
	}();

	var ResolvedWaitForHandle = /*#__PURE__*/function () {
	  function ResolvedWaitForHandle(promise) {
	    _classCallCheck(this, ResolvedWaitForHandle);

	    this.promise = promise;
	  }

	  _createClass(ResolvedWaitForHandle, [{
	    key: "dispose",
	    value: function dispose() {}
	  }]);

	  return ResolvedWaitForHandle;
	}();

	var ObservableValue = /*#__PURE__*/function (_BaseObservableValue) {
	  _inherits(ObservableValue, _BaseObservableValue);

	  var _super2 = _createSuper(ObservableValue);

	  function ObservableValue(initialValue) {
	    var _this2;

	    _classCallCheck(this, ObservableValue);

	    _this2 = _super2.call(this);
	    _this2._value = initialValue;
	    return _this2;
	  }

	  _createClass(ObservableValue, [{
	    key: "get",
	    value: function get() {
	      return this._value;
	    }
	  }, {
	    key: "set",
	    value: function set(value) {
	      if (value !== this._value) {
	        this._value = value;
	        this.emit(this._value);
	      }
	    }
	  }, {
	    key: "waitFor",
	    value: function waitFor(predicate) {
	      if (predicate(this.get())) {
	        return new ResolvedWaitForHandle(Promise.resolve(this.get()));
	      } else {
	        return new WaitForHandle(this, predicate);
	      }
	    }
	  }]);

	  return ObservableValue;
	}(BaseObservableValue);

	var RequestWrapper = /*#__PURE__*/function () {
	  function RequestWrapper(method, url, requestResult) {
	    _classCallCheck(this, RequestWrapper);

	    this._requestResult = requestResult;
	    this._promise = requestResult.response().then(function (response) {
	      // ok?
	      if (response.status >= 200 && response.status < 300) {
	        return response.body;
	      } else {
	        switch (response.status) {
	          default:
	            throw new HomeServerError(method, url, response.body, response.status);
	        }
	      }
	    });
	  }

	  _createClass(RequestWrapper, [{
	    key: "abort",
	    value: function abort() {
	      return this._requestResult.abort();
	    }
	  }, {
	    key: "response",
	    value: function response() {
	      return this._promise;
	    }
	  }]);

	  return RequestWrapper;
	}();

	var HomeServerApi = /*#__PURE__*/function () {
	  function HomeServerApi(_ref) {
	    var homeServer = _ref.homeServer,
	        accessToken = _ref.accessToken,
	        request = _ref.request,
	        createTimeout = _ref.createTimeout,
	        reconnector = _ref.reconnector;

	    _classCallCheck(this, HomeServerApi);

	    // store these both in a closure somehow so it's harder to get at in case of XSS?
	    // one could change the homeserver as well so the token gets sent there, so both must be protected from read/write
	    this._homeserver = homeServer;
	    this._accessToken = accessToken;
	    this._requestFn = request;
	    this._createTimeout = createTimeout;
	    this._reconnector = reconnector;
	  }

	  _createClass(HomeServerApi, [{
	    key: "_url",
	    value: function _url(csPath) {
	      return "".concat(this._homeserver, "/_matrix/client/r0").concat(csPath);
	    }
	  }, {
	    key: "_encodeQueryParams",
	    value: function _encodeQueryParams(queryParams) {
	      return Object.entries(queryParams || {}).filter(function (_ref2) {
	        var _ref3 = _slicedToArray(_ref2, 2),
	            value = _ref3[1];

	        return value !== undefined;
	      }).map(function (_ref4) {
	        var _ref5 = _slicedToArray(_ref4, 2),
	            name = _ref5[0],
	            value = _ref5[1];

	        if (_typeof(value) === "object") {
	          value = JSON.stringify(value);
	        }

	        return "".concat(encodeURIComponent(name), "=").concat(encodeURIComponent(value));
	      }).join("&");
	    }
	  }, {
	    key: "_request",
	    value: function _request(method, url, queryParams, body, options) {
	      var _this = this;

	      var queryString = this._encodeQueryParams(queryParams);

	      url = "".concat(url, "?").concat(queryString);
	      var bodyString;
	      var headers = new Map();

	      if (this._accessToken) {
	        headers.set("Authorization", "Bearer ".concat(this._accessToken));
	      }

	      headers.set("Accept", "application/json");

	      if (body) {
	        headers.set("Content-Type", "application/json");
	        bodyString = JSON.stringify(body);
	      }

	      var requestResult = this._requestFn(url, {
	        method: method,
	        headers: headers,
	        body: bodyString,
	        timeout: options && options.timeout
	      });

	      var wrapper = new RequestWrapper(method, url, requestResult);

	      if (this._reconnector) {
	        wrapper.response().catch(function (err) {
	          if (err.name === "ConnectionError") {
	            _this._reconnector.onRequestFailed(_this);
	          }
	        });
	      }

	      return wrapper;
	    }
	  }, {
	    key: "_post",
	    value: function _post(csPath, queryParams, body, options) {
	      return this._request("POST", this._url(csPath), queryParams, body, options);
	    }
	  }, {
	    key: "_put",
	    value: function _put(csPath, queryParams, body, options) {
	      return this._request("PUT", this._url(csPath), queryParams, body, options);
	    }
	  }, {
	    key: "_get",
	    value: function _get(csPath, queryParams, body, options) {
	      return this._request("GET", this._url(csPath), queryParams, body, options);
	    }
	  }, {
	    key: "sync",
	    value: function sync(since, filter, timeout) {
	      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
	      return this._get("/sync", {
	        since: since,
	        timeout: timeout,
	        filter: filter
	      }, null, options);
	    } // params is from, dir and optionally to, limit, filter.

	  }, {
	    key: "messages",
	    value: function messages(roomId, params) {
	      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
	      return this._get("/rooms/".concat(encodeURIComponent(roomId), "/messages"), params, null, options);
	    }
	  }, {
	    key: "send",
	    value: function send(roomId, eventType, txnId, content) {
	      var options = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;
	      return this._put("/rooms/".concat(encodeURIComponent(roomId), "/send/").concat(encodeURIComponent(eventType), "/").concat(encodeURIComponent(txnId)), {}, content, options);
	    }
	  }, {
	    key: "passwordLogin",
	    value: function passwordLogin(username, password) {
	      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
	      return this._post("/login", null, {
	        "type": "m.login.password",
	        "identifier": {
	          "type": "m.id.user",
	          "user": username
	        },
	        "password": password
	      }, options);
	    }
	  }, {
	    key: "createFilter",
	    value: function createFilter(userId, filter) {
	      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
	      return this._post("/user/".concat(encodeURIComponent(userId), "/filter"), null, filter, options);
	    }
	  }, {
	    key: "versions",
	    value: function versions() {
	      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
	      return this._request("GET", "".concat(this._homeserver, "/_matrix/client/versions"), null, null, options);
	    }
	  }, {
	    key: "_parseMxcUrl",
	    value: function _parseMxcUrl(url) {
	      var prefix = "mxc://";

	      if (url.startsWith(prefix)) {
	        return url.substr(prefix.length).split("/", 2);
	      } else {
	        return null;
	      }
	    }
	  }, {
	    key: "mxcUrlThumbnail",
	    value: function mxcUrlThumbnail(url, width, height, method) {
	      var parts = this._parseMxcUrl(url);

	      if (parts) {
	        var _parts = _slicedToArray(parts, 2),
	            serverName = _parts[0],
	            mediaId = _parts[1];

	        var httpUrl = "".concat(this._homeserver, "/_matrix/media/r0/thumbnail/").concat(encodeURIComponent(serverName), "/").concat(encodeURIComponent(mediaId));
	        return httpUrl + "?" + this._encodeQueryParams({
	          width: width,
	          height: height,
	          method: method
	        });
	      }

	      return null;
	    }
	  }, {
	    key: "mxcUrl",
	    value: function mxcUrl(url) {
	      var parts = this._parseMxcUrl(url);

	      if (parts) {
	        var _parts2 = _slicedToArray(parts, 2),
	            serverName = _parts2[0],
	            mediaId = _parts2[1];

	        return "".concat(this._homeserver, "/_matrix/media/r0/download/").concat(encodeURIComponent(serverName), "/").concat(encodeURIComponent(mediaId));
	      } else {
	        return null;
	      }
	    }
	  }]);

	  return HomeServerApi;
	}();

	var ExponentialRetryDelay = /*#__PURE__*/function () {
	  function ExponentialRetryDelay(createTimeout) {
	    _classCallCheck(this, ExponentialRetryDelay);

	    var start = 2000;
	    this._start = start;
	    this._current = start;
	    this._createTimeout = createTimeout;
	    this._max = 60 * 5 * 1000; //5 min

	    this._timeout = null;
	  }

	  _createClass(ExponentialRetryDelay, [{
	    key: "waitForRetry",
	    value: function () {
	      var _waitForRetry = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        var next;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                this._timeout = this._createTimeout(this._current);
	                _context.prev = 1;
	                _context.next = 4;
	                return this._timeout.elapsed();

	              case 4:
	                // only increase delay if we didn't get interrupted
	                next = 2 * this._current;
	                this._current = Math.min(this._max, next);
	                _context.next = 12;
	                break;

	              case 8:
	                _context.prev = 8;
	                _context.t0 = _context["catch"](1);

	                if (_context.t0 instanceof AbortError) {
	                  _context.next = 12;
	                  break;
	                }

	                throw _context.t0;

	              case 12:
	                _context.prev = 12;
	                this._timeout = null;
	                return _context.finish(12);

	              case 15:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this, [[1, 8, 12, 15]]);
	      }));

	      function waitForRetry() {
	        return _waitForRetry.apply(this, arguments);
	      }

	      return waitForRetry;
	    }()
	  }, {
	    key: "abort",
	    value: function abort() {
	      if (this._timeout) {
	        this._timeout.abort();
	      }
	    }
	  }, {
	    key: "reset",
	    value: function reset() {
	      this._current = this._start;
	      this.abort();
	    }
	  }, {
	    key: "nextValue",
	    get: function get() {
	      return this._current;
	    }
	  }]);

	  return ExponentialRetryDelay;
	}();

	var ConnectionStatus = createEnum("Waiting", "Reconnecting", "Online");
	var Reconnector = /*#__PURE__*/function () {
	  function Reconnector(_ref) {
	    var retryDelay = _ref.retryDelay,
	        createMeasure = _ref.createMeasure,
	        onlineStatus = _ref.onlineStatus;

	    _classCallCheck(this, Reconnector);

	    this._onlineStatus = onlineStatus;
	    this._retryDelay = retryDelay;
	    this._createTimeMeasure = createMeasure; // assume online, and do our thing when something fails

	    this._state = new ObservableValue(ConnectionStatus.Online);
	    this._isReconnecting = false;
	    this._versionsResponse = null;
	  }

	  _createClass(Reconnector, [{
	    key: "onRequestFailed",
	    value: function () {
	      var _onRequestFailed = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(hsApi) {
	        var _this = this;

	        var onlineStatusSubscription;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                if (this._isReconnecting) {
	                  _context.next = 15;
	                  break;
	                }

	                this._isReconnecting = true;
	                onlineStatusSubscription = this._onlineStatus && this._onlineStatus.subscribe(function (online) {
	                  if (online) {
	                    _this.tryNow();
	                  }
	                });
	                _context.prev = 3;
	                _context.next = 6;
	                return this._reconnectLoop(hsApi);

	              case 6:
	                _context.next = 11;
	                break;

	              case 8:
	                _context.prev = 8;
	                _context.t0 = _context["catch"](3);
	                // nothing is catching the error above us,
	                // so just log here
	                console.error(_context.t0);

	              case 11:
	                _context.prev = 11;

	                if (onlineStatusSubscription) {
	                  // unsubscribe from this._onlineStatus
	                  onlineStatusSubscription();
	                }

	                this._isReconnecting = false;
	                return _context.finish(11);

	              case 15:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this, [[3, 8, 11, 15]]);
	      }));

	      function onRequestFailed(_x) {
	        return _onRequestFailed.apply(this, arguments);
	      }

	      return onRequestFailed;
	    }()
	  }, {
	    key: "tryNow",
	    value: function tryNow() {
	      if (this._retryDelay) {
	        // this will interrupt this._retryDelay.waitForRetry() in _reconnectLoop
	        this._retryDelay.abort();
	      }
	    }
	  }, {
	    key: "_setState",
	    value: function _setState(state) {
	      if (state !== this._state.get()) {
	        if (state === ConnectionStatus.Waiting) {
	          this._stateSince = this._createTimeMeasure();
	        } else {
	          this._stateSince = null;
	        }

	        this._state.set(state);
	      }
	    }
	  }, {
	    key: "_reconnectLoop",
	    value: function () {
	      var _reconnectLoop2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(hsApi) {
	        var versionsRequest;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                this._versionsResponse = null;

	                this._retryDelay.reset();

	              case 2:
	                if (this._versionsResponse) {
	                  _context2.next = 23;
	                  break;
	                }

	                _context2.prev = 3;

	                this._setState(ConnectionStatus.Reconnecting); // use 30s timeout, as a tradeoff between not giving up
	                // too quickly on a slow server, and not waiting for
	                // a stale connection when we just came online again


	                versionsRequest = hsApi.versions({
	                  timeout: 30000
	                });
	                _context2.next = 8;
	                return versionsRequest.response();

	              case 8:
	                this._versionsResponse = _context2.sent;

	                this._setState(ConnectionStatus.Online);

	                _context2.next = 21;
	                break;

	              case 12:
	                _context2.prev = 12;
	                _context2.t0 = _context2["catch"](3);

	                if (!(_context2.t0.name === "ConnectionError")) {
	                  _context2.next = 20;
	                  break;
	                }

	                this._setState(ConnectionStatus.Waiting);

	                _context2.next = 18;
	                return this._retryDelay.waitForRetry();

	              case 18:
	                _context2.next = 21;
	                break;

	              case 20:
	                throw _context2.t0;

	              case 21:
	                _context2.next = 2;
	                break;

	              case 23:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this, [[3, 12]]);
	      }));

	      function _reconnectLoop(_x2) {
	        return _reconnectLoop2.apply(this, arguments);
	      }

	      return _reconnectLoop;
	    }()
	  }, {
	    key: "lastVersionsResponse",
	    get: function get() {
	      return this._versionsResponse;
	    }
	  }, {
	    key: "connectionStatus",
	    get: function get() {
	      return this._state;
	    }
	  }, {
	    key: "retryIn",
	    get: function get() {
	      if (this._state.get() === ConnectionStatus.Waiting) {
	        return this._retryDelay.nextValue - this._stateSince.measure();
	      }

	      return 0;
	    }
	  }]);

	  return Reconnector;
	}();

	var INCREMENTAL_TIMEOUT = 30000;
	var SyncStatus = createEnum("InitialSync", "CatchupSync", "Syncing", "Stopped");

	function parseRooms(roomsSection, roomCallback) {
	  if (roomsSection) {
	    var allMemberships = ["join", "invite", "leave"];

	    var _loop = function _loop() {
	      var membership = _allMemberships[_i];
	      var membershipSection = roomsSection[membership];

	      if (membershipSection) {
	        return {
	          v: Object.entries(membershipSection).map(function (_ref) {
	            var _ref2 = _slicedToArray(_ref, 2),
	                roomId = _ref2[0],
	                roomResponse = _ref2[1];

	            return roomCallback(roomId, roomResponse, membership);
	          })
	        };
	      }
	    };

	    for (var _i = 0, _allMemberships = allMemberships; _i < _allMemberships.length; _i++) {
	      var _ret = _loop();

	      if (_typeof(_ret) === "object") return _ret.v;
	    }
	  }

	  return [];
	}

	var Sync = /*#__PURE__*/function () {
	  function Sync(_ref3) {
	    var hsApi = _ref3.hsApi,
	        session = _ref3.session,
	        storage = _ref3.storage;

	    _classCallCheck(this, Sync);

	    this._hsApi = hsApi;
	    this._session = session;
	    this._storage = storage;
	    this._currentRequest = null;
	    this._status = new ObservableValue(SyncStatus.Stopped);
	    this._error = null;
	  }

	  _createClass(Sync, [{
	    key: "start",
	    value: function start() {
	      // not already syncing?
	      if (this._status.get() !== SyncStatus.Stopped) {
	        return;
	      }

	      var syncToken = this._session.syncToken;

	      if (syncToken) {
	        this._status.set(SyncStatus.CatchupSync);
	      } else {
	        this._status.set(SyncStatus.InitialSync);
	      }

	      this._syncLoop(syncToken);
	    }
	  }, {
	    key: "_syncLoop",
	    value: function () {
	      var _syncLoop2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(syncToken) {
	        var timeout;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                if (!(this._status.get() !== SyncStatus.Stopped)) {
	                  _context.next = 15;
	                  break;
	                }

	                _context.prev = 1;
	                console.log("starting sync request with since ".concat(syncToken, " ..."));
	                timeout = syncToken ? INCREMENTAL_TIMEOUT : undefined;
	                _context.next = 6;
	                return this._syncRequest(syncToken, timeout);

	              case 6:
	                syncToken = _context.sent;

	                this._status.set(SyncStatus.Syncing);

	                _context.next = 13;
	                break;

	              case 10:
	                _context.prev = 10;
	                _context.t0 = _context["catch"](1);

	                if (!(_context.t0 instanceof AbortError)) {
	                  this._error = _context.t0;

	                  this._status.set(SyncStatus.Stopped);
	                }

	              case 13:
	                _context.next = 0;
	                break;

	              case 15:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this, [[1, 10]]);
	      }));

	      function _syncLoop(_x) {
	        return _syncLoop2.apply(this, arguments);
	      }

	      return _syncLoop;
	    }()
	  }, {
	    key: "_syncRequest",
	    value: function () {
	      var _syncRequest2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(syncToken, timeout) {
	        var _this = this;

	        var syncFilterId, totalRequestTimeout, response, storeNames, syncTxn, roomChanges, sessionChanges, promises, _i2, _roomChanges, _roomChanges$_i, room, changes;

	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                syncFilterId = this._session.syncFilterId;

	                if (!(typeof syncFilterId !== "string")) {
	                  _context3.next = 6;
	                  break;
	                }

	                this._currentRequest = this._hsApi.createFilter(this._session.user.id, {
	                  room: {
	                    state: {
	                      lazy_load_members: true
	                    }
	                  }
	                });
	                _context3.next = 5;
	                return this._currentRequest.response();

	              case 5:
	                syncFilterId = _context3.sent.filter_id;

	              case 6:
	                totalRequestTimeout = timeout + 80 * 1000; // same as riot-web, don't get stuck on wedged long requests

	                this._currentRequest = this._hsApi.sync(syncToken, syncFilterId, timeout, {
	                  timeout: totalRequestTimeout
	                });
	                _context3.next = 10;
	                return this._currentRequest.response();

	              case 10:
	                response = _context3.sent;
	                syncToken = response.next_batch;
	                storeNames = this._storage.storeNames;
	                _context3.next = 15;
	                return this._storage.readWriteTxn([storeNames.session, storeNames.roomSummary, storeNames.roomState, storeNames.timelineEvents, storeNames.timelineFragments, storeNames.pendingEvents]);

	              case 15:
	                syncTxn = _context3.sent;
	                roomChanges = [];
	                _context3.prev = 17;
	                sessionChanges = this._session.writeSync(syncToken, syncFilterId, response.account_data, syncTxn); // to_device
	                // presence

	                if (!response.rooms) {
	                  _context3.next = 23;
	                  break;
	                }

	                promises = parseRooms(response.rooms, /*#__PURE__*/function () {
	                  var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(roomId, roomResponse, membership) {
	                    var room, changes;
	                    return regeneratorRuntime.wrap(function _callee2$(_context2) {
	                      while (1) {
	                        switch (_context2.prev = _context2.next) {
	                          case 0:
	                            room = _this._session.rooms.get(roomId);

	                            if (!room) {
	                              room = _this._session.createRoom(roomId);
	                            }

	                            console.log(" * applying sync response to room ".concat(roomId, " ..."));
	                            _context2.next = 5;
	                            return room.writeSync(roomResponse, membership, syncTxn);

	                          case 5:
	                            changes = _context2.sent;
	                            roomChanges.push({
	                              room: room,
	                              changes: changes
	                            });

	                          case 7:
	                          case "end":
	                            return _context2.stop();
	                        }
	                      }
	                    }, _callee2);
	                  }));

	                  return function (_x4, _x5, _x6) {
	                    return _ref4.apply(this, arguments);
	                  };
	                }());
	                _context3.next = 23;
	                return Promise.all(promises);

	              case 23:
	                _context3.next = 30;
	                break;

	              case 25:
	                _context3.prev = 25;
	                _context3.t0 = _context3["catch"](17);
	                console.warn("aborting syncTxn because of error"); // avoid corrupting state by only
	                // storing the sync up till the point
	                // the exception occurred

	                syncTxn.abort();
	                throw _context3.t0;

	              case 30:
	                _context3.prev = 30;
	                _context3.next = 33;
	                return syncTxn.complete();

	              case 33:
	                console.info("syncTxn committed!!");
	                _context3.next = 40;
	                break;

	              case 36:
	                _context3.prev = 36;
	                _context3.t1 = _context3["catch"](30);
	                console.error("unable to commit sync tranaction");
	                throw _context3.t1;

	              case 40:
	                this._session.afterSync(sessionChanges); // emit room related events after txn has been closed


	                for (_i2 = 0, _roomChanges = roomChanges; _i2 < _roomChanges.length; _i2++) {
	                  _roomChanges$_i = _roomChanges[_i2], room = _roomChanges$_i.room, changes = _roomChanges$_i.changes;
	                  room.afterSync(changes);
	                }

	                return _context3.abrupt("return", syncToken);

	              case 43:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3, this, [[17, 25], [30, 36]]);
	      }));

	      function _syncRequest(_x2, _x3) {
	        return _syncRequest2.apply(this, arguments);
	      }

	      return _syncRequest;
	    }()
	  }, {
	    key: "stop",
	    value: function stop() {
	      if (this._status.get() === SyncStatus.Stopped) {
	        return;
	      }

	      this._status.set(SyncStatus.Stopped);

	      if (this._currentRequest) {
	        this._currentRequest.abort();

	        this._currentRequest = null;
	      }
	    }
	  }, {
	    key: "status",
	    get: function get() {
	      return this._status;
	    }
	    /** the error that made the sync stop */

	  }, {
	    key: "error",
	    get: function get() {
	      return this._error;
	    }
	  }]);

	  return Sync;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var EventEmitter = /*#__PURE__*/function () {
	  function EventEmitter() {
	    _classCallCheck(this, EventEmitter);

	    this._handlersByName = {};
	  }

	  _createClass(EventEmitter, [{
	    key: "emit",
	    value: function emit(name) {
	      var handlers = this._handlersByName[name];

	      if (handlers) {
	        for (var _len = arguments.length, values = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
	          values[_key - 1] = arguments[_key];
	        }

	        var _iterator = _createForOfIteratorHelper(handlers),
	            _step;

	        try {
	          for (_iterator.s(); !(_step = _iterator.n()).done;) {
	            var h = _step.value;
	            h.apply(void 0, values);
	          }
	        } catch (err) {
	          _iterator.e(err);
	        } finally {
	          _iterator.f();
	        }
	      }
	    }
	  }, {
	    key: "disposableOn",
	    value: function disposableOn(name, callback) {
	      var _this = this;

	      this.on(name, callback);
	      return function () {
	        _this.off(name, callback);
	      };
	    }
	  }, {
	    key: "on",
	    value: function on(name, callback) {
	      var handlers = this._handlersByName[name];

	      if (!handlers) {
	        this.onFirstSubscriptionAdded(name);
	        this._handlersByName[name] = handlers = new Set();
	      }

	      handlers.add(callback);
	    }
	  }, {
	    key: "off",
	    value: function off(name, callback) {
	      var handlers = this._handlersByName[name];

	      if (handlers) {
	        handlers.delete(callback);

	        if (handlers.length === 0) {
	          delete this._handlersByName[name];
	          this.onLastSubscriptionRemoved(name);
	        }
	      }
	    }
	  }, {
	    key: "onFirstSubscriptionAdded",
	    value: function onFirstSubscriptionAdded(name) {}
	  }, {
	    key: "onLastSubscriptionRemoved",
	    value: function onLastSubscriptionRemoved(name) {}
	  }]);

	  return EventEmitter;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	function applySyncResponse(data, roomResponse, membership) {
	  if (roomResponse.summary) {
	    data = updateSummary(data, roomResponse.summary);
	  }

	  if (membership !== data.membership) {
	    data = data.cloneIfNeeded();
	    data.membership = membership;
	  } // state comes before timeline


	  if (roomResponse.state) {
	    data = roomResponse.state.events.reduce(processEvent, data);
	  }

	  if (roomResponse.timeline) {
	    data = roomResponse.timeline.events.reduce(processEvent, data);
	  }

	  return data;
	}

	function processEvent(data, event) {
	  if (event.type === "m.room.encryption") {
	    if (!data.isEncrypted) {
	      data = data.cloneIfNeeded();
	      data.isEncrypted = true;
	    }
	  }

	  if (event.type === "m.room.name") {
	    var newName = event.content && event.content.name;

	    if (newName !== data.name) {
	      data = data.cloneIfNeeded();
	      data.name = newName;
	    }
	  } else if (event.type === "m.room.message") {
	    var content = event.content;
	    var body = content && content.body;
	    var msgtype = content && content.msgtype;

	    if (msgtype === "m.text") {
	      data = data.cloneIfNeeded();
	      data.lastMessageBody = body;
	    }
	  } else if (event.type === "m.room.canonical_alias") {
	    var _content = event.content;
	    data = data.cloneIfNeeded();
	    data.canonicalAlias = _content.alias;
	    data.altAliases = _content.alt_aliases;
	  }

	  return data;
	}

	function updateSummary(data, summary) {
	  var heroes = summary["m.heroes"];
	  var inviteCount = summary["m.joined_member_count"];
	  var joinCount = summary["m.invited_member_count"];

	  if (heroes) {
	    data = data.cloneIfNeeded();
	    data.heroes = heroes;
	  }

	  if (Number.isInteger(inviteCount)) {
	    data = data.cloneIfNeeded();
	    data.inviteCount = inviteCount;
	  }

	  if (Number.isInteger(joinCount)) {
	    data = data.cloneIfNeeded();
	    data.joinCount = joinCount;
	  }

	  return data;
	}

	var SummaryData = /*#__PURE__*/function () {
	  function SummaryData(copy, roomId) {
	    _classCallCheck(this, SummaryData);

	    this.roomId = copy ? copy.roomId : roomId;
	    this.name = copy ? copy.name : null;
	    this.lastMessageBody = copy ? copy.lastMessageBody : null;
	    this.unreadCount = copy ? copy.unreadCount : null;
	    this.mentionCount = copy ? copy.mentionCount : null;
	    this.isEncrypted = copy ? copy.isEncrypted : null;
	    this.isDirectMessage = copy ? copy.isDirectMessage : null;
	    this.membership = copy ? copy.membership : null;
	    this.inviteCount = copy ? copy.inviteCount : 0;
	    this.joinCount = copy ? copy.joinCount : 0;
	    this.heroes = copy ? copy.heroes : null;
	    this.canonicalAlias = copy ? copy.canonicalAlias : null;
	    this.altAliases = copy ? copy.altAliases : null;
	    this.cloned = copy ? true : false;
	  }

	  _createClass(SummaryData, [{
	    key: "cloneIfNeeded",
	    value: function cloneIfNeeded() {
	      if (this.cloned) {
	        return this;
	      } else {
	        return new SummaryData(this);
	      }
	    }
	  }, {
	    key: "serialize",
	    value: function serialize() {
	      var cloned = this.cloned,
	          serializedProps = _objectWithoutProperties(this, ["cloned"]);

	      return serializedProps;
	    }
	  }]);

	  return SummaryData;
	}();

	var RoomSummary = /*#__PURE__*/function () {
	  function RoomSummary(roomId) {
	    _classCallCheck(this, RoomSummary);

	    this._data = new SummaryData(null, roomId);
	  }

	  _createClass(RoomSummary, [{
	    key: "writeSync",
	    value: function writeSync(roomResponse, membership, txn) {
	      // clear cloned flag, so cloneIfNeeded makes a copy and
	      // this._data is not modified if any field is changed.
	      this._data.cloned = false;
	      var data = applySyncResponse(this._data, roomResponse, membership);

	      if (data !== this._data) {
	        // need to think here how we want to persist
	        // things like unread status (as read marker, or unread count)?
	        // we could very well load additional things in the load method
	        // ... the trade-off is between constantly writing the summary
	        // on every sync, or doing a bit of extra reading on load
	        // and have in-memory only variables for visualization
	        txn.roomSummary.set(data.serialize());
	        return data;
	      }
	    }
	  }, {
	    key: "afterSync",
	    value: function afterSync(data) {
	      this._data = data;
	    }
	  }, {
	    key: "load",
	    value: function () {
	      var _load = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(summary) {
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                this._data = new SummaryData(summary);

	              case 1:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function load(_x) {
	        return _load.apply(this, arguments);
	      }

	      return load;
	    }()
	  }, {
	    key: "name",
	    get: function get() {
	      if (this._data.name) {
	        return this._data.name;
	      }

	      if (this._data.canonicalAlias) {
	        return this._data.canonicalAlias;
	      }

	      if (Array.isArray(this._data.altAliases) && this._data.altAliases.length !== 0) {
	        return this._data.altAliases[0];
	      }

	      if (Array.isArray(this._data.heroes) && this._data.heroes.length !== 0) {
	        return this._data.heroes.join(", ");
	      }

	      return this._data.roomId;
	    }
	  }, {
	    key: "lastMessage",
	    get: function get() {
	      return this._data.lastMessageBody;
	    }
	  }, {
	    key: "inviteCount",
	    get: function get() {
	      return this._data.inviteCount;
	    }
	  }, {
	    key: "joinCount",
	    get: function get() {
	      return this._data.joinCount;
	    }
	  }]);

	  return RoomSummary;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var WebPlatform = {
	  get minStorageKey() {
	    // for indexeddb, we use unsigned 32 bit integers as keys
	    return 0;
	  },

	  get middleStorageKey() {
	    // for indexeddb, we use unsigned 32 bit integers as keys
	    return 0x7FFFFFFF;
	  },

	  get maxStorageKey() {
	    // for indexeddb, we use unsigned 32 bit integers as keys
	    return 0xFFFFFFFF;
	  },

	  delay: function delay(ms) {
	    return new Promise(function (resolve) {
	      return setTimeout(resolve, ms);
	    });
	  }
	};

	var EventKey = /*#__PURE__*/function () {
	  function EventKey(fragmentId, eventIndex) {
	    _classCallCheck(this, EventKey);

	    this.fragmentId = fragmentId;
	    this.eventIndex = eventIndex;
	  }

	  _createClass(EventKey, [{
	    key: "nextFragmentKey",
	    value: function nextFragmentKey() {
	      // could take MIN_EVENT_INDEX here if it can't be paged back
	      return new EventKey(this.fragmentId + 1, WebPlatform.middleStorageKey);
	    }
	  }, {
	    key: "nextKeyForDirection",
	    value: function nextKeyForDirection(direction) {
	      if (direction.isForward) {
	        return this.nextKey();
	      } else {
	        return this.previousKey();
	      }
	    }
	  }, {
	    key: "previousKey",
	    value: function previousKey() {
	      return new EventKey(this.fragmentId, this.eventIndex - 1);
	    }
	  }, {
	    key: "nextKey",
	    value: function nextKey() {
	      return new EventKey(this.fragmentId, this.eventIndex + 1);
	    }
	  }, {
	    key: "toString",
	    value: function toString() {
	      return "[".concat(this.fragmentId, "/").concat(this.eventIndex, "]");
	    }
	  }], [{
	    key: "defaultFragmentKey",
	    value: function defaultFragmentKey(fragmentId) {
	      return new EventKey(fragmentId, WebPlatform.middleStorageKey);
	    }
	  }, {
	    key: "maxKey",
	    get: function get() {
	      return new EventKey(WebPlatform.maxStorageKey, WebPlatform.maxStorageKey);
	    }
	  }, {
	    key: "minKey",
	    get: function get() {
	      return new EventKey(WebPlatform.minStorageKey, WebPlatform.minStorageKey);
	    }
	  }, {
	    key: "defaultLiveKey",
	    get: function get() {
	      return EventKey.defaultFragmentKey(WebPlatform.minStorageKey);
	    }
	  }]);

	  return EventKey;
	}();

	var PENDING_FRAGMENT_ID = Number.MAX_SAFE_INTEGER;
	var BaseEntry = /*#__PURE__*/function () {
	  function BaseEntry(fragmentIdComparer) {
	    _classCallCheck(this, BaseEntry);

	    this._fragmentIdComparer = fragmentIdComparer;
	  }

	  _createClass(BaseEntry, [{
	    key: "compare",
	    value: function compare(otherEntry) {
	      if (this.fragmentId === otherEntry.fragmentId) {
	        return this.entryIndex - otherEntry.entryIndex;
	      } else if (this.fragmentId === PENDING_FRAGMENT_ID) {
	        return 1;
	      } else if (otherEntry.fragmentId === PENDING_FRAGMENT_ID) {
	        return -1;
	      } else {
	        // This might throw if the relation of two fragments is unknown.
	        return this._fragmentIdComparer.compare(this.fragmentId, otherEntry.fragmentId);
	      }
	    }
	  }, {
	    key: "asEventKey",
	    value: function asEventKey() {
	      return new EventKey(this.fragmentId, this.entryIndex);
	    }
	  }, {
	    key: "fragmentId",
	    get: function get() {
	      throw new Error("unimplemented");
	    }
	  }, {
	    key: "entryIndex",
	    get: function get() {
	      throw new Error("unimplemented");
	    }
	  }]);

	  return BaseEntry;
	}();

	var EventEntry = /*#__PURE__*/function (_BaseEntry) {
	  _inherits(EventEntry, _BaseEntry);

	  var _super = _createSuper(EventEntry);

	  function EventEntry(eventEntry, fragmentIdComparer) {
	    var _this;

	    _classCallCheck(this, EventEntry);

	    _this = _super.call(this, fragmentIdComparer);
	    _this._eventEntry = eventEntry;
	    return _this;
	  }

	  _createClass(EventEntry, [{
	    key: "fragmentId",
	    get: function get() {
	      return this._eventEntry.fragmentId;
	    }
	  }, {
	    key: "entryIndex",
	    get: function get() {
	      return this._eventEntry.eventIndex;
	    }
	  }, {
	    key: "content",
	    get: function get() {
	      return this._eventEntry.event.content;
	    }
	  }, {
	    key: "prevContent",
	    get: function get() {
	      var unsigned = this._eventEntry.event.unsigned;
	      return unsigned && unsigned.prev_content;
	    }
	  }, {
	    key: "eventType",
	    get: function get() {
	      return this._eventEntry.event.type;
	    }
	  }, {
	    key: "stateKey",
	    get: function get() {
	      return this._eventEntry.event.state_key;
	    }
	  }, {
	    key: "sender",
	    get: function get() {
	      return this._eventEntry.event.sender;
	    }
	  }, {
	    key: "timestamp",
	    get: function get() {
	      return this._eventEntry.event.origin_server_ts;
	    }
	  }, {
	    key: "id",
	    get: function get() {
	      return this._eventEntry.event.event_id;
	    }
	  }]);

	  return EventEntry;
	}(BaseEntry);

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var Direction = /*#__PURE__*/function () {
	  function Direction(isForward) {
	    _classCallCheck(this, Direction);

	    this._isForward = isForward;
	  }

	  _createClass(Direction, [{
	    key: "asApiString",
	    value: function asApiString() {
	      return this.isForward ? "f" : "b";
	    }
	  }, {
	    key: "reverse",
	    value: function reverse() {
	      return this.isForward ? Direction.Backward : Direction.Forward;
	    }
	  }, {
	    key: "isForward",
	    get: function get() {
	      return this._isForward;
	    }
	  }, {
	    key: "isBackward",
	    get: function get() {
	      return !this.isForward;
	    }
	  }], [{
	    key: "Forward",
	    get: function get() {
	      return _forward;
	    }
	  }, {
	    key: "Backward",
	    get: function get() {
	      return _backward;
	    }
	  }]);

	  return Direction;
	}();

	var _forward = Object.freeze(new Direction(true));

	var _backward = Object.freeze(new Direction(false));

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	function isValidFragmentId(id) {
	  return typeof id === "number";
	}

	var FragmentBoundaryEntry = /*#__PURE__*/function (_BaseEntry) {
	  _inherits(FragmentBoundaryEntry, _BaseEntry);

	  var _super = _createSuper(FragmentBoundaryEntry);

	  function FragmentBoundaryEntry(fragment, isFragmentStart, fragmentIdComparer) {
	    var _this;

	    _classCallCheck(this, FragmentBoundaryEntry);

	    _this = _super.call(this, fragmentIdComparer);
	    _this._fragment = fragment; // TODO: should isFragmentStart be Direction instead of bool?

	    _this._isFragmentStart = isFragmentStart;
	    return _this;
	  }

	  _createClass(FragmentBoundaryEntry, [{
	    key: "withUpdatedFragment",
	    value: function withUpdatedFragment(fragment) {
	      return new FragmentBoundaryEntry(fragment, this._isFragmentStart, this._fragmentIdComparer);
	    }
	  }, {
	    key: "createNeighbourEntry",
	    value: function createNeighbourEntry(neighbour) {
	      return new FragmentBoundaryEntry(neighbour, !this._isFragmentStart, this._fragmentIdComparer);
	    }
	  }, {
	    key: "started",
	    get: function get() {
	      return this._isFragmentStart;
	    }
	  }, {
	    key: "hasEnded",
	    get: function get() {
	      return !this.started;
	    }
	  }, {
	    key: "fragment",
	    get: function get() {
	      return this._fragment;
	    }
	  }, {
	    key: "fragmentId",
	    get: function get() {
	      return this._fragment.id;
	    }
	  }, {
	    key: "entryIndex",
	    get: function get() {
	      if (this.started) {
	        return WebPlatform.minStorageKey;
	      } else {
	        return WebPlatform.maxStorageKey;
	      }
	    }
	  }, {
	    key: "isGap",
	    get: function get() {
	      return !!this.token;
	    }
	  }, {
	    key: "token",
	    get: function get() {
	      if (this.started) {
	        return this.fragment.previousToken;
	      } else {
	        return this.fragment.nextToken;
	      }
	    },
	    set: function set(token) {
	      if (this.started) {
	        this.fragment.previousToken = token;
	      } else {
	        this.fragment.nextToken = token;
	      }
	    }
	  }, {
	    key: "linkedFragmentId",
	    get: function get() {
	      if (this.started) {
	        return this.fragment.previousId;
	      } else {
	        return this.fragment.nextId;
	      }
	    },
	    set: function set(id) {
	      if (this.started) {
	        this.fragment.previousId = id;
	      } else {
	        this.fragment.nextId = id;
	      }
	    }
	  }, {
	    key: "hasLinkedFragment",
	    get: function get() {
	      return isValidFragmentId(this.linkedFragmentId);
	    }
	  }, {
	    key: "direction",
	    get: function get() {
	      if (this.started) {
	        return Direction.Backward;
	      } else {
	        return Direction.Forward;
	      }
	    }
	  }], [{
	    key: "start",
	    value: function start(fragment, fragmentIdComparer) {
	      return new FragmentBoundaryEntry(fragment, true, fragmentIdComparer);
	    }
	  }, {
	    key: "end",
	    value: function end(fragment, fragmentIdComparer) {
	      return new FragmentBoundaryEntry(fragment, false, fragmentIdComparer);
	    }
	  }]);

	  return FragmentBoundaryEntry;
	}(BaseEntry);

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	function createEventEntry(key, roomId, event) {
	  return {
	    fragmentId: key.fragmentId,
	    eventIndex: key.eventIndex,
	    roomId: roomId,
	    event: event
	  };
	}
	function directionalAppend(array, value, direction) {
	  if (direction.isForward) {
	    array.push(value);
	  } else {
	    array.unshift(value);
	  }
	}
	function directionalConcat(array, otherArray, direction) {
	  if (direction.isForward) {
	    return array.concat(otherArray);
	  } else {
	    return otherArray.concat(array);
	  }
	}

	// when first syncing the room

	function deduplicateEvents(events) {
	  var eventIds = new Set();
	  return events.filter(function (e) {
	    if (eventIds.has(e.event_id)) {
	      return false;
	    } else {
	      eventIds.add(e.event_id);
	      return true;
	    }
	  });
	}

	var SyncWriter = /*#__PURE__*/function () {
	  function SyncWriter(_ref) {
	    var roomId = _ref.roomId,
	        fragmentIdComparer = _ref.fragmentIdComparer;

	    _classCallCheck(this, SyncWriter);

	    this._roomId = roomId;
	    this._fragmentIdComparer = fragmentIdComparer;
	    this._lastLiveKey = null;
	  }

	  _createClass(SyncWriter, [{
	    key: "load",
	    value: function () {
	      var _load = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(txn) {
	        var liveFragment, _yield$txn$timelineEv, _yield$txn$timelineEv2, lastEvent;

	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _context.next = 2;
	                return txn.timelineFragments.liveFragment(this._roomId);

	              case 2:
	                liveFragment = _context.sent;

	                if (!liveFragment) {
	                  _context.next = 10;
	                  break;
	                }

	                _context.next = 6;
	                return txn.timelineEvents.lastEvents(this._roomId, liveFragment.id, 1);

	              case 6:
	                _yield$txn$timelineEv = _context.sent;
	                _yield$txn$timelineEv2 = _slicedToArray(_yield$txn$timelineEv, 1);
	                lastEvent = _yield$txn$timelineEv2[0];
	                // sorting and identifying (e.g. sort key and pk to insert) are a bit intertwined here
	                // we could split it up into a SortKey (only with compare) and
	                // a EventKey (no compare or fragment index) with nextkey methods and getters/setters for eventIndex/fragmentId
	                // we probably need to convert from one to the other though, so bother?
	                this._lastLiveKey = new EventKey(liveFragment.id, lastEvent.eventIndex);

	              case 10:
	                // if there is no live fragment, we don't create it here because load gets a readonly txn.
	                // this is on purpose, load shouldn't modify the store
	                console.log("room persister load", this._roomId, this._lastLiveKey && this._lastLiveKey.toString());

	              case 11:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function load(_x) {
	        return _load.apply(this, arguments);
	      }

	      return load;
	    }()
	  }, {
	    key: "_createLiveFragment",
	    value: function () {
	      var _createLiveFragment2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(txn, previousToken) {
	        var liveFragment, fragment;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                _context2.next = 2;
	                return txn.timelineFragments.liveFragment(this._roomId);

	              case 2:
	                liveFragment = _context2.sent;

	                if (liveFragment) {
	                  _context2.next = 11;
	                  break;
	                }

	                if (!previousToken) {
	                  previousToken = null;
	                }

	                fragment = {
	                  roomId: this._roomId,
	                  id: EventKey.defaultLiveKey.fragmentId,
	                  previousId: null,
	                  nextId: null,
	                  previousToken: previousToken,
	                  nextToken: null
	                };
	                txn.timelineFragments.add(fragment);

	                this._fragmentIdComparer.add(fragment);

	                return _context2.abrupt("return", fragment);

	              case 11:
	                return _context2.abrupt("return", liveFragment);

	              case 12:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this);
	      }));

	      function _createLiveFragment(_x2, _x3) {
	        return _createLiveFragment2.apply(this, arguments);
	      }

	      return _createLiveFragment;
	    }()
	  }, {
	    key: "_replaceLiveFragment",
	    value: function () {
	      var _replaceLiveFragment2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(oldFragmentId, newFragmentId, previousToken, txn) {
	        var oldFragment, newFragment;
	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                _context3.next = 2;
	                return txn.timelineFragments.get(this._roomId, oldFragmentId);

	              case 2:
	                oldFragment = _context3.sent;

	                if (oldFragment) {
	                  _context3.next = 5;
	                  break;
	                }

	                throw new Error("old live fragment doesn't exist: ".concat(oldFragmentId));

	              case 5:
	                oldFragment.nextId = newFragmentId;
	                txn.timelineFragments.update(oldFragment);
	                newFragment = {
	                  roomId: this._roomId,
	                  id: newFragmentId,
	                  previousId: oldFragmentId,
	                  nextId: null,
	                  previousToken: previousToken,
	                  nextToken: null
	                };
	                txn.timelineFragments.add(newFragment);

	                this._fragmentIdComparer.append(newFragmentId, oldFragmentId);

	                return _context3.abrupt("return", {
	                  oldFragment: oldFragment,
	                  newFragment: newFragment
	                });

	              case 11:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3, this);
	      }));

	      function _replaceLiveFragment(_x4, _x5, _x6, _x7) {
	        return _replaceLiveFragment2.apply(this, arguments);
	      }

	      return _replaceLiveFragment;
	    }()
	  }, {
	    key: "writeSync",
	    value: function () {
	      var _writeSync = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(roomResponse, txn) {
	        var entries, timeline, currentKey, liveFragment, oldFragmentId, _yield$this$_replaceL, oldFragment, newFragment, events, _iterator, _step, event, entry, state, _iterator2, _step2, _event, _iterator3, _step3, _event2;

	        return regeneratorRuntime.wrap(function _callee4$(_context4) {
	          while (1) {
	            switch (_context4.prev = _context4.next) {
	              case 0:
	                entries = [];
	                timeline = roomResponse.timeline;
	                currentKey = this._lastLiveKey;

	                if (currentKey) {
	                  _context4.next = 11;
	                  break;
	                }

	                _context4.next = 6;
	                return this._createLiveFragment(txn, timeline.prev_batch);

	              case 6:
	                liveFragment = _context4.sent;
	                currentKey = new EventKey(liveFragment.id, EventKey.defaultLiveKey.eventIndex);
	                entries.push(FragmentBoundaryEntry.start(liveFragment, this._fragmentIdComparer));
	                _context4.next = 21;
	                break;

	              case 11:
	                if (!timeline.limited) {
	                  _context4.next = 21;
	                  break;
	                }

	                // replace live fragment for limited sync, *only* if we had a live fragment already
	                oldFragmentId = currentKey.fragmentId;
	                currentKey = currentKey.nextFragmentKey();
	                _context4.next = 16;
	                return this._replaceLiveFragment(oldFragmentId, currentKey.fragmentId, timeline.prev_batch, txn);

	              case 16:
	                _yield$this$_replaceL = _context4.sent;
	                oldFragment = _yield$this$_replaceL.oldFragment;
	                newFragment = _yield$this$_replaceL.newFragment;
	                entries.push(FragmentBoundaryEntry.end(oldFragment, this._fragmentIdComparer));
	                entries.push(FragmentBoundaryEntry.start(newFragment, this._fragmentIdComparer));

	              case 21:
	                if (timeline.events) {
	                  events = deduplicateEvents(timeline.events);
	                  _iterator = _createForOfIteratorHelper(events);

	                  try {
	                    for (_iterator.s(); !(_step = _iterator.n()).done;) {
	                      event = _step.value;
	                      currentKey = currentKey.nextKey();
	                      entry = createEventEntry(currentKey, this._roomId, event);
	                      txn.timelineEvents.insert(entry);
	                      entries.push(new EventEntry(entry, this._fragmentIdComparer));
	                    }
	                  } catch (err) {
	                    _iterator.e(err);
	                  } finally {
	                    _iterator.f();
	                  }
	                } // persist state


	                state = roomResponse.state;

	                if (state.events) {
	                  _iterator2 = _createForOfIteratorHelper(state.events);

	                  try {
	                    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	                      _event = _step2.value;
	                      txn.roomState.setStateEvent(this._roomId, _event);
	                    }
	                  } catch (err) {
	                    _iterator2.e(err);
	                  } finally {
	                    _iterator2.f();
	                  }
	                } // persist live state events in timeline


	                if (timeline.events) {
	                  _iterator3 = _createForOfIteratorHelper(timeline.events);

	                  try {
	                    for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	                      _event2 = _step3.value;

	                      if (typeof _event2.state_key === "string") {
	                        txn.roomState.setStateEvent(this._roomId, _event2);
	                      }
	                    }
	                  } catch (err) {
	                    _iterator3.e(err);
	                  } finally {
	                    _iterator3.f();
	                  }
	                }

	                return _context4.abrupt("return", {
	                  entries: entries,
	                  newLiveKey: currentKey
	                });

	              case 26:
	              case "end":
	                return _context4.stop();
	            }
	          }
	        }, _callee4, this);
	      }));

	      function writeSync(_x8, _x9) {
	        return _writeSync.apply(this, arguments);
	      }

	      return writeSync;
	    }()
	  }, {
	    key: "afterSync",
	    value: function afterSync(newLiveKey) {
	      this._lastLiveKey = newLiveKey;
	    }
	  }]);

	  return SyncWriter;
	}(); //import MemoryStorage from "../storage/memory/MemoryStorage.js";

	var GapWriter = /*#__PURE__*/function () {
	  function GapWriter(_ref) {
	    var roomId = _ref.roomId,
	        storage = _ref.storage,
	        fragmentIdComparer = _ref.fragmentIdComparer;

	    _classCallCheck(this, GapWriter);

	    this._roomId = roomId;
	    this._storage = storage;
	    this._fragmentIdComparer = fragmentIdComparer;
	  } // events is in reverse-chronological order (last event comes at index 0) if backwards


	  _createClass(GapWriter, [{
	    key: "_findOverlappingEvents",
	    value: function () {
	      var _findOverlappingEvents2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(fragmentEntry, events, txn) {
	        var _this = this;

	        var expectedOverlappingEventId, remainingEvents, nonOverlappingEvents, neighbourFragmentEntry, _loop;

	        return regeneratorRuntime.wrap(function _callee$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                if (!fragmentEntry.hasLinkedFragment) {
	                  _context2.next = 4;
	                  break;
	                }

	                _context2.next = 3;
	                return this._findExpectedOverlappingEventId(fragmentEntry, txn);

	              case 3:
	                expectedOverlappingEventId = _context2.sent;

	              case 4:
	                remainingEvents = events;
	                nonOverlappingEvents = [];
	                _loop = /*#__PURE__*/regeneratorRuntime.mark(function _loop() {
	                  var eventIds, duplicateEventId, duplicateEventIndex, neighbourEvent, neighbourFragment;
	                  return regeneratorRuntime.wrap(function _loop$(_context) {
	                    while (1) {
	                      switch (_context.prev = _context.next) {
	                        case 0:
	                          eventIds = remainingEvents.map(function (e) {
	                            return e.event_id;
	                          });
	                          _context.next = 3;
	                          return txn.timelineEvents.findFirstOccurringEventId(_this._roomId, eventIds);

	                        case 3:
	                          duplicateEventId = _context.sent;

	                          if (!duplicateEventId) {
	                            _context.next = 23;
	                            break;
	                          }

	                          duplicateEventIndex = remainingEvents.findIndex(function (e) {
	                            return e.event_id === duplicateEventId;
	                          }); // should never happen, just being defensive as this *can't* go wrong

	                          if (!(duplicateEventIndex === -1)) {
	                            _context.next = 8;
	                            break;
	                          }

	                          throw new Error("findFirstOccurringEventId returned ".concat(duplicateEventIndex, " which wasn't ") + "in [".concat(eventIds.join(","), "] in ").concat(_this._roomId));

	                        case 8:
	                          nonOverlappingEvents.push.apply(nonOverlappingEvents, _toConsumableArray(remainingEvents.slice(0, duplicateEventIndex)));

	                          if (!(!expectedOverlappingEventId || duplicateEventId === expectedOverlappingEventId)) {
	                            _context.next = 20;
	                            break;
	                          }

	                          _context.next = 12;
	                          return txn.timelineEvents.getByEventId(_this._roomId, duplicateEventId);

	                        case 12:
	                          neighbourEvent = _context.sent;
	                          _context.next = 15;
	                          return txn.timelineFragments.get(_this._roomId, neighbourEvent.fragmentId);

	                        case 15:
	                          neighbourFragment = _context.sent;
	                          neighbourFragmentEntry = fragmentEntry.createNeighbourEntry(neighbourFragment); // trim overlapping events

	                          remainingEvents = null;
	                          _context.next = 21;
	                          break;

	                        case 20:
	                          // we've hit https://github.com/matrix-org/synapse/issues/7164, 
	                          // e.g. the event id we found is already in our store but it is not
	                          // the adjacent fragment id. Ignore the event, but keep processing the ones after.
	                          remainingEvents = remainingEvents.slice(duplicateEventIndex + 1);

	                        case 21:
	                          _context.next = 25;
	                          break;

	                        case 23:
	                          nonOverlappingEvents.push.apply(nonOverlappingEvents, _toConsumableArray(remainingEvents));
	                          remainingEvents = null;

	                        case 25:
	                        case "end":
	                          return _context.stop();
	                      }
	                    }
	                  }, _loop);
	                });

	              case 7:
	                if (!(remainingEvents && remainingEvents.length)) {
	                  _context2.next = 11;
	                  break;
	                }

	                return _context2.delegateYield(_loop(), "t0", 9);

	              case 9:
	                _context2.next = 7;
	                break;

	              case 11:
	                return _context2.abrupt("return", {
	                  nonOverlappingEvents: nonOverlappingEvents,
	                  neighbourFragmentEntry: neighbourFragmentEntry
	                });

	              case 12:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function _findOverlappingEvents(_x, _x2, _x3) {
	        return _findOverlappingEvents2.apply(this, arguments);
	      }

	      return _findOverlappingEvents;
	    }()
	  }, {
	    key: "_findExpectedOverlappingEventId",
	    value: function () {
	      var _findExpectedOverlappingEventId2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(fragmentEntry, txn) {
	        var eventEntry;
	        return regeneratorRuntime.wrap(function _callee2$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                _context3.next = 2;
	                return this._findFragmentEdgeEvent(fragmentEntry.linkedFragmentId, // reverse because it's the oppose edge of the linked fragment
	                fragmentEntry.direction.reverse(), txn);

	              case 2:
	                eventEntry = _context3.sent;

	                if (!eventEntry) {
	                  _context3.next = 5;
	                  break;
	                }

	                return _context3.abrupt("return", eventEntry.event.event_id);

	              case 5:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee2, this);
	      }));

	      function _findExpectedOverlappingEventId(_x4, _x5) {
	        return _findExpectedOverlappingEventId2.apply(this, arguments);
	      }

	      return _findExpectedOverlappingEventId;
	    }()
	  }, {
	    key: "_findFragmentEdgeEventKey",
	    value: function () {
	      var _findFragmentEdgeEventKey2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(fragmentEntry, txn) {
	        var fragmentId, direction, event;
	        return regeneratorRuntime.wrap(function _callee3$(_context4) {
	          while (1) {
	            switch (_context4.prev = _context4.next) {
	              case 0:
	                fragmentId = fragmentEntry.fragmentId, direction = fragmentEntry.direction;
	                _context4.next = 3;
	                return this._findFragmentEdgeEvent(fragmentId, direction, txn);

	              case 3:
	                event = _context4.sent;

	                if (!event) {
	                  _context4.next = 8;
	                  break;
	                }

	                return _context4.abrupt("return", new EventKey(event.fragmentId, event.eventIndex));

	              case 8:
	                return _context4.abrupt("return", EventKey.defaultFragmentKey(fragmentEntry.fragmentId));

	              case 9:
	              case "end":
	                return _context4.stop();
	            }
	          }
	        }, _callee3, this);
	      }));

	      function _findFragmentEdgeEventKey(_x6, _x7) {
	        return _findFragmentEdgeEventKey2.apply(this, arguments);
	      }

	      return _findFragmentEdgeEventKey;
	    }()
	  }, {
	    key: "_findFragmentEdgeEvent",
	    value: function () {
	      var _findFragmentEdgeEvent2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(fragmentId, direction, txn) {
	        var _yield$txn$timelineEv, _yield$txn$timelineEv2, firstEvent, _yield$txn$timelineEv3, _yield$txn$timelineEv4, lastEvent;

	        return regeneratorRuntime.wrap(function _callee4$(_context5) {
	          while (1) {
	            switch (_context5.prev = _context5.next) {
	              case 0:
	                if (!direction.isBackward) {
	                  _context5.next = 9;
	                  break;
	                }

	                _context5.next = 3;
	                return txn.timelineEvents.firstEvents(this._roomId, fragmentId, 1);

	              case 3:
	                _yield$txn$timelineEv = _context5.sent;
	                _yield$txn$timelineEv2 = _slicedToArray(_yield$txn$timelineEv, 1);
	                firstEvent = _yield$txn$timelineEv2[0];
	                return _context5.abrupt("return", firstEvent);

	              case 9:
	                _context5.next = 11;
	                return txn.timelineEvents.lastEvents(this._roomId, fragmentId, 1);

	              case 11:
	                _yield$txn$timelineEv3 = _context5.sent;
	                _yield$txn$timelineEv4 = _slicedToArray(_yield$txn$timelineEv3, 1);
	                lastEvent = _yield$txn$timelineEv4[0];
	                return _context5.abrupt("return", lastEvent);

	              case 15:
	              case "end":
	                return _context5.stop();
	            }
	          }
	        }, _callee4, this);
	      }));

	      function _findFragmentEdgeEvent(_x8, _x9, _x10) {
	        return _findFragmentEdgeEvent2.apply(this, arguments);
	      }

	      return _findFragmentEdgeEvent;
	    }()
	  }, {
	    key: "_storeEvents",
	    value: function _storeEvents(events, startKey, direction, txn) {
	      var entries = []; // events is in reverse chronological order for backwards pagination,
	      // e.g. order is moving away from the `from` point.

	      var key = startKey;

	      var _iterator = _createForOfIteratorHelper(events),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var event = _step.value;
	          key = key.nextKeyForDirection(direction);
	          var eventStorageEntry = createEventEntry(key, this._roomId, event);
	          txn.timelineEvents.insert(eventStorageEntry);
	          var eventEntry = new EventEntry(eventStorageEntry, this._fragmentIdComparer);
	          directionalAppend(entries, eventEntry, direction);
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }

	      return entries;
	    }
	  }, {
	    key: "_updateFragments",
	    value: function () {
	      var _updateFragments2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(fragmentEntry, neighbourFragmentEntry, end, entries, txn) {
	        var direction, changedFragments;
	        return regeneratorRuntime.wrap(function _callee5$(_context6) {
	          while (1) {
	            switch (_context6.prev = _context6.next) {
	              case 0:
	                direction = fragmentEntry.direction;
	                changedFragments = [];
	                directionalAppend(entries, fragmentEntry, direction); // set `end` as token, and if we found an event in the step before, link up the fragments in the fragment entry

	                if (!neighbourFragmentEntry) {
	                  _context6.next = 24;
	                  break;
	                }

	                if (fragmentEntry.hasLinkedFragment) {
	                  _context6.next = 8;
	                  break;
	                }

	                fragmentEntry.linkedFragmentId = neighbourFragmentEntry.fragmentId;
	                _context6.next = 10;
	                break;

	              case 8:
	                if (!(fragmentEntry.linkedFragmentId !== neighbourFragmentEntry.fragmentId)) {
	                  _context6.next = 10;
	                  break;
	                }

	                throw new Error("Prevented changing fragment ".concat(fragmentEntry.fragmentId, " ") + "".concat(fragmentEntry.direction.asApiString(), " link from ").concat(fragmentEntry.linkedFragmentId, " ") + "to ".concat(neighbourFragmentEntry.fragmentId, " in ").concat(this._roomId));

	              case 10:
	                if (neighbourFragmentEntry.hasLinkedFragment) {
	                  _context6.next = 14;
	                  break;
	                }

	                neighbourFragmentEntry.linkedFragmentId = fragmentEntry.fragmentId;
	                _context6.next = 16;
	                break;

	              case 14:
	                if (!(neighbourFragmentEntry.linkedFragmentId !== fragmentEntry.fragmentId)) {
	                  _context6.next = 16;
	                  break;
	                }

	                throw new Error("Prevented changing fragment ".concat(neighbourFragmentEntry.fragmentId, " ") + "".concat(neighbourFragmentEntry.direction.asApiString(), " link from ").concat(neighbourFragmentEntry.linkedFragmentId, " ") + "to ".concat(fragmentEntry.fragmentId, " in ").concat(this._roomId));

	              case 16:
	                // if neighbourFragmentEntry was found, it means the events were overlapping,
	                // so no pagination should happen anymore.
	                neighbourFragmentEntry.token = null;
	                fragmentEntry.token = null;
	                txn.timelineFragments.update(neighbourFragmentEntry.fragment);
	                directionalAppend(entries, neighbourFragmentEntry, direction); // fragments that need to be changed in the fragmentIdComparer here
	                // after txn succeeds

	                changedFragments.push(fragmentEntry.fragment);
	                changedFragments.push(neighbourFragmentEntry.fragment);
	                _context6.next = 25;
	                break;

	              case 24:
	                fragmentEntry.token = end;

	              case 25:
	                txn.timelineFragments.update(fragmentEntry.fragment);
	                return _context6.abrupt("return", changedFragments);

	              case 27:
	              case "end":
	                return _context6.stop();
	            }
	          }
	        }, _callee5, this);
	      }));

	      function _updateFragments(_x11, _x12, _x13, _x14, _x15) {
	        return _updateFragments2.apply(this, arguments);
	      }

	      return _updateFragments;
	    }()
	  }, {
	    key: "writeFragmentFill",
	    value: function () {
	      var _writeFragmentFill = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(fragmentEntry, response, txn) {
	        var _fragmentEntry, fragmentId, direction, chunk, start, end, entries, fragment, lastKey, _yield$this$_findOver, nonOverlappingEvents, neighbourFragmentEntry, fragments;

	        return regeneratorRuntime.wrap(function _callee6$(_context7) {
	          while (1) {
	            switch (_context7.prev = _context7.next) {
	              case 0:
	                _fragmentEntry = fragmentEntry, fragmentId = _fragmentEntry.fragmentId, direction = _fragmentEntry.direction; // chunk is in reverse-chronological order when backwards

	                chunk = response.chunk, start = response.start, end = response.end;

	                if (Array.isArray(chunk)) {
	                  _context7.next = 4;
	                  break;
	                }

	                throw new Error("Invalid chunk in response");

	              case 4:
	                if (!(typeof end !== "string")) {
	                  _context7.next = 6;
	                  break;
	                }

	                throw new Error("Invalid end token in response");

	              case 6:
	                _context7.next = 8;
	                return txn.timelineFragments.get(this._roomId, fragmentId);

	              case 8:
	                fragment = _context7.sent;

	                if (fragment) {
	                  _context7.next = 11;
	                  break;
	                }

	                throw new Error("Unknown fragment: ".concat(fragmentId));

	              case 11:
	                fragmentEntry = fragmentEntry.withUpdatedFragment(fragment); // check that the request was done with the token we are aware of (extra care to avoid timeline corruption)

	                if (!(fragmentEntry.token !== start)) {
	                  _context7.next = 14;
	                  break;
	                }

	                throw new Error("start is not equal to prev_batch or next_batch");

	              case 14:
	                _context7.next = 16;
	                return this._findFragmentEdgeEventKey(fragmentEntry, txn);

	              case 16:
	                lastKey = _context7.sent;
	                _context7.next = 19;
	                return this._findOverlappingEvents(fragmentEntry, chunk, txn);

	              case 19:
	                _yield$this$_findOver = _context7.sent;
	                nonOverlappingEvents = _yield$this$_findOver.nonOverlappingEvents;
	                neighbourFragmentEntry = _yield$this$_findOver.neighbourFragmentEntry;
	                // create entries for all events in chunk, add them to entries
	                entries = this._storeEvents(nonOverlappingEvents, lastKey, direction, txn);
	                _context7.next = 25;
	                return this._updateFragments(fragmentEntry, neighbourFragmentEntry, end, entries, txn);

	              case 25:
	                fragments = _context7.sent;
	                return _context7.abrupt("return", {
	                  entries: entries,
	                  fragments: fragments
	                });

	              case 27:
	              case "end":
	                return _context7.stop();
	            }
	          }
	        }, _callee6, this);
	      }));

	      function writeFragmentFill(_x16, _x17, _x18) {
	        return _writeFragmentFill.apply(this, arguments);
	      }

	      return writeFragmentFill;
	    }()
	  }]);

	  return GapWriter;
	}(); //import MemoryStorage from "../storage/memory/MemoryStorage.js";

	var BaseObservableList = /*#__PURE__*/function (_BaseObservable) {
	  _inherits(BaseObservableList, _BaseObservable);

	  var _super = _createSuper(BaseObservableList);

	  function BaseObservableList() {
	    _classCallCheck(this, BaseObservableList);

	    return _super.apply(this, arguments);
	  }

	  _createClass(BaseObservableList, [{
	    key: "emitReset",
	    value: function emitReset() {
	      var _iterator = _createForOfIteratorHelper(this._handlers),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var h = _step.value;
	          h.onReset(this);
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }
	    } // we need batch events, mostly on index based collection though?
	    // maybe we should get started without?

	  }, {
	    key: "emitAdd",
	    value: function emitAdd(index, value) {
	      var _iterator2 = _createForOfIteratorHelper(this._handlers),
	          _step2;

	      try {
	        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	          var h = _step2.value;
	          h.onAdd(index, value, this);
	        }
	      } catch (err) {
	        _iterator2.e(err);
	      } finally {
	        _iterator2.f();
	      }
	    }
	  }, {
	    key: "emitUpdate",
	    value: function emitUpdate(index, value, params) {
	      var _iterator3 = _createForOfIteratorHelper(this._handlers),
	          _step3;

	      try {
	        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	          var h = _step3.value;
	          h.onUpdate(index, value, params, this);
	        }
	      } catch (err) {
	        _iterator3.e(err);
	      } finally {
	        _iterator3.f();
	      }
	    }
	  }, {
	    key: "emitRemove",
	    value: function emitRemove(index, value) {
	      var _iterator4 = _createForOfIteratorHelper(this._handlers),
	          _step4;

	      try {
	        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
	          var h = _step4.value;
	          h.onRemove(index, value, this);
	        }
	      } catch (err) {
	        _iterator4.e(err);
	      } finally {
	        _iterator4.f();
	      }
	    } // toIdx assumes the item has already
	    // been removed from its fromIdx

	  }, {
	    key: "emitMove",
	    value: function emitMove(fromIdx, toIdx, value) {
	      var _iterator5 = _createForOfIteratorHelper(this._handlers),
	          _step5;

	      try {
	        for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
	          var h = _step5.value;
	          h.onMove(fromIdx, toIdx, value, this);
	        }
	      } catch (err) {
	        _iterator5.e(err);
	      } finally {
	        _iterator5.f();
	      }
	    }
	  }, {
	    key: Symbol.iterator,
	    value: function value() {
	      throw new Error("unimplemented");
	    }
	  }, {
	    key: "length",
	    get: function get() {
	      throw new Error("unimplemented");
	    }
	  }]);

	  return BaseObservableList;
	}(BaseObservable);

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/

	/**
	 * @license
	 * Based off baseSortedIndex function in Lodash <https://lodash.com/>
	 * Copyright JS Foundation and other contributors <https://js.foundation/>
	 * Released under MIT license <https://lodash.com/license>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 */
	function sortedIndex(array, value, comparator) {
	  var low = 0;
	  var high = array.length;

	  while (low < high) {
	    var mid = low + high >>> 1;
	    var cmpResult = comparator(value, array[mid]);

	    if (cmpResult > 0) {
	      low = mid + 1;
	    } else if (cmpResult < 0) {
	      high = mid;
	    } else {
	      low = high = mid;
	    }
	  }

	  return high;
	}

	var BaseObservableMap = /*#__PURE__*/function (_BaseObservable) {
	  _inherits(BaseObservableMap, _BaseObservable);

	  var _super = _createSuper(BaseObservableMap);

	  function BaseObservableMap() {
	    _classCallCheck(this, BaseObservableMap);

	    return _super.apply(this, arguments);
	  }

	  _createClass(BaseObservableMap, [{
	    key: "emitReset",
	    value: function emitReset() {
	      var _iterator = _createForOfIteratorHelper(this._handlers),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var h = _step.value;
	          h.onReset();
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }
	    } // we need batch events, mostly on index based collection though?
	    // maybe we should get started without?

	  }, {
	    key: "emitAdd",
	    value: function emitAdd(key, value) {
	      var _iterator2 = _createForOfIteratorHelper(this._handlers),
	          _step2;

	      try {
	        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	          var h = _step2.value;
	          h.onAdd(key, value);
	        }
	      } catch (err) {
	        _iterator2.e(err);
	      } finally {
	        _iterator2.f();
	      }
	    }
	  }, {
	    key: "emitUpdate",
	    value: function emitUpdate(key, value) {
	      for (var _len = arguments.length, params = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
	        params[_key - 2] = arguments[_key];
	      }

	      var _iterator3 = _createForOfIteratorHelper(this._handlers),
	          _step3;

	      try {
	        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	          var h = _step3.value;
	          h.onUpdate.apply(h, [key, value].concat(params));
	        }
	      } catch (err) {
	        _iterator3.e(err);
	      } finally {
	        _iterator3.f();
	      }
	    }
	  }, {
	    key: "emitRemove",
	    value: function emitRemove(key, value) {
	      var _iterator4 = _createForOfIteratorHelper(this._handlers),
	          _step4;

	      try {
	        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
	          var h = _step4.value;
	          h.onRemove(key, value);
	        }
	      } catch (err) {
	        _iterator4.e(err);
	      } finally {
	        _iterator4.f();
	      }
	    }
	  }]);

	  return BaseObservableMap;
	}(BaseObservable);

	var ObservableMap = /*#__PURE__*/function (_BaseObservableMap) {
	  _inherits(ObservableMap, _BaseObservableMap);

	  var _super = _createSuper(ObservableMap);

	  function ObservableMap(initialValues) {
	    var _this;

	    _classCallCheck(this, ObservableMap);

	    _this = _super.call(this);
	    _this._values = new Map(initialValues);
	    return _this;
	  }

	  _createClass(ObservableMap, [{
	    key: "update",
	    value: function update(key, params) {
	      var value = this._values.get(key);

	      if (value !== undefined) {
	        // could be the same value, so it's already updated
	        // but we don't assume this here
	        this._values.set(key, value);

	        this.emitUpdate(key, value, params);
	        return true;
	      }

	      return false; // or return existing value?
	    }
	  }, {
	    key: "add",
	    value: function add(key, value) {
	      if (!this._values.has(key)) {
	        this._values.set(key, value);

	        this.emitAdd(key, value);
	        return true;
	      }

	      return false; // or return existing value?
	    }
	  }, {
	    key: "remove",
	    value: function remove(key) {
	      var value = this._values.get(key);

	      if (value !== undefined) {
	        this._values.delete(key);

	        this.emitRemove(key, value);
	        return true;
	      } else {
	        return false;
	      }
	    }
	  }, {
	    key: "reset",
	    value: function reset() {
	      this._values.clear();

	      this.emitReset();
	    }
	  }, {
	    key: "get",
	    value: function get(key) {
	      return this._values.get(key);
	    }
	  }, {
	    key: Symbol.iterator,
	    value: function value() {
	      return this._values.entries();
	    }
	  }, {
	    key: "size",
	    get: function get() {
	      return this._values.size;
	    }
	  }]);

	  return ObservableMap;
	}(BaseObservableMap);

	/*

	when a value changes, it sorting order can change. It would still be at the old index prior to firing an onUpdate event.
	So how do you know where it was before it changed, if not by going over all values?

	how to make this fast?

	seems hard to solve with an array, because you need to map the key to it's previous location somehow, to efficiently find it,
	and move it.

	I wonder if we could do better with a binary search tree (BST).
	The tree has a value with {key, value}. There is a plain Map mapping keys to this tuple,
	for easy lookup. Now how do we find the index of this tuple in the BST?

	either we store in every node the amount of nodes on the left and right, or we decend into the part
	of the tree preceding the node we want to know about. Updating the counts upwards would probably be fine as this is log2 of
	the size of the container.

	to be able to go from a key to an index, the value would have the have a link with the tree node though

	so key -> Map<key,value> -> value -> node -> *parentNode -> rootNode
	with a node containing {value, leftCount, rightCount, leftNode, rightNode, parentNode}
	*/
	// does not assume whether or not the values are reference
	// types modified outside of the collection (and affecting sort order) or not
	// no duplicates allowed for now

	var SortedMapList = /*#__PURE__*/function (_BaseObservableList) {
	  _inherits(SortedMapList, _BaseObservableList);

	  var _super = _createSuper(SortedMapList);

	  function SortedMapList(sourceMap, comparator) {
	    var _this;

	    _classCallCheck(this, SortedMapList);

	    _this = _super.call(this);
	    _this._sourceMap = sourceMap;

	    _this._comparator = function (a, b) {
	      return comparator(a.value, b.value);
	    };

	    _this._sortedPairs = null;
	    _this._mapSubscription = null;
	    return _this;
	  }

	  _createClass(SortedMapList, [{
	    key: "onAdd",
	    value: function onAdd(key, value) {
	      var pair = {
	        key: key,
	        value: value
	      };
	      var idx = sortedIndex(this._sortedPairs, pair, this._comparator);

	      this._sortedPairs.splice(idx, 0, pair);

	      this.emitAdd(idx, value);
	    }
	  }, {
	    key: "onRemove",
	    value: function onRemove(key, value) {
	      var pair = {
	        key: key,
	        value: value
	      };
	      var idx = sortedIndex(this._sortedPairs, pair, this._comparator); // assert key === this._sortedPairs[idx].key;

	      this._sortedPairs.splice(idx, 1);

	      this.emitRemove(idx, value);
	    }
	  }, {
	    key: "onUpdate",
	    value: function onUpdate(key, value, params) {
	      // TODO: suboptimal for performance, see above for idea with BST to speed this up if we need to
	      var oldIdx = this._sortedPairs.findIndex(function (p) {
	        return p.key === key;
	      }); // neccesary to remove pair from array before
	      // doing sortedIndex as it relies on being sorted


	      this._sortedPairs.splice(oldIdx, 1);

	      var pair = {
	        key: key,
	        value: value
	      };
	      var newIdx = sortedIndex(this._sortedPairs, pair, this._comparator);

	      this._sortedPairs.splice(newIdx, 0, pair);

	      if (oldIdx !== newIdx) {
	        this.emitMove(oldIdx, newIdx, value);
	      }

	      this.emitUpdate(newIdx, value, params);
	    }
	  }, {
	    key: "onReset",
	    value: function onReset() {
	      this._sortedPairs = [];
	      this.emitReset();
	    }
	  }, {
	    key: "onSubscribeFirst",
	    value: function onSubscribeFirst() {
	      this._mapSubscription = this._sourceMap.subscribe(this);
	      this._sortedPairs = new Array(this._sourceMap.size);
	      var i = 0;

	      var _iterator = _createForOfIteratorHelper(this._sourceMap),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var _step$value = _slicedToArray(_step.value, 2),
	              key = _step$value[0],
	              value = _step$value[1];

	          this._sortedPairs[i] = {
	            key: key,
	            value: value
	          };
	          ++i;
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }

	      this._sortedPairs.sort(this._comparator);

	      _get(_getPrototypeOf(SortedMapList.prototype), "onSubscribeFirst", this).call(this);
	    }
	  }, {
	    key: "onUnsubscribeLast",
	    value: function onUnsubscribeLast() {
	      _get(_getPrototypeOf(SortedMapList.prototype), "onUnsubscribeLast", this).call(this);

	      this._sortedPairs = null;
	      this._mapSubscription = this._mapSubscription();
	    }
	  }, {
	    key: "get",
	    value: function get(index) {
	      return this._sortedPairs[index].value;
	    }
	  }, {
	    key: Symbol.iterator,
	    value: function value() {
	      var it = this._sortedPairs.values();

	      return {
	        next: function next() {
	          var v = it.next();

	          if (v.value) {
	            v.value = v.value.value;
	          }

	          return v;
	        }
	      };
	    }
	  }, {
	    key: "length",
	    get: function get() {
	      return this._sourceMap.size;
	    }
	  }]);

	  return SortedMapList;
	}(BaseObservableList);

	var FilteredMap = /*#__PURE__*/function (_BaseObservableMap) {
	  _inherits(FilteredMap, _BaseObservableMap);

	  var _super = _createSuper(FilteredMap);

	  function FilteredMap(source, mapper, updater) {
	    var _this;

	    _classCallCheck(this, FilteredMap);

	    _this = _super.call(this);
	    _this._source = source;
	    _this._mapper = mapper;
	    _this._updater = updater;
	    _this._mappedValues = new Map();
	    return _this;
	  }

	  _createClass(FilteredMap, [{
	    key: "onAdd",
	    value: function onAdd(key, value) {
	      var mappedValue = this._mapper(value);

	      this._mappedValues.set(key, mappedValue);

	      this.emitAdd(key, mappedValue);
	    }
	  }, {
	    key: "onRemove",
	    value: function onRemove(key, _value) {
	      var mappedValue = this._mappedValues.get(key);

	      if (this._mappedValues.delete(key)) {
	        this.emitRemove(key, mappedValue);
	      }
	    }
	  }, {
	    key: "onChange",
	    value: function onChange(key, value, params) {
	      var mappedValue = this._mappedValues.get(key);

	      if (mappedValue !== undefined) {
	        var newParams = this._updater(value, params);

	        if (newParams !== undefined) {
	          this.emitChange(key, mappedValue, newParams);
	        }
	      }
	    }
	  }, {
	    key: "onSubscribeFirst",
	    value: function onSubscribeFirst() {
	      var _iterator = _createForOfIteratorHelper(this._source),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var _step$value = _slicedToArray(_step.value, 2),
	              key = _step$value[0],
	              value = _step$value[1];

	          var mappedValue = this._mapper(value);

	          this._mappedValues.set(key, mappedValue);
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }

	      _get(_getPrototypeOf(FilteredMap.prototype), "onSubscribeFirst", this).call(this);
	    }
	  }, {
	    key: "onUnsubscribeLast",
	    value: function onUnsubscribeLast() {
	      _get(_getPrototypeOf(FilteredMap.prototype), "onUnsubscribeLast", this).call(this);

	      this._mappedValues.clear();
	    }
	  }, {
	    key: "onReset",
	    value: function onReset() {
	      this._mappedValues.clear();

	      this.emitReset();
	    }
	  }, {
	    key: Symbol.iterator,
	    value: function value() {
	      return this._mappedValues.entries()[Symbol.iterator];
	    }
	  }]);

	  return FilteredMap;
	}(BaseObservableMap);

	/*
	so a mapped value can emit updates on it's own with this._emitSpontaneousUpdate that is passed in the mapping function
	how should the mapped value be notified of an update though? and can it then decide to not propagate the update?
	*/

	var MappedMap = /*#__PURE__*/function (_BaseObservableMap) {
	  _inherits(MappedMap, _BaseObservableMap);

	  var _super = _createSuper(MappedMap);

	  function MappedMap(source, mapper) {
	    var _this;

	    _classCallCheck(this, MappedMap);

	    _this = _super.call(this);
	    _this._source = source;
	    _this._mapper = mapper;
	    _this._mappedValues = new Map();
	    return _this;
	  }

	  _createClass(MappedMap, [{
	    key: "_emitSpontaneousUpdate",
	    value: function _emitSpontaneousUpdate(key, params) {
	      var value = this._mappedValues.get(key);

	      if (value) {
	        this.emitUpdate(key, value, params);
	      }
	    }
	  }, {
	    key: "onAdd",
	    value: function onAdd(key, value) {
	      var emitSpontaneousUpdate = this._emitSpontaneousUpdate.bind(this, key);

	      var mappedValue = this._mapper(value, emitSpontaneousUpdate);

	      this._mappedValues.set(key, mappedValue);

	      this.emitAdd(key, mappedValue);
	    }
	  }, {
	    key: "onRemove",
	    value: function onRemove(key, _value) {
	      var mappedValue = this._mappedValues.get(key);

	      if (this._mappedValues.delete(key)) {
	        this.emitRemove(key, mappedValue);
	      }
	    }
	  }, {
	    key: "onUpdate",
	    value: function onUpdate(key, value, params) {
	      var mappedValue = this._mappedValues.get(key);

	      if (mappedValue !== undefined) {
	        // TODO: map params somehow if needed?
	        this.emitUpdate(key, mappedValue, params);
	      }
	    }
	  }, {
	    key: "onSubscribeFirst",
	    value: function onSubscribeFirst() {
	      this._subscription = this._source.subscribe(this);

	      var _iterator = _createForOfIteratorHelper(this._source),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var _step$value = _slicedToArray(_step.value, 2),
	              key = _step$value[0],
	              value = _step$value[1];

	          var emitSpontaneousUpdate = this._emitSpontaneousUpdate.bind(this, key);

	          var mappedValue = this._mapper(value, emitSpontaneousUpdate);

	          this._mappedValues.set(key, mappedValue);
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }

	      _get(_getPrototypeOf(MappedMap.prototype), "onSubscribeFirst", this).call(this);
	    }
	  }, {
	    key: "onUnsubscribeLast",
	    value: function onUnsubscribeLast() {
	      this._subscription = this._subscription();

	      this._mappedValues.clear();
	    }
	  }, {
	    key: "onReset",
	    value: function onReset() {
	      this._mappedValues.clear();

	      this.emitReset();
	    }
	  }, {
	    key: Symbol.iterator,
	    value: function value() {
	      return this._mappedValues.entries();
	    }
	  }]);

	  return MappedMap;
	}(BaseObservableMap);

	var SortedArray = /*#__PURE__*/function (_BaseObservableList) {
	  _inherits(SortedArray, _BaseObservableList);

	  var _super = _createSuper(SortedArray);

	  function SortedArray(comparator) {
	    var _this;

	    _classCallCheck(this, SortedArray);

	    _this = _super.call(this);
	    _this._comparator = comparator;
	    _this._items = [];
	    return _this;
	  }

	  _createClass(SortedArray, [{
	    key: "setManyUnsorted",
	    value: function setManyUnsorted(items) {
	      this.setManySorted(items);
	    }
	  }, {
	    key: "setManySorted",
	    value: function setManySorted(items) {
	      // TODO: we can make this way faster by only looking up the first and last key,
	      // and merging whatever is inbetween with items
	      // if items is not sorted, 💩🌀 will follow!
	      // should we check?
	      // Also, once bulk events are supported in collections,
	      // we can do a bulk add event here probably if there are no updates
	      // BAD CODE!
	      var _iterator = _createForOfIteratorHelper(items),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var item = _step.value;
	          this.set(item);
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }
	    }
	  }, {
	    key: "set",
	    value: function set(item) {
	      var updateParams = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
	      var idx = sortedIndex(this._items, item, this._comparator);

	      if (idx >= this._items.length || this._comparator(this._items[idx], item) !== 0) {
	        this._items.splice(idx, 0, item);

	        this.emitAdd(idx, item);
	      } else {
	        this._items[idx] = item;
	        this.emitUpdate(idx, item, updateParams);
	      }
	    }
	  }, {
	    key: "get",
	    value: function get(idx) {
	      return this._items[idx];
	    }
	  }, {
	    key: "remove",
	    value: function remove(idx) {
	      var item = this._items[idx];

	      this._items.splice(idx, 1);

	      this.emitRemove(idx, item);
	    }
	  }, {
	    key: Symbol.iterator,
	    value: function value() {
	      return this._items.values();
	    }
	  }, {
	    key: "array",
	    get: function get() {
	      return this._items;
	    }
	  }, {
	    key: "length",
	    get: function get() {
	      return this._items.length;
	    }
	  }]);

	  return SortedArray;
	}(BaseObservableList);

	var MappedList = /*#__PURE__*/function (_BaseObservableList) {
	  _inherits(MappedList, _BaseObservableList);

	  var _super = _createSuper(MappedList);

	  function MappedList(sourceList, mapper, updater) {
	    var _this;

	    _classCallCheck(this, MappedList);

	    _this = _super.call(this);
	    _this._sourceList = sourceList;
	    _this._mapper = mapper;
	    _this._updater = updater;
	    _this._sourceUnsubscribe = null;
	    _this._mappedValues = null;
	    return _this;
	  }

	  _createClass(MappedList, [{
	    key: "onSubscribeFirst",
	    value: function onSubscribeFirst() {
	      this._sourceUnsubscribe = this._sourceList.subscribe(this);
	      this._mappedValues = [];

	      var _iterator = _createForOfIteratorHelper(this._sourceList),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var item = _step.value;

	          this._mappedValues.push(this._mapper(item));
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }
	    }
	  }, {
	    key: "onReset",
	    value: function onReset() {
	      this._mappedValues = [];
	      this.emitReset();
	    }
	  }, {
	    key: "onAdd",
	    value: function onAdd(index, value) {
	      var mappedValue = this._mapper(value);

	      this._mappedValues.splice(index, 0, mappedValue);

	      this.emitAdd(index, mappedValue);
	    }
	  }, {
	    key: "onUpdate",
	    value: function onUpdate(index, value, params) {
	      var mappedValue = this._mappedValues[index];

	      if (this._updater) {
	        this._updater(mappedValue, params, value);
	      }

	      this.emitUpdate(index, mappedValue, params);
	    }
	  }, {
	    key: "onRemove",
	    value: function onRemove(index) {
	      var mappedValue = this._mappedValues[index];

	      this._mappedValues.splice(index, 1);

	      this.emitRemove(index, mappedValue);
	    }
	  }, {
	    key: "onMove",
	    value: function onMove(fromIdx, toIdx) {
	      var mappedValue = this._mappedValues[fromIdx];

	      this._mappedValues.splice(fromIdx, 1);

	      this._mappedValues.splice(toIdx, 0, mappedValue);

	      this.emitMove(fromIdx, toIdx, mappedValue);
	    }
	  }, {
	    key: "onUnsubscribeLast",
	    value: function onUnsubscribeLast() {
	      this._sourceUnsubscribe();
	    }
	  }, {
	    key: Symbol.iterator,
	    value: function value() {
	      return this._mappedValues.values();
	    }
	  }, {
	    key: "length",
	    get: function get() {
	      return this._mappedValues.length;
	    }
	  }]);

	  return MappedList;
	}(BaseObservableList);

	var ConcatList = /*#__PURE__*/function (_BaseObservableList) {
	  _inherits(ConcatList, _BaseObservableList);

	  var _super = _createSuper(ConcatList);

	  function ConcatList() {
	    var _this;

	    _classCallCheck(this, ConcatList);

	    _this = _super.call(this);

	    for (var _len = arguments.length, sourceLists = new Array(_len), _key = 0; _key < _len; _key++) {
	      sourceLists[_key] = arguments[_key];
	    }

	    _this._sourceLists = sourceLists;
	    _this._sourceUnsubscribes = null;
	    return _this;
	  }

	  _createClass(ConcatList, [{
	    key: "_offsetForSource",
	    value: function _offsetForSource(sourceList) {
	      var listIdx = this._sourceLists.indexOf(sourceList);

	      var offset = 0;

	      for (var i = 0; i < listIdx; ++i) {
	        offset += this._sourceLists[i].length;
	      }

	      return offset;
	    }
	  }, {
	    key: "onSubscribeFirst",
	    value: function onSubscribeFirst() {
	      this._sourceUnsubscribes = [];

	      var _iterator = _createForOfIteratorHelper(this._sourceLists),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var sourceList = _step.value;

	          this._sourceUnsubscribes.push(sourceList.subscribe(this));
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }
	    }
	  }, {
	    key: "onUnsubscribeLast",
	    value: function onUnsubscribeLast() {
	      var _iterator2 = _createForOfIteratorHelper(this._sourceUnsubscribes),
	          _step2;

	      try {
	        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	          var sourceUnsubscribe = _step2.value;
	          sourceUnsubscribe();
	        }
	      } catch (err) {
	        _iterator2.e(err);
	      } finally {
	        _iterator2.f();
	      }
	    }
	  }, {
	    key: "onReset",
	    value: function onReset() {
	      // TODO: not ideal if other source lists are large
	      // but working impl for now
	      // reset, and 
	      this.emitReset();
	      var idx = 0;

	      var _iterator3 = _createForOfIteratorHelper(this),
	          _step3;

	      try {
	        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	          var item = _step3.value;
	          this.emitAdd(idx, item);
	          idx += 1;
	        }
	      } catch (err) {
	        _iterator3.e(err);
	      } finally {
	        _iterator3.f();
	      }
	    }
	  }, {
	    key: "onAdd",
	    value: function onAdd(index, value, sourceList) {
	      this.emitAdd(this._offsetForSource(sourceList) + index, value);
	    }
	  }, {
	    key: "onUpdate",
	    value: function onUpdate(index, value, params, sourceList) {
	      this.emitUpdate(this._offsetForSource(sourceList) + index, value, params);
	    }
	  }, {
	    key: "onRemove",
	    value: function onRemove(index, value, sourceList) {
	      this.emitRemove(this._offsetForSource(sourceList) + index, value);
	    }
	  }, {
	    key: "onMove",
	    value: function onMove(fromIdx, toIdx, value, sourceList) {
	      var offset = this._offsetForSource(sourceList);

	      this.emitMove(offset + fromIdx, offset + toIdx, value);
	    }
	  }, {
	    key: Symbol.iterator,
	    value: function value() {
	      var _this2 = this;

	      var sourceListIdx = 0;

	      var it = this._sourceLists[0][Symbol.iterator]();

	      return {
	        next: function next() {
	          var result = it.next();

	          while (result.done) {
	            sourceListIdx += 1;

	            if (sourceListIdx >= _this2._sourceLists.length) {
	              return result; //done
	            }

	            it = _this2._sourceLists[sourceListIdx][Symbol.iterator]();
	            result = it.next();
	          }

	          return result;
	        }
	      };
	    }
	  }, {
	    key: "length",
	    get: function get() {
	      var len = 0;

	      for (var i = 0; i < this._sourceLists.length; ++i) {
	        len += this._sourceLists[i].length;
	      }

	      return len;
	    }
	  }]);

	  return ConcatList;
	}(BaseObservableList);

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	// and BaseObservableMap (as they extend it)

	Object.assign(BaseObservableMap.prototype, {
	  sortValues: function sortValues(comparator) {
	    return new SortedMapList(this, comparator);
	  },
	  mapValues: function mapValues(mapper) {
	    return new MappedMap(this, mapper);
	  },
	  filterValues: function filterValues(filter) {
	    return new FilteredMap(this, filter);
	  }
	});

	var TimelineReader = /*#__PURE__*/function () {
	  function TimelineReader(_ref) {
	    var roomId = _ref.roomId,
	        storage = _ref.storage,
	        fragmentIdComparer = _ref.fragmentIdComparer;

	    _classCallCheck(this, TimelineReader);

	    this._roomId = roomId;
	    this._storage = storage;
	    this._fragmentIdComparer = fragmentIdComparer;
	  }

	  _createClass(TimelineReader, [{
	    key: "_openTxn",
	    value: function _openTxn() {
	      return this._storage.readTxn([this._storage.storeNames.timelineEvents, this._storage.storeNames.timelineFragments]);
	    }
	  }, {
	    key: "readFrom",
	    value: function () {
	      var _readFrom2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(eventKey, direction, amount) {
	        var txn;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _context.next = 2;
	                return this._openTxn();

	              case 2:
	                txn = _context.sent;
	                return _context.abrupt("return", this._readFrom(eventKey, direction, amount, txn));

	              case 4:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function readFrom(_x, _x2, _x3) {
	        return _readFrom2.apply(this, arguments);
	      }

	      return readFrom;
	    }()
	  }, {
	    key: "_readFrom",
	    value: function () {
	      var _readFrom3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(eventKey, direction, amount, txn) {
	        var _this = this;

	        var entries, timelineStore, fragmentStore, eventsWithinFragment, eventEntries, fragment, fragmentEntry, nextFragment, nextFragmentEntry;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                entries = [];
	                timelineStore = txn.timelineEvents;
	                fragmentStore = txn.timelineFragments;

	              case 3:
	                if (!(entries.length < amount && eventKey)) {
	                  _context2.next = 35;
	                  break;
	                }

	                eventsWithinFragment = void 0;

	                if (!direction.isForward) {
	                  _context2.next = 11;
	                  break;
	                }

	                _context2.next = 8;
	                return timelineStore.eventsAfter(this._roomId, eventKey, amount);

	              case 8:
	                eventsWithinFragment = _context2.sent;
	                _context2.next = 14;
	                break;

	              case 11:
	                _context2.next = 13;
	                return timelineStore.eventsBefore(this._roomId, eventKey, amount);

	              case 13:
	                eventsWithinFragment = _context2.sent;

	              case 14:
	                eventEntries = eventsWithinFragment.map(function (e) {
	                  return new EventEntry(e, _this._fragmentIdComparer);
	                });
	                entries = directionalConcat(entries, eventEntries, direction); // prepend or append eventsWithinFragment to entries, and wrap them in EventEntry

	                if (!(entries.length < amount)) {
	                  _context2.next = 33;
	                  break;
	                }

	                _context2.next = 19;
	                return fragmentStore.get(this._roomId, eventKey.fragmentId);

	              case 19:
	                fragment = _context2.sent;
	                // this._fragmentIdComparer.addFragment(fragment);
	                fragmentEntry = new FragmentBoundaryEntry(fragment, direction.isBackward, this._fragmentIdComparer); // append or prepend fragmentEntry, reuse func from GapWriter?

	                directionalAppend(entries, fragmentEntry, direction); // don't count it in amount perhaps? or do?

	                if (!fragmentEntry.hasLinkedFragment) {
	                  _context2.next = 32;
	                  break;
	                }

	                _context2.next = 25;
	                return fragmentStore.get(this._roomId, fragmentEntry.linkedFragmentId);

	              case 25:
	                nextFragment = _context2.sent;

	                this._fragmentIdComparer.add(nextFragment);

	                nextFragmentEntry = new FragmentBoundaryEntry(nextFragment, direction.isForward, this._fragmentIdComparer);
	                directionalAppend(entries, nextFragmentEntry, direction);
	                eventKey = nextFragmentEntry.asEventKey();
	                _context2.next = 33;
	                break;

	              case 32:
	                eventKey = null;

	              case 33:
	                _context2.next = 3;
	                break;

	              case 35:
	                return _context2.abrupt("return", entries);

	              case 36:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this);
	      }));

	      function _readFrom(_x4, _x5, _x6, _x7) {
	        return _readFrom3.apply(this, arguments);
	      }

	      return _readFrom;
	    }()
	  }, {
	    key: "readFromEnd",
	    value: function () {
	      var _readFromEnd = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(amount) {
	        var txn, liveFragment, liveFragmentEntry, eventKey, entries;
	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                _context3.next = 2;
	                return this._openTxn();

	              case 2:
	                txn = _context3.sent;
	                _context3.next = 5;
	                return txn.timelineFragments.liveFragment(this._roomId);

	              case 5:
	                liveFragment = _context3.sent;

	                if (liveFragment) {
	                  _context3.next = 8;
	                  break;
	                }

	                return _context3.abrupt("return", []);

	              case 8:
	                this._fragmentIdComparer.add(liveFragment);

	                liveFragmentEntry = FragmentBoundaryEntry.end(liveFragment, this._fragmentIdComparer);
	                eventKey = liveFragmentEntry.asEventKey();
	                _context3.next = 13;
	                return this._readFrom(eventKey, Direction.Backward, amount, txn);

	              case 13:
	                entries = _context3.sent;
	                entries.unshift(liveFragmentEntry);
	                return _context3.abrupt("return", entries);

	              case 16:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3, this);
	      }));

	      function readFromEnd(_x8) {
	        return _readFromEnd.apply(this, arguments);
	      }

	      return readFromEnd;
	    }() // reads distance up and down from eventId
	    // or just expose eventIdToKey?

	  }, {
	    key: "readAtEventId",
	    value: function readAtEventId(eventId, distance) {
	      return null;
	    }
	  }]);

	  return TimelineReader;
	}();

	var PendingEventEntry = /*#__PURE__*/function (_BaseEntry) {
	  _inherits(PendingEventEntry, _BaseEntry);

	  var _super = _createSuper(PendingEventEntry);

	  function PendingEventEntry(_ref) {
	    var _this;

	    var pendingEvent = _ref.pendingEvent,
	        user = _ref.user;

	    _classCallCheck(this, PendingEventEntry);

	    _this = _super.call(this, null);
	    _this._pendingEvent = pendingEvent;
	    _this._user = user;
	    return _this;
	  }

	  _createClass(PendingEventEntry, [{
	    key: "notifyUpdate",
	    value: function notifyUpdate() {}
	  }, {
	    key: "fragmentId",
	    get: function get() {
	      return PENDING_FRAGMENT_ID;
	    }
	  }, {
	    key: "entryIndex",
	    get: function get() {
	      return this._pendingEvent.queueIndex;
	    }
	  }, {
	    key: "content",
	    get: function get() {
	      return this._pendingEvent.content;
	    }
	  }, {
	    key: "event",
	    get: function get() {
	      return null;
	    }
	  }, {
	    key: "eventType",
	    get: function get() {
	      return this._pendingEvent.eventType;
	    }
	  }, {
	    key: "stateKey",
	    get: function get() {
	      return null;
	    }
	  }, {
	    key: "sender",
	    get: function get() {
	      return this._user.id;
	    }
	  }, {
	    key: "timestamp",
	    get: function get() {
	      return null;
	    }
	  }, {
	    key: "isPending",
	    get: function get() {
	      return true;
	    }
	  }, {
	    key: "id",
	    get: function get() {
	      return this._pendingEvent.txnId;
	    }
	  }]);

	  return PendingEventEntry;
	}(BaseEntry);

	var Timeline = /*#__PURE__*/function () {
	  function Timeline(_ref) {
	    var roomId = _ref.roomId,
	        storage = _ref.storage,
	        closeCallback = _ref.closeCallback,
	        fragmentIdComparer = _ref.fragmentIdComparer,
	        pendingEvents = _ref.pendingEvents,
	        user = _ref.user;

	    _classCallCheck(this, Timeline);

	    this._roomId = roomId;
	    this._storage = storage;
	    this._closeCallback = closeCallback;
	    this._fragmentIdComparer = fragmentIdComparer;
	    this._remoteEntries = new SortedArray(function (a, b) {
	      return a.compare(b);
	    });
	    this._timelineReader = new TimelineReader({
	      roomId: this._roomId,
	      storage: this._storage,
	      fragmentIdComparer: this._fragmentIdComparer
	    });
	    var localEntries = new MappedList(pendingEvents, function (pe) {
	      return new PendingEventEntry({
	        pendingEvent: pe,
	        user: user
	      });
	    }, function (pee, params) {
	      pee.notifyUpdate(params);
	    });
	    this._allEntries = new ConcatList(this._remoteEntries, localEntries);
	  }
	  /** @package */


	  _createClass(Timeline, [{
	    key: "load",
	    value: function () {
	      var _load = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        var entries;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _context.next = 2;
	                return this._timelineReader.readFromEnd(50);

	              case 2:
	                entries = _context.sent;

	                this._remoteEntries.setManySorted(entries);

	              case 4:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function load() {
	        return _load.apply(this, arguments);
	      }

	      return load;
	    }() // TODO: should we rather have generic methods for
	    // - adding new entries
	    // - updating existing entries (redaction, relations)

	    /** @package */

	  }, {
	    key: "appendLiveEntries",
	    value: function appendLiveEntries(newEntries) {
	      this._remoteEntries.setManySorted(newEntries);
	    }
	    /** @package */

	  }, {
	    key: "addGapEntries",
	    value: function addGapEntries(newEntries) {
	      this._remoteEntries.setManySorted(newEntries);
	    } // tries to prepend `amount` entries to the `entries` list.

	  }, {
	    key: "loadAtTop",
	    value: function () {
	      var _loadAtTop = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(amount) {
	        var firstEventEntry, entries;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                firstEventEntry = this._remoteEntries.array.find(function (e) {
	                  return !!e.eventType;
	                });

	                if (firstEventEntry) {
	                  _context2.next = 3;
	                  break;
	                }

	                return _context2.abrupt("return");

	              case 3:
	                _context2.next = 5;
	                return this._timelineReader.readFrom(firstEventEntry.asEventKey(), Direction.Backward, amount);

	              case 5:
	                entries = _context2.sent;

	                this._remoteEntries.setManySorted(entries);

	              case 7:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this);
	      }));

	      function loadAtTop(_x) {
	        return _loadAtTop.apply(this, arguments);
	      }

	      return loadAtTop;
	    }()
	    /** @public */

	  }, {
	    key: "close",

	    /** @public */
	    value: function close() {
	      if (this._closeCallback) {
	        this._closeCallback();

	        this._closeCallback = null;
	      }
	    }
	  }, {
	    key: "entries",
	    get: function get() {
	      return this._allEntries;
	    }
	  }]);

	  return Timeline;
	}();

	function findBackwardSiblingFragments(current, byId) {
	  var sortedSiblings = [];

	  while (isValidFragmentId(current.previousId)) {
	    var previous = byId.get(current.previousId);

	    if (!previous) {
	      break;
	    }

	    if (previous.nextId !== current.id) {
	      throw new Error("Previous fragment ".concat(previous.id, " doesn't point back to ").concat(current.id));
	    }

	    byId.delete(current.previousId);
	    sortedSiblings.unshift(previous);
	    current = previous;
	  }

	  return sortedSiblings;
	}

	function findForwardSiblingFragments(current, byId) {
	  var sortedSiblings = [];

	  while (isValidFragmentId(current.nextId)) {
	    var next = byId.get(current.nextId);

	    if (!next) {
	      break;
	    }

	    if (next.previousId !== current.id) {
	      throw new Error("Next fragment ".concat(next.id, " doesn't point back to ").concat(current.id));
	    }

	    byId.delete(current.nextId);
	    sortedSiblings.push(next);
	    current = next;
	  }

	  return sortedSiblings;
	}

	function createIslands(fragments) {
	  var byId = new Map();

	  var _iterator = _createForOfIteratorHelper(fragments),
	      _step;

	  try {
	    for (_iterator.s(); !(_step = _iterator.n()).done;) {
	      var f = _step.value;
	      byId.set(f.id, f);
	    }
	  } catch (err) {
	    _iterator.e(err);
	  } finally {
	    _iterator.f();
	  }

	  var islands = [];

	  while (byId.size) {
	    var current = byId.values().next().value;
	    byId.delete(current.id); // new island

	    var previousSiblings = findBackwardSiblingFragments(current, byId);
	    var nextSiblings = findForwardSiblingFragments(current, byId);
	    var island = previousSiblings.concat(current, nextSiblings);
	    islands.push(island);
	  }

	  return islands.map(function (a) {
	    return new Island(a);
	  });
	}

	var Fragment = function Fragment(id, previousId, nextId) {
	  _classCallCheck(this, Fragment);

	  this.id = id;
	  this.previousId = previousId;
	  this.nextId = nextId;
	};

	var Island = /*#__PURE__*/function () {
	  function Island(sortedFragments) {
	    var _this = this;

	    _classCallCheck(this, Island);

	    this._idToSortIndex = new Map();
	    sortedFragments.forEach(function (f, i) {
	      _this._idToSortIndex.set(f.id, i);
	    });
	  }

	  _createClass(Island, [{
	    key: "compare",
	    value: function compare(idA, idB) {
	      var sortIndexA = this._idToSortIndex.get(idA);

	      if (sortIndexA === undefined) {
	        throw new Error("first id ".concat(idA, " isn't part of this island"));
	      }

	      var sortIndexB = this._idToSortIndex.get(idB);

	      if (sortIndexB === undefined) {
	        throw new Error("second id ".concat(idB, " isn't part of this island"));
	      }

	      return sortIndexA - sortIndexB;
	    }
	  }, {
	    key: "fragmentIds",
	    get: function get() {
	      return this._idToSortIndex.keys();
	    }
	  }]);

	  return Island;
	}();
	/*
	index for fast lookup of how two fragments can be sorted
	*/


	var FragmentIdComparer = /*#__PURE__*/function () {
	  function FragmentIdComparer(fragments) {
	    _classCallCheck(this, FragmentIdComparer);

	    this._fragmentsById = fragments.reduce(function (map, f) {
	      map.set(f.id, f);
	      return map;
	    }, new Map());
	    this.rebuild(fragments);
	  }

	  _createClass(FragmentIdComparer, [{
	    key: "_getIsland",
	    value: function _getIsland(id) {
	      var island = this._idToIsland.get(id);

	      if (island === undefined) {
	        throw new Error("Unknown fragment id ".concat(id));
	      }

	      return island;
	    }
	  }, {
	    key: "compare",
	    value: function compare(idA, idB) {
	      if (idA === idB) {
	        return 0;
	      }

	      var islandA = this._getIsland(idA);

	      var islandB = this._getIsland(idB);

	      if (islandA !== islandB) {
	        throw new Error("".concat(idA, " and ").concat(idB, " are on different islands, can't tell order"));
	      }

	      return islandA.compare(idA, idB);
	    }
	  }, {
	    key: "rebuild",
	    value: function rebuild(fragments) {
	      var islands = createIslands(fragments);
	      this._idToIsland = new Map();

	      var _iterator2 = _createForOfIteratorHelper(islands),
	          _step2;

	      try {
	        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	          var island = _step2.value;

	          var _iterator3 = _createForOfIteratorHelper(island.fragmentIds),
	              _step3;

	          try {
	            for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	              var id = _step3.value;

	              this._idToIsland.set(id, island);
	            }
	          } catch (err) {
	            _iterator3.e(err);
	          } finally {
	            _iterator3.f();
	          }
	        }
	      } catch (err) {
	        _iterator2.e(err);
	      } finally {
	        _iterator2.f();
	      }
	    }
	    /** use for fragments coming out of persistence, not newly created ones, or also fragments for a new island (like for a permalink) */

	  }, {
	    key: "add",
	    value: function add(fragment) {
	      var copy = new Fragment(fragment.id, fragment.previousId, fragment.nextId);

	      this._fragmentsById.set(fragment.id, copy);

	      this.rebuild(this._fragmentsById.values());
	    }
	    /** use for appending newly created fragments */

	  }, {
	    key: "append",
	    value: function append(id, previousId) {
	      var fragment = new Fragment(id, previousId, null);

	      var prevFragment = this._fragmentsById.get(previousId);

	      if (prevFragment) {
	        prevFragment.nextId = id;
	      }

	      this._fragmentsById.set(id, fragment);

	      this.rebuild(this._fragmentsById.values());
	    }
	    /** use for prepending newly created fragments */

	  }, {
	    key: "prepend",
	    value: function prepend(id, nextId) {
	      var fragment = new Fragment(id, null, nextId);

	      var nextFragment = this._fragmentsById.get(nextId);

	      if (nextFragment) {
	        nextFragment.previousId = id;
	      }

	      this._fragmentsById.set(id, fragment);

	      this.rebuild(this._fragmentsById.values());
	    }
	  }]);

	  return FragmentIdComparer;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var PendingEvent = /*#__PURE__*/function () {
	  function PendingEvent(data) {
	    _classCallCheck(this, PendingEvent);

	    this._data = data;
	  }

	  _createClass(PendingEvent, [{
	    key: "roomId",
	    get: function get() {
	      return this._data.roomId;
	    }
	  }, {
	    key: "queueIndex",
	    get: function get() {
	      return this._data.queueIndex;
	    }
	  }, {
	    key: "eventType",
	    get: function get() {
	      return this._data.eventType;
	    }
	  }, {
	    key: "txnId",
	    get: function get() {
	      return this._data.txnId;
	    }
	  }, {
	    key: "remoteId",
	    get: function get() {
	      return this._data.remoteId;
	    },
	    set: function set(value) {
	      this._data.remoteId = value;
	    }
	  }, {
	    key: "content",
	    get: function get() {
	      return this._data.content;
	    }
	  }, {
	    key: "data",
	    get: function get() {
	      return this._data;
	    }
	  }]);

	  return PendingEvent;
	}();

	function makeTxnId() {
	  var n = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
	  var str = n.toString(16);
	  return "t" + "0".repeat(14 - str.length) + str;
	}

	var SendQueue = /*#__PURE__*/function () {
	  function SendQueue(_ref) {
	    var roomId = _ref.roomId,
	        storage = _ref.storage,
	        sendScheduler = _ref.sendScheduler,
	        pendingEvents = _ref.pendingEvents;

	    _classCallCheck(this, SendQueue);

	    pendingEvents = pendingEvents || [];
	    this._roomId = roomId;
	    this._storage = storage;
	    this._sendScheduler = sendScheduler;
	    this._pendingEvents = new SortedArray(function (a, b) {
	      return a.queueIndex - b.queueIndex;
	    });

	    if (pendingEvents.length) {
	      console.info("SendQueue for room ".concat(roomId, " has ").concat(pendingEvents.length, " pending events"), pendingEvents);
	    }

	    this._pendingEvents.setManyUnsorted(pendingEvents.map(function (data) {
	      return new PendingEvent(data);
	    }));

	    this._isSending = false;
	    this._offline = false;
	    this._amountSent = 0;
	  }

	  _createClass(SendQueue, [{
	    key: "_sendLoop",
	    value: function () {
	      var _sendLoop2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        var _this = this;

	        var _loop, _ret;

	        return regeneratorRuntime.wrap(function _callee$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                this._isSending = true;
	                _context2.prev = 1;
	                console.log("start sending", this._amountSent, "<", this._pendingEvents.length);
	                _loop = /*#__PURE__*/regeneratorRuntime.mark(function _loop() {
	                  var pendingEvent, response;
	                  return regeneratorRuntime.wrap(function _loop$(_context) {
	                    while (1) {
	                      switch (_context.prev = _context.next) {
	                        case 0:
	                          pendingEvent = _this._pendingEvents.get(_this._amountSent);
	                          console.log("trying to send", pendingEvent.content.body);

	                          if (!pendingEvent.remoteId) {
	                            _context.next = 4;
	                            break;
	                          }

	                          return _context.abrupt("return", "continue");

	                        case 4:
	                          console.log("really sending now");
	                          _context.next = 7;
	                          return _this._sendScheduler.request(function (hsApi) {
	                            console.log("got sendScheduler slot");
	                            return hsApi.send(pendingEvent.roomId, pendingEvent.eventType, pendingEvent.txnId, pendingEvent.content).response();
	                          });

	                        case 7:
	                          response = _context.sent;
	                          pendingEvent.remoteId = response.event_id; // 

	                          console.log("writing remoteId now");
	                          _context.next = 12;
	                          return _this._tryUpdateEvent(pendingEvent);

	                        case 12:
	                          console.log("keep sending?", _this._amountSent, "<", _this._pendingEvents.length);
	                          _this._amountSent += 1;

	                        case 14:
	                        case "end":
	                          return _context.stop();
	                      }
	                    }
	                  }, _loop);
	                });

	              case 4:
	                if (!(this._amountSent < this._pendingEvents.length)) {
	                  _context2.next = 11;
	                  break;
	                }

	                return _context2.delegateYield(_loop(), "t0", 6);

	              case 6:
	                _ret = _context2.t0;

	                if (!(_ret === "continue")) {
	                  _context2.next = 9;
	                  break;
	                }

	                return _context2.abrupt("continue", 4);

	              case 9:
	                _context2.next = 4;
	                break;

	              case 11:
	                _context2.next = 16;
	                break;

	              case 13:
	                _context2.prev = 13;
	                _context2.t1 = _context2["catch"](1);

	                if (_context2.t1 instanceof ConnectionError) {
	                  this._offline = true;
	                }

	              case 16:
	                _context2.prev = 16;
	                this._isSending = false;
	                return _context2.finish(16);

	              case 19:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee, this, [[1, 13, 16, 19]]);
	      }));

	      function _sendLoop() {
	        return _sendLoop2.apply(this, arguments);
	      }

	      return _sendLoop;
	    }()
	  }, {
	    key: "removeRemoteEchos",
	    value: function removeRemoteEchos(events, txn) {
	      var _this2 = this;

	      var removed = [];

	      var _iterator = _createForOfIteratorHelper(events),
	          _step;

	      try {
	        var _loop2 = function _loop2() {
	          var event = _step.value;
	          var txnId = event.unsigned && event.unsigned.transaction_id;
	          var idx = void 0;

	          if (txnId) {
	            idx = _this2._pendingEvents.array.findIndex(function (pe) {
	              return pe.txnId === txnId;
	            });
	          } else {
	            idx = _this2._pendingEvents.array.findIndex(function (pe) {
	              return pe.remoteId === event.event_id;
	            });
	          }

	          if (idx !== -1) {
	            var pendingEvent = _this2._pendingEvents.get(idx);

	            txn.pendingEvents.remove(pendingEvent.roomId, pendingEvent.queueIndex);
	            removed.push(pendingEvent);
	          }
	        };

	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          _loop2();
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }

	      return removed;
	    }
	  }, {
	    key: "emitRemovals",
	    value: function emitRemovals(pendingEvents) {
	      var _iterator2 = _createForOfIteratorHelper(pendingEvents),
	          _step2;

	      try {
	        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	          var pendingEvent = _step2.value;

	          var idx = this._pendingEvents.array.indexOf(pendingEvent);

	          if (idx !== -1) {
	            this._amountSent -= 1;

	            this._pendingEvents.remove(idx);
	          }
	        }
	      } catch (err) {
	        _iterator2.e(err);
	      } finally {
	        _iterator2.f();
	      }
	    }
	  }, {
	    key: "resumeSending",
	    value: function resumeSending() {
	      this._offline = false;

	      if (!this._isSending) {
	        this._sendLoop();
	      }
	    }
	  }, {
	    key: "enqueueEvent",
	    value: function () {
	      var _enqueueEvent = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(eventType, content) {
	        var pendingEvent;
	        return regeneratorRuntime.wrap(function _callee2$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                _context3.next = 2;
	                return this._createAndStoreEvent(eventType, content);

	              case 2:
	                pendingEvent = _context3.sent;

	                this._pendingEvents.set(pendingEvent);

	                console.log("added to _pendingEvents set", this._pendingEvents.length);

	                if (!this._isSending && !this._offline) {
	                  this._sendLoop();
	                }

	              case 6:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee2, this);
	      }));

	      function enqueueEvent(_x, _x2) {
	        return _enqueueEvent.apply(this, arguments);
	      }

	      return enqueueEvent;
	    }()
	  }, {
	    key: "_tryUpdateEvent",
	    value: function () {
	      var _tryUpdateEvent2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(pendingEvent) {
	        var txn;
	        return regeneratorRuntime.wrap(function _callee3$(_context4) {
	          while (1) {
	            switch (_context4.prev = _context4.next) {
	              case 0:
	                _context4.next = 2;
	                return this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);

	              case 2:
	                txn = _context4.sent;
	                console.log("_tryUpdateEvent: got txn");
	                _context4.prev = 4;
	                // pendingEvent might have been removed already here
	                // by a racing remote echo, so check first so we don't recreate it
	                console.log("_tryUpdateEvent: before exists");
	                _context4.next = 8;
	                return txn.pendingEvents.exists(pendingEvent.roomId, pendingEvent.queueIndex);

	              case 8:
	                if (!_context4.sent) {
	                  _context4.next = 11;
	                  break;
	                }

	                console.log("_tryUpdateEvent: inside if exists");
	                txn.pendingEvents.update(pendingEvent.data);

	              case 11:
	                console.log("_tryUpdateEvent: after exists");
	                _context4.next = 19;
	                break;

	              case 14:
	                _context4.prev = 14;
	                _context4.t0 = _context4["catch"](4);
	                txn.abort();
	                console.log("_tryUpdateEvent: error", _context4.t0);
	                throw _context4.t0;

	              case 19:
	                console.log("_tryUpdateEvent: try complete");
	                _context4.next = 22;
	                return txn.complete();

	              case 22:
	              case "end":
	                return _context4.stop();
	            }
	          }
	        }, _callee3, this, [[4, 14]]);
	      }));

	      function _tryUpdateEvent(_x3) {
	        return _tryUpdateEvent2.apply(this, arguments);
	      }

	      return _tryUpdateEvent;
	    }()
	  }, {
	    key: "_createAndStoreEvent",
	    value: function () {
	      var _createAndStoreEvent2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(eventType, content) {
	        var txn, pendingEvent, pendingEventsStore, maxQueueIndex, queueIndex;
	        return regeneratorRuntime.wrap(function _callee4$(_context5) {
	          while (1) {
	            switch (_context5.prev = _context5.next) {
	              case 0:
	                console.log("_createAndStoreEvent");
	                _context5.next = 3;
	                return this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);

	              case 3:
	                txn = _context5.sent;
	                _context5.prev = 4;
	                pendingEventsStore = txn.pendingEvents;
	                console.log("_createAndStoreEvent getting maxQueueIndex");
	                _context5.next = 9;
	                return pendingEventsStore.getMaxQueueIndex(this._roomId);

	              case 9:
	                _context5.t0 = _context5.sent;

	                if (_context5.t0) {
	                  _context5.next = 12;
	                  break;
	                }

	                _context5.t0 = 0;

	              case 12:
	                maxQueueIndex = _context5.t0;
	                console.log("_createAndStoreEvent got maxQueueIndex", maxQueueIndex);
	                queueIndex = maxQueueIndex + 1;
	                pendingEvent = new PendingEvent({
	                  roomId: this._roomId,
	                  queueIndex: queueIndex,
	                  eventType: eventType,
	                  content: content,
	                  txnId: makeTxnId()
	                });
	                console.log("_createAndStoreEvent: adding to pendingEventsStore");
	                pendingEventsStore.add(pendingEvent.data);
	                _context5.next = 24;
	                break;

	              case 20:
	                _context5.prev = 20;
	                _context5.t1 = _context5["catch"](4);
	                txn.abort();
	                throw _context5.t1;

	              case 24:
	                _context5.next = 26;
	                return txn.complete();

	              case 26:
	                return _context5.abrupt("return", pendingEvent);

	              case 27:
	              case "end":
	                return _context5.stop();
	            }
	          }
	        }, _callee4, this, [[4, 20]]);
	      }));

	      function _createAndStoreEvent(_x4, _x5) {
	        return _createAndStoreEvent2.apply(this, arguments);
	      }

	      return _createAndStoreEvent;
	    }()
	  }, {
	    key: "pendingEvents",
	    get: function get() {
	      return this._pendingEvents;
	    }
	  }]);

	  return SendQueue;
	}();

	var Room = /*#__PURE__*/function (_EventEmitter) {
	  _inherits(Room, _EventEmitter);

	  var _super = _createSuper(Room);

	  function Room(_ref) {
	    var _this;

	    var roomId = _ref.roomId,
	        storage = _ref.storage,
	        hsApi = _ref.hsApi,
	        emitCollectionChange = _ref.emitCollectionChange,
	        sendScheduler = _ref.sendScheduler,
	        pendingEvents = _ref.pendingEvents,
	        user = _ref.user;

	    _classCallCheck(this, Room);

	    _this = _super.call(this);
	    _this._roomId = roomId;
	    _this._storage = storage;
	    _this._hsApi = hsApi;
	    _this._summary = new RoomSummary(roomId);
	    _this._fragmentIdComparer = new FragmentIdComparer([]);
	    _this._syncWriter = new SyncWriter({
	      roomId: roomId,
	      fragmentIdComparer: _this._fragmentIdComparer
	    });
	    _this._emitCollectionChange = emitCollectionChange;
	    _this._sendQueue = new SendQueue({
	      roomId: roomId,
	      storage: storage,
	      sendScheduler: sendScheduler,
	      pendingEvents: pendingEvents
	    });
	    _this._timeline = null;
	    _this._user = user;
	    return _this;
	  }

	  _createClass(Room, [{
	    key: "writeSync",
	    value: function () {
	      var _writeSync = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(roomResponse, membership, txn) {
	        var summaryChanges, _yield$this$_syncWrit, entries, newLiveKey, removedPendingEvents;

	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                summaryChanges = this._summary.writeSync(roomResponse, membership, txn);
	                _context.next = 3;
	                return this._syncWriter.writeSync(roomResponse, txn);

	              case 3:
	                _yield$this$_syncWrit = _context.sent;
	                entries = _yield$this$_syncWrit.entries;
	                newLiveKey = _yield$this$_syncWrit.newLiveKey;

	                if (roomResponse.timeline && roomResponse.timeline.events) {
	                  removedPendingEvents = this._sendQueue.removeRemoteEchos(roomResponse.timeline.events, txn);
	                }

	                return _context.abrupt("return", {
	                  summaryChanges: summaryChanges,
	                  newTimelineEntries: entries,
	                  newLiveKey: newLiveKey,
	                  removedPendingEvents: removedPendingEvents
	                });

	              case 8:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function writeSync(_x, _x2, _x3) {
	        return _writeSync.apply(this, arguments);
	      }

	      return writeSync;
	    }()
	  }, {
	    key: "afterSync",
	    value: function afterSync(_ref2) {
	      var summaryChanges = _ref2.summaryChanges,
	          newTimelineEntries = _ref2.newTimelineEntries,
	          newLiveKey = _ref2.newLiveKey,
	          removedPendingEvents = _ref2.removedPendingEvents;

	      this._syncWriter.afterSync(newLiveKey);

	      if (summaryChanges) {
	        this._summary.afterSync(summaryChanges);

	        this.emit("change");

	        this._emitCollectionChange(this);
	      }

	      if (this._timeline) {
	        this._timeline.appendLiveEntries(newTimelineEntries);
	      }

	      if (removedPendingEvents) {
	        this._sendQueue.emitRemovals(removedPendingEvents);
	      }
	    }
	  }, {
	    key: "resumeSending",
	    value: function resumeSending() {
	      this._sendQueue.resumeSending();
	    }
	  }, {
	    key: "load",
	    value: function load(summary, txn) {
	      this._summary.load(summary);

	      return this._syncWriter.load(txn);
	    }
	  }, {
	    key: "sendEvent",
	    value: function sendEvent(eventType, content) {
	      return this._sendQueue.enqueueEvent(eventType, content);
	    }
	    /** @public */

	  }, {
	    key: "fillGap",
	    value: function () {
	      var _fillGap = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(fragmentEntry, amount) {
	        var response, txn, removedPendingEvents, gapResult, gapWriter, _iterator, _step, fragment;

	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                _context2.next = 2;
	                return this._hsApi.messages(this._roomId, {
	                  from: fragmentEntry.token,
	                  dir: fragmentEntry.direction.asApiString(),
	                  limit: amount,
	                  filter: {
	                    lazy_load_members: true
	                  }
	                }).response();

	              case 2:
	                response = _context2.sent;
	                _context2.next = 5;
	                return this._storage.readWriteTxn([this._storage.storeNames.pendingEvents, this._storage.storeNames.timelineEvents, this._storage.storeNames.timelineFragments]);

	              case 5:
	                txn = _context2.sent;
	                _context2.prev = 6;
	                // detect remote echos of pending messages in the gap
	                removedPendingEvents = this._sendQueue.removeRemoteEchos(response.chunk, txn); // write new events into gap

	                gapWriter = new GapWriter({
	                  roomId: this._roomId,
	                  storage: this._storage,
	                  fragmentIdComparer: this._fragmentIdComparer
	                });
	                _context2.next = 11;
	                return gapWriter.writeFragmentFill(fragmentEntry, response, txn);

	              case 11:
	                gapResult = _context2.sent;
	                _context2.next = 18;
	                break;

	              case 14:
	                _context2.prev = 14;
	                _context2.t0 = _context2["catch"](6);
	                txn.abort();
	                throw _context2.t0;

	              case 18:
	                _context2.next = 20;
	                return txn.complete();

	              case 20:
	                // once txn is committed, update in-memory state & emit events
	                _iterator = _createForOfIteratorHelper(gapResult.fragments);

	                try {
	                  for (_iterator.s(); !(_step = _iterator.n()).done;) {
	                    fragment = _step.value;

	                    this._fragmentIdComparer.add(fragment);
	                  }
	                } catch (err) {
	                  _iterator.e(err);
	                } finally {
	                  _iterator.f();
	                }

	                if (removedPendingEvents) {
	                  this._sendQueue.emitRemovals(removedPendingEvents);
	                }

	                if (this._timeline) {
	                  this._timeline.addGapEntries(gapResult.entries);
	                }

	              case 24:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this, [[6, 14]]);
	      }));

	      function fillGap(_x4, _x5) {
	        return _fillGap.apply(this, arguments);
	      }

	      return fillGap;
	    }()
	  }, {
	    key: "openTimeline",
	    value: function () {
	      var _openTimeline = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
	        var _this2 = this;

	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                if (!this._timeline) {
	                  _context3.next = 2;
	                  break;
	                }

	                throw new Error("not dealing with load race here for now");

	              case 2:
	                console.log("opening the timeline for ".concat(this._roomId));
	                this._timeline = new Timeline({
	                  roomId: this.id,
	                  storage: this._storage,
	                  fragmentIdComparer: this._fragmentIdComparer,
	                  pendingEvents: this._sendQueue.pendingEvents,
	                  closeCallback: function closeCallback() {
	                    console.log("closing the timeline for ".concat(_this2._roomId));
	                    _this2._timeline = null;
	                  },
	                  user: this._user
	                });
	                _context3.next = 6;
	                return this._timeline.load();

	              case 6:
	                return _context3.abrupt("return", this._timeline);

	              case 7:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3, this);
	      }));

	      function openTimeline() {
	        return _openTimeline.apply(this, arguments);
	      }

	      return openTimeline;
	    }()
	  }, {
	    key: "mxcUrlThumbnail",
	    value: function mxcUrlThumbnail(url, width, height, method) {
	      return this._hsApi.mxcUrlThumbnail(url, width, height, method);
	    }
	  }, {
	    key: "mxcUrl",
	    value: function mxcUrl(url) {
	      return this._hsApi.mxcUrl(url);
	    }
	  }, {
	    key: "name",
	    get: function get() {
	      return this._summary.name;
	    }
	  }, {
	    key: "id",
	    get: function get() {
	      return this._roomId;
	    }
	  }]);

	  return Room;
	}(EventEmitter);

	var RateLimitingBackoff = /*#__PURE__*/function () {
	  function RateLimitingBackoff() {
	    _classCallCheck(this, RateLimitingBackoff);

	    this._remainingRateLimitedRequest = 0;
	  }

	  _createClass(RateLimitingBackoff, [{
	    key: "waitAfterLimitExceeded",
	    value: function () {
	      var _waitAfterLimitExceeded = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(retryAfterMs) {
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                // this._remainingRateLimitedRequest = 5;
	                // if (typeof retryAfterMs !== "number") {
	                // } else {
	                // }
	                if (!retryAfterMs) {
	                  retryAfterMs = 5000;
	                }

	                _context.next = 3;
	                return WebPlatform.delay(retryAfterMs);

	              case 3:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee);
	      }));

	      function waitAfterLimitExceeded(_x) {
	        return _waitAfterLimitExceeded.apply(this, arguments);
	      }

	      return waitAfterLimitExceeded;
	    }() // do we have to know about succeeding requests?
	    // we can just 

	  }, {
	    key: "waitForNextSend",
	    value: function () {
	      var _waitForNextSend = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2);
	      }));

	      function waitForNextSend() {
	        return _waitForNextSend.apply(this, arguments);
	      }

	      return waitForNextSend;
	    }()
	  }]);

	  return RateLimitingBackoff;
	}();
	/*
	this represents a slot to do one rate limited api call.
	because rate-limiting is handled here, it should only
	try to do one call, so the SendScheduler can safely
	retry if the call ends up being rate limited.
	This is also why we have this abstraction it hsApi is not
	passed straight to SendQueue when it is its turn to send.
	e.g. we wouldn't want to repeat the callback in SendQueue that could
	have other side-effects before the call to hsApi that we wouldn't want
	repeated (setting up progress handlers for file uploads,
	... a UI update to say it started sending?
	 ... updating storage would probably only happen once the call succeeded
	 ... doing multiple hsApi calls for e.g. a file upload before sending a image message (they should individually be retried)
	) maybe it is a bit overengineering, but lets stick with it for now.
	At least the above is a clear definition why we have this class
	*/
	//class SendSlot -- obsolete

	var SendScheduler = /*#__PURE__*/function () {
	  function SendScheduler(_ref) {
	    var hsApi = _ref.hsApi,
	        backoff = _ref.backoff;

	    _classCallCheck(this, SendScheduler);

	    this._hsApi = hsApi;
	    this._sendRequests = [];
	    this._sendScheduled = false;
	    this._stopped = false;
	    this._waitTime = 0;
	    this._backoff = backoff;
	    /* 
	    we should have some sort of flag here that we enable
	    after all the rooms have been notified that they can resume
	    sending, so that from session, we can say scheduler.enable();
	    this way, when we have better scheduling, it won't be first come,
	    first serve, when there are a lot of events in different rooms to send,
	    but we can apply some priorization of who should go first
	    */
	    // this._enabled;
	  }

	  _createClass(SendScheduler, [{
	    key: "stop",
	    value: function stop() {// TODO: abort current requests and set offline
	    }
	  }, {
	    key: "start",
	    value: function start() {
	      this._stopped = false;
	    }
	  }, {
	    key: "request",
	    // this should really be per roomId to avoid head-of-line blocking
	    // 
	    // takes a callback instead of returning a promise with the slot
	    // to make sure the scheduler doesn't get blocked by a slot that is not consumed
	    value: function request(sendCallback) {
	      var request;
	      var promise = new Promise(function (resolve, reject) {
	        return request = {
	          resolve: resolve,
	          reject: reject,
	          sendCallback: sendCallback
	        };
	      });

	      this._sendRequests.push(request);

	      if (!this._sendScheduled && !this._stopped) {
	        this._sendLoop();
	      }

	      return promise;
	    }
	  }, {
	    key: "_sendLoop",
	    value: function () {
	      var _sendLoop2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
	        var request, result, _iterator, _step, r;

	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                if (!this._sendRequests.length) {
	                  _context3.next = 18;
	                  break;
	                }

	                request = this._sendRequests.shift();
	                result = void 0;
	                _context3.prev = 3;
	                _context3.next = 6;
	                return this._doSend(request.sendCallback);

	              case 6:
	                result = _context3.sent;
	                _context3.next = 15;
	                break;

	              case 9:
	                _context3.prev = 9;
	                _context3.t0 = _context3["catch"](3);

	                if (_context3.t0 instanceof ConnectionError) {
	                  // we're offline, everybody will have
	                  // to re-request slots when we come back online
	                  this._stopped = true;
	                  _iterator = _createForOfIteratorHelper(this._sendRequests);

	                  try {
	                    for (_iterator.s(); !(_step = _iterator.n()).done;) {
	                      r = _step.value;
	                      r.reject(_context3.t0);
	                    }
	                  } catch (err) {
	                    _iterator.e(_context3.t0);
	                  } finally {
	                    _iterator.f();
	                  }

	                  this._sendRequests = [];
	                }

	                console.error("error for request", request);
	                request.reject(_context3.t0);
	                return _context3.abrupt("break", 18);

	              case 15:
	                request.resolve(result);
	                _context3.next = 0;
	                break;

	              case 18:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3, this, [[3, 9]]);
	      }));

	      function _sendLoop() {
	        return _sendLoop2.apply(this, arguments);
	      }

	      return _sendLoop;
	    }()
	  }, {
	    key: "_doSend",
	    value: function () {
	      var _doSend2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(sendCallback) {
	        return regeneratorRuntime.wrap(function _callee4$(_context4) {
	          while (1) {
	            switch (_context4.prev = _context4.next) {
	              case 0:
	                this._sendScheduled = false;
	                _context4.next = 3;
	                return this._backoff.waitForNextSend();

	              case 3:

	                _context4.prev = 4;
	                _context4.next = 7;
	                return sendCallback(this._hsApi);

	              case 7:
	                return _context4.abrupt("return", _context4.sent);

	              case 10:
	                _context4.prev = 10;
	                _context4.t0 = _context4["catch"](4);

	                if (!(_context4.t0 instanceof HomeServerError && _context4.t0.errcode === "M_LIMIT_EXCEEDED")) {
	                  _context4.next = 17;
	                  break;
	                }

	                _context4.next = 15;
	                return this._backoff.waitAfterLimitExceeded(_context4.t0.retry_after_ms);

	              case 15:
	                _context4.next = 18;
	                break;

	              case 17:
	                throw _context4.t0;

	              case 18:
	                _context4.next = 3;
	                break;

	              case 20:
	              case "end":
	                return _context4.stop();
	            }
	          }
	        }, _callee4, this, [[4, 10]]);
	      }));

	      function _doSend(_x2) {
	        return _doSend2.apply(this, arguments);
	      }

	      return _doSend;
	    }()
	  }, {
	    key: "isStarted",
	    get: function get() {
	      return !this._stopped;
	    }
	  }]);

	  return SendScheduler;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var User = /*#__PURE__*/function () {
	  function User(userId) {
	    _classCallCheck(this, User);

	    this._userId = userId;
	  }

	  _createClass(User, [{
	    key: "id",
	    get: function get() {
	      return this._userId;
	    }
	  }]);

	  return User;
	}();

	var Session = /*#__PURE__*/function () {
	  // sessionInfo contains deviceId, userId and homeServer
	  function Session(_ref) {
	    var _this = this;

	    var storage = _ref.storage,
	        hsApi = _ref.hsApi,
	        sessionInfo = _ref.sessionInfo;

	    _classCallCheck(this, Session);

	    this._storage = storage;
	    this._hsApi = hsApi;
	    this._session = null;
	    this._sessionInfo = sessionInfo;
	    this._rooms = new ObservableMap();
	    this._sendScheduler = new SendScheduler({
	      hsApi: hsApi,
	      backoff: new RateLimitingBackoff()
	    });

	    this._roomUpdateCallback = function (room, params) {
	      return _this._rooms.update(room.id, params);
	    };

	    this._user = new User(sessionInfo.userId);
	  }

	  _createClass(Session, [{
	    key: "load",
	    value: function () {
	      var _load = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        var _this2 = this;

	        var txn, pendingEventsByRoomId, rooms;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _context.next = 2;
	                return this._storage.readTxn([this._storage.storeNames.session, this._storage.storeNames.roomSummary, this._storage.storeNames.roomState, this._storage.storeNames.timelineEvents, this._storage.storeNames.timelineFragments, this._storage.storeNames.pendingEvents]);

	              case 2:
	                txn = _context.sent;
	                _context.next = 5;
	                return txn.session.get();

	              case 5:
	                this._session = _context.sent;

	                if (this._session) {
	                  _context.next = 9;
	                  break;
	                }

	                this._session = {};
	                return _context.abrupt("return");

	              case 9:
	                _context.next = 11;
	                return this._getPendingEventsByRoom(txn);

	              case 11:
	                pendingEventsByRoomId = _context.sent;
	                _context.next = 14;
	                return txn.roomSummary.getAll();

	              case 14:
	                rooms = _context.sent;
	                _context.next = 17;
	                return Promise.all(rooms.map(function (summary) {
	                  var room = _this2.createRoom(summary.roomId, pendingEventsByRoomId.get(summary.roomId));

	                  return room.load(summary, txn);
	                }));

	              case 17:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function load() {
	        return _load.apply(this, arguments);
	      }

	      return load;
	    }()
	  }, {
	    key: "stop",
	    value: function stop() {
	      this._sendScheduler.stop();
	    }
	  }, {
	    key: "start",
	    value: function () {
	      var _start = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(lastVersionResponse) {
	        var txn, newSessionData, _iterator, _step, _step$value, room;

	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                if (!lastVersionResponse) {
	                  _context2.next = 9;
	                  break;
	                }

	                _context2.next = 3;
	                return this._storage.readWriteTxn([this._storage.storeNames.session]);

	              case 3:
	                txn = _context2.sent;
	                newSessionData = Object.assign({}, this._session, {
	                  serverVersions: lastVersionResponse
	                });
	                txn.session.set(newSessionData); // TODO: what can we do if this throws?

	                _context2.next = 8;
	                return txn.complete();

	              case 8:
	                this._session = newSessionData;

	              case 9:
	                this._sendScheduler.start();

	                _iterator = _createForOfIteratorHelper(this._rooms);

	                try {
	                  for (_iterator.s(); !(_step = _iterator.n()).done;) {
	                    _step$value = _slicedToArray(_step.value, 2), room = _step$value[1];
	                    room.resumeSending();
	                  }
	                } catch (err) {
	                  _iterator.e(err);
	                } finally {
	                  _iterator.f();
	                }

	              case 12:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this);
	      }));

	      function start(_x) {
	        return _start.apply(this, arguments);
	      }

	      return start;
	    }()
	  }, {
	    key: "_getPendingEventsByRoom",
	    value: function () {
	      var _getPendingEventsByRoom2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(txn) {
	        var pendingEvents;
	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                _context3.next = 2;
	                return txn.pendingEvents.getAll();

	              case 2:
	                pendingEvents = _context3.sent;
	                return _context3.abrupt("return", pendingEvents.reduce(function (groups, pe) {
	                  var group = groups.get(pe.roomId);

	                  if (group) {
	                    group.push(pe);
	                  } else {
	                    groups.set(pe.roomId, [pe]);
	                  }

	                  return groups;
	                }, new Map()));

	              case 4:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3);
	      }));

	      function _getPendingEventsByRoom(_x2) {
	        return _getPendingEventsByRoom2.apply(this, arguments);
	      }

	      return _getPendingEventsByRoom;
	    }()
	  }, {
	    key: "createRoom",
	    value: function createRoom(roomId, pendingEvents) {
	      var room = new Room({
	        roomId: roomId,
	        storage: this._storage,
	        emitCollectionChange: this._roomUpdateCallback,
	        hsApi: this._hsApi,
	        sendScheduler: this._sendScheduler,
	        pendingEvents: pendingEvents,
	        user: this._user
	      });

	      this._rooms.add(roomId, room);

	      return room;
	    }
	  }, {
	    key: "writeSync",
	    value: function writeSync(syncToken, syncFilterId, accountData, txn) {
	      if (syncToken !== this._session.syncToken) {
	        // don't modify this._session because transaction might still fail
	        var newSessionData = Object.assign({}, this._session, {
	          syncToken: syncToken,
	          syncFilterId: syncFilterId
	        });
	        txn.session.set(newSessionData);
	        return newSessionData;
	      }
	    }
	  }, {
	    key: "afterSync",
	    value: function afterSync(newSessionData) {
	      if (newSessionData) {
	        // sync transaction succeeded, modify object state now
	        this._session = newSessionData;
	      }
	    }
	  }, {
	    key: "isStarted",
	    get: function get() {
	      return this._sendScheduler.isStarted;
	    }
	  }, {
	    key: "rooms",
	    get: function get() {
	      return this._rooms;
	    }
	  }, {
	    key: "syncToken",
	    get: function get() {
	      return this._session.syncToken;
	    }
	  }, {
	    key: "syncFilterId",
	    get: function get() {
	      return this._session.syncFilterId;
	    }
	  }, {
	    key: "user",
	    get: function get() {
	      return this._user;
	    }
	  }]);

	  return Session;
	}();

	var LoadStatus = createEnum("NotLoading", "Login", "LoginFailed", "Loading", "Migrating", //not used atm, but would fit here
	"FirstSync", "Error", "Ready");
	var LoginFailure = createEnum("Connection", "Credentials", "Unknown");
	var SessionContainer = /*#__PURE__*/function () {
	  function SessionContainer(_ref) {
	    var clock = _ref.clock,
	        random = _ref.random,
	        onlineStatus = _ref.onlineStatus,
	        request = _ref.request,
	        storageFactory = _ref.storageFactory,
	        sessionInfoStorage = _ref.sessionInfoStorage;

	    _classCallCheck(this, SessionContainer);

	    this._random = random;
	    this._clock = clock;
	    this._onlineStatus = onlineStatus;
	    this._request = request;
	    this._storageFactory = storageFactory;
	    this._sessionInfoStorage = sessionInfoStorage;
	    this._status = new ObservableValue(LoadStatus.NotLoading);
	    this._error = null;
	    this._loginFailure = null;
	    this._reconnector = null;
	    this._session = null;
	    this._sync = null;
	    this._sessionId = null;
	    this._storage = null;
	  }

	  _createClass(SessionContainer, [{
	    key: "createNewSessionId",
	    value: function createNewSessionId() {
	      return Math.floor(this._random() * Number.MAX_SAFE_INTEGER).toString();
	    }
	  }, {
	    key: "startWithExistingSession",
	    value: function () {
	      var _startWithExistingSession = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(sessionId) {
	        var sessionInfo;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                if (!(this._status.get() !== LoadStatus.NotLoading)) {
	                  _context.next = 2;
	                  break;
	                }

	                return _context.abrupt("return");

	              case 2:
	                this._status.set(LoadStatus.Loading);

	                _context.prev = 3;
	                _context.next = 6;
	                return this._sessionInfoStorage.get(sessionId);

	              case 6:
	                sessionInfo = _context.sent;

	                if (sessionInfo) {
	                  _context.next = 9;
	                  break;
	                }

	                throw new Error("Invalid session id: " + sessionId);

	              case 9:
	                _context.next = 11;
	                return this._loadSessionInfo(sessionInfo);

	              case 11:
	                _context.next = 17;
	                break;

	              case 13:
	                _context.prev = 13;
	                _context.t0 = _context["catch"](3);
	                this._error = _context.t0;

	                this._status.set(LoadStatus.Error);

	              case 17:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this, [[3, 13]]);
	      }));

	      function startWithExistingSession(_x) {
	        return _startWithExistingSession.apply(this, arguments);
	      }

	      return startWithExistingSession;
	    }()
	  }, {
	    key: "startWithLogin",
	    value: function () {
	      var _startWithLogin = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(homeServer, username, password) {
	        var sessionInfo, hsApi, loginData, sessionId;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                if (!(this._status.get() !== LoadStatus.NotLoading)) {
	                  _context2.next = 2;
	                  break;
	                }

	                return _context2.abrupt("return");

	              case 2:
	                this._status.set(LoadStatus.Login);

	                _context2.prev = 3;
	                hsApi = new HomeServerApi({
	                  homeServer: homeServer,
	                  request: this._request,
	                  createTimeout: this._clock.createTimeout
	                });
	                _context2.next = 7;
	                return hsApi.passwordLogin(username, password).response();

	              case 7:
	                loginData = _context2.sent;
	                sessionId = this.createNewSessionId();
	                sessionInfo = {
	                  id: sessionId,
	                  deviceId: loginData.device_id,
	                  userId: loginData.user_id,
	                  homeServer: homeServer,
	                  accessToken: loginData.access_token,
	                  lastUsed: this._clock.now()
	                };
	                _context2.next = 12;
	                return this._sessionInfoStorage.add(sessionInfo);

	              case 12:
	                _context2.next = 19;
	                break;

	              case 14:
	                _context2.prev = 14;
	                _context2.t0 = _context2["catch"](3);
	                this._error = _context2.t0;

	                if (_context2.t0 instanceof HomeServerError) {
	                  if (_context2.t0.errcode === "M_FORBIDDEN") {
	                    this._loginFailure = LoginFailure.Credentials;
	                  } else {
	                    this._loginFailure = LoginFailure.Unknown;
	                  }

	                  this._status.set(LoadStatus.LoginFailed);
	                } else if (_context2.t0 instanceof ConnectionError) {
	                  this._loginFailure = LoginFailure.Connection;

	                  this._status.set(LoadStatus.LoginFailure);
	                } else {
	                  this._status.set(LoadStatus.Error);
	                }

	                return _context2.abrupt("return");

	              case 19:
	                _context2.prev = 19;
	                _context2.next = 22;
	                return this._loadSessionInfo(sessionInfo);

	              case 22:
	                _context2.next = 28;
	                break;

	              case 24:
	                _context2.prev = 24;
	                _context2.t1 = _context2["catch"](19);
	                this._error = _context2.t1;

	                this._status.set(LoadStatus.Error);

	              case 28:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this, [[3, 14], [19, 24]]);
	      }));

	      function startWithLogin(_x2, _x3, _x4) {
	        return _startWithLogin.apply(this, arguments);
	      }

	      return startWithLogin;
	    }()
	  }, {
	    key: "_loadSessionInfo",
	    value: function () {
	      var _loadSessionInfo2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(sessionInfo) {
	        var _this = this;

	        var hsApi, filteredSessionInfo, lastVersionsResponse;
	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                this._status.set(LoadStatus.Loading);

	                this._reconnector = new Reconnector({
	                  onlineStatus: this._onlineStatus,
	                  retryDelay: new ExponentialRetryDelay(this._clock.createTimeout),
	                  createMeasure: this._clock.createMeasure
	                });
	                hsApi = new HomeServerApi({
	                  homeServer: sessionInfo.homeServer,
	                  accessToken: sessionInfo.accessToken,
	                  request: this._request,
	                  reconnector: this._reconnector,
	                  createTimeout: this._clock.createTimeout
	                });
	                this._sessionId = sessionInfo.id;
	                _context3.next = 6;
	                return this._storageFactory.create(sessionInfo.id);

	              case 6:
	                this._storage = _context3.sent;
	                // no need to pass access token to session
	                filteredSessionInfo = {
	                  deviceId: sessionInfo.deviceId,
	                  userId: sessionInfo.userId,
	                  homeServer: sessionInfo.homeServer
	                };
	                this._session = new Session({
	                  storage: this._storage,
	                  sessionInfo: filteredSessionInfo,
	                  hsApi: hsApi
	                });
	                _context3.next = 11;
	                return this._session.load();

	              case 11:
	                this._sync = new Sync({
	                  hsApi: hsApi,
	                  storage: this._storage,
	                  session: this._session
	                }); // notify sync and session when back online

	                this._reconnectSubscription = this._reconnector.connectionStatus.subscribe(function (state) {
	                  if (state === ConnectionStatus.Online) {
	                    _this._sync.start();

	                    _this._session.start(_this._reconnector.lastVersionsResponse);
	                  }
	                });
	                _context3.next = 15;
	                return this._waitForFirstSync();

	              case 15:
	                this._status.set(LoadStatus.Ready); // if the sync failed, and then the reconnector
	                // restored the connection, it would have already
	                // started to session, so check first
	                // to prevent an extra /versions request
	                // TODO: this doesn't look logical, but works. Why?
	                // I think because isStarted is true by default. That's probably not what we intend.
	                // I think there is a bug here, in that even if the reconnector already started the session, we'd still do this.


	                if (!this._session.isStarted) {
	                  _context3.next = 21;
	                  break;
	                }

	                _context3.next = 19;
	                return hsApi.versions({
	                  timeout: 10000
	                }).response();

	              case 19:
	                lastVersionsResponse = _context3.sent;

	                this._session.start(lastVersionsResponse);

	              case 21:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3, this);
	      }));

	      function _loadSessionInfo(_x5) {
	        return _loadSessionInfo2.apply(this, arguments);
	      }

	      return _loadSessionInfo;
	    }()
	  }, {
	    key: "_waitForFirstSync",
	    value: function () {
	      var _waitForFirstSync2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
	        return regeneratorRuntime.wrap(function _callee4$(_context4) {
	          while (1) {
	            switch (_context4.prev = _context4.next) {
	              case 0:
	                _context4.prev = 0;

	                this._sync.start();

	                this._status.set(LoadStatus.FirstSync);

	                _context4.next = 9;
	                break;

	              case 5:
	                _context4.prev = 5;
	                _context4.t0 = _context4["catch"](0);

	                if (_context4.t0 instanceof ConnectionError) {
	                  _context4.next = 9;
	                  break;
	                }

	                throw _context4.t0;

	              case 9:
	                // only transition into Ready once the first sync has succeeded
	                this._waitForFirstSyncHandle = this._sync.status.waitFor(function (s) {
	                  return s === SyncStatus.Syncing;
	                });
	                _context4.prev = 10;
	                _context4.next = 13;
	                return this._waitForFirstSyncHandle.promise;

	              case 13:
	                _context4.next = 20;
	                break;

	              case 15:
	                _context4.prev = 15;
	                _context4.t1 = _context4["catch"](10);

	                if (!(_context4.t1 instanceof AbortError)) {
	                  _context4.next = 19;
	                  break;
	                }

	                return _context4.abrupt("return");

	              case 19:
	                throw _context4.t1;

	              case 20:
	                _context4.prev = 20;
	                this._waitForFirstSyncHandle = null;
	                return _context4.finish(20);

	              case 23:
	              case "end":
	                return _context4.stop();
	            }
	          }
	        }, _callee4, this, [[0, 5], [10, 15, 20, 23]]);
	      }));

	      function _waitForFirstSync() {
	        return _waitForFirstSync2.apply(this, arguments);
	      }

	      return _waitForFirstSync;
	    }()
	  }, {
	    key: "stop",
	    value: function stop() {
	      this._reconnectSubscription();

	      this._reconnectSubscription = null;

	      this._sync.stop();

	      this._session.stop();

	      if (this._waitForFirstSyncHandle) {
	        this._waitForFirstSyncHandle.dispose();

	        this._waitForFirstSyncHandle = null;
	      }

	      if (this._storage) {
	        this._storage.close();

	        this._storage = null;
	      }
	    }
	  }, {
	    key: "deleteSession",
	    value: function () {
	      var _deleteSession = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
	        return regeneratorRuntime.wrap(function _callee5$(_context5) {
	          while (1) {
	            switch (_context5.prev = _context5.next) {
	              case 0:
	                if (!this._sessionId) {
	                  _context5.next = 4;
	                  break;
	                }

	                _context5.next = 3;
	                return Promise.all([this._storageFactory.delete(this._sessionId), this._sessionInfoStorage.delete(this._sessionId)]);

	              case 3:
	                this._sessionId = null;

	              case 4:
	              case "end":
	                return _context5.stop();
	            }
	          }
	        }, _callee5, this);
	      }));

	      function deleteSession() {
	        return _deleteSession.apply(this, arguments);
	      }

	      return deleteSession;
	    }()
	  }, {
	    key: "loadStatus",
	    get: function get() {
	      return this._status;
	    }
	  }, {
	    key: "loadError",
	    get: function get() {
	      return this._error;
	    }
	    /** only set at loadStatus InitialSync, CatchupSync or Ready */

	  }, {
	    key: "sync",
	    get: function get() {
	      return this._sync;
	    }
	    /** only set at loadStatus InitialSync, CatchupSync or Ready */

	  }, {
	    key: "session",
	    get: function get() {
	      return this._session;
	    }
	  }, {
	    key: "reconnector",
	    get: function get() {
	      return this._reconnector;
	    }
	  }]);

	  return SessionContainer;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var STORE_NAMES = Object.freeze(["session", "roomState", "roomSummary", "timelineEvents", "timelineFragments", "pendingEvents"]);
	var STORE_MAP = Object.freeze(STORE_NAMES.reduce(function (nameMap, name) {
	  nameMap[name] = name;
	  return nameMap;
	}, {}));
	var StorageError = /*#__PURE__*/function (_Error) {
	  _inherits(StorageError, _Error);

	  var _super = _createSuper(StorageError);

	  function StorageError(message, cause, value) {
	    var _this;

	    _classCallCheck(this, StorageError);

	    var fullMessage = message;

	    if (cause) {
	      fullMessage += ": ";

	      if (typeof cause.name === "string") {
	        fullMessage += "(name: ".concat(cause.name, ") ");
	      }

	      if (typeof cause.code === "number") {
	        fullMessage += "(code: ".concat(cause.name, ") ");
	      }

	      fullMessage += cause.message;
	    }

	    _this = _super.call(this, fullMessage);

	    if (cause) {
	      _this.errcode = cause.name;
	    }

	    _this.cause = cause;
	    _this.value = value;
	    return _this;
	  }

	  return StorageError;
	}( /*#__PURE__*/_wrapNativeSuper(Error));

	function encodeUint32(n) {
	  var hex = n.toString(16);
	  return "0".repeat(8 - hex.length) + hex;
	}
	function decodeUint32(str) {
	  return parseInt(str, 16);
	}
	function openDatabase(name, createObjectStore, version) {
	  var req = window.indexedDB.open(name, version);

	  req.onupgradeneeded = function (ev) {
	    var db = ev.target.result;
	    var oldVersion = ev.oldVersion;
	    createObjectStore(db, oldVersion, version);
	  };

	  return reqAsPromise(req);
	}

	function wrapError(err) {
	  return new StorageError("wrapped DOMException", err);
	}

	function reqAsPromise(req) {
	  return new Promise(function (resolve, reject) {
	    req.addEventListener("success", function (event) {
	      return resolve(event.target.result);
	    });
	    req.addEventListener("error", function (event) {
	      return reject(wrapError(event.target.error));
	    });
	  });
	}
	function txnAsPromise(txn) {
	  return new Promise(function (resolve, reject) {
	    txn.addEventListener("complete", resolve);
	    txn.addEventListener("abort", function (event) {
	      return reject(wrapError(event.target.error));
	    });
	  });
	}
	function iterateCursor(cursorRequest, processValue) {
	  // TODO: does cursor already have a value here??
	  return new Promise(function (resolve, reject) {
	    cursorRequest.onerror = function () {
	      reject(new StorageError("Query failed", cursorRequest.error));
	    }; // collect results


	    cursorRequest.onsuccess = function (event) {
	      var cursor = event.target.result;

	      if (!cursor) {
	        resolve(false);
	        return; // end of results
	      }

	      var _processValue = processValue(cursor.value, cursor.key),
	          done = _processValue.done,
	          jumpTo = _processValue.jumpTo;

	      if (done) {
	        resolve(true);
	      } else if (jumpTo) {
	        cursor.continue(jumpTo);
	      } else {
	        cursor.continue();
	      }
	    };
	  }).catch(function (err) {
	    throw new StorageError("iterateCursor failed", err);
	  });
	}

	var QueryTarget = /*#__PURE__*/function () {
	  function QueryTarget(target) {
	    _classCallCheck(this, QueryTarget);

	    this._target = target;
	  }

	  _createClass(QueryTarget, [{
	    key: "_openCursor",
	    value: function _openCursor(range, direction) {
	      if (range && direction) {
	        return this._target.openCursor(range, direction);
	      } else if (range) {
	        return this._target.openCursor(range);
	      } else if (direction) {
	        return this._target.openCursor(null, direction);
	      } else {
	        return this._target.openCursor();
	      }
	    }
	  }, {
	    key: "supports",
	    value: function supports(methodName) {
	      return this._target.supports(methodName);
	    }
	  }, {
	    key: "get",
	    value: function get(key) {
	      return reqAsPromise(this._target.get(key));
	    }
	  }, {
	    key: "getKey",
	    value: function getKey(key) {
	      return reqAsPromise(this._target.getKey(key));
	    }
	  }, {
	    key: "reduce",
	    value: function reduce(range, reducer, initialValue) {
	      return this._reduce(range, reducer, initialValue, "next");
	    }
	  }, {
	    key: "reduceReverse",
	    value: function reduceReverse(range, reducer, initialValue) {
	      return this._reduce(range, reducer, initialValue, "prev");
	    }
	  }, {
	    key: "selectLimit",
	    value: function selectLimit(range, amount) {
	      return this._selectLimit(range, amount, "next");
	    }
	  }, {
	    key: "selectLimitReverse",
	    value: function selectLimitReverse(range, amount) {
	      return this._selectLimit(range, amount, "prev");
	    }
	  }, {
	    key: "selectWhile",
	    value: function selectWhile(range, predicate) {
	      return this._selectWhile(range, predicate, "next");
	    }
	  }, {
	    key: "selectWhileReverse",
	    value: function selectWhileReverse(range, predicate) {
	      return this._selectWhile(range, predicate, "prev");
	    }
	  }, {
	    key: "selectAll",
	    value: function () {
	      var _selectAll = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(range, direction) {
	        var cursor, results;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                cursor = this._openCursor(range, direction);
	                results = [];
	                _context.next = 4;
	                return iterateCursor(cursor, function (value) {
	                  results.push(value);
	                  return {
	                    done: false
	                  };
	                });

	              case 4:
	                return _context.abrupt("return", results);

	              case 5:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function selectAll(_x, _x2) {
	        return _selectAll.apply(this, arguments);
	      }

	      return selectAll;
	    }()
	  }, {
	    key: "selectFirst",
	    value: function selectFirst(range) {
	      return this._find(range, function () {
	        return true;
	      }, "next");
	    }
	  }, {
	    key: "selectLast",
	    value: function selectLast(range) {
	      return this._find(range, function () {
	        return true;
	      }, "prev");
	    }
	  }, {
	    key: "find",
	    value: function find(range, predicate) {
	      return this._find(range, predicate, "next");
	    }
	  }, {
	    key: "findReverse",
	    value: function findReverse(range, predicate) {
	      return this._find(range, predicate, "prev");
	    }
	  }, {
	    key: "findMaxKey",
	    value: function () {
	      var _findMaxKey = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(range) {
	        var cursor, maxKey;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                cursor = this._target.openKeyCursor(range, "prev");
	                _context2.next = 3;
	                return iterateCursor(cursor, function (_, key) {
	                  maxKey = key;
	                  return {
	                    done: true
	                  };
	                });

	              case 3:
	                return _context2.abrupt("return", maxKey);

	              case 4:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this);
	      }));

	      function findMaxKey(_x3) {
	        return _findMaxKey.apply(this, arguments);
	      }

	      return findMaxKey;
	    }()
	    /**
	     * Checks if a given set of keys exist.
	     * Calls `callback(key, found)` for each key in `keys`, in key sorting order (or reversed if backwards=true).
	     * If the callback returns true, the search is halted and callback won't be called again.
	     * `callback` is called with the same instances of the key as given in `keys`, so direct comparison can be used.
	     */

	  }, {
	    key: "findExistingKeys",
	    value: function () {
	      var _findExistingKeys = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(keys, backwards, callback) {
	        var direction, compareKeys, sortedKeys, firstKey, lastKey, cursor, i, consumerDone;
	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                direction = backwards ? "prev" : "next";

	                compareKeys = function compareKeys(a, b) {
	                  return backwards ? -indexedDB.cmp(a, b) : indexedDB.cmp(a, b);
	                };

	                sortedKeys = keys.slice().sort(compareKeys);
	                firstKey = backwards ? sortedKeys[sortedKeys.length - 1] : sortedKeys[0];
	                lastKey = backwards ? sortedKeys[0] : sortedKeys[sortedKeys.length - 1];
	                cursor = this._target.openKeyCursor(IDBKeyRange.bound(firstKey, lastKey), direction);
	                i = 0;
	                consumerDone = false;
	                _context3.next = 10;
	                return iterateCursor(cursor, function (value, key) {
	                  // while key is larger than next key, advance and report false
	                  while (i < sortedKeys.length && compareKeys(sortedKeys[i], key) < 0 && !consumerDone) {
	                    consumerDone = callback(sortedKeys[i], false);
	                    ++i;
	                  }

	                  if (i < sortedKeys.length && compareKeys(sortedKeys[i], key) === 0 && !consumerDone) {
	                    consumerDone = callback(sortedKeys[i], true);
	                    ++i;
	                  }

	                  var done = consumerDone || i >= sortedKeys.length;
	                  var jumpTo = !done && sortedKeys[i];
	                  return {
	                    done: done,
	                    jumpTo: jumpTo
	                  };
	                });

	              case 10:
	                // report null for keys we didn't to at the end
	                while (!consumerDone && i < sortedKeys.length) {
	                  consumerDone = callback(sortedKeys[i], false);
	                  ++i;
	                }

	              case 11:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3, this);
	      }));

	      function findExistingKeys(_x4, _x5, _x6) {
	        return _findExistingKeys.apply(this, arguments);
	      }

	      return findExistingKeys;
	    }()
	  }, {
	    key: "_reduce",
	    value: function _reduce(range, reducer, initialValue, direction) {
	      var reducedValue = initialValue;

	      var cursor = this._openCursor(range, direction);

	      return iterateCursor(cursor, function (value) {
	        reducedValue = reducer(reducedValue, value);
	        return {
	          done: false
	        };
	      });
	    }
	  }, {
	    key: "_selectLimit",
	    value: function _selectLimit(range, amount, direction) {
	      return this._selectWhile(range, function (results) {
	        return results.length === amount;
	      }, direction);
	    }
	  }, {
	    key: "_selectWhile",
	    value: function () {
	      var _selectWhile2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(range, predicate, direction) {
	        var cursor, results;
	        return regeneratorRuntime.wrap(function _callee4$(_context4) {
	          while (1) {
	            switch (_context4.prev = _context4.next) {
	              case 0:
	                cursor = this._openCursor(range, direction);
	                results = [];
	                _context4.next = 4;
	                return iterateCursor(cursor, function (value) {
	                  results.push(value);
	                  return {
	                    done: predicate(results)
	                  };
	                });

	              case 4:
	                return _context4.abrupt("return", results);

	              case 5:
	              case "end":
	                return _context4.stop();
	            }
	          }
	        }, _callee4, this);
	      }));

	      function _selectWhile(_x7, _x8, _x9) {
	        return _selectWhile2.apply(this, arguments);
	      }

	      return _selectWhile;
	    }()
	  }, {
	    key: "_find",
	    value: function () {
	      var _find2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(range, predicate, direction) {
	        var cursor, result, found;
	        return regeneratorRuntime.wrap(function _callee5$(_context5) {
	          while (1) {
	            switch (_context5.prev = _context5.next) {
	              case 0:
	                cursor = this._openCursor(range, direction);
	                _context5.next = 3;
	                return iterateCursor(cursor, function (value) {
	                  var found = predicate(value);

	                  if (found) {
	                    result = value;
	                  }

	                  return {
	                    done: found
	                  };
	                });

	              case 3:
	                found = _context5.sent;

	                if (!found) {
	                  _context5.next = 6;
	                  break;
	                }

	                return _context5.abrupt("return", result);

	              case 6:
	              case "end":
	                return _context5.stop();
	            }
	          }
	        }, _callee5, this);
	      }));

	      function _find(_x10, _x11, _x12) {
	        return _find2.apply(this, arguments);
	      }

	      return _find;
	    }()
	  }]);

	  return QueryTarget;
	}();

	var QueryTargetWrapper = /*#__PURE__*/function () {
	  function QueryTargetWrapper(qt) {
	    _classCallCheck(this, QueryTargetWrapper);

	    this._qt = qt;
	  }

	  _createClass(QueryTargetWrapper, [{
	    key: "supports",
	    value: function supports(methodName) {
	      return !!this._qt[methodName];
	    }
	  }, {
	    key: "openKeyCursor",
	    value: function openKeyCursor() {
	      // not supported on Edge 15
	      if (!this._qt.openKeyCursor) {
	        return this.openCursor.apply(this, arguments);
	      }

	      try {
	        var _this$_qt;

	        return (_this$_qt = this._qt).openKeyCursor.apply(_this$_qt, arguments);
	      } catch (err) {
	        throw new StorageError("openKeyCursor failed", err);
	      }
	    }
	  }, {
	    key: "openCursor",
	    value: function openCursor() {
	      try {
	        var _this$_qt2;

	        return (_this$_qt2 = this._qt).openCursor.apply(_this$_qt2, arguments);
	      } catch (err) {
	        throw new StorageError("openCursor failed", err);
	      }
	    }
	  }, {
	    key: "put",
	    value: function put() {
	      try {
	        var _this$_qt3;

	        return (_this$_qt3 = this._qt).put.apply(_this$_qt3, arguments);
	      } catch (err) {
	        throw new StorageError("put failed", err);
	      }
	    }
	  }, {
	    key: "add",
	    value: function add() {
	      try {
	        var _this$_qt4;

	        return (_this$_qt4 = this._qt).add.apply(_this$_qt4, arguments);
	      } catch (err) {
	        throw new StorageError("add failed", err);
	      }
	    }
	  }, {
	    key: "get",
	    value: function get() {
	      try {
	        var _this$_qt5;

	        return (_this$_qt5 = this._qt).get.apply(_this$_qt5, arguments);
	      } catch (err) {
	        throw new StorageError("get failed", err);
	      }
	    }
	  }, {
	    key: "getKey",
	    value: function getKey() {
	      try {
	        var _this$_qt6;

	        return (_this$_qt6 = this._qt).getKey.apply(_this$_qt6, arguments);
	      } catch (err) {
	        throw new StorageError("getKey failed", err);
	      }
	    }
	  }, {
	    key: "delete",
	    value: function _delete() {
	      try {
	        var _this$_qt7;

	        return (_this$_qt7 = this._qt).delete.apply(_this$_qt7, arguments);
	      } catch (err) {
	        throw new StorageError("delete failed", err);
	      }
	    }
	  }, {
	    key: "index",
	    value: function index() {
	      try {
	        var _this$_qt8;

	        return (_this$_qt8 = this._qt).index.apply(_this$_qt8, arguments);
	      } catch (err) {
	        throw new StorageError("index failed", err);
	      }
	    }
	  }]);

	  return QueryTargetWrapper;
	}();

	var Store = /*#__PURE__*/function (_QueryTarget) {
	  _inherits(Store, _QueryTarget);

	  var _super = _createSuper(Store);

	  function Store(idbStore) {
	    _classCallCheck(this, Store);

	    return _super.call(this, new QueryTargetWrapper(idbStore));
	  }

	  _createClass(Store, [{
	    key: "index",
	    value: function index(indexName) {
	      return new QueryTarget(new QueryTargetWrapper(this._idbStore.index(indexName)));
	    }
	  }, {
	    key: "put",
	    value: function () {
	      var _put = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(value) {
	        var originalErr;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _context.prev = 0;
	                _context.next = 3;
	                return reqAsPromise(this._idbStore.put(value));

	              case 3:
	                return _context.abrupt("return", _context.sent);

	              case 6:
	                _context.prev = 6;
	                _context.t0 = _context["catch"](0);
	                originalErr = _context.t0.cause;
	                throw new StorageError("put on ".concat(this._idbStore.name, " failed"), originalErr, value);

	              case 10:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this, [[0, 6]]);
	      }));

	      function put(_x) {
	        return _put.apply(this, arguments);
	      }

	      return put;
	    }()
	  }, {
	    key: "add",
	    value: function () {
	      var _add = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(value) {
	        var originalErr;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                _context2.prev = 0;
	                _context2.next = 3;
	                return reqAsPromise(this._idbStore.add(value));

	              case 3:
	                return _context2.abrupt("return", _context2.sent);

	              case 6:
	                _context2.prev = 6;
	                _context2.t0 = _context2["catch"](0);
	                originalErr = _context2.t0.cause;
	                throw new StorageError("add on ".concat(this._idbStore.name, " failed"), originalErr, value);

	              case 10:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this, [[0, 6]]);
	      }));

	      function add(_x2) {
	        return _add.apply(this, arguments);
	      }

	      return add;
	    }()
	  }, {
	    key: "delete",
	    value: function _delete(keyOrKeyRange) {
	      return reqAsPromise(this._idbStore.delete(keyOrKeyRange));
	    }
	  }, {
	    key: "_idbStore",
	    get: function get() {
	      return this._target;
	    }
	  }]);

	  return Store;
	}(QueryTarget);

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/

	/**
	store contains:
		loginData {
			device_id
			home_server
			access_token
			user_id
		}
		// flags {
		// 	lazyLoading?
		// }
		syncToken
		displayName
		avatarUrl
		lastSynced
	*/
	var SessionStore = /*#__PURE__*/function () {
	  function SessionStore(sessionStore) {
	    _classCallCheck(this, SessionStore);

	    this._sessionStore = sessionStore;
	  }

	  _createClass(SessionStore, [{
	    key: "get",
	    value: function () {
	      var _get = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        var session;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _context.next = 2;
	                return this._sessionStore.selectFirst(IDBKeyRange.only(1));

	              case 2:
	                session = _context.sent;

	                if (!session) {
	                  _context.next = 5;
	                  break;
	                }

	                return _context.abrupt("return", session.value);

	              case 5:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function get() {
	        return _get.apply(this, arguments);
	      }

	      return get;
	    }()
	  }, {
	    key: "set",
	    value: function set(session) {
	      return this._sessionStore.put({
	        key: 1,
	        value: session
	      });
	    }
	  }]);

	  return SessionStore;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/

	/**
	store contains:
		roomId
		name
		lastMessage
		unreadCount
		mentionCount
		isEncrypted
		isDirectMessage
		membership
		inviteCount
		joinCount
	*/
	var RoomSummaryStore = /*#__PURE__*/function () {
	  function RoomSummaryStore(summaryStore) {
	    _classCallCheck(this, RoomSummaryStore);

	    this._summaryStore = summaryStore;
	  }

	  _createClass(RoomSummaryStore, [{
	    key: "getAll",
	    value: function getAll() {
	      return this._summaryStore.selectAll();
	    }
	  }, {
	    key: "set",
	    value: function set(summary) {
	      return this._summaryStore.put(summary);
	    }
	  }]);

	  return RoomSummaryStore;
	}();

	function encodeKey(roomId, fragmentId, eventIndex) {
	  return "".concat(roomId, "|").concat(encodeUint32(fragmentId), "|").concat(encodeUint32(eventIndex));
	}

	function encodeEventIdKey(roomId, eventId) {
	  return "".concat(roomId, "|").concat(eventId);
	}

	function decodeEventIdKey(eventIdKey) {
	  var _eventIdKey$split = eventIdKey.split("|"),
	      _eventIdKey$split2 = _slicedToArray(_eventIdKey$split, 2),
	      roomId = _eventIdKey$split2[0],
	      eventId = _eventIdKey$split2[1];

	  return {
	    roomId: roomId,
	    eventId: eventId
	  };
	}

	var Range = /*#__PURE__*/function () {
	  function Range(only, lower, upper, lowerOpen, upperOpen) {
	    _classCallCheck(this, Range);

	    this._only = only;
	    this._lower = lower;
	    this._upper = upper;
	    this._lowerOpen = lowerOpen;
	    this._upperOpen = upperOpen;
	  }

	  _createClass(Range, [{
	    key: "asIDBKeyRange",
	    value: function asIDBKeyRange(roomId) {
	      try {
	        // only
	        if (this._only) {
	          return IDBKeyRange.only(encodeKey(roomId, this._only.fragmentId, this._only.eventIndex));
	        } // lowerBound
	        // also bound as we don't want to move into another roomId


	        if (this._lower && !this._upper) {
	          return IDBKeyRange.bound(encodeKey(roomId, this._lower.fragmentId, this._lower.eventIndex), encodeKey(roomId, this._lower.fragmentId, WebPlatform.maxStorageKey), this._lowerOpen, false);
	        } // upperBound
	        // also bound as we don't want to move into another roomId


	        if (!this._lower && this._upper) {
	          return IDBKeyRange.bound(encodeKey(roomId, this._upper.fragmentId, WebPlatform.minStorageKey), encodeKey(roomId, this._upper.fragmentId, this._upper.eventIndex), false, this._upperOpen);
	        } // bound


	        if (this._lower && this._upper) {
	          return IDBKeyRange.bound(encodeKey(roomId, this._lower.fragmentId, this._lower.eventIndex), encodeKey(roomId, this._upper.fragmentId, this._upper.eventIndex), this._lowerOpen, this._upperOpen);
	        }
	      } catch (err) {
	        throw new StorageError("IDBKeyRange failed with data: " + JSON.stringify(this), err);
	      }
	    }
	  }]);

	  return Range;
	}();
	/*
	 * @typedef   {Object} Gap
	 * @property  {?string} prev_batch the pagination token for this backwards facing gap
	 * @property  {?string} next_batch the pagination token for this forwards facing gap
	 *
	 * @typedef   {Object} Event
	 * @property  {string} event_id the id of the event
	 * @property  {string} type the
	 * @property  {?string} state_key the state key of this state event
	 *
	 * @typedef   {Object} Entry
	 * @property  {string} roomId
	 * @property  {EventKey} eventKey
	 * @property  {?Event} event if an event entry, the event
	 * @property  {?Gap} gap if a gap entry, the gap
	*/


	var TimelineEventStore = /*#__PURE__*/function () {
	  function TimelineEventStore(timelineStore) {
	    _classCallCheck(this, TimelineEventStore);

	    this._timelineStore = timelineStore;
	  }
	  /** Creates a range that only includes the given key
	   *  @param {EventKey} eventKey the key
	   *  @return {Range} the created range
	   */


	  _createClass(TimelineEventStore, [{
	    key: "onlyRange",
	    value: function onlyRange(eventKey) {
	      return new Range(eventKey);
	    }
	    /** Creates a range that includes all keys before eventKey, and optionally also the key itself.
	     *  @param {EventKey} eventKey the key
	     *  @param {boolean} [open=false] whether the key is included (false) or excluded (true) from the range at the upper end.
	     *  @return {Range} the created range
	     */

	  }, {
	    key: "upperBoundRange",
	    value: function upperBoundRange(eventKey) {
	      var open = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
	      return new Range(undefined, undefined, eventKey, undefined, open);
	    }
	    /** Creates a range that includes all keys after eventKey, and optionally also the key itself.
	     *  @param {EventKey} eventKey the key
	     *  @param {boolean} [open=false] whether the key is included (false) or excluded (true) from the range at the lower end.
	     *  @return {Range} the created range
	     */

	  }, {
	    key: "lowerBoundRange",
	    value: function lowerBoundRange(eventKey) {
	      var open = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
	      return new Range(undefined, eventKey, undefined, open);
	    }
	    /** Creates a range that includes all keys between `lower` and `upper`, and optionally the given keys as well.
	     *  @param {EventKey} lower the lower key
	     *  @param {EventKey} upper the upper key
	     *  @param {boolean} [lowerOpen=false] whether the lower key is included (false) or excluded (true) from the range.
	     *  @param {boolean} [upperOpen=false] whether the upper key is included (false) or excluded (true) from the range.
	     *  @return {Range} the created range
	     */

	  }, {
	    key: "boundRange",
	    value: function boundRange(lower, upper) {
	      var lowerOpen = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
	      var upperOpen = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
	      return new Range(undefined, lower, upper, lowerOpen, upperOpen);
	    }
	    /** Looks up the last `amount` entries in the timeline for `roomId`.
	     *  @param  {string} roomId
	     *  @param  {number} fragmentId
	     *  @param  {number} amount
	     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
	     */

	  }, {
	    key: "lastEvents",
	    value: function () {
	      var _lastEvents = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(roomId, fragmentId, amount) {
	        var eventKey;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                eventKey = EventKey.maxKey;
	                eventKey.fragmentId = fragmentId;
	                return _context.abrupt("return", this.eventsBefore(roomId, eventKey, amount));

	              case 3:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function lastEvents(_x, _x2, _x3) {
	        return _lastEvents.apply(this, arguments);
	      }

	      return lastEvents;
	    }()
	    /** Looks up the first `amount` entries in the timeline for `roomId`.
	     *  @param  {string} roomId
	     *  @param  {number} fragmentId
	     *  @param  {number} amount
	     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
	     */

	  }, {
	    key: "firstEvents",
	    value: function () {
	      var _firstEvents = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(roomId, fragmentId, amount) {
	        var eventKey;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                eventKey = EventKey.minKey;
	                eventKey.fragmentId = fragmentId;
	                return _context2.abrupt("return", this.eventsAfter(roomId, eventKey, amount));

	              case 3:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this);
	      }));

	      function firstEvents(_x4, _x5, _x6) {
	        return _firstEvents.apply(this, arguments);
	      }

	      return firstEvents;
	    }()
	    /** Looks up `amount` entries after `eventKey` in the timeline for `roomId` within the same fragment.
	     *  The entry for `eventKey` is not included.
	     *  @param  {string} roomId
	     *  @param  {EventKey} eventKey
	     *  @param  {number} amount
	     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
	     */

	  }, {
	    key: "eventsAfter",
	    value: function eventsAfter(roomId, eventKey, amount) {
	      var idbRange = this.lowerBoundRange(eventKey, true).asIDBKeyRange(roomId);
	      return this._timelineStore.selectLimit(idbRange, amount);
	    }
	    /** Looks up `amount` entries before `eventKey` in the timeline for `roomId` within the same fragment.
	     *  The entry for `eventKey` is not included.
	     *  @param  {string} roomId
	     *  @param  {EventKey} eventKey
	     *  @param  {number} amount
	     *  @return {Promise<Entry[]>} a promise resolving to an array with 0 or more entries, in ascending order.
	     */

	  }, {
	    key: "eventsBefore",
	    value: function () {
	      var _eventsBefore = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(roomId, eventKey, amount) {
	        var range, events;
	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                range = this.upperBoundRange(eventKey, true).asIDBKeyRange(roomId);
	                _context3.next = 3;
	                return this._timelineStore.selectLimitReverse(range, amount);

	              case 3:
	                events = _context3.sent;
	                events.reverse(); // because we fetched them backwards

	                return _context3.abrupt("return", events);

	              case 6:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3, this);
	      }));

	      function eventsBefore(_x7, _x8, _x9) {
	        return _eventsBefore.apply(this, arguments);
	      }

	      return eventsBefore;
	    }()
	    /** Finds the first eventId that occurs in the store, if any.
	     *  For optimal performance, `eventIds` should be in chronological order.
	     *
	     *  The order in which results are returned might be different than `eventIds`.
	     *  Call the return value to obtain the next {id, event} pair.
	     *  @param  {string} roomId
	     *  @param  {string[]} eventIds
	     *  @return {Function<Promise>}
	     */
	    // performance comment from above refers to the fact that there *might*
	    // be a correlation between event_id sorting order and chronology.
	    // In that case we could avoid running over all eventIds, as the reported order by findExistingKeys
	    // would match the order of eventIds. That's why findLast is also passed as backwards to keysExist.
	    // also passing them in chronological order makes sense as that's how we'll receive them almost always.

	  }, {
	    key: "findFirstOccurringEventId",
	    value: function () {
	      var _findFirstOccurringEventId = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(roomId, eventIds) {
	        var byEventId, keys, results, firstFoundKey, firstFoundAndPrecedingResolved;
	        return regeneratorRuntime.wrap(function _callee4$(_context4) {
	          while (1) {
	            switch (_context4.prev = _context4.next) {
	              case 0:
	                firstFoundAndPrecedingResolved = function _firstFoundAndPrecedi() {
	                  for (var i = 0; i < results.length; ++i) {
	                    if (results[i] === undefined) {
	                      return;
	                    } else if (results[i] === true) {
	                      return keys[i];
	                    }
	                  }
	                };

	                byEventId = this._timelineStore.index("byEventId");
	                keys = eventIds.map(function (eventId) {
	                  return encodeEventIdKey(roomId, eventId);
	                });
	                results = new Array(keys.length);
	                _context4.next = 6;
	                return byEventId.findExistingKeys(keys, false, function (key, found) {
	                  var index = keys.indexOf(key);
	                  results[index] = found;
	                  firstFoundKey = firstFoundAndPrecedingResolved();
	                  return !!firstFoundKey;
	                });

	              case 6:
	                return _context4.abrupt("return", firstFoundKey && decodeEventIdKey(firstFoundKey).eventId);

	              case 7:
	              case "end":
	                return _context4.stop();
	            }
	          }
	        }, _callee4, this);
	      }));

	      function findFirstOccurringEventId(_x10, _x11) {
	        return _findFirstOccurringEventId.apply(this, arguments);
	      }

	      return findFirstOccurringEventId;
	    }()
	    /** Inserts a new entry into the store. The combination of roomId and eventKey should not exist yet, or an error is thrown.
	     *  @param  {Entry} entry the entry to insert
	     *  @return {Promise<>} a promise resolving to undefined if the operation was successful, or a StorageError if not.
	     *  @throws {StorageError} ...
	     */

	  }, {
	    key: "insert",
	    value: function insert(entry) {
	      entry.key = encodeKey(entry.roomId, entry.fragmentId, entry.eventIndex);
	      entry.eventIdKey = encodeEventIdKey(entry.roomId, entry.event.event_id); // TODO: map error? or in idb/store?

	      return this._timelineStore.add(entry);
	    }
	    /** Updates the entry into the store with the given [roomId, eventKey] combination.
	     *  If not yet present, will insert. Might be slower than add.
	     *  @param  {Entry} entry the entry to update.
	     *  @return {Promise<>} a promise resolving to undefined if the operation was successful, or a StorageError if not.
	     */

	  }, {
	    key: "update",
	    value: function update(entry) {
	      return this._timelineStore.put(entry);
	    }
	  }, {
	    key: "get",
	    value: function get(roomId, eventKey) {
	      return this._timelineStore.get(encodeKey(roomId, eventKey.fragmentId, eventKey.eventIndex));
	    } // returns the entries as well!! (or not always needed? I guess not always needed, so extra method)

	  }, {
	    key: "removeRange",
	    value: function removeRange(roomId, range) {
	      // TODO: read the entries!
	      return this._timelineStore.delete(range.asIDBKeyRange(roomId));
	    }
	  }, {
	    key: "getByEventId",
	    value: function getByEventId(roomId, eventId) {
	      return this._timelineStore.index("byEventId").get(encodeEventIdKey(roomId, eventId));
	    }
	  }]);

	  return TimelineEventStore;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var RoomStateStore = /*#__PURE__*/function () {
	  function RoomStateStore(idbStore) {
	    _classCallCheck(this, RoomStateStore);

	    this._roomStateStore = idbStore;
	  }

	  _createClass(RoomStateStore, [{
	    key: "getEvents",
	    value: function () {
	      var _getEvents = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(type) {
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee);
	      }));

	      function getEvents(_x) {
	        return _getEvents.apply(this, arguments);
	      }

	      return getEvents;
	    }()
	  }, {
	    key: "getEventsForKey",
	    value: function () {
	      var _getEventsForKey = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(type, stateKey) {
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2);
	      }));

	      function getEventsForKey(_x2, _x3) {
	        return _getEventsForKey.apply(this, arguments);
	      }

	      return getEventsForKey;
	    }()
	  }, {
	    key: "setStateEvent",
	    value: function () {
	      var _setStateEvent = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(roomId, event) {
	        var key, entry;
	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                key = "".concat(roomId, "|").concat(event.type, "|").concat(event.state_key);
	                entry = {
	                  roomId: roomId,
	                  event: event,
	                  key: key
	                };
	                return _context3.abrupt("return", this._roomStateStore.put(entry));

	              case 3:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3, this);
	      }));

	      function setStateEvent(_x4, _x5) {
	        return _setStateEvent.apply(this, arguments);
	      }

	      return setStateEvent;
	    }()
	  }]);

	  return RoomStateStore;
	}();

	function encodeKey$1(roomId, fragmentId) {
	  return "".concat(roomId, "|").concat(encodeUint32(fragmentId));
	}

	var TimelineFragmentStore = /*#__PURE__*/function () {
	  function TimelineFragmentStore(store) {
	    _classCallCheck(this, TimelineFragmentStore);

	    this._store = store;
	  }

	  _createClass(TimelineFragmentStore, [{
	    key: "_allRange",
	    value: function _allRange(roomId) {
	      try {
	        return IDBKeyRange.bound(encodeKey$1(roomId, WebPlatform.minStorageKey), encodeKey$1(roomId, WebPlatform.maxStorageKey));
	      } catch (err) {
	        throw new StorageError("error from IDBKeyRange with roomId ".concat(roomId), err);
	      }
	    }
	  }, {
	    key: "all",
	    value: function all(roomId) {
	      return this._store.selectAll(this._allRange(roomId));
	    }
	    /** Returns the fragment without a nextToken and without nextId,
	    if any, with the largest id if there are multiple (which should not happen) */

	  }, {
	    key: "liveFragment",
	    value: function liveFragment(roomId) {
	      // why do we need this?
	      // Ok, take the case where you've got a /context fragment and a /sync fragment
	      // They are not connected. So, upon loading the persister, which one do we take? We can't sort them ...
	      // we assume that the one without a nextToken and without a nextId is a live one
	      // there should really be only one like this
	      // reverse because assuming live fragment has bigger id than non-live ones
	      return this._store.findReverse(this._allRange(roomId), function (fragment) {
	        return typeof fragment.nextId !== "number" && typeof fragment.nextToken !== "string";
	      });
	    } // should generate an id an return it?
	    // depends if we want to do anything smart with fragment ids,
	    // like give them meaning depending on range. not for now probably ...

	  }, {
	    key: "add",
	    value: function add(fragment) {
	      fragment.key = encodeKey$1(fragment.roomId, fragment.id);
	      return this._store.add(fragment);
	    }
	  }, {
	    key: "update",
	    value: function update(fragment) {
	      return this._store.put(fragment);
	    }
	  }, {
	    key: "get",
	    value: function get(roomId, fragmentId) {
	      return this._store.get(encodeKey$1(roomId, fragmentId));
	    }
	  }]);

	  return TimelineFragmentStore;
	}();

	function encodeKey$2(roomId, queueIndex) {
	  return "".concat(roomId, "|").concat(encodeUint32(queueIndex));
	}

	function decodeKey(key) {
	  var _key$split = key.split("|"),
	      _key$split2 = _slicedToArray(_key$split, 2),
	      roomId = _key$split2[0],
	      encodedQueueIndex = _key$split2[1];

	  var queueIndex = decodeUint32(encodedQueueIndex);
	  return {
	    roomId: roomId,
	    queueIndex: queueIndex
	  };
	}

	var PendingEventStore = /*#__PURE__*/function () {
	  function PendingEventStore(eventStore) {
	    _classCallCheck(this, PendingEventStore);

	    this._eventStore = eventStore;
	  }

	  _createClass(PendingEventStore, [{
	    key: "getMaxQueueIndex",
	    value: function () {
	      var _getMaxQueueIndex = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(roomId) {
	        var range, maxKey;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                range = IDBKeyRange.bound(encodeKey$2(roomId, WebPlatform.minStorageKey), encodeKey$2(roomId, WebPlatform.maxStorageKey), false, false);
	                _context.next = 3;
	                return this._eventStore.findMaxKey(range);

	              case 3:
	                maxKey = _context.sent;

	                if (!maxKey) {
	                  _context.next = 6;
	                  break;
	                }

	                return _context.abrupt("return", decodeKey(maxKey).queueIndex);

	              case 6:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function getMaxQueueIndex(_x) {
	        return _getMaxQueueIndex.apply(this, arguments);
	      }

	      return getMaxQueueIndex;
	    }()
	  }, {
	    key: "remove",
	    value: function remove(roomId, queueIndex) {
	      var keyRange = IDBKeyRange.only(encodeKey$2(roomId, queueIndex));

	      this._eventStore.delete(keyRange);
	    }
	  }, {
	    key: "exists",
	    value: function () {
	      var _exists = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(roomId, queueIndex) {
	        var keyRange, key, value;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                keyRange = IDBKeyRange.only(encodeKey$2(roomId, queueIndex));

	                if (!this._eventStore.supports("getKey")) {
	                  _context2.next = 7;
	                  break;
	                }

	                _context2.next = 4;
	                return this._eventStore.getKey(keyRange);

	              case 4:
	                key = _context2.sent;
	                _context2.next = 11;
	                break;

	              case 7:
	                _context2.next = 9;
	                return this._eventStore.get(keyRange);

	              case 9:
	                value = _context2.sent;
	                key = value && value.key;

	              case 11:
	                return _context2.abrupt("return", !!key);

	              case 12:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this);
	      }));

	      function exists(_x2, _x3) {
	        return _exists.apply(this, arguments);
	      }

	      return exists;
	    }()
	  }, {
	    key: "add",
	    value: function add(pendingEvent) {
	      pendingEvent.key = encodeKey$2(pendingEvent.roomId, pendingEvent.queueIndex);
	      return this._eventStore.add(pendingEvent);
	    }
	  }, {
	    key: "update",
	    value: function update(pendingEvent) {
	      return this._eventStore.put(pendingEvent);
	    }
	  }, {
	    key: "getAll",
	    value: function getAll() {
	      return this._eventStore.selectAll();
	    }
	  }]);

	  return PendingEventStore;
	}();

	var Transaction = /*#__PURE__*/function () {
	  function Transaction(txn, allowedStoreNames) {
	    _classCallCheck(this, Transaction);

	    this._txn = txn;
	    this._allowedStoreNames = allowedStoreNames;
	    this._stores = {
	      session: null,
	      roomSummary: null,
	      roomTimeline: null,
	      roomState: null
	    };
	  }

	  _createClass(Transaction, [{
	    key: "_idbStore",
	    value: function _idbStore(name) {
	      if (!this._allowedStoreNames.includes(name)) {
	        // more specific error? this is a bug, so maybe not ...
	        throw new StorageError("Invalid store for transaction: ".concat(name, ", only ").concat(this._allowedStoreNames.join(", "), " are allowed."));
	      }

	      return new Store(this._txn.objectStore(name));
	    }
	  }, {
	    key: "_store",
	    value: function _store(name, mapStore) {
	      if (!this._stores[name]) {
	        var idbStore = this._idbStore(name);

	        this._stores[name] = mapStore(idbStore);
	      }

	      return this._stores[name];
	    }
	  }, {
	    key: "complete",
	    value: function complete() {
	      return txnAsPromise(this._txn);
	    }
	  }, {
	    key: "abort",
	    value: function abort() {
	      this._txn.abort();
	    }
	  }, {
	    key: "session",
	    get: function get() {
	      return this._store("session", function (idbStore) {
	        return new SessionStore(idbStore);
	      });
	    }
	  }, {
	    key: "roomSummary",
	    get: function get() {
	      return this._store("roomSummary", function (idbStore) {
	        return new RoomSummaryStore(idbStore);
	      });
	    }
	  }, {
	    key: "timelineFragments",
	    get: function get() {
	      return this._store("timelineFragments", function (idbStore) {
	        return new TimelineFragmentStore(idbStore);
	      });
	    }
	  }, {
	    key: "timelineEvents",
	    get: function get() {
	      return this._store("timelineEvents", function (idbStore) {
	        return new TimelineEventStore(idbStore);
	      });
	    }
	  }, {
	    key: "roomState",
	    get: function get() {
	      return this._store("roomState", function (idbStore) {
	        return new RoomStateStore(idbStore);
	      });
	    }
	  }, {
	    key: "pendingEvents",
	    get: function get() {
	      return this._store("pendingEvents", function (idbStore) {
	        return new PendingEventStore(idbStore);
	      });
	    }
	  }]);

	  return Transaction;
	}();

	var Storage = /*#__PURE__*/function () {
	  function Storage(idbDatabase) {
	    _classCallCheck(this, Storage);

	    this._db = idbDatabase;
	    var nameMap = STORE_NAMES.reduce(function (nameMap, name) {
	      nameMap[name] = name;
	      return nameMap;
	    }, {});
	    this.storeNames = Object.freeze(nameMap);
	  }

	  _createClass(Storage, [{
	    key: "_validateStoreNames",
	    value: function _validateStoreNames(storeNames) {
	      var idx = storeNames.findIndex(function (name) {
	        return !STORE_NAMES.includes(name);
	      });

	      if (idx !== -1) {
	        throw new StorageError("Tried top, a transaction unknown store ".concat(storeNames[idx]));
	      }
	    }
	  }, {
	    key: "readTxn",
	    value: function () {
	      var _readTxn = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(storeNames) {
	        var txn;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                this._validateStoreNames(storeNames);

	                _context.prev = 1;
	                txn = this._db.transaction(storeNames, "readonly");
	                return _context.abrupt("return", new Transaction(txn, storeNames));

	              case 6:
	                _context.prev = 6;
	                _context.t0 = _context["catch"](1);
	                throw new StorageError("readTxn failed", _context.t0);

	              case 9:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this, [[1, 6]]);
	      }));

	      function readTxn(_x) {
	        return _readTxn.apply(this, arguments);
	      }

	      return readTxn;
	    }()
	  }, {
	    key: "readWriteTxn",
	    value: function () {
	      var _readWriteTxn = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(storeNames) {
	        var txn;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                this._validateStoreNames(storeNames);

	                _context2.prev = 1;
	                txn = this._db.transaction(storeNames, "readwrite");
	                return _context2.abrupt("return", new Transaction(txn, storeNames));

	              case 6:
	                _context2.prev = 6;
	                _context2.t0 = _context2["catch"](1);
	                throw new StorageError("readWriteTxn failed", _context2.t0);

	              case 9:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this, [[1, 6]]);
	      }));

	      function readWriteTxn(_x2) {
	        return _readWriteTxn.apply(this, arguments);
	      }

	      return readWriteTxn;
	    }()
	  }, {
	    key: "close",
	    value: function close() {
	      this._db.close();
	    }
	  }]);

	  return Storage;
	}();

	function exportSession(_x) {
	  return _exportSession.apply(this, arguments);
	}

	function _exportSession() {
	  _exportSession = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(db) {
	    var NOT_DONE, txn, data;
	    return regeneratorRuntime.wrap(function _callee2$(_context2) {
	      while (1) {
	        switch (_context2.prev = _context2.next) {
	          case 0:
	            NOT_DONE = {
	              done: false
	            };
	            txn = db.transaction(STORE_NAMES, "readonly");
	            data = {};
	            _context2.next = 5;
	            return Promise.all(STORE_NAMES.map( /*#__PURE__*/function () {
	              var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(name) {
	                var results, store;
	                return regeneratorRuntime.wrap(function _callee$(_context) {
	                  while (1) {
	                    switch (_context.prev = _context.next) {
	                      case 0:
	                        results = data[name] = []; // initialize in deterministic order

	                        store = txn.objectStore(name);
	                        _context.next = 4;
	                        return iterateCursor(store.openCursor(), function (value) {
	                          results.push(value);
	                          return NOT_DONE;
	                        });

	                      case 4:
	                      case "end":
	                        return _context.stop();
	                    }
	                  }
	                }, _callee);
	              }));

	              return function (_x4) {
	                return _ref.apply(this, arguments);
	              };
	            }()));

	          case 5:
	            return _context2.abrupt("return", data);

	          case 6:
	          case "end":
	            return _context2.stop();
	        }
	      }
	    }, _callee2);
	  }));
	  return _exportSession.apply(this, arguments);
	}

	function importSession(_x2, _x3) {
	  return _importSession.apply(this, arguments);
	}

	function _importSession() {
	  _importSession = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(db, data) {
	    var txn, _iterator, _step, name, store, _iterator2, _step2, value;

	    return regeneratorRuntime.wrap(function _callee3$(_context3) {
	      while (1) {
	        switch (_context3.prev = _context3.next) {
	          case 0:
	            txn = db.transaction(STORE_NAMES, "readwrite");
	            _iterator = _createForOfIteratorHelper(STORE_NAMES);

	            try {
	              for (_iterator.s(); !(_step = _iterator.n()).done;) {
	                name = _step.value;
	                store = txn.objectStore(name);
	                _iterator2 = _createForOfIteratorHelper(data[name]);

	                try {
	                  for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	                    value = _step2.value;
	                    store.add(value);
	                  }
	                } catch (err) {
	                  _iterator2.e(err);
	                } finally {
	                  _iterator2.f();
	                }
	              }
	            } catch (err) {
	              _iterator.e(err);
	            } finally {
	              _iterator.f();
	            }

	            _context3.next = 5;
	            return txnAsPromise(txn);

	          case 5:
	          case "end":
	            return _context3.stop();
	        }
	      }
	    }, _callee3);
	  }));
	  return _importSession.apply(this, arguments);
	}

	var sessionName = function sessionName(sessionId) {
	  return "brawl_session_".concat(sessionId);
	};

	var openDatabaseWithSessionId = function openDatabaseWithSessionId(sessionId) {
	  return openDatabase(sessionName(sessionId), createStores, 1);
	};

	var StorageFactory = /*#__PURE__*/function () {
	  function StorageFactory() {
	    _classCallCheck(this, StorageFactory);
	  }

	  _createClass(StorageFactory, [{
	    key: "create",
	    value: function () {
	      var _create = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(sessionId) {
	        var db;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _context.next = 2;
	                return openDatabaseWithSessionId(sessionId);

	              case 2:
	                db = _context.sent;
	                return _context.abrupt("return", new Storage(db));

	              case 4:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee);
	      }));

	      function create(_x) {
	        return _create.apply(this, arguments);
	      }

	      return create;
	    }()
	  }, {
	    key: "delete",
	    value: function _delete(sessionId) {
	      var databaseName = sessionName(sessionId);
	      var req = window.indexedDB.deleteDatabase(databaseName);
	      return reqAsPromise(req);
	    }
	  }, {
	    key: "export",
	    value: function () {
	      var _export2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(sessionId) {
	        var db;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                _context2.next = 2;
	                return openDatabaseWithSessionId(sessionId);

	              case 2:
	                db = _context2.sent;
	                _context2.next = 5;
	                return exportSession(db);

	              case 5:
	                return _context2.abrupt("return", _context2.sent);

	              case 6:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2);
	      }));

	      function _export(_x2) {
	        return _export2.apply(this, arguments);
	      }

	      return _export;
	    }()
	  }, {
	    key: "import",
	    value: function () {
	      var _import2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(sessionId, data) {
	        var db;
	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                _context3.next = 2;
	                return openDatabaseWithSessionId(sessionId);

	              case 2:
	                db = _context3.sent;
	                _context3.next = 5;
	                return importSession(db, data);

	              case 5:
	                return _context3.abrupt("return", _context3.sent);

	              case 6:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3);
	      }));

	      function _import(_x3, _x4) {
	        return _import2.apply(this, arguments);
	      }

	      return _import;
	    }()
	  }]);

	  return StorageFactory;
	}();

	function createStores(db) {
	  db.createObjectStore("session", {
	    keyPath: "key"
	  }); // any way to make keys unique here? (just use put?)

	  db.createObjectStore("roomSummary", {
	    keyPath: "roomId"
	  }); // need index to find live fragment? prooobably ok without for now
	  //key = room_id | fragment_id

	  db.createObjectStore("timelineFragments", {
	    keyPath: "key"
	  }); //key = room_id | fragment_id | event_index

	  var timelineEvents = db.createObjectStore("timelineEvents", {
	    keyPath: "key"
	  }); //eventIdKey = room_id | event_id

	  timelineEvents.createIndex("byEventId", "eventIdKey", {
	    unique: true
	  }); //key = room_id | event.type | event.state_key,

	  db.createObjectStore("roomState", {
	    keyPath: "key"
	  });
	  db.createObjectStore("pendingEvents", {
	    keyPath: "key"
	  }); // const roomMembers = db.createObjectStore("roomMembers", {keyPath: [
	  //  "event.room_id",
	  //  "event.content.membership",
	  //  "event.state_key"
	  // ]});
	  // roomMembers.createIndex("byName", ["room_id", "content.name"]);
	}

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var SessionInfoStorage = /*#__PURE__*/function () {
	  function SessionInfoStorage(name) {
	    _classCallCheck(this, SessionInfoStorage);

	    this._name = name;
	  }

	  _createClass(SessionInfoStorage, [{
	    key: "getAll",
	    value: function getAll() {
	      var sessionsJson = localStorage.getItem(this._name);

	      if (sessionsJson) {
	        var sessions = JSON.parse(sessionsJson);

	        if (Array.isArray(sessions)) {
	          return Promise.resolve(sessions);
	        }
	      }

	      return Promise.resolve([]);
	    }
	  }, {
	    key: "hasAnySession",
	    value: function () {
	      var _hasAnySession = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        var all;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _context.next = 2;
	                return this.getAll();

	              case 2:
	                all = _context.sent;
	                return _context.abrupt("return", all && all.length > 0);

	              case 4:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function hasAnySession() {
	        return _hasAnySession.apply(this, arguments);
	      }

	      return hasAnySession;
	    }()
	  }, {
	    key: "updateLastUsed",
	    value: function () {
	      var _updateLastUsed = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(id, timestamp) {
	        var sessions, session;
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                _context2.next = 2;
	                return this.getAll();

	              case 2:
	                sessions = _context2.sent;

	                if (sessions) {
	                  session = sessions.find(function (session) {
	                    return session.id === id;
	                  });

	                  if (session) {
	                    session.lastUsed = timestamp;
	                    localStorage.setItem(this._name, JSON.stringify(sessions));
	                  }
	                }

	              case 4:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this);
	      }));

	      function updateLastUsed(_x, _x2) {
	        return _updateLastUsed.apply(this, arguments);
	      }

	      return updateLastUsed;
	    }()
	  }, {
	    key: "get",
	    value: function () {
	      var _get = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(id) {
	        var sessions;
	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                _context3.next = 2;
	                return this.getAll();

	              case 2:
	                sessions = _context3.sent;

	                if (!sessions) {
	                  _context3.next = 5;
	                  break;
	                }

	                return _context3.abrupt("return", sessions.find(function (session) {
	                  return session.id === id;
	                }));

	              case 5:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3, this);
	      }));

	      function get(_x3) {
	        return _get.apply(this, arguments);
	      }

	      return get;
	    }()
	  }, {
	    key: "add",
	    value: function () {
	      var _add = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(sessionInfo) {
	        var sessions;
	        return regeneratorRuntime.wrap(function _callee4$(_context4) {
	          while (1) {
	            switch (_context4.prev = _context4.next) {
	              case 0:
	                _context4.next = 2;
	                return this.getAll();

	              case 2:
	                sessions = _context4.sent;
	                sessions.push(sessionInfo);
	                localStorage.setItem(this._name, JSON.stringify(sessions));

	              case 5:
	              case "end":
	                return _context4.stop();
	            }
	          }
	        }, _callee4, this);
	      }));

	      function add(_x4) {
	        return _add.apply(this, arguments);
	      }

	      return add;
	    }()
	  }, {
	    key: "delete",
	    value: function () {
	      var _delete2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(sessionId) {
	        var sessions;
	        return regeneratorRuntime.wrap(function _callee5$(_context5) {
	          while (1) {
	            switch (_context5.prev = _context5.next) {
	              case 0:
	                _context5.next = 2;
	                return this.getAll();

	              case 2:
	                sessions = _context5.sent;
	                sessions = sessions.filter(function (s) {
	                  return s.id !== sessionId;
	                });
	                localStorage.setItem(this._name, JSON.stringify(sessions));

	              case 5:
	              case "end":
	                return _context5.stop();
	            }
	          }
	        }, _callee5, this);
	      }));

	      function _delete(_x5) {
	        return _delete2.apply(this, arguments);
	      }

	      return _delete;
	    }()
	  }]);

	  return SessionInfoStorage;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	function avatarInitials(name) {
	  var words = name.split(" ");

	  if (words.length === 1) {
	    words = words[0].split("-");
	  }

	  words = words.slice(0, 2);
	  return words.reduce(function (i, w) {
	    var firstChar = w.charAt(0);

	    if (firstChar === "!" || firstChar === "@" || firstChar === "#") {
	      firstChar = w.charAt(1);
	    }

	    return i + firstChar.toUpperCase();
	  }, "");
	}
	/**
	 * calculates a numeric hash for a given string
	 *
	 * @param {string} str string to hash
	 *
	 * @return {number}
	 */

	function hashCode(str) {
	  var hash = 0;
	  var i;
	  var chr;

	  if (str.length === 0) {
	    return hash;
	  }

	  for (i = 0; i < str.length; i++) {
	    chr = str.charCodeAt(i);
	    hash = (hash << 5) - hash + chr;
	    hash |= 0;
	  }

	  return Math.abs(hash);
	}

	function getIdentifierColorNumber(id) {
	  return hashCode(id) % 8 + 1;
	}

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	function disposeValue(value) {
	  if (typeof value === "function") {
	    value();
	  } else {
	    value.dispose();
	  }
	}

	var Disposables = /*#__PURE__*/function () {
	  function Disposables() {
	    _classCallCheck(this, Disposables);

	    this._disposables = [];
	  }

	  _createClass(Disposables, [{
	    key: "track",
	    value: function track(disposable) {
	      this._disposables.push(disposable);
	    }
	  }, {
	    key: "dispose",
	    value: function dispose() {
	      if (this._disposables) {
	        var _iterator = _createForOfIteratorHelper(this._disposables),
	            _step;

	        try {
	          for (_iterator.s(); !(_step = _iterator.n()).done;) {
	            var d = _step.value;
	            disposeValue(d);
	          }
	        } catch (err) {
	          _iterator.e(err);
	        } finally {
	          _iterator.f();
	        }

	        this._disposables = null;
	      }
	    }
	  }, {
	    key: "disposeTracked",
	    value: function disposeTracked(value) {
	      if (value === undefined || value === null) {
	        return null;
	      }

	      var idx = this._disposables.indexOf(value);

	      if (idx !== -1) {
	        var _this$_disposables$sp = this._disposables.splice(idx, 1),
	            _this$_disposables$sp2 = _slicedToArray(_this$_disposables$sp, 1),
	            foundValue = _this$_disposables$sp2[0];

	        disposeValue(foundValue);
	      } else {
	        console.warn("disposable not found, did it leak?", value);
	      }

	      return null;
	    }
	  }]);

	  return Disposables;
	}();

	var ViewModel = /*#__PURE__*/function (_EventEmitter) {
	  _inherits(ViewModel, _EventEmitter);

	  var _super = _createSuper(ViewModel);

	  function ViewModel() {
	    var _this;

	    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
	        clock = _ref.clock,
	        emitChange = _ref.emitChange;

	    _classCallCheck(this, ViewModel);

	    _this = _super.call(this);
	    _this.disposables = null;
	    _this._options = {
	      clock: clock,
	      emitChange: emitChange
	    };
	    return _this;
	  }

	  _createClass(ViewModel, [{
	    key: "childOptions",
	    value: function childOptions(explicitOptions) {
	      return Object.assign({}, this._options, explicitOptions);
	    }
	  }, {
	    key: "track",
	    value: function track(disposable) {
	      if (!this.disposables) {
	        this.disposables = new Disposables();
	      }

	      this.disposables.track(disposable);
	      return disposable;
	    }
	  }, {
	    key: "dispose",
	    value: function dispose() {
	      if (this.disposables) {
	        this.disposables.dispose();
	      }
	    }
	  }, {
	    key: "disposeTracked",
	    value: function disposeTracked(disposable) {
	      if (this.disposables) {
	        return this.disposables.disposeTracked(disposable);
	      }

	      return null;
	    } // TODO: this will need to support binding
	    // if any of the expr is a function, assume the function is a binding, and return a binding function ourselves
	    // 
	    // translated string should probably always be bindings, unless we're fine with a refresh when changing the language?
	    // we probably are, if we're using routing with a url, we could just refresh.

	  }, {
	    key: "i18n",
	    value: function i18n(parts) {
	      // just concat for now
	      var result = "";

	      for (var i = 0; i < parts.length; ++i) {
	        result = result + parts[i];

	        if (i < (arguments.length <= 1 ? 0 : arguments.length - 1)) {
	          result = result + (i + 1 < 1 || arguments.length <= i + 1 ? undefined : arguments[i + 1]);
	        }
	      }

	      return result;
	    }
	  }, {
	    key: "emitChange",
	    value: function emitChange(changedProps) {
	      if (this._options.emitChange) {
	        this._options.emitChange(changedProps);
	      } else {
	        this.emit("change", changedProps);
	      }
	    }
	  }, {
	    key: "clock",
	    get: function get() {
	      return this._options.clock;
	    }
	  }]);

	  return ViewModel;
	}(EventEmitter);

	var RoomTileViewModel = /*#__PURE__*/function (_ViewModel) {
	  _inherits(RoomTileViewModel, _ViewModel);

	  var _super = _createSuper(RoomTileViewModel);

	  // we use callbacks to parent VM instead of emit because
	  // it would be annoying to keep track of subscriptions in
	  // parent for all RoomTileViewModels
	  // emitUpdate is ObservableMap/ObservableList update mechanism
	  function RoomTileViewModel(options) {
	    var _this;

	    _classCallCheck(this, RoomTileViewModel);

	    _this = _super.call(this, options);
	    var room = options.room,
	        emitOpen = options.emitOpen;
	    _this._room = room;
	    _this._emitOpen = emitOpen;
	    _this._isOpen = false;
	    return _this;
	  } // called by parent for now (later should integrate with router)


	  _createClass(RoomTileViewModel, [{
	    key: "close",
	    value: function close() {
	      if (this._isOpen) {
	        this._isOpen = false;
	        this.emitChange("isOpen");
	      }
	    }
	  }, {
	    key: "open",
	    value: function open() {
	      this._isOpen = true;
	      this.emitChange("isOpen");

	      this._emitOpen(this._room, this);
	    }
	  }, {
	    key: "compare",
	    value: function compare(other) {
	      // sort by name for now
	      return this._room.name.localeCompare(other._room.name);
	    }
	  }, {
	    key: "isOpen",
	    get: function get() {
	      return this._isOpen;
	    }
	  }, {
	    key: "name",
	    get: function get() {
	      return this._room.name;
	    }
	  }, {
	    key: "avatarInitials",
	    get: function get() {
	      return avatarInitials(this._room.name);
	    }
	  }, {
	    key: "avatarColorNumber",
	    get: function get() {
	      return getIdentifierColorNumber(this._room.id);
	    }
	  }]);

	  return RoomTileViewModel;
	}(ViewModel);

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	var UpdateAction = /*#__PURE__*/function () {
	  function UpdateAction(remove, update, updateParams) {
	    _classCallCheck(this, UpdateAction);

	    this._remove = remove;
	    this._update = update;
	    this._updateParams = updateParams;
	  }

	  _createClass(UpdateAction, [{
	    key: "shouldRemove",
	    get: function get() {
	      return this._remove;
	    }
	  }, {
	    key: "shouldUpdate",
	    get: function get() {
	      return this._update;
	    }
	  }, {
	    key: "updateParams",
	    get: function get() {
	      return this._updateParams;
	    }
	  }], [{
	    key: "Remove",
	    value: function Remove() {
	      return new UpdateAction(true, false, null);
	    }
	  }, {
	    key: "Update",
	    value: function Update(newParams) {
	      return new UpdateAction(false, true, newParams);
	    }
	  }, {
	    key: "Nothing",
	    value: function Nothing() {
	      return new UpdateAction(false, false, null);
	    }
	  }]);

	  return UpdateAction;
	}();

	// for now, tileCreator should be stable in whether it returns a tile or not.
	// e.g. the decision to create a tile or not should be based on properties
	// not updated later on (e.g. event type)
	// also see big comment in onUpdate

	var TilesCollection = /*#__PURE__*/function (_BaseObservableList) {
	  _inherits(TilesCollection, _BaseObservableList);

	  var _super = _createSuper(TilesCollection);

	  function TilesCollection(entries, tileCreator) {
	    var _this;

	    _classCallCheck(this, TilesCollection);

	    _this = _super.call(this);
	    _this._entries = entries;
	    _this._tiles = null;
	    _this._entrySubscription = null;
	    _this._tileCreator = tileCreator;
	    _this._emitSpontanousUpdate = _this._emitSpontanousUpdate.bind(_assertThisInitialized(_this));
	    return _this;
	  }

	  _createClass(TilesCollection, [{
	    key: "_emitSpontanousUpdate",
	    value: function _emitSpontanousUpdate(tile, params) {
	      var entry = tile.lowerEntry;

	      var tileIdx = this._findTileIdx(entry);

	      this.emitUpdate(tileIdx, tile, params);
	    }
	  }, {
	    key: "onSubscribeFirst",
	    value: function onSubscribeFirst() {
	      this._entrySubscription = this._entries.subscribe(this);

	      this._populateTiles();
	    }
	  }, {
	    key: "_populateTiles",
	    value: function _populateTiles() {
	      this._tiles = [];
	      var currentTile = null;

	      var _iterator = _createForOfIteratorHelper(this._entries),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var entry = _step.value;

	          if (!currentTile || !currentTile.tryIncludeEntry(entry)) {
	            currentTile = this._tileCreator(entry);

	            if (currentTile) {
	              this._tiles.push(currentTile);
	            }
	          }
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }

	      var prevTile = null;

	      var _iterator2 = _createForOfIteratorHelper(this._tiles),
	          _step2;

	      try {
	        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	          var tile = _step2.value;

	          if (prevTile) {
	            prevTile.updateNextSibling(tile);
	          }

	          tile.updatePreviousSibling(prevTile);
	          prevTile = tile;
	        }
	      } catch (err) {
	        _iterator2.e(err);
	      } finally {
	        _iterator2.f();
	      }

	      if (prevTile) {
	        prevTile.updateNextSibling(null);
	      } // now everything is wired up,
	      // allow tiles to emit updates


	      var _iterator3 = _createForOfIteratorHelper(this._tiles),
	          _step3;

	      try {
	        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	          var _tile = _step3.value;

	          _tile.setUpdateEmit(this._emitSpontanousUpdate);
	        }
	      } catch (err) {
	        _iterator3.e(err);
	      } finally {
	        _iterator3.f();
	      }
	    }
	  }, {
	    key: "_findTileIdx",
	    value: function _findTileIdx(entry) {
	      return sortedIndex(this._tiles, entry, function (entry, tile) {
	        // negate result because we're switching the order of the params
	        return -tile.compareEntry(entry);
	      });
	    }
	  }, {
	    key: "_findTileAtIdx",
	    value: function _findTileAtIdx(entry, idx) {
	      var tile = this._getTileAtIdx(idx);

	      if (tile && tile.compareEntry(entry) === 0) {
	        return tile;
	      }
	    }
	  }, {
	    key: "_getTileAtIdx",
	    value: function _getTileAtIdx(tileIdx) {
	      if (tileIdx >= 0 && tileIdx < this._tiles.length) {
	        return this._tiles[tileIdx];
	      }

	      return null;
	    }
	  }, {
	    key: "onUnsubscribeLast",
	    value: function onUnsubscribeLast() {
	      this._entrySubscription = this._entrySubscription();
	      this._tiles = null;
	    }
	  }, {
	    key: "onReset",
	    value: function onReset() {
	      // if TileViewModel were disposable, dispose here, or is that for views to do? views I suppose ...
	      this._buildInitialTiles();

	      this.emitReset();
	    }
	  }, {
	    key: "onAdd",
	    value: function onAdd(index, entry) {
	      var tileIdx = this._findTileIdx(entry);

	      var prevTile = this._getTileAtIdx(tileIdx - 1);

	      if (prevTile && prevTile.tryIncludeEntry(entry)) {
	        this.emitUpdate(tileIdx - 1, prevTile);
	        return;
	      } // not + 1 because this entry hasn't been added yet


	      var nextTile = this._getTileAtIdx(tileIdx);

	      if (nextTile && nextTile.tryIncludeEntry(entry)) {
	        this.emitUpdate(tileIdx, nextTile);
	        return;
	      }

	      var newTile = this._tileCreator(entry);

	      if (newTile) {
	        if (prevTile) {
	          prevTile.updateNextSibling(newTile); // this emits an update while the add hasn't been emitted yet

	          newTile.updatePreviousSibling(prevTile);
	        }

	        if (nextTile) {
	          newTile.updateNextSibling(nextTile);
	          nextTile.updatePreviousSibling(newTile);
	        }

	        this._tiles.splice(tileIdx, 0, newTile);

	        this.emitAdd(tileIdx, newTile); // add event is emitted, now the tile
	        // can emit updates

	        newTile.setUpdateEmit(this._emitSpontanousUpdate);
	      } // find position by sort key
	      // ask siblings to be included? both? yes, twice: a (insert c here) b, ask a(c), if yes ask b(a), else ask b(c)? if yes then b(a)?

	    }
	  }, {
	    key: "onUpdate",
	    value: function onUpdate(index, entry, params) {
	      var tileIdx = this._findTileIdx(entry);

	      var tile = this._findTileAtIdx(entry, tileIdx);

	      if (tile) {
	        var action = tile.updateEntry(entry, params);

	        if (action.shouldRemove) {
	          this._removeTile(tileIdx, tile);
	        }

	        if (action.shouldUpdate) {
	          this.emitUpdate(tileIdx, tile, action.updateParams);
	        }
	      } // technically we should handle adding a tile here as well
	      // in case before we didn't have a tile for it but now we do
	      // but in reality we don't have this use case as the type and msgtype
	      // doesn't change. Decryption maybe is the exception?
	      // outcomes here can be
	      //   tiles should be removed (got redacted and we don't want it in the timeline)
	      //   tile should be added where there was none before ... ?
	      //   entry should get it's own tile now
	      //   merge with neighbours? ... hard to imagine use case for this  ...

	    }
	  }, {
	    key: "_removeTile",
	    value: function _removeTile(tileIdx, tile) {
	      var prevTile = this._getTileAtIdx(tileIdx - 1);

	      var nextTile = this._getTileAtIdx(tileIdx + 1);

	      this._tiles.splice(tileIdx, 1);

	      prevTile && prevTile.updateNextSibling(nextTile);
	      nextTile && nextTile.updatePreviousSibling(prevTile);
	      tile.setUpdateEmit(null);
	      this.emitRemove(tileIdx, tile);
	    } // would also be called when unloading a part of the timeline

	  }, {
	    key: "onRemove",
	    value: function onRemove(index, entry) {
	      var tileIdx = this._findTileIdx(entry);

	      var tile = this._findTileAtIdx(entry, tileIdx);

	      if (tile) {
	        var removeTile = tile.removeEntry(entry);

	        if (removeTile) {
	          this._removeTile(tileIdx, tile);
	        } else {
	          this.emitUpdate(tileIdx, tile);
	        }
	      }
	    }
	  }, {
	    key: "onMove",
	    value: function onMove(fromIdx, toIdx, value) {// this ... cannot happen in the timeline?
	      // perhaps we can use this event to support a local echo (in a different fragment)
	      // to be moved to the key of the remote echo, so we don't loose state ... ?
	    }
	  }, {
	    key: Symbol.iterator,
	    value: function value() {
	      return this._tiles.values();
	    }
	  }, {
	    key: "length",
	    get: function get() {
	      return this._tiles.length;
	    }
	  }]);

	  return TilesCollection;
	}(BaseObservableList);

	var SimpleTile = /*#__PURE__*/function () {
	  function SimpleTile(_ref) {
	    var entry = _ref.entry;

	    _classCallCheck(this, SimpleTile);

	    this._entry = entry;
	    this._emitUpdate = null;
	  } // view model props for all subclasses
	  // hmmm, could also do instanceof ... ?


	  _createClass(SimpleTile, [{
	    key: "emitUpdate",
	    value: function emitUpdate(paramName) {
	      if (this._emitUpdate) {
	        this._emitUpdate(this, paramName);
	      }
	    }
	  }, {
	    key: "setUpdateEmit",
	    // TilesCollection contract below
	    value: function setUpdateEmit(emitUpdate) {
	      this._emitUpdate = emitUpdate;
	    }
	  }, {
	    key: "compareEntry",
	    value: function compareEntry(entry) {
	      return this._entry.compare(entry);
	    } // update received for already included (falls within sort keys) entry

	  }, {
	    key: "updateEntry",
	    value: function updateEntry(entry) {
	      this._entry = entry;
	      return UpdateAction.Nothing();
	    } // return whether the tile should be removed
	    // as SimpleTile only has one entry, the tile should be removed

	  }, {
	    key: "removeEntry",
	    value: function removeEntry(entry) {
	      return true;
	    } // SimpleTile can only contain 1 entry

	  }, {
	    key: "tryIncludeEntry",
	    value: function tryIncludeEntry() {
	      return false;
	    } // let item know it has a new sibling

	  }, {
	    key: "updatePreviousSibling",
	    value: function updatePreviousSibling(prev) {} // let item know it has a new sibling

	  }, {
	    key: "updateNextSibling",
	    value: function updateNextSibling(next) {} // TilesCollection contract above

	  }, {
	    key: "shape",
	    get: function get() {
	      return null; // "gap" | "message" | "image" | ... ?
	    } // don't show display name / avatar
	    // probably only for MessageTiles of some sort?

	  }, {
	    key: "isContinuation",
	    get: function get() {
	      return false;
	    }
	  }, {
	    key: "hasDateSeparator",
	    get: function get() {
	      return false;
	    }
	  }, {
	    key: "internalId",
	    get: function get() {
	      return this._entry.asEventKey().toString();
	    }
	  }, {
	    key: "isPending",
	    get: function get() {
	      return this._entry.isPending;
	    }
	  }, {
	    key: "upperEntry",
	    get: function get() {
	      return this._entry;
	    }
	  }, {
	    key: "lowerEntry",
	    get: function get() {
	      return this._entry;
	    }
	  }]);

	  return SimpleTile;
	}();

	var GapTile = /*#__PURE__*/function (_SimpleTile) {
	  _inherits(GapTile, _SimpleTile);

	  var _super = _createSuper(GapTile);

	  function GapTile(options, timeline) {
	    var _this;

	    _classCallCheck(this, GapTile);

	    _this = _super.call(this, options);
	    _this._timeline = timeline;
	    _this._loading = false;
	    _this._error = null;
	    return _this;
	  }

	  _createClass(GapTile, [{
	    key: "fill",
	    value: function () {
	      var _fill = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                if (this._loading) {
	                  _context.next = 17;
	                  break;
	                }

	                this._loading = true;
	                this.emitUpdate("isLoading");
	                _context.prev = 3;
	                _context.next = 6;
	                return this._timeline.fillGap(this._entry, 10);

	              case 6:
	                _context.next = 13;
	                break;

	              case 8:
	                _context.prev = 8;
	                _context.t0 = _context["catch"](3);
	                console.error("timeline.fillGap(): ".concat(_context.t0.message, ":\n").concat(_context.t0.stack));
	                this._error = _context.t0;
	                this.emitUpdate("error");

	              case 13:
	                _context.prev = 13;
	                this._loading = false;
	                this.emitUpdate("isLoading");
	                return _context.finish(13);

	              case 17:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this, [[3, 8, 13, 17]]);
	      }));

	      function fill() {
	        return _fill.apply(this, arguments);
	      }

	      return fill;
	    }()
	  }, {
	    key: "updateEntry",
	    value: function updateEntry(entry, params) {
	      _get(_getPrototypeOf(GapTile.prototype), "updateEntry", this).call(this, entry, params);

	      if (!entry.isGap) {
	        return UpdateAction.Remove();
	      } else {
	        return UpdateAction.Nothing();
	      }
	    }
	  }, {
	    key: "shape",
	    get: function get() {
	      return "gap";
	    }
	  }, {
	    key: "isLoading",
	    get: function get() {
	      return this._loading;
	    }
	  }, {
	    key: "isUp",
	    get: function get() {
	      return this._entry.direction.isBackward;
	    }
	  }, {
	    key: "isDown",
	    get: function get() {
	      return this._entry.direction.isForward;
	    }
	  }, {
	    key: "error",
	    get: function get() {
	      if (this._error) {
	        var dir = this._entry.prev_batch ? "previous" : "next";
	        return "Could not load ".concat(dir, " messages: ").concat(this._error.message);
	      }

	      return null;
	    }
	  }]);

	  return GapTile;
	}(SimpleTile);

	var MessageTile = /*#__PURE__*/function (_SimpleTile) {
	  _inherits(MessageTile, _SimpleTile);

	  var _super = _createSuper(MessageTile);

	  function MessageTile(options) {
	    var _this;

	    _classCallCheck(this, MessageTile);

	    _this = _super.call(this, options);
	    _this._isOwn = _this._entry.sender === options.ownUserId;
	    _this._date = new Date(_this._entry.timestamp);
	    _this._isContinuation = false;
	    return _this;
	  }

	  _createClass(MessageTile, [{
	    key: "_getContent",
	    value: function _getContent() {
	      return this._entry.content;
	    }
	  }, {
	    key: "updatePreviousSibling",
	    value: function updatePreviousSibling(prev) {
	      _get(_getPrototypeOf(MessageTile.prototype), "updatePreviousSibling", this).call(this, prev);

	      var isContinuation = prev && prev instanceof MessageTile && prev.sender === this.sender;

	      if (isContinuation !== this._isContinuation) {
	        this._isContinuation = isContinuation;
	        this.emitUpdate("isContinuation");
	      }
	    }
	  }, {
	    key: "shape",
	    get: function get() {
	      return "message";
	    }
	  }, {
	    key: "sender",
	    get: function get() {
	      return this._entry.sender;
	    }
	  }, {
	    key: "senderColorNumber",
	    get: function get() {
	      return getIdentifierColorNumber(this._entry.sender);
	    }
	  }, {
	    key: "date",
	    get: function get() {
	      return this._date.toLocaleDateString({}, {
	        month: "numeric",
	        day: "numeric"
	      });
	    }
	  }, {
	    key: "time",
	    get: function get() {
	      return this._date.toLocaleTimeString({}, {
	        hour: "numeric",
	        minute: "2-digit"
	      });
	    }
	  }, {
	    key: "isOwn",
	    get: function get() {
	      return this._isOwn;
	    }
	  }, {
	    key: "isContinuation",
	    get: function get() {
	      return this._isContinuation;
	    }
	  }]);

	  return MessageTile;
	}(SimpleTile);

	var TextTile = /*#__PURE__*/function (_MessageTile) {
	  _inherits(TextTile, _MessageTile);

	  var _super = _createSuper(TextTile);

	  function TextTile() {
	    _classCallCheck(this, TextTile);

	    return _super.apply(this, arguments);
	  }

	  _createClass(TextTile, [{
	    key: "text",
	    get: function get() {
	      var content = this._getContent();

	      var body = content && content.body;

	      if (content.msgtype === "m.emote") {
	        return "* ".concat(this._entry.sender, " ").concat(body);
	      } else {
	        return body;
	      }
	    }
	  }]);

	  return TextTile;
	}(MessageTile);

	var MAX_HEIGHT = 300;
	var MAX_WIDTH = 400;
	var ImageTile = /*#__PURE__*/function (_MessageTile) {
	  _inherits(ImageTile, _MessageTile);

	  var _super = _createSuper(ImageTile);

	  function ImageTile(options, room) {
	    var _this;

	    _classCallCheck(this, ImageTile);

	    _this = _super.call(this, options);
	    _this._room = room;
	    return _this;
	  }

	  _createClass(ImageTile, [{
	    key: "_scaleFactor",
	    value: function _scaleFactor() {
	      var _this$_getContent = this._getContent(),
	          info = _this$_getContent.info;

	      var scaleHeightFactor = MAX_HEIGHT / info.h;
	      var scaleWidthFactor = MAX_WIDTH / info.w; // take the smallest scale factor, to respect all constraints
	      // we should not upscale images, so limit scale factor to 1 upwards

	      return Math.min(scaleWidthFactor, scaleHeightFactor, 1);
	    }
	  }, {
	    key: "thumbnailUrl",
	    get: function get() {
	      var mxcUrl = this._getContent().url;

	      return this._room.mxcUrlThumbnail(mxcUrl, this.thumbnailWidth, this.thumbnailHeight, "scale");
	    }
	  }, {
	    key: "url",
	    get: function get() {
	      var mxcUrl = this._getContent().url;

	      return this._room.mxcUrl(mxcUrl);
	    }
	  }, {
	    key: "thumbnailWidth",
	    get: function get() {
	      var _this$_getContent2 = this._getContent(),
	          info = _this$_getContent2.info;

	      return Math.round(info.w * this._scaleFactor());
	    }
	  }, {
	    key: "thumbnailHeight",
	    get: function get() {
	      var _this$_getContent3 = this._getContent(),
	          info = _this$_getContent3.info;

	      return Math.round(info.h * this._scaleFactor());
	    }
	  }, {
	    key: "label",
	    get: function get() {
	      return this._getContent().body;
	    }
	  }, {
	    key: "shape",
	    get: function get() {
	      return "image";
	    }
	  }]);

	  return ImageTile;
	}(MessageTile);

	/*
	map urls:
	apple:   https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
	android: https://developers.google.com/maps/documentation/urls/guide
	wp:      maps:49.275267 -122.988617
	https://www.habaneroconsulting.com/stories/insights/2011/opening-native-map-apps-from-the-mobile-browser
	*/

	var LocationTile = /*#__PURE__*/function (_MessageTile) {
	  _inherits(LocationTile, _MessageTile);

	  var _super = _createSuper(LocationTile);

	  function LocationTile() {
	    _classCallCheck(this, LocationTile);

	    return _super.apply(this, arguments);
	  }

	  _createClass(LocationTile, [{
	    key: "mapsLink",
	    get: function get() {
	      var geoUri = this._getContent().geo_uri;

	      var _geoUri$split$1$split = geoUri.split(":")[1].split(","),
	          _geoUri$split$1$split2 = _slicedToArray(_geoUri$split$1$split, 2),
	          lat = _geoUri$split$1$split2[0],
	          long = _geoUri$split$1$split2[1];

	      return "maps:".concat(lat, " ").concat(long);
	    }
	  }, {
	    key: "label",
	    get: function get() {
	      return "".concat(this.sender, " sent their location, click to see it in maps.");
	    }
	  }]);

	  return LocationTile;
	}(MessageTile);

	var RoomNameTile = /*#__PURE__*/function (_SimpleTile) {
	  _inherits(RoomNameTile, _SimpleTile);

	  var _super = _createSuper(RoomNameTile);

	  function RoomNameTile() {
	    _classCallCheck(this, RoomNameTile);

	    return _super.apply(this, arguments);
	  }

	  _createClass(RoomNameTile, [{
	    key: "shape",
	    get: function get() {
	      return "announcement";
	    }
	  }, {
	    key: "announcement",
	    get: function get() {
	      var content = this._entry.content;
	      return "".concat(this._entry.sender, " named the room \"").concat(content.name, "\"");
	    }
	  }]);

	  return RoomNameTile;
	}(SimpleTile);

	var RoomMemberTile = /*#__PURE__*/function (_SimpleTile) {
	  _inherits(RoomMemberTile, _SimpleTile);

	  var _super = _createSuper(RoomMemberTile);

	  function RoomMemberTile() {
	    _classCallCheck(this, RoomMemberTile);

	    return _super.apply(this, arguments);
	  }

	  _createClass(RoomMemberTile, [{
	    key: "shape",
	    get: function get() {
	      return "announcement";
	    }
	  }, {
	    key: "announcement",
	    get: function get() {
	      var _this$_entry = this._entry,
	          sender = _this$_entry.sender,
	          content = _this$_entry.content,
	          prevContent = _this$_entry.prevContent,
	          stateKey = _this$_entry.stateKey;
	      var membership = content && content.membership;
	      var prevMembership = prevContent && prevContent.membership;

	      if (prevMembership === "join" && membership === "join") {
	        if (content.avatar_url !== prevContent.avatar_url) {
	          return "".concat(stateKey, " changed their avatar");
	        } else if (content.displayname !== prevContent.displayname) {
	          return "".concat(stateKey, " changed their name to ").concat(content.displayname);
	        }
	      } else if (membership === "join") {
	        return "".concat(stateKey, " joined the room");
	      } else if (membership === "invite") {
	        return "".concat(stateKey, " was invited to the room by ").concat(sender);
	      } else if (prevMembership === "invite") {
	        if (membership === "join") {
	          return "".concat(stateKey, " accepted the invitation to join the room");
	        } else if (membership === "leave") {
	          return "".concat(stateKey, " declined the invitation to join the room");
	        }
	      } else if (membership === "leave") {
	        if (stateKey === sender) {
	          return "".concat(stateKey, " left the room");
	        } else {
	          var reason = content.reason;
	          return "".concat(stateKey, " was kicked from the room by ").concat(sender).concat(reason ? ": ".concat(reason) : "");
	        }
	      } else if (membership === "ban") {
	        return "".concat(stateKey, " was banned from the room by ").concat(sender);
	      }

	      return "".concat(sender, " membership changed to ").concat(content.membership);
	    }
	  }]);

	  return RoomMemberTile;
	}(SimpleTile);

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	function tilesCreator(_ref) {
	  var room = _ref.room,
	      ownUserId = _ref.ownUserId;
	  return function tilesCreator(entry, emitUpdate) {
	    var options = {
	      entry: entry,
	      emitUpdate: emitUpdate,
	      ownUserId: ownUserId
	    };

	    if (entry.isGap) {
	      return new GapTile(options, room);
	    } else if (entry.eventType) {
	      switch (entry.eventType) {
	        case "m.room.message":
	          {
	            var content = entry.content;
	            var msgtype = content && content.msgtype;

	            switch (msgtype) {
	              case "m.text":
	              case "m.notice":
	              case "m.emote":
	                return new TextTile(options);

	              case "m.image":
	                return new ImageTile(options, room);

	              case "m.location":
	                return new LocationTile(options);

	              default:
	                // unknown msgtype not rendered
	                return null;
	            }
	          }

	        case "m.room.name":
	          return new RoomNameTile(options);

	        case "m.room.member":
	          return new RoomMemberTile(options);

	        default:
	          // unknown type not rendered
	          return null;
	      }
	    }
	  };
	}

	var TimelineViewModel = /*#__PURE__*/function () {
	  function TimelineViewModel(_ref) {
	    var room = _ref.room,
	        timeline = _ref.timeline,
	        ownUserId = _ref.ownUserId;

	    _classCallCheck(this, TimelineViewModel);

	    this._timeline = timeline; // once we support sending messages we could do
	    // timeline.entries.concat(timeline.pendingEvents)
	    // for an ObservableList that also contains local echos

	    this._tiles = new TilesCollection(timeline.entries, tilesCreator({
	      room: room,
	      ownUserId: ownUserId
	    }));
	  } // doesn't fill gaps, only loads stored entries/tiles


	  _createClass(TimelineViewModel, [{
	    key: "loadAtTop",
	    value: function loadAtTop() {
	      return this._timeline.loadAtTop(50);
	    }
	  }, {
	    key: "unloadAtTop",
	    value: function unloadAtTop(tileAmount) {// get lowerSortKey for tile at index tileAmount - 1
	      // tell timeline to unload till there (included given key)
	    }
	  }, {
	    key: "loadAtBottom",
	    value: function loadAtBottom() {}
	  }, {
	    key: "unloadAtBottom",
	    value: function unloadAtBottom(tileAmount) {// get upperSortKey for tile at index tiles.length - tileAmount
	      // tell timeline to unload till there (included given key)
	    }
	  }, {
	    key: "tiles",
	    get: function get() {
	      return this._tiles;
	    }
	  }]);

	  return TimelineViewModel;
	}();

	var RoomViewModel = /*#__PURE__*/function (_ViewModel) {
	  _inherits(RoomViewModel, _ViewModel);

	  var _super = _createSuper(RoomViewModel);

	  function RoomViewModel(options) {
	    var _this;

	    _classCallCheck(this, RoomViewModel);

	    _this = _super.call(this, options);
	    var room = options.room,
	        ownUserId = options.ownUserId,
	        closeCallback = options.closeCallback;
	    _this._room = room;
	    _this._ownUserId = ownUserId;
	    _this._timeline = null;
	    _this._timelineVM = null;
	    _this._onRoomChange = _this._onRoomChange.bind(_assertThisInitialized(_this));
	    _this._timelineError = null;
	    _this._sendError = null;
	    _this._closeCallback = closeCallback;
	    _this._composerVM = new ComposerViewModel(_assertThisInitialized(_this));
	    return _this;
	  }

	  _createClass(RoomViewModel, [{
	    key: "load",
	    value: function () {
	      var _load = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                this._room.on("change", this._onRoomChange);

	                _context.prev = 1;
	                _context.next = 4;
	                return this._room.openTimeline();

	              case 4:
	                this._timeline = _context.sent;
	                this._timelineVM = new TimelineViewModel(this.childOptions({
	                  room: this._room,
	                  timeline: this._timeline,
	                  ownUserId: this._ownUserId
	                }));
	                this.emitChange("timelineViewModel");
	                _context.next = 14;
	                break;

	              case 9:
	                _context.prev = 9;
	                _context.t0 = _context["catch"](1);
	                console.error("room.openTimeline(): ".concat(_context.t0.message, ":\n").concat(_context.t0.stack));
	                this._timelineError = _context.t0;
	                this.emitChange("error");

	              case 14:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this, [[1, 9]]);
	      }));

	      function load() {
	        return _load.apply(this, arguments);
	      }

	      return load;
	    }()
	  }, {
	    key: "dispose",
	    value: function dispose() {
	      // this races with enable, on the await openTimeline()
	      if (this._timeline) {
	        // will stop the timeline from delivering updates on entries
	        this._timeline.close();
	      }
	    }
	  }, {
	    key: "close",
	    value: function close() {
	      this._closeCallback();
	    } // room doesn't tell us yet which fields changed,
	    // so emit all fields originating from summary

	  }, {
	    key: "_onRoomChange",
	    value: function _onRoomChange() {
	      this.emitChange("name");
	    }
	  }, {
	    key: "_sendMessage",
	    value: function () {
	      var _sendMessage2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(message) {
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                if (!message) {
	                  _context2.next = 14;
	                  break;
	                }

	                _context2.prev = 1;
	                _context2.next = 4;
	                return this._room.sendEvent("m.room.message", {
	                  msgtype: "m.text",
	                  body: message
	                });

	              case 4:
	                _context2.next = 13;
	                break;

	              case 6:
	                _context2.prev = 6;
	                _context2.t0 = _context2["catch"](1);
	                console.error("room.sendMessage(): ".concat(_context2.t0.message, ":\n").concat(_context2.t0.stack));
	                this._sendError = _context2.t0;
	                this._timelineError = null;
	                this.emitChange("error");
	                return _context2.abrupt("return", false);

	              case 13:
	                return _context2.abrupt("return", true);

	              case 14:
	                return _context2.abrupt("return", false);

	              case 15:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this, [[1, 6]]);
	      }));

	      function _sendMessage(_x) {
	        return _sendMessage2.apply(this, arguments);
	      }

	      return _sendMessage;
	    }()
	  }, {
	    key: "name",
	    get: function get() {
	      return this._room.name;
	    }
	  }, {
	    key: "timelineViewModel",
	    get: function get() {
	      return this._timelineVM;
	    }
	  }, {
	    key: "error",
	    get: function get() {
	      if (this._timelineError) {
	        return "Something went wrong loading the timeline: ".concat(this._timelineError.message);
	      }

	      if (this._sendError) {
	        return "Something went wrong sending your message: ".concat(this._sendError.message);
	      }

	      return "";
	    }
	  }, {
	    key: "avatarInitials",
	    get: function get() {
	      return avatarInitials(this._room.name);
	    }
	  }, {
	    key: "avatarColorNumber",
	    get: function get() {
	      return getIdentifierColorNumber(this._room.id);
	    }
	  }, {
	    key: "composerViewModel",
	    get: function get() {
	      return this._composerVM;
	    }
	  }]);

	  return RoomViewModel;
	}(ViewModel);

	var ComposerViewModel = /*#__PURE__*/function (_ViewModel2) {
	  _inherits(ComposerViewModel, _ViewModel2);

	  var _super2 = _createSuper(ComposerViewModel);

	  function ComposerViewModel(roomVM) {
	    var _this2;

	    _classCallCheck(this, ComposerViewModel);

	    _this2 = _super2.call(this);
	    _this2._roomVM = roomVM;
	    _this2._isEmpty = true;
	    return _this2;
	  }

	  _createClass(ComposerViewModel, [{
	    key: "sendMessage",
	    value: function sendMessage(message) {
	      var success = this._roomVM._sendMessage(message);

	      if (success) {
	        this._isEmpty = true;
	        this.emitChange("canSend");
	      }

	      return success;
	    }
	  }, {
	    key: "setInput",
	    value: function setInput(text) {
	      this._isEmpty = text.length === 0;
	      this.emitChange("canSend");
	    }
	  }, {
	    key: "canSend",
	    get: function get() {
	      return !this._isEmpty;
	    }
	  }]);

	  return ComposerViewModel;
	}(ViewModel);

	function _templateObject4() {
	  var data = _taggedTemplateLiteral(["Sync failed because of ", ""]);

	  _templateObject4 = function _templateObject4() {
	    return data;
	  };

	  return data;
	}

	function _templateObject3() {
	  var data = _taggedTemplateLiteral(["Catching up with your conversations\u2026"]);

	  _templateObject3 = function _templateObject3() {
	    return data;
	  };

	  return data;
	}

	function _templateObject2() {
	  var data = _taggedTemplateLiteral(["Trying to reconnect now\u2026"]);

	  _templateObject2 = function _templateObject2() {
	    return data;
	  };

	  return data;
	}

	function _templateObject() {
	  var data = _taggedTemplateLiteral(["Disconnected, trying to reconnect in ", "s\u2026"]);

	  _templateObject = function _templateObject() {
	    return data;
	  };

	  return data;
	}
	var SessionStatus = createEnum("Disconnected", "Connecting", "FirstSync", "Sending", "Syncing", "SyncError");
	var SessionStatusViewModel = /*#__PURE__*/function (_ViewModel) {
	  _inherits(SessionStatusViewModel, _ViewModel);

	  var _super = _createSuper(SessionStatusViewModel);

	  function SessionStatusViewModel(options) {
	    var _this;

	    _classCallCheck(this, SessionStatusViewModel);

	    _this = _super.call(this, options);
	    var sync = options.sync,
	        reconnector = options.reconnector;
	    _this._sync = sync;
	    _this._reconnector = reconnector;
	    _this._status = _this._calculateState(reconnector.connectionStatus.get(), sync.status.get());
	    return _this;
	  }

	  _createClass(SessionStatusViewModel, [{
	    key: "start",
	    value: function start() {
	      var _this2 = this;

	      var update = function update() {
	        return _this2._updateStatus();
	      };

	      this.track(this._sync.status.subscribe(update));
	      this.track(this._reconnector.connectionStatus.subscribe(update));
	    }
	  }, {
	    key: "_updateStatus",
	    value: function _updateStatus() {
	      var _this3 = this;

	      var newStatus = this._calculateState(this._reconnector.connectionStatus.get(), this._sync.status.get());

	      if (newStatus !== this._status) {
	        if (newStatus === SessionStatus.Disconnected) {
	          this._retryTimer = this.track(this.clock.createInterval(function () {
	            _this3.emitChange("statusLabel");
	          }, 1000));
	        } else {
	          this._retryTimer = this.disposeTracked(this._retryTimer);
	        }

	        this._status = newStatus;
	        console.log("newStatus", newStatus);
	        this.emitChange();
	      }
	    }
	  }, {
	    key: "_calculateState",
	    value: function _calculateState(connectionStatus, syncStatus) {
	      if (connectionStatus !== ConnectionStatus.Online) {
	        switch (connectionStatus) {
	          case ConnectionStatus.Reconnecting:
	            return SessionStatus.Connecting;

	          case ConnectionStatus.Waiting:
	            return SessionStatus.Disconnected;
	        }
	      } else if (syncStatus !== SyncStatus.Syncing) {
	        switch (syncStatus) {
	          // InitialSync should be awaited in the SessionLoadViewModel,
	          // but include it here anyway
	          case SyncStatus.InitialSync:
	          case SyncStatus.CatchupSync:
	            return SessionStatus.FirstSync;

	          case SyncStatus.Stopped:
	            return SessionStatus.SyncError;
	        }
	      }
	      /* else if (session.pendingMessageCount) {
	        return SessionStatus.Sending;
	      } */
	      else {
	          return SessionStatus.Syncing;
	        }
	    }
	  }, {
	    key: "connectNow",
	    value: function connectNow() {
	      if (this.isConnectNowShown) {
	        this._reconnector.tryNow();
	      }
	    }
	  }, {
	    key: "isShown",
	    get: function get() {
	      return this._status !== SessionStatus.Syncing;
	    }
	  }, {
	    key: "statusLabel",
	    get: function get() {
	      switch (this._status) {
	        case SessionStatus.Disconnected:
	          {
	            var retryIn = Math.round(this._reconnector.retryIn / 1000);
	            return this.i18n(_templateObject(), retryIn);
	          }

	        case SessionStatus.Connecting:
	          return this.i18n(_templateObject2());

	        case SessionStatus.FirstSync:
	          return this.i18n(_templateObject3());

	        case SessionStatus.SyncError:
	          return this.i18n(_templateObject4(), this._sync.error);
	      }

	      return "";
	    }
	  }, {
	    key: "isWaiting",
	    get: function get() {
	      switch (this._status) {
	        case SessionStatus.Connecting:
	        case SessionStatus.FirstSync:
	          return true;

	        default:
	          return false;
	      }
	    }
	  }, {
	    key: "isConnectNowShown",
	    get: function get() {
	      return this._status === SessionStatus.Disconnected;
	    }
	  }]);

	  return SessionStatusViewModel;
	}(ViewModel);

	var SessionViewModel = /*#__PURE__*/function (_ViewModel) {
	  _inherits(SessionViewModel, _ViewModel);

	  var _super = _createSuper(SessionViewModel);

	  function SessionViewModel(options) {
	    var _this;

	    _classCallCheck(this, SessionViewModel);

	    _this = _super.call(this, options);
	    var sessionContainer = options.sessionContainer;
	    _this._session = sessionContainer.session;
	    _this._sessionStatusViewModel = _this.track(new SessionStatusViewModel(_this.childOptions({
	      sync: sessionContainer.sync,
	      reconnector: sessionContainer.reconnector
	    })));
	    _this._currentRoomTileViewModel = null;
	    _this._currentRoomViewModel = null;

	    var roomTileVMs = _this._session.rooms.mapValues(function (room, emitChange) {
	      return new RoomTileViewModel({
	        room: room,
	        emitChange: emitChange,
	        emitOpen: _this._openRoom.bind(_assertThisInitialized(_this))
	      });
	    });

	    _this._roomList = roomTileVMs.sortValues(function (a, b) {
	      return a.compare(b);
	    });
	    return _this;
	  }

	  _createClass(SessionViewModel, [{
	    key: "start",
	    value: function start() {
	      this._sessionStatusViewModel.start();
	    }
	  }, {
	    key: "_closeCurrentRoom",
	    value: function _closeCurrentRoom() {
	      if (this._currentRoomViewModel) {
	        this._currentRoomViewModel = this.disposeTracked(this._currentRoomViewModel);
	        this.emitChange("currentRoom");
	      }
	    }
	  }, {
	    key: "_openRoom",
	    value: function _openRoom(room, roomTileVM) {
	      var _this2 = this;

	      if (this._currentRoomTileViewModel) {
	        this._currentRoomTileViewModel.close();
	      }

	      this._currentRoomTileViewModel = roomTileVM;

	      if (this._currentRoomViewModel) {
	        this._currentRoomViewModel = this.disposeTracked(this._currentRoomViewModel);
	      }

	      this._currentRoomViewModel = this.track(new RoomViewModel(this.childOptions({
	        room: room,
	        ownUserId: this._session.user.id,
	        closeCallback: function closeCallback() {
	          return _this2._closeCurrentRoom();
	        }
	      })));

	      this._currentRoomViewModel.load();

	      this.emitChange("currentRoom");
	    }
	  }, {
	    key: "sessionStatusViewModel",
	    get: function get() {
	      return this._sessionStatusViewModel;
	    }
	  }, {
	    key: "roomList",
	    get: function get() {
	      return this._roomList;
	    }
	  }, {
	    key: "currentRoom",
	    get: function get() {
	      return this._currentRoomViewModel;
	    }
	  }]);

	  return SessionViewModel;
	}(ViewModel);

	var SessionLoadViewModel = /*#__PURE__*/function (_ViewModel) {
	  _inherits(SessionLoadViewModel, _ViewModel);

	  var _super = _createSuper(SessionLoadViewModel);

	  function SessionLoadViewModel(options) {
	    var _this;

	    _classCallCheck(this, SessionLoadViewModel);

	    _this = _super.call(this, options);
	    var createAndStartSessionContainer = options.createAndStartSessionContainer,
	        sessionCallback = options.sessionCallback,
	        homeserver = options.homeserver,
	        deleteSessionOnCancel = options.deleteSessionOnCancel;
	    _this._createAndStartSessionContainer = createAndStartSessionContainer;
	    _this._sessionCallback = sessionCallback;
	    _this._homeserver = homeserver;
	    _this._deleteSessionOnCancel = deleteSessionOnCancel;
	    _this._loading = false;
	    _this._error = null;
	    return _this;
	  }

	  _createClass(SessionLoadViewModel, [{
	    key: "start",
	    value: function () {
	      var _start = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        var _this2 = this;

	        var loadStatus;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                if (!this._loading) {
	                  _context.next = 2;
	                  break;
	                }

	                return _context.abrupt("return");

	              case 2:
	                _context.prev = 2;
	                this._loading = true;
	                this.emitChange("loading");
	                this._sessionContainer = this._createAndStartSessionContainer();
	                this._waitHandle = this._sessionContainer.loadStatus.waitFor(function (s) {
	                  _this2.emitChange("loadLabel"); // wait for initial sync, but not catchup sync


	                  var isCatchupSync = s === LoadStatus.FirstSync && _this2._sessionContainer.sync.status.get() === SyncStatus.CatchupSync;
	                  return isCatchupSync || s === LoadStatus.LoginFailed || s === LoadStatus.Error || s === LoadStatus.Ready;
	                });
	                _context.prev = 7;
	                _context.next = 10;
	                return this._waitHandle.promise;

	              case 10:
	                _context.next = 15;
	                break;

	              case 12:
	                _context.prev = 12;
	                _context.t0 = _context["catch"](7);
	                return _context.abrupt("return");

	              case 15:
	                // TODO: should we deal with no connection during initial sync 
	                // and we're retrying as well here?
	                // e.g. show in the label what is going on wrt connectionstatus
	                // much like we will once you are in the app. Probably a good idea
	                // did it finish or get stuck at LoginFailed or Error?
	                loadStatus = this._sessionContainer.loadStatus.get();

	                if (loadStatus === LoadStatus.FirstSync || loadStatus === LoadStatus.Ready) {
	                  this._sessionCallback(this._sessionContainer);
	                }

	                _context.next = 22;
	                break;

	              case 19:
	                _context.prev = 19;
	                _context.t1 = _context["catch"](2);
	                this._error = _context.t1;

	              case 22:
	                _context.prev = 22;
	                this._loading = false;
	                this.emitChange("loading");
	                return _context.finish(22);

	              case 26:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this, [[2, 19, 22, 26], [7, 12]]);
	      }));

	      function start() {
	        return _start.apply(this, arguments);
	      }

	      return start;
	    }()
	  }, {
	    key: "cancel",
	    value: function () {
	      var _cancel = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                _context2.prev = 0;

	                if (!this._sessionContainer) {
	                  _context2.next = 7;
	                  break;
	                }

	                this._sessionContainer.stop();

	                if (!this._deleteSessionOnCancel) {
	                  _context2.next = 6;
	                  break;
	                }

	                _context2.next = 6;
	                return this._sessionContainer.deletSession();

	              case 6:
	                this._sessionContainer = null;

	              case 7:
	                if (this._waitHandle) {
	                  // rejects with AbortError
	                  this._waitHandle.dispose();

	                  this._waitHandle = null;
	                }

	                this._sessionCallback();

	                _context2.next = 15;
	                break;

	              case 11:
	                _context2.prev = 11;
	                _context2.t0 = _context2["catch"](0);
	                this._error = _context2.t0;
	                this.emitChange();

	              case 15:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this, [[0, 11]]);
	      }));

	      function cancel() {
	        return _cancel.apply(this, arguments);
	      }

	      return cancel;
	    }() // to show a spinner or not

	  }, {
	    key: "loading",
	    get: function get() {
	      return this._loading;
	    }
	  }, {
	    key: "loadLabel",
	    get: function get() {
	      var sc = this._sessionContainer;
	      var error = this._error || sc && sc.loadError;

	      if (error || sc && sc.loadStatus.get() === LoadStatus.Error) {
	        return "Something went wrong: ".concat(error && error.message, ".");
	      }

	      if (sc) {
	        switch (sc.loadStatus.get()) {
	          case LoadStatus.NotLoading:
	            return "Preparing\u2026";

	          case LoadStatus.Login:
	            return "Checking your login and password\u2026";

	          case LoadStatus.LoginFailed:
	            switch (sc.loginFailure) {
	              case LoginFailure.LoginFailure:
	                return "Your username and/or password don't seem to be correct.";

	              case LoginFailure.Connection:
	                return "Can't connect to ".concat(this._homeserver, ".");

	              case LoginFailure.Unknown:
	                return "Something went wrong while checking your login and password.";
	            }

	            break;

	          case LoadStatus.Loading:
	            return "Loading your conversations\u2026";

	          case LoadStatus.FirstSync:
	            return "Getting your conversations from the server\u2026";

	          default:
	            return this._sessionContainer.loadStatus.get();
	        }
	      }

	      return "Preparing\u2026";
	    }
	  }]);

	  return SessionLoadViewModel;
	}(ViewModel);

	var LoginViewModel = /*#__PURE__*/function (_ViewModel) {
	  _inherits(LoginViewModel, _ViewModel);

	  var _super = _createSuper(LoginViewModel);

	  function LoginViewModel(options) {
	    var _this;

	    _classCallCheck(this, LoginViewModel);

	    _this = _super.call(this, options);
	    var sessionCallback = options.sessionCallback,
	        defaultHomeServer = options.defaultHomeServer,
	        createSessionContainer = options.createSessionContainer;
	    _this._createSessionContainer = createSessionContainer;
	    _this._sessionCallback = sessionCallback;
	    _this._defaultHomeServer = defaultHomeServer;
	    _this._loadViewModel = null;
	    _this._loadViewModelSubscription = null;
	    return _this;
	  }

	  _createClass(LoginViewModel, [{
	    key: "login",
	    value: function () {
	      var _login = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(username, password, homeserver) {
	        var _this2 = this;

	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                this._loadViewModelSubscription = this.disposeTracked(this._loadViewModelSubscription);

	                if (this._loadViewModel) {
	                  this._loadViewModel.cancel();
	                }

	                this._loadViewModel = new SessionLoadViewModel({
	                  createAndStartSessionContainer: function createAndStartSessionContainer() {
	                    var sessionContainer = _this2._createSessionContainer();

	                    sessionContainer.startWithLogin(homeserver, username, password);
	                    return sessionContainer;
	                  },
	                  sessionCallback: function sessionCallback(sessionContainer) {
	                    if (sessionContainer) {
	                      // make parent view model move away
	                      _this2._sessionCallback(sessionContainer);
	                    } else {
	                      // show list of session again
	                      _this2._loadViewModel = null;

	                      _this2.emitChange("loadViewModel");
	                    }
	                  },
	                  deleteSessionOnCancel: true,
	                  homeserver: homeserver
	                });

	                this._loadViewModel.start();

	                this.emitChange("loadViewModel");
	                this._loadViewModelSubscription = this.track(this._loadViewModel.disposableOn("change", function () {
	                  if (!_this2._loadViewModel.loading) {
	                    _this2._loadViewModelSubscription = _this2.disposeTracked(_this2._loadViewModelSubscription);
	                  }

	                  _this2.emitChange("isBusy");
	                }));

	              case 6:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function login(_x, _x2, _x3) {
	        return _login.apply(this, arguments);
	      }

	      return login;
	    }()
	  }, {
	    key: "cancel",
	    value: function cancel() {
	      if (!this.isBusy) {
	        this._sessionCallback();
	      }
	    }
	  }, {
	    key: "defaultHomeServer",
	    get: function get() {
	      return this._defaultHomeServer;
	    }
	  }, {
	    key: "loadViewModel",
	    get: function get() {
	      return this._loadViewModel;
	    }
	  }, {
	    key: "isBusy",
	    get: function get() {
	      if (!this._loadViewModel) {
	        return false;
	      } else {
	        return this._loadViewModel.loading;
	      }
	    }
	  }]);

	  return LoginViewModel;
	}(ViewModel);

	var SessionItemViewModel = /*#__PURE__*/function (_ViewModel) {
	  _inherits(SessionItemViewModel, _ViewModel);

	  var _super = _createSuper(SessionItemViewModel);

	  function SessionItemViewModel(sessionInfo, pickerVM) {
	    var _this;

	    _classCallCheck(this, SessionItemViewModel);

	    _this = _super.call(this, {});
	    _this._pickerVM = pickerVM;
	    _this._sessionInfo = sessionInfo;
	    _this._isDeleting = false;
	    _this._isClearing = false;
	    _this._error = null;
	    _this._exportDataUrl = null;
	    return _this;
	  }

	  _createClass(SessionItemViewModel, [{
	    key: "delete",
	    value: function () {
	      var _delete2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                this._isDeleting = true;
	                this.emitChange("isDeleting");
	                _context.prev = 2;
	                _context.next = 5;
	                return this._pickerVM.delete(this.id);

	              case 5:
	                _context.next = 12;
	                break;

	              case 7:
	                _context.prev = 7;
	                _context.t0 = _context["catch"](2);
	                this._error = _context.t0;
	                console.error(_context.t0);
	                this.emitChange("error");

	              case 12:
	                _context.prev = 12;
	                this._isDeleting = false;
	                this.emitChange("isDeleting");
	                return _context.finish(12);

	              case 16:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this, [[2, 7, 12, 16]]);
	      }));

	      function _delete() {
	        return _delete2.apply(this, arguments);
	      }

	      return _delete;
	    }()
	  }, {
	    key: "clear",
	    value: function () {
	      var _clear = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                this._isClearing = true;
	                this.emitChange();
	                _context2.prev = 2;
	                _context2.next = 5;
	                return this._pickerVM.clear(this.id);

	              case 5:
	                _context2.next = 12;
	                break;

	              case 7:
	                _context2.prev = 7;
	                _context2.t0 = _context2["catch"](2);
	                this._error = _context2.t0;
	                console.error(_context2.t0);
	                this.emitChange("error");

	              case 12:
	                _context2.prev = 12;
	                this._isClearing = false;
	                this.emitChange("isClearing");
	                return _context2.finish(12);

	              case 16:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this, [[2, 7, 12, 16]]);
	      }));

	      function clear() {
	        return _clear.apply(this, arguments);
	      }

	      return clear;
	    }()
	  }, {
	    key: "export",
	    value: function () {
	      var _export2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
	        var data, json, blob;
	        return regeneratorRuntime.wrap(function _callee3$(_context3) {
	          while (1) {
	            switch (_context3.prev = _context3.next) {
	              case 0:
	                _context3.prev = 0;
	                _context3.next = 3;
	                return this._pickerVM._exportData(this._sessionInfo.id);

	              case 3:
	                data = _context3.sent;
	                json = JSON.stringify(data, undefined, 2);
	                blob = new Blob([json], {
	                  type: "application/json"
	                });
	                this._exportDataUrl = URL.createObjectURL(blob);
	                this.emitChange("exportDataUrl");
	                _context3.next = 14;
	                break;

	              case 10:
	                _context3.prev = 10;
	                _context3.t0 = _context3["catch"](0);
	                alert(_context3.t0.message);
	                console.error(_context3.t0);

	              case 14:
	              case "end":
	                return _context3.stop();
	            }
	          }
	        }, _callee3, this, [[0, 10]]);
	      }));

	      function _export() {
	        return _export2.apply(this, arguments);
	      }

	      return _export;
	    }()
	  }, {
	    key: "clearExport",
	    value: function clearExport() {
	      if (this._exportDataUrl) {
	        URL.revokeObjectURL(this._exportDataUrl);
	        this._exportDataUrl = null;
	        this.emitChange("exportDataUrl");
	      }
	    }
	  }, {
	    key: "error",
	    get: function get() {
	      return this._error && this._error.message;
	    }
	  }, {
	    key: "isDeleting",
	    get: function get() {
	      return this._isDeleting;
	    }
	  }, {
	    key: "isClearing",
	    get: function get() {
	      return this._isClearing;
	    }
	  }, {
	    key: "id",
	    get: function get() {
	      return this._sessionInfo.id;
	    }
	  }, {
	    key: "label",
	    get: function get() {
	      var _this$_sessionInfo = this._sessionInfo,
	          userId = _this$_sessionInfo.userId,
	          comment = _this$_sessionInfo.comment;

	      if (comment) {
	        return "".concat(userId, " (").concat(comment, ")");
	      } else {
	        return userId;
	      }
	    }
	  }, {
	    key: "sessionInfo",
	    get: function get() {
	      return this._sessionInfo;
	    }
	  }, {
	    key: "exportDataUrl",
	    get: function get() {
	      return this._exportDataUrl;
	    }
	  }, {
	    key: "avatarColorNumber",
	    get: function get() {
	      return getIdentifierColorNumber(this._sessionInfo.userId);
	    }
	  }, {
	    key: "avatarInitials",
	    get: function get() {
	      return avatarInitials(this._sessionInfo.userId);
	    }
	  }]);

	  return SessionItemViewModel;
	}(ViewModel);

	var SessionPickerViewModel = /*#__PURE__*/function (_ViewModel2) {
	  _inherits(SessionPickerViewModel, _ViewModel2);

	  var _super2 = _createSuper(SessionPickerViewModel);

	  function SessionPickerViewModel(options) {
	    var _this2;

	    _classCallCheck(this, SessionPickerViewModel);

	    _this2 = _super2.call(this, options);
	    var storageFactory = options.storageFactory,
	        sessionInfoStorage = options.sessionInfoStorage,
	        sessionCallback = options.sessionCallback,
	        createSessionContainer = options.createSessionContainer;
	    _this2._storageFactory = storageFactory;
	    _this2._sessionInfoStorage = sessionInfoStorage;
	    _this2._sessionCallback = sessionCallback;
	    _this2._createSessionContainer = createSessionContainer;
	    _this2._sessions = new SortedArray(function (s1, s2) {
	      return s1.id.localeCompare(s2.id);
	    });
	    _this2._loadViewModel = null;
	    _this2._error = null;
	    return _this2;
	  } // this loads all the sessions


	  _createClass(SessionPickerViewModel, [{
	    key: "load",
	    value: function () {
	      var _load = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
	        var _this3 = this;

	        var sessions;
	        return regeneratorRuntime.wrap(function _callee4$(_context4) {
	          while (1) {
	            switch (_context4.prev = _context4.next) {
	              case 0:
	                _context4.next = 2;
	                return this._sessionInfoStorage.getAll();

	              case 2:
	                sessions = _context4.sent;

	                this._sessions.setManyUnsorted(sessions.map(function (s) {
	                  return new SessionItemViewModel(s, _this3);
	                }));

	              case 4:
	              case "end":
	                return _context4.stop();
	            }
	          }
	        }, _callee4, this);
	      }));

	      function load() {
	        return _load.apply(this, arguments);
	      }

	      return load;
	    }() // for the loading of 1 picked session

	  }, {
	    key: "pick",
	    value: function () {
	      var _pick = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(id) {
	        var _this4 = this;

	        var sessionVM;
	        return regeneratorRuntime.wrap(function _callee5$(_context5) {
	          while (1) {
	            switch (_context5.prev = _context5.next) {
	              case 0:
	                if (!this._loadViewModel) {
	                  _context5.next = 2;
	                  break;
	                }

	                return _context5.abrupt("return");

	              case 2:
	                sessionVM = this._sessions.array.find(function (s) {
	                  return s.id === id;
	                });

	                if (sessionVM) {
	                  this._loadViewModel = new SessionLoadViewModel({
	                    createAndStartSessionContainer: function createAndStartSessionContainer() {
	                      var sessionContainer = _this4._createSessionContainer();

	                      sessionContainer.startWithExistingSession(sessionVM.id);
	                      return sessionContainer;
	                    },
	                    sessionCallback: function sessionCallback(sessionContainer) {
	                      if (sessionContainer) {
	                        // make parent view model move away
	                        _this4._sessionCallback(sessionContainer);
	                      } else {
	                        // show list of session again
	                        _this4._loadViewModel = null;

	                        _this4.emitChange("loadViewModel");
	                      }
	                    }
	                  });

	                  this._loadViewModel.start();

	                  this.emitChange("loadViewModel");
	                }

	              case 4:
	              case "end":
	                return _context5.stop();
	            }
	          }
	        }, _callee5, this);
	      }));

	      function pick(_x) {
	        return _pick.apply(this, arguments);
	      }

	      return pick;
	    }()
	  }, {
	    key: "_exportData",
	    value: function () {
	      var _exportData2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(id) {
	        var sessionInfo, stores, data;
	        return regeneratorRuntime.wrap(function _callee6$(_context6) {
	          while (1) {
	            switch (_context6.prev = _context6.next) {
	              case 0:
	                _context6.next = 2;
	                return this._sessionInfoStorage.get(id);

	              case 2:
	                sessionInfo = _context6.sent;
	                _context6.next = 5;
	                return this._storageFactory.export(id);

	              case 5:
	                stores = _context6.sent;
	                data = {
	                  sessionInfo: sessionInfo,
	                  stores: stores
	                };
	                return _context6.abrupt("return", data);

	              case 8:
	              case "end":
	                return _context6.stop();
	            }
	          }
	        }, _callee6, this);
	      }));

	      function _exportData(_x2) {
	        return _exportData2.apply(this, arguments);
	      }

	      return _exportData;
	    }()
	  }, {
	    key: "import",
	    value: function () {
	      var _import2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7(json) {
	        var data, sessionInfo;
	        return regeneratorRuntime.wrap(function _callee7$(_context7) {
	          while (1) {
	            switch (_context7.prev = _context7.next) {
	              case 0:
	                data = JSON.parse(json);
	                sessionInfo = data.sessionInfo;
	                sessionInfo.comment = "Imported on ".concat(new Date().toLocaleString(), " from id ").concat(sessionInfo.id, ".");
	                sessionInfo.id = this._createSessionContainer().createNewSessionId();
	                _context7.next = 6;
	                return this._storageFactory.import(sessionInfo.id, data.stores);

	              case 6:
	                _context7.next = 8;
	                return this._sessionInfoStorage.add(sessionInfo);

	              case 8:
	                this._sessions.set(new SessionItemViewModel(sessionInfo, this));

	              case 9:
	              case "end":
	                return _context7.stop();
	            }
	          }
	        }, _callee7, this);
	      }));

	      function _import(_x3) {
	        return _import2.apply(this, arguments);
	      }

	      return _import;
	    }()
	  }, {
	    key: "delete",
	    value: function () {
	      var _delete3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8(id) {
	        var idx;
	        return regeneratorRuntime.wrap(function _callee8$(_context8) {
	          while (1) {
	            switch (_context8.prev = _context8.next) {
	              case 0:
	                idx = this._sessions.array.findIndex(function (s) {
	                  return s.id === id;
	                });
	                _context8.next = 3;
	                return this._sessionInfoStorage.delete(id);

	              case 3:
	                _context8.next = 5;
	                return this._storageFactory.delete(id);

	              case 5:
	                this._sessions.remove(idx);

	              case 6:
	              case "end":
	                return _context8.stop();
	            }
	          }
	        }, _callee8, this);
	      }));

	      function _delete(_x4) {
	        return _delete3.apply(this, arguments);
	      }

	      return _delete;
	    }()
	  }, {
	    key: "clear",
	    value: function () {
	      var _clear2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9(id) {
	        return regeneratorRuntime.wrap(function _callee9$(_context9) {
	          while (1) {
	            switch (_context9.prev = _context9.next) {
	              case 0:
	                _context9.next = 2;
	                return this._storageFactory.delete(id);

	              case 2:
	              case "end":
	                return _context9.stop();
	            }
	          }
	        }, _callee9, this);
	      }));

	      function clear(_x5) {
	        return _clear2.apply(this, arguments);
	      }

	      return clear;
	    }()
	  }, {
	    key: "cancel",
	    value: function cancel() {
	      if (!this._loadViewModel) {
	        this._sessionCallback();
	      }
	    }
	  }, {
	    key: "loadViewModel",
	    get: function get() {
	      return this._loadViewModel;
	    }
	  }, {
	    key: "sessions",
	    get: function get() {
	      return this._sessions;
	    }
	  }]);

	  return SessionPickerViewModel;
	}(ViewModel);

	var BrawlViewModel = /*#__PURE__*/function (_ViewModel) {
	  _inherits(BrawlViewModel, _ViewModel);

	  var _super = _createSuper(BrawlViewModel);

	  function BrawlViewModel(options) {
	    var _this;

	    _classCallCheck(this, BrawlViewModel);

	    _this = _super.call(this, options);
	    var createSessionContainer = options.createSessionContainer,
	        sessionInfoStorage = options.sessionInfoStorage,
	        storageFactory = options.storageFactory;
	    _this._createSessionContainer = createSessionContainer;
	    _this._sessionInfoStorage = sessionInfoStorage;
	    _this._storageFactory = storageFactory;
	    _this._error = null;
	    _this._sessionViewModel = null;
	    _this._loginViewModel = null;
	    _this._sessionPickerViewModel = null;
	    _this._sessionContainer = null;
	    _this._sessionCallback = _this._sessionCallback.bind(_assertThisInitialized(_this));
	    return _this;
	  }

	  _createClass(BrawlViewModel, [{
	    key: "load",
	    value: function () {
	      var _load = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _context.next = 2;
	                return this._sessionInfoStorage.hasAnySession();

	              case 2:
	                if (!_context.sent) {
	                  _context.next = 6;
	                  break;
	                }

	                this._showPicker();

	                _context.next = 7;
	                break;

	              case 6:
	                this._showLogin();

	              case 7:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function load() {
	        return _load.apply(this, arguments);
	      }

	      return load;
	    }()
	  }, {
	    key: "_sessionCallback",
	    value: function _sessionCallback(sessionContainer) {
	      var _this2 = this;

	      if (sessionContainer) {
	        this._setSection(function () {
	          _this2._sessionContainer = sessionContainer;
	          _this2._sessionViewModel = new SessionViewModel(_this2.childOptions({
	            sessionContainer: sessionContainer
	          }));

	          _this2._sessionViewModel.start();
	        });
	      } else {
	        // switch between picker and login
	        if (this.activeSection === "login") {
	          this._showPicker();
	        } else {
	          this._showLogin();
	        }
	      }
	    }
	  }, {
	    key: "_showPicker",
	    value: function () {
	      var _showPicker2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
	        var _this3 = this;

	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                this._setSection(function () {
	                  _this3._sessionPickerViewModel = new SessionPickerViewModel({
	                    sessionInfoStorage: _this3._sessionInfoStorage,
	                    storageFactory: _this3._storageFactory,
	                    createSessionContainer: _this3._createSessionContainer,
	                    sessionCallback: _this3._sessionCallback
	                  });
	                });

	                _context2.prev = 1;
	                _context2.next = 4;
	                return this._sessionPickerViewModel.load();

	              case 4:
	                _context2.next = 9;
	                break;

	              case 6:
	                _context2.prev = 6;
	                _context2.t0 = _context2["catch"](1);

	                this._setSection(function () {
	                  return _this3._error = _context2.t0;
	                });

	              case 9:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this, [[1, 6]]);
	      }));

	      function _showPicker() {
	        return _showPicker2.apply(this, arguments);
	      }

	      return _showPicker;
	    }()
	  }, {
	    key: "_showLogin",
	    value: function _showLogin() {
	      var _this4 = this;

	      this._setSection(function () {
	        _this4._loginViewModel = new LoginViewModel({
	          defaultHomeServer: "https://matrix.org",
	          createSessionContainer: _this4._createSessionContainer,
	          sessionCallback: _this4._sessionCallback
	        });
	      });
	    }
	  }, {
	    key: "_setSection",
	    value: function _setSection(setter) {
	      // clear all members the activeSection depends on
	      this._error = null;
	      this._sessionViewModel = null;
	      this._loginViewModel = null;
	      this._sessionPickerViewModel = null;

	      if (this._sessionContainer) {
	        this._sessionContainer.stop();

	        this._sessionContainer = null;
	      } // now set it again


	      setter();
	      this.emitChange("activeSection");
	    }
	  }, {
	    key: "activeSection",
	    get: function get() {
	      if (this._error) {
	        return "error";
	      } else if (this._sessionViewModel) {
	        return "session";
	      } else if (this._loginViewModel) {
	        return "login";
	      } else {
	        return "picker";
	      }
	    }
	  }, {
	    key: "error",
	    get: function get() {
	      return this._error;
	    }
	  }, {
	    key: "sessionViewModel",
	    get: function get() {
	      return this._sessionViewModel;
	    }
	  }, {
	    key: "loginViewModel",
	    get: function get() {
	      return this._loginViewModel;
	    }
	  }, {
	    key: "sessionPickerViewModel",
	    get: function get() {
	      return this._sessionPickerViewModel;
	    }
	  }]);

	  return BrawlViewModel;
	}(ViewModel);

	var _TAG_NAMES;

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	// DOM helper functions
	function isChildren(children) {
	  // children should be an not-object (that's the attributes), or a domnode, or an array
	  return _typeof(children) !== "object" || !!children.nodeType || Array.isArray(children);
	}
	function classNames(obj, value) {
	  return Object.entries(obj).reduce(function (cn, _ref) {
	    var _ref2 = _slicedToArray(_ref, 2),
	        name = _ref2[0],
	        enabled = _ref2[1];

	    if (typeof enabled === "function") {
	      enabled = enabled(value);
	    }

	    if (enabled) {
	      return cn + (cn.length ? " " : "") + name;
	    } else {
	      return cn;
	    }
	  }, "");
	}
	function setAttribute(el, name, value) {
	  if (name === "className") {
	    name = "class";
	  }

	  if (value === false) {
	    el.removeAttribute(name);
	  } else {
	    if (value === true) {
	      value = name;
	    }

	    el.setAttribute(name, value);
	  }
	}
	function elNS(ns, elementName, attributes, children) {
	  if (attributes && isChildren(attributes)) {
	    children = attributes;
	    attributes = null;
	  }

	  var e = document.createElementNS(ns, elementName);

	  if (attributes) {
	    for (var _i = 0, _Object$entries = Object.entries(attributes); _i < _Object$entries.length; _i++) {
	      var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
	          name = _Object$entries$_i[0],
	          value = _Object$entries$_i[1];

	      if (name === "className" && _typeof(value) === "object" && value !== null) {
	        value = classNames(value);
	      }

	      setAttribute(e, name, value);
	    }
	  }

	  if (children) {
	    if (!Array.isArray(children)) {
	      children = [children];
	    }

	    var _iterator = _createForOfIteratorHelper(children),
	        _step;

	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var c = _step.value;

	        if (!c.nodeType) {
	          c = text(c);
	        }

	        e.appendChild(c);
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }
	  }

	  return e;
	}
	function text(str) {
	  return document.createTextNode(str);
	}
	var HTML_NS = "http://www.w3.org/1999/xhtml";
	var SVG_NS = "http://www.w3.org/2000/svg";
	var TAG_NAMES = (_TAG_NAMES = {}, _defineProperty(_TAG_NAMES, HTML_NS, ["a", "ol", "ul", "li", "div", "h1", "h2", "h3", "h4", "h5", "h6", "p", "strong", "em", "span", "img", "section", "main", "article", "aside", "pre", "button", "time", "input", "textarea", "label"]), _defineProperty(_TAG_NAMES, SVG_NS, ["svg", "circle"]), _TAG_NAMES);
	var tag = {};

	var _loop = function _loop() {
	  var _Object$entries2$_i = _slicedToArray(_Object$entries2[_i2], 2),
	      ns = _Object$entries2$_i[0],
	      tags = _Object$entries2$_i[1];

	  var _iterator2 = _createForOfIteratorHelper(tags),
	      _step2;

	  try {
	    var _loop2 = function _loop2() {
	      var tagName = _step2.value;

	      tag[tagName] = function (attributes, children) {
	        return elNS(ns, tagName, attributes, children);
	      };
	    };

	    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	      _loop2();
	    }
	  } catch (err) {
	    _iterator2.e(err);
	  } finally {
	    _iterator2.f();
	  }
	};

	for (var _i2 = 0, _Object$entries2 = Object.entries(TAG_NAMES); _i2 < _Object$entries2.length; _i2++) {
	  _loop();
	}

	function insertAt(parentNode, idx, childNode) {
	  var isLast = idx === parentNode.childElementCount;

	  if (isLast) {
	    parentNode.appendChild(childNode);
	  } else {
	    var nextDomNode = parentNode.children[idx];
	    parentNode.insertBefore(childNode, nextDomNode);
	  }
	}

	var ListView = /*#__PURE__*/function () {
	  function ListView(_ref, childCreator) {
	    var list = _ref.list,
	        onItemClick = _ref.onItemClick,
	        className = _ref.className,
	        _ref$parentProvidesUp = _ref.parentProvidesUpdates,
	        parentProvidesUpdates = _ref$parentProvidesUp === void 0 ? true : _ref$parentProvidesUp;

	    _classCallCheck(this, ListView);

	    this._onItemClick = onItemClick;
	    this._list = list;
	    this._className = className;
	    this._root = null;
	    this._subscription = null;
	    this._childCreator = childCreator;
	    this._childInstances = null;
	    this._mountArgs = {
	      parentProvidesUpdates: parentProvidesUpdates
	    };
	    this._onClick = this._onClick.bind(this);
	  }

	  _createClass(ListView, [{
	    key: "root",
	    value: function root() {
	      return this._root;
	    }
	  }, {
	    key: "update",
	    value: function update(attributes) {
	      if (attributes.hasOwnProperty("list")) {
	        if (this._subscription) {
	          this._unloadList();

	          while (this._root.lastChild) {
	            this._root.lastChild.remove();
	          }
	        }

	        this._list = attributes.list;
	        this.loadList();
	      }
	    }
	  }, {
	    key: "mount",
	    value: function mount() {
	      var attr = {};

	      if (this._className) {
	        attr.className = this._className;
	      }

	      this._root = tag.ul(attr);
	      this.loadList();

	      if (this._onItemClick) {
	        this._root.addEventListener("click", this._onClick);
	      }

	      return this._root;
	    }
	  }, {
	    key: "unmount",
	    value: function unmount() {
	      if (this._list) {
	        this._unloadList();
	      }
	    }
	  }, {
	    key: "_onClick",
	    value: function _onClick(event) {
	      if (event.target === this._root) {
	        return;
	      }

	      var childNode = event.target;

	      while (childNode.parentNode !== this._root) {
	        childNode = childNode.parentNode;
	      }

	      var index = Array.prototype.indexOf.call(this._root.childNodes, childNode);
	      var childView = this._childInstances[index];

	      this._onItemClick(childView, event);
	    }
	  }, {
	    key: "_unloadList",
	    value: function _unloadList() {
	      this._subscription = this._subscription();

	      var _iterator = _createForOfIteratorHelper(this._childInstances),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var child = _step.value;
	          child.unmount();
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }

	      this._childInstances = null;
	    }
	  }, {
	    key: "loadList",
	    value: function loadList() {
	      if (!this._list) {
	        return;
	      }

	      this._subscription = this._list.subscribe(this);
	      this._childInstances = [];

	      var _iterator2 = _createForOfIteratorHelper(this._list),
	          _step2;

	      try {
	        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	          var item = _step2.value;

	          var child = this._childCreator(item);

	          this._childInstances.push(child);

	          var childDomNode = child.mount(this._mountArgs);

	          this._root.appendChild(childDomNode);
	        }
	      } catch (err) {
	        _iterator2.e(err);
	      } finally {
	        _iterator2.f();
	      }
	    }
	  }, {
	    key: "onAdd",
	    value: function onAdd(idx, value) {
	      this.onBeforeListChanged();

	      var child = this._childCreator(value);

	      this._childInstances.splice(idx, 0, child);

	      insertAt(this._root, idx, child.mount(this._mountArgs));
	      this.onListChanged();
	    }
	  }, {
	    key: "onRemove",
	    value: function onRemove(idx, _value) {
	      this.onBeforeListChanged();

	      var _this$_childInstances = this._childInstances.splice(idx, 1),
	          _this$_childInstances2 = _slicedToArray(_this$_childInstances, 1),
	          child = _this$_childInstances2[0];

	      child.root().remove();
	      child.unmount();
	      this.onListChanged();
	    }
	  }, {
	    key: "onMove",
	    value: function onMove(fromIdx, toIdx, value) {
	      this.onBeforeListChanged();

	      var _this$_childInstances3 = this._childInstances.splice(fromIdx, 1),
	          _this$_childInstances4 = _slicedToArray(_this$_childInstances3, 1),
	          child = _this$_childInstances4[0];

	      this._childInstances.splice(toIdx, 0, child);

	      child.root().remove();
	      insertAt(this._root, toIdx, child.root());
	      this.onListChanged();
	    }
	  }, {
	    key: "onUpdate",
	    value: function onUpdate(i, value, params) {
	      if (this._childInstances) {
	        var instance = this._childInstances[i];
	        instance && instance.update(value, params);
	      }
	    }
	  }, {
	    key: "onBeforeListChanged",
	    value: function onBeforeListChanged() {}
	  }, {
	    key: "onListChanged",
	    value: function onListChanged() {}
	  }]);

	  return ListView;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	function errorToDOM(error) {
	  var stack = new Error().stack;
	  var callee = stack.split("\n")[1];
	  return tag.div([tag.h2("Something went wrong…"), tag.h3(error.message), tag.p("This occurred while running ".concat(callee, ".")), tag.pre(error.stack)]);
	}

	function objHasFns(obj) {
	  for (var _i = 0, _Object$values = Object.values(obj); _i < _Object$values.length; _i++) {
	    var value = _Object$values[_i];

	    if (typeof value === "function") {
	      return true;
	    }
	  }

	  return false;
	}
	/**
	    Bindable template. Renders once, and allows bindings for given nodes. If you need
	    to change the structure on a condition, use a subtemplate (if)

	    supports
	        - event handlers (attribute fn value with name that starts with on)
	        - one way binding of attributes (other attribute fn value)
	        - one way binding of text values (child fn value)
	        - refs to get dom nodes
	        - className binding returning object with className => enabled map
	        - add subviews inside the template
	*/


	var TemplateView = /*#__PURE__*/function () {
	  function TemplateView(value) {
	    var render = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

	    _classCallCheck(this, TemplateView);

	    this._value = value;
	    this._render = render;
	    this._eventListeners = null;
	    this._bindings = null; // this should become _subViews and also include templates.
	    // How do we know which ones we should update though?
	    // Wrapper class?

	    this._subViews = null;
	    this._root = null;
	    this._boundUpdateFromValue = null;
	  }

	  _createClass(TemplateView, [{
	    key: "_subscribe",
	    value: function _subscribe() {
	      if (typeof this._value.on === "function") {
	        this._boundUpdateFromValue = this._updateFromValue.bind(this);

	        this._value.on("change", this._boundUpdateFromValue);
	      }
	    }
	  }, {
	    key: "_unsubscribe",
	    value: function _unsubscribe() {
	      if (this._boundUpdateFromValue) {
	        if (typeof this._value.off === "function") {
	          this._value.off("change", this._boundUpdateFromValue);
	        }

	        this._boundUpdateFromValue = null;
	      }
	    }
	  }, {
	    key: "_attach",
	    value: function _attach() {
	      if (this._eventListeners) {
	        var _iterator = _createForOfIteratorHelper(this._eventListeners),
	            _step;

	        try {
	          for (_iterator.s(); !(_step = _iterator.n()).done;) {
	            var _step$value = _step.value,
	                node = _step$value.node,
	                name = _step$value.name,
	                fn = _step$value.fn;
	            node.addEventListener(name, fn);
	          }
	        } catch (err) {
	          _iterator.e(err);
	        } finally {
	          _iterator.f();
	        }
	      }
	    }
	  }, {
	    key: "_detach",
	    value: function _detach() {
	      if (this._eventListeners) {
	        var _iterator2 = _createForOfIteratorHelper(this._eventListeners),
	            _step2;

	        try {
	          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	            var _step2$value = _step2.value,
	                node = _step2$value.node,
	                name = _step2$value.name,
	                fn = _step2$value.fn;
	            node.removeEventListener(name, fn);
	          }
	        } catch (err) {
	          _iterator2.e(err);
	        } finally {
	          _iterator2.f();
	        }
	      }
	    }
	  }, {
	    key: "mount",
	    value: function mount(options) {
	      var builder = new TemplateBuilder(this);

	      if (this._render) {
	        this._root = this._render(builder, this._value);
	      } else if (this.render) {
	        // overriden in subclass
	        this._root = this.render(builder, this._value);
	      } else {
	        throw new Error("no render function passed in, or overriden in subclass");
	      }

	      var parentProvidesUpdates = options && options.parentProvidesUpdates;

	      if (!parentProvidesUpdates) {
	        this._subscribe();
	      }

	      this._attach();

	      return this._root;
	    }
	  }, {
	    key: "unmount",
	    value: function unmount() {
	      this._detach();

	      this._unsubscribe();

	      if (this._subViews) {
	        var _iterator3 = _createForOfIteratorHelper(this._subViews),
	            _step3;

	        try {
	          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	            var v = _step3.value;
	            v.unmount();
	          }
	        } catch (err) {
	          _iterator3.e(err);
	        } finally {
	          _iterator3.f();
	        }
	      }
	    }
	  }, {
	    key: "root",
	    value: function root() {
	      return this._root;
	    }
	  }, {
	    key: "_updateFromValue",
	    value: function _updateFromValue(changedProps) {
	      this.update(this._value, changedProps);
	    }
	  }, {
	    key: "update",
	    value: function update(value) {
	      this._value = value;

	      if (this._bindings) {
	        var _iterator4 = _createForOfIteratorHelper(this._bindings),
	            _step4;

	        try {
	          for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
	            var binding = _step4.value;
	            binding();
	          }
	        } catch (err) {
	          _iterator4.e(err);
	        } finally {
	          _iterator4.f();
	        }
	      }
	    }
	  }, {
	    key: "_addEventListener",
	    value: function _addEventListener(node, name, fn) {
	      if (!this._eventListeners) {
	        this._eventListeners = [];
	      }

	      this._eventListeners.push({
	        node: node,
	        name: name,
	        fn: fn
	      });
	    }
	  }, {
	    key: "_addBinding",
	    value: function _addBinding(bindingFn) {
	      if (!this._bindings) {
	        this._bindings = [];
	      }

	      this._bindings.push(bindingFn);
	    }
	  }, {
	    key: "_addSubView",
	    value: function _addSubView(view) {
	      if (!this._subViews) {
	        this._subViews = [];
	      }

	      this._subViews.push(view);
	    }
	  }, {
	    key: "value",
	    get: function get() {
	      return this._value;
	    }
	  }]);

	  return TemplateView;
	}(); // what is passed to render

	var TemplateBuilder = /*#__PURE__*/function () {
	  function TemplateBuilder(templateView) {
	    _classCallCheck(this, TemplateBuilder);

	    this._templateView = templateView;
	  }

	  _createClass(TemplateBuilder, [{
	    key: "_addAttributeBinding",
	    value: function _addAttributeBinding(node, name, fn) {
	      var _this = this;

	      var prevValue = undefined;

	      var binding = function binding() {
	        var newValue = fn(_this._value);

	        if (prevValue !== newValue) {
	          prevValue = newValue;
	          setAttribute(node, name, newValue);
	        }
	      };

	      this._templateView._addBinding(binding);

	      binding();
	    }
	  }, {
	    key: "_addClassNamesBinding",
	    value: function _addClassNamesBinding(node, obj) {
	      this._addAttributeBinding(node, "className", function (value) {
	        return classNames(obj, value);
	      });
	    }
	  }, {
	    key: "_addTextBinding",
	    value: function _addTextBinding(fn) {
	      var _this2 = this;

	      var initialValue = fn(this._value);
	      var node = text(initialValue);
	      var prevValue = initialValue;

	      var binding = function binding() {
	        var newValue = fn(_this2._value);

	        if (prevValue !== newValue) {
	          prevValue = newValue;
	          node.textContent = newValue + "";
	        }
	      };

	      this._templateView._addBinding(binding);

	      return node;
	    }
	  }, {
	    key: "_setNodeAttributes",
	    value: function _setNodeAttributes(node, attributes) {
	      for (var _i2 = 0, _Object$entries = Object.entries(attributes); _i2 < _Object$entries.length; _i2++) {
	        var _Object$entries$_i = _slicedToArray(_Object$entries[_i2], 2),
	            key = _Object$entries$_i[0],
	            value = _Object$entries$_i[1];

	        var isFn = typeof value === "function"; // binding for className as object of className => enabled

	        if (key === "className" && _typeof(value) === "object" && value !== null) {
	          if (objHasFns(value)) {
	            this._addClassNamesBinding(node, value);
	          } else {
	            setAttribute(node, key, classNames(value));
	          }
	        } else if (key.startsWith("on") && key.length > 2 && isFn) {
	          var eventName = key.substr(2, 1).toLowerCase() + key.substr(3);
	          var handler = value;

	          this._templateView._addEventListener(node, eventName, handler);
	        } else if (isFn) {
	          this._addAttributeBinding(node, key, value);
	        } else {
	          setAttribute(node, key, value);
	        }
	      }
	    }
	  }, {
	    key: "_setNodeChildren",
	    value: function _setNodeChildren(node, children) {
	      if (!Array.isArray(children)) {
	        children = [children];
	      }

	      var _iterator5 = _createForOfIteratorHelper(children),
	          _step5;

	      try {
	        for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
	          var child = _step5.value;

	          if (typeof child === "function") {
	            child = this._addTextBinding(child);
	          } else if (!child.nodeType) {
	            // not a DOM node, turn into text
	            child = text(child);
	          }

	          node.appendChild(child);
	        }
	      } catch (err) {
	        _iterator5.e(err);
	      } finally {
	        _iterator5.f();
	      }
	    }
	  }, {
	    key: "_addReplaceNodeBinding",
	    value: function _addReplaceNodeBinding(fn, renderNode) {
	      var _this3 = this;

	      var prevValue = fn(this._value);
	      var node = renderNode(null);

	      var binding = function binding() {
	        var newValue = fn(_this3._value);

	        if (prevValue !== newValue) {
	          prevValue = newValue;
	          var newNode = renderNode(node);

	          if (node.parentNode) {
	            node.parentNode.replaceChild(newNode, node);
	          }

	          node = newNode;
	        }
	      };

	      this._templateView._addBinding(binding);

	      return node;
	    }
	  }, {
	    key: "el",
	    value: function el(name, attributes, children) {
	      return this.elNS(HTML_NS, name, attributes, children);
	    }
	  }, {
	    key: "elNS",
	    value: function elNS(ns, name, attributes, children) {
	      if (attributes && isChildren(attributes)) {
	        children = attributes;
	        attributes = null;
	      }

	      var node = document.createElementNS(ns, name);

	      if (attributes) {
	        this._setNodeAttributes(node, attributes);
	      }

	      if (children) {
	        this._setNodeChildren(node, children);
	      }

	      return node;
	    } // this insert a view, and is not a view factory for `if`, so returns the root element to insert in the template
	    // you should not call t.view() and not use the result (e.g. attach the result to the template DOM tree).

	  }, {
	    key: "view",
	    value: function view(_view) {
	      var root;

	      try {
	        root = _view.mount();
	      } catch (err) {
	        return errorToDOM(err);
	      }

	      this._templateView._addSubView(_view);

	      return root;
	    } // sugar

	  }, {
	    key: "createTemplate",
	    value: function createTemplate(render) {
	      return function (vm) {
	        return new TemplateView(vm, render);
	      };
	    } // map a value to a view, every time the value changes

	  }, {
	    key: "mapView",
	    value: function mapView(mapFn, viewCreator) {
	      var _this4 = this;

	      return this._addReplaceNodeBinding(mapFn, function (prevNode) {
	        if (prevNode && prevNode.nodeType !== Node.COMMENT_NODE) {
	          var subViews = _this4._templateView._subViews;
	          var viewIdx = subViews.findIndex(function (v) {
	            return v.root() === prevNode;
	          });

	          if (viewIdx !== -1) {
	            var _subViews$splice = subViews.splice(viewIdx, 1),
	                _subViews$splice2 = _slicedToArray(_subViews$splice, 1),
	                _view2 = _subViews$splice2[0];

	            _view2.unmount();
	          }
	        }

	        var view = viewCreator(mapFn(_this4._value));

	        if (view) {
	          return _this4.view(view);
	        } else {
	          return document.createComment("node binding placeholder");
	        }
	      });
	    } // creates a conditional subtemplate

	  }, {
	    key: "if",
	    value: function _if(fn, viewCreator) {
	      var _this5 = this;

	      return this.mapView(function (value) {
	        return !!fn(value);
	      }, function (enabled) {
	        return enabled ? viewCreator(_this5._value) : null;
	      });
	    }
	  }, {
	    key: "_value",
	    get: function get() {
	      return this._templateView._value;
	    }
	  }]);

	  return TemplateBuilder;
	}();

	var _loop$1 = function _loop() {
	  var _Object$entries2$_i = _slicedToArray(_Object$entries2$1[_i3], 2),
	      ns = _Object$entries2$_i[0],
	      tags = _Object$entries2$_i[1];

	  var _iterator6 = _createForOfIteratorHelper(tags),
	      _step6;

	  try {
	    var _loop2 = function _loop2() {
	      var tag = _step6.value;

	      TemplateBuilder.prototype[tag] = function (attributes, children) {
	        return this.elNS(ns, tag, attributes, children);
	      };
	    };

	    for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
	      _loop2();
	    }
	  } catch (err) {
	    _iterator6.e(err);
	  } finally {
	    _iterator6.f();
	  }
	};

	for (var _i3 = 0, _Object$entries2$1 = Object.entries(TAG_NAMES); _i3 < _Object$entries2$1.length; _i3++) {
	  _loop$1();
	}

	var RoomTile = /*#__PURE__*/function (_TemplateView) {
	  _inherits(RoomTile, _TemplateView);

	  var _super = _createSuper(RoomTile);

	  function RoomTile() {
	    _classCallCheck(this, RoomTile);

	    return _super.apply(this, arguments);
	  }

	  _createClass(RoomTile, [{
	    key: "render",
	    value: function render(t, vm) {
	      return t.li({
	        "className": {
	          "active": function active(vm) {
	            return vm.isOpen;
	          }
	        }
	      }, [t.div({
	        className: "avatar medium usercolor".concat(vm.avatarColorNumber)
	      }, function (vm) {
	        return vm.avatarInitials;
	      }), t.div({
	        className: "description"
	      }, t.div({
	        className: "name"
	      }, function (vm) {
	        return vm.name;
	      }))]);
	    } // called from ListView

	  }, {
	    key: "clicked",
	    value: function clicked() {
	      this.value.open();
	    }
	  }]);

	  return RoomTile;
	}(TemplateView);

	var GapView = /*#__PURE__*/function (_TemplateView) {
	  _inherits(GapView, _TemplateView);

	  var _super = _createSuper(GapView);

	  function GapView() {
	    _classCallCheck(this, GapView);

	    return _super.apply(this, arguments);
	  }

	  _createClass(GapView, [{
	    key: "render",
	    value: function render(t, vm) {
	      var className = {
	        GapView: true,
	        isLoading: function isLoading(vm) {
	          return vm.isLoading;
	        }
	      };
	      var label = (vm.isUp ? "🠝" : "🠟") + " fill gap"; //no binding

	      return t.li({
	        className: className
	      }, [t.button({
	        onClick: function onClick() {
	          return vm.fill();
	        },
	        disabled: function disabled(vm) {
	          return vm.isLoading;
	        }
	      }, label), t.if(function (vm) {
	        return vm.error;
	      }, t.createTemplate(function (t) {
	        return t.strong(function (vm) {
	          return vm.error;
	        });
	      }))]);
	    }
	  }]);

	  return GapView;
	}(TemplateView);

	function renderMessage(t, vm, children) {
	  var classes = {
	    "TextMessageView": true,
	    own: vm.isOwn,
	    pending: vm.isPending,
	    continuation: vm.isContinuation
	  };
	  var sender = t.div({
	    className: "sender usercolor".concat(vm.senderColorNumber)
	  }, function (vm) {
	    return vm.isContinuation ? "" : vm.sender;
	  });
	  children = [sender].concat(children);
	  return t.li({
	    className: classes
	  }, t.div({
	    className: "message-container"
	  }, children));
	}

	var TextMessageView = /*#__PURE__*/function (_TemplateView) {
	  _inherits(TextMessageView, _TemplateView);

	  var _super = _createSuper(TextMessageView);

	  function TextMessageView() {
	    _classCallCheck(this, TextMessageView);

	    return _super.apply(this, arguments);
	  }

	  _createClass(TextMessageView, [{
	    key: "render",
	    value: function render(t, vm) {
	      return renderMessage(t, vm, [t.p([vm.text, t.time(vm.date + " " + vm.time)])]);
	    }
	  }]);

	  return TextMessageView;
	}(TemplateView);

	var ImageView = /*#__PURE__*/function (_TemplateView) {
	  _inherits(ImageView, _TemplateView);

	  var _super = _createSuper(ImageView);

	  function ImageView() {
	    _classCallCheck(this, ImageView);

	    return _super.apply(this, arguments);
	  }

	  _createClass(ImageView, [{
	    key: "render",
	    value: function render(t, vm) {
	      // replace with css aspect-ratio once supported
	      var heightRatioPercent = vm.thumbnailHeight / vm.thumbnailWidth * 100;
	      var image = t.img({
	        src: vm.thumbnailUrl,
	        width: vm.thumbnailWidth,
	        height: vm.thumbnailHeight,
	        loading: "lazy",
	        alt: vm.label
	      });
	      var linkContainer = t.a({
	        href: vm.url,
	        target: "_blank",
	        style: "padding-top: ".concat(heightRatioPercent, "%; width: ").concat(vm.thumbnailWidth, "px;")
	      }, image);
	      return renderMessage(t, vm, [t.div(linkContainer), t.p(t.time(vm.date + " " + vm.time))]);
	    }
	  }]);

	  return ImageView;
	}(TemplateView);

	var AnnouncementView = /*#__PURE__*/function (_TemplateView) {
	  _inherits(AnnouncementView, _TemplateView);

	  var _super = _createSuper(AnnouncementView);

	  function AnnouncementView() {
	    _classCallCheck(this, AnnouncementView);

	    return _super.apply(this, arguments);
	  }

	  _createClass(AnnouncementView, [{
	    key: "render",
	    value: function render(t) {
	      return t.li({
	        className: "AnnouncementView"
	      }, t.div(function (vm) {
	        return vm.announcement;
	      }));
	    }
	  }]);

	  return AnnouncementView;
	}(TemplateView);

	var TimelineList = /*#__PURE__*/function (_ListView) {
	  _inherits(TimelineList, _ListView);

	  var _super = _createSuper(TimelineList);

	  function TimelineList() {
	    var _this;

	    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

	    _classCallCheck(this, TimelineList);

	    options.className = "Timeline";
	    _this = _super.call(this, options, function (entry) {
	      switch (entry.shape) {
	        case "gap":
	          return new GapView(entry);

	        case "announcement":
	          return new AnnouncementView(entry);

	        case "message":
	          return new TextMessageView(entry);

	        case "image":
	          return new ImageView(entry);
	      }
	    });
	    _this._atBottom = false;
	    _this._onScroll = _this._onScroll.bind(_assertThisInitialized(_this));
	    _this._topLoadingPromise = null;
	    _this._viewModel = null;
	    return _this;
	  }

	  _createClass(TimelineList, [{
	    key: "_onScroll",
	    value: function () {
	      var _onScroll2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        var root, beforeFromBottom, fromBottom, amountGrown;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                root = this.root();

	                if (!(root.scrollTop === 0 && !this._topLoadingPromise && this._viewModel)) {
	                  _context.next = 10;
	                  break;
	                }

	                beforeFromBottom = this._distanceFromBottom();
	                this._topLoadingPromise = this._viewModel.loadAtTop();
	                _context.next = 6;
	                return this._topLoadingPromise;

	              case 6:
	                fromBottom = this._distanceFromBottom();
	                amountGrown = fromBottom - beforeFromBottom;
	                root.scrollTop = root.scrollTop + amountGrown;
	                this._topLoadingPromise = null;

	              case 10:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, _callee, this);
	      }));

	      function _onScroll() {
	        return _onScroll2.apply(this, arguments);
	      }

	      return _onScroll;
	    }()
	  }, {
	    key: "update",
	    value: function update(attributes) {
	      if (attributes.viewModel) {
	        this._viewModel = attributes.viewModel;
	        attributes.list = attributes.viewModel.tiles;
	      }

	      _get(_getPrototypeOf(TimelineList.prototype), "update", this).call(this, attributes);
	    }
	  }, {
	    key: "mount",
	    value: function mount() {
	      var root = _get(_getPrototypeOf(TimelineList.prototype), "mount", this).call(this);

	      root.addEventListener("scroll", this._onScroll);
	      return root;
	    }
	  }, {
	    key: "unmount",
	    value: function unmount() {
	      this.root().removeEventListener("scroll", this._onScroll);

	      _get(_getPrototypeOf(TimelineList.prototype), "unmount", this).call(this);
	    }
	  }, {
	    key: "loadList",
	    value: function loadList() {
	      _get(_getPrototypeOf(TimelineList.prototype), "loadList", this).call(this);

	      var root = this.root();
	      root.scrollTop = root.scrollHeight;
	    }
	  }, {
	    key: "onBeforeListChanged",
	    value: function onBeforeListChanged() {
	      var fromBottom = this._distanceFromBottom();

	      this._atBottom = fromBottom < 1;
	    }
	  }, {
	    key: "_distanceFromBottom",
	    value: function _distanceFromBottom() {
	      var root = this.root();
	      return root.scrollHeight - root.scrollTop - root.clientHeight;
	    }
	  }, {
	    key: "onListChanged",
	    value: function onListChanged() {
	      if (this._atBottom) {
	        var root = this.root();
	        root.scrollTop = root.scrollHeight;
	      }
	    }
	  }]);

	  return TimelineList;
	}(ListView);

	function _templateObject2$1() {
	  var data = _taggedTemplateLiteral(["Send"]);

	  _templateObject2$1 = function _templateObject2() {
	    return data;
	  };

	  return data;
	}

	function _templateObject$1() {
	  var data = _taggedTemplateLiteral(["Send"]);

	  _templateObject$1 = function _templateObject() {
	    return data;
	  };

	  return data;
	}
	var MessageComposer = /*#__PURE__*/function (_TemplateView) {
	  _inherits(MessageComposer, _TemplateView);

	  var _super = _createSuper(MessageComposer);

	  function MessageComposer(viewModel) {
	    var _this;

	    _classCallCheck(this, MessageComposer);

	    _this = _super.call(this, viewModel);
	    _this._input = null;
	    return _this;
	  }

	  _createClass(MessageComposer, [{
	    key: "render",
	    value: function render(t, vm) {
	      var _this2 = this;

	      this._input = t.input({
	        placeholder: "Send a message ...",
	        onKeydown: function onKeydown(e) {
	          return _this2._onKeyDown(e);
	        },
	        onInput: function onInput() {
	          return vm.setInput(_this2._input.value);
	        }
	      });
	      return t.div({
	        className: "MessageComposer"
	      }, [this._input, t.button({
	        className: "send",
	        title: vm.i18n(_templateObject$1()),
	        disabled: function disabled(vm) {
	          return !vm.canSend;
	        },
	        onClick: function onClick() {
	          return _this2._trySend();
	        }
	      }, vm.i18n(_templateObject2$1()))]);
	    }
	  }, {
	    key: "_trySend",
	    value: function _trySend() {
	      if (this.value.sendMessage(this._input.value)) {
	        this._input.value = "";
	      }
	    }
	  }, {
	    key: "_onKeyDown",
	    value: function _onKeyDown(event) {
	      if (event.key === "Enter") {
	        this._trySend();
	      }
	    }
	  }]);

	  return MessageComposer;
	}(TemplateView);

	var RoomView = /*#__PURE__*/function (_TemplateView) {
	  _inherits(RoomView, _TemplateView);

	  var _super = _createSuper(RoomView);

	  function RoomView(viewModel) {
	    var _this;

	    _classCallCheck(this, RoomView);

	    _this = _super.call(this, viewModel);
	    _this._timelineList = null;
	    return _this;
	  }

	  _createClass(RoomView, [{
	    key: "render",
	    value: function render(t, vm) {
	      this._timelineList = new TimelineList();
	      return t.div({
	        className: "RoomView"
	      }, [t.div({
	        className: "TimelinePanel"
	      }, [t.div({
	        className: "RoomHeader"
	      }, [t.button({
	        className: "back",
	        onClick: function onClick() {
	          return vm.close();
	        }
	      }), t.div({
	        className: "avatar large usercolor".concat(vm.avatarColorNumber)
	      }, function (vm) {
	        return vm.avatarInitials;
	      }), t.div({
	        className: "room-description"
	      }, [t.h2(function (vm) {
	        return vm.name;
	      })])]), t.div({
	        className: "RoomView_error"
	      }, function (vm) {
	        return vm.error;
	      }), t.view(this._timelineList), t.view(new MessageComposer(this.value.composerViewModel))])]);
	    }
	  }, {
	    key: "update",
	    value: function update(value, prop) {
	      _get(_getPrototypeOf(RoomView.prototype), "update", this).call(this, value, prop);

	      if (prop === "timelineViewModel") {
	        this._timelineList.update({
	          viewModel: this.value.timelineViewModel
	        });
	      }
	    }
	  }]);

	  return RoomView;
	}(TemplateView);

	var SwitchView = /*#__PURE__*/function () {
	  function SwitchView(defaultView) {
	    _classCallCheck(this, SwitchView);

	    this._childView = defaultView;
	  }

	  _createClass(SwitchView, [{
	    key: "mount",
	    value: function mount() {
	      return this._childView.mount();
	    }
	  }, {
	    key: "unmount",
	    value: function unmount() {
	      return this._childView.unmount();
	    }
	  }, {
	    key: "root",
	    value: function root() {
	      return this._childView.root();
	    }
	  }, {
	    key: "update",
	    value: function update() {
	      return this._childView.update();
	    }
	  }, {
	    key: "switch",
	    value: function _switch(newView) {
	      var oldRoot = this.root();

	      this._childView.unmount();

	      this._childView = newView;
	      var newRoot;

	      try {
	        newRoot = this._childView.mount();
	      } catch (err) {
	        newRoot = errorToDOM(err);
	      }

	      var parent = oldRoot.parentNode;

	      if (parent) {
	        parent.replaceChild(newRoot, oldRoot);
	      }
	    }
	  }, {
	    key: "childView",
	    get: function get() {
	      return this._childView;
	    }
	  }]);

	  return SwitchView;
	}();

	var RoomPlaceholderView = /*#__PURE__*/function () {
	  function RoomPlaceholderView() {
	    _classCallCheck(this, RoomPlaceholderView);

	    this._root = null;
	  }

	  _createClass(RoomPlaceholderView, [{
	    key: "mount",
	    value: function mount() {
	      this._root = tag.div({
	        className: "RoomPlaceholderView"
	      }, tag.h2("Choose a room on the left side."));
	      return this._root;
	    }
	  }, {
	    key: "root",
	    value: function root() {
	      return this._root;
	    }
	  }, {
	    key: "unmount",
	    value: function unmount() {}
	  }, {
	    key: "update",
	    value: function update() {}
	  }]);

	  return RoomPlaceholderView;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	function spinner(t) {
	  var extraClasses = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;
	  return t.svg({
	    className: Object.assign({
	      "spinner": true
	    }, extraClasses),
	    viewBox: "0 0 100 100"
	  }, t.circle({
	    cx: "50%",
	    cy: "50%",
	    r: "45%",
	    pathLength: "100"
	  }));
	}

	var SessionStatusView = /*#__PURE__*/function (_TemplateView) {
	  _inherits(SessionStatusView, _TemplateView);

	  var _super = _createSuper(SessionStatusView);

	  function SessionStatusView() {
	    _classCallCheck(this, SessionStatusView);

	    return _super.apply(this, arguments);
	  }

	  _createClass(SessionStatusView, [{
	    key: "render",
	    value: function render(t, vm) {
	      return t.div({
	        className: {
	          "SessionStatusView": true,
	          "hidden": function hidden(vm) {
	            return !vm.isShown;
	          }
	        }
	      }, [spinner(t, {
	        hidden: function hidden(vm) {
	          return !vm.isWaiting;
	        }
	      }), t.p(function (vm) {
	        return vm.statusLabel;
	      }), t.if(function (vm) {
	        return vm.isConnectNowShown;
	      }, t.createTemplate(function (t) {
	        return t.button({
	          onClick: function onClick() {
	            return vm.connectNow();
	          }
	        }, "Retry now");
	      })), window.DEBUG ? t.button({
	        id: "showlogs"
	      }, "Show logs") : ""]);
	    }
	  }]);

	  return SessionStatusView;
	}(TemplateView);

	var SessionView = /*#__PURE__*/function () {
	  function SessionView(viewModel) {
	    _classCallCheck(this, SessionView);

	    this._viewModel = viewModel;
	    this._middleSwitcher = null;
	    this._roomList = null;
	    this._currentRoom = null;
	    this._root = null;
	    this._onViewModelChange = this._onViewModelChange.bind(this);
	  }

	  _createClass(SessionView, [{
	    key: "root",
	    value: function root() {
	      return this._root;
	    }
	  }, {
	    key: "mount",
	    value: function mount() {
	      this._viewModel.on("change", this._onViewModelChange);

	      this._sessionStatusBar = new SessionStatusView(this._viewModel.sessionStatusViewModel);
	      this._roomList = new ListView({
	        className: "RoomList",
	        list: this._viewModel.roomList,
	        onItemClick: function onItemClick(roomTile, event) {
	          return roomTile.clicked(event);
	        }
	      }, function (room) {
	        return new RoomTile(room);
	      });
	      this._middleSwitcher = new SwitchView(new RoomPlaceholderView());
	      this._root = tag.div({
	        className: "SessionView"
	      }, [this._sessionStatusBar.mount(), tag.div({
	        className: "main"
	      }, [tag.div({
	        className: "LeftPanel"
	      }, this._roomList.mount()), this._middleSwitcher.mount()])]);
	      return this._root;
	    }
	  }, {
	    key: "unmount",
	    value: function unmount() {
	      this._roomList.unmount();

	      this._middleSwitcher.unmount();

	      this._viewModel.off("change", this._onViewModelChange);
	    }
	  }, {
	    key: "_onViewModelChange",
	    value: function _onViewModelChange(prop) {
	      if (prop === "currentRoom") {
	        if (this._viewModel.currentRoom) {
	          this._root.classList.add("room-shown");

	          this._middleSwitcher.switch(new RoomView(this._viewModel.currentRoom));
	        } else {
	          this._root.classList.remove("room-shown");

	          this._middleSwitcher.switch(new RoomPlaceholderView());
	        }
	      }
	    } // changing viewModel not supported for now

	  }, {
	    key: "update",
	    value: function update() {}
	  }]);

	  return SessionView;
	}();

	/*
	Copyright 2020 Bruno Windels <bruno@windels.cloud>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
	*/
	function hydrogenGithubLink(t) {
	  if (window.HYDROGEN_VERSION) {
	    return t.a({
	      target: "_blank",
	      href: "https://github.com/vector-im/hydrogen-web/releases/tag/v".concat(window.HYDROGEN_VERSION)
	    }, "Hydrogen v".concat(window.HYDROGEN_VERSION, " on Github"));
	  } else {
	    return t.a({
	      target: "_blank",
	      href: "https://github.com/vector-im/hydrogen-web"
	    }, "Hydrogen on Github");
	  }
	}

	var SessionLoadView = /*#__PURE__*/function (_TemplateView) {
	  _inherits(SessionLoadView, _TemplateView);

	  var _super = _createSuper(SessionLoadView);

	  function SessionLoadView() {
	    _classCallCheck(this, SessionLoadView);

	    return _super.apply(this, arguments);
	  }

	  _createClass(SessionLoadView, [{
	    key: "render",
	    value: function render(t) {
	      return t.div({
	        className: "SessionLoadView"
	      }, [spinner(t, {
	        hiddenWithLayout: function hiddenWithLayout(vm) {
	          return !vm.loading;
	        }
	      }), t.p(function (vm) {
	        return vm.loadLabel;
	      })]);
	    }
	  }]);

	  return SessionLoadView;
	}(TemplateView);

	function _templateObject9() {
	  var data = _taggedTemplateLiteral(["Log In"]);

	  _templateObject9 = function _templateObject9() {
	    return data;
	  };

	  return data;
	}

	function _templateObject8() {
	  var data = _taggedTemplateLiteral(["Go Back"]);

	  _templateObject8 = function _templateObject8() {
	    return data;
	  };

	  return data;
	}

	function _templateObject7() {
	  var data = _taggedTemplateLiteral(["Homeserver"]);

	  _templateObject7 = function _templateObject7() {
	    return data;
	  };

	  return data;
	}

	function _templateObject6() {
	  var data = _taggedTemplateLiteral(["Password"]);

	  _templateObject6 = function _templateObject6() {
	    return data;
	  };

	  return data;
	}

	function _templateObject5() {
	  var data = _taggedTemplateLiteral(["Username"]);

	  _templateObject5 = function _templateObject5() {
	    return data;
	  };

	  return data;
	}

	function _templateObject4$1() {
	  var data = _taggedTemplateLiteral(["Sign In"]);

	  _templateObject4$1 = function _templateObject4() {
	    return data;
	  };

	  return data;
	}

	function _templateObject3$1() {
	  var data = _taggedTemplateLiteral(["Your matrix homeserver"]);

	  _templateObject3$1 = function _templateObject3() {
	    return data;
	  };

	  return data;
	}

	function _templateObject2$2() {
	  var data = _taggedTemplateLiteral(["Password"]);

	  _templateObject2$2 = function _templateObject2() {
	    return data;
	  };

	  return data;
	}

	function _templateObject$2() {
	  var data = _taggedTemplateLiteral(["Username"]);

	  _templateObject$2 = function _templateObject() {
	    return data;
	  };

	  return data;
	}
	var LoginView = /*#__PURE__*/function (_TemplateView) {
	  _inherits(LoginView, _TemplateView);

	  var _super = _createSuper(LoginView);

	  function LoginView() {
	    _classCallCheck(this, LoginView);

	    return _super.apply(this, arguments);
	  }

	  _createClass(LoginView, [{
	    key: "render",
	    value: function render(t, vm) {
	      var disabled = function disabled(vm) {
	        return !!vm.isBusy;
	      };

	      var username = t.input({
	        id: "username",
	        type: "text",
	        placeholder: vm.i18n(_templateObject$2()),
	        disabled: disabled
	      });
	      var password = t.input({
	        id: "password",
	        type: "password",
	        placeholder: vm.i18n(_templateObject2$2()),
	        disabled: disabled
	      });
	      var homeserver = t.input({
	        id: "homeserver",
	        type: "text",
	        placeholder: vm.i18n(_templateObject3$1()),
	        value: vm.defaultHomeServer,
	        disabled: disabled
	      });
	      return t.div({
	        className: "PreSessionScreen"
	      }, [t.div({
	        className: "logo"
	      }), t.div({
	        className: "LoginView form"
	      }, [t.h1([vm.i18n(_templateObject4$1())]), t.if(function (vm) {
	        return vm.error;
	      }, t.createTemplate(function (t) {
	        return t.div({
	          className: "error"
	        }, function (vm) {
	          return vm.error;
	        });
	      })), t.div({
	        className: "form-row"
	      }, [t.label({
	        for: "username"
	      }, vm.i18n(_templateObject5())), username]), t.div({
	        className: "form-row"
	      }, [t.label({
	        for: "password"
	      }, vm.i18n(_templateObject6())), password]), t.div({
	        className: "form-row"
	      }, [t.label({
	        for: "homeserver"
	      }, vm.i18n(_templateObject7())), homeserver]), t.mapView(function (vm) {
	        return vm.loadViewModel;
	      }, function (loadViewModel) {
	        return loadViewModel ? new SessionLoadView(loadViewModel) : null;
	      }), t.div({
	        className: "button-row"
	      }, [t.button({
	        className: "styled secondary",
	        onClick: function onClick() {
	          return vm.cancel();
	        },
	        disabled: disabled
	      }, [vm.i18n(_templateObject8())]), t.button({
	        className: "styled primary",
	        onClick: function onClick() {
	          return vm.login(username.value, password.value, homeserver.value);
	        },
	        disabled: disabled
	      }, vm.i18n(_templateObject9()))]), // use t.mapView rather than t.if to create a new view when the view model changes too
	      t.p(hydrogenGithubLink(t))])]);
	    }
	  }]);

	  return LoginView;
	}(TemplateView);

	function _templateObject2$3() {
	  var data = _taggedTemplateLiteral(["Sign In"]);

	  _templateObject2$3 = function _templateObject2() {
	    return data;
	  };

	  return data;
	}

	function _templateObject$3() {
	  var data = _taggedTemplateLiteral(["Import a session"]);

	  _templateObject$3 = function _templateObject() {
	    return data;
	  };

	  return data;
	}

	function selectFileAsText(mimeType) {
	  var input = document.createElement("input");
	  input.setAttribute("type", "file");

	  if (mimeType) {
	    input.setAttribute("accept", mimeType);
	  }

	  var promise = new Promise(function (resolve, reject) {
	    var checkFile = function checkFile() {
	      input.removeEventListener("change", checkFile, true);
	      var file = input.files[0];

	      if (file) {
	        resolve(file.text());
	      } else {
	        reject(new Error("No file selected"));
	      }
	    };

	    input.addEventListener("change", checkFile, true);
	  });
	  input.click();
	  return promise;
	}

	var SessionPickerItemView = /*#__PURE__*/function (_TemplateView) {
	  _inherits(SessionPickerItemView, _TemplateView);

	  var _super = _createSuper(SessionPickerItemView);

	  function SessionPickerItemView() {
	    _classCallCheck(this, SessionPickerItemView);

	    return _super.apply(this, arguments);
	  }

	  _createClass(SessionPickerItemView, [{
	    key: "_onDeleteClick",
	    value: function _onDeleteClick() {
	      if (confirm("Are you sure?")) {
	        this.value.delete();
	      }
	    }
	  }, {
	    key: "render",
	    value: function render(t, vm) {
	      var deleteButton = t.button({
	        className: "destructive",
	        disabled: function disabled(vm) {
	          return vm.isDeleting;
	        },
	        onClick: this._onDeleteClick.bind(this)
	      }, "Sign Out");
	      var clearButton = t.button({
	        disabled: function disabled(vm) {
	          return vm.isClearing;
	        },
	        onClick: function onClick() {
	          return vm.clear();
	        }
	      }, "Clear");
	      var exportButton = t.button({
	        disabled: function disabled(vm) {
	          return vm.isClearing;
	        },
	        onClick: function onClick() {
	          return vm.export();
	        }
	      }, "Export");
	      var downloadExport = t.if(function (vm) {
	        return vm.exportDataUrl;
	      }, t.createTemplate(function (t, vm) {
	        return t.a({
	          href: vm.exportDataUrl,
	          download: "brawl-session-".concat(vm.id, ".json"),
	          onClick: function onClick() {
	            return setTimeout(function () {
	              return vm.clearExport();
	            }, 100);
	          }
	        }, "Download");
	      }));
	      var errorMessage = t.if(function (vm) {
	        return vm.error;
	      }, t.createTemplate(function (t) {
	        return t.p({
	          className: "error"
	        }, function (vm) {
	          return vm.error;
	        });
	      }));
	      return t.li([t.div({
	        className: "session-info"
	      }, [t.div({
	        className: "avatar usercolor".concat(vm.avatarColorNumber)
	      }, function (vm) {
	        return vm.avatarInitials;
	      }), t.div({
	        className: "user-id"
	      }, function (vm) {
	        return vm.label;
	      })]), t.div({
	        className: "session-actions"
	      }, [deleteButton, exportButton, downloadExport, clearButton]), errorMessage]);
	    }
	  }]);

	  return SessionPickerItemView;
	}(TemplateView);

	var SessionPickerView = /*#__PURE__*/function (_TemplateView2) {
	  _inherits(SessionPickerView, _TemplateView2);

	  var _super2 = _createSuper(SessionPickerView);

	  function SessionPickerView() {
	    _classCallCheck(this, SessionPickerView);

	    return _super2.apply(this, arguments);
	  }

	  _createClass(SessionPickerView, [{
	    key: "render",
	    value: function render(t, vm) {
	      var sessionList = new ListView({
	        list: vm.sessions,
	        onItemClick: function onItemClick(item, event) {
	          if (event.target.closest(".session-info")) {
	            vm.pick(item.value.id);
	          }
	        },
	        parentProvidesUpdates: false
	      }, function (sessionInfo) {
	        return new SessionPickerItemView(sessionInfo);
	      });
	      return t.div({
	        className: "PreSessionScreen"
	      }, [t.div({
	        className: "logo"
	      }), t.div({
	        className: "SessionPickerView"
	      }, [t.h1(["Continue as …"]), t.view(sessionList), t.div({
	        className: "button-row"
	      }, [t.button({
	        className: "styled secondary",
	        onClick: function () {
	          var _onClick = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	            return regeneratorRuntime.wrap(function _callee$(_context) {
	              while (1) {
	                switch (_context.prev = _context.next) {
	                  case 0:
	                    _context.t0 = vm;
	                    _context.next = 3;
	                    return selectFileAsText("application/json");

	                  case 3:
	                    _context.t1 = _context.sent;
	                    return _context.abrupt("return", _context.t0.import.call(_context.t0, _context.t1));

	                  case 5:
	                  case "end":
	                    return _context.stop();
	                }
	              }
	            }, _callee);
	          }));

	          function onClick() {
	            return _onClick.apply(this, arguments);
	          }

	          return onClick;
	        }()
	      }, vm.i18n(_templateObject$3())), t.button({
	        className: "styled primary",
	        onClick: function onClick() {
	          return vm.cancel();
	        }
	      }, vm.i18n(_templateObject2$3()))]), t.if(function (vm) {
	        return vm.loadViewModel;
	      }, function (vm) {
	        return new SessionLoadView(vm.loadViewModel);
	      }), t.p(hydrogenGithubLink(t))])]);
	    }
	  }]);

	  return SessionPickerView;
	}(TemplateView);

	var BrawlView = /*#__PURE__*/function () {
	  function BrawlView(vm) {
	    _classCallCheck(this, BrawlView);

	    this._vm = vm;
	    this._switcher = null;
	    this._root = null;
	    this._onViewModelChange = this._onViewModelChange.bind(this);
	  }

	  _createClass(BrawlView, [{
	    key: "_getView",
	    value: function _getView() {
	      switch (this._vm.activeSection) {
	        case "error":
	          return new StatusView({
	            header: "Something went wrong",
	            message: this._vm.errorText
	          });

	        case "session":
	          return new SessionView(this._vm.sessionViewModel);

	        case "login":
	          return new LoginView(this._vm.loginViewModel);

	        case "picker":
	          return new SessionPickerView(this._vm.sessionPickerViewModel);

	        default:
	          throw new Error("Unknown section: ".concat(this._vm.activeSection));
	      }
	    }
	  }, {
	    key: "_onViewModelChange",
	    value: function _onViewModelChange(prop) {
	      if (prop === "activeSection") {
	        this._switcher.switch(this._getView());
	      }
	    }
	  }, {
	    key: "mount",
	    value: function mount() {
	      this._switcher = new SwitchView(this._getView());
	      this._root = this._switcher.mount();

	      this._vm.on("change", this._onViewModelChange);

	      return this._root;
	    }
	  }, {
	    key: "unmount",
	    value: function unmount() {
	      this._vm.off("change", this._onViewModelChange);

	      this._switcher.unmount();
	    }
	  }, {
	    key: "root",
	    value: function root() {
	      return this._root;
	    }
	  }, {
	    key: "update",
	    value: function update() {}
	  }]);

	  return BrawlView;
	}();

	var StatusView = /*#__PURE__*/function (_TemplateView) {
	  _inherits(StatusView, _TemplateView);

	  var _super = _createSuper(StatusView);

	  function StatusView() {
	    _classCallCheck(this, StatusView);

	    return _super.apply(this, arguments);
	  }

	  _createClass(StatusView, [{
	    key: "render",
	    value: function render(t, vm) {
	      return t.div({
	        className: "StatusView"
	      }, [t.h1(vm.header), t.p(vm.message)]);
	    }
	  }]);

	  return StatusView;
	}(TemplateView);

	var Timeout = /*#__PURE__*/function () {
	  function Timeout(ms) {
	    var _this = this;

	    _classCallCheck(this, Timeout);

	    this._reject = null;
	    this._handle = null;
	    this._promise = new Promise(function (resolve, reject) {
	      _this._reject = reject;
	      _this._handle = setTimeout(function () {
	        _this._reject = null;
	        resolve();
	      }, ms);
	    });
	  }

	  _createClass(Timeout, [{
	    key: "elapsed",
	    value: function elapsed() {
	      return this._promise;
	    }
	  }, {
	    key: "abort",
	    value: function abort() {
	      if (this._reject) {
	        this._reject(new AbortError());

	        clearTimeout(this._handle);
	        this._handle = null;
	        this._reject = null;
	      }
	    }
	  }, {
	    key: "dispose",
	    value: function dispose() {
	      this.abort();
	    }
	  }]);

	  return Timeout;
	}();

	var Interval = /*#__PURE__*/function () {
	  function Interval(ms, callback) {
	    _classCallCheck(this, Interval);

	    this._handle = setInterval(callback, ms);
	  }

	  _createClass(Interval, [{
	    key: "dispose",
	    value: function dispose() {
	      if (this._handle) {
	        clearInterval(this._handle);
	        this._handle = null;
	      }
	    }
	  }]);

	  return Interval;
	}();

	var TimeMeasure = /*#__PURE__*/function () {
	  function TimeMeasure() {
	    _classCallCheck(this, TimeMeasure);

	    this._start = window.performance.now();
	  }

	  _createClass(TimeMeasure, [{
	    key: "measure",
	    value: function measure() {
	      return window.performance.now() - this._start;
	    }
	  }]);

	  return TimeMeasure;
	}();

	var Clock = /*#__PURE__*/function () {
	  function Clock() {
	    _classCallCheck(this, Clock);
	  }

	  _createClass(Clock, [{
	    key: "createMeasure",
	    value: function createMeasure() {
	      return new TimeMeasure();
	    }
	  }, {
	    key: "createTimeout",
	    value: function createTimeout(ms) {
	      return new Timeout(ms);
	    }
	  }, {
	    key: "createInterval",
	    value: function createInterval(callback, ms) {
	      return new Interval(ms, callback);
	    }
	  }, {
	    key: "now",
	    value: function now() {
	      return Date.now();
	    }
	  }]);

	  return Clock;
	}();

	var OnlineStatus = /*#__PURE__*/function (_BaseObservableValue) {
	  _inherits(OnlineStatus, _BaseObservableValue);

	  var _super = _createSuper(OnlineStatus);

	  function OnlineStatus() {
	    var _this;

	    _classCallCheck(this, OnlineStatus);

	    _this = _super.call(this);
	    _this._onOffline = _this._onOffline.bind(_assertThisInitialized(_this));
	    _this._onOnline = _this._onOnline.bind(_assertThisInitialized(_this));
	    return _this;
	  }

	  _createClass(OnlineStatus, [{
	    key: "_onOffline",
	    value: function _onOffline() {
	      this.emit(false);
	    }
	  }, {
	    key: "_onOnline",
	    value: function _onOnline() {
	      this.emit(true);
	    }
	  }, {
	    key: "onSubscribeFirst",
	    value: function onSubscribeFirst() {
	      window.addEventListener('offline', this._onOffline);
	      window.addEventListener('online', this._onOnline);
	    }
	  }, {
	    key: "onUnsubscribeLast",
	    value: function onUnsubscribeLast() {
	      window.removeEventListener('offline', this._onOffline);
	      window.removeEventListener('online', this._onOnline);
	    }
	  }, {
	    key: "value",
	    get: function get() {
	      return navigator.onLine;
	    }
	  }]);

	  return OnlineStatus;
	}(BaseObservableValue);

	// which does not support default exports,
	// see https://github.com/rollup/plugins/tree/master/packages/multi-entry

	function main(_x) {
	  return _main.apply(this, arguments);
	}

	function _main() {
	  _main = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(container) {
	    var clock, request, sessionInfoStorage, storageFactory, vm, view;
	    return regeneratorRuntime.wrap(function _callee$(_context) {
	      while (1) {
	        switch (_context.prev = _context.next) {
	          case 0:
	            _context.prev = 0;
	            // to replay:
	            // const fetchLog = await (await fetch("/fetchlogs/constrainterror.json")).json();
	            // const replay = new ReplayRequester(fetchLog, {delay: false});
	            // const request = replay.request;
	            // to record:
	            // const recorder = new RecordRequester(createFetchRequest(clock.createTimeout));
	            // const request = recorder.request;
	            // window.getBrawlFetchLog = () => recorder.log();
	            clock = new Clock();

	            if (typeof fetch === "function") {
	              request = createFetchRequest(clock.createTimeout);
	            } else {
	              request = xhrRequest;
	            }

	            sessionInfoStorage = new SessionInfoStorage("brawl_sessions_v1");
	            storageFactory = new StorageFactory();
	            vm = new BrawlViewModel({
	              createSessionContainer: function createSessionContainer() {
	                return new SessionContainer({
	                  random: Math.random,
	                  onlineStatus: new OnlineStatus(),
	                  storageFactory: storageFactory,
	                  sessionInfoStorage: sessionInfoStorage,
	                  request: request,
	                  clock: clock
	                });
	              },
	              sessionInfoStorage: sessionInfoStorage,
	              storageFactory: storageFactory,
	              clock: clock
	            });
	            window.__brawlViewModel = vm;
	            _context.next = 9;
	            return vm.load();

	          case 9:
	            view = new BrawlView(vm);
	            container.appendChild(view.mount());
	            _context.next = 16;
	            break;

	          case 13:
	            _context.prev = 13;
	            _context.t0 = _context["catch"](0);
	            console.error("".concat(_context.t0.message, ":\n").concat(_context.t0.stack));

	          case 16:
	          case "end":
	            return _context.stop();
	        }
	      }
	    }, _callee, null, [[0, 13]]);
	  }));
	  return _main.apply(this, arguments);
	}

	exports.main = main;

	return exports;

}({}));
