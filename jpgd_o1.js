function readJpeg(data) {
    var Module = {
	data: data
	};
Module["preRun"] = (function() {
  FS.createDataFile("/", "input.jpg", Module["intArrayFromString"](Module["data"]), true, true);
});

Module["arguments"] = [ "" ];

Module["return"] = "";

Module["print"] = (function(text) {
  Module["return"] += text + "\n";
});

try {
  this["Module"] = Module;
} catch (e) {
  this["Module"] = Module = {};
}

var ENVIRONMENT_IS_NODE = typeof process === "object";

var ENVIRONMENT_IS_WEB = typeof window === "object";

var ENVIRONMENT_IS_WORKER = typeof importScripts === "function";

var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (ENVIRONMENT_IS_NODE) {
  Module["print"] = (function(x) {
    process["stdout"].write(x + "\n");
  });
  Module["printErr"] = (function(x) {
    process["stderr"].write(x + "\n");
  });
  var nodeFS = require("fs");
  var nodePath = require("path");
  Module["read"] = (function(filename) {
    filename = nodePath["normalize"](filename);
    var ret = nodeFS["readFileSync"](filename).toString();
    if (!ret && filename != nodePath["resolve"](filename)) {
      filename = path.join(__dirname, "..", "src", filename);
      ret = nodeFS["readFileSync"](filename).toString();
    }
    return ret;
  });
  Module["load"] = (function(f) {
    globalEval(read(f));
  });
  if (!Module["arguments"]) {
    Module["arguments"] = process["argv"].slice(2);
  }
} else if (ENVIRONMENT_IS_SHELL) {
  Module["print"] = print;
  Module["printErr"] = printErr;
  if (typeof read != "undefined") {
    Module["read"] = read;
  } else {
    Module["read"] = (function(f) {
      snarf(f);
    });
  }
  if (!Module["arguments"]) {
    if (typeof scriptArgs != "undefined") {
      Module["arguments"] = scriptArgs;
    } else if (typeof arguments != "undefined") {
      Module["arguments"] = arguments;
    }
  }
} else if (ENVIRONMENT_IS_WEB) {
  if (!Module["print"]) {
    Module["print"] = (function(x) {
      console.log(x);
    });
  }
  if (!Module["printErr"]) {
    Module["printErr"] = (function(x) {
      console.log(x);
    });
  }
  Module["read"] = (function(url) {
    var xhr = new XMLHttpRequest;
    xhr.open("GET", url, false);
    xhr.send(null);
    return xhr.responseText;
  });
  if (!Module["arguments"]) {
    if (typeof arguments != "undefined") {
      Module["arguments"] = arguments;
    }
  }
} else if (ENVIRONMENT_IS_WORKER) {
  Module["load"] = importScripts;
} else {
  throw "Unknown runtime environment. Where are we?";
}

function globalEval(x) {
  eval.call(null, x);
}

if (!Module["load"] == "undefined" && Module["read"]) {
  Module["load"] = (function(f) {
    globalEval(Module["read"](f));
  });
}

if (!Module["printErr"]) {
  Module["printErr"] = (function() {});
}

if (!Module["print"]) {
  Module["print"] = Module["printErr"];
}

if (!Module["arguments"]) {
  Module["arguments"] = [];
}

Module.print = Module["print"];

Module.printErr = Module["printErr"];

if (!Module["preRun"]) Module["preRun"] = [];

if (!Module["postRun"]) Module["postRun"] = [];

var Runtime = {
  stackSave: (function() {
    return STACKTOP;
  }),
  stackRestore: (function(stackTop) {
    STACKTOP = stackTop;
  }),
  forceAlign: (function(target, quantum) {
    quantum = quantum || 4;
    if (quantum == 1) return target;
    if (isNumber(target) && isNumber(quantum)) {
      return Math.ceil(target / quantum) * quantum;
    } else if (isNumber(quantum) && isPowerOfTwo(quantum)) {
      var logg = log2(quantum);
      return "((((" + target + ")+" + (quantum - 1) + ")>>" + logg + ")<<" + logg + ")";
    }
    return "Math.ceil((" + target + ")/" + quantum + ")*" + quantum;
  }),
  isNumberType: (function(type) {
    return type in Runtime.INT_TYPES || type in Runtime.FLOAT_TYPES;
  }),
  isPointerType: function isPointerType(type) {
    return type[type.length - 1] == "*";
  },
  isStructType: function isStructType(type) {
    if (isPointerType(type)) return false;
    if (/^\[\d+\ x\ (.*)\]/.test(type)) return true;
    if (/<?{ ?[^}]* ?}>?/.test(type)) return true;
    return type[0] == "%";
  },
  INT_TYPES: {
    "i1": 0,
    "i8": 0,
    "i16": 0,
    "i32": 0,
    "i64": 0
  },
  FLOAT_TYPES: {
    "float": 0,
    "double": 0
  },
  bitshift64: (function(low, high, op, bits) {
    var ander = Math.pow(2, bits) - 1;
    if (bits < 32) {
      switch (op) {
       case "shl":
        return [ low << bits, high << bits | (low & ander << 32 - bits) >>> 32 - bits ];
       case "ashr":
        return [ (low >>> bits | (high & ander) << 32 - bits) >> 0 >>> 0, high >> bits >>> 0 ];
       case "lshr":
        return [ (low >>> bits | (high & ander) << 32 - bits) >>> 0, high >>> bits ];
      }
    } else if (bits == 32) {
      switch (op) {
       case "shl":
        return [ 0, low ];
       case "ashr":
        return [ high, (high | 0) < 0 ? ander : 0 ];
       case "lshr":
        return [ high, 0 ];
      }
    } else {
      switch (op) {
       case "shl":
        return [ 0, low << bits - 32 ];
       case "ashr":
        return [ high >> bits - 32 >>> 0, (high | 0) < 0 ? ander : 0 ];
       case "lshr":
        return [ high >>> bits - 32, 0 ];
      }
    }
    abort("unknown bitshift64 op: " + [ value, op, bits ]);
  }),
  or64: (function(x, y) {
    var l = x | 0 | (y | 0);
    var h = (Math.round(x / 4294967296) | Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  }),
  and64: (function(x, y) {
    var l = (x | 0) & (y | 0);
    var h = (Math.round(x / 4294967296) & Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  }),
  xor64: (function(x, y) {
    var l = (x | 0) ^ (y | 0);
    var h = (Math.round(x / 4294967296) ^ Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  }),
  getNativeTypeSize: (function(type, quantumSize) {
    if (Runtime.QUANTUM_SIZE == 1) return 1;
    var size = {
      "%i1": 1,
      "%i8": 1,
      "%i16": 2,
      "%i32": 4,
      "%i64": 8,
      "%float": 4,
      "%double": 8
    }["%" + type];
    if (!size) {
      if (type[type.length - 1] == "*") {
        size = Runtime.QUANTUM_SIZE;
      } else if (type[0] == "i") {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 == 0);
        size = bits / 8;
      }
    }
    return size;
  }),
  getNativeFieldSize: (function(type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  }),
  dedup: function dedup(items, ident) {
    var seen = {};
    if (ident) {
      return items.filter((function(item) {
        if (seen[item[ident]]) return false;
        seen[item[ident]] = true;
        return true;
      }));
    } else {
      return items.filter((function(item) {
        if (seen[item]) return false;
        seen[item] = true;
        return true;
      }));
    }
  },
  set: function set() {
    var args = typeof arguments[0] === "object" ? arguments[0] : arguments;
    var ret = {};
    for (var i = 0; i < args.length; i++) {
      ret[args[i]] = 0;
    }
    return ret;
  },
  calculateStructAlignment: function calculateStructAlignment(type) {
    type.flatSize = 0;
    type.alignSize = 0;
    var diffs = [];
    var prev = -1;
    type.flatIndexes = type.fields.map((function(field) {
      var size, alignSize;
      if (Runtime.isNumberType(field) || Runtime.isPointerType(field)) {
        size = Runtime.getNativeTypeSize(field);
        alignSize = size;
      } else if (Runtime.isStructType(field)) {
        size = Types.types[field].flatSize;
        alignSize = Types.types[field].alignSize;
      } else {
        throw "Unclear type in struct: " + field + ", in " + type.name_ + " :: " + dump(Types.types[type.name_]);
      }
      alignSize = type.packed ? 1 : Math.min(alignSize, Runtime.QUANTUM_SIZE);
      type.alignSize = Math.max(type.alignSize, alignSize);
      var curr = Runtime.alignMemory(type.flatSize, alignSize);
      type.flatSize = curr + size;
      if (prev >= 0) {
        diffs.push(curr - prev);
      }
      prev = curr;
      return curr;
    }));
    type.flatSize = Runtime.alignMemory(type.flatSize, type.alignSize);
    if (diffs.length == 0) {
      type.flatFactor = type.flatSize;
    } else if (Runtime.dedup(diffs).length == 1) {
      type.flatFactor = diffs[0];
    }
    type.needsFlattening = type.flatFactor != 1;
    return type.flatIndexes;
  },
  generateStructInfo: (function(struct, typeName, offset) {
    var type, alignment;
    if (typeName) {
      offset = offset || 0;
      type = (typeof Types === "undefined" ? Runtime.typeInfo : Types.types)[typeName];
      if (!type) return null;
      assert(type.fields.length === struct.length, "Number of named fields must match the type for " + typeName);
      alignment = type.flatIndexes;
    } else {
      var type = {
        fields: struct.map((function(item) {
          return item[0];
        }))
      };
      alignment = Runtime.calculateStructAlignment(type);
    }
    var ret = {
      __size__: type.flatSize
    };
    if (typeName) {
      struct.forEach((function(item, i) {
        if (typeof item === "string") {
          ret[item] = alignment[i] + offset;
        } else {
          var key;
          for (var k in item) key = k;
          ret[key] = Runtime.generateStructInfo(item[key], type.fields[i], alignment[i]);
        }
      }));
    } else {
      struct.forEach((function(item, i) {
        ret[item[1]] = alignment[i];
      }));
    }
    return ret;
  }),
  addFunction: (function(func) {
    var ret = FUNCTION_TABLE.length;
    FUNCTION_TABLE.push(func);
    FUNCTION_TABLE.push(0);
    return ret;
  }),
  warnOnce: (function(text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  }),
  funcWrappers: {},
  getFuncWrapper: (function(func) {
    if (!Runtime.funcWrappers[func]) {
      Runtime.funcWrappers[func] = (function() {
        FUNCTION_TABLE[func].apply(null, arguments);
      });
    }
    return Runtime.funcWrappers[func];
  }),
  stackAlloc: function stackAlloc(size) {
    var ret = STACKTOP;
    STACKTOP += size;
    STACKTOP = STACKTOP + 3 >> 2 << 2;
    return ret;
  },
  staticAlloc: function staticAlloc(size) {
    var ret = STATICTOP;
    STATICTOP += size;
    STATICTOP = STATICTOP + 3 >> 2 << 2;
    if (STATICTOP >= TOTAL_MEMORY) enlargeMemory();
    return ret;
  },
  alignMemory: function alignMemory(size, quantum) {
    var ret = size = Math.ceil(size / (quantum ? quantum : 4)) * (quantum ? quantum : 4);
    return ret;
  },
  makeBigInt: function makeBigInt(low, high, unsigned) {
    var ret = unsigned ? (low >>> 0) + (high >>> 0) * 4294967296 : (low >>> 0) + (high | 0) * 4294967296;
    return ret;
  },
  QUANTUM_SIZE: 4,
  __dummy__: 0
};

var CorrectionsMonitor = {
  MAX_ALLOWED: 0,
  corrections: 0,
  sigs: {},
  note: (function(type, succeed, sig) {
    if (!succeed) {
      this.corrections++;
      if (this.corrections >= this.MAX_ALLOWED) abort("\n\nToo many corrections!");
    }
  }),
  print: (function() {})
};

var __THREW__ = false;

var ABORT = false;

var undef = 0;

var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD;

var tempI64, tempI64b;

function abort(text) {
  Module.print(text + ":\n" + (new Error).stack);
  ABORT = true;
  throw "Assertion: " + text;
}

function assert(condition, text) {
  if (!condition) {
    abort("Assertion failed: " + text);
  }
}

var globalScope = this;

function ccall(ident, returnType, argTypes, args) {
  var stack = 0;
  function toC(value, type) {
    if (type == "string") {
      if (value === null || value === undefined || value === 0) return 0;
      if (!stack) stack = Runtime.stackSave();
      var ret = Runtime.stackAlloc(value.length + 1);
      writeStringToMemory(value, ret);
      return ret;
    } else if (type == "array") {
      if (!stack) stack = Runtime.stackSave();
      var ret = Runtime.stackAlloc(value.length);
      writeArrayToMemory(value, ret);
      return ret;
    }
    return value;
  }
  function fromC(value, type) {
    if (type == "string") {
      return Pointer_stringify(value);
    }
    assert(type != "array");
    return value;
  }
  try {
    var func = eval("_" + ident);
  } catch (e) {
    try {
      func = globalScope["Module"]["_" + ident];
    } catch (e) {}
  }
  assert(func, "Cannot call unknown function " + ident + " (perhaps LLVM optimizations or closure removed it?)");
  var i = 0;
  var cArgs = args ? args.map((function(arg) {
    return toC(arg, argTypes[i++]);
  })) : [];
  var ret = fromC(func.apply(null, cArgs), returnType);
  if (stack) Runtime.stackRestore(stack);
  return ret;
}

Module["ccall"] = ccall;

function cwrap(ident, returnType, argTypes) {
  return (function() {
    return ccall(ident, returnType, argTypes, Array.prototype.slice.call(arguments));
  });
}

Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || "i8";
  if (type[type.length - 1] === "*") type = "i32";
  switch (type) {
   case "i1":
    HEAP8[ptr] = value;
    break;
   case "i8":
    HEAP8[ptr] = value;
    break;
   case "i16":
    HEAP16[ptr >> 1] = value;
    break;
   case "i32":
    HEAP32[ptr >> 2] = value;
    break;
   case "i64":
    HEAP32[ptr >> 2] = value;
    break;
   case "float":
    HEAPF32[ptr >> 2] = value;
    break;
   case "double":
    tempDoubleF64[0] = value, HEAP32[ptr >> 2] = tempDoubleI32[0], HEAP32[ptr + 4 >> 2] = tempDoubleI32[1];
    break;
   default:
    abort("invalid type for setValue: " + type);
  }
}

Module["setValue"] = setValue;

function getValue(ptr, type, noSafe) {
  type = type || "i8";
  if (type[type.length - 1] === "*") type = "i32";
  switch (type) {
   case "i1":
    return HEAP8[ptr];
   case "i8":
    return HEAP8[ptr];
   case "i16":
    return HEAP16[ptr >> 1];
   case "i32":
    return HEAP32[ptr >> 2];
   case "i64":
    return HEAP32[ptr >> 2];
   case "float":
    return HEAPF32[ptr >> 2];
   case "double":
    return tempDoubleI32[0] = HEAP32[ptr >> 2], tempDoubleI32[1] = HEAP32[ptr + 4 >> 2], tempDoubleF64[0];
   default:
    abort("invalid type for setValue: " + type);
  }
  return null;
}

Module["getValue"] = getValue;

var ALLOC_NORMAL = 0;

var ALLOC_STACK = 1;

var ALLOC_STATIC = 2;

Module["ALLOC_NORMAL"] = ALLOC_NORMAL;

Module["ALLOC_STACK"] = ALLOC_STACK;

Module["ALLOC_STATIC"] = ALLOC_STATIC;

function allocate(slab, types, allocator) {
  var zeroinit, size;
  if (typeof slab === "number") {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }
  var singleType = typeof types === "string" ? types : null;
  var ret = [ _malloc, Runtime.stackAlloc, Runtime.staticAlloc ][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  if (zeroinit) {
    _memset(ret, 0, size);
    return ret;
  }
  var i = 0, type;
  while (i < size) {
    var curr = slab[i];
    if (typeof curr === "function") {
      curr = Runtime.getFunctionIndex(curr);
    }
    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    if (type == "i64") type = "i32";
    setValue(ret + i, curr, type);
    i += Runtime.getNativeTypeSize(type);
  }
  return ret;
}

Module["allocate"] = allocate;

function Pointer_stringify(ptr, length) {
  var nullTerminated = typeof length == "undefined";
  var ret = "";
  var i = 0;
  var t;
  var nullByte = String.fromCharCode(0);
  while (1) {
    t = String.fromCharCode(HEAPU8[ptr + i]);
    if (nullTerminated && t == nullByte) {
      break;
    } else {}
    ret += t;
    i += 1;
    if (!nullTerminated && i == length) {
      break;
    }
  }
  return ret;
}

Module["Pointer_stringify"] = Pointer_stringify;

function Array_stringify(array) {
  var ret = "";
  for (var i = 0; i < array.length; i++) {
    ret += String.fromCharCode(array[i]);
  }
  return ret;
}

Module["Array_stringify"] = Array_stringify;

var FUNCTION_TABLE;

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  return x + 4095 >> 12 << 12;
}

var HEAP;

var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

var STACK_ROOT, STACKTOP, STACK_MAX;

var STATICTOP;

function enlargeMemory() {
  while (TOTAL_MEMORY <= STATICTOP) {
    TOTAL_MEMORY = alignMemoryPage(2 * TOTAL_MEMORY);
  }
  var oldHEAP8 = HEAP8;
  var buffer = new ArrayBuffer(TOTAL_MEMORY);
  HEAP8 = new Int8Array(buffer);
  HEAP16 = new Int16Array(buffer);
  HEAP32 = new Int32Array(buffer);
  HEAPU8 = new Uint8Array(buffer);
  HEAPU16 = new Uint16Array(buffer);
  HEAPU32 = new Uint32Array(buffer);
  HEAPF32 = new Float32Array(buffer);
  HEAPF64 = new Float64Array(buffer);
  HEAP8.set(oldHEAP8);
}

var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;

var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 10485760;

var FAST_MEMORY = Module["FAST_MEMORY"] || 2097152;

assert(!!Int32Array && !!Float64Array && !!(new Int32Array(1))["subarray"] && !!(new Int32Array(1))["set"], "Cannot fallback to non-typed array case: Code is too specialized");

var buffer = new ArrayBuffer(TOTAL_MEMORY);

HEAP8 = new Int8Array(buffer);

HEAP16 = new Int16Array(buffer);

HEAP32 = new Int32Array(buffer);

HEAPU8 = new Uint8Array(buffer);

HEAPU16 = new Uint16Array(buffer);

HEAPU32 = new Uint32Array(buffer);

HEAPF32 = new Float32Array(buffer);

HEAPF64 = new Float64Array(buffer);

HEAP32[0] = 255;

assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, "Typed arrays 2 must be run on a little-endian system");

var base = intArrayFromString("(null)");

STATICTOP = base.length;

for (var i = 0; i < base.length; i++) {
  HEAP8[i] = base[i];
}

Module["HEAP"] = HEAP;

Module["HEAP8"] = HEAP8;

Module["HEAP16"] = HEAP16;

Module["HEAP32"] = HEAP32;

Module["HEAPU8"] = HEAPU8;

Module["HEAPU16"] = HEAPU16;

Module["HEAPU32"] = HEAPU32;

Module["HEAPF32"] = HEAPF32;

Module["HEAPF64"] = HEAPF64;

STACK_ROOT = STACKTOP = Runtime.alignMemory(STATICTOP);

STACK_MAX = STACK_ROOT + TOTAL_STACK;

var tempDoublePtr = Runtime.alignMemory(STACK_MAX, 8);

var tempDoubleI8 = HEAP8.subarray(tempDoublePtr);

var tempDoubleI32 = HEAP32.subarray(tempDoublePtr >> 2);

var tempDoubleF32 = HEAPF32.subarray(tempDoublePtr >> 2);

var tempDoubleF64 = HEAPF64.subarray(tempDoublePtr >> 3);

function copyTempFloat(ptr) {
  tempDoubleI8[0] = HEAP8[ptr];
  tempDoubleI8[1] = HEAP8[ptr + 1];
  tempDoubleI8[2] = HEAP8[ptr + 2];
  tempDoubleI8[3] = HEAP8[ptr + 3];
}

function copyTempDouble(ptr) {
  tempDoubleI8[0] = HEAP8[ptr];
  tempDoubleI8[1] = HEAP8[ptr + 1];
  tempDoubleI8[2] = HEAP8[ptr + 2];
  tempDoubleI8[3] = HEAP8[ptr + 3];
  tempDoubleI8[4] = HEAP8[ptr + 4];
  tempDoubleI8[5] = HEAP8[ptr + 5];
  tempDoubleI8[6] = HEAP8[ptr + 6];
  tempDoubleI8[7] = HEAP8[ptr + 7];
}

STACK_MAX = tempDoublePtr + 8;

STATICTOP = alignMemoryPage(STACK_MAX);

function callRuntimeCallbacks(callbacks) {
  while (callbacks.length > 0) {
    var callback = callbacks.shift();
    var func = callback.func;
    if (typeof func === "number") {
      func = FUNCTION_TABLE[func];
    }
    func(callback.arg === undefined ? null : callback.arg);
  }
}

var __ATINIT__ = [];

var __ATMAIN__ = [];

var __ATEXIT__ = [];

function initRuntime() {
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  CorrectionsMonitor.print();
}

function String_len(ptr) {
  var i = 0;
  while (HEAP8[ptr + i]) i++;
  return i;
}

Module["String_len"] = String_len;

function intArrayFromString(stringy, dontAddNull, length) {
  var ret = [];
  var t;
  var i = 0;
  if (length === undefined) {
    length = stringy.length;
  }
  while (i < length) {
    var chr = stringy.charCodeAt(i);
    if (chr > 255) {
      chr &= 255;
    }
    ret.push(chr);
    i = i + 1;
  }
  if (!dontAddNull) {
    ret.push(0);
  }
  return ret;
}

Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 255) {
      chr &= 255;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join("");
}

Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var i = 0;
  while (i < string.length) {
    var chr = string.charCodeAt(i);
    if (chr > 255) {
      chr &= 255;
    }
    HEAP8[buffer + i] = chr;
    i = i + 1;
  }
  if (!dontAddNull) {
    HEAP8[buffer + i] = 0;
  }
}

Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[buffer + i] = array[i];
  }
}

Module["writeArrayToMemory"] = writeArrayToMemory;

var STRING_TABLE = [];

function unSign(value, bits, ignore, sig) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2 * Math.abs(1 << bits - 1) + value : Math.pow(2, bits) + value;
}

function reSign(value, bits, ignore, sig) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << bits - 1) : Math.pow(2, bits - 1);
  if (value >= half && (bits <= 32 || value > half)) {
    value = -2 * half + value;
  }
  return value;
}

var runDependencies = 0;

function addRunDependency() {
  runDependencies++;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies);
  }
}

Module["addRunDependency"] = addRunDependency;

function removeRunDependency() {
  runDependencies--;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies);
  }
  if (runDependencies == 0) run();
}

Module["removeRunDependency"] = removeRunDependency;

function __ZN4jpgd3RowILi1EE4idctEPiPKs($pTemp, $pSrc_val) {
  var $2 = $pSrc_val << 16 >> 16 << 2;
  HEAP32[$pTemp >> 2] = $2;
  HEAP32[$pTemp + 4 >> 2] = $2;
  HEAP32[$pTemp + 8 >> 2] = $2;
  HEAP32[$pTemp + 12 >> 2] = $2;
  HEAP32[$pTemp + 16 >> 2] = $2;
  HEAP32[$pTemp + 20 >> 2] = $2;
  HEAP32[$pTemp + 24 >> 2] = $2;
  HEAP32[$pTemp + 28 >> 2] = $2;
  return;
}

function __ZN4jpgd3RowILi2EE4idctEPiPKs($pTemp, $pSrc_val, $pSrc_1_val) {
  var $3 = $pSrc_1_val << 16 >> 16;
  var $4 = $3 * 9633 | 0;
  var $5 = $3 * 6437 | 0;
  var $6 = $3 * 2260 | 0;
  var $7 = $3 * 11363 | 0;
  var $8 = $pSrc_val << 16 >> 16 << 13 | 1024;
  HEAP32[$pTemp >> 2] = $8 + $7 >> 11;
  HEAP32[$pTemp + 28 >> 2] = $8 - $7 >> 11;
  HEAP32[$pTemp + 4 >> 2] = $8 + $4 >> 11;
  HEAP32[$pTemp + 24 >> 2] = $8 - $4 >> 11;
  HEAP32[$pTemp + 8 >> 2] = $8 + $5 >> 11;
  HEAP32[$pTemp + 20 >> 2] = $8 - $5 >> 11;
  HEAP32[$pTemp + 12 >> 2] = $8 + $6 >> 11;
  HEAP32[$pTemp + 16 >> 2] = $8 - $6 >> 11;
  return;
}

function __ZN4jpgd3RowILi3EE4idctEPiPKs($pTemp, $pSrc_val, $pSrc_1_val, $pSrc_2_val) {
  var $1 = $pSrc_2_val << 16 >> 16;
  var $2 = $1 * 4433 | 0;
  var $3 = $1 * 10703 | 0;
  var $5 = $pSrc_val << 16 >> 16 << 13;
  var $6 = $5 + $3 | 0;
  var $7 = $5 - $3 | 0;
  var $8 = $5 + $2 | 0;
  var $9 = $5 - $2 | 0;
  var $10 = $pSrc_1_val << 16 >> 16;
  var $11 = $10 * 9633 | 0;
  var $12 = $10 * 6437 | 0;
  var $13 = $10 * 2260 | 0;
  var $14 = $10 * 11363 | 0;
  HEAP32[$pTemp >> 2] = $14 + 1024 + $6 >> 11;
  HEAP32[$pTemp + 28 >> 2] = 1024 - $14 + $6 >> 11;
  HEAP32[$pTemp + 4 >> 2] = $11 + 1024 + $8 >> 11;
  HEAP32[$pTemp + 24 >> 2] = 1024 - $11 + $8 >> 11;
  HEAP32[$pTemp + 8 >> 2] = $12 + 1024 + $9 >> 11;
  HEAP32[$pTemp + 20 >> 2] = 1024 - $12 + $9 >> 11;
  HEAP32[$pTemp + 12 >> 2] = $13 + 1024 + $7 >> 11;
  HEAP32[$pTemp + 16 >> 2] = 1024 - $13 + $7 >> 11;
  return;
}

__ZN4jpgd3RowILi3EE4idctEPiPKs["X"] = 1;

function __ZN4jpgd3RowILi4EE4idctEPiPKs($pTemp, $pSrc) {
  var $3 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $4 = $3 * 4433 | 0;
  var $5 = $3 * 10703 | 0;
  var $8 = HEAP16[$pSrc >> 1] << 16 >> 16 << 13;
  var $10 = $8 - $5 | 0;
  var $11 = $8 + $4 | 0;
  var $12 = $8 - $4 | 0;
  var $15 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $18 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $20 = ($18 + $15) * 9633 | 0;
  var $24 = $20 + $15 * -16069 | 0;
  var $26 = $20 + $18 * -3196 | 0;
  var $27 = $24 + $18 * -7373 | 0;
  var $28 = $26 + $15 * -20995 | 0;
  var $30 = $24 + $15 * 4177 | 0;
  var $32 = $26 + $18 * 4926 | 0;
  var $33 = $8 + $5 + 1024 | 0;
  HEAP32[$pTemp >> 2] = $33 + $32 >> 11;
  HEAP32[$pTemp + 28 >> 2] = $33 - $32 >> 11;
  var $39 = $11 + 1024 | 0;
  HEAP32[$pTemp + 4 >> 2] = $39 + $30 >> 11;
  HEAP32[$pTemp + 24 >> 2] = $39 - $30 >> 11;
  var $46 = $12 + 1024 | 0;
  HEAP32[$pTemp + 8 >> 2] = $46 + $28 >> 11;
  HEAP32[$pTemp + 20 >> 2] = $46 - $28 >> 11;
  var $53 = $10 + 1024 | 0;
  HEAP32[$pTemp + 12 >> 2] = $53 + $27 >> 11;
  HEAP32[$pTemp + 16 >> 2] = $53 - $27 >> 11;
  return;
}

__ZN4jpgd3RowILi4EE4idctEPiPKs["X"] = 1;

function __ZN4jpgd3RowILi5EE4idctEPiPKs($pTemp, $pSrc) {
  var $3 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $4 = $3 * 4433 | 0;
  var $5 = $3 * 10703 | 0;
  var $7 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $10 = HEAP16[$pSrc + 8 >> 1] << 16 >> 16;
  var $12 = $10 + $7 << 13;
  var $14 = $7 - $10 << 13;
  var $16 = $12 - $5 | 0;
  var $17 = $14 + $4 | 0;
  var $18 = $14 - $4 | 0;
  var $21 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $24 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $26 = ($24 + $21) * 9633 | 0;
  var $30 = $26 + $21 * -16069 | 0;
  var $32 = $26 + $24 * -3196 | 0;
  var $33 = $30 + $24 * -7373 | 0;
  var $34 = $32 + $21 * -20995 | 0;
  var $36 = $30 + $21 * 4177 | 0;
  var $38 = $32 + $24 * 4926 | 0;
  var $39 = $12 + $5 + 1024 | 0;
  HEAP32[$pTemp >> 2] = $39 + $38 >> 11;
  HEAP32[$pTemp + 28 >> 2] = $39 - $38 >> 11;
  var $45 = $17 + 1024 | 0;
  HEAP32[$pTemp + 4 >> 2] = $45 + $36 >> 11;
  HEAP32[$pTemp + 24 >> 2] = $45 - $36 >> 11;
  var $52 = $18 + 1024 | 0;
  HEAP32[$pTemp + 8 >> 2] = $52 + $34 >> 11;
  HEAP32[$pTemp + 20 >> 2] = $52 - $34 >> 11;
  var $59 = $16 + 1024 | 0;
  HEAP32[$pTemp + 12 >> 2] = $59 + $33 >> 11;
  HEAP32[$pTemp + 16 >> 2] = $59 - $33 >> 11;
  return;
}

__ZN4jpgd3RowILi5EE4idctEPiPKs["X"] = 1;

function __ZN4jpgd3RowILi6EE4idctEPiPKs($pTemp, $pSrc) {
  var $3 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $4 = $3 * 4433 | 0;
  var $5 = $3 * 10703 | 0;
  var $7 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $10 = HEAP16[$pSrc + 8 >> 1] << 16 >> 16;
  var $12 = $10 + $7 << 13;
  var $14 = $7 - $10 << 13;
  var $16 = $12 - $5 | 0;
  var $17 = $14 + $4 | 0;
  var $18 = $14 - $4 | 0;
  var $21 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $24 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $27 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $29 = $27 + $21 | 0;
  var $31 = ($29 + $24) * 9633 | 0;
  var $33 = ($24 + $21) * -20995 | 0;
  var $35 = $31 + $24 * -16069 | 0;
  var $37 = $31 + $29 * -3196 | 0;
  var $38 = $35 + $27 * -7373 | 0;
  var $41 = $33 + $21 * 16819 + $37 | 0;
  var $44 = $33 + $24 * 25172 + $35 | 0;
  var $46 = $37 + $27 * 4926 | 0;
  var $47 = $12 + $5 + 1024 | 0;
  HEAP32[$pTemp >> 2] = $47 + $46 >> 11;
  HEAP32[$pTemp + 28 >> 2] = $47 - $46 >> 11;
  var $53 = $17 + 1024 | 0;
  HEAP32[$pTemp + 4 >> 2] = $53 + $44 >> 11;
  HEAP32[$pTemp + 24 >> 2] = $53 - $44 >> 11;
  var $60 = $18 + 1024 | 0;
  HEAP32[$pTemp + 8 >> 2] = $60 + $41 >> 11;
  HEAP32[$pTemp + 20 >> 2] = $60 - $41 >> 11;
  var $67 = $16 + 1024 | 0;
  HEAP32[$pTemp + 12 >> 2] = $67 + $38 >> 11;
  HEAP32[$pTemp + 16 >> 2] = $67 - $38 >> 11;
  return;
}

__ZN4jpgd3RowILi6EE4idctEPiPKs["X"] = 1;

function __ZN4jpgd3RowILi7EE4idctEPiPKs($pTemp, $pSrc) {
  var $3 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $6 = HEAP16[$pSrc + 12 >> 1] << 16 >> 16;
  var $8 = ($6 + $3) * 4433 | 0;
  var $10 = $8 + $6 * -15137 | 0;
  var $12 = $8 + $3 * 6270 | 0;
  var $14 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $17 = HEAP16[$pSrc + 8 >> 1] << 16 >> 16;
  var $19 = $17 + $14 << 13;
  var $21 = $14 - $17 << 13;
  var $23 = $19 - $12 | 0;
  var $24 = $21 + $10 | 0;
  var $25 = $21 - $10 | 0;
  var $28 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $31 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $34 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $36 = $34 + $28 | 0;
  var $38 = ($36 + $31) * 9633 | 0;
  var $40 = ($31 + $28) * -20995 | 0;
  var $42 = $38 + $31 * -16069 | 0;
  var $44 = $38 + $36 * -3196 | 0;
  var $45 = $42 + $34 * -7373 | 0;
  var $48 = $40 + $28 * 16819 + $44 | 0;
  var $51 = $40 + $31 * 25172 + $42 | 0;
  var $53 = $44 + $34 * 4926 | 0;
  var $54 = $19 + $12 + 1024 | 0;
  HEAP32[$pTemp >> 2] = $54 + $53 >> 11;
  HEAP32[$pTemp + 28 >> 2] = $54 - $53 >> 11;
  var $60 = $24 + 1024 | 0;
  HEAP32[$pTemp + 4 >> 2] = $60 + $51 >> 11;
  HEAP32[$pTemp + 24 >> 2] = $60 - $51 >> 11;
  var $67 = $25 + 1024 | 0;
  HEAP32[$pTemp + 8 >> 2] = $67 + $48 >> 11;
  HEAP32[$pTemp + 20 >> 2] = $67 - $48 >> 11;
  var $74 = $23 + 1024 | 0;
  HEAP32[$pTemp + 12 >> 2] = $74 + $45 >> 11;
  HEAP32[$pTemp + 16 >> 2] = $74 - $45 >> 11;
  return;
}

__ZN4jpgd3RowILi7EE4idctEPiPKs["X"] = 1;

function __ZN4jpgd3RowILi8EE4idctEPiPKs($pTemp, $pSrc) {
  var $3 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $6 = HEAP16[$pSrc + 12 >> 1] << 16 >> 16;
  var $8 = ($6 + $3) * 4433 | 0;
  var $10 = $8 + $6 * -15137 | 0;
  var $12 = $8 + $3 * 6270 | 0;
  var $14 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $17 = HEAP16[$pSrc + 8 >> 1] << 16 >> 16;
  var $19 = $17 + $14 << 13;
  var $21 = $14 - $17 << 13;
  var $23 = $19 - $12 | 0;
  var $24 = $21 + $10 | 0;
  var $25 = $21 - $10 | 0;
  var $28 = HEAP16[$pSrc + 14 >> 1] << 16 >> 16;
  var $31 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $34 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $37 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $40 = $34 + $28 | 0;
  var $41 = $37 + $31 | 0;
  var $43 = ($41 + $40) * 9633 | 0;
  var $44 = ($37 + $28) * -7373 | 0;
  var $45 = ($34 + $31) * -20995 | 0;
  var $47 = $43 + $40 * -16069 | 0;
  var $49 = $43 + $41 * -3196 | 0;
  var $52 = $44 + $28 * 2446 + $47 | 0;
  var $55 = $45 + $31 * 16819 + $49 | 0;
  var $58 = $45 + $34 * 25172 + $47 | 0;
  var $61 = $44 + $37 * 12299 + $49 | 0;
  var $62 = $19 + $12 + 1024 | 0;
  HEAP32[$pTemp >> 2] = $62 + $61 >> 11;
  HEAP32[$pTemp + 28 >> 2] = $62 - $61 >> 11;
  var $68 = $24 + 1024 | 0;
  HEAP32[$pTemp + 4 >> 2] = $68 + $58 >> 11;
  HEAP32[$pTemp + 24 >> 2] = $68 - $58 >> 11;
  var $75 = $25 + 1024 | 0;
  HEAP32[$pTemp + 8 >> 2] = $75 + $55 >> 11;
  HEAP32[$pTemp + 20 >> 2] = $75 - $55 >> 11;
  var $82 = $23 + 1024 | 0;
  HEAP32[$pTemp + 12 >> 2] = $82 + $52 >> 11;
  HEAP32[$pTemp + 16 >> 2] = $82 - $52 >> 11;
  return;
}

__ZN4jpgd3RowILi8EE4idctEPiPKs["X"] = 1;

function __ZN4jpgd3ColILi1EE4idctEPhPKi($pDst_ptr, $pTemp_val) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = $pTemp_val + 4112 >> 5;
    if ($2 >>> 0 > 255) {
      __label__ = 3;
      break;
    } else {
      var $9 = $2;
      __label__ = 4;
      break;
    }
   case 3:
    var $9 = ($2 ^ -2147483648) >> 31 & 255;
    __label__ = 4;
    break;
   case 4:
    var $9;
    var $10 = $9 & 255;
    HEAP8[$pDst_ptr] = $10;
    HEAP8[$pDst_ptr + 8 | 0] = $10;
    HEAP8[$pDst_ptr + 16 | 0] = $10;
    HEAP8[$pDst_ptr + 24 | 0] = $10;
    HEAP8[$pDst_ptr + 32 | 0] = $10;
    HEAP8[$pDst_ptr + 40 | 0] = $10;
    HEAP8[$pDst_ptr + 48 | 0] = $10;
    HEAP8[$pDst_ptr + 56 | 0] = $10;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd3ColILi2EE4idctEPhPKi($pDst_ptr, $pTemp_val, $pTemp_8_val) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = $pTemp_8_val * 9633 | 0;
    var $3 = $pTemp_8_val * 6437 | 0;
    var $4 = $pTemp_8_val * 2260 | 0;
    var $5 = $pTemp_8_val * 11363 | 0;
    var $6 = ($pTemp_val << 13) + 33685504 | 0;
    var $8 = $6 + $5 >> 18;
    if ($8 >>> 0 > 255) {
      __label__ = 3;
      break;
    } else {
      var $15 = $8;
      __label__ = 4;
      break;
    }
   case 3:
    var $15 = ($8 ^ -2147483648) >> 31 & 255;
    __label__ = 4;
    break;
   case 4:
    var $15;
    HEAP8[$pDst_ptr] = $15 & 255;
    var $18 = $6 - $5 >> 18;
    if ($18 >>> 0 > 255) {
      __label__ = 5;
      break;
    } else {
      var $25 = $18;
      __label__ = 6;
      break;
    }
   case 5:
    var $25 = ($18 ^ -2147483648) >> 31 & 255;
    __label__ = 6;
    break;
   case 6:
    var $25;
    HEAP8[$pDst_ptr + 56 | 0] = $25 & 255;
    var $29 = $6 + $2 >> 18;
    if ($29 >>> 0 > 255) {
      __label__ = 7;
      break;
    } else {
      var $36 = $29;
      __label__ = 8;
      break;
    }
   case 7:
    var $36 = ($29 ^ -2147483648) >> 31 & 255;
    __label__ = 8;
    break;
   case 8:
    var $36;
    HEAP8[$pDst_ptr + 8 | 0] = $36 & 255;
    var $40 = $6 - $2 >> 18;
    if ($40 >>> 0 > 255) {
      __label__ = 9;
      break;
    } else {
      var $47 = $40;
      __label__ = 10;
      break;
    }
   case 9:
    var $47 = ($40 ^ -2147483648) >> 31 & 255;
    __label__ = 10;
    break;
   case 10:
    var $47;
    HEAP8[$pDst_ptr + 48 | 0] = $47 & 255;
    var $51 = $6 + $3 >> 18;
    if ($51 >>> 0 > 255) {
      __label__ = 11;
      break;
    } else {
      var $58 = $51;
      __label__ = 12;
      break;
    }
   case 11:
    var $58 = ($51 ^ -2147483648) >> 31 & 255;
    __label__ = 12;
    break;
   case 12:
    var $58;
    HEAP8[$pDst_ptr + 16 | 0] = $58 & 255;
    var $62 = $6 - $3 >> 18;
    if ($62 >>> 0 > 255) {
      __label__ = 13;
      break;
    } else {
      var $69 = $62;
      __label__ = 14;
      break;
    }
   case 13:
    var $69 = ($62 ^ -2147483648) >> 31 & 255;
    __label__ = 14;
    break;
   case 14:
    var $69;
    HEAP8[$pDst_ptr + 40 | 0] = $69 & 255;
    var $73 = $6 + $4 >> 18;
    if ($73 >>> 0 > 255) {
      __label__ = 15;
      break;
    } else {
      var $80 = $73;
      __label__ = 16;
      break;
    }
   case 15:
    var $80 = ($73 ^ -2147483648) >> 31 & 255;
    __label__ = 16;
    break;
   case 16:
    var $80;
    HEAP8[$pDst_ptr + 24 | 0] = $80 & 255;
    var $84 = $6 - $4 >> 18;
    if ($84 >>> 0 > 255) {
      __label__ = 17;
      break;
    } else {
      var $91 = $84;
      __label__ = 18;
      break;
    }
   case 17:
    var $91 = ($84 ^ -2147483648) >> 31 & 255;
    __label__ = 18;
    break;
   case 18:
    var $91;
    HEAP8[$pDst_ptr + 32 | 0] = $91 & 255;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd3ColILi2EE4idctEPhPKi["X"] = 1;

function _main() {
  var __stackBase__ = STACKTOP;
  STACKTOP += 12;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $width = __stackBase__;
    var $height = __stackBase__ + 4;
    var $actual_comps = __stackBase__ + 8;
    var $1 = __ZN4jpgd31decompress_jpeg_image_from_fileEPKcPiS2_S2_i($width, $height, $actual_comps);
    var $2 = HEAP8[$1];
    if ($2 << 24 >> 24 == 0) {
      __label__ = 4;
      break;
    } else {
      var $pImage_data_01 = $1;
      var $4 = $2;
      __label__ = 3;
      break;
    }
   case 3:
    var $4;
    var $pImage_data_01;
    var $putchar = _putchar($4 & 255);
    var $6 = $pImage_data_01 + 1 | 0;
    var $7 = HEAPU8[$6];
    if ($7 << 24 >> 24 == 0) {
      __label__ = 4;
      break;
    } else {
      var $pImage_data_01 = $6;
      var $4 = $7;
      __label__ = 3;
      break;
    }
   case 4:
    STACKTOP = __stackBase__;
    return 0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

Module["_main"] = _main;

function __ZN4jpgd4idctEPKsPhi($pSrc_ptr, $pDst_ptr, $block_max_zag) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 256;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $temp = __stackBase__;
    if (($block_max_zag | 0) > 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    ___assert_func(STRING_TABLE.__str114 | 0, 246, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd4idctEPKsPhi | 0, STRING_TABLE.__str1115 | 0);
    __label__ = 7;
    break;
   case 4:
    if (($block_max_zag | 0) < 65) {
      __label__ = 6;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    ___assert_func(STRING_TABLE.__str114 | 0, 247, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd4idctEPKsPhi | 0, STRING_TABLE.__str2116 | 0);
    __label__ = 10;
    break;
   case 6:
    if (($block_max_zag | 0) < 2) {
      __label__ = 7;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 7:
    var $10 = (HEAP16[$pSrc_ptr >> 1] << 16 >> 16) + 4 >> 3;
    var $11 = $10 + 128 | 0;
    if ($11 >>> 0 > 255) {
      __label__ = 8;
      break;
    } else {
      var $17 = $11;
      __label__ = 9;
      break;
    }
   case 8:
    var $17 = -129 - $10 >> 31 & 255;
    __label__ = 9;
    break;
   case 9:
    var $17;
    var $19 = $17 << 8 | $17;
    var $21 = $19 << 16 | $19;
    HEAP32[$pDst_ptr >> 2] = $21;
    HEAP32[$pDst_ptr + 4 >> 2] = $21;
    HEAP32[$pDst_ptr + 8 >> 2] = $21;
    HEAP32[$pDst_ptr + 12 >> 2] = $21;
    HEAP32[$pDst_ptr + 16 >> 2] = $21;
    HEAP32[$pDst_ptr + 20 >> 2] = $21;
    HEAP32[$pDst_ptr + 24 >> 2] = $21;
    HEAP32[$pDst_ptr + 28 >> 2] = $21;
    HEAP32[$pDst_ptr + 32 >> 2] = $21;
    HEAP32[$pDst_ptr + 36 >> 2] = $21;
    HEAP32[$pDst_ptr + 40 >> 2] = $21;
    HEAP32[$pDst_ptr + 44 >> 2] = $21;
    HEAP32[$pDst_ptr + 48 >> 2] = $21;
    HEAP32[$pDst_ptr + 52 >> 2] = $21;
    HEAP32[$pDst_ptr + 56 >> 2] = $21;
    HEAP32[$pDst_ptr + 60 >> 2] = $21;
    __label__ = 32;
    break;
   case 10:
    var $54 = $temp | 0;
    var $55 = $block_max_zag - 1 | 0;
    var $56 = $55 << 3;
    var $57 = STRING_TABLE.__ZN4jpgdL16s_idct_row_tableE + $56 | 0;
    var $lftr_limit13 = STRING_TABLE.__ZN4jpgdL16s_idct_row_tableE + ($56 + 8) | 0;
    var $pTemp_06 = $54;
    var $pSrc_07 = $pSrc_ptr;
    var $pRow_tab_08 = $57;
    __label__ = 11;
    break;
   case 11:
    var $pRow_tab_08;
    var $pSrc_07;
    var $pTemp_06;
    var $60 = HEAPU8[$pRow_tab_08] & 255;
    if (($60 | 0) == 1) {
      __label__ = 12;
      break;
    } else if (($60 | 0) == 2) {
      __label__ = 13;
      break;
    } else if (($60 | 0) == 3) {
      __label__ = 14;
      break;
    } else if (($60 | 0) == 4) {
      __label__ = 15;
      break;
    } else if (($60 | 0) == 5) {
      __label__ = 16;
      break;
    } else if (($60 | 0) == 6) {
      __label__ = 17;
      break;
    } else if (($60 | 0) == 7) {
      __label__ = 18;
      break;
    } else if (($60 | 0) == 8) {
      __label__ = 19;
      break;
    } else {
      __label__ = 20;
      break;
    }
   case 12:
    var $pSrc_07_val = HEAP16[$pSrc_07 >> 1];
    __ZN4jpgd3RowILi1EE4idctEPiPKs($pTemp_06, $pSrc_07_val);
    __label__ = 20;
    break;
   case 13:
    var $pSrc_07_val1 = HEAP16[$pSrc_07 >> 1];
    var $pSrc_07_idx_val = HEAP16[$pSrc_07 + 2 >> 1];
    __ZN4jpgd3RowILi2EE4idctEPiPKs($pTemp_06, $pSrc_07_val1, $pSrc_07_idx_val);
    __label__ = 20;
    break;
   case 14:
    var $pSrc_07_val2 = HEAP16[$pSrc_07 >> 1];
    var $pSrc_07_idx3_val = HEAP16[$pSrc_07 + 2 >> 1];
    var $pSrc_07_idx4_val = HEAP16[$pSrc_07 + 4 >> 1];
    __ZN4jpgd3RowILi3EE4idctEPiPKs($pTemp_06, $pSrc_07_val2, $pSrc_07_idx3_val, $pSrc_07_idx4_val);
    __label__ = 20;
    break;
   case 15:
    __ZN4jpgd3RowILi4EE4idctEPiPKs($pTemp_06, $pSrc_07);
    __label__ = 20;
    break;
   case 16:
    __ZN4jpgd3RowILi5EE4idctEPiPKs($pTemp_06, $pSrc_07);
    __label__ = 20;
    break;
   case 17:
    __ZN4jpgd3RowILi6EE4idctEPiPKs($pTemp_06, $pSrc_07);
    __label__ = 20;
    break;
   case 18:
    __ZN4jpgd3RowILi7EE4idctEPiPKs($pTemp_06, $pSrc_07);
    __label__ = 20;
    break;
   case 19:
    __ZN4jpgd3RowILi8EE4idctEPiPKs($pTemp_06, $pSrc_07);
    __label__ = 20;
    break;
   case 20:
    var $72 = $pRow_tab_08 + 1 | 0;
    if (($72 | 0) == ($lftr_limit13 | 0)) {
      __label__ = 21;
      break;
    } else {
      var $pTemp_06 = $pTemp_06 + 32 | 0;
      var $pSrc_07 = $pSrc_07 + 16 | 0;
      var $pRow_tab_08 = $72;
      __label__ = 11;
      break;
    }
   case 21:
    var $74 = STRING_TABLE.__ZN4jpgdL16s_idct_col_tableE + $55 | 0;
    var $76 = HEAPU8[$74] & 255;
    var $lftr_limit = $pDst_ptr + 8 | 0;
    var $pTemp_13 = $54;
    var $_14 = $pDst_ptr;
    __label__ = 22;
    break;
   case 22:
    var $_14;
    var $pTemp_13;
    if (($76 | 0) == 1) {
      __label__ = 23;
      break;
    } else if (($76 | 0) == 2) {
      __label__ = 24;
      break;
    } else if (($76 | 0) == 3) {
      __label__ = 25;
      break;
    } else if (($76 | 0) == 4) {
      __label__ = 26;
      break;
    } else if (($76 | 0) == 5) {
      __label__ = 27;
      break;
    } else if (($76 | 0) == 6) {
      __label__ = 28;
      break;
    } else if (($76 | 0) == 7) {
      __label__ = 29;
      break;
    } else if (($76 | 0) == 8) {
      __label__ = 30;
      break;
    } else {
      __label__ = 31;
      break;
    }
   case 23:
    var $pTemp_13_val = HEAP32[$pTemp_13 >> 2];
    __ZN4jpgd3ColILi1EE4idctEPhPKi($_14, $pTemp_13_val);
    __label__ = 31;
    break;
   case 24:
    var $pTemp_13_val5 = HEAP32[$pTemp_13 >> 2];
    var $pTemp_13_idx_val = HEAP32[$pTemp_13 + 32 >> 2];
    __ZN4jpgd3ColILi2EE4idctEPhPKi($_14, $pTemp_13_val5, $pTemp_13_idx_val);
    __label__ = 31;
    break;
   case 25:
    var $pTemp_13_val6 = HEAP32[$pTemp_13 >> 2];
    var $pTemp_13_idx7_val = HEAP32[$pTemp_13 + 32 >> 2];
    var $pTemp_13_idx8_val = HEAP32[$pTemp_13 + 64 >> 2];
    __ZN4jpgd3ColILi3EE4idctEPhPKi($_14, $pTemp_13_val6, $pTemp_13_idx7_val, $pTemp_13_idx8_val);
    __label__ = 31;
    break;
   case 26:
    __ZN4jpgd3ColILi4EE4idctEPhPKi($_14, $pTemp_13);
    __label__ = 31;
    break;
   case 27:
    __ZN4jpgd3ColILi5EE4idctEPhPKi($_14, $pTemp_13);
    __label__ = 31;
    break;
   case 28:
    __ZN4jpgd3ColILi6EE4idctEPhPKi($_14, $pTemp_13);
    __label__ = 31;
    break;
   case 29:
    __ZN4jpgd3ColILi7EE4idctEPhPKi($_14, $pTemp_13);
    __label__ = 31;
    break;
   case 30:
    __ZN4jpgd3ColILi8EE4idctEPhPKi($_14, $pTemp_13);
    __label__ = 31;
    break;
   case 31:
    var $88 = $_14 + 1 | 0;
    if (($88 | 0) == ($lftr_limit | 0)) {
      __label__ = 32;
      break;
    } else {
      var $pTemp_13 = $pTemp_13 + 4 | 0;
      var $_14 = $88;
      __label__ = 22;
      break;
    }
   case 32:
    STACKTOP = __stackBase__;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd4idctEPKsPhi["X"] = 1;

function __ZN4jpgd3ColILi3EE4idctEPhPKi($pDst_ptr, $pTemp_val, $pTemp_8_val, $pTemp_16_val) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $pTemp_16_val * 4433 | 0;
    var $2 = $pTemp_16_val * 10703 | 0;
    var $3 = $pTemp_val << 13;
    var $4 = $3 + $2 | 0;
    var $5 = $3 - $2 | 0;
    var $6 = $3 + $1 | 0;
    var $7 = $3 - $1 | 0;
    var $8 = $pTemp_8_val * 9633 | 0;
    var $9 = $pTemp_8_val * 6437 | 0;
    var $10 = $pTemp_8_val * 2260 | 0;
    var $11 = $pTemp_8_val * 11363 | 0;
    var $14 = $11 + 33685504 + $4 >> 18;
    if ($14 >>> 0 > 255) {
      __label__ = 3;
      break;
    } else {
      var $21 = $14;
      __label__ = 4;
      break;
    }
   case 3:
    var $21 = ($14 ^ -2147483648) >> 31 & 255;
    __label__ = 4;
    break;
   case 4:
    var $21;
    HEAP8[$pDst_ptr] = $21 & 255;
    var $25 = 33685504 - $11 + $4 >> 18;
    if ($25 >>> 0 > 255) {
      __label__ = 5;
      break;
    } else {
      var $32 = $25;
      __label__ = 6;
      break;
    }
   case 5:
    var $32 = ($25 ^ -2147483648) >> 31 & 255;
    __label__ = 6;
    break;
   case 6:
    var $32;
    HEAP8[$pDst_ptr + 56 | 0] = $32 & 255;
    var $37 = $8 + 33685504 + $6 >> 18;
    if ($37 >>> 0 > 255) {
      __label__ = 7;
      break;
    } else {
      var $44 = $37;
      __label__ = 8;
      break;
    }
   case 7:
    var $44 = ($37 ^ -2147483648) >> 31 & 255;
    __label__ = 8;
    break;
   case 8:
    var $44;
    HEAP8[$pDst_ptr + 8 | 0] = $44 & 255;
    var $49 = 33685504 - $8 + $6 >> 18;
    if ($49 >>> 0 > 255) {
      __label__ = 9;
      break;
    } else {
      var $56 = $49;
      __label__ = 10;
      break;
    }
   case 9:
    var $56 = ($49 ^ -2147483648) >> 31 & 255;
    __label__ = 10;
    break;
   case 10:
    var $56;
    HEAP8[$pDst_ptr + 48 | 0] = $56 & 255;
    var $61 = $9 + 33685504 + $7 >> 18;
    if ($61 >>> 0 > 255) {
      __label__ = 11;
      break;
    } else {
      var $68 = $61;
      __label__ = 12;
      break;
    }
   case 11:
    var $68 = ($61 ^ -2147483648) >> 31 & 255;
    __label__ = 12;
    break;
   case 12:
    var $68;
    HEAP8[$pDst_ptr + 16 | 0] = $68 & 255;
    var $73 = 33685504 - $9 + $7 >> 18;
    if ($73 >>> 0 > 255) {
      __label__ = 13;
      break;
    } else {
      var $80 = $73;
      __label__ = 14;
      break;
    }
   case 13:
    var $80 = ($73 ^ -2147483648) >> 31 & 255;
    __label__ = 14;
    break;
   case 14:
    var $80;
    HEAP8[$pDst_ptr + 40 | 0] = $80 & 255;
    var $85 = $10 + 33685504 + $5 >> 18;
    if ($85 >>> 0 > 255) {
      __label__ = 15;
      break;
    } else {
      var $92 = $85;
      __label__ = 16;
      break;
    }
   case 15:
    var $92 = ($85 ^ -2147483648) >> 31 & 255;
    __label__ = 16;
    break;
   case 16:
    var $92;
    HEAP8[$pDst_ptr + 24 | 0] = $92 & 255;
    var $97 = 33685504 - $10 + $5 >> 18;
    if ($97 >>> 0 > 255) {
      __label__ = 17;
      break;
    } else {
      var $104 = $97;
      __label__ = 18;
      break;
    }
   case 17:
    var $104 = ($97 ^ -2147483648) >> 31 & 255;
    __label__ = 18;
    break;
   case 18:
    var $104;
    HEAP8[$pDst_ptr + 32 | 0] = $104 & 255;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd3ColILi3EE4idctEPhPKi["X"] = 1;

function __ZN4jpgd3ColILi4EE4idctEPhPKi($pDst_ptr, $pTemp) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAP32[$pTemp + 64 >> 2];
    var $3 = $2 * 4433 | 0;
    var $4 = $2 * 10703 | 0;
    var $6 = HEAP32[$pTemp >> 2] << 13;
    var $8 = $6 - $4 | 0;
    var $9 = $6 + $3 | 0;
    var $10 = $6 - $3 | 0;
    var $12 = HEAP32[$pTemp + 96 >> 2];
    var $14 = HEAP32[$pTemp + 32 >> 2];
    var $16 = ($14 + $12) * 9633 | 0;
    var $20 = $16 + $12 * -16069 | 0;
    var $22 = $16 + $14 * -3196 | 0;
    var $23 = $20 + $14 * -7373 | 0;
    var $24 = $22 + $12 * -20995 | 0;
    var $26 = $20 + $12 * 4177 | 0;
    var $28 = $22 + $14 * 4926 | 0;
    var $29 = $6 + $4 + 33685504 | 0;
    var $31 = $29 + $28 >> 18;
    if ($31 >>> 0 > 255) {
      __label__ = 3;
      break;
    } else {
      var $38 = $31;
      __label__ = 4;
      break;
    }
   case 3:
    var $38 = ($31 ^ -2147483648) >> 31 & 255;
    __label__ = 4;
    break;
   case 4:
    var $38;
    HEAP8[$pDst_ptr] = $38 & 255;
    var $41 = $29 - $28 >> 18;
    if ($41 >>> 0 > 255) {
      __label__ = 5;
      break;
    } else {
      var $48 = $41;
      __label__ = 6;
      break;
    }
   case 5:
    var $48 = ($41 ^ -2147483648) >> 31 & 255;
    __label__ = 6;
    break;
   case 6:
    var $48;
    HEAP8[$pDst_ptr + 56 | 0] = $48 & 255;
    var $51 = $9 + 33685504 | 0;
    var $53 = $51 + $26 >> 18;
    if ($53 >>> 0 > 255) {
      __label__ = 7;
      break;
    } else {
      var $60 = $53;
      __label__ = 8;
      break;
    }
   case 7:
    var $60 = ($53 ^ -2147483648) >> 31 & 255;
    __label__ = 8;
    break;
   case 8:
    var $60;
    HEAP8[$pDst_ptr + 8 | 0] = $60 & 255;
    var $64 = $51 - $26 >> 18;
    if ($64 >>> 0 > 255) {
      __label__ = 9;
      break;
    } else {
      var $71 = $64;
      __label__ = 10;
      break;
    }
   case 9:
    var $71 = ($64 ^ -2147483648) >> 31 & 255;
    __label__ = 10;
    break;
   case 10:
    var $71;
    HEAP8[$pDst_ptr + 48 | 0] = $71 & 255;
    var $74 = $10 + 33685504 | 0;
    var $76 = $74 + $24 >> 18;
    if ($76 >>> 0 > 255) {
      __label__ = 11;
      break;
    } else {
      var $83 = $76;
      __label__ = 12;
      break;
    }
   case 11:
    var $83 = ($76 ^ -2147483648) >> 31 & 255;
    __label__ = 12;
    break;
   case 12:
    var $83;
    HEAP8[$pDst_ptr + 16 | 0] = $83 & 255;
    var $87 = $74 - $24 >> 18;
    if ($87 >>> 0 > 255) {
      __label__ = 13;
      break;
    } else {
      var $94 = $87;
      __label__ = 14;
      break;
    }
   case 13:
    var $94 = ($87 ^ -2147483648) >> 31 & 255;
    __label__ = 14;
    break;
   case 14:
    var $94;
    HEAP8[$pDst_ptr + 40 | 0] = $94 & 255;
    var $97 = $8 + 33685504 | 0;
    var $99 = $97 + $23 >> 18;
    if ($99 >>> 0 > 255) {
      __label__ = 15;
      break;
    } else {
      var $106 = $99;
      __label__ = 16;
      break;
    }
   case 15:
    var $106 = ($99 ^ -2147483648) >> 31 & 255;
    __label__ = 16;
    break;
   case 16:
    var $106;
    HEAP8[$pDst_ptr + 24 | 0] = $106 & 255;
    var $110 = $97 - $23 >> 18;
    if ($110 >>> 0 > 255) {
      __label__ = 17;
      break;
    } else {
      var $117 = $110;
      __label__ = 18;
      break;
    }
   case 17:
    var $117 = ($110 ^ -2147483648) >> 31 & 255;
    __label__ = 18;
    break;
   case 18:
    var $117;
    HEAP8[$pDst_ptr + 32 | 0] = $117 & 255;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd3ColILi4EE4idctEPhPKi["X"] = 1;

function __ZN4jpgd3ColILi5EE4idctEPhPKi($pDst_ptr, $pTemp) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAP32[$pTemp + 64 >> 2];
    var $3 = $2 * 4433 | 0;
    var $4 = $2 * 10703 | 0;
    var $5 = HEAP32[$pTemp >> 2];
    var $7 = HEAP32[$pTemp + 128 >> 2];
    var $9 = $7 + $5 << 13;
    var $11 = $5 - $7 << 13;
    var $13 = $9 - $4 | 0;
    var $14 = $11 + $3 | 0;
    var $15 = $11 - $3 | 0;
    var $17 = HEAP32[$pTemp + 96 >> 2];
    var $19 = HEAP32[$pTemp + 32 >> 2];
    var $21 = ($19 + $17) * 9633 | 0;
    var $25 = $21 + $17 * -16069 | 0;
    var $27 = $21 + $19 * -3196 | 0;
    var $28 = $25 + $19 * -7373 | 0;
    var $29 = $27 + $17 * -20995 | 0;
    var $31 = $25 + $17 * 4177 | 0;
    var $33 = $27 + $19 * 4926 | 0;
    var $34 = $9 + $4 + 33685504 | 0;
    var $36 = $34 + $33 >> 18;
    if ($36 >>> 0 > 255) {
      __label__ = 3;
      break;
    } else {
      var $43 = $36;
      __label__ = 4;
      break;
    }
   case 3:
    var $43 = ($36 ^ -2147483648) >> 31 & 255;
    __label__ = 4;
    break;
   case 4:
    var $43;
    HEAP8[$pDst_ptr] = $43 & 255;
    var $46 = $34 - $33 >> 18;
    if ($46 >>> 0 > 255) {
      __label__ = 5;
      break;
    } else {
      var $53 = $46;
      __label__ = 6;
      break;
    }
   case 5:
    var $53 = ($46 ^ -2147483648) >> 31 & 255;
    __label__ = 6;
    break;
   case 6:
    var $53;
    HEAP8[$pDst_ptr + 56 | 0] = $53 & 255;
    var $56 = $14 + 33685504 | 0;
    var $58 = $56 + $31 >> 18;
    if ($58 >>> 0 > 255) {
      __label__ = 7;
      break;
    } else {
      var $65 = $58;
      __label__ = 8;
      break;
    }
   case 7:
    var $65 = ($58 ^ -2147483648) >> 31 & 255;
    __label__ = 8;
    break;
   case 8:
    var $65;
    HEAP8[$pDst_ptr + 8 | 0] = $65 & 255;
    var $69 = $56 - $31 >> 18;
    if ($69 >>> 0 > 255) {
      __label__ = 9;
      break;
    } else {
      var $76 = $69;
      __label__ = 10;
      break;
    }
   case 9:
    var $76 = ($69 ^ -2147483648) >> 31 & 255;
    __label__ = 10;
    break;
   case 10:
    var $76;
    HEAP8[$pDst_ptr + 48 | 0] = $76 & 255;
    var $79 = $15 + 33685504 | 0;
    var $81 = $79 + $29 >> 18;
    if ($81 >>> 0 > 255) {
      __label__ = 11;
      break;
    } else {
      var $88 = $81;
      __label__ = 12;
      break;
    }
   case 11:
    var $88 = ($81 ^ -2147483648) >> 31 & 255;
    __label__ = 12;
    break;
   case 12:
    var $88;
    HEAP8[$pDst_ptr + 16 | 0] = $88 & 255;
    var $92 = $79 - $29 >> 18;
    if ($92 >>> 0 > 255) {
      __label__ = 13;
      break;
    } else {
      var $99 = $92;
      __label__ = 14;
      break;
    }
   case 13:
    var $99 = ($92 ^ -2147483648) >> 31 & 255;
    __label__ = 14;
    break;
   case 14:
    var $99;
    HEAP8[$pDst_ptr + 40 | 0] = $99 & 255;
    var $102 = $13 + 33685504 | 0;
    var $104 = $102 + $28 >> 18;
    if ($104 >>> 0 > 255) {
      __label__ = 15;
      break;
    } else {
      var $111 = $104;
      __label__ = 16;
      break;
    }
   case 15:
    var $111 = ($104 ^ -2147483648) >> 31 & 255;
    __label__ = 16;
    break;
   case 16:
    var $111;
    HEAP8[$pDst_ptr + 24 | 0] = $111 & 255;
    var $115 = $102 - $28 >> 18;
    if ($115 >>> 0 > 255) {
      __label__ = 17;
      break;
    } else {
      var $122 = $115;
      __label__ = 18;
      break;
    }
   case 17:
    var $122 = ($115 ^ -2147483648) >> 31 & 255;
    __label__ = 18;
    break;
   case 18:
    var $122;
    HEAP8[$pDst_ptr + 32 | 0] = $122 & 255;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd3ColILi5EE4idctEPhPKi["X"] = 1;

function __ZN4jpgd3ColILi6EE4idctEPhPKi($pDst_ptr, $pTemp) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAP32[$pTemp + 64 >> 2];
    var $3 = $2 * 4433 | 0;
    var $4 = $2 * 10703 | 0;
    var $5 = HEAP32[$pTemp >> 2];
    var $7 = HEAP32[$pTemp + 128 >> 2];
    var $9 = $7 + $5 << 13;
    var $11 = $5 - $7 << 13;
    var $13 = $9 - $4 | 0;
    var $14 = $11 + $3 | 0;
    var $15 = $11 - $3 | 0;
    var $17 = HEAP32[$pTemp + 160 >> 2];
    var $19 = HEAP32[$pTemp + 96 >> 2];
    var $21 = HEAP32[$pTemp + 32 >> 2];
    var $23 = $21 + $17 | 0;
    var $25 = ($23 + $19) * 9633 | 0;
    var $27 = ($19 + $17) * -20995 | 0;
    var $29 = $25 + $19 * -16069 | 0;
    var $31 = $25 + $23 * -3196 | 0;
    var $32 = $29 + $21 * -7373 | 0;
    var $35 = $27 + $17 * 16819 + $31 | 0;
    var $38 = $27 + $19 * 25172 + $29 | 0;
    var $40 = $31 + $21 * 4926 | 0;
    var $41 = $9 + $4 + 33685504 | 0;
    var $43 = $41 + $40 >> 18;
    if ($43 >>> 0 > 255) {
      __label__ = 3;
      break;
    } else {
      var $50 = $43;
      __label__ = 4;
      break;
    }
   case 3:
    var $50 = ($43 ^ -2147483648) >> 31 & 255;
    __label__ = 4;
    break;
   case 4:
    var $50;
    HEAP8[$pDst_ptr] = $50 & 255;
    var $53 = $41 - $40 >> 18;
    if ($53 >>> 0 > 255) {
      __label__ = 5;
      break;
    } else {
      var $60 = $53;
      __label__ = 6;
      break;
    }
   case 5:
    var $60 = ($53 ^ -2147483648) >> 31 & 255;
    __label__ = 6;
    break;
   case 6:
    var $60;
    HEAP8[$pDst_ptr + 56 | 0] = $60 & 255;
    var $63 = $14 + 33685504 | 0;
    var $65 = $63 + $38 >> 18;
    if ($65 >>> 0 > 255) {
      __label__ = 7;
      break;
    } else {
      var $72 = $65;
      __label__ = 8;
      break;
    }
   case 7:
    var $72 = ($65 ^ -2147483648) >> 31 & 255;
    __label__ = 8;
    break;
   case 8:
    var $72;
    HEAP8[$pDst_ptr + 8 | 0] = $72 & 255;
    var $76 = $63 - $38 >> 18;
    if ($76 >>> 0 > 255) {
      __label__ = 9;
      break;
    } else {
      var $83 = $76;
      __label__ = 10;
      break;
    }
   case 9:
    var $83 = ($76 ^ -2147483648) >> 31 & 255;
    __label__ = 10;
    break;
   case 10:
    var $83;
    HEAP8[$pDst_ptr + 48 | 0] = $83 & 255;
    var $86 = $15 + 33685504 | 0;
    var $88 = $86 + $35 >> 18;
    if ($88 >>> 0 > 255) {
      __label__ = 11;
      break;
    } else {
      var $95 = $88;
      __label__ = 12;
      break;
    }
   case 11:
    var $95 = ($88 ^ -2147483648) >> 31 & 255;
    __label__ = 12;
    break;
   case 12:
    var $95;
    HEAP8[$pDst_ptr + 16 | 0] = $95 & 255;
    var $99 = $86 - $35 >> 18;
    if ($99 >>> 0 > 255) {
      __label__ = 13;
      break;
    } else {
      var $106 = $99;
      __label__ = 14;
      break;
    }
   case 13:
    var $106 = ($99 ^ -2147483648) >> 31 & 255;
    __label__ = 14;
    break;
   case 14:
    var $106;
    HEAP8[$pDst_ptr + 40 | 0] = $106 & 255;
    var $109 = $13 + 33685504 | 0;
    var $111 = $109 + $32 >> 18;
    if ($111 >>> 0 > 255) {
      __label__ = 15;
      break;
    } else {
      var $118 = $111;
      __label__ = 16;
      break;
    }
   case 15:
    var $118 = ($111 ^ -2147483648) >> 31 & 255;
    __label__ = 16;
    break;
   case 16:
    var $118;
    HEAP8[$pDst_ptr + 24 | 0] = $118 & 255;
    var $122 = $109 - $32 >> 18;
    if ($122 >>> 0 > 255) {
      __label__ = 17;
      break;
    } else {
      var $129 = $122;
      __label__ = 18;
      break;
    }
   case 17:
    var $129 = ($122 ^ -2147483648) >> 31 & 255;
    __label__ = 18;
    break;
   case 18:
    var $129;
    HEAP8[$pDst_ptr + 32 | 0] = $129 & 255;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd3ColILi6EE4idctEPhPKi["X"] = 1;

function __ZN4jpgd3ColILi7EE4idctEPhPKi($pDst_ptr, $pTemp) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAP32[$pTemp + 64 >> 2];
    var $4 = HEAP32[$pTemp + 192 >> 2];
    var $6 = ($4 + $2) * 4433 | 0;
    var $8 = $6 + $4 * -15137 | 0;
    var $10 = $6 + $2 * 6270 | 0;
    var $11 = HEAP32[$pTemp >> 2];
    var $13 = HEAP32[$pTemp + 128 >> 2];
    var $15 = $13 + $11 << 13;
    var $17 = $11 - $13 << 13;
    var $19 = $15 - $10 | 0;
    var $20 = $17 + $8 | 0;
    var $21 = $17 - $8 | 0;
    var $23 = HEAP32[$pTemp + 160 >> 2];
    var $25 = HEAP32[$pTemp + 96 >> 2];
    var $27 = HEAP32[$pTemp + 32 >> 2];
    var $29 = $27 + $23 | 0;
    var $31 = ($29 + $25) * 9633 | 0;
    var $33 = ($25 + $23) * -20995 | 0;
    var $35 = $31 + $25 * -16069 | 0;
    var $37 = $31 + $29 * -3196 | 0;
    var $38 = $35 + $27 * -7373 | 0;
    var $41 = $33 + $23 * 16819 + $37 | 0;
    var $44 = $33 + $25 * 25172 + $35 | 0;
    var $46 = $37 + $27 * 4926 | 0;
    var $47 = $15 + $10 + 33685504 | 0;
    var $49 = $47 + $46 >> 18;
    if ($49 >>> 0 > 255) {
      __label__ = 3;
      break;
    } else {
      var $56 = $49;
      __label__ = 4;
      break;
    }
   case 3:
    var $56 = ($49 ^ -2147483648) >> 31 & 255;
    __label__ = 4;
    break;
   case 4:
    var $56;
    HEAP8[$pDst_ptr] = $56 & 255;
    var $59 = $47 - $46 >> 18;
    if ($59 >>> 0 > 255) {
      __label__ = 5;
      break;
    } else {
      var $66 = $59;
      __label__ = 6;
      break;
    }
   case 5:
    var $66 = ($59 ^ -2147483648) >> 31 & 255;
    __label__ = 6;
    break;
   case 6:
    var $66;
    HEAP8[$pDst_ptr + 56 | 0] = $66 & 255;
    var $69 = $20 + 33685504 | 0;
    var $71 = $69 + $44 >> 18;
    if ($71 >>> 0 > 255) {
      __label__ = 7;
      break;
    } else {
      var $78 = $71;
      __label__ = 8;
      break;
    }
   case 7:
    var $78 = ($71 ^ -2147483648) >> 31 & 255;
    __label__ = 8;
    break;
   case 8:
    var $78;
    HEAP8[$pDst_ptr + 8 | 0] = $78 & 255;
    var $82 = $69 - $44 >> 18;
    if ($82 >>> 0 > 255) {
      __label__ = 9;
      break;
    } else {
      var $89 = $82;
      __label__ = 10;
      break;
    }
   case 9:
    var $89 = ($82 ^ -2147483648) >> 31 & 255;
    __label__ = 10;
    break;
   case 10:
    var $89;
    HEAP8[$pDst_ptr + 48 | 0] = $89 & 255;
    var $92 = $21 + 33685504 | 0;
    var $94 = $92 + $41 >> 18;
    if ($94 >>> 0 > 255) {
      __label__ = 11;
      break;
    } else {
      var $101 = $94;
      __label__ = 12;
      break;
    }
   case 11:
    var $101 = ($94 ^ -2147483648) >> 31 & 255;
    __label__ = 12;
    break;
   case 12:
    var $101;
    HEAP8[$pDst_ptr + 16 | 0] = $101 & 255;
    var $105 = $92 - $41 >> 18;
    if ($105 >>> 0 > 255) {
      __label__ = 13;
      break;
    } else {
      var $112 = $105;
      __label__ = 14;
      break;
    }
   case 13:
    var $112 = ($105 ^ -2147483648) >> 31 & 255;
    __label__ = 14;
    break;
   case 14:
    var $112;
    HEAP8[$pDst_ptr + 40 | 0] = $112 & 255;
    var $115 = $19 + 33685504 | 0;
    var $117 = $115 + $38 >> 18;
    if ($117 >>> 0 > 255) {
      __label__ = 15;
      break;
    } else {
      var $124 = $117;
      __label__ = 16;
      break;
    }
   case 15:
    var $124 = ($117 ^ -2147483648) >> 31 & 255;
    __label__ = 16;
    break;
   case 16:
    var $124;
    HEAP8[$pDst_ptr + 24 | 0] = $124 & 255;
    var $128 = $115 - $38 >> 18;
    if ($128 >>> 0 > 255) {
      __label__ = 17;
      break;
    } else {
      var $135 = $128;
      __label__ = 18;
      break;
    }
   case 17:
    var $135 = ($128 ^ -2147483648) >> 31 & 255;
    __label__ = 18;
    break;
   case 18:
    var $135;
    HEAP8[$pDst_ptr + 32 | 0] = $135 & 255;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd3ColILi7EE4idctEPhPKi["X"] = 1;

function __ZN4jpgd3ColILi8EE4idctEPhPKi($pDst_ptr, $pTemp) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAP32[$pTemp + 64 >> 2];
    var $4 = HEAP32[$pTemp + 192 >> 2];
    var $6 = ($4 + $2) * 4433 | 0;
    var $8 = $6 + $4 * -15137 | 0;
    var $10 = $6 + $2 * 6270 | 0;
    var $11 = HEAP32[$pTemp >> 2];
    var $13 = HEAP32[$pTemp + 128 >> 2];
    var $15 = $13 + $11 << 13;
    var $17 = $11 - $13 << 13;
    var $19 = $15 - $10 | 0;
    var $20 = $17 + $8 | 0;
    var $21 = $17 - $8 | 0;
    var $23 = HEAP32[$pTemp + 224 >> 2];
    var $25 = HEAP32[$pTemp + 160 >> 2];
    var $27 = HEAP32[$pTemp + 96 >> 2];
    var $29 = HEAP32[$pTemp + 32 >> 2];
    var $32 = $27 + $23 | 0;
    var $33 = $29 + $25 | 0;
    var $35 = ($33 + $32) * 9633 | 0;
    var $36 = ($29 + $23) * -7373 | 0;
    var $37 = ($27 + $25) * -20995 | 0;
    var $39 = $35 + $32 * -16069 | 0;
    var $41 = $35 + $33 * -3196 | 0;
    var $44 = $36 + $23 * 2446 + $39 | 0;
    var $47 = $37 + $25 * 16819 + $41 | 0;
    var $50 = $37 + $27 * 25172 + $39 | 0;
    var $53 = $36 + $29 * 12299 + $41 | 0;
    var $54 = $15 + $10 + 33685504 | 0;
    var $56 = $54 + $53 >> 18;
    if ($56 >>> 0 > 255) {
      __label__ = 3;
      break;
    } else {
      var $63 = $56;
      __label__ = 4;
      break;
    }
   case 3:
    var $63 = ($56 ^ -2147483648) >> 31 & 255;
    __label__ = 4;
    break;
   case 4:
    var $63;
    HEAP8[$pDst_ptr] = $63 & 255;
    var $66 = $54 - $53 >> 18;
    if ($66 >>> 0 > 255) {
      __label__ = 5;
      break;
    } else {
      var $73 = $66;
      __label__ = 6;
      break;
    }
   case 5:
    var $73 = ($66 ^ -2147483648) >> 31 & 255;
    __label__ = 6;
    break;
   case 6:
    var $73;
    HEAP8[$pDst_ptr + 56 | 0] = $73 & 255;
    var $76 = $20 + 33685504 | 0;
    var $78 = $76 + $50 >> 18;
    if ($78 >>> 0 > 255) {
      __label__ = 7;
      break;
    } else {
      var $85 = $78;
      __label__ = 8;
      break;
    }
   case 7:
    var $85 = ($78 ^ -2147483648) >> 31 & 255;
    __label__ = 8;
    break;
   case 8:
    var $85;
    HEAP8[$pDst_ptr + 8 | 0] = $85 & 255;
    var $89 = $76 - $50 >> 18;
    if ($89 >>> 0 > 255) {
      __label__ = 9;
      break;
    } else {
      var $96 = $89;
      __label__ = 10;
      break;
    }
   case 9:
    var $96 = ($89 ^ -2147483648) >> 31 & 255;
    __label__ = 10;
    break;
   case 10:
    var $96;
    HEAP8[$pDst_ptr + 48 | 0] = $96 & 255;
    var $99 = $21 + 33685504 | 0;
    var $101 = $99 + $47 >> 18;
    if ($101 >>> 0 > 255) {
      __label__ = 11;
      break;
    } else {
      var $108 = $101;
      __label__ = 12;
      break;
    }
   case 11:
    var $108 = ($101 ^ -2147483648) >> 31 & 255;
    __label__ = 12;
    break;
   case 12:
    var $108;
    HEAP8[$pDst_ptr + 16 | 0] = $108 & 255;
    var $112 = $99 - $47 >> 18;
    if ($112 >>> 0 > 255) {
      __label__ = 13;
      break;
    } else {
      var $119 = $112;
      __label__ = 14;
      break;
    }
   case 13:
    var $119 = ($112 ^ -2147483648) >> 31 & 255;
    __label__ = 14;
    break;
   case 14:
    var $119;
    HEAP8[$pDst_ptr + 40 | 0] = $119 & 255;
    var $122 = $19 + 33685504 | 0;
    var $124 = $122 + $44 >> 18;
    if ($124 >>> 0 > 255) {
      __label__ = 15;
      break;
    } else {
      var $131 = $124;
      __label__ = 16;
      break;
    }
   case 15:
    var $131 = ($124 ^ -2147483648) >> 31 & 255;
    __label__ = 16;
    break;
   case 16:
    var $131;
    HEAP8[$pDst_ptr + 24 | 0] = $131 & 255;
    var $135 = $122 - $44 >> 18;
    if ($135 >>> 0 > 255) {
      __label__ = 17;
      break;
    } else {
      var $142 = $135;
      __label__ = 18;
      break;
    }
   case 17:
    var $142 = ($135 ^ -2147483648) >> 31 & 255;
    __label__ = 18;
    break;
   case 18:
    var $142;
    HEAP8[$pDst_ptr + 32 | 0] = $142 & 255;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd3ColILi8EE4idctEPhPKi["X"] = 1;

function __ZN4jpgd12jpeg_decoder10word_clearEPvtj($p) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $_01 = 64;
    var $pD_02 = $p;
    __label__ = 3;
    break;
   case 3:
    var $pD_02;
    var $_01;
    HEAP8[$pD_02] = -1;
    HEAP8[$pD_02 + 1 | 0] = -39;
    var $3 = $_01 - 1 | 0;
    if (($3 | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      var $_01 = $3;
      var $pD_02 = $pD_02 + 2 | 0;
      __label__ = 3;
      break;
    }
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd8idct_4x4EPKsPh($pSrc_ptr, $pDst_ptr) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 256;
  var $temp = __stackBase__;
  var $1 = $temp | 0;
  __ZN4jpgd3RowILi4EE4idctEPiPKs($1, $pSrc_ptr);
  var $2 = $pSrc_ptr + 16 | 0;
  var $3 = $temp + 32 | 0;
  __ZN4jpgd3RowILi4EE4idctEPiPKs($3, $2);
  var $4 = $pSrc_ptr + 32 | 0;
  var $5 = $temp + 64 | 0;
  __ZN4jpgd3RowILi4EE4idctEPiPKs($5, $4);
  var $6 = $pSrc_ptr + 48 | 0;
  var $7 = $temp + 96 | 0;
  __ZN4jpgd3RowILi4EE4idctEPiPKs($7, $6);
  __ZN4jpgd3ColILi4EE4idctEPhPKi($pDst_ptr, $1);
  var $8 = $temp + 4 | 0;
  var $9 = $pDst_ptr + 1 | 0;
  __ZN4jpgd3ColILi4EE4idctEPhPKi($9, $8);
  var $10 = $temp + 8 | 0;
  var $11 = $pDst_ptr + 2 | 0;
  __ZN4jpgd3ColILi4EE4idctEPhPKi($11, $10);
  var $12 = $temp + 12 | 0;
  var $13 = $pDst_ptr + 3 | 0;
  __ZN4jpgd3ColILi4EE4idctEPhPKi($13, $12);
  var $14 = $temp + 16 | 0;
  var $15 = $pDst_ptr + 4 | 0;
  __ZN4jpgd3ColILi4EE4idctEPhPKi($15, $14);
  var $16 = $temp + 20 | 0;
  var $17 = $pDst_ptr + 5 | 0;
  __ZN4jpgd3ColILi4EE4idctEPhPKi($17, $16);
  var $18 = $temp + 24 | 0;
  var $19 = $pDst_ptr + 6 | 0;
  __ZN4jpgd3ColILi4EE4idctEPhPKi($19, $18);
  var $20 = $temp + 28 | 0;
  var $21 = $pDst_ptr + 7 | 0;
  __ZN4jpgd3ColILi4EE4idctEPhPKi($21, $20);
  STACKTOP = __stackBase__;
  return;
}

function __ZN4jpgd12jpeg_decoder15free_all_blocksEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    HEAP32[$this + 52 >> 2] = 0;
    var $2 = $this + 40 | 0;
    var $3 = HEAP32[$2 >> 2];
    if (($3 | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      var $b_01 = $3;
      __label__ = 3;
      break;
    }
   case 3:
    var $b_01;
    var $6 = HEAP32[$b_01 >> 2];
    __ZN4jpgdL9jpgd_freeEPv($b_01);
    if (($6 | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      var $b_01 = $6;
      __label__ = 3;
      break;
    }
   case 4:
    HEAP32[$2 >> 2] = 0;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgdL9jpgd_freeEPv($p) {
  _free($p);
  return;
}

function __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, $status) {
  HEAP32[$this + 13296 >> 2] = $status;
  __ZN4jpgd12jpeg_decoder15free_all_blocksEv($this);
  var $2 = $this | 0;
  _longjmp($2, $status);
  return;
}

function __ZN4jpgdL11jpgd_mallocEj($nSize) {
  var $1 = _malloc($nSize);
  return $1;
}

function __ZN4jpgd12jpeg_decoder8get_bitsEi($this, $num_bits) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if (($num_bits | 0) == 0) {
      var $_0 = 0;
      __label__ = 7;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $3 = $this + 9084 | 0;
    var $4 = HEAPU32[$3 >> 2];
    var $6 = $4 >>> ((32 - $num_bits | 0) >>> 0);
    var $7 = $this + 9080 | 0;
    var $8 = HEAPU32[$7 >> 2];
    var $9 = $8 - $num_bits | 0;
    HEAP32[$7 >> 2] = $9;
    if (($9 | 0) < 1) {
      __label__ = 4;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 4:
    HEAP32[$3 >> 2] = $4 << $8;
    var $13 = __ZN4jpgd12jpeg_decoder8get_charEv($this);
    var $14 = __ZN4jpgd12jpeg_decoder8get_charEv($this);
    var $20 = HEAP32[$7 >> 2];
    var $22 = ($13 << 8 | $14 | HEAP32[$3 >> 2] & -65536) << -$20;
    HEAP32[$3 >> 2] = $22;
    var $23 = $20 + 16 | 0;
    HEAP32[$7 >> 2] = $23;
    if (($23 | 0) > -1) {
      var $_0 = $6;
      __label__ = 7;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    ___assert_func(STRING_TABLE.__str114 | 0, 446, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder8get_bitsEi | 0, STRING_TABLE.__str16130 | 0);
    var $_0 = $6;
    __label__ = 7;
    break;
   case 6:
    HEAP32[$3 >> 2] = $4 << $num_bits;
    var $_0 = $6;
    __label__ = 7;
    break;
   case 7:
    var $_0;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder11next_markerEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    __label__ = 3;
    break;
   case 3:
    var $1 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    if (($1 | 0) == 255) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 4:
    var $3 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    if (($3 | 0) == 0) {
      __label__ = 3;
      break;
    } else if (($3 | 0) == 255) {
      __label__ = 4;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    return $3;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder5allocEjb($this, $nSize, $zero) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = $nSize >>> 0 > 1 ? $nSize + 3 & -4 : 4;
    var $3 = $this + 40 | 0;
    var $b_0_in = $3;
    __label__ = 3;
    break;
   case 3:
    var $b_0_in;
    var $b_0 = HEAPU32[$b_0_in >> 2];
    if (($b_0 | 0) == 0) {
      __label__ = 6;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    var $7 = $b_0 + 4 | 0;
    var $8 = HEAPU32[$7 >> 2];
    var $9 = $8 + $2 | 0;
    if ($9 >>> 0 > HEAPU32[$b_0 + 8 >> 2] >>> 0) {
      var $b_0_in = $b_0 | 0;
      __label__ = 3;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    var $15 = $8 + ($b_0 + 12) | 0;
    HEAP32[$7 >> 2] = $9;
    if (($15 | 0) == 0) {
      __label__ = 6;
      break;
    } else {
      var $rv_1 = $15;
      __label__ = 9;
      break;
    }
   case 6:
    var $18 = $2 + 2047 & -2048;
    var $_ = $18 >>> 0 < 32512 ? 32512 : $18;
    var $20 = $_ | 16;
    var $21 = __ZN4jpgdL11jpgd_mallocEj($20);
    if (($21 | 0) == 0) {
      __label__ = 7;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 7:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -224);
    throw "Reached an unreachable!";
   case 8:
    var $25 = $21;
    var $26 = HEAP32[$3 >> 2];
    HEAP32[$21 >> 2] = $26;
    HEAP32[$3 >> 2] = $25;
    HEAP32[$21 + 4 >> 2] = $2;
    HEAP32[$21 + 8 >> 2] = $_;
    var $rv_1 = $21 + 12 | 0;
    __label__ = 9;
    break;
   case 9:
    var $rv_1;
    if ($zero) {
      __label__ = 10;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 10:
    _memset($rv_1, 0, $2, 1);
    __label__ = 11;
    break;
   case 11:
    return $rv_1;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder5allocEjb["X"] = 1;

function __ZN4jpgd12jpeg_decoder14prep_in_bufferEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this + 492 | 0;
    HEAP32[$1 >> 2] = 0;
    var $3 = $this + 488 | 0;
    HEAP32[$3 >> 2] = $this + 629 | 0;
    var $4 = $this + 500 | 0;
    if ((HEAP8[$4] & 1) << 24 >> 24 == 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 3:
    var $8 = $this + 52 | 0;
    var $10 = 0;
    __label__ = 4;
    break;
   case 4:
    var $10;
    var $11 = HEAP32[$8 >> 2];
    var $15 = HEAP32[HEAP32[$11 >> 2] + 8 >> 2];
    var $16 = $10 + ($this + 629) | 0;
    var $18 = FUNCTION_TABLE[$15]($11, $16, 8192 - $10 | 0, $4);
    if (($18 | 0) == -1) {
      __label__ = 5;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 5:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -225);
    throw "Reached an unreachable!";
   case 6:
    var $23 = HEAP32[$1 >> 2] + $18 | 0;
    HEAP32[$1 >> 2] = $23;
    if (($23 | 0) < 8192) {
      __label__ = 7;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 7:
    if ((HEAP8[$4] & 1) << 24 >> 24 == 0) {
      var $10 = $23;
      __label__ = 4;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 8:
    var $29 = $this + 13304 | 0;
    var $31 = HEAP32[$29 >> 2] + $23 | 0;
    HEAP32[$29 >> 2] = $31;
    var $33 = HEAP32[$3 >> 2] + $23 | 0;
    __ZN4jpgd12jpeg_decoder10word_clearEPvtj($33);
    __label__ = 9;
    break;
   case 9:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder15read_dht_markerEv($this) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 276;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $huff_num = __stackBase__;
    var $huff_val = __stackBase__ + 20;
    var $1 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    if ($1 >>> 0 < 2) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -254);
    throw "Reached an unreachable!";
   case 4:
    var $6 = $huff_num | 0;
    var $7 = $huff_val | 0;
    var $num_left_0 = $1 - 2 | 0;
    __label__ = 5;
    break;
   case 5:
    var $num_left_0;
    if (($num_left_0 | 0) == 0) {
      __label__ = 21;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    var $11 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    HEAP8[$6] = 0;
    var $count_01 = 0;
    var $i_02 = 1;
    __label__ = 7;
    break;
   case 7:
    var $i_02;
    var $count_01;
    var $13 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    HEAP8[$huff_num + $i_02 | 0] = $13 & 255;
    var $17 = ($13 & 255) + $count_01 | 0;
    var $18 = $i_02 + 1 | 0;
    if (($18 | 0) == 17) {
      __label__ = 8;
      break;
    } else {
      var $count_01 = $17;
      var $i_02 = $18;
      __label__ = 7;
      break;
    }
   case 8:
    if (($17 | 0) > 255) {
      __label__ = 10;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 9:
    if (($17 | 0) > 0) {
      var $i_13 = 0;
      __label__ = 11;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 10:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -256);
    throw "Reached an unreachable!";
   case 11:
    var $i_13;
    var $23 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    HEAP8[$huff_val + $i_13 | 0] = $23 & 255;
    var $26 = $i_13 + 1 | 0;
    if (($26 | 0) == ($17 | 0)) {
      __label__ = 12;
      break;
    } else {
      var $i_13 = $26;
      __label__ = 11;
      break;
    }
   case 12:
    var $27 = $17 + 17 | 0;
    if ($num_left_0 >>> 0 < $27 >>> 0) {
      __label__ = 13;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 13:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -254);
    throw "Reached an unreachable!";
   case 14:
    var $31 = $num_left_0 - $27 | 0;
    var $35 = ($11 >>> 2 & 4) + ($11 & 15) | 0;
    if (($35 | 0) > 7) {
      __label__ = 15;
      break;
    } else {
      __label__ = 16;
      break;
    }
   case 15:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -255);
    throw "Reached an unreachable!";
   case 16:
    var $39 = $this + 68 + ($35 << 2) | 0;
    if ((HEAP32[$39 >> 2] | 0) == 0) {
      __label__ = 17;
      break;
    } else {
      __label__ = 18;
      break;
    }
   case 17:
    var $43 = __ZN4jpgd12jpeg_decoder5allocEjb($this, 17, 0);
    HEAP32[$39 >> 2] = $43;
    __label__ = 18;
    break;
   case 18:
    var $45 = $this + 100 + ($35 << 2) | 0;
    if ((HEAP32[$45 >> 2] | 0) == 0) {
      __label__ = 19;
      break;
    } else {
      __label__ = 20;
      break;
    }
   case 19:
    var $49 = __ZN4jpgd12jpeg_decoder5allocEjb($this, 256, 0);
    HEAP32[$45 >> 2] = $49;
    __label__ = 20;
    break;
   case 20:
    HEAP8[$35 + ($this + 60) | 0] = $35 >>> 4 & 255 & 1;
    var $54 = HEAP32[$39 >> 2];
    for (var $$src = $6, $$dest = $54, $$stop = $$src + 17; $$src < $$stop; $$src++, $$dest++) {
      HEAP8[$$dest] = HEAP8[$$src];
    }
    var $55 = HEAP32[$45 >> 2];
    _memcpy($55, $7, 256, 1);
    var $num_left_0 = $31;
    __label__ = 5;
    break;
   case 21:
    STACKTOP = __stackBase__;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder15read_dht_markerEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder15read_dqt_markerEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    if ($1 >>> 0 < 2) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -253);
    throw "Reached an unreachable!";
   case 4:
    var $num_left_0 = $1 - 2 | 0;
    __label__ = 5;
    break;
   case 5:
    var $num_left_0;
    if (($num_left_0 | 0) == 0) {
      __label__ = 16;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    var $9 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    var $10 = $9 & 15;
    if ($10 >>> 0 > 3) {
      __label__ = 7;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 7:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -252);
    throw "Reached an unreachable!";
   case 8:
    var $14 = $this + 132 + ($10 << 2) | 0;
    if ((HEAP32[$14 >> 2] | 0) == 0) {
      __label__ = 9;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 9:
    var $18 = __ZN4jpgd12jpeg_decoder5allocEjb($this, 128, 0);
    HEAP32[$14 >> 2] = $18;
    __label__ = 10;
    break;
   case 10:
    var $20 = $9 >>> 0 < 16;
    var $i_01 = 0;
    __label__ = 11;
    break;
   case 11:
    var $i_01;
    var $22 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    if ($20) {
      var $temp_0 = $22;
      __label__ = 13;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 12:
    var $24 = $22 << 8;
    var $25 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    var $temp_0 = $25 + $24 | 0;
    __label__ = 13;
    break;
   case 13:
    var $temp_0;
    HEAP16[HEAP32[$14 >> 2] + ($i_01 << 1) >> 1] = $temp_0 & 65535;
    var $31 = $i_01 + 1 | 0;
    if (($31 | 0) == 64) {
      __label__ = 14;
      break;
    } else {
      var $i_01 = $31;
      __label__ = 11;
      break;
    }
   case 14:
    var $_ = $20 ? 65 : 129;
    var $34 = $num_left_0 - $_ | 0;
    if ($num_left_0 >>> 0 < $_ >>> 0) {
      __label__ = 15;
      break;
    } else {
      var $num_left_0 = $34;
      __label__ = 5;
      break;
    }
   case 15:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -237);
    throw "Reached an unreachable!";
   case 16:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder15read_sof_markerEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    var $2 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    if (($2 | 0) == 8) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -251);
    throw "Reached an unreachable!";
   case 4:
    var $6 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    HEAP32[$this + 48 >> 2] = $6;
    if (($6 - 1 | 0) >>> 0 > 16383) {
      __label__ = 5;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 5:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -250);
    throw "Reached an unreachable!";
   case 6:
    var $11 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    HEAP32[$this + 44 >> 2] = $11;
    if (($11 - 1 | 0) >>> 0 > 16383) {
      __label__ = 7;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 7:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -249);
    throw "Reached an unreachable!";
   case 8:
    var $16 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    var $17 = $this + 152 | 0;
    HEAP32[$17 >> 2] = $16;
    if (($16 | 0) > 4) {
      __label__ = 9;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 9:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -248);
    throw "Reached an unreachable!";
   case 10:
    if (($1 | 0) == ($16 * 3 + 8 | 0)) {
      __label__ = 11;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 11:
    if (($16 | 0) > 0) {
      var $i_03 = 0;
      __label__ = 13;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 12:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -247);
    throw "Reached an unreachable!";
   case 13:
    var $i_03;
    var $26 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    HEAP32[$this + 204 + ($i_03 << 2) >> 2] = $26;
    var $28 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 4);
    HEAP32[$this + 156 + ($i_03 << 2) >> 2] = $28;
    var $30 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 4);
    HEAP32[$this + 172 + ($i_03 << 2) >> 2] = $30;
    var $32 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    HEAP32[$this + 188 + ($i_03 << 2) >> 2] = $32;
    var $34 = $i_03 + 1 | 0;
    if (($34 | 0) < (HEAP32[$17 >> 2] | 0)) {
      var $i_03 = $34;
      __label__ = 13;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 14:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder15read_sof_markerEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder20skip_variable_markerEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    if ($1 >>> 0 < 2) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -246);
    throw "Reached an unreachable!";
   case 4:
    var $5 = $1 - 2 | 0;
    if (($5 | 0) == 0) {
      __label__ = 6;
      break;
    } else {
      var $num_left_01 = $5;
      __label__ = 5;
      break;
    }
   case 5:
    var $num_left_01;
    var $7 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    var $8 = $num_left_01 - 1 | 0;
    if (($8 | 0) == 0) {
      __label__ = 6;
      break;
    } else {
      var $num_left_01 = $8;
      __label__ = 5;
      break;
    }
   case 6:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder15read_dri_markerEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    if (($1 | 0) == 4) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -245);
    throw "Reached an unreachable!";
   case 4:
    var $5 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    HEAP32[$this + 9088 >> 2] = $5;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder15read_sos_markerEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    var $2 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    HEAP32[$this + 252 >> 2] = $2;
    var $4 = $1 - 3 | 0;
    if (($4 | 0) != (($2 << 1) + 3 | 0) | ($2 - 1 | 0) >>> 0 > 3) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $9 = $this + 152 | 0;
    var $num_left_0 = $4;
    var $i_0 = 0;
    __label__ = 5;
    break;
   case 4:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -244);
    throw "Reached an unreachable!";
   case 5:
    var $i_0;
    var $num_left_0;
    var $12 = ($i_0 | 0) < ($2 | 0);
    var $13 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    if ($12) {
      __label__ = 6;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 6:
    var $15 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    var $16 = $num_left_0 - 2 | 0;
    var $17 = HEAP32[$9 >> 2];
    var $ci_0 = 0;
    __label__ = 7;
    break;
   case 7:
    var $ci_0;
    if (($ci_0 | 0) < ($17 | 0)) {
      __label__ = 8;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 8:
    if (($13 | 0) == (HEAP32[$this + 204 + ($ci_0 << 2) >> 2] | 0)) {
      __label__ = 10;
      break;
    } else {
      var $ci_0 = $ci_0 + 1 | 0;
      __label__ = 7;
      break;
    }
   case 9:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -243);
    throw "Reached an unreachable!";
   case 10:
    HEAP32[$this + 256 + ($i_0 << 2) >> 2] = $ci_0;
    HEAP32[$this + 272 + ($ci_0 << 2) >> 2] = $15 >>> 4 & 15;
    HEAP32[$this + 288 + ($ci_0 << 2) >> 2] = ($15 & 15) + 4 | 0;
    var $num_left_0 = $16;
    var $i_0 = $i_0 + 1 | 0;
    __label__ = 5;
    break;
   case 11:
    var $36 = $this + 304 | 0;
    HEAP32[$36 >> 2] = $13;
    var $37 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    var $38 = $this + 308 | 0;
    HEAP32[$38 >> 2] = $37;
    var $39 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 4);
    HEAP32[$this + 316 >> 2] = $39;
    var $41 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 4);
    HEAP32[$this + 312 >> 2] = $41;
    if ((HEAP32[$this + 56 >> 2] | 0) == 0) {
      __label__ = 12;
      break;
    } else {
      __label__ = 13;
      break;
    }
   case 12:
    HEAP32[$36 >> 2] = 0;
    HEAP32[$38 >> 2] = 63;
    __label__ = 13;
    break;
   case 13:
    var $48 = $num_left_0 - 3 | 0;
    if (($48 | 0) == 0) {
      __label__ = 15;
      break;
    } else {
      var $num_left_13 = $48;
      __label__ = 14;
      break;
    }
   case 14:
    var $num_left_13;
    var $50 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    var $51 = $num_left_13 - 1 | 0;
    if (($51 | 0) == 0) {
      __label__ = 15;
      break;
    } else {
      var $num_left_13 = $51;
      __label__ = 14;
      break;
    }
   case 15:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder15read_sos_markerEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder15process_markersEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    __label__ = 3;
    break;
   case 3:
    var $1 = __ZN4jpgd12jpeg_decoder11next_markerEv($this);
    if (($1 | 0) == 192 || ($1 | 0) == 193 || ($1 | 0) == 194 || ($1 | 0) == 195 || ($1 | 0) == 197 || ($1 | 0) == 198 || ($1 | 0) == 199 || ($1 | 0) == 201 || ($1 | 0) == 202 || ($1 | 0) == 203 || ($1 | 0) == 205 || ($1 | 0) == 206 || ($1 | 0) == 207 || ($1 | 0) == 216 || ($1 | 0) == 217 || ($1 | 0) == 218) {
      __label__ = 4;
      break;
    } else if (($1 | 0) == 196) {
      __label__ = 5;
      break;
    } else if (($1 | 0) == 204) {
      __label__ = 6;
      break;
    } else if (($1 | 0) == 219) {
      __label__ = 7;
      break;
    } else if (($1 | 0) == 221) {
      __label__ = 8;
      break;
    } else if (($1 | 0) == 200 || ($1 | 0) == 208 || ($1 | 0) == 209 || ($1 | 0) == 210 || ($1 | 0) == 211 || ($1 | 0) == 212 || ($1 | 0) == 213 || ($1 | 0) == 214 || ($1 | 0) == 215 || ($1 | 0) == 1) {
      __label__ = 9;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 4:
    return $1;
   case 5:
    __ZN4jpgd12jpeg_decoder15read_dht_markerEv($this);
    __label__ = 3;
    break;
   case 6:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -241);
    throw "Reached an unreachable!";
   case 7:
    __ZN4jpgd12jpeg_decoder15read_dqt_markerEv($this);
    __label__ = 3;
    break;
   case 8:
    __ZN4jpgd12jpeg_decoder15read_dri_markerEv($this);
    __label__ = 3;
    break;
   case 9:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -240);
    throw "Reached an unreachable!";
   case 10:
    __ZN4jpgd12jpeg_decoder20skip_variable_markerEv($this);
    __label__ = 3;
    break;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder15create_look_upsEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $i_01 = 0;
    __label__ = 3;
    break;
   case 3:
    var $i_01;
    var $2 = $i_01 - 128 | 0;
    HEAP32[$this + 9192 + ($i_01 << 2) >> 2] = $2 * 91881 + 32768 >> 16;
    HEAP32[$this + 10216 + ($i_01 << 2) >> 2] = $2 * 116130 + 32768 >> 16;
    HEAP32[$this + 11240 + ($i_01 << 2) >> 2] = $2 * -46802 | 0;
    HEAP32[$this + 12264 + ($i_01 << 2) >> 2] = $2 * -22554 + 32768 | 0;
    var $16 = $i_01 + 1 | 0;
    if (($16 | 0) == 256) {
      __label__ = 4;
      break;
    } else {
      var $i_01 = $16;
      __label__ = 3;
      break;
    }
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder10stuff_charEh($this, $q) {
  var $1 = $this + 488 | 0;
  var $3 = HEAP32[$1 >> 2] - 1 | 0;
  HEAP32[$1 >> 2] = $3;
  HEAP8[$3] = $q;
  var $4 = $this + 492 | 0;
  var $6 = HEAP32[$4 >> 2] + 1 | 0;
  HEAP32[$4 >> 2] = $6;
  return;
}

function __ZN4jpgd12jpeg_decoder4initEPNS_19jpeg_decoder_streamE($this, $pStream) {
  HEAP32[$this + 40 >> 2] = 0;
  HEAP32[$this + 13296 >> 2] = 0;
  HEAP8[$this + 13300 | 0] = 0;
  HEAP32[$this + 48 >> 2] = 0;
  HEAP32[$this + 44 >> 2] = 0;
  HEAP32[$this + 52 >> 2] = $pStream;
  var $8 = $this + 9108 | 0;
  var $9 = $this + 629 | 0;
  var $10 = $this + 488 | 0;
  var $11 = $this + 56 | 0;
  for (var $$dest = $11 >> 2, $$stop = $$dest + 108; $$dest < $$stop; $$dest++) {
    HEAP32[$$dest] = 0;
  }
  var $12 = $8;
  HEAP32[$12 >> 2] = 0;
  HEAP32[$12 + 4 >> 2] = 0;
  HEAP32[$12 + 8 >> 2] = 0;
  HEAP8[$12 + 12] = 0;
  HEAP32[$10 >> 2] = $9;
  var $13 = $this + 492 | 0;
  var $14 = $this + 9088 | 0;
  var $15 = $this + 9124 | 0;
  HEAP32[$this + 9188 >> 2] = 0;
  HEAP32[$this + 13304 >> 2] = 0;
  HEAP32[$this + 13288 >> 2] = 0;
  HEAP32[$this + 13292 >> 2] = 0;
  var $20 = $13;
  for (var $$dest = $20 >> 2, $$stop = $$dest + 2146; $$dest < $$stop; $$dest++) {
    HEAP32[$$dest] = 0;
  }
  HEAP8[$20 + 8584] = 0;
  var $21 = $14;
  HEAP32[$21 >> 2] = 0;
  HEAP32[$21 + 4 >> 2] = 0;
  HEAP32[$21 + 8 >> 2] = 0;
  HEAP32[$21 + 12 >> 2] = 0;
  HEAP32[$21 + 16 >> 2] = 0;
  var $22 = $15;
  HEAP32[$22 >> 2] = 0;
  HEAP32[$22 + 4 >> 2] = 0;
  HEAP32[$22 + 8 >> 2] = 0;
  HEAP32[$22 + 12 >> 2] = 0;
  HEAP32[$22 + 16 >> 2] = 0;
  HEAP32[$22 + 20 >> 2] = 0;
  __ZN4jpgd12jpeg_decoder14prep_in_bufferEv($this);
  HEAP32[$this + 9080 >> 2] = 16;
  HEAP32[$this + 9084 >> 2] = 0;
  var $25 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
  var $26 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
  HEAP32[$this + 9148 >> 2] = 64;
  HEAP32[$this + 9152 >> 2] = 64;
  HEAP32[$this + 9156 >> 2] = 64;
  HEAP32[$this + 9160 >> 2] = 64;
  HEAP32[$this + 9164 >> 2] = 64;
  HEAP32[$this + 9168 >> 2] = 64;
  HEAP32[$this + 9172 >> 2] = 64;
  HEAP32[$this + 9176 >> 2] = 64;
  HEAP32[$this + 9180 >> 2] = 64;
  HEAP32[$this + 9184 >> 2] = 64;
  return;
}

__ZN4jpgd12jpeg_decoder4initEPNS_19jpeg_decoder_streamE["X"] = 1;

function __ZN4jpgd12jpeg_decoder13fix_in_bufferEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this + 9080 | 0;
    var $2 = HEAP32[$1 >> 2];
    if (($2 & 7 | 0) == 0) {
      var $7 = $2;
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    ___assert_func(STRING_TABLE.__str114 | 0, 1479, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder13fix_in_bufferEv | 0, STRING_TABLE.__str3117 | 0);
    var $7 = HEAP32[$1 >> 2];
    __label__ = 4;
    break;
   case 4:
    var $7;
    if (($7 | 0) == 16) {
      __label__ = 5;
      break;
    } else {
      var $14 = $7;
      __label__ = 6;
      break;
    }
   case 5:
    var $12 = HEAP32[$this + 9084 >> 2] & 255;
    __ZN4jpgd12jpeg_decoder10stuff_charEh($this, $12);
    var $14 = HEAP32[$1 >> 2];
    __label__ = 6;
    break;
   case 6:
    var $14;
    var $16 = $this + 9084 | 0;
    if (($14 | 0) > 7) {
      __label__ = 7;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 7:
    var $20 = HEAPU32[$16 >> 2] >>> 8 & 255;
    __ZN4jpgd12jpeg_decoder10stuff_charEh($this, $20);
    __label__ = 8;
    break;
   case 8:
    var $23 = HEAPU32[$16 >> 2] >>> 16 & 255;
    __ZN4jpgd12jpeg_decoder10stuff_charEh($this, $23);
    var $26 = HEAPU32[$16 >> 2] >>> 24 & 255;
    __ZN4jpgd12jpeg_decoder10stuff_charEh($this, $26);
    HEAP32[$1 >> 2] = 16;
    var $27 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, 16);
    var $28 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, 16);
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, $num_bits) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if (($num_bits | 0) == 0) {
      var $_0 = 0;
      __label__ = 12;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $3 = $this + 9084 | 0;
    var $4 = HEAPU32[$3 >> 2];
    var $6 = $4 >>> ((32 - $num_bits | 0) >>> 0);
    var $7 = $this + 9080 | 0;
    var $8 = HEAPU32[$7 >> 2];
    var $9 = $8 - $num_bits | 0;
    HEAP32[$7 >> 2] = $9;
    if (($9 | 0) < 1) {
      __label__ = 4;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 4:
    var $12 = $4 << $8;
    HEAP32[$3 >> 2] = $12;
    var $13 = $this + 492 | 0;
    var $14 = HEAPU32[$13 >> 2];
    if (($14 | 0) < 2) {
      __label__ = 7;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    var $17 = $this + 488 | 0;
    var $18 = HEAPU32[$17 >> 2];
    var $19 = HEAPU8[$18];
    var $20 = $19 & 255;
    if ($19 << 24 >> 24 == -1) {
      __label__ = 7;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    var $24 = HEAPU8[$18 + 1 | 0];
    if ($24 << 24 >> 24 == -1) {
      __label__ = 7;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 7:
    var $27 = __ZN4jpgd12jpeg_decoder9get_octetEv($this);
    var $28 = $27 & 255;
    var $29 = __ZN4jpgd12jpeg_decoder9get_octetEv($this);
    var $34 = $29 & 255 | HEAP32[$3 >> 2] | $28 << 8;
    HEAP32[$3 >> 2] = $34;
    var $44 = HEAP32[$7 >> 2];
    var $43 = $34;
    __label__ = 9;
    break;
   case 8:
    var $39 = $20 << 8 | $12 | $24 & 255;
    HEAP32[$3 >> 2] = $39;
    HEAP32[$13 >> 2] = $14 - 2 | 0;
    HEAP32[$17 >> 2] = $18 + 2 | 0;
    var $44 = $9;
    var $43 = $39;
    __label__ = 9;
    break;
   case 9:
    var $43;
    var $44;
    HEAP32[$3 >> 2] = $43 << -$44;
    var $47 = $44 + 16 | 0;
    HEAP32[$7 >> 2] = $47;
    if (($47 | 0) > -1) {
      var $_0 = $6;
      __label__ = 12;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 10:
    ___assert_func(STRING_TABLE.__str114 | 0, 483, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder19get_bits_no_markersEi | 0, STRING_TABLE.__str16130 | 0);
    var $_0 = $6;
    __label__ = 12;
    break;
   case 11:
    HEAP32[$3 >> 2] = $4 << $num_bits;
    var $_0 = $6;
    __label__ = 12;
    break;
   case 12:
    var $_0;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder19get_bits_no_markersEi["X"] = 1;

function __ZN4jpgd12jpeg_decoder13transform_mcuEi($this, $mcu_row) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this + 328 | 0;
    var $2 = HEAP32[$1 >> 2];
    if (($2 | 0) > 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 3:
    var $pSrc_ptr_01 = HEAP32[$this + 9144 >> 2];
    var $pDst_ptr_02 = HEAP32[$this + 9188 >> 2] + ($mcu_row << 6) * $2 | 0;
    var $mcu_block_03 = 0;
    __label__ = 4;
    break;
   case 4:
    var $mcu_block_03;
    var $pDst_ptr_02;
    var $pSrc_ptr_01;
    var $13 = HEAP32[$this + 9148 + ($mcu_block_03 << 2) >> 2];
    __ZN4jpgd4idctEPKsPhi($pSrc_ptr_01, $pDst_ptr_02, $13);
    var $16 = $mcu_block_03 + 1 | 0;
    if (($16 | 0) < (HEAP32[$1 >> 2] | 0)) {
      var $pSrc_ptr_01 = $pSrc_ptr_01 + 128 | 0;
      var $pDst_ptr_02 = $pDst_ptr_02 + 64 | 0;
      var $mcu_block_03 = $16;
      __label__ = 4;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder20transform_mcu_expandEi($this, $mcu_row) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 512;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $temp_block = __stackBase__;
    var $P = __stackBase__ + 128;
    var $Q = __stackBase__ + 192;
    var $R = __stackBase__ + 256;
    var $S = __stackBase__ + 320;
    var $a = __stackBase__ + 384;
    var $c = __stackBase__ + 448;
    var $2 = HEAP32[$this + 9144 >> 2];
    var $9 = HEAP32[$this + 9188 >> 2] + ($mcu_row << 6) * HEAP32[$this + 9108 >> 2] | 0;
    var $10 = $this + 9116 | 0;
    if ((HEAP32[$10 >> 2] | 0) > 0) {
      var $mcu_block_05 = 0;
      var $pDst_ptr_06 = $9;
      var $pSrc_ptr_07 = $2;
      __label__ = 4;
      break;
    } else {
      var $mcu_block_0_lcssa = 0;
      var $pDst_ptr_0_lcssa = $9;
      var $pSrc_ptr_0_lcssa = $2;
      __label__ = 3;
      break;
    }
   case 3:
    var $pSrc_ptr_0_lcssa;
    var $pDst_ptr_0_lcssa;
    var $mcu_block_0_lcssa;
    var $13 = $temp_block | 0;
    var $14 = $mcu_block_0_lcssa + 2 | 0;
    var $mcu_block_11 = $mcu_block_0_lcssa;
    var $pDst_ptr_12 = $pDst_ptr_0_lcssa;
    var $pSrc_ptr_13 = $pSrc_ptr_0_lcssa;
    __label__ = 5;
    break;
   case 4:
    var $pSrc_ptr_07;
    var $pDst_ptr_06;
    var $mcu_block_05;
    var $16 = HEAP32[$this + 9148 + ($mcu_block_05 << 2) >> 2];
    __ZN4jpgd4idctEPKsPhi($pSrc_ptr_07, $pDst_ptr_06, $16);
    var $17 = $pSrc_ptr_07 + 128 | 0;
    var $18 = $pDst_ptr_06 + 64 | 0;
    var $19 = $mcu_block_05 + 1 | 0;
    if (($19 | 0) < (HEAP32[$10 >> 2] | 0)) {
      var $mcu_block_05 = $19;
      var $pDst_ptr_06 = $18;
      var $pSrc_ptr_07 = $17;
      __label__ = 4;
      break;
    } else {
      var $mcu_block_0_lcssa = $19;
      var $pDst_ptr_0_lcssa = $18;
      var $pSrc_ptr_0_lcssa = $17;
      __label__ = 3;
      break;
    }
   case 5:
    var $pSrc_ptr_13;
    var $pDst_ptr_12;
    var $mcu_block_11;
    var $23 = $this + 9148 + ($mcu_block_11 << 2) | 0;
    var $24 = HEAP32[$23 >> 2];
    if (($24 | 0) > 0) {
      var $28 = $24;
      __label__ = 7;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    ___assert_func(STRING_TABLE.__str114 | 0, 1537, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder20transform_mcu_expandEi | 0, STRING_TABLE.__str4118 | 0);
    var $28 = HEAP32[$23 >> 2];
    __label__ = 7;
    break;
   case 7:
    var $28;
    if (($28 | 0) < 65) {
      var $32 = $28;
      __label__ = 9;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 8:
    ___assert_func(STRING_TABLE.__str114 | 0, 1538, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder20transform_mcu_expandEi | 0, STRING_TABLE.__str5119 | 0);
    var $32 = HEAP32[$23 >> 2];
    __label__ = 9;
    break;
   case 9:
    var $32;
    var $33 = $mcu_block_11 + 1 | 0;
    var $34 = $32 - 1 | 0;
    var $_ = ($34 | 0) > 0 ? $34 : 0;
    var $36 = STRING_TABLE.__ZN4jpgdL8s_max_rcE + $_ | 0;
    var $38 = HEAPU8[$36] & 255;
    if (($38 | 0) == 17) {
      __label__ = 10;
      break;
    } else if (($38 | 0) == 18) {
      __label__ = 11;
      break;
    } else if (($38 | 0) == 34) {
      __label__ = 12;
      break;
    } else if (($38 | 0) == 50) {
      __label__ = 13;
      break;
    } else if (($38 | 0) == 51) {
      __label__ = 14;
      break;
    } else if (($38 | 0) == 52) {
      __label__ = 15;
      break;
    } else if (($38 | 0) == 68) {
      __label__ = 16;
      break;
    } else if (($38 | 0) == 84) {
      __label__ = 17;
      break;
    } else if (($38 | 0) == 85) {
      __label__ = 18;
      break;
    } else if (($38 | 0) == 86) {
      __label__ = 19;
      break;
    } else if (($38 | 0) == 102) {
      __label__ = 20;
      break;
    } else if (($38 | 0) == 118) {
      __label__ = 21;
      break;
    } else if (($38 | 0) == 119) {
      __label__ = 22;
      break;
    } else if (($38 | 0) == 120) {
      __label__ = 23;
      break;
    } else if (($38 | 0) == 136) {
      __label__ = 24;
      break;
    } else {
      __label__ = 25;
      break;
    }
   case 10:
    var $pSrc_ptr_13_val = HEAP16[$pSrc_ptr_13 >> 1];
    __ZN4jpgd12DCT_Upsample3P_QILi1ELi1EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13_val);
    __ZN4jpgd12DCT_Upsample3R_SILi1ELi1EE4calcERNS0_8Matrix44ES4_PKs($R, $S);
    __label__ = 26;
    break;
   case 11:
    var $pSrc_ptr_13_val1 = HEAP16[$pSrc_ptr_13 >> 1];
    var $pSrc_ptr_13_idx = $pSrc_ptr_13 + 2 | 0;
    var $pSrc_ptr_13_idx_val = HEAP16[$pSrc_ptr_13_idx >> 1];
    __ZN4jpgd12DCT_Upsample3P_QILi1ELi2EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13_val1, $pSrc_ptr_13_idx_val);
    var $pSrc_ptr_13_idx2_val = HEAP16[$pSrc_ptr_13_idx >> 1];
    __ZN4jpgd12DCT_Upsample3R_SILi1ELi2EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13_idx2_val);
    __label__ = 26;
    break;
   case 12:
    __ZN4jpgd12DCT_Upsample3P_QILi2ELi2EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    var $pSrc_ptr_13_idx3_val = HEAP16[$pSrc_ptr_13 + 2 >> 1];
    var $pSrc_ptr_13_idx4_val = HEAP16[$pSrc_ptr_13 + 18 >> 1];
    __ZN4jpgd12DCT_Upsample3R_SILi2ELi2EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13_idx3_val, $pSrc_ptr_13_idx4_val);
    __label__ = 26;
    break;
   case 13:
    __ZN4jpgd12DCT_Upsample3P_QILi3ELi2EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    var $pSrc_ptr_13_idx5_val = HEAP16[$pSrc_ptr_13 + 2 >> 1];
    var $pSrc_ptr_13_idx6_val = HEAP16[$pSrc_ptr_13 + 18 >> 1];
    var $pSrc_ptr_13_idx7_val = HEAP16[$pSrc_ptr_13 + 34 >> 1];
    __ZN4jpgd12DCT_Upsample3R_SILi3ELi2EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13_idx5_val, $pSrc_ptr_13_idx6_val, $pSrc_ptr_13_idx7_val);
    __label__ = 26;
    break;
   case 14:
    __ZN4jpgd12DCT_Upsample3P_QILi3ELi3EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    __ZN4jpgd12DCT_Upsample3R_SILi3ELi3EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13);
    __label__ = 26;
    break;
   case 15:
    __ZN4jpgd12DCT_Upsample3P_QILi3ELi4EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    __ZN4jpgd12DCT_Upsample3R_SILi3ELi4EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13);
    __label__ = 26;
    break;
   case 16:
    __ZN4jpgd12DCT_Upsample3P_QILi4ELi4EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    __ZN4jpgd12DCT_Upsample3R_SILi4ELi4EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13);
    __label__ = 26;
    break;
   case 17:
    __ZN4jpgd12DCT_Upsample3P_QILi5ELi4EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    __ZN4jpgd12DCT_Upsample3R_SILi5ELi4EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13);
    __label__ = 26;
    break;
   case 18:
    __ZN4jpgd12DCT_Upsample3P_QILi5ELi5EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    __ZN4jpgd12DCT_Upsample3R_SILi5ELi5EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13);
    __label__ = 26;
    break;
   case 19:
    __ZN4jpgd12DCT_Upsample3P_QILi5ELi6EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    __ZN4jpgd12DCT_Upsample3R_SILi5ELi6EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13);
    __label__ = 26;
    break;
   case 20:
    __ZN4jpgd12DCT_Upsample3P_QILi6ELi6EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    __ZN4jpgd12DCT_Upsample3R_SILi6ELi6EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13);
    __label__ = 26;
    break;
   case 21:
    __ZN4jpgd12DCT_Upsample3P_QILi7ELi6EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    __ZN4jpgd12DCT_Upsample3R_SILi7ELi6EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13);
    __label__ = 26;
    break;
   case 22:
    __ZN4jpgd12DCT_Upsample3P_QILi7ELi7EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    __ZN4jpgd12DCT_Upsample3R_SILi7ELi7EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13);
    __label__ = 26;
    break;
   case 23:
    __ZN4jpgd12DCT_Upsample3P_QILi7ELi8EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    __ZN4jpgd12DCT_Upsample3R_SILi7ELi8EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13);
    __label__ = 26;
    break;
   case 24:
    __ZN4jpgd12DCT_Upsample3P_QILi8ELi8EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_ptr_13);
    __ZN4jpgd12DCT_Upsample3R_SILi8ELi8EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_ptr_13);
    __label__ = 26;
    break;
   case 25:
    ___assert_func(STRING_TABLE.__str114 | 0, 1605, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder20transform_mcu_expandEi | 0, STRING_TABLE.__str6120 | 0);
    __label__ = 26;
    break;
   case 26:
    __ZN4jpgd12DCT_UpsampleplERKNS0_8Matrix44ES3_($a, $P, $Q);
    __ZN4jpgd12DCT_Upsample8Matrix44mIERKS1_($P, $Q);
    __ZN4jpgd12DCT_UpsampleplERKNS0_8Matrix44ES3_($c, $R, $S);
    __ZN4jpgd12DCT_Upsample8Matrix44mIERKS1_($R, $S);
    __ZN4jpgd12DCT_Upsample8Matrix4413add_and_storeEPsRKS1_S4_($13, $a, $c);
    __ZN4jpgd8idct_4x4EPKsPh($13, $pDst_ptr_12);
    var $56 = $pDst_ptr_12 + 64 | 0;
    __ZN4jpgd12DCT_Upsample8Matrix4413sub_and_storeEPsRKS1_S4_($13, $a, $c);
    __ZN4jpgd8idct_4x4EPKsPh($13, $56);
    var $57 = $pDst_ptr_12 + 128 | 0;
    __ZN4jpgd12DCT_Upsample8Matrix4413add_and_storeEPsRKS1_S4_($13, $P, $R);
    __ZN4jpgd8idct_4x4EPKsPh($13, $57);
    var $58 = $pDst_ptr_12 + 192 | 0;
    __ZN4jpgd12DCT_Upsample8Matrix4413sub_and_storeEPsRKS1_S4_($13, $P, $R);
    __ZN4jpgd8idct_4x4EPKsPh($13, $58);
    if (($33 | 0) == ($14 | 0)) {
      __label__ = 27;
      break;
    } else {
      var $mcu_block_11 = $33;
      var $pDst_ptr_12 = $pDst_ptr_12 + 256 | 0;
      var $pSrc_ptr_13 = $pSrc_ptr_13 + 128 | 0;
      __label__ = 5;
      break;
    }
   case 27:
    STACKTOP = __stackBase__;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder20transform_mcu_expandEi["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi1ELi1EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_val) {
  var $1 = $pSrc_val << 16 >> 16;
  var $2 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$2 >> 2] = $1;
  var $3 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$3 >> 2] = 0;
  var $4 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$4 >> 2] = 0;
  var $5 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$5 >> 2] = 0;
  var $6 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$6 >> 2] = 0;
  var $7 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$7 >> 2] = 0;
  var $8 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$8 >> 2] = 0;
  var $9 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$9 >> 2] = 0;
  var $10 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$10 >> 2] = 0;
  var $11 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$11 >> 2] = 0;
  var $12 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$12 >> 2] = 0;
  var $13 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$13 >> 2] = 0;
  var $14 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$14 >> 2] = 0;
  var $15 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$15 >> 2] = 0;
  var $16 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$16 >> 2] = 0;
  var $17 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$17 >> 2] = 0;
  var $18 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$18 >> 2] = 0;
  var $19 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$19 >> 2] = 0;
  var $20 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$20 >> 2] = 0;
  var $21 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$21 >> 2] = 0;
  var $22 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$22 >> 2] = 0;
  var $23 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$23 >> 2] = 0;
  var $24 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$24 >> 2] = 0;
  var $25 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$25 >> 2] = 0;
  var $26 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$26 >> 2] = 0;
  var $27 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$27 >> 2] = 0;
  var $28 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$28 >> 2] = 0;
  var $29 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$29 >> 2] = 0;
  var $30 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$30 >> 2] = 0;
  var $31 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$31 >> 2] = 0;
  var $32 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$32 >> 2] = 0;
  var $33 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$33 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi1ELi1EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi1ELi1EE4calcERNS0_8Matrix44ES4_PKs($R, $S) {
  var $1 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$1 >> 2] = 0;
  var $2 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$2 >> 2] = 0;
  var $3 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$3 >> 2] = 0;
  var $4 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$4 >> 2] = 0;
  var $5 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$5 >> 2] = 0;
  var $6 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$6 >> 2] = 0;
  var $7 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$7 >> 2] = 0;
  var $8 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$8 >> 2] = 0;
  var $9 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$9 >> 2] = 0;
  var $10 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$10 >> 2] = 0;
  var $11 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$11 >> 2] = 0;
  var $12 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$12 >> 2] = 0;
  var $13 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$13 >> 2] = 0;
  var $14 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$14 >> 2] = 0;
  var $15 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$15 >> 2] = 0;
  var $16 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$16 >> 2] = 0;
  var $17 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$17 >> 2] = 0;
  var $18 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$18 >> 2] = 0;
  var $19 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$19 >> 2] = 0;
  var $20 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$20 >> 2] = 0;
  var $21 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$21 >> 2] = 0;
  var $22 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$22 >> 2] = 0;
  var $23 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$23 >> 2] = 0;
  var $24 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$24 >> 2] = 0;
  var $25 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$25 >> 2] = 0;
  var $26 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$26 >> 2] = 0;
  var $27 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$27 >> 2] = 0;
  var $28 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$28 >> 2] = 0;
  var $29 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$29 >> 2] = 0;
  var $30 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$30 >> 2] = 0;
  var $31 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$31 >> 2] = 0;
  var $32 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$32 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi1ELi1EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi1ELi2EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc_val, $pSrc_1_val) {
  var $1 = $pSrc_val << 16 >> 16;
  var $2 = $pSrc_1_val << 16 >> 16;
  var $5 = $2 * 426 + 512 >> 10;
  var $8 = $2 * 23 + 512 >> 10;
  var $9 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$9 >> 2] = $1;
  var $10 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$10 >> 2] = 0;
  var $11 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$11 >> 2] = 0;
  var $12 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$12 >> 2] = 0;
  var $13 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$13 >> 2] = $5;
  var $14 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$14 >> 2] = 0;
  var $15 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$15 >> 2] = 0;
  var $16 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$16 >> 2] = 0;
  var $17 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$17 >> 2] = 0;
  var $18 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$18 >> 2] = 0;
  var $19 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$19 >> 2] = 0;
  var $20 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$20 >> 2] = 0;
  var $21 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$21 >> 2] = $8;
  var $22 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$22 >> 2] = 0;
  var $23 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$23 >> 2] = 0;
  var $24 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$24 >> 2] = 0;
  var $25 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$25 >> 2] = 0;
  var $26 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$26 >> 2] = 0;
  var $27 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$27 >> 2] = 0;
  var $28 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$28 >> 2] = 0;
  var $29 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$29 >> 2] = 0;
  var $30 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$30 >> 2] = 0;
  var $31 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$31 >> 2] = 0;
  var $32 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$32 >> 2] = 0;
  var $33 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$33 >> 2] = 0;
  var $34 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$34 >> 2] = 0;
  var $35 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$35 >> 2] = 0;
  var $36 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$36 >> 2] = 0;
  var $37 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$37 >> 2] = 0;
  var $38 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$38 >> 2] = 0;
  var $39 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$39 >> 2] = 0;
  var $40 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$40 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi1ELi2EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi1ELi2EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_1_val) {
  var $1 = $pSrc_1_val << 16 >> 16;
  var $4 = $1 * 928 + 512 >> 10;
  var $7 = $1 * -75 + 512 >> 10;
  var $8 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$8 >> 2] = $4;
  var $9 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$9 >> 2] = 0;
  var $10 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$10 >> 2] = 0;
  var $11 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$11 >> 2] = 0;
  var $12 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$12 >> 2] = 0;
  var $13 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$13 >> 2] = 0;
  var $14 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$14 >> 2] = 0;
  var $15 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$15 >> 2] = 0;
  var $16 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$16 >> 2] = $7;
  var $17 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$17 >> 2] = 0;
  var $18 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$18 >> 2] = 0;
  var $19 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$19 >> 2] = 0;
  var $20 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$20 >> 2] = 0;
  var $21 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$21 >> 2] = 0;
  var $22 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$22 >> 2] = 0;
  var $23 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$23 >> 2] = 0;
  var $24 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$24 >> 2] = 0;
  var $25 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$25 >> 2] = 0;
  var $26 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$26 >> 2] = 0;
  var $27 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$27 >> 2] = 0;
  var $28 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$28 >> 2] = 0;
  var $29 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$29 >> 2] = 0;
  var $30 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$30 >> 2] = 0;
  var $31 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$31 >> 2] = 0;
  var $32 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$32 >> 2] = 0;
  var $33 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$33 >> 2] = 0;
  var $34 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$34 >> 2] = 0;
  var $35 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$35 >> 2] = 0;
  var $36 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$36 >> 2] = 0;
  var $37 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$37 >> 2] = 0;
  var $38 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$38 >> 2] = 0;
  var $39 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$39 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi1ELi2EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12jpeg_decoder17locate_soi_markerEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    var $2 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    if (($1 | 0) == 255 & ($2 | 0) == 216) {
      __label__ = 11;
      break;
    } else {
      var $bytesleft_0 = 4095;
      var $thischar_0 = $2;
      __label__ = 3;
      break;
    }
   case 3:
    var $thischar_0;
    var $bytesleft_0;
    if (($bytesleft_0 | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 4:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -239);
    throw "Reached an unreachable!";
   case 5:
    var $8 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 8);
    if (($thischar_0 | 0) == 255) {
      __label__ = 7;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    var $bytesleft_0 = $bytesleft_0 - 1 | 0;
    var $thischar_0 = $8;
    __label__ = 3;
    break;
   case 7:
    if (($8 | 0) == 217) {
      __label__ = 8;
      break;
    } else if (($8 | 0) == 216) {
      __label__ = 9;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 8:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -239);
    throw "Reached an unreachable!";
   case 9:
    if ((HEAP32[$this + 9084 >> 2] & -16777216 | 0) == -16777216) {
      __label__ = 11;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 10:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -239);
    throw "Reached an unreachable!";
   case 11:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder17locate_sof_markerEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    __ZN4jpgd12jpeg_decoder17locate_soi_markerEv($this);
    var $1 = __ZN4jpgd12jpeg_decoder15process_markersEv($this);
    if (($1 | 0) == 194) {
      __label__ = 3;
      break;
    } else if (($1 | 0) == 192 || ($1 | 0) == 193) {
      __label__ = 4;
      break;
    } else if (($1 | 0) == 201) {
      __label__ = 5;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 3:
    HEAP32[$this + 56 >> 2] = 1;
    __label__ = 4;
    break;
   case 4:
    __ZN4jpgd12jpeg_decoder15read_sof_markerEv($this);
    return;
   case 5:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -241);
    throw "Reached an unreachable!";
   case 6:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -238);
    throw "Reached an unreachable!";
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder17locate_sos_markerEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = __ZN4jpgd12jpeg_decoder15process_markersEv($this);
    if (($1 | 0) == 218) {
      __label__ = 4;
      break;
    } else if (($1 | 0) == 217) {
      var $_0 = 0;
      __label__ = 5;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -240);
    throw "Reached an unreachable!";
   case 4:
    __ZN4jpgd12jpeg_decoder15read_sos_markerEv($this);
    var $_0 = 1;
    __label__ = 5;
    break;
   case 5:
    var $_0;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12DCT_Upsample3P_QILi2ELi2EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $11 = $8 * 426 + 512 >> 10;
  var $14 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $17 = $14 * 426 + 512 >> 10;
  var $20 = $8 * 23 + 512 >> 10;
  var $23 = $14 * 23 + 512 >> 10;
  var $24 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$24 >> 2] = $2;
  var $27 = $5 * 426 + 512 >> 10;
  var $28 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$28 >> 2] = $27;
  var $29 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$29 >> 2] = 0;
  var $32 = $5 * 23 + 512 >> 10;
  var $33 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$33 >> 2] = $32;
  var $34 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$34 >> 2] = $11;
  var $37 = $17 * 426 + 512 >> 10;
  var $38 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$38 >> 2] = $37;
  var $39 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$39 >> 2] = 0;
  var $42 = $17 * 23 + 512 >> 10;
  var $43 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$43 >> 2] = $42;
  var $44 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$44 >> 2] = 0;
  var $45 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$45 >> 2] = 0;
  var $46 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$46 >> 2] = 0;
  var $47 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$47 >> 2] = 0;
  var $48 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$48 >> 2] = $20;
  var $51 = $23 * 426 + 512 >> 10;
  var $52 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$52 >> 2] = $51;
  var $53 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$53 >> 2] = 0;
  var $56 = $23 * 23 + 512 >> 10;
  var $57 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$57 >> 2] = $56;
  var $60 = $5 * 928 + 512 >> 10;
  var $61 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$61 >> 2] = $60;
  var $62 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$62 >> 2] = 0;
  var $65 = $5 * -75 + 512 >> 10;
  var $66 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$66 >> 2] = $65;
  var $67 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$67 >> 2] = 0;
  var $70 = $17 * 928 + 512 >> 10;
  var $71 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$71 >> 2] = $70;
  var $72 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$72 >> 2] = 0;
  var $75 = $17 * -75 + 512 >> 10;
  var $76 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$76 >> 2] = $75;
  var $77 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$77 >> 2] = 0;
  var $78 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$78 >> 2] = 0;
  var $79 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$79 >> 2] = 0;
  var $80 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$80 >> 2] = 0;
  var $81 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$81 >> 2] = 0;
  var $84 = $23 * 928 + 512 >> 10;
  var $85 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$85 >> 2] = $84;
  var $86 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$86 >> 2] = 0;
  var $89 = $23 * -75 + 512 >> 10;
  var $90 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$90 >> 2] = $89;
  var $91 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$91 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi2ELi2EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi2ELi2EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_1_val, $pSrc_9_val) {
  var $1 = $pSrc_1_val << 16 >> 16;
  var $4 = $1 * 928 + 512 >> 10;
  var $5 = $pSrc_9_val << 16 >> 16;
  var $8 = $5 * 928 + 512 >> 10;
  var $11 = $1 * -75 + 512 >> 10;
  var $14 = $5 * -75 + 512 >> 10;
  var $15 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$15 >> 2] = $4;
  var $18 = $8 * 426 + 512 >> 10;
  var $19 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$19 >> 2] = $18;
  var $20 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$20 >> 2] = 0;
  var $23 = $8 * 23 + 512 >> 10;
  var $24 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$24 >> 2] = $23;
  var $25 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$25 >> 2] = 0;
  var $26 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$26 >> 2] = 0;
  var $27 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$27 >> 2] = 0;
  var $28 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$28 >> 2] = 0;
  var $29 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$29 >> 2] = $11;
  var $32 = $14 * 426 + 512 >> 10;
  var $33 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$33 >> 2] = $32;
  var $34 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$34 >> 2] = 0;
  var $37 = $14 * 23 + 512 >> 10;
  var $38 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$38 >> 2] = $37;
  var $39 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$39 >> 2] = 0;
  var $40 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$40 >> 2] = 0;
  var $41 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$41 >> 2] = 0;
  var $42 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$42 >> 2] = 0;
  var $45 = $8 * 928 + 512 >> 10;
  var $46 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$46 >> 2] = $45;
  var $47 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$47 >> 2] = 0;
  var $50 = $8 * -75 + 512 >> 10;
  var $51 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$51 >> 2] = $50;
  var $52 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$52 >> 2] = 0;
  var $53 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$53 >> 2] = 0;
  var $54 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$54 >> 2] = 0;
  var $55 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$55 >> 2] = 0;
  var $56 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$56 >> 2] = 0;
  var $59 = $14 * 928 + 512 >> 10;
  var $60 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$60 >> 2] = $59;
  var $61 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$61 >> 2] = 0;
  var $64 = $14 * -75 + 512 >> 10;
  var $65 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$65 >> 2] = $64;
  var $66 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$66 >> 2] = 0;
  var $67 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$67 >> 2] = 0;
  var $68 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$68 >> 2] = 0;
  var $69 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$69 >> 2] = 0;
  var $70 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$70 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi2ELi2EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi3ELi2EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $14 = $11 * 426 + 512 >> 10;
  var $17 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $20 = $17 * 426 + 512 >> 10;
  var $23 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $26 = $23 * 426 + 512 >> 10;
  var $29 = $11 * 23 + 512 >> 10;
  var $32 = $17 * 23 + 512 >> 10;
  var $35 = $23 * 23 + 512 >> 10;
  var $36 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$36 >> 2] = $2;
  var $39 = $5 * 426 + 512 >> 10;
  var $40 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$40 >> 2] = $39;
  var $41 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$41 >> 2] = 0;
  var $44 = $5 * 23 + 512 >> 10;
  var $45 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$45 >> 2] = $44;
  var $46 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$46 >> 2] = $14;
  var $49 = $20 * 426 + 512 >> 10;
  var $50 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$50 >> 2] = $49;
  var $51 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$51 >> 2] = 0;
  var $54 = $20 * 23 + 512 >> 10;
  var $55 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$55 >> 2] = $54;
  var $56 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$56 >> 2] = 0;
  var $57 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$57 >> 2] = 0;
  var $58 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$58 >> 2] = 0;
  var $59 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$59 >> 2] = 0;
  var $60 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$60 >> 2] = $29;
  var $63 = $32 * 426 + 512 >> 10;
  var $64 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$64 >> 2] = $63;
  var $65 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$65 >> 2] = 0;
  var $68 = $32 * 23 + 512 >> 10;
  var $69 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$69 >> 2] = $68;
  var $72 = $5 * 928 + 512 >> 10;
  var $73 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$73 >> 2] = $72;
  var $74 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$74 >> 2] = $8;
  var $77 = $5 * -75 + 512 >> 10;
  var $78 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$78 >> 2] = $77;
  var $79 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$79 >> 2] = 0;
  var $82 = $20 * 928 + 512 >> 10;
  var $83 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$83 >> 2] = $82;
  var $84 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$84 >> 2] = $26;
  var $87 = $20 * -75 + 512 >> 10;
  var $88 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$88 >> 2] = $87;
  var $89 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$89 >> 2] = 0;
  var $90 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$90 >> 2] = 0;
  var $91 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$91 >> 2] = 0;
  var $92 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$92 >> 2] = 0;
  var $93 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$93 >> 2] = 0;
  var $96 = $32 * 928 + 512 >> 10;
  var $97 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$97 >> 2] = $96;
  var $98 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$98 >> 2] = $35;
  var $101 = $32 * -75 + 512 >> 10;
  var $102 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$102 >> 2] = $101;
  var $103 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$103 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi3ELi2EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi3ELi2EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc_1_val, $pSrc_9_val, $pSrc_17_val) {
  var $1 = $pSrc_1_val << 16 >> 16;
  var $4 = $1 * 928 + 512 >> 10;
  var $5 = $pSrc_9_val << 16 >> 16;
  var $8 = $5 * 928 + 512 >> 10;
  var $9 = $pSrc_17_val << 16 >> 16;
  var $12 = $9 * 928 + 512 >> 10;
  var $15 = $1 * -75 + 512 >> 10;
  var $18 = $5 * -75 + 512 >> 10;
  var $21 = $9 * -75 + 512 >> 10;
  var $22 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$22 >> 2] = $4;
  var $25 = $8 * 426 + 512 >> 10;
  var $26 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$26 >> 2] = $25;
  var $27 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$27 >> 2] = 0;
  var $30 = $8 * 23 + 512 >> 10;
  var $31 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$31 >> 2] = $30;
  var $32 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$32 >> 2] = 0;
  var $33 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$33 >> 2] = 0;
  var $34 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$34 >> 2] = 0;
  var $35 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$35 >> 2] = 0;
  var $36 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$36 >> 2] = $15;
  var $39 = $18 * 426 + 512 >> 10;
  var $40 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$40 >> 2] = $39;
  var $41 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$41 >> 2] = 0;
  var $44 = $18 * 23 + 512 >> 10;
  var $45 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$45 >> 2] = $44;
  var $46 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$46 >> 2] = 0;
  var $47 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$47 >> 2] = 0;
  var $48 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$48 >> 2] = 0;
  var $49 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$49 >> 2] = 0;
  var $52 = $8 * 928 + 512 >> 10;
  var $53 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$53 >> 2] = $52;
  var $54 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$54 >> 2] = $12;
  var $57 = $8 * -75 + 512 >> 10;
  var $58 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$58 >> 2] = $57;
  var $59 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$59 >> 2] = 0;
  var $60 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$60 >> 2] = 0;
  var $61 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$61 >> 2] = 0;
  var $62 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$62 >> 2] = 0;
  var $63 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$63 >> 2] = 0;
  var $66 = $18 * 928 + 512 >> 10;
  var $67 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$67 >> 2] = $66;
  var $68 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$68 >> 2] = $21;
  var $71 = $18 * -75 + 512 >> 10;
  var $72 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$72 >> 2] = $71;
  var $73 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$73 >> 2] = 0;
  var $74 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$74 >> 2] = 0;
  var $75 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$75 >> 2] = 0;
  var $76 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$76 >> 2] = 0;
  var $77 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$77 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi3ELi2EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi3ELi3EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $14 = $11 * 426 + 512 >> 10;
  var $17 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $20 = $17 * 426 + 512 >> 10;
  var $23 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $26 = $23 * 426 + 512 >> 10;
  var $29 = $11 * 23 + 512 >> 10;
  var $32 = $17 * 23 + 512 >> 10;
  var $35 = $23 * 23 + 512 >> 10;
  var $36 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$36 >> 2] = $2;
  var $39 = $5 * 426 + 512 >> 10;
  var $40 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$40 >> 2] = $39;
  var $41 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$41 >> 2] = 0;
  var $44 = $5 * 23 + 512 >> 10;
  var $45 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$45 >> 2] = $44;
  var $46 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$46 >> 2] = $14;
  var $49 = $20 * 426 + 512 >> 10;
  var $50 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$50 >> 2] = $49;
  var $51 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$51 >> 2] = 0;
  var $54 = $20 * 23 + 512 >> 10;
  var $55 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$55 >> 2] = $54;
  var $56 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$56 >> 2] = 0;
  var $57 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$57 >> 2] = 0;
  var $58 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$58 >> 2] = 0;
  var $59 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$59 >> 2] = 0;
  var $60 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$60 >> 2] = $29;
  var $63 = $32 * 426 + 512 >> 10;
  var $64 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$64 >> 2] = $63;
  var $65 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$65 >> 2] = 0;
  var $68 = $32 * 23 + 512 >> 10;
  var $69 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$69 >> 2] = $68;
  var $72 = $5 * 928 + 512 >> 10;
  var $73 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$73 >> 2] = $72;
  var $74 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$74 >> 2] = $8;
  var $77 = $5 * -75 + 512 >> 10;
  var $78 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$78 >> 2] = $77;
  var $79 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$79 >> 2] = 0;
  var $82 = $20 * 928 + 512 >> 10;
  var $83 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$83 >> 2] = $82;
  var $84 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$84 >> 2] = $26;
  var $87 = $20 * -75 + 512 >> 10;
  var $88 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$88 >> 2] = $87;
  var $89 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$89 >> 2] = 0;
  var $90 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$90 >> 2] = 0;
  var $91 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$91 >> 2] = 0;
  var $92 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$92 >> 2] = 0;
  var $93 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$93 >> 2] = 0;
  var $96 = $32 * 928 + 512 >> 10;
  var $97 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$97 >> 2] = $96;
  var $98 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$98 >> 2] = $35;
  var $101 = $32 * -75 + 512 >> 10;
  var $102 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$102 >> 2] = $101;
  var $103 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$103 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi3ELi3EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi3ELi3EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc) {
  var $3 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $6 = $3 * 928 + 512 >> 10;
  var $9 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $12 = $9 * 928 + 512 >> 10;
  var $15 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $18 = $15 * 928 + 512 >> 10;
  var $21 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $24 = HEAP16[$pSrc + 20 >> 1] << 16 >> 16;
  var $27 = HEAP16[$pSrc + 36 >> 1] << 16 >> 16;
  var $30 = $3 * -75 + 512 >> 10;
  var $33 = $9 * -75 + 512 >> 10;
  var $36 = $15 * -75 + 512 >> 10;
  var $37 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$37 >> 2] = $6;
  var $40 = $12 * 426 + 512 >> 10;
  var $41 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$41 >> 2] = $40;
  var $42 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$42 >> 2] = 0;
  var $45 = $12 * 23 + 512 >> 10;
  var $46 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$46 >> 2] = $45;
  var $47 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$47 >> 2] = $21;
  var $50 = $24 * 426 + 512 >> 10;
  var $51 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$51 >> 2] = $50;
  var $52 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$52 >> 2] = 0;
  var $55 = $24 * 23 + 512 >> 10;
  var $56 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$56 >> 2] = $55;
  var $57 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$57 >> 2] = $30;
  var $60 = $33 * 426 + 512 >> 10;
  var $61 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$61 >> 2] = $60;
  var $62 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$62 >> 2] = 0;
  var $65 = $33 * 23 + 512 >> 10;
  var $66 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$66 >> 2] = $65;
  var $67 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$67 >> 2] = 0;
  var $68 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$68 >> 2] = 0;
  var $69 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$69 >> 2] = 0;
  var $70 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$70 >> 2] = 0;
  var $73 = $12 * 928 + 512 >> 10;
  var $74 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$74 >> 2] = $73;
  var $75 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$75 >> 2] = $18;
  var $78 = $12 * -75 + 512 >> 10;
  var $79 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$79 >> 2] = $78;
  var $80 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$80 >> 2] = 0;
  var $83 = $24 * 928 + 512 >> 10;
  var $84 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$84 >> 2] = $83;
  var $85 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$85 >> 2] = $27;
  var $88 = $24 * -75 + 512 >> 10;
  var $89 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$89 >> 2] = $88;
  var $90 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$90 >> 2] = 0;
  var $93 = $33 * 928 + 512 >> 10;
  var $94 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$94 >> 2] = $93;
  var $95 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$95 >> 2] = $36;
  var $98 = $33 * -75 + 512 >> 10;
  var $99 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$99 >> 2] = $98;
  var $100 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$100 >> 2] = 0;
  var $101 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$101 >> 2] = 0;
  var $102 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$102 >> 2] = 0;
  var $103 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$103 >> 2] = 0;
  var $104 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$104 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi3ELi3EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi3ELi4EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $15 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $19 = $11 * 426 + 512 + $15 * 810 >> 10;
  var $22 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $26 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $30 = $22 * 426 + 512 + $26 * 810 >> 10;
  var $33 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $37 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $41 = $33 * 426 + 512 + $37 * 810 >> 10;
  var $46 = $11 * 23 + 512 + $15 * -99 >> 10;
  var $51 = $22 * 23 + 512 + $26 * -99 >> 10;
  var $56 = $33 * 23 + 512 + $37 * -99 >> 10;
  var $57 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$57 >> 2] = $2;
  var $60 = $5 * 426 + 512 >> 10;
  var $61 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$61 >> 2] = $60;
  var $62 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$62 >> 2] = 0;
  var $65 = $5 * 23 + 512 >> 10;
  var $66 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$66 >> 2] = $65;
  var $67 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$67 >> 2] = $19;
  var $70 = $30 * 426 + 512 >> 10;
  var $71 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$71 >> 2] = $70;
  var $72 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$72 >> 2] = 0;
  var $75 = $30 * 23 + 512 >> 10;
  var $76 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$76 >> 2] = $75;
  var $77 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$77 >> 2] = 0;
  var $78 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$78 >> 2] = 0;
  var $79 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$79 >> 2] = 0;
  var $80 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$80 >> 2] = 0;
  var $81 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$81 >> 2] = $46;
  var $84 = $51 * 426 + 512 >> 10;
  var $85 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$85 >> 2] = $84;
  var $86 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$86 >> 2] = 0;
  var $89 = $51 * 23 + 512 >> 10;
  var $90 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$90 >> 2] = $89;
  var $93 = $5 * 928 + 512 >> 10;
  var $94 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$94 >> 2] = $93;
  var $95 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$95 >> 2] = $8;
  var $98 = $5 * -75 + 512 >> 10;
  var $99 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$99 >> 2] = $98;
  var $100 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$100 >> 2] = 0;
  var $103 = $30 * 928 + 512 >> 10;
  var $104 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$104 >> 2] = $103;
  var $105 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$105 >> 2] = $41;
  var $108 = $30 * -75 + 512 >> 10;
  var $109 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$109 >> 2] = $108;
  var $110 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$110 >> 2] = 0;
  var $111 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$111 >> 2] = 0;
  var $112 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$112 >> 2] = 0;
  var $113 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$113 >> 2] = 0;
  var $114 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$114 >> 2] = 0;
  var $117 = $51 * 928 + 512 >> 10;
  var $118 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$118 >> 2] = $117;
  var $119 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$119 >> 2] = $56;
  var $122 = $51 * -75 + 512 >> 10;
  var $123 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$123 >> 2] = $122;
  var $124 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$124 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi3ELi4EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi3ELi4EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc) {
  var $3 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $7 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $11 = $3 * 928 + 512 + $7 * -325 >> 10;
  var $14 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $18 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $22 = $14 * 928 + 512 + $18 * -325 >> 10;
  var $25 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $29 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $33 = $25 * 928 + 512 + $29 * -325 >> 10;
  var $36 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $39 = HEAP16[$pSrc + 20 >> 1] << 16 >> 16;
  var $42 = HEAP16[$pSrc + 36 >> 1] << 16 >> 16;
  var $47 = $3 * -75 + 512 + $7 * 526 >> 10;
  var $52 = $14 * -75 + 512 + $18 * 526 >> 10;
  var $57 = $25 * -75 + 512 + $29 * 526 >> 10;
  var $58 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$58 >> 2] = $11;
  var $61 = $22 * 426 + 512 >> 10;
  var $62 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$62 >> 2] = $61;
  var $63 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$63 >> 2] = 0;
  var $66 = $22 * 23 + 512 >> 10;
  var $67 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$67 >> 2] = $66;
  var $68 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$68 >> 2] = $36;
  var $71 = $39 * 426 + 512 >> 10;
  var $72 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$72 >> 2] = $71;
  var $73 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$73 >> 2] = 0;
  var $76 = $39 * 23 + 512 >> 10;
  var $77 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$77 >> 2] = $76;
  var $78 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$78 >> 2] = $47;
  var $81 = $52 * 426 + 512 >> 10;
  var $82 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$82 >> 2] = $81;
  var $83 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$83 >> 2] = 0;
  var $86 = $52 * 23 + 512 >> 10;
  var $87 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$87 >> 2] = $86;
  var $88 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$88 >> 2] = 0;
  var $89 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$89 >> 2] = 0;
  var $90 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$90 >> 2] = 0;
  var $91 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$91 >> 2] = 0;
  var $94 = $22 * 928 + 512 >> 10;
  var $95 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$95 >> 2] = $94;
  var $96 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$96 >> 2] = $33;
  var $99 = $22 * -75 + 512 >> 10;
  var $100 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$100 >> 2] = $99;
  var $101 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$101 >> 2] = 0;
  var $104 = $39 * 928 + 512 >> 10;
  var $105 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$105 >> 2] = $104;
  var $106 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$106 >> 2] = $42;
  var $109 = $39 * -75 + 512 >> 10;
  var $110 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$110 >> 2] = $109;
  var $111 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$111 >> 2] = 0;
  var $114 = $52 * 928 + 512 >> 10;
  var $115 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$115 >> 2] = $114;
  var $116 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$116 >> 2] = $57;
  var $119 = $52 * -75 + 512 >> 10;
  var $120 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$120 >> 2] = $119;
  var $121 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$121 >> 2] = 0;
  var $122 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$122 >> 2] = 0;
  var $123 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$123 >> 2] = 0;
  var $124 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$124 >> 2] = 0;
  var $125 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$125 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi3ELi4EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi4ELi4EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 48 >> 1] << 16 >> 16;
  var $14 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $18 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $22 = $14 * 426 + 512 + $18 * 810 >> 10;
  var $25 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $29 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $33 = $25 * 426 + 512 + $29 * 810 >> 10;
  var $36 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $40 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $44 = $36 * 426 + 512 + $40 * 810 >> 10;
  var $47 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $51 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $55 = $47 * 426 + 512 + $51 * 810 >> 10;
  var $60 = $14 * 23 + 512 + $18 * -99 >> 10;
  var $65 = $25 * 23 + 512 + $29 * -99 >> 10;
  var $70 = $36 * 23 + 512 + $40 * -99 >> 10;
  var $75 = $47 * 23 + 512 + $51 * -99 >> 10;
  var $76 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$76 >> 2] = $2;
  var $81 = $5 * 426 + 512 + $11 * 810 >> 10;
  var $82 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$82 >> 2] = $81;
  var $83 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$83 >> 2] = 0;
  var $88 = $5 * 23 + 512 + $11 * -99 >> 10;
  var $89 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$89 >> 2] = $88;
  var $90 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$90 >> 2] = $22;
  var $95 = $33 * 426 + 512 + $55 * 810 >> 10;
  var $96 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$96 >> 2] = $95;
  var $97 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$97 >> 2] = 0;
  var $102 = $33 * 23 + 512 + $55 * -99 >> 10;
  var $103 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$103 >> 2] = $102;
  var $104 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$104 >> 2] = 0;
  var $105 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$105 >> 2] = 0;
  var $106 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$106 >> 2] = 0;
  var $107 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$107 >> 2] = 0;
  var $108 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$108 >> 2] = $60;
  var $113 = $65 * 426 + 512 + $75 * 810 >> 10;
  var $114 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$114 >> 2] = $113;
  var $115 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$115 >> 2] = 0;
  var $120 = $65 * 23 + 512 + $75 * -99 >> 10;
  var $121 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$121 >> 2] = $120;
  var $126 = $5 * 928 + 512 + $11 * -325 >> 10;
  var $127 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$127 >> 2] = $126;
  var $128 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$128 >> 2] = $8;
  var $133 = $5 * -75 + 512 + $11 * 526 >> 10;
  var $134 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$134 >> 2] = $133;
  var $135 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$135 >> 2] = 0;
  var $140 = $33 * 928 + 512 + $55 * -325 >> 10;
  var $141 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$141 >> 2] = $140;
  var $142 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$142 >> 2] = $44;
  var $147 = $33 * -75 + 512 + $55 * 526 >> 10;
  var $148 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$148 >> 2] = $147;
  var $149 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$149 >> 2] = 0;
  var $150 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$150 >> 2] = 0;
  var $151 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$151 >> 2] = 0;
  var $152 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$152 >> 2] = 0;
  var $153 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$153 >> 2] = 0;
  var $158 = $65 * 928 + 512 + $75 * -325 >> 10;
  var $159 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$159 >> 2] = $158;
  var $160 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$160 >> 2] = $70;
  var $165 = $65 * -75 + 512 + $75 * 526 >> 10;
  var $166 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$166 >> 2] = $165;
  var $167 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$167 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi4ELi4EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi4ELi4EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc) {
  var $3 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $7 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $11 = $3 * 928 + 512 + $7 * -325 >> 10;
  var $14 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $18 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $22 = $14 * 928 + 512 + $18 * -325 >> 10;
  var $25 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $29 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $33 = $25 * 928 + 512 + $29 * -325 >> 10;
  var $36 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $40 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $44 = $36 * 928 + 512 + $40 * -325 >> 10;
  var $47 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $50 = HEAP16[$pSrc + 20 >> 1] << 16 >> 16;
  var $53 = HEAP16[$pSrc + 36 >> 1] << 16 >> 16;
  var $56 = HEAP16[$pSrc + 52 >> 1] << 16 >> 16;
  var $61 = $3 * -75 + 512 + $7 * 526 >> 10;
  var $66 = $14 * -75 + 512 + $18 * 526 >> 10;
  var $71 = $25 * -75 + 512 + $29 * 526 >> 10;
  var $76 = $36 * -75 + 512 + $40 * 526 >> 10;
  var $77 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$77 >> 2] = $11;
  var $82 = $22 * 426 + 512 + $44 * 810 >> 10;
  var $83 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$83 >> 2] = $82;
  var $84 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$84 >> 2] = 0;
  var $89 = $22 * 23 + 512 + $44 * -99 >> 10;
  var $90 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$90 >> 2] = $89;
  var $91 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$91 >> 2] = $47;
  var $96 = $50 * 426 + 512 + $56 * 810 >> 10;
  var $97 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$97 >> 2] = $96;
  var $98 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$98 >> 2] = 0;
  var $103 = $50 * 23 + 512 + $56 * -99 >> 10;
  var $104 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$104 >> 2] = $103;
  var $105 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$105 >> 2] = $61;
  var $110 = $66 * 426 + 512 + $76 * 810 >> 10;
  var $111 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$111 >> 2] = $110;
  var $112 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$112 >> 2] = 0;
  var $117 = $66 * 23 + 512 + $76 * -99 >> 10;
  var $118 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$118 >> 2] = $117;
  var $119 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$119 >> 2] = 0;
  var $120 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$120 >> 2] = 0;
  var $121 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$121 >> 2] = 0;
  var $122 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$122 >> 2] = 0;
  var $127 = $22 * 928 + 512 + $44 * -325 >> 10;
  var $128 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$128 >> 2] = $127;
  var $129 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$129 >> 2] = $33;
  var $134 = $22 * -75 + 512 + $44 * 526 >> 10;
  var $135 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$135 >> 2] = $134;
  var $136 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$136 >> 2] = 0;
  var $141 = $50 * 928 + 512 + $56 * -325 >> 10;
  var $142 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$142 >> 2] = $141;
  var $143 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$143 >> 2] = $53;
  var $148 = $50 * -75 + 512 + $56 * 526 >> 10;
  var $149 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$149 >> 2] = $148;
  var $150 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$150 >> 2] = 0;
  var $155 = $66 * 928 + 512 + $76 * -325 >> 10;
  var $156 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$156 >> 2] = $155;
  var $157 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$157 >> 2] = $71;
  var $162 = $66 * -75 + 512 + $76 * 526 >> 10;
  var $163 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$163 >> 2] = $162;
  var $164 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$164 >> 2] = 0;
  var $165 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$165 >> 2] = 0;
  var $166 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$166 >> 2] = 0;
  var $167 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$167 >> 2] = 0;
  var $168 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$168 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi4ELi4EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi5ELi4EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 48 >> 1] << 16 >> 16;
  var $14 = HEAP16[$pSrc + 64 >> 1] << 16 >> 16;
  var $17 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $21 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $25 = $17 * 426 + 512 + $21 * 810 >> 10;
  var $28 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $32 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $36 = $28 * 426 + 512 + $32 * 810 >> 10;
  var $39 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $43 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $47 = $39 * 426 + 512 + $43 * 810 >> 10;
  var $50 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $54 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $58 = $50 * 426 + 512 + $54 * 810 >> 10;
  var $61 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $65 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $69 = $61 * 426 + 512 + $65 * 810 >> 10;
  var $74 = $17 * 23 + 512 + $21 * -99 >> 10;
  var $79 = $28 * 23 + 512 + $32 * -99 >> 10;
  var $84 = $39 * 23 + 512 + $43 * -99 >> 10;
  var $89 = $50 * 23 + 512 + $54 * -99 >> 10;
  var $94 = $61 * 23 + 512 + $65 * -99 >> 10;
  var $95 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$95 >> 2] = $2;
  var $100 = $5 * 426 + 512 + $11 * 810 >> 10;
  var $101 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$101 >> 2] = $100;
  var $102 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$102 >> 2] = $14;
  var $107 = $5 * 23 + 512 + $11 * -99 >> 10;
  var $108 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$108 >> 2] = $107;
  var $109 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$109 >> 2] = $25;
  var $114 = $36 * 426 + 512 + $58 * 810 >> 10;
  var $115 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$115 >> 2] = $114;
  var $116 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$116 >> 2] = $69;
  var $121 = $36 * 23 + 512 + $58 * -99 >> 10;
  var $122 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$122 >> 2] = $121;
  var $123 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$123 >> 2] = 0;
  var $124 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$124 >> 2] = 0;
  var $125 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$125 >> 2] = 0;
  var $126 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$126 >> 2] = 0;
  var $127 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$127 >> 2] = $74;
  var $132 = $79 * 426 + 512 + $89 * 810 >> 10;
  var $133 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$133 >> 2] = $132;
  var $134 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$134 >> 2] = $94;
  var $139 = $79 * 23 + 512 + $89 * -99 >> 10;
  var $140 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$140 >> 2] = $139;
  var $145 = $5 * 928 + 512 + $11 * -325 >> 10;
  var $146 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$146 >> 2] = $145;
  var $147 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$147 >> 2] = $8;
  var $152 = $5 * -75 + 512 + $11 * 526 >> 10;
  var $153 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$153 >> 2] = $152;
  var $154 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$154 >> 2] = 0;
  var $159 = $36 * 928 + 512 + $58 * -325 >> 10;
  var $160 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$160 >> 2] = $159;
  var $161 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$161 >> 2] = $47;
  var $166 = $36 * -75 + 512 + $58 * 526 >> 10;
  var $167 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$167 >> 2] = $166;
  var $168 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$168 >> 2] = 0;
  var $169 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$169 >> 2] = 0;
  var $170 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$170 >> 2] = 0;
  var $171 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$171 >> 2] = 0;
  var $172 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$172 >> 2] = 0;
  var $177 = $79 * 928 + 512 + $89 * -325 >> 10;
  var $178 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$178 >> 2] = $177;
  var $179 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$179 >> 2] = $84;
  var $184 = $79 * -75 + 512 + $89 * 526 >> 10;
  var $185 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$185 >> 2] = $184;
  var $186 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$186 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi5ELi4EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi5ELi4EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc) {
  var $3 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $7 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $11 = $3 * 928 + 512 + $7 * -325 >> 10;
  var $14 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $18 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $22 = $14 * 928 + 512 + $18 * -325 >> 10;
  var $25 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $29 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $33 = $25 * 928 + 512 + $29 * -325 >> 10;
  var $36 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $40 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $44 = $36 * 928 + 512 + $40 * -325 >> 10;
  var $47 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $51 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $55 = $47 * 928 + 512 + $51 * -325 >> 10;
  var $58 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $61 = HEAP16[$pSrc + 20 >> 1] << 16 >> 16;
  var $64 = HEAP16[$pSrc + 36 >> 1] << 16 >> 16;
  var $67 = HEAP16[$pSrc + 52 >> 1] << 16 >> 16;
  var $70 = HEAP16[$pSrc + 68 >> 1] << 16 >> 16;
  var $75 = $3 * -75 + 512 + $7 * 526 >> 10;
  var $80 = $14 * -75 + 512 + $18 * 526 >> 10;
  var $85 = $25 * -75 + 512 + $29 * 526 >> 10;
  var $90 = $36 * -75 + 512 + $40 * 526 >> 10;
  var $95 = $47 * -75 + 512 + $51 * 526 >> 10;
  var $96 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$96 >> 2] = $11;
  var $101 = $22 * 426 + 512 + $44 * 810 >> 10;
  var $102 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$102 >> 2] = $101;
  var $103 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$103 >> 2] = $55;
  var $108 = $22 * 23 + 512 + $44 * -99 >> 10;
  var $109 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$109 >> 2] = $108;
  var $110 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$110 >> 2] = $58;
  var $115 = $61 * 426 + 512 + $67 * 810 >> 10;
  var $116 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$116 >> 2] = $115;
  var $117 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$117 >> 2] = $70;
  var $122 = $61 * 23 + 512 + $67 * -99 >> 10;
  var $123 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$123 >> 2] = $122;
  var $124 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$124 >> 2] = $75;
  var $129 = $80 * 426 + 512 + $90 * 810 >> 10;
  var $130 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$130 >> 2] = $129;
  var $131 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$131 >> 2] = $95;
  var $136 = $80 * 23 + 512 + $90 * -99 >> 10;
  var $137 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$137 >> 2] = $136;
  var $138 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$138 >> 2] = 0;
  var $139 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$139 >> 2] = 0;
  var $140 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$140 >> 2] = 0;
  var $141 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$141 >> 2] = 0;
  var $146 = $22 * 928 + 512 + $44 * -325 >> 10;
  var $147 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$147 >> 2] = $146;
  var $148 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$148 >> 2] = $33;
  var $153 = $22 * -75 + 512 + $44 * 526 >> 10;
  var $154 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$154 >> 2] = $153;
  var $155 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$155 >> 2] = 0;
  var $160 = $61 * 928 + 512 + $67 * -325 >> 10;
  var $161 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$161 >> 2] = $160;
  var $162 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$162 >> 2] = $64;
  var $167 = $61 * -75 + 512 + $67 * 526 >> 10;
  var $168 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$168 >> 2] = $167;
  var $169 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$169 >> 2] = 0;
  var $174 = $80 * 928 + 512 + $90 * -325 >> 10;
  var $175 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$175 >> 2] = $174;
  var $176 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$176 >> 2] = $85;
  var $181 = $80 * -75 + 512 + $90 * 526 >> 10;
  var $182 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$182 >> 2] = $181;
  var $183 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$183 >> 2] = 0;
  var $184 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$184 >> 2] = 0;
  var $185 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$185 >> 2] = 0;
  var $186 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$186 >> 2] = 0;
  var $187 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$187 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi5ELi4EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi5ELi5EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 48 >> 1] << 16 >> 16;
  var $14 = HEAP16[$pSrc + 64 >> 1] << 16 >> 16;
  var $17 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $21 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $25 = $17 * 426 + 512 + $21 * 810 >> 10;
  var $28 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $32 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $36 = $28 * 426 + 512 + $32 * 810 >> 10;
  var $39 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $43 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $47 = $39 * 426 + 512 + $43 * 810 >> 10;
  var $50 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $54 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $58 = $50 * 426 + 512 + $54 * 810 >> 10;
  var $61 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $65 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $69 = $61 * 426 + 512 + $65 * 810 >> 10;
  var $72 = HEAP16[$pSrc + 8 >> 1] << 16 >> 16;
  var $75 = HEAP16[$pSrc + 24 >> 1] << 16 >> 16;
  var $78 = HEAP16[$pSrc + 40 >> 1] << 16 >> 16;
  var $81 = HEAP16[$pSrc + 56 >> 1] << 16 >> 16;
  var $84 = HEAP16[$pSrc + 72 >> 1] << 16 >> 16;
  var $89 = $17 * 23 + 512 + $21 * -99 >> 10;
  var $94 = $28 * 23 + 512 + $32 * -99 >> 10;
  var $99 = $39 * 23 + 512 + $43 * -99 >> 10;
  var $104 = $50 * 23 + 512 + $54 * -99 >> 10;
  var $109 = $61 * 23 + 512 + $65 * -99 >> 10;
  var $110 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$110 >> 2] = $2;
  var $115 = $5 * 426 + 512 + $11 * 810 >> 10;
  var $116 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$116 >> 2] = $115;
  var $117 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$117 >> 2] = $14;
  var $122 = $5 * 23 + 512 + $11 * -99 >> 10;
  var $123 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$123 >> 2] = $122;
  var $124 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$124 >> 2] = $25;
  var $129 = $36 * 426 + 512 + $58 * 810 >> 10;
  var $130 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$130 >> 2] = $129;
  var $131 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$131 >> 2] = $69;
  var $136 = $36 * 23 + 512 + $58 * -99 >> 10;
  var $137 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$137 >> 2] = $136;
  var $138 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$138 >> 2] = $72;
  var $143 = $75 * 426 + 512 + $81 * 810 >> 10;
  var $144 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$144 >> 2] = $143;
  var $145 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$145 >> 2] = $84;
  var $150 = $75 * 23 + 512 + $81 * -99 >> 10;
  var $151 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$151 >> 2] = $150;
  var $152 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$152 >> 2] = $89;
  var $157 = $94 * 426 + 512 + $104 * 810 >> 10;
  var $158 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$158 >> 2] = $157;
  var $159 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$159 >> 2] = $109;
  var $164 = $94 * 23 + 512 + $104 * -99 >> 10;
  var $165 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$165 >> 2] = $164;
  var $170 = $5 * 928 + 512 + $11 * -325 >> 10;
  var $171 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$171 >> 2] = $170;
  var $172 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$172 >> 2] = $8;
  var $177 = $5 * -75 + 512 + $11 * 526 >> 10;
  var $178 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$178 >> 2] = $177;
  var $179 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$179 >> 2] = 0;
  var $184 = $36 * 928 + 512 + $58 * -325 >> 10;
  var $185 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$185 >> 2] = $184;
  var $186 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$186 >> 2] = $47;
  var $191 = $36 * -75 + 512 + $58 * 526 >> 10;
  var $192 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$192 >> 2] = $191;
  var $193 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$193 >> 2] = 0;
  var $198 = $75 * 928 + 512 + $81 * -325 >> 10;
  var $199 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$199 >> 2] = $198;
  var $200 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$200 >> 2] = $78;
  var $205 = $75 * -75 + 512 + $81 * 526 >> 10;
  var $206 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$206 >> 2] = $205;
  var $207 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$207 >> 2] = 0;
  var $212 = $94 * 928 + 512 + $104 * -325 >> 10;
  var $213 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$213 >> 2] = $212;
  var $214 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$214 >> 2] = $99;
  var $219 = $94 * -75 + 512 + $104 * 526 >> 10;
  var $220 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$220 >> 2] = $219;
  var $221 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$221 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi5ELi5EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi5ELi5EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc) {
  var $3 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $7 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $11 = $3 * 928 + 512 + $7 * -325 >> 10;
  var $14 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $18 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $22 = $14 * 928 + 512 + $18 * -325 >> 10;
  var $25 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $29 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $33 = $25 * 928 + 512 + $29 * -325 >> 10;
  var $36 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $40 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $44 = $36 * 928 + 512 + $40 * -325 >> 10;
  var $47 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $51 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $55 = $47 * 928 + 512 + $51 * -325 >> 10;
  var $58 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $61 = HEAP16[$pSrc + 20 >> 1] << 16 >> 16;
  var $64 = HEAP16[$pSrc + 36 >> 1] << 16 >> 16;
  var $67 = HEAP16[$pSrc + 52 >> 1] << 16 >> 16;
  var $70 = HEAP16[$pSrc + 68 >> 1] << 16 >> 16;
  var $75 = $3 * -75 + 512 + $7 * 526 >> 10;
  var $80 = $14 * -75 + 512 + $18 * 526 >> 10;
  var $85 = $25 * -75 + 512 + $29 * 526 >> 10;
  var $90 = $36 * -75 + 512 + $40 * 526 >> 10;
  var $95 = $47 * -75 + 512 + $51 * 526 >> 10;
  var $96 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$96 >> 2] = $11;
  var $101 = $22 * 426 + 512 + $44 * 810 >> 10;
  var $102 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$102 >> 2] = $101;
  var $103 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$103 >> 2] = $55;
  var $108 = $22 * 23 + 512 + $44 * -99 >> 10;
  var $109 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$109 >> 2] = $108;
  var $110 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$110 >> 2] = $58;
  var $115 = $61 * 426 + 512 + $67 * 810 >> 10;
  var $116 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$116 >> 2] = $115;
  var $117 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$117 >> 2] = $70;
  var $122 = $61 * 23 + 512 + $67 * -99 >> 10;
  var $123 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$123 >> 2] = $122;
  var $124 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$124 >> 2] = $75;
  var $129 = $80 * 426 + 512 + $90 * 810 >> 10;
  var $130 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$130 >> 2] = $129;
  var $131 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$131 >> 2] = $95;
  var $136 = $80 * 23 + 512 + $90 * -99 >> 10;
  var $137 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$137 >> 2] = $136;
  var $138 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$138 >> 2] = 0;
  var $139 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$139 >> 2] = 0;
  var $140 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$140 >> 2] = 0;
  var $141 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$141 >> 2] = 0;
  var $146 = $22 * 928 + 512 + $44 * -325 >> 10;
  var $147 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$147 >> 2] = $146;
  var $148 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$148 >> 2] = $33;
  var $153 = $22 * -75 + 512 + $44 * 526 >> 10;
  var $154 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$154 >> 2] = $153;
  var $155 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$155 >> 2] = 0;
  var $160 = $61 * 928 + 512 + $67 * -325 >> 10;
  var $161 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$161 >> 2] = $160;
  var $162 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$162 >> 2] = $64;
  var $167 = $61 * -75 + 512 + $67 * 526 >> 10;
  var $168 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$168 >> 2] = $167;
  var $169 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$169 >> 2] = 0;
  var $174 = $80 * 928 + 512 + $90 * -325 >> 10;
  var $175 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$175 >> 2] = $174;
  var $176 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$176 >> 2] = $85;
  var $181 = $80 * -75 + 512 + $90 * 526 >> 10;
  var $182 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$182 >> 2] = $181;
  var $183 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$183 >> 2] = 0;
  var $184 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$184 >> 2] = 0;
  var $185 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$185 >> 2] = 0;
  var $186 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$186 >> 2] = 0;
  var $187 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$187 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi5ELi5EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi5ELi6EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 48 >> 1] << 16 >> 16;
  var $14 = HEAP16[$pSrc + 64 >> 1] << 16 >> 16;
  var $17 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $21 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $25 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $30 = $17 * 426 + 512 + $21 * 810 + $25 * -360 >> 10;
  var $33 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $37 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $41 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $46 = $33 * 426 + 512 + $37 * 810 + $41 * -360 >> 10;
  var $49 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $53 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $57 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $62 = $49 * 426 + 512 + $53 * 810 + $57 * -360 >> 10;
  var $65 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $69 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $73 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $78 = $65 * 426 + 512 + $69 * 810 + $73 * -360 >> 10;
  var $81 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $85 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $89 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $94 = $81 * 426 + 512 + $85 * 810 + $89 * -360 >> 10;
  var $97 = HEAP16[$pSrc + 8 >> 1] << 16 >> 16;
  var $100 = HEAP16[$pSrc + 24 >> 1] << 16 >> 16;
  var $103 = HEAP16[$pSrc + 40 >> 1] << 16 >> 16;
  var $106 = HEAP16[$pSrc + 56 >> 1] << 16 >> 16;
  var $109 = HEAP16[$pSrc + 72 >> 1] << 16 >> 16;
  var $116 = $17 * 23 + 512 + $21 * -99 + $25 * 502 >> 10;
  var $123 = $33 * 23 + 512 + $37 * -99 + $41 * 502 >> 10;
  var $130 = $49 * 23 + 512 + $53 * -99 + $57 * 502 >> 10;
  var $137 = $65 * 23 + 512 + $69 * -99 + $73 * 502 >> 10;
  var $144 = $81 * 23 + 512 + $85 * -99 + $89 * 502 >> 10;
  var $145 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$145 >> 2] = $2;
  var $150 = $5 * 426 + 512 + $11 * 810 >> 10;
  var $151 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$151 >> 2] = $150;
  var $152 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$152 >> 2] = $14;
  var $157 = $5 * 23 + 512 + $11 * -99 >> 10;
  var $158 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$158 >> 2] = $157;
  var $159 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$159 >> 2] = $30;
  var $164 = $46 * 426 + 512 + $78 * 810 >> 10;
  var $165 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$165 >> 2] = $164;
  var $166 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$166 >> 2] = $94;
  var $171 = $46 * 23 + 512 + $78 * -99 >> 10;
  var $172 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$172 >> 2] = $171;
  var $173 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$173 >> 2] = $97;
  var $178 = $100 * 426 + 512 + $106 * 810 >> 10;
  var $179 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$179 >> 2] = $178;
  var $180 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$180 >> 2] = $109;
  var $185 = $100 * 23 + 512 + $106 * -99 >> 10;
  var $186 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$186 >> 2] = $185;
  var $187 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$187 >> 2] = $116;
  var $192 = $123 * 426 + 512 + $137 * 810 >> 10;
  var $193 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$193 >> 2] = $192;
  var $194 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$194 >> 2] = $144;
  var $199 = $123 * 23 + 512 + $137 * -99 >> 10;
  var $200 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$200 >> 2] = $199;
  var $205 = $5 * 928 + 512 + $11 * -325 >> 10;
  var $206 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$206 >> 2] = $205;
  var $207 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$207 >> 2] = $8;
  var $212 = $5 * -75 + 512 + $11 * 526 >> 10;
  var $213 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$213 >> 2] = $212;
  var $214 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$214 >> 2] = 0;
  var $219 = $46 * 928 + 512 + $78 * -325 >> 10;
  var $220 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$220 >> 2] = $219;
  var $221 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$221 >> 2] = $62;
  var $226 = $46 * -75 + 512 + $78 * 526 >> 10;
  var $227 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$227 >> 2] = $226;
  var $228 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$228 >> 2] = 0;
  var $233 = $100 * 928 + 512 + $106 * -325 >> 10;
  var $234 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$234 >> 2] = $233;
  var $235 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$235 >> 2] = $103;
  var $240 = $100 * -75 + 512 + $106 * 526 >> 10;
  var $241 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$241 >> 2] = $240;
  var $242 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$242 >> 2] = 0;
  var $247 = $123 * 928 + 512 + $137 * -325 >> 10;
  var $248 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$248 >> 2] = $247;
  var $249 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$249 >> 2] = $130;
  var $254 = $123 * -75 + 512 + $137 * 526 >> 10;
  var $255 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$255 >> 2] = $254;
  var $256 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$256 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi5ELi6EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi5ELi6EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc) {
  var $3 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $7 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $16 = $3 * 928 + 512 + $7 * -325 + $11 * 218 >> 10;
  var $19 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $23 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $27 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $32 = $19 * 928 + 512 + $23 * -325 + $27 * 218 >> 10;
  var $35 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $39 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $43 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $48 = $35 * 928 + 512 + $39 * -325 + $43 * 218 >> 10;
  var $51 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $55 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $59 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $64 = $51 * 928 + 512 + $55 * -325 + $59 * 218 >> 10;
  var $67 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $71 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $75 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $80 = $67 * 928 + 512 + $71 * -325 + $75 * 218 >> 10;
  var $83 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $86 = HEAP16[$pSrc + 20 >> 1] << 16 >> 16;
  var $89 = HEAP16[$pSrc + 36 >> 1] << 16 >> 16;
  var $92 = HEAP16[$pSrc + 52 >> 1] << 16 >> 16;
  var $95 = HEAP16[$pSrc + 68 >> 1] << 16 >> 16;
  var $102 = $3 * -75 + 512 + $7 * 526 + $11 * 787 >> 10;
  var $109 = $19 * -75 + 512 + $23 * 526 + $27 * 787 >> 10;
  var $116 = $35 * -75 + 512 + $39 * 526 + $43 * 787 >> 10;
  var $123 = $51 * -75 + 512 + $55 * 526 + $59 * 787 >> 10;
  var $130 = $67 * -75 + 512 + $71 * 526 + $75 * 787 >> 10;
  var $131 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$131 >> 2] = $16;
  var $136 = $32 * 426 + 512 + $64 * 810 >> 10;
  var $137 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$137 >> 2] = $136;
  var $138 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$138 >> 2] = $80;
  var $143 = $32 * 23 + 512 + $64 * -99 >> 10;
  var $144 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$144 >> 2] = $143;
  var $145 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$145 >> 2] = $83;
  var $150 = $86 * 426 + 512 + $92 * 810 >> 10;
  var $151 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$151 >> 2] = $150;
  var $152 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$152 >> 2] = $95;
  var $157 = $86 * 23 + 512 + $92 * -99 >> 10;
  var $158 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$158 >> 2] = $157;
  var $159 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$159 >> 2] = $102;
  var $164 = $109 * 426 + 512 + $123 * 810 >> 10;
  var $165 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$165 >> 2] = $164;
  var $166 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$166 >> 2] = $130;
  var $171 = $109 * 23 + 512 + $123 * -99 >> 10;
  var $172 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$172 >> 2] = $171;
  var $173 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$173 >> 2] = 0;
  var $174 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$174 >> 2] = 0;
  var $175 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$175 >> 2] = 0;
  var $176 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$176 >> 2] = 0;
  var $181 = $32 * 928 + 512 + $64 * -325 >> 10;
  var $182 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$182 >> 2] = $181;
  var $183 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$183 >> 2] = $48;
  var $188 = $32 * -75 + 512 + $64 * 526 >> 10;
  var $189 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$189 >> 2] = $188;
  var $190 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$190 >> 2] = 0;
  var $195 = $86 * 928 + 512 + $92 * -325 >> 10;
  var $196 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$196 >> 2] = $195;
  var $197 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$197 >> 2] = $89;
  var $202 = $86 * -75 + 512 + $92 * 526 >> 10;
  var $203 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$203 >> 2] = $202;
  var $204 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$204 >> 2] = 0;
  var $209 = $109 * 928 + 512 + $123 * -325 >> 10;
  var $210 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$210 >> 2] = $209;
  var $211 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$211 >> 2] = $116;
  var $216 = $109 * -75 + 512 + $123 * 526 >> 10;
  var $217 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$217 >> 2] = $216;
  var $218 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$218 >> 2] = 0;
  var $219 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$219 >> 2] = 0;
  var $220 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$220 >> 2] = 0;
  var $221 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$221 >> 2] = 0;
  var $222 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$222 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi5ELi6EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi6ELi6EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 48 >> 1] << 16 >> 16;
  var $14 = HEAP16[$pSrc + 64 >> 1] << 16 >> 16;
  var $17 = HEAP16[$pSrc + 80 >> 1] << 16 >> 16;
  var $20 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $24 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $28 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $33 = $20 * 426 + 512 + $24 * 810 + $28 * -360 >> 10;
  var $36 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $40 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $44 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $49 = $36 * 426 + 512 + $40 * 810 + $44 * -360 >> 10;
  var $52 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $56 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $60 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $65 = $52 * 426 + 512 + $56 * 810 + $60 * -360 >> 10;
  var $68 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $72 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $76 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $81 = $68 * 426 + 512 + $72 * 810 + $76 * -360 >> 10;
  var $84 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $88 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $92 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $97 = $84 * 426 + 512 + $88 * 810 + $92 * -360 >> 10;
  var $100 = HEAP16[$pSrc + 82 >> 1] << 16 >> 16;
  var $104 = HEAP16[$pSrc + 86 >> 1] << 16 >> 16;
  var $108 = HEAP16[$pSrc + 90 >> 1] << 16 >> 16;
  var $113 = $100 * 426 + 512 + $104 * 810 + $108 * -360 >> 10;
  var $116 = HEAP16[$pSrc + 8 >> 1] << 16 >> 16;
  var $119 = HEAP16[$pSrc + 24 >> 1] << 16 >> 16;
  var $122 = HEAP16[$pSrc + 40 >> 1] << 16 >> 16;
  var $125 = HEAP16[$pSrc + 56 >> 1] << 16 >> 16;
  var $128 = HEAP16[$pSrc + 72 >> 1] << 16 >> 16;
  var $131 = HEAP16[$pSrc + 88 >> 1] << 16 >> 16;
  var $138 = $20 * 23 + 512 + $24 * -99 + $28 * 502 >> 10;
  var $145 = $36 * 23 + 512 + $40 * -99 + $44 * 502 >> 10;
  var $152 = $52 * 23 + 512 + $56 * -99 + $60 * 502 >> 10;
  var $159 = $68 * 23 + 512 + $72 * -99 + $76 * 502 >> 10;
  var $166 = $84 * 23 + 512 + $88 * -99 + $92 * 502 >> 10;
  var $173 = $100 * 23 + 512 + $104 * -99 + $108 * 502 >> 10;
  var $174 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$174 >> 2] = $2;
  var $181 = $5 * 426 + 512 + $11 * 810 + $17 * -360 >> 10;
  var $182 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$182 >> 2] = $181;
  var $183 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$183 >> 2] = $14;
  var $190 = $5 * 23 + 512 + $11 * -99 + $17 * 502 >> 10;
  var $191 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$191 >> 2] = $190;
  var $192 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$192 >> 2] = $33;
  var $199 = $49 * 426 + 512 + $81 * 810 + $113 * -360 >> 10;
  var $200 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$200 >> 2] = $199;
  var $201 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$201 >> 2] = $97;
  var $208 = $49 * 23 + 512 + $81 * -99 + $113 * 502 >> 10;
  var $209 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$209 >> 2] = $208;
  var $210 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$210 >> 2] = $116;
  var $217 = $119 * 426 + 512 + $125 * 810 + $131 * -360 >> 10;
  var $218 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$218 >> 2] = $217;
  var $219 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$219 >> 2] = $128;
  var $226 = $119 * 23 + 512 + $125 * -99 + $131 * 502 >> 10;
  var $227 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$227 >> 2] = $226;
  var $228 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$228 >> 2] = $138;
  var $235 = $145 * 426 + 512 + $159 * 810 + $173 * -360 >> 10;
  var $236 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$236 >> 2] = $235;
  var $237 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$237 >> 2] = $166;
  var $244 = $145 * 23 + 512 + $159 * -99 + $173 * 502 >> 10;
  var $245 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$245 >> 2] = $244;
  var $252 = $5 * 928 + 512 + $11 * -325 + $17 * 218 >> 10;
  var $253 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$253 >> 2] = $252;
  var $254 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$254 >> 2] = $8;
  var $261 = $5 * -75 + 512 + $11 * 526 + $17 * 787 >> 10;
  var $262 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$262 >> 2] = $261;
  var $263 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$263 >> 2] = 0;
  var $270 = $49 * 928 + 512 + $81 * -325 + $113 * 218 >> 10;
  var $271 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$271 >> 2] = $270;
  var $272 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$272 >> 2] = $65;
  var $279 = $49 * -75 + 512 + $81 * 526 + $113 * 787 >> 10;
  var $280 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$280 >> 2] = $279;
  var $281 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$281 >> 2] = 0;
  var $288 = $119 * 928 + 512 + $125 * -325 + $131 * 218 >> 10;
  var $289 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$289 >> 2] = $288;
  var $290 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$290 >> 2] = $122;
  var $297 = $119 * -75 + 512 + $125 * 526 + $131 * 787 >> 10;
  var $298 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$298 >> 2] = $297;
  var $299 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$299 >> 2] = 0;
  var $306 = $145 * 928 + 512 + $159 * -325 + $173 * 218 >> 10;
  var $307 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$307 >> 2] = $306;
  var $308 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$308 >> 2] = $152;
  var $315 = $145 * -75 + 512 + $159 * 526 + $173 * 787 >> 10;
  var $316 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$316 >> 2] = $315;
  var $317 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$317 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi6ELi6EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi6ELi6EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc) {
  var $3 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $7 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $16 = $3 * 928 + 512 + $7 * -325 + $11 * 218 >> 10;
  var $19 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $23 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $27 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $32 = $19 * 928 + 512 + $23 * -325 + $27 * 218 >> 10;
  var $35 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $39 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $43 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $48 = $35 * 928 + 512 + $39 * -325 + $43 * 218 >> 10;
  var $51 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $55 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $59 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $64 = $51 * 928 + 512 + $55 * -325 + $59 * 218 >> 10;
  var $67 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $71 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $75 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $80 = $67 * 928 + 512 + $71 * -325 + $75 * 218 >> 10;
  var $83 = HEAP16[$pSrc + 82 >> 1] << 16 >> 16;
  var $87 = HEAP16[$pSrc + 86 >> 1] << 16 >> 16;
  var $91 = HEAP16[$pSrc + 90 >> 1] << 16 >> 16;
  var $96 = $83 * 928 + 512 + $87 * -325 + $91 * 218 >> 10;
  var $99 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $102 = HEAP16[$pSrc + 20 >> 1] << 16 >> 16;
  var $105 = HEAP16[$pSrc + 36 >> 1] << 16 >> 16;
  var $108 = HEAP16[$pSrc + 52 >> 1] << 16 >> 16;
  var $111 = HEAP16[$pSrc + 68 >> 1] << 16 >> 16;
  var $114 = HEAP16[$pSrc + 84 >> 1] << 16 >> 16;
  var $121 = $3 * -75 + 512 + $7 * 526 + $11 * 787 >> 10;
  var $128 = $19 * -75 + 512 + $23 * 526 + $27 * 787 >> 10;
  var $135 = $35 * -75 + 512 + $39 * 526 + $43 * 787 >> 10;
  var $142 = $51 * -75 + 512 + $55 * 526 + $59 * 787 >> 10;
  var $149 = $67 * -75 + 512 + $71 * 526 + $75 * 787 >> 10;
  var $156 = $83 * -75 + 512 + $87 * 526 + $91 * 787 >> 10;
  var $157 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$157 >> 2] = $16;
  var $164 = $32 * 426 + 512 + $64 * 810 + $96 * -360 >> 10;
  var $165 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$165 >> 2] = $164;
  var $166 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$166 >> 2] = $80;
  var $173 = $32 * 23 + 512 + $64 * -99 + $96 * 502 >> 10;
  var $174 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$174 >> 2] = $173;
  var $175 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$175 >> 2] = $99;
  var $182 = $102 * 426 + 512 + $108 * 810 + $114 * -360 >> 10;
  var $183 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$183 >> 2] = $182;
  var $184 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$184 >> 2] = $111;
  var $191 = $102 * 23 + 512 + $108 * -99 + $114 * 502 >> 10;
  var $192 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$192 >> 2] = $191;
  var $193 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$193 >> 2] = $121;
  var $200 = $128 * 426 + 512 + $142 * 810 + $156 * -360 >> 10;
  var $201 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$201 >> 2] = $200;
  var $202 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$202 >> 2] = $149;
  var $209 = $128 * 23 + 512 + $142 * -99 + $156 * 502 >> 10;
  var $210 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$210 >> 2] = $209;
  var $211 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$211 >> 2] = 0;
  var $212 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$212 >> 2] = 0;
  var $213 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$213 >> 2] = 0;
  var $214 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$214 >> 2] = 0;
  var $221 = $32 * 928 + 512 + $64 * -325 + $96 * 218 >> 10;
  var $222 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$222 >> 2] = $221;
  var $223 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$223 >> 2] = $48;
  var $230 = $32 * -75 + 512 + $64 * 526 + $96 * 787 >> 10;
  var $231 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$231 >> 2] = $230;
  var $232 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$232 >> 2] = 0;
  var $239 = $102 * 928 + 512 + $108 * -325 + $114 * 218 >> 10;
  var $240 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$240 >> 2] = $239;
  var $241 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$241 >> 2] = $105;
  var $248 = $102 * -75 + 512 + $108 * 526 + $114 * 787 >> 10;
  var $249 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$249 >> 2] = $248;
  var $250 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$250 >> 2] = 0;
  var $257 = $128 * 928 + 512 + $142 * -325 + $156 * 218 >> 10;
  var $258 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$258 >> 2] = $257;
  var $259 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$259 >> 2] = $135;
  var $266 = $128 * -75 + 512 + $142 * 526 + $156 * 787 >> 10;
  var $267 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$267 >> 2] = $266;
  var $268 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$268 >> 2] = 0;
  var $269 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$269 >> 2] = 0;
  var $270 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$270 >> 2] = 0;
  var $271 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$271 >> 2] = 0;
  var $272 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$272 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi6ELi6EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi7ELi6EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 48 >> 1] << 16 >> 16;
  var $14 = HEAP16[$pSrc + 64 >> 1] << 16 >> 16;
  var $17 = HEAP16[$pSrc + 80 >> 1] << 16 >> 16;
  var $20 = HEAP16[$pSrc + 96 >> 1] << 16 >> 16;
  var $23 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $27 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $31 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $36 = $23 * 426 + 512 + $27 * 810 + $31 * -360 >> 10;
  var $39 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $43 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $47 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $52 = $39 * 426 + 512 + $43 * 810 + $47 * -360 >> 10;
  var $55 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $59 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $63 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $68 = $55 * 426 + 512 + $59 * 810 + $63 * -360 >> 10;
  var $71 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $75 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $79 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $84 = $71 * 426 + 512 + $75 * 810 + $79 * -360 >> 10;
  var $87 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $91 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $95 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $100 = $87 * 426 + 512 + $91 * 810 + $95 * -360 >> 10;
  var $103 = HEAP16[$pSrc + 82 >> 1] << 16 >> 16;
  var $107 = HEAP16[$pSrc + 86 >> 1] << 16 >> 16;
  var $111 = HEAP16[$pSrc + 90 >> 1] << 16 >> 16;
  var $116 = $103 * 426 + 512 + $107 * 810 + $111 * -360 >> 10;
  var $119 = HEAP16[$pSrc + 98 >> 1] << 16 >> 16;
  var $123 = HEAP16[$pSrc + 102 >> 1] << 16 >> 16;
  var $127 = HEAP16[$pSrc + 106 >> 1] << 16 >> 16;
  var $132 = $119 * 426 + 512 + $123 * 810 + $127 * -360 >> 10;
  var $135 = HEAP16[$pSrc + 8 >> 1] << 16 >> 16;
  var $138 = HEAP16[$pSrc + 24 >> 1] << 16 >> 16;
  var $141 = HEAP16[$pSrc + 40 >> 1] << 16 >> 16;
  var $144 = HEAP16[$pSrc + 56 >> 1] << 16 >> 16;
  var $147 = HEAP16[$pSrc + 72 >> 1] << 16 >> 16;
  var $150 = HEAP16[$pSrc + 88 >> 1] << 16 >> 16;
  var $153 = HEAP16[$pSrc + 104 >> 1] << 16 >> 16;
  var $160 = $23 * 23 + 512 + $27 * -99 + $31 * 502 >> 10;
  var $167 = $39 * 23 + 512 + $43 * -99 + $47 * 502 >> 10;
  var $174 = $55 * 23 + 512 + $59 * -99 + $63 * 502 >> 10;
  var $181 = $71 * 23 + 512 + $75 * -99 + $79 * 502 >> 10;
  var $188 = $87 * 23 + 512 + $91 * -99 + $95 * 502 >> 10;
  var $195 = $103 * 23 + 512 + $107 * -99 + $111 * 502 >> 10;
  var $202 = $119 * 23 + 512 + $123 * -99 + $127 * 502 >> 10;
  var $203 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$203 >> 2] = $2;
  var $210 = $5 * 426 + 512 + $11 * 810 + $17 * -360 >> 10;
  var $211 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$211 >> 2] = $210;
  var $212 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$212 >> 2] = $14;
  var $219 = $5 * 23 + 512 + $11 * -99 + $17 * 502 >> 10;
  var $220 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$220 >> 2] = $219;
  var $221 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$221 >> 2] = $36;
  var $228 = $52 * 426 + 512 + $84 * 810 + $116 * -360 >> 10;
  var $229 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$229 >> 2] = $228;
  var $230 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$230 >> 2] = $100;
  var $237 = $52 * 23 + 512 + $84 * -99 + $116 * 502 >> 10;
  var $238 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$238 >> 2] = $237;
  var $239 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$239 >> 2] = $135;
  var $246 = $138 * 426 + 512 + $144 * 810 + $150 * -360 >> 10;
  var $247 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$247 >> 2] = $246;
  var $248 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$248 >> 2] = $147;
  var $255 = $138 * 23 + 512 + $144 * -99 + $150 * 502 >> 10;
  var $256 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$256 >> 2] = $255;
  var $257 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$257 >> 2] = $160;
  var $264 = $167 * 426 + 512 + $181 * 810 + $195 * -360 >> 10;
  var $265 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$265 >> 2] = $264;
  var $266 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$266 >> 2] = $188;
  var $273 = $167 * 23 + 512 + $181 * -99 + $195 * 502 >> 10;
  var $274 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$274 >> 2] = $273;
  var $281 = $5 * 928 + 512 + $11 * -325 + $17 * 218 >> 10;
  var $282 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$282 >> 2] = $281;
  var $283 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$283 >> 2] = $8;
  var $290 = $5 * -75 + 512 + $11 * 526 + $17 * 787 >> 10;
  var $291 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$291 >> 2] = $290;
  var $292 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$292 >> 2] = $20;
  var $299 = $52 * 928 + 512 + $84 * -325 + $116 * 218 >> 10;
  var $300 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$300 >> 2] = $299;
  var $301 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$301 >> 2] = $68;
  var $308 = $52 * -75 + 512 + $84 * 526 + $116 * 787 >> 10;
  var $309 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$309 >> 2] = $308;
  var $310 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$310 >> 2] = $132;
  var $317 = $138 * 928 + 512 + $144 * -325 + $150 * 218 >> 10;
  var $318 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$318 >> 2] = $317;
  var $319 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$319 >> 2] = $141;
  var $326 = $138 * -75 + 512 + $144 * 526 + $150 * 787 >> 10;
  var $327 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$327 >> 2] = $326;
  var $328 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$328 >> 2] = $153;
  var $335 = $167 * 928 + 512 + $181 * -325 + $195 * 218 >> 10;
  var $336 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$336 >> 2] = $335;
  var $337 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$337 >> 2] = $174;
  var $344 = $167 * -75 + 512 + $181 * 526 + $195 * 787 >> 10;
  var $345 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$345 >> 2] = $344;
  var $346 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$346 >> 2] = $202;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi7ELi6EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi7ELi6EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc) {
  var $3 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $7 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $16 = $3 * 928 + 512 + $7 * -325 + $11 * 218 >> 10;
  var $19 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $23 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $27 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $32 = $19 * 928 + 512 + $23 * -325 + $27 * 218 >> 10;
  var $35 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $39 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $43 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $48 = $35 * 928 + 512 + $39 * -325 + $43 * 218 >> 10;
  var $51 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $55 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $59 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $64 = $51 * 928 + 512 + $55 * -325 + $59 * 218 >> 10;
  var $67 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $71 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $75 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $80 = $67 * 928 + 512 + $71 * -325 + $75 * 218 >> 10;
  var $83 = HEAP16[$pSrc + 82 >> 1] << 16 >> 16;
  var $87 = HEAP16[$pSrc + 86 >> 1] << 16 >> 16;
  var $91 = HEAP16[$pSrc + 90 >> 1] << 16 >> 16;
  var $96 = $83 * 928 + 512 + $87 * -325 + $91 * 218 >> 10;
  var $99 = HEAP16[$pSrc + 98 >> 1] << 16 >> 16;
  var $103 = HEAP16[$pSrc + 102 >> 1] << 16 >> 16;
  var $107 = HEAP16[$pSrc + 106 >> 1] << 16 >> 16;
  var $112 = $99 * 928 + 512 + $103 * -325 + $107 * 218 >> 10;
  var $115 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $118 = HEAP16[$pSrc + 20 >> 1] << 16 >> 16;
  var $121 = HEAP16[$pSrc + 36 >> 1] << 16 >> 16;
  var $124 = HEAP16[$pSrc + 52 >> 1] << 16 >> 16;
  var $127 = HEAP16[$pSrc + 68 >> 1] << 16 >> 16;
  var $130 = HEAP16[$pSrc + 84 >> 1] << 16 >> 16;
  var $133 = HEAP16[$pSrc + 100 >> 1] << 16 >> 16;
  var $140 = $3 * -75 + 512 + $7 * 526 + $11 * 787 >> 10;
  var $147 = $19 * -75 + 512 + $23 * 526 + $27 * 787 >> 10;
  var $154 = $35 * -75 + 512 + $39 * 526 + $43 * 787 >> 10;
  var $161 = $51 * -75 + 512 + $55 * 526 + $59 * 787 >> 10;
  var $168 = $67 * -75 + 512 + $71 * 526 + $75 * 787 >> 10;
  var $175 = $83 * -75 + 512 + $87 * 526 + $91 * 787 >> 10;
  var $182 = $99 * -75 + 512 + $103 * 526 + $107 * 787 >> 10;
  var $183 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$183 >> 2] = $16;
  var $190 = $32 * 426 + 512 + $64 * 810 + $96 * -360 >> 10;
  var $191 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$191 >> 2] = $190;
  var $192 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$192 >> 2] = $80;
  var $199 = $32 * 23 + 512 + $64 * -99 + $96 * 502 >> 10;
  var $200 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$200 >> 2] = $199;
  var $201 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$201 >> 2] = $115;
  var $208 = $118 * 426 + 512 + $124 * 810 + $130 * -360 >> 10;
  var $209 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$209 >> 2] = $208;
  var $210 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$210 >> 2] = $127;
  var $217 = $118 * 23 + 512 + $124 * -99 + $130 * 502 >> 10;
  var $218 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$218 >> 2] = $217;
  var $219 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$219 >> 2] = $140;
  var $226 = $147 * 426 + 512 + $161 * 810 + $175 * -360 >> 10;
  var $227 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$227 >> 2] = $226;
  var $228 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$228 >> 2] = $168;
  var $235 = $147 * 23 + 512 + $161 * -99 + $175 * 502 >> 10;
  var $236 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$236 >> 2] = $235;
  var $237 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$237 >> 2] = 0;
  var $238 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$238 >> 2] = 0;
  var $239 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$239 >> 2] = 0;
  var $240 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$240 >> 2] = 0;
  var $247 = $32 * 928 + 512 + $64 * -325 + $96 * 218 >> 10;
  var $248 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$248 >> 2] = $247;
  var $249 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$249 >> 2] = $48;
  var $256 = $32 * -75 + 512 + $64 * 526 + $96 * 787 >> 10;
  var $257 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$257 >> 2] = $256;
  var $258 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$258 >> 2] = $112;
  var $265 = $118 * 928 + 512 + $124 * -325 + $130 * 218 >> 10;
  var $266 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$266 >> 2] = $265;
  var $267 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$267 >> 2] = $121;
  var $274 = $118 * -75 + 512 + $124 * 526 + $130 * 787 >> 10;
  var $275 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$275 >> 2] = $274;
  var $276 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$276 >> 2] = $133;
  var $283 = $147 * 928 + 512 + $161 * -325 + $175 * 218 >> 10;
  var $284 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$284 >> 2] = $283;
  var $285 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$285 >> 2] = $154;
  var $292 = $147 * -75 + 512 + $161 * 526 + $175 * 787 >> 10;
  var $293 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$293 >> 2] = $292;
  var $294 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$294 >> 2] = $182;
  var $295 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$295 >> 2] = 0;
  var $296 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$296 >> 2] = 0;
  var $297 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$297 >> 2] = 0;
  var $298 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$298 >> 2] = 0;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi7ELi6EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi7ELi7EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 48 >> 1] << 16 >> 16;
  var $14 = HEAP16[$pSrc + 64 >> 1] << 16 >> 16;
  var $17 = HEAP16[$pSrc + 80 >> 1] << 16 >> 16;
  var $20 = HEAP16[$pSrc + 96 >> 1] << 16 >> 16;
  var $23 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $27 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $31 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $36 = $23 * 426 + 512 + $27 * 810 + $31 * -360 >> 10;
  var $39 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $43 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $47 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $52 = $39 * 426 + 512 + $43 * 810 + $47 * -360 >> 10;
  var $55 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $59 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $63 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $68 = $55 * 426 + 512 + $59 * 810 + $63 * -360 >> 10;
  var $71 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $75 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $79 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $84 = $71 * 426 + 512 + $75 * 810 + $79 * -360 >> 10;
  var $87 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $91 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $95 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $100 = $87 * 426 + 512 + $91 * 810 + $95 * -360 >> 10;
  var $103 = HEAP16[$pSrc + 82 >> 1] << 16 >> 16;
  var $107 = HEAP16[$pSrc + 86 >> 1] << 16 >> 16;
  var $111 = HEAP16[$pSrc + 90 >> 1] << 16 >> 16;
  var $116 = $103 * 426 + 512 + $107 * 810 + $111 * -360 >> 10;
  var $119 = HEAP16[$pSrc + 98 >> 1] << 16 >> 16;
  var $123 = HEAP16[$pSrc + 102 >> 1] << 16 >> 16;
  var $127 = HEAP16[$pSrc + 106 >> 1] << 16 >> 16;
  var $132 = $119 * 426 + 512 + $123 * 810 + $127 * -360 >> 10;
  var $135 = HEAP16[$pSrc + 8 >> 1] << 16 >> 16;
  var $138 = HEAP16[$pSrc + 24 >> 1] << 16 >> 16;
  var $141 = HEAP16[$pSrc + 40 >> 1] << 16 >> 16;
  var $144 = HEAP16[$pSrc + 56 >> 1] << 16 >> 16;
  var $147 = HEAP16[$pSrc + 72 >> 1] << 16 >> 16;
  var $150 = HEAP16[$pSrc + 88 >> 1] << 16 >> 16;
  var $153 = HEAP16[$pSrc + 104 >> 1] << 16 >> 16;
  var $160 = $23 * 23 + 512 + $27 * -99 + $31 * 502 >> 10;
  var $167 = $39 * 23 + 512 + $43 * -99 + $47 * 502 >> 10;
  var $174 = $55 * 23 + 512 + $59 * -99 + $63 * 502 >> 10;
  var $181 = $71 * 23 + 512 + $75 * -99 + $79 * 502 >> 10;
  var $188 = $87 * 23 + 512 + $91 * -99 + $95 * 502 >> 10;
  var $195 = $103 * 23 + 512 + $107 * -99 + $111 * 502 >> 10;
  var $202 = $119 * 23 + 512 + $123 * -99 + $127 * 502 >> 10;
  var $203 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$203 >> 2] = $2;
  var $210 = $5 * 426 + 512 + $11 * 810 + $17 * -360 >> 10;
  var $211 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$211 >> 2] = $210;
  var $212 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$212 >> 2] = $14;
  var $219 = $5 * 23 + 512 + $11 * -99 + $17 * 502 >> 10;
  var $220 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$220 >> 2] = $219;
  var $221 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$221 >> 2] = $36;
  var $228 = $52 * 426 + 512 + $84 * 810 + $116 * -360 >> 10;
  var $229 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$229 >> 2] = $228;
  var $230 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$230 >> 2] = $100;
  var $237 = $52 * 23 + 512 + $84 * -99 + $116 * 502 >> 10;
  var $238 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$238 >> 2] = $237;
  var $239 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$239 >> 2] = $135;
  var $246 = $138 * 426 + 512 + $144 * 810 + $150 * -360 >> 10;
  var $247 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$247 >> 2] = $246;
  var $248 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$248 >> 2] = $147;
  var $255 = $138 * 23 + 512 + $144 * -99 + $150 * 502 >> 10;
  var $256 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$256 >> 2] = $255;
  var $257 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$257 >> 2] = $160;
  var $264 = $167 * 426 + 512 + $181 * 810 + $195 * -360 >> 10;
  var $265 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$265 >> 2] = $264;
  var $266 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$266 >> 2] = $188;
  var $273 = $167 * 23 + 512 + $181 * -99 + $195 * 502 >> 10;
  var $274 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$274 >> 2] = $273;
  var $281 = $5 * 928 + 512 + $11 * -325 + $17 * 218 >> 10;
  var $282 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$282 >> 2] = $281;
  var $283 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$283 >> 2] = $8;
  var $290 = $5 * -75 + 512 + $11 * 526 + $17 * 787 >> 10;
  var $291 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$291 >> 2] = $290;
  var $292 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$292 >> 2] = $20;
  var $299 = $52 * 928 + 512 + $84 * -325 + $116 * 218 >> 10;
  var $300 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$300 >> 2] = $299;
  var $301 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$301 >> 2] = $68;
  var $308 = $52 * -75 + 512 + $84 * 526 + $116 * 787 >> 10;
  var $309 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$309 >> 2] = $308;
  var $310 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$310 >> 2] = $132;
  var $317 = $138 * 928 + 512 + $144 * -325 + $150 * 218 >> 10;
  var $318 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$318 >> 2] = $317;
  var $319 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$319 >> 2] = $141;
  var $326 = $138 * -75 + 512 + $144 * 526 + $150 * 787 >> 10;
  var $327 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$327 >> 2] = $326;
  var $328 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$328 >> 2] = $153;
  var $335 = $167 * 928 + 512 + $181 * -325 + $195 * 218 >> 10;
  var $336 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$336 >> 2] = $335;
  var $337 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$337 >> 2] = $174;
  var $344 = $167 * -75 + 512 + $181 * 526 + $195 * 787 >> 10;
  var $345 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$345 >> 2] = $344;
  var $346 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$346 >> 2] = $202;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi7ELi7EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi7ELi7EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc) {
  var $3 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $7 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $16 = $3 * 928 + 512 + $7 * -325 + $11 * 218 >> 10;
  var $19 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $23 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $27 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $32 = $19 * 928 + 512 + $23 * -325 + $27 * 218 >> 10;
  var $35 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $39 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $43 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $48 = $35 * 928 + 512 + $39 * -325 + $43 * 218 >> 10;
  var $51 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $55 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $59 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $64 = $51 * 928 + 512 + $55 * -325 + $59 * 218 >> 10;
  var $67 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $71 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $75 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $80 = $67 * 928 + 512 + $71 * -325 + $75 * 218 >> 10;
  var $83 = HEAP16[$pSrc + 82 >> 1] << 16 >> 16;
  var $87 = HEAP16[$pSrc + 86 >> 1] << 16 >> 16;
  var $91 = HEAP16[$pSrc + 90 >> 1] << 16 >> 16;
  var $96 = $83 * 928 + 512 + $87 * -325 + $91 * 218 >> 10;
  var $99 = HEAP16[$pSrc + 98 >> 1] << 16 >> 16;
  var $103 = HEAP16[$pSrc + 102 >> 1] << 16 >> 16;
  var $107 = HEAP16[$pSrc + 106 >> 1] << 16 >> 16;
  var $112 = $99 * 928 + 512 + $103 * -325 + $107 * 218 >> 10;
  var $115 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $118 = HEAP16[$pSrc + 20 >> 1] << 16 >> 16;
  var $121 = HEAP16[$pSrc + 36 >> 1] << 16 >> 16;
  var $124 = HEAP16[$pSrc + 52 >> 1] << 16 >> 16;
  var $127 = HEAP16[$pSrc + 68 >> 1] << 16 >> 16;
  var $130 = HEAP16[$pSrc + 84 >> 1] << 16 >> 16;
  var $133 = HEAP16[$pSrc + 100 >> 1] << 16 >> 16;
  var $140 = $3 * -75 + 512 + $7 * 526 + $11 * 787 >> 10;
  var $147 = $19 * -75 + 512 + $23 * 526 + $27 * 787 >> 10;
  var $154 = $35 * -75 + 512 + $39 * 526 + $43 * 787 >> 10;
  var $161 = $51 * -75 + 512 + $55 * 526 + $59 * 787 >> 10;
  var $168 = $67 * -75 + 512 + $71 * 526 + $75 * 787 >> 10;
  var $175 = $83 * -75 + 512 + $87 * 526 + $91 * 787 >> 10;
  var $182 = $99 * -75 + 512 + $103 * 526 + $107 * 787 >> 10;
  var $185 = HEAP16[$pSrc + 12 >> 1] << 16 >> 16;
  var $188 = HEAP16[$pSrc + 28 >> 1] << 16 >> 16;
  var $191 = HEAP16[$pSrc + 44 >> 1] << 16 >> 16;
  var $194 = HEAP16[$pSrc + 60 >> 1] << 16 >> 16;
  var $197 = HEAP16[$pSrc + 76 >> 1] << 16 >> 16;
  var $200 = HEAP16[$pSrc + 92 >> 1] << 16 >> 16;
  var $203 = HEAP16[$pSrc + 108 >> 1] << 16 >> 16;
  var $204 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$204 >> 2] = $16;
  var $211 = $32 * 426 + 512 + $64 * 810 + $96 * -360 >> 10;
  var $212 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$212 >> 2] = $211;
  var $213 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$213 >> 2] = $80;
  var $220 = $32 * 23 + 512 + $64 * -99 + $96 * 502 >> 10;
  var $221 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$221 >> 2] = $220;
  var $222 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$222 >> 2] = $115;
  var $229 = $118 * 426 + 512 + $124 * 810 + $130 * -360 >> 10;
  var $230 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$230 >> 2] = $229;
  var $231 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$231 >> 2] = $127;
  var $238 = $118 * 23 + 512 + $124 * -99 + $130 * 502 >> 10;
  var $239 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$239 >> 2] = $238;
  var $240 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$240 >> 2] = $140;
  var $247 = $147 * 426 + 512 + $161 * 810 + $175 * -360 >> 10;
  var $248 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$248 >> 2] = $247;
  var $249 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$249 >> 2] = $168;
  var $256 = $147 * 23 + 512 + $161 * -99 + $175 * 502 >> 10;
  var $257 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$257 >> 2] = $256;
  var $258 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$258 >> 2] = $185;
  var $265 = $188 * 426 + 512 + $194 * 810 + $200 * -360 >> 10;
  var $266 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$266 >> 2] = $265;
  var $267 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$267 >> 2] = $197;
  var $274 = $188 * 23 + 512 + $194 * -99 + $200 * 502 >> 10;
  var $275 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$275 >> 2] = $274;
  var $282 = $32 * 928 + 512 + $64 * -325 + $96 * 218 >> 10;
  var $283 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$283 >> 2] = $282;
  var $284 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$284 >> 2] = $48;
  var $291 = $32 * -75 + 512 + $64 * 526 + $96 * 787 >> 10;
  var $292 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$292 >> 2] = $291;
  var $293 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$293 >> 2] = $112;
  var $300 = $118 * 928 + 512 + $124 * -325 + $130 * 218 >> 10;
  var $301 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$301 >> 2] = $300;
  var $302 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$302 >> 2] = $121;
  var $309 = $118 * -75 + 512 + $124 * 526 + $130 * 787 >> 10;
  var $310 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$310 >> 2] = $309;
  var $311 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$311 >> 2] = $133;
  var $318 = $147 * 928 + 512 + $161 * -325 + $175 * 218 >> 10;
  var $319 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$319 >> 2] = $318;
  var $320 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$320 >> 2] = $154;
  var $327 = $147 * -75 + 512 + $161 * 526 + $175 * 787 >> 10;
  var $328 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$328 >> 2] = $327;
  var $329 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$329 >> 2] = $182;
  var $336 = $188 * 928 + 512 + $194 * -325 + $200 * 218 >> 10;
  var $337 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$337 >> 2] = $336;
  var $338 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$338 >> 2] = $191;
  var $345 = $188 * -75 + 512 + $194 * 526 + $200 * 787 >> 10;
  var $346 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$346 >> 2] = $345;
  var $347 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$347 >> 2] = $203;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi7ELi7EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi7ELi8EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 48 >> 1] << 16 >> 16;
  var $14 = HEAP16[$pSrc + 64 >> 1] << 16 >> 16;
  var $17 = HEAP16[$pSrc + 80 >> 1] << 16 >> 16;
  var $20 = HEAP16[$pSrc + 96 >> 1] << 16 >> 16;
  var $23 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $27 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $31 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $35 = HEAP16[$pSrc + 14 >> 1] << 16 >> 16;
  var $41 = $23 * 426 + 512 + $27 * 810 + $31 * -360 + $35 * 284 >> 10;
  var $44 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $48 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $52 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $56 = HEAP16[$pSrc + 30 >> 1] << 16 >> 16;
  var $62 = $44 * 426 + 512 + $48 * 810 + $52 * -360 + $56 * 284 >> 10;
  var $65 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $69 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $73 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $77 = HEAP16[$pSrc + 46 >> 1] << 16 >> 16;
  var $83 = $65 * 426 + 512 + $69 * 810 + $73 * -360 + $77 * 284 >> 10;
  var $86 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $90 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $94 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $98 = HEAP16[$pSrc + 62 >> 1] << 16 >> 16;
  var $104 = $86 * 426 + 512 + $90 * 810 + $94 * -360 + $98 * 284 >> 10;
  var $107 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $111 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $115 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $119 = HEAP16[$pSrc + 78 >> 1] << 16 >> 16;
  var $125 = $107 * 426 + 512 + $111 * 810 + $115 * -360 + $119 * 284 >> 10;
  var $128 = HEAP16[$pSrc + 82 >> 1] << 16 >> 16;
  var $132 = HEAP16[$pSrc + 86 >> 1] << 16 >> 16;
  var $136 = HEAP16[$pSrc + 90 >> 1] << 16 >> 16;
  var $140 = HEAP16[$pSrc + 94 >> 1] << 16 >> 16;
  var $146 = $128 * 426 + 512 + $132 * 810 + $136 * -360 + $140 * 284 >> 10;
  var $149 = HEAP16[$pSrc + 98 >> 1] << 16 >> 16;
  var $153 = HEAP16[$pSrc + 102 >> 1] << 16 >> 16;
  var $157 = HEAP16[$pSrc + 106 >> 1] << 16 >> 16;
  var $161 = HEAP16[$pSrc + 110 >> 1] << 16 >> 16;
  var $167 = $149 * 426 + 512 + $153 * 810 + $157 * -360 + $161 * 284 >> 10;
  var $170 = HEAP16[$pSrc + 8 >> 1] << 16 >> 16;
  var $173 = HEAP16[$pSrc + 24 >> 1] << 16 >> 16;
  var $176 = HEAP16[$pSrc + 40 >> 1] << 16 >> 16;
  var $179 = HEAP16[$pSrc + 56 >> 1] << 16 >> 16;
  var $182 = HEAP16[$pSrc + 72 >> 1] << 16 >> 16;
  var $185 = HEAP16[$pSrc + 88 >> 1] << 16 >> 16;
  var $188 = HEAP16[$pSrc + 104 >> 1] << 16 >> 16;
  var $197 = $23 * 23 + 512 + $27 * -99 + $31 * 502 + $35 * 887 >> 10;
  var $206 = $44 * 23 + 512 + $48 * -99 + $52 * 502 + $56 * 887 >> 10;
  var $215 = $65 * 23 + 512 + $69 * -99 + $73 * 502 + $77 * 887 >> 10;
  var $224 = $86 * 23 + 512 + $90 * -99 + $94 * 502 + $98 * 887 >> 10;
  var $233 = $107 * 23 + 512 + $111 * -99 + $115 * 502 + $119 * 887 >> 10;
  var $242 = $128 * 23 + 512 + $132 * -99 + $136 * 502 + $140 * 887 >> 10;
  var $251 = $149 * 23 + 512 + $153 * -99 + $157 * 502 + $161 * 887 >> 10;
  var $252 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$252 >> 2] = $2;
  var $259 = $5 * 426 + 512 + $11 * 810 + $17 * -360 >> 10;
  var $260 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$260 >> 2] = $259;
  var $261 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$261 >> 2] = $14;
  var $268 = $5 * 23 + 512 + $11 * -99 + $17 * 502 >> 10;
  var $269 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$269 >> 2] = $268;
  var $270 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$270 >> 2] = $41;
  var $277 = $62 * 426 + 512 + $104 * 810 + $146 * -360 >> 10;
  var $278 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$278 >> 2] = $277;
  var $279 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$279 >> 2] = $125;
  var $286 = $62 * 23 + 512 + $104 * -99 + $146 * 502 >> 10;
  var $287 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$287 >> 2] = $286;
  var $288 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$288 >> 2] = $170;
  var $295 = $173 * 426 + 512 + $179 * 810 + $185 * -360 >> 10;
  var $296 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$296 >> 2] = $295;
  var $297 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$297 >> 2] = $182;
  var $304 = $173 * 23 + 512 + $179 * -99 + $185 * 502 >> 10;
  var $305 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$305 >> 2] = $304;
  var $306 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$306 >> 2] = $197;
  var $313 = $206 * 426 + 512 + $224 * 810 + $242 * -360 >> 10;
  var $314 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$314 >> 2] = $313;
  var $315 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$315 >> 2] = $233;
  var $322 = $206 * 23 + 512 + $224 * -99 + $242 * 502 >> 10;
  var $323 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$323 >> 2] = $322;
  var $330 = $5 * 928 + 512 + $11 * -325 + $17 * 218 >> 10;
  var $331 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$331 >> 2] = $330;
  var $332 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$332 >> 2] = $8;
  var $339 = $5 * -75 + 512 + $11 * 526 + $17 * 787 >> 10;
  var $340 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$340 >> 2] = $339;
  var $341 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$341 >> 2] = $20;
  var $348 = $62 * 928 + 512 + $104 * -325 + $146 * 218 >> 10;
  var $349 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$349 >> 2] = $348;
  var $350 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$350 >> 2] = $83;
  var $357 = $62 * -75 + 512 + $104 * 526 + $146 * 787 >> 10;
  var $358 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$358 >> 2] = $357;
  var $359 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$359 >> 2] = $167;
  var $366 = $173 * 928 + 512 + $179 * -325 + $185 * 218 >> 10;
  var $367 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$367 >> 2] = $366;
  var $368 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$368 >> 2] = $176;
  var $375 = $173 * -75 + 512 + $179 * 526 + $185 * 787 >> 10;
  var $376 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$376 >> 2] = $375;
  var $377 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$377 >> 2] = $188;
  var $384 = $206 * 928 + 512 + $224 * -325 + $242 * 218 >> 10;
  var $385 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$385 >> 2] = $384;
  var $386 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$386 >> 2] = $215;
  var $393 = $206 * -75 + 512 + $224 * 526 + $242 * 787 >> 10;
  var $394 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$394 >> 2] = $393;
  var $395 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$395 >> 2] = $251;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi7ELi8EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi7ELi8EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc) {
  var $3 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $7 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $15 = HEAP16[$pSrc + 14 >> 1] << 16 >> 16;
  var $21 = $3 * 928 + 512 + $7 * -325 + $11 * 218 + $15 * -184 >> 10;
  var $24 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $28 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $32 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $36 = HEAP16[$pSrc + 30 >> 1] << 16 >> 16;
  var $42 = $24 * 928 + 512 + $28 * -325 + $32 * 218 + $36 * -184 >> 10;
  var $45 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $49 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $53 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $57 = HEAP16[$pSrc + 46 >> 1] << 16 >> 16;
  var $63 = $45 * 928 + 512 + $49 * -325 + $53 * 218 + $57 * -184 >> 10;
  var $66 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $70 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $74 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $78 = HEAP16[$pSrc + 62 >> 1] << 16 >> 16;
  var $84 = $66 * 928 + 512 + $70 * -325 + $74 * 218 + $78 * -184 >> 10;
  var $87 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $91 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $95 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $99 = HEAP16[$pSrc + 78 >> 1] << 16 >> 16;
  var $105 = $87 * 928 + 512 + $91 * -325 + $95 * 218 + $99 * -184 >> 10;
  var $108 = HEAP16[$pSrc + 82 >> 1] << 16 >> 16;
  var $112 = HEAP16[$pSrc + 86 >> 1] << 16 >> 16;
  var $116 = HEAP16[$pSrc + 90 >> 1] << 16 >> 16;
  var $120 = HEAP16[$pSrc + 94 >> 1] << 16 >> 16;
  var $126 = $108 * 928 + 512 + $112 * -325 + $116 * 218 + $120 * -184 >> 10;
  var $129 = HEAP16[$pSrc + 98 >> 1] << 16 >> 16;
  var $133 = HEAP16[$pSrc + 102 >> 1] << 16 >> 16;
  var $137 = HEAP16[$pSrc + 106 >> 1] << 16 >> 16;
  var $141 = HEAP16[$pSrc + 110 >> 1] << 16 >> 16;
  var $147 = $129 * 928 + 512 + $133 * -325 + $137 * 218 + $141 * -184 >> 10;
  var $150 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $153 = HEAP16[$pSrc + 20 >> 1] << 16 >> 16;
  var $156 = HEAP16[$pSrc + 36 >> 1] << 16 >> 16;
  var $159 = HEAP16[$pSrc + 52 >> 1] << 16 >> 16;
  var $162 = HEAP16[$pSrc + 68 >> 1] << 16 >> 16;
  var $165 = HEAP16[$pSrc + 84 >> 1] << 16 >> 16;
  var $168 = HEAP16[$pSrc + 100 >> 1] << 16 >> 16;
  var $177 = $3 * -75 + 512 + $7 * 526 + $11 * 787 + $15 * -383 >> 10;
  var $186 = $24 * -75 + 512 + $28 * 526 + $32 * 787 + $36 * -383 >> 10;
  var $195 = $45 * -75 + 512 + $49 * 526 + $53 * 787 + $57 * -383 >> 10;
  var $204 = $66 * -75 + 512 + $70 * 526 + $74 * 787 + $78 * -383 >> 10;
  var $213 = $87 * -75 + 512 + $91 * 526 + $95 * 787 + $99 * -383 >> 10;
  var $222 = $108 * -75 + 512 + $112 * 526 + $116 * 787 + $120 * -383 >> 10;
  var $231 = $129 * -75 + 512 + $133 * 526 + $137 * 787 + $141 * -383 >> 10;
  var $234 = HEAP16[$pSrc + 12 >> 1] << 16 >> 16;
  var $237 = HEAP16[$pSrc + 28 >> 1] << 16 >> 16;
  var $240 = HEAP16[$pSrc + 44 >> 1] << 16 >> 16;
  var $243 = HEAP16[$pSrc + 60 >> 1] << 16 >> 16;
  var $246 = HEAP16[$pSrc + 76 >> 1] << 16 >> 16;
  var $249 = HEAP16[$pSrc + 92 >> 1] << 16 >> 16;
  var $252 = HEAP16[$pSrc + 108 >> 1] << 16 >> 16;
  var $253 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$253 >> 2] = $21;
  var $260 = $42 * 426 + 512 + $84 * 810 + $126 * -360 >> 10;
  var $261 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$261 >> 2] = $260;
  var $262 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$262 >> 2] = $105;
  var $269 = $42 * 23 + 512 + $84 * -99 + $126 * 502 >> 10;
  var $270 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$270 >> 2] = $269;
  var $271 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$271 >> 2] = $150;
  var $278 = $153 * 426 + 512 + $159 * 810 + $165 * -360 >> 10;
  var $279 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$279 >> 2] = $278;
  var $280 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$280 >> 2] = $162;
  var $287 = $153 * 23 + 512 + $159 * -99 + $165 * 502 >> 10;
  var $288 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$288 >> 2] = $287;
  var $289 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$289 >> 2] = $177;
  var $296 = $186 * 426 + 512 + $204 * 810 + $222 * -360 >> 10;
  var $297 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$297 >> 2] = $296;
  var $298 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$298 >> 2] = $213;
  var $305 = $186 * 23 + 512 + $204 * -99 + $222 * 502 >> 10;
  var $306 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$306 >> 2] = $305;
  var $307 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$307 >> 2] = $234;
  var $314 = $237 * 426 + 512 + $243 * 810 + $249 * -360 >> 10;
  var $315 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$315 >> 2] = $314;
  var $316 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$316 >> 2] = $246;
  var $323 = $237 * 23 + 512 + $243 * -99 + $249 * 502 >> 10;
  var $324 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$324 >> 2] = $323;
  var $331 = $42 * 928 + 512 + $84 * -325 + $126 * 218 >> 10;
  var $332 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$332 >> 2] = $331;
  var $333 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$333 >> 2] = $63;
  var $340 = $42 * -75 + 512 + $84 * 526 + $126 * 787 >> 10;
  var $341 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$341 >> 2] = $340;
  var $342 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$342 >> 2] = $147;
  var $349 = $153 * 928 + 512 + $159 * -325 + $165 * 218 >> 10;
  var $350 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$350 >> 2] = $349;
  var $351 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$351 >> 2] = $156;
  var $358 = $153 * -75 + 512 + $159 * 526 + $165 * 787 >> 10;
  var $359 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$359 >> 2] = $358;
  var $360 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$360 >> 2] = $168;
  var $367 = $186 * 928 + 512 + $204 * -325 + $222 * 218 >> 10;
  var $368 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$368 >> 2] = $367;
  var $369 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$369 >> 2] = $195;
  var $376 = $186 * -75 + 512 + $204 * 526 + $222 * 787 >> 10;
  var $377 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$377 >> 2] = $376;
  var $378 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$378 >> 2] = $231;
  var $385 = $237 * 928 + 512 + $243 * -325 + $249 * 218 >> 10;
  var $386 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$386 >> 2] = $385;
  var $387 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$387 >> 2] = $240;
  var $394 = $237 * -75 + 512 + $243 * 526 + $249 * 787 >> 10;
  var $395 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$395 >> 2] = $394;
  var $396 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$396 >> 2] = $252;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi7ELi8EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3P_QILi8ELi8EE4calcERNS0_8Matrix44ES4_PKs($P, $Q, $pSrc) {
  var $2 = HEAP16[$pSrc >> 1] << 16 >> 16;
  var $5 = HEAP16[$pSrc + 16 >> 1] << 16 >> 16;
  var $8 = HEAP16[$pSrc + 32 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 48 >> 1] << 16 >> 16;
  var $14 = HEAP16[$pSrc + 64 >> 1] << 16 >> 16;
  var $17 = HEAP16[$pSrc + 80 >> 1] << 16 >> 16;
  var $20 = HEAP16[$pSrc + 96 >> 1] << 16 >> 16;
  var $23 = HEAP16[$pSrc + 112 >> 1] << 16 >> 16;
  var $26 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $30 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $34 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $38 = HEAP16[$pSrc + 14 >> 1] << 16 >> 16;
  var $44 = $26 * 426 + 512 + $30 * 810 + $34 * -360 + $38 * 284 >> 10;
  var $47 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $51 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $55 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $59 = HEAP16[$pSrc + 30 >> 1] << 16 >> 16;
  var $65 = $47 * 426 + 512 + $51 * 810 + $55 * -360 + $59 * 284 >> 10;
  var $68 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $72 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $76 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $80 = HEAP16[$pSrc + 46 >> 1] << 16 >> 16;
  var $86 = $68 * 426 + 512 + $72 * 810 + $76 * -360 + $80 * 284 >> 10;
  var $89 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $93 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $97 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $101 = HEAP16[$pSrc + 62 >> 1] << 16 >> 16;
  var $107 = $89 * 426 + 512 + $93 * 810 + $97 * -360 + $101 * 284 >> 10;
  var $110 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $114 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $118 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $122 = HEAP16[$pSrc + 78 >> 1] << 16 >> 16;
  var $128 = $110 * 426 + 512 + $114 * 810 + $118 * -360 + $122 * 284 >> 10;
  var $131 = HEAP16[$pSrc + 82 >> 1] << 16 >> 16;
  var $135 = HEAP16[$pSrc + 86 >> 1] << 16 >> 16;
  var $139 = HEAP16[$pSrc + 90 >> 1] << 16 >> 16;
  var $143 = HEAP16[$pSrc + 94 >> 1] << 16 >> 16;
  var $149 = $131 * 426 + 512 + $135 * 810 + $139 * -360 + $143 * 284 >> 10;
  var $152 = HEAP16[$pSrc + 98 >> 1] << 16 >> 16;
  var $156 = HEAP16[$pSrc + 102 >> 1] << 16 >> 16;
  var $160 = HEAP16[$pSrc + 106 >> 1] << 16 >> 16;
  var $164 = HEAP16[$pSrc + 110 >> 1] << 16 >> 16;
  var $170 = $152 * 426 + 512 + $156 * 810 + $160 * -360 + $164 * 284 >> 10;
  var $173 = HEAP16[$pSrc + 114 >> 1] << 16 >> 16;
  var $177 = HEAP16[$pSrc + 118 >> 1] << 16 >> 16;
  var $181 = HEAP16[$pSrc + 122 >> 1] << 16 >> 16;
  var $185 = HEAP16[$pSrc + 126 >> 1] << 16 >> 16;
  var $191 = $173 * 426 + 512 + $177 * 810 + $181 * -360 + $185 * 284 >> 10;
  var $194 = HEAP16[$pSrc + 8 >> 1] << 16 >> 16;
  var $197 = HEAP16[$pSrc + 24 >> 1] << 16 >> 16;
  var $200 = HEAP16[$pSrc + 40 >> 1] << 16 >> 16;
  var $203 = HEAP16[$pSrc + 56 >> 1] << 16 >> 16;
  var $206 = HEAP16[$pSrc + 72 >> 1] << 16 >> 16;
  var $209 = HEAP16[$pSrc + 88 >> 1] << 16 >> 16;
  var $212 = HEAP16[$pSrc + 104 >> 1] << 16 >> 16;
  var $215 = HEAP16[$pSrc + 120 >> 1] << 16 >> 16;
  var $224 = $26 * 23 + 512 + $30 * -99 + $34 * 502 + $38 * 887 >> 10;
  var $233 = $47 * 23 + 512 + $51 * -99 + $55 * 502 + $59 * 887 >> 10;
  var $242 = $68 * 23 + 512 + $72 * -99 + $76 * 502 + $80 * 887 >> 10;
  var $251 = $89 * 23 + 512 + $93 * -99 + $97 * 502 + $101 * 887 >> 10;
  var $260 = $110 * 23 + 512 + $114 * -99 + $118 * 502 + $122 * 887 >> 10;
  var $269 = $131 * 23 + 512 + $135 * -99 + $139 * 502 + $143 * 887 >> 10;
  var $278 = $152 * 23 + 512 + $156 * -99 + $160 * 502 + $164 * 887 >> 10;
  var $287 = $173 * 23 + 512 + $177 * -99 + $181 * 502 + $185 * 887 >> 10;
  var $288 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 0);
  HEAP32[$288 >> 2] = $2;
  var $297 = $5 * 426 + 512 + $11 * 810 + $17 * -360 + $23 * 284 >> 10;
  var $298 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 1);
  HEAP32[$298 >> 2] = $297;
  var $299 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 2);
  HEAP32[$299 >> 2] = $14;
  var $308 = $5 * 23 + 512 + $11 * -99 + $17 * 502 + $23 * 887 >> 10;
  var $309 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 0, 3);
  HEAP32[$309 >> 2] = $308;
  var $310 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 0);
  HEAP32[$310 >> 2] = $44;
  var $319 = $65 * 426 + 512 + $107 * 810 + $149 * -360 + $191 * 284 >> 10;
  var $320 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 1);
  HEAP32[$320 >> 2] = $319;
  var $321 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 2);
  HEAP32[$321 >> 2] = $128;
  var $330 = $65 * 23 + 512 + $107 * -99 + $149 * 502 + $191 * 887 >> 10;
  var $331 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 1, 3);
  HEAP32[$331 >> 2] = $330;
  var $332 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 0);
  HEAP32[$332 >> 2] = $194;
  var $341 = $197 * 426 + 512 + $203 * 810 + $209 * -360 + $215 * 284 >> 10;
  var $342 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 1);
  HEAP32[$342 >> 2] = $341;
  var $343 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 2);
  HEAP32[$343 >> 2] = $206;
  var $352 = $197 * 23 + 512 + $203 * -99 + $209 * 502 + $215 * 887 >> 10;
  var $353 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 2, 3);
  HEAP32[$353 >> 2] = $352;
  var $354 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 0);
  HEAP32[$354 >> 2] = $224;
  var $363 = $233 * 426 + 512 + $251 * 810 + $269 * -360 + $287 * 284 >> 10;
  var $364 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 1);
  HEAP32[$364 >> 2] = $363;
  var $365 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 2);
  HEAP32[$365 >> 2] = $260;
  var $374 = $233 * 23 + 512 + $251 * -99 + $269 * 502 + $287 * 887 >> 10;
  var $375 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($P, 3, 3);
  HEAP32[$375 >> 2] = $374;
  var $384 = $5 * 928 + 512 + $11 * -325 + $17 * 218 + $23 * -184 >> 10;
  var $385 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 0);
  HEAP32[$385 >> 2] = $384;
  var $386 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 1);
  HEAP32[$386 >> 2] = $8;
  var $395 = $5 * -75 + 512 + $11 * 526 + $17 * 787 + $23 * -383 >> 10;
  var $396 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 2);
  HEAP32[$396 >> 2] = $395;
  var $397 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 0, 3);
  HEAP32[$397 >> 2] = $20;
  var $406 = $65 * 928 + 512 + $107 * -325 + $149 * 218 + $191 * -184 >> 10;
  var $407 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 0);
  HEAP32[$407 >> 2] = $406;
  var $408 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 1);
  HEAP32[$408 >> 2] = $86;
  var $417 = $65 * -75 + 512 + $107 * 526 + $149 * 787 + $191 * -383 >> 10;
  var $418 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 2);
  HEAP32[$418 >> 2] = $417;
  var $419 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 1, 3);
  HEAP32[$419 >> 2] = $170;
  var $428 = $197 * 928 + 512 + $203 * -325 + $209 * 218 + $215 * -184 >> 10;
  var $429 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 0);
  HEAP32[$429 >> 2] = $428;
  var $430 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 1);
  HEAP32[$430 >> 2] = $200;
  var $439 = $197 * -75 + 512 + $203 * 526 + $209 * 787 + $215 * -383 >> 10;
  var $440 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 2);
  HEAP32[$440 >> 2] = $439;
  var $441 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 2, 3);
  HEAP32[$441 >> 2] = $212;
  var $450 = $233 * 928 + 512 + $251 * -325 + $269 * 218 + $287 * -184 >> 10;
  var $451 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 0);
  HEAP32[$451 >> 2] = $450;
  var $452 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 1);
  HEAP32[$452 >> 2] = $242;
  var $461 = $233 * -75 + 512 + $251 * 526 + $269 * 787 + $287 * -383 >> 10;
  var $462 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 2);
  HEAP32[$462 >> 2] = $461;
  var $463 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($Q, 3, 3);
  HEAP32[$463 >> 2] = $278;
  return;
}

__ZN4jpgd12DCT_Upsample3P_QILi8ELi8EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgd12DCT_Upsample3R_SILi8ELi8EE4calcERNS0_8Matrix44ES4_PKs($R, $S, $pSrc) {
  var $3 = HEAP16[$pSrc + 2 >> 1] << 16 >> 16;
  var $7 = HEAP16[$pSrc + 6 >> 1] << 16 >> 16;
  var $11 = HEAP16[$pSrc + 10 >> 1] << 16 >> 16;
  var $15 = HEAP16[$pSrc + 14 >> 1] << 16 >> 16;
  var $21 = $3 * 928 + 512 + $7 * -325 + $11 * 218 + $15 * -184 >> 10;
  var $24 = HEAP16[$pSrc + 18 >> 1] << 16 >> 16;
  var $28 = HEAP16[$pSrc + 22 >> 1] << 16 >> 16;
  var $32 = HEAP16[$pSrc + 26 >> 1] << 16 >> 16;
  var $36 = HEAP16[$pSrc + 30 >> 1] << 16 >> 16;
  var $42 = $24 * 928 + 512 + $28 * -325 + $32 * 218 + $36 * -184 >> 10;
  var $45 = HEAP16[$pSrc + 34 >> 1] << 16 >> 16;
  var $49 = HEAP16[$pSrc + 38 >> 1] << 16 >> 16;
  var $53 = HEAP16[$pSrc + 42 >> 1] << 16 >> 16;
  var $57 = HEAP16[$pSrc + 46 >> 1] << 16 >> 16;
  var $63 = $45 * 928 + 512 + $49 * -325 + $53 * 218 + $57 * -184 >> 10;
  var $66 = HEAP16[$pSrc + 50 >> 1] << 16 >> 16;
  var $70 = HEAP16[$pSrc + 54 >> 1] << 16 >> 16;
  var $74 = HEAP16[$pSrc + 58 >> 1] << 16 >> 16;
  var $78 = HEAP16[$pSrc + 62 >> 1] << 16 >> 16;
  var $84 = $66 * 928 + 512 + $70 * -325 + $74 * 218 + $78 * -184 >> 10;
  var $87 = HEAP16[$pSrc + 66 >> 1] << 16 >> 16;
  var $91 = HEAP16[$pSrc + 70 >> 1] << 16 >> 16;
  var $95 = HEAP16[$pSrc + 74 >> 1] << 16 >> 16;
  var $99 = HEAP16[$pSrc + 78 >> 1] << 16 >> 16;
  var $105 = $87 * 928 + 512 + $91 * -325 + $95 * 218 + $99 * -184 >> 10;
  var $108 = HEAP16[$pSrc + 82 >> 1] << 16 >> 16;
  var $112 = HEAP16[$pSrc + 86 >> 1] << 16 >> 16;
  var $116 = HEAP16[$pSrc + 90 >> 1] << 16 >> 16;
  var $120 = HEAP16[$pSrc + 94 >> 1] << 16 >> 16;
  var $126 = $108 * 928 + 512 + $112 * -325 + $116 * 218 + $120 * -184 >> 10;
  var $129 = HEAP16[$pSrc + 98 >> 1] << 16 >> 16;
  var $133 = HEAP16[$pSrc + 102 >> 1] << 16 >> 16;
  var $137 = HEAP16[$pSrc + 106 >> 1] << 16 >> 16;
  var $141 = HEAP16[$pSrc + 110 >> 1] << 16 >> 16;
  var $147 = $129 * 928 + 512 + $133 * -325 + $137 * 218 + $141 * -184 >> 10;
  var $150 = HEAP16[$pSrc + 114 >> 1] << 16 >> 16;
  var $154 = HEAP16[$pSrc + 118 >> 1] << 16 >> 16;
  var $158 = HEAP16[$pSrc + 122 >> 1] << 16 >> 16;
  var $162 = HEAP16[$pSrc + 126 >> 1] << 16 >> 16;
  var $168 = $150 * 928 + 512 + $154 * -325 + $158 * 218 + $162 * -184 >> 10;
  var $171 = HEAP16[$pSrc + 4 >> 1] << 16 >> 16;
  var $174 = HEAP16[$pSrc + 20 >> 1] << 16 >> 16;
  var $177 = HEAP16[$pSrc + 36 >> 1] << 16 >> 16;
  var $180 = HEAP16[$pSrc + 52 >> 1] << 16 >> 16;
  var $183 = HEAP16[$pSrc + 68 >> 1] << 16 >> 16;
  var $186 = HEAP16[$pSrc + 84 >> 1] << 16 >> 16;
  var $189 = HEAP16[$pSrc + 100 >> 1] << 16 >> 16;
  var $192 = HEAP16[$pSrc + 116 >> 1] << 16 >> 16;
  var $201 = $3 * -75 + 512 + $7 * 526 + $11 * 787 + $15 * -383 >> 10;
  var $210 = $24 * -75 + 512 + $28 * 526 + $32 * 787 + $36 * -383 >> 10;
  var $219 = $45 * -75 + 512 + $49 * 526 + $53 * 787 + $57 * -383 >> 10;
  var $228 = $66 * -75 + 512 + $70 * 526 + $74 * 787 + $78 * -383 >> 10;
  var $237 = $87 * -75 + 512 + $91 * 526 + $95 * 787 + $99 * -383 >> 10;
  var $246 = $108 * -75 + 512 + $112 * 526 + $116 * 787 + $120 * -383 >> 10;
  var $255 = $129 * -75 + 512 + $133 * 526 + $137 * 787 + $141 * -383 >> 10;
  var $264 = $150 * -75 + 512 + $154 * 526 + $158 * 787 + $162 * -383 >> 10;
  var $267 = HEAP16[$pSrc + 12 >> 1] << 16 >> 16;
  var $270 = HEAP16[$pSrc + 28 >> 1] << 16 >> 16;
  var $273 = HEAP16[$pSrc + 44 >> 1] << 16 >> 16;
  var $276 = HEAP16[$pSrc + 60 >> 1] << 16 >> 16;
  var $279 = HEAP16[$pSrc + 76 >> 1] << 16 >> 16;
  var $282 = HEAP16[$pSrc + 92 >> 1] << 16 >> 16;
  var $285 = HEAP16[$pSrc + 108 >> 1] << 16 >> 16;
  var $288 = HEAP16[$pSrc + 124 >> 1] << 16 >> 16;
  var $289 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 0);
  HEAP32[$289 >> 2] = $21;
  var $298 = $42 * 426 + 512 + $84 * 810 + $126 * -360 + $168 * 284 >> 10;
  var $299 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 1);
  HEAP32[$299 >> 2] = $298;
  var $300 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 2);
  HEAP32[$300 >> 2] = $105;
  var $309 = $42 * 23 + 512 + $84 * -99 + $126 * 502 + $168 * 887 >> 10;
  var $310 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 0, 3);
  HEAP32[$310 >> 2] = $309;
  var $311 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 0);
  HEAP32[$311 >> 2] = $171;
  var $320 = $174 * 426 + 512 + $180 * 810 + $186 * -360 + $192 * 284 >> 10;
  var $321 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 1);
  HEAP32[$321 >> 2] = $320;
  var $322 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 2);
  HEAP32[$322 >> 2] = $183;
  var $331 = $174 * 23 + 512 + $180 * -99 + $186 * 502 + $192 * 887 >> 10;
  var $332 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 1, 3);
  HEAP32[$332 >> 2] = $331;
  var $333 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 0);
  HEAP32[$333 >> 2] = $201;
  var $342 = $210 * 426 + 512 + $228 * 810 + $246 * -360 + $264 * 284 >> 10;
  var $343 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 1);
  HEAP32[$343 >> 2] = $342;
  var $344 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 2);
  HEAP32[$344 >> 2] = $237;
  var $353 = $210 * 23 + 512 + $228 * -99 + $246 * 502 + $264 * 887 >> 10;
  var $354 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 2, 3);
  HEAP32[$354 >> 2] = $353;
  var $355 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 0);
  HEAP32[$355 >> 2] = $267;
  var $364 = $270 * 426 + 512 + $276 * 810 + $282 * -360 + $288 * 284 >> 10;
  var $365 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 1);
  HEAP32[$365 >> 2] = $364;
  var $366 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 2);
  HEAP32[$366 >> 2] = $279;
  var $375 = $270 * 23 + 512 + $276 * -99 + $282 * 502 + $288 * 887 >> 10;
  var $376 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($R, 3, 3);
  HEAP32[$376 >> 2] = $375;
  var $385 = $42 * 928 + 512 + $84 * -325 + $126 * 218 + $168 * -184 >> 10;
  var $386 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 0);
  HEAP32[$386 >> 2] = $385;
  var $387 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 1);
  HEAP32[$387 >> 2] = $63;
  var $396 = $42 * -75 + 512 + $84 * 526 + $126 * 787 + $168 * -383 >> 10;
  var $397 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 2);
  HEAP32[$397 >> 2] = $396;
  var $398 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 0, 3);
  HEAP32[$398 >> 2] = $147;
  var $407 = $174 * 928 + 512 + $180 * -325 + $186 * 218 + $192 * -184 >> 10;
  var $408 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 0);
  HEAP32[$408 >> 2] = $407;
  var $409 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 1);
  HEAP32[$409 >> 2] = $177;
  var $418 = $174 * -75 + 512 + $180 * 526 + $186 * 787 + $192 * -383 >> 10;
  var $419 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 2);
  HEAP32[$419 >> 2] = $418;
  var $420 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 1, 3);
  HEAP32[$420 >> 2] = $189;
  var $429 = $210 * 928 + 512 + $228 * -325 + $246 * 218 + $264 * -184 >> 10;
  var $430 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 0);
  HEAP32[$430 >> 2] = $429;
  var $431 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 1);
  HEAP32[$431 >> 2] = $219;
  var $440 = $210 * -75 + 512 + $228 * 526 + $246 * 787 + $264 * -383 >> 10;
  var $441 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 2);
  HEAP32[$441 >> 2] = $440;
  var $442 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 2, 3);
  HEAP32[$442 >> 2] = $255;
  var $451 = $270 * 928 + 512 + $276 * -325 + $282 * 218 + $288 * -184 >> 10;
  var $452 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 0);
  HEAP32[$452 >> 2] = $451;
  var $453 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 1);
  HEAP32[$453 >> 2] = $273;
  var $462 = $270 * -75 + 512 + $276 * 526 + $282 * 787 + $288 * -383 >> 10;
  var $463 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 2);
  HEAP32[$463 >> 2] = $462;
  var $464 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($S, 3, 3);
  HEAP32[$464 >> 2] = $285;
  return;
}

__ZN4jpgd12DCT_Upsample3R_SILi8ELi8EE4calcERNS0_8Matrix44ES4_PKs["X"] = 1;

function __ZN4jpgdL13dequantize_acEii($c, $q) {
  return $q * $c | 0;
}

function __ZN4jpgd12jpeg_decoder5clampEi($i) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if ($i >>> 0 > 255) {
      __label__ = 3;
      break;
    } else {
      var $_0 = $i;
      __label__ = 4;
      break;
    }
   case 3:
    var $_0 = ($i ^ -2147483648) >> 31 & 255;
    __label__ = 4;
    break;
   case 4:
    var $_0;
    return $_0 & 255;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12DCT_UpsampleplERKNS0_8Matrix44ES3_($agg_result, $a, $b) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $r_01 = 0;
    __label__ = 3;
    break;
   case 3:
    var $r_01;
    var $2 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 0);
    var $3 = HEAP32[$2 >> 2];
    var $4 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 0);
    var $6 = HEAP32[$4 >> 2] + $3 | 0;
    var $7 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($agg_result, $r_01, 0);
    HEAP32[$7 >> 2] = $6;
    var $8 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 1);
    var $9 = HEAP32[$8 >> 2];
    var $10 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 1);
    var $12 = HEAP32[$10 >> 2] + $9 | 0;
    var $13 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($agg_result, $r_01, 1);
    HEAP32[$13 >> 2] = $12;
    var $14 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 2);
    var $15 = HEAP32[$14 >> 2];
    var $16 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 2);
    var $18 = HEAP32[$16 >> 2] + $15 | 0;
    var $19 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($agg_result, $r_01, 2);
    HEAP32[$19 >> 2] = $18;
    var $20 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 3);
    var $21 = HEAP32[$20 >> 2];
    var $22 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 3);
    var $24 = HEAP32[$22 >> 2] + $21 | 0;
    var $25 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($agg_result, $r_01, 3);
    HEAP32[$25 >> 2] = $24;
    var $26 = $r_01 + 1 | 0;
    if (($26 | 0) == 4) {
      __label__ = 4;
      break;
    } else {
      var $r_01 = $26;
      __label__ = 3;
      break;
    }
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12DCT_Upsample8Matrix44mIERKS1_($this, $a) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $r_01 = 0;
    __label__ = 3;
    break;
   case 3:
    var $r_01;
    var $2 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 0);
    var $3 = HEAP32[$2 >> 2];
    var $4 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($this, $r_01, 0);
    var $6 = HEAP32[$4 >> 2] - $3 | 0;
    HEAP32[$4 >> 2] = $6;
    var $7 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 1);
    var $8 = HEAP32[$7 >> 2];
    var $9 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($this, $r_01, 1);
    var $11 = HEAP32[$9 >> 2] - $8 | 0;
    HEAP32[$9 >> 2] = $11;
    var $12 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 2);
    var $13 = HEAP32[$12 >> 2];
    var $14 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($this, $r_01, 2);
    var $16 = HEAP32[$14 >> 2] - $13 | 0;
    HEAP32[$14 >> 2] = $16;
    var $17 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 3);
    var $18 = HEAP32[$17 >> 2];
    var $19 = __ZN4jpgd12DCT_Upsample8Matrix442atEii($this, $r_01, 3);
    var $21 = HEAP32[$19 >> 2] - $18 | 0;
    HEAP32[$19 >> 2] = $21;
    var $22 = $r_01 + 1 | 0;
    if (($22 | 0) == 4) {
      __label__ = 4;
      break;
    } else {
      var $r_01 = $22;
      __label__ = 3;
      break;
    }
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12DCT_Upsample8Matrix4413add_and_storeEPsRKS1_S4_($pDst, $a, $b) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $r_01 = 0;
    __label__ = 3;
    break;
   case 3:
    var $r_01;
    var $2 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 0);
    var $3 = HEAP32[$2 >> 2];
    var $4 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 0);
    HEAP16[$pDst + ($r_01 << 1) >> 1] = HEAP32[$4 >> 2] + $3 & 65535;
    var $9 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 1);
    var $10 = HEAP32[$9 >> 2];
    var $11 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 1);
    HEAP16[$pDst + ($r_01 + 8 << 1) >> 1] = HEAP32[$11 >> 2] + $10 & 65535;
    var $17 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 2);
    var $18 = HEAP32[$17 >> 2];
    var $19 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 2);
    HEAP16[$pDst + ($r_01 + 16 << 1) >> 1] = HEAP32[$19 >> 2] + $18 & 65535;
    var $25 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 3);
    var $26 = HEAP32[$25 >> 2];
    var $27 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 3);
    HEAP16[$pDst + ($r_01 + 24 << 1) >> 1] = HEAP32[$27 >> 2] + $26 & 65535;
    var $33 = $r_01 + 1 | 0;
    if (($33 | 0) == 4) {
      __label__ = 4;
      break;
    } else {
      var $r_01 = $33;
      __label__ = 3;
      break;
    }
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12DCT_Upsample8Matrix4413sub_and_storeEPsRKS1_S4_($pDst, $a, $b) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $r_01 = 0;
    __label__ = 3;
    break;
   case 3:
    var $r_01;
    var $2 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 0);
    var $3 = HEAP32[$2 >> 2];
    var $4 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 0);
    HEAP16[$pDst + ($r_01 << 1) >> 1] = $3 - HEAP32[$4 >> 2] & 65535;
    var $9 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 1);
    var $10 = HEAP32[$9 >> 2];
    var $11 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 1);
    HEAP16[$pDst + ($r_01 + 8 << 1) >> 1] = $10 - HEAP32[$11 >> 2] & 65535;
    var $17 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 2);
    var $18 = HEAP32[$17 >> 2];
    var $19 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 2);
    HEAP16[$pDst + ($r_01 + 16 << 1) >> 1] = $18 - HEAP32[$19 >> 2] & 65535;
    var $25 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($a, $r_01, 3);
    var $26 = HEAP32[$25 >> 2];
    var $27 = __ZNK4jpgd12DCT_Upsample8Matrix442atEii($b, $r_01, 3);
    HEAP16[$pDst + ($r_01 + 24 << 1) >> 1] = $26 - HEAP32[$27 >> 2] & 65535;
    var $33 = $r_01 + 1 | 0;
    if (($33 | 0) == 4) {
      __label__ = 4;
      break;
    } else {
      var $r_01 = $33;
      __label__ = 3;
      break;
    }
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder13load_next_rowEv($this) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 16;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $block_x_mcu = __stackBase__;
    var $1 = $block_x_mcu;
    HEAP32[$1 >> 2] = 0;
    HEAP32[$1 + 4 >> 2] = 0;
    HEAP32[$1 + 8 >> 2] = 0;
    HEAP32[$1 + 12 >> 2] = 0;
    var $2 = $this + 336 | 0;
    if ((HEAP32[$2 >> 2] | 0) > 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $_pre_phi = $this + 252 | 0;
    __label__ = 24;
    break;
   case 4:
    var $5 = $this + 328 | 0;
    var $6 = $this + 9120 | 0;
    var $7 = $this + 9144 | 0;
    var $8 = $this + 252 | 0;
    var $mcu_row_014 = 0;
    __label__ = 5;
    break;
   case 5:
    var $mcu_row_014;
    if ((HEAP32[$5 >> 2] | 0) > 0) {
      var $mcu_block_08 = 0;
      var $block_x_mcu_ofs_09 = 0;
      var $block_y_mcu_ofs_010 = 0;
      __label__ = 6;
      break;
    } else {
      __label__ = 20;
      break;
    }
   case 6:
    var $block_y_mcu_ofs_010;
    var $block_x_mcu_ofs_09;
    var $mcu_block_08;
    var $12 = HEAP32[$this + 344 + ($mcu_block_08 << 2) >> 2];
    var $16 = HEAP32[$this + 132 + (HEAP32[$this + 188 + ($12 << 2) >> 2] << 2) >> 2];
    var $17 = HEAP32[$7 >> 2];
    var $18 = $mcu_block_08 << 6;
    var $19 = $17 + ($18 << 1) | 0;
    var $21 = HEAP32[$this + 452 + ($12 << 2) >> 2];
    var $22 = $block_x_mcu + ($12 << 2) | 0;
    var $23 = HEAP32[$22 >> 2];
    var $24 = $23 + $block_x_mcu_ofs_09 | 0;
    var $25 = $this + 472 + ($12 << 2) | 0;
    var $27 = HEAP32[$25 >> 2] + $block_y_mcu_ofs_010 | 0;
    var $28 = __ZN4jpgd12jpeg_decoder14coeff_buf_getpEPNS0_9coeff_bufEii($21, $24, $27);
    var $30 = HEAP32[$this + 436 + ($12 << 2) >> 2];
    var $32 = HEAP32[$25 >> 2] + $block_y_mcu_ofs_010 | 0;
    var $33 = __ZN4jpgd12jpeg_decoder14coeff_buf_getpEPNS0_9coeff_bufEii($30, $24, $32);
    var $34 = HEAP16[$33 >> 1];
    HEAP16[$19 >> 1] = $34;
    var $36 = $17 + (($18 | 1) << 1) | 0;
    var $38 = $28 + 2 | 0;
    _memcpy($36, $38, 126, 2);
    var $i_0 = 63;
    __label__ = 7;
    break;
   case 7:
    var $i_0;
    if (($i_0 | 0) > 0) {
      __label__ = 8;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 8:
    if (HEAP16[$17 + (HEAP32[__ZN4jpgdL5g_ZAGE + ($i_0 << 2) >> 2] + $18 << 1) >> 1] << 16 >> 16 == 0) {
      var $i_0 = $i_0 - 1 | 0;
      __label__ = 7;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 9:
    HEAP32[$this + 9148 + ($mcu_block_08 << 2) >> 2] = $i_0 + 1 | 0;
    if (($i_0 | 0) > -1) {
      var $i_14 = $i_0;
      __label__ = 10;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 10:
    var $i_14;
    var $54 = $17 + (HEAP32[__ZN4jpgdL5g_ZAGE + ($i_14 << 2) >> 2] + $18 << 1) | 0;
    var $55 = HEAP16[$54 >> 1];
    if ($55 << 16 >> 16 == 0) {
      __label__ = 12;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 11:
    var $60 = HEAP16[$16 + ($i_14 << 1) >> 1] * $55 & 65535;
    HEAP16[$54 >> 1] = $60;
    __label__ = 12;
    break;
   case 12:
    if (($i_14 | 0) > 0) {
      __label__ = 13;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 13:
    var $i_14 = $i_14 - 1 | 0;
    __label__ = 10;
    break;
   case 14:
    if ((HEAP32[$8 >> 2] | 0) == 1) {
      __label__ = 15;
      break;
    } else {
      __label__ = 16;
      break;
    }
   case 15:
    var $67 = $23 + 1 | 0;
    HEAP32[$22 >> 2] = $67;
    var $block_y_mcu_ofs_1 = $block_y_mcu_ofs_010;
    var $block_x_mcu_ofs_1 = $block_x_mcu_ofs_09;
    __label__ = 19;
    break;
   case 16:
    var $69 = $block_x_mcu_ofs_09 + 1 | 0;
    if (($69 | 0) == (HEAP32[$this + 156 + ($12 << 2) >> 2] | 0)) {
      __label__ = 17;
      break;
    } else {
      var $block_y_mcu_ofs_1 = $block_y_mcu_ofs_010;
      var $block_x_mcu_ofs_1 = $69;
      __label__ = 19;
      break;
    }
   case 17:
    var $74 = $block_y_mcu_ofs_010 + 1 | 0;
    if (($74 | 0) == (HEAP32[$this + 172 + ($12 << 2) >> 2] | 0)) {
      __label__ = 18;
      break;
    } else {
      var $block_y_mcu_ofs_1 = $74;
      var $block_x_mcu_ofs_1 = 0;
      __label__ = 19;
      break;
    }
   case 18:
    var $79 = $23 + $69 | 0;
    HEAP32[$22 >> 2] = $79;
    var $block_y_mcu_ofs_1 = 0;
    var $block_x_mcu_ofs_1 = 0;
    __label__ = 19;
    break;
   case 19:
    var $block_x_mcu_ofs_1;
    var $block_y_mcu_ofs_1;
    var $81 = $mcu_block_08 + 1 | 0;
    if (($81 | 0) < (HEAP32[$5 >> 2] | 0)) {
      var $mcu_block_08 = $81;
      var $block_x_mcu_ofs_09 = $block_x_mcu_ofs_1;
      var $block_y_mcu_ofs_010 = $block_y_mcu_ofs_1;
      __label__ = 6;
      break;
    } else {
      __label__ = 20;
      break;
    }
   case 20:
    if ((HEAP8[$6] & 1) << 24 >> 24 == 0) {
      __label__ = 22;
      break;
    } else {
      __label__ = 21;
      break;
    }
   case 21:
    __ZN4jpgd12jpeg_decoder20transform_mcu_expandEi($this, $mcu_row_014);
    __label__ = 23;
    break;
   case 22:
    __ZN4jpgd12jpeg_decoder13transform_mcuEi($this, $mcu_row_014);
    __label__ = 23;
    break;
   case 23:
    var $90 = $mcu_row_014 + 1 | 0;
    if (($90 | 0) < (HEAP32[$2 >> 2] | 0)) {
      var $mcu_row_014 = $90;
      __label__ = 5;
      break;
    } else {
      var $_pre_phi = $8;
      __label__ = 24;
      break;
    }
   case 24:
    var $_pre_phi;
    var $93 = HEAP32[$_pre_phi >> 2];
    if (($93 | 0) == 1) {
      __label__ = 26;
      break;
    } else {
      __label__ = 25;
      break;
    }
   case 25:
    if (($93 | 0) > 0) {
      var $component_num_03 = 0;
      __label__ = 27;
      break;
    } else {
      __label__ = 28;
      break;
    }
   case 26:
    var $99 = $this + 472 + (HEAP32[$this + 256 >> 2] << 2) | 0;
    var $101 = HEAP32[$99 >> 2] + 1 | 0;
    HEAP32[$99 >> 2] = $101;
    __label__ = 28;
    break;
   case 27:
    var $component_num_03;
    var $103 = HEAP32[$this + 256 + ($component_num_03 << 2) >> 2];
    var $106 = $this + 472 + ($103 << 2) | 0;
    var $108 = HEAP32[$106 >> 2] + HEAP32[$this + 172 + ($103 << 2) >> 2] | 0;
    HEAP32[$106 >> 2] = $108;
    var $109 = $component_num_03 + 1 | 0;
    if (($109 | 0) < (HEAP32[$_pre_phi >> 2] | 0)) {
      var $component_num_03 = $109;
      __label__ = 27;
      break;
    } else {
      __label__ = 28;
      break;
    }
   case 28:
    STACKTOP = __stackBase__;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder13load_next_rowEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder14coeff_buf_getpEPNS0_9coeff_bufEii($cb, $block_x, $block_y) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $cb + 4 | 0;
    var $2 = HEAP32[$1 >> 2];
    if (($2 | 0) > ($block_x | 0)) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    if ((HEAP32[$cb + 8 >> 2] | 0) > ($block_y | 0)) {
      var $10 = $2;
      __label__ = 5;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    ___assert_func(STRING_TABLE.__str114 | 0, 2593, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder14coeff_buf_getpEPNS0_9coeff_bufEii | 0, STRING_TABLE.__str14128 | 0);
    var $10 = HEAP32[$1 >> 2];
    __label__ = 5;
    break;
   case 5:
    var $10;
    return HEAP32[$cb >> 2] + ($10 * $block_y + $block_x) * HEAP32[$cb + 20 >> 2] | 0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder8get_charEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this + 492 | 0;
    var $2 = HEAP32[$1 >> 2];
    if (($2 | 0) == 0) {
      __label__ = 3;
      break;
    } else {
      var $13 = $2;
      __label__ = 5;
      break;
    }
   case 3:
    __ZN4jpgd12jpeg_decoder14prep_in_bufferEv($this);
    var $5 = HEAP32[$1 >> 2];
    if (($5 | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      var $13 = $5;
      __label__ = 5;
      break;
    }
   case 4:
    var $8 = $this + 496 | 0;
    var $9 = HEAP32[$8 >> 2];
    var $10 = $9 ^ 1;
    HEAP32[$8 >> 2] = $10;
    var $_ = ($9 | 0) == 0 ? 255 : 217;
    var $_0 = $_;
    __label__ = 6;
    break;
   case 5:
    var $13;
    var $14 = $this + 488 | 0;
    var $15 = HEAP32[$14 >> 2];
    var $16 = $15 + 1 | 0;
    HEAP32[$14 >> 2] = $16;
    var $18 = HEAPU8[$15] & 255;
    HEAP32[$1 >> 2] = $13 - 1 | 0;
    var $_0 = $18;
    __label__ = 6;
    break;
   case 6:
    var $_0;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesERi($this, $pH, $extra_bits) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAPU32[$this + 9084 >> 2];
    var $5 = HEAPU32[$pH + 1028 + ($2 >>> 24 << 2) >> 2];
    if (($5 | 0) < 0) {
      var $ofs_0 = 23;
      var $symbol_0 = $5;
      __label__ = 3;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 3:
    var $symbol_0;
    var $ofs_0;
    var $12 = HEAPU32[$pH + 2308 + (-($symbol_0 + ($2 >>> ($ofs_0 >>> 0) & 1)) << 2) >> 2];
    if (($12 | 0) < 0) {
      var $ofs_0 = $ofs_0 - 1 | 0;
      var $symbol_0 = $12;
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    var $17 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, 32 - $ofs_0 | 0);
    var $18 = $12 & 15;
    var $19 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, $18);
    HEAP32[$extra_bits >> 2] = $19;
    var $symbol_1 = $12;
    __label__ = 12;
    break;
   case 5:
    var $22 = $5 >>> 8 & 31;
    var $23 = $5 & 255;
    var $28 = ($5 & 32768 | 0) != 0;
    var $29 = $5 & 15;
    var $_ = $28 ? $29 : 0;
    if (($22 | 0) == ((HEAPU8[$23 + ($pH + 2052) | 0] & 255) + $_ | 0)) {
      __label__ = 7;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    ___assert_func(STRING_TABLE.__str114 | 0, 537, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesERi | 0, STRING_TABLE.__str15129 | 0);
    __label__ = 7;
    break;
   case 7:
    if ($28) {
      __label__ = 8;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 8:
    var $35 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, $22);
    HEAP32[$extra_bits >> 2] = $5 >> 16;
    var $symbol_1 = $23;
    __label__ = 12;
    break;
   case 9:
    var $38 = $22 + $29 | 0;
    if (($38 | 0) > (HEAP32[$this + 9080 >> 2] + 16 | 0)) {
      __label__ = 11;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 10:
    var $44 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, $38);
    HEAP32[$extra_bits >> 2] = $44 & (1 << $29) - 1;
    var $symbol_1 = $23;
    __label__ = 12;
    break;
   case 11:
    var $49 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, $22);
    var $50 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, $29);
    HEAP32[$extra_bits >> 2] = $50;
    var $symbol_1 = $23;
    __label__ = 12;
    break;
   case 12:
    var $symbol_1;
    return $symbol_1;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesERi["X"] = 1;

function __ZN4jpgd12jpeg_decoder11H1V1ConvertEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAP32[$this + 9100 >> 2];
    if (($2 | 0) > 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 3:
    var $s_03 = HEAP32[$this + 9188 >> 2] + (HEAP32[$this + 324 >> 2] - HEAP32[$this + 388 >> 2] << 3) | 0;
    var $d_04 = HEAP32[$this + 13288 >> 2];
    var $i_05 = $2;
    __label__ = 4;
    break;
   case 4:
    var $i_05;
    var $d_04;
    var $s_03;
    var $d_11 = $d_04;
    var $j_02 = 0;
    __label__ = 5;
    break;
   case 5:
    var $j_02;
    var $d_11;
    var $18 = HEAPU8[$s_03 + $j_02 | 0] & 255;
    var $22 = HEAPU8[$s_03 + ($j_02 + 64) | 0] & 255;
    var $26 = HEAPU8[$s_03 + ($j_02 + 128) | 0] & 255;
    var $29 = HEAP32[$this + 9192 + ($26 << 2) >> 2] + $18 | 0;
    var $30 = __ZN4jpgd12jpeg_decoder5clampEi($29);
    HEAP8[$d_11] = $30;
    var $37 = (HEAP32[$this + 12264 + ($22 << 2) >> 2] + HEAP32[$this + 11240 + ($26 << 2) >> 2] >> 16) + $18 | 0;
    var $38 = __ZN4jpgd12jpeg_decoder5clampEi($37);
    HEAP8[$d_11 + 1 | 0] = $38;
    var $42 = HEAP32[$this + 10216 + ($22 << 2) >> 2] + $18 | 0;
    var $43 = __ZN4jpgd12jpeg_decoder5clampEi($42);
    HEAP8[$d_11 + 2 | 0] = $43;
    HEAP8[$d_11 + 3 | 0] = -1;
    var $47 = $j_02 + 1 | 0;
    if (($47 | 0) == 8) {
      __label__ = 6;
      break;
    } else {
      var $d_11 = $d_11 + 4 | 0;
      var $j_02 = $47;
      __label__ = 5;
      break;
    }
   case 6:
    var $50 = $i_05 - 1 | 0;
    if (($50 | 0) > 0) {
      var $s_03 = $s_03 + 192 | 0;
      var $d_04 = $d_04 + 32 | 0;
      var $i_05 = $50;
      __label__ = 4;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 7:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder11H1V1ConvertEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder15process_restartEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $i_0 = 1536;
    __label__ = 3;
    break;
   case 3:
    var $i_0;
    if (($i_0 | 0) > 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 4:
    var $4 = __ZN4jpgd12jpeg_decoder8get_charEv($this);
    if (($4 | 0) == 255) {
      __label__ = 5;
      break;
    } else {
      var $i_0 = $i_0 - 1 | 0;
      __label__ = 3;
      break;
    }
   case 5:
    if (($i_0 | 0) == 0) {
      __label__ = 6;
      break;
    } else {
      var $c_0 = 0;
      var $i_1 = $i_0;
      __label__ = 7;
      break;
    }
   case 6:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -229);
    throw "Reached an unreachable!";
   case 7:
    var $i_1;
    var $c_0;
    if (($i_1 | 0) > 0) {
      __label__ = 8;
      break;
    } else {
      var $c_1 = $c_0;
      __label__ = 9;
      break;
    }
   case 8:
    var $12 = __ZN4jpgd12jpeg_decoder8get_charEv($this);
    if (($12 | 0) == 255) {
      var $c_0 = 255;
      var $i_1 = $i_1 - 1 | 0;
      __label__ = 7;
      break;
    } else {
      var $c_1 = $12;
      __label__ = 9;
      break;
    }
   case 9:
    var $c_1;
    if (($i_1 | 0) == 0) {
      __label__ = 10;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 10:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -229);
    throw "Reached an unreachable!";
   case 11:
    var $19 = $this + 9096 | 0;
    var $20 = HEAP32[$19 >> 2];
    if (($c_1 | 0) == ($20 + 208 | 0)) {
      __label__ = 13;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 12:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -229);
    throw "Reached an unreachable!";
   case 13:
    var $26 = $this + 9128 | 0;
    var $29 = HEAP32[$this + 152 >> 2] << 2;
    _memset($26, 0, $29, 4);
    HEAP32[$this + 468 >> 2] = 0;
    var $32 = HEAP32[$this + 9088 >> 2];
    HEAP32[$this + 9092 >> 2] = $32;
    var $35 = $20 + 1 & 7;
    HEAP32[$19 >> 2] = $35;
    HEAP32[$this + 9080 >> 2] = 16;
    var $37 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, 16);
    var $38 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, 16);
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder15process_restartEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder15decode_next_rowEv($this) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 8;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $r = __stackBase__;
    var $extra_bits = __stackBase__ + 4;
    var $1 = $this + 336 | 0;
    var $2 = $this + 9088 | 0;
    var $3 = $this + 9144 | 0;
    var $4 = $this + 328 | 0;
    var $5 = $this + 9120 | 0;
    var $6 = $this + 9092 | 0;
    var $mcu_row_0 = 0;
    __label__ = 3;
    break;
   case 3:
    var $mcu_row_0;
    if (($mcu_row_0 | 0) < (HEAP32[$1 >> 2] | 0)) {
      __label__ = 4;
      break;
    } else {
      __label__ = 45;
      break;
    }
   case 4:
    if ((HEAP32[$2 >> 2] | 0) == 0) {
      __label__ = 7;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    if ((HEAP32[$6 >> 2] | 0) == 0) {
      __label__ = 6;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 6:
    __ZN4jpgd12jpeg_decoder15process_restartEv($this);
    __label__ = 7;
    break;
   case 7:
    var $p_0 = HEAP32[$3 >> 2];
    var $mcu_block_0 = 0;
    __label__ = 8;
    break;
   case 8:
    var $mcu_block_0;
    var $p_0;
    if (($mcu_block_0 | 0) < (HEAP32[$4 >> 2] | 0)) {
      __label__ = 9;
      break;
    } else {
      __label__ = 41;
      break;
    }
   case 9:
    var $24 = HEAP32[$this + 344 + ($mcu_block_0 << 2) >> 2];
    var $28 = HEAP32[$this + 132 + (HEAP32[$this + 188 + ($24 << 2) >> 2] << 2) >> 2];
    var $32 = HEAP32[$this + 404 + (HEAP32[$this + 272 + ($24 << 2) >> 2] << 2) >> 2];
    var $33 = __ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesERi($this, $32, $r);
    var $34 = HEAP32[$r >> 2];
    var $35 = $33 & 15;
    if (($34 | 0) < (HEAP32[__ZN4jpgdL13s_extend_testE + ($35 << 2) >> 2] | 0)) {
      __label__ = 10;
      break;
    } else {
      var $44 = $34;
      __label__ = 11;
      break;
    }
   case 10:
    var $44 = HEAP32[__ZN4jpgdL15s_extend_offsetE + ($35 << 2) >> 2] + $34 | 0;
    __label__ = 11;
    break;
   case 11:
    var $44;
    var $45 = $this + 9128 + ($24 << 2) | 0;
    var $47 = HEAP32[$45 >> 2] + $44 | 0;
    HEAP32[$45 >> 2] = $47;
    var $51 = (HEAP16[$28 >> 1] << 16 >> 16) * $47 & 65535;
    HEAP16[$p_0 >> 1] = $51;
    var $52 = $this + 9148 + ($mcu_block_0 << 2) | 0;
    var $53 = HEAP32[$52 >> 2];
    var $57 = HEAP32[$this + 404 + (HEAP32[$this + 288 + ($24 << 2) >> 2] << 2) >> 2];
    var $k_0 = 1;
    __label__ = 12;
    break;
   case 12:
    var $k_0;
    if (($k_0 | 0) < 64) {
      __label__ = 13;
      break;
    } else {
      __label__ = 38;
      break;
    }
   case 13:
    var $61 = __ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesERi($this, $57, $extra_bits);
    var $62 = $61 >> 4;
    HEAP32[$r >> 2] = $62;
    var $63 = $61 & 15;
    if (($63 | 0) == 0) {
      __label__ = 27;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 14:
    if (($62 | 0) == 0) {
      var $k_1 = $k_0;
      __label__ = 22;
      break;
    } else {
      __label__ = 15;
      break;
    }
   case 15:
    if (($62 + $k_0 | 0) > 63) {
      __label__ = 16;
      break;
    } else {
      __label__ = 17;
      break;
    }
   case 16:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -230);
    throw "Reached an unreachable!";
   case 17:
    if (($k_0 | 0) < ($53 | 0)) {
      __label__ = 18;
      break;
    } else {
      var $83 = $62;
      __label__ = 21;
      break;
    }
   case 18:
    var $74 = $53 - $k_0 | 0;
    var $_ = ($62 | 0) < ($74 | 0) ? $62 : $74;
    if (($_ | 0) == 0) {
      var $83 = $62;
      __label__ = 21;
      break;
    } else {
      var $n_04 = $_;
      var $kt_05 = $k_0;
      __label__ = 19;
      break;
    }
   case 19:
    var $kt_05;
    var $n_04;
    var $77 = $n_04 - 1 | 0;
    HEAP16[$p_0 + (HEAP32[__ZN4jpgdL5g_ZAGE + ($kt_05 << 2) >> 2] << 1) >> 1] = 0;
    if (($77 | 0) == 0) {
      __label__ = 20;
      break;
    } else {
      var $n_04 = $77;
      var $kt_05 = $kt_05 + 1 | 0;
      __label__ = 19;
      break;
    }
   case 20:
    var $83 = HEAP32[$r >> 2];
    __label__ = 21;
    break;
   case 21:
    var $83;
    var $k_1 = $83 + $k_0 | 0;
    __label__ = 22;
    break;
   case 22:
    var $k_1;
    var $86 = HEAP32[$extra_bits >> 2];
    if (($86 | 0) < (HEAP32[__ZN4jpgdL13s_extend_testE + ($63 << 2) >> 2] | 0)) {
      __label__ = 23;
      break;
    } else {
      var $95 = $86;
      __label__ = 24;
      break;
    }
   case 23:
    var $95 = HEAP32[__ZN4jpgdL15s_extend_offsetE + ($63 << 2) >> 2] + $86 | 0;
    __label__ = 24;
    break;
   case 24:
    var $95;
    if (($k_1 | 0) < 64) {
      __label__ = 26;
      break;
    } else {
      __label__ = 25;
      break;
    }
   case 25:
    ___assert_func(STRING_TABLE.__str114 | 0, 1816, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder15decode_next_rowEv | 0, STRING_TABLE.__str7121 | 0);
    __label__ = 26;
    break;
   case 26:
    var $101 = HEAP16[$28 + ($k_1 << 1) >> 1] << 16 >> 16;
    var $102 = __ZN4jpgdL13dequantize_acEii($95, $101);
    var $103 = $102 & 65535;
    HEAP16[$p_0 + (HEAP32[__ZN4jpgdL5g_ZAGE + ($k_1 << 2) >> 2] << 1) >> 1] = $103;
    var $k_2 = $k_1;
    __label__ = 37;
    break;
   case 27:
    if (($62 | 0) == 15) {
      __label__ = 28;
      break;
    } else {
      __label__ = 38;
      break;
    }
   case 28:
    if (($k_0 + 16 | 0) > 64) {
      __label__ = 29;
      break;
    } else {
      __label__ = 30;
      break;
    }
   case 29:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -230);
    throw "Reached an unreachable!";
   case 30:
    if (($k_0 | 0) < ($53 | 0)) {
      __label__ = 31;
      break;
    } else {
      __label__ = 35;
      break;
    }
   case 31:
    var $116 = $53 - $k_0 | 0;
    var $_1 = ($116 | 0) > 16 ? 16 : $116;
    if (($_1 | 0) == 0) {
      __label__ = 35;
      break;
    } else {
      var $kt2_08 = $k_0;
      var $_in = $_1;
      __label__ = 32;
      break;
    }
   case 32:
    var $_in;
    var $kt2_08;
    var $119 = $_in - 1 | 0;
    if (($kt2_08 | 0) < 64) {
      __label__ = 34;
      break;
    } else {
      __label__ = 33;
      break;
    }
   case 33:
    ___assert_func(STRING_TABLE.__str114 | 0, 1833, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder15decode_next_rowEv | 0, STRING_TABLE.__str8122 | 0);
    __label__ = 34;
    break;
   case 34:
    HEAP16[$p_0 + (HEAP32[__ZN4jpgdL5g_ZAGE + ($kt2_08 << 2) >> 2] << 1) >> 1] = 0;
    if (($119 | 0) == 0) {
      __label__ = 35;
      break;
    } else {
      var $kt2_08 = $kt2_08 + 1 | 0;
      var $_in = $119;
      __label__ = 32;
      break;
    }
   case 35:
    var $128 = $k_0 + 15 | 0;
    if (HEAP16[$p_0 + (HEAP32[__ZN4jpgdL5g_ZAGE + ($128 << 2) >> 2] << 1) >> 1] << 16 >> 16 == 0) {
      var $k_2 = $128;
      __label__ = 37;
      break;
    } else {
      __label__ = 36;
      break;
    }
   case 36:
    ___assert_func(STRING_TABLE.__str114 | 0, 1839, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder15decode_next_rowEv | 0, STRING_TABLE.__str9123 | 0);
    var $k_2 = $128;
    __label__ = 37;
    break;
   case 37:
    var $k_2;
    var $k_0 = $k_2 + 1 | 0;
    __label__ = 12;
    break;
   case 38:
    if (($k_0 | 0) < ($53 | 0)) {
      var $kt3_02 = $k_0;
      __label__ = 39;
      break;
    } else {
      __label__ = 40;
      break;
    }
   case 39:
    var $kt3_02;
    var $139 = $kt3_02 + 1 | 0;
    HEAP16[$p_0 + (HEAP32[__ZN4jpgdL5g_ZAGE + ($kt3_02 << 2) >> 2] << 1) >> 1] = 0;
    if (($139 | 0) == ($53 | 0)) {
      __label__ = 40;
      break;
    } else {
      var $kt3_02 = $139;
      __label__ = 39;
      break;
    }
   case 40:
    HEAP32[$52 >> 2] = $k_0;
    var $p_0 = $p_0 + 128 | 0;
    var $mcu_block_0 = $mcu_block_0 + 1 | 0;
    __label__ = 8;
    break;
   case 41:
    if ((HEAP8[$5] & 1) << 24 >> 24 == 0) {
      __label__ = 43;
      break;
    } else {
      __label__ = 42;
      break;
    }
   case 42:
    __ZN4jpgd12jpeg_decoder20transform_mcu_expandEi($this, $mcu_row_0);
    __label__ = 44;
    break;
   case 43:
    __ZN4jpgd12jpeg_decoder13transform_mcuEi($this, $mcu_row_0);
    __label__ = 44;
    break;
   case 44:
    var $153 = HEAP32[$6 >> 2] - 1 | 0;
    HEAP32[$6 >> 2] = $153;
    var $mcu_row_0 = $mcu_row_0 + 1 | 0;
    __label__ = 3;
    break;
   case 45:
    STACKTOP = __stackBase__;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder15decode_next_rowEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder12gray_convertEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAP32[$this + 9100 >> 2];
    if (($2 | 0) > 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 3:
    var $d_01 = HEAP32[$this + 13288 >> 2];
    var $s_02 = HEAP32[$this + 9188 >> 2] + (HEAP32[$this + 324 >> 2] - HEAP32[$this + 388 >> 2] << 3) | 0;
    var $i_03 = $2;
    __label__ = 4;
    break;
   case 4:
    var $i_03;
    var $s_02;
    var $d_01;
    var $17 = HEAP32[$s_02 >> 2];
    HEAP32[$d_01 >> 2] = $17;
    var $21 = HEAP32[$s_02 + 4 >> 2];
    HEAP32[$d_01 + 4 >> 2] = $21;
    var $26 = $i_03 - 1 | 0;
    if (($26 | 0) > 0) {
      var $d_01 = $d_01 + 8 | 0;
      var $s_02 = $s_02 + 64 | 0;
      var $i_03 = $26;
      __label__ = 4;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder11H2V1ConvertEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $7 = HEAP32[$this + 9188 >> 2];
    var $8 = HEAP32[$this + 324 >> 2] - HEAP32[$this + 388 >> 2] << 3;
    var $10 = HEAP32[$this + 9100 >> 2];
    if (($10 | 0) > 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 3:
    var $i_09 = $10;
    var $c_010 = $7 + ($8 + 128) | 0;
    var $y_011 = $7 + $8 | 0;
    var $d0_012 = HEAP32[$this + 13288 >> 2];
    __label__ = 4;
    break;
   case 4:
    var $d0_012;
    var $y_011;
    var $c_010;
    var $i_09;
    var $scevgep = $c_010 + 4 | 0;
    var $c_21 = $c_010;
    var $d0_22 = $d0_012;
    var $j_03 = 0;
    __label__ = 5;
    break;
   case 5:
    var $j_03;
    var $d0_22;
    var $c_21;
    var $18 = HEAPU8[$c_21] & 255;
    var $21 = HEAPU8[$c_21 + 64 | 0] & 255;
    var $23 = HEAPU32[$this + 9192 + ($21 << 2) >> 2];
    var $29 = HEAP32[$this + 12264 + ($18 << 2) >> 2] + HEAP32[$this + 11240 + ($21 << 2) >> 2] >> 16;
    var $31 = HEAPU32[$this + 10216 + ($18 << 2) >> 2];
    var $32 = $j_03 << 1;
    var $35 = HEAPU8[$y_011 + $32 | 0] & 255;
    var $36 = $35 + $23 | 0;
    var $37 = __ZN4jpgd12jpeg_decoder5clampEi($36);
    HEAP8[$d0_22] = $37;
    var $38 = $35 + $29 | 0;
    var $39 = __ZN4jpgd12jpeg_decoder5clampEi($38);
    HEAP8[$d0_22 + 1 | 0] = $39;
    var $41 = $35 + $31 | 0;
    var $42 = __ZN4jpgd12jpeg_decoder5clampEi($41);
    HEAP8[$d0_22 + 2 | 0] = $42;
    HEAP8[$d0_22 + 3 | 0] = -1;
    var $48 = HEAPU8[$y_011 + ($32 | 1) | 0] & 255;
    var $49 = $48 + $23 | 0;
    var $50 = __ZN4jpgd12jpeg_decoder5clampEi($49);
    HEAP8[$d0_22 + 4 | 0] = $50;
    var $52 = $48 + $29 | 0;
    var $53 = __ZN4jpgd12jpeg_decoder5clampEi($52);
    HEAP8[$d0_22 + 5 | 0] = $53;
    var $55 = $48 + $31 | 0;
    var $56 = __ZN4jpgd12jpeg_decoder5clampEi($55);
    HEAP8[$d0_22 + 6 | 0] = $56;
    HEAP8[$d0_22 + 7 | 0] = -1;
    var $61 = $j_03 + 1 | 0;
    if (($61 | 0) == 4) {
      __label__ = 6;
      break;
    } else {
      var $c_21 = $c_21 + 1 | 0;
      var $d0_22 = $d0_22 + 8 | 0;
      var $j_03 = $61;
      __label__ = 5;
      break;
    }
   case 6:
    var $c_21_1 = $scevgep;
    var $d0_22_1 = $d0_012 + 32 | 0;
    var $j_03_1 = 0;
    __label__ = 8;
    break;
   case 7:
    return;
   case 8:
    var $j_03_1;
    var $d0_22_1;
    var $c_21_1;
    var $64 = HEAPU8[$c_21_1] & 255;
    var $67 = HEAPU8[$c_21_1 + 64 | 0] & 255;
    var $69 = HEAPU32[$this + 9192 + ($67 << 2) >> 2];
    var $75 = HEAP32[$this + 12264 + ($64 << 2) >> 2] + HEAP32[$this + 11240 + ($67 << 2) >> 2] >> 16;
    var $77 = HEAPU32[$this + 10216 + ($64 << 2) >> 2];
    var $78 = $j_03_1 << 1;
    var $81 = HEAPU8[$y_011 + ($78 + 64) | 0] & 255;
    var $82 = $81 + $69 | 0;
    var $83 = __ZN4jpgd12jpeg_decoder5clampEi($82);
    HEAP8[$d0_22_1] = $83;
    var $84 = $81 + $75 | 0;
    var $85 = __ZN4jpgd12jpeg_decoder5clampEi($84);
    HEAP8[$d0_22_1 + 1 | 0] = $85;
    var $87 = $81 + $77 | 0;
    var $88 = __ZN4jpgd12jpeg_decoder5clampEi($87);
    HEAP8[$d0_22_1 + 2 | 0] = $88;
    HEAP8[$d0_22_1 + 3 | 0] = -1;
    var $94 = HEAPU8[$y_011 + (($78 | 1) + 64) | 0] & 255;
    var $95 = $94 + $69 | 0;
    var $96 = __ZN4jpgd12jpeg_decoder5clampEi($95);
    HEAP8[$d0_22_1 + 4 | 0] = $96;
    var $98 = $94 + $75 | 0;
    var $99 = __ZN4jpgd12jpeg_decoder5clampEi($98);
    HEAP8[$d0_22_1 + 5 | 0] = $99;
    var $101 = $94 + $77 | 0;
    var $102 = __ZN4jpgd12jpeg_decoder5clampEi($101);
    HEAP8[$d0_22_1 + 6 | 0] = $102;
    HEAP8[$d0_22_1 + 7 | 0] = -1;
    var $107 = $j_03_1 + 1 | 0;
    if (($107 | 0) == 4) {
      __label__ = 9;
      break;
    } else {
      var $c_21_1 = $c_21_1 + 1 | 0;
      var $d0_22_1 = $d0_22_1 + 8 | 0;
      var $j_03_1 = $107;
      __label__ = 8;
      break;
    }
   case 9:
    var $111 = $i_09 - 1 | 0;
    if (($111 | 0) > 0) {
      var $i_09 = $111;
      var $c_010 = $c_010 + 256 | 0;
      var $y_011 = $y_011 + 256 | 0;
      var $d0_012 = $d0_012 + 64 | 0;
      __label__ = 4;
      break;
    } else {
      __label__ = 7;
      break;
    }
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder11H2V1ConvertEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder11H1V2ConvertEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $5 = HEAP32[$this + 324 >> 2] - HEAP32[$this + 388 >> 2] | 0;
    var $7 = HEAP32[$this + 13288 >> 2];
    var $9 = HEAP32[$this + 13292 >> 2];
    var $12 = HEAP32[$this + 9188 >> 2];
    var $13 = $5 << 3;
    if (($5 | 0) < 8) {
      var $_pn = $13;
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $_pn = $13 & 56 | 64;
    __label__ = 4;
    break;
   case 4:
    var $_pn;
    var $18 = HEAP32[$this + 9100 >> 2];
    if (($18 | 0) > 0) {
      __label__ = 5;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 5:
    var $c_05 = $12 + (($5 << 2) + 128 & -8) | 0;
    var $y_16 = $12 + $_pn | 0;
    var $d1_07 = $9;
    var $d0_08 = $7;
    var $i_09 = $18;
    __label__ = 6;
    break;
   case 6:
    var $i_09;
    var $d0_08;
    var $d1_07;
    var $y_16;
    var $c_05;
    var $scevgep = $d1_07 + 32 | 0;
    var $d1_12 = $d1_07;
    var $d0_13 = $d0_08;
    var $j_04 = 0;
    __label__ = 7;
    break;
   case 7:
    var $j_04;
    var $d0_13;
    var $d1_12;
    var $26 = HEAPU8[$c_05 + $j_04 | 0] & 255;
    var $30 = HEAPU8[$c_05 + ($j_04 + 64) | 0] & 255;
    var $32 = HEAPU32[$this + 9192 + ($30 << 2) >> 2];
    var $38 = HEAP32[$this + 12264 + ($26 << 2) >> 2] + HEAP32[$this + 11240 + ($30 << 2) >> 2] >> 16;
    var $40 = HEAPU32[$this + 10216 + ($26 << 2) >> 2];
    var $43 = HEAPU8[$y_16 + $j_04 | 0] & 255;
    var $44 = $43 + $32 | 0;
    var $45 = __ZN4jpgd12jpeg_decoder5clampEi($44);
    HEAP8[$d0_13] = $45;
    var $46 = $43 + $38 | 0;
    var $47 = __ZN4jpgd12jpeg_decoder5clampEi($46);
    HEAP8[$d0_13 + 1 | 0] = $47;
    var $49 = $43 + $40 | 0;
    var $50 = __ZN4jpgd12jpeg_decoder5clampEi($49);
    HEAP8[$d0_13 + 2 | 0] = $50;
    HEAP8[$d0_13 + 3 | 0] = -1;
    var $56 = HEAPU8[$y_16 + ($j_04 + 8) | 0] & 255;
    var $57 = $56 + $32 | 0;
    var $58 = __ZN4jpgd12jpeg_decoder5clampEi($57);
    HEAP8[$d1_12] = $58;
    var $59 = $56 + $38 | 0;
    var $60 = __ZN4jpgd12jpeg_decoder5clampEi($59);
    HEAP8[$d1_12 + 1 | 0] = $60;
    var $62 = $56 + $40 | 0;
    var $63 = __ZN4jpgd12jpeg_decoder5clampEi($62);
    HEAP8[$d1_12 + 2 | 0] = $63;
    HEAP8[$d1_12 + 3 | 0] = -1;
    var $68 = $j_04 + 1 | 0;
    if (($68 | 0) == 8) {
      __label__ = 8;
      break;
    } else {
      var $d1_12 = $d1_12 + 4 | 0;
      var $d0_13 = $d0_13 + 4 | 0;
      var $j_04 = $68;
      __label__ = 7;
      break;
    }
   case 8:
    var $72 = $i_09 - 1 | 0;
    if (($72 | 0) > 0) {
      var $c_05 = $c_05 + 256 | 0;
      var $y_16 = $y_16 + 256 | 0;
      var $d1_07 = $scevgep;
      var $d0_08 = $d0_08 + 32 | 0;
      var $i_09 = $72;
      __label__ = 6;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 9:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder11H1V2ConvertEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder11H2V2ConvertEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $5 = HEAP32[$this + 324 >> 2] - HEAP32[$this + 388 >> 2] | 0;
    var $7 = HEAP32[$this + 13288 >> 2];
    var $9 = HEAP32[$this + 13292 >> 2];
    var $12 = HEAP32[$this + 9188 >> 2];
    var $13 = $5 << 3;
    if (($5 | 0) < 8) {
      var $_pn = $13;
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $_pn = $13 & 56 | 128;
    __label__ = 4;
    break;
   case 4:
    var $_pn;
    var $18 = HEAP32[$this + 9100 >> 2];
    if (($18 | 0) > 0) {
      __label__ = 5;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 5:
    var $i_012 = $18;
    var $c_013 = $12 + (($5 << 2) + 256 & -8) | 0;
    var $y_114 = $12 + $_pn | 0;
    var $d1_015 = $9;
    var $d0_016 = $7;
    __label__ = 6;
    break;
   case 6:
    var $d0_016;
    var $d1_015;
    var $y_114;
    var $c_013;
    var $i_012;
    var $scevgep23 = $d0_016 + 64 | 0;
    var $c_17 = $c_013;
    var $y_28 = $y_114;
    var $d1_19 = $d1_015;
    var $d0_110 = $d0_016;
    var $l_011 = 0;
    __label__ = 7;
    break;
   case 7:
    var $l_011;
    var $d0_110;
    var $d1_19;
    var $y_28;
    var $c_17;
    var $scevgep19 = $d1_19 + 32 | 0;
    var $lftr_limit = $c_17 + 4 | 0;
    var $c_22 = $c_17;
    var $d1_23 = $d1_19;
    var $d0_24 = $d0_110;
    var $j_05 = 0;
    __label__ = 8;
    break;
   case 8:
    var $j_05;
    var $d0_24;
    var $d1_23;
    var $c_22;
    var $25 = HEAPU8[$c_22] & 255;
    var $28 = HEAPU8[$c_22 + 64 | 0] & 255;
    var $30 = HEAPU32[$this + 9192 + ($28 << 2) >> 2];
    var $36 = HEAP32[$this + 12264 + ($25 << 2) >> 2] + HEAP32[$this + 11240 + ($28 << 2) >> 2] >> 16;
    var $38 = HEAPU32[$this + 10216 + ($25 << 2) >> 2];
    var $41 = HEAPU8[$y_28 + $j_05 | 0] & 255;
    var $42 = $41 + $30 | 0;
    var $43 = __ZN4jpgd12jpeg_decoder5clampEi($42);
    HEAP8[$d0_24] = $43;
    var $44 = $41 + $36 | 0;
    var $45 = __ZN4jpgd12jpeg_decoder5clampEi($44);
    HEAP8[$d0_24 + 1 | 0] = $45;
    var $47 = $41 + $38 | 0;
    var $48 = __ZN4jpgd12jpeg_decoder5clampEi($47);
    HEAP8[$d0_24 + 2 | 0] = $48;
    HEAP8[$d0_24 + 3 | 0] = -1;
    var $54 = HEAPU8[$y_28 + ($j_05 | 1) | 0] & 255;
    var $55 = $54 + $30 | 0;
    var $56 = __ZN4jpgd12jpeg_decoder5clampEi($55);
    HEAP8[$d0_24 + 4 | 0] = $56;
    var $58 = $54 + $36 | 0;
    var $59 = __ZN4jpgd12jpeg_decoder5clampEi($58);
    HEAP8[$d0_24 + 5 | 0] = $59;
    var $61 = $54 + $38 | 0;
    var $62 = __ZN4jpgd12jpeg_decoder5clampEi($61);
    HEAP8[$d0_24 + 6 | 0] = $62;
    HEAP8[$d0_24 + 7 | 0] = -1;
    var $68 = HEAPU8[$y_28 + ($j_05 + 8) | 0] & 255;
    var $69 = $68 + $30 | 0;
    var $70 = __ZN4jpgd12jpeg_decoder5clampEi($69);
    HEAP8[$d1_23] = $70;
    var $71 = $68 + $36 | 0;
    var $72 = __ZN4jpgd12jpeg_decoder5clampEi($71);
    HEAP8[$d1_23 + 1 | 0] = $72;
    var $74 = $68 + $38 | 0;
    var $75 = __ZN4jpgd12jpeg_decoder5clampEi($74);
    HEAP8[$d1_23 + 2 | 0] = $75;
    HEAP8[$d1_23 + 3 | 0] = -1;
    var $81 = HEAPU8[$y_28 + ($j_05 + 9) | 0] & 255;
    var $82 = $81 + $30 | 0;
    var $83 = __ZN4jpgd12jpeg_decoder5clampEi($82);
    HEAP8[$d1_23 + 4 | 0] = $83;
    var $85 = $81 + $36 | 0;
    var $86 = __ZN4jpgd12jpeg_decoder5clampEi($85);
    HEAP8[$d1_23 + 5 | 0] = $86;
    var $88 = $81 + $38 | 0;
    var $89 = __ZN4jpgd12jpeg_decoder5clampEi($88);
    HEAP8[$d1_23 + 6 | 0] = $89;
    HEAP8[$d1_23 + 7 | 0] = -1;
    var $94 = $c_22 + 1 | 0;
    if (($94 | 0) == ($lftr_limit | 0)) {
      __label__ = 9;
      break;
    } else {
      var $c_22 = $94;
      var $d1_23 = $d1_23 + 8 | 0;
      var $d0_24 = $d0_24 + 8 | 0;
      var $j_05 = $j_05 + 2 | 0;
      __label__ = 8;
      break;
    }
   case 9:
    var $98 = $l_011 + 1 | 0;
    if (($98 | 0) == 2) {
      __label__ = 10;
      break;
    } else {
      var $c_17 = $lftr_limit;
      var $y_28 = $y_28 + 64 | 0;
      var $d1_19 = $scevgep19;
      var $d0_110 = $d0_110 + 32 | 0;
      var $l_011 = $98;
      __label__ = 7;
      break;
    }
   case 10:
    var $102 = $i_012 - 1 | 0;
    if (($102 | 0) > 0) {
      var $i_012 = $102;
      var $c_013 = $c_013 + 384 | 0;
      var $y_114 = $y_114 + 384 | 0;
      var $d1_015 = $d1_015 + 64 | 0;
      var $d0_016 = $scevgep23;
      __label__ = 6;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 11:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder11H2V2ConvertEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder16expanded_convertEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $5 = HEAP32[$this + 324 >> 2] - HEAP32[$this + 388 >> 2] | 0;
    var $7 = HEAP32[$this + 9100 >> 2];
    if (($7 | 0) > 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 3:
    var $21 = $this + 320 | 0;
    var $22 = $this + 9108 | 0;
    var $23 = $this + 9116 | 0;
    var $i_05 = $7;
    var $d_06 = HEAP32[$this + 13288 >> 2];
    var $Py_07 = HEAP32[$this + 9188 >> 2] + (((($5 | 0) / 8 & -1) << 6) * HEAP32[$this + 156 >> 2] | $5 << 3 & 56) | 0;
    var $24 = HEAP32[$21 >> 2];
    __label__ = 4;
    break;
   case 4:
    var $24;
    var $Py_07;
    var $d_06;
    var $i_05;
    if (($24 | 0) > 0) {
      var $d_13 = $d_06;
      var $k_04 = 0;
      __label__ = 5;
      break;
    } else {
      var $d_1_lcssa = $d_06;
      var $70 = $24;
      __label__ = 8;
      break;
    }
   case 5:
    var $k_04;
    var $d_13;
    var $26 = $k_04 << 3;
    var $27 = HEAP32[$23 >> 2];
    var $30 = ($27 << 6) + $26 | 0;
    var $31 = ($27 << 7) + $26 | 0;
    var $d_21 = $d_13;
    var $j_02 = 0;
    __label__ = 6;
    break;
   case 6:
    var $j_02;
    var $d_21;
    var $36 = HEAPU8[$Py_07 + ($j_02 + $26) | 0] & 255;
    var $40 = HEAPU8[$Py_07 + ($30 + $j_02) | 0] & 255;
    var $44 = HEAPU8[$Py_07 + ($31 + $j_02) | 0] & 255;
    var $47 = HEAP32[$this + 9192 + ($44 << 2) >> 2] + $36 | 0;
    var $48 = __ZN4jpgd12jpeg_decoder5clampEi($47);
    HEAP8[$d_21] = $48;
    var $55 = (HEAP32[$this + 12264 + ($40 << 2) >> 2] + HEAP32[$this + 11240 + ($44 << 2) >> 2] >> 16) + $36 | 0;
    var $56 = __ZN4jpgd12jpeg_decoder5clampEi($55);
    HEAP8[$d_21 + 1 | 0] = $56;
    var $60 = HEAP32[$this + 10216 + ($40 << 2) >> 2] + $36 | 0;
    var $61 = __ZN4jpgd12jpeg_decoder5clampEi($60);
    HEAP8[$d_21 + 2 | 0] = $61;
    HEAP8[$d_21 + 3 | 0] = -1;
    var $65 = $j_02 + 1 | 0;
    if (($65 | 0) == 8) {
      __label__ = 7;
      break;
    } else {
      var $d_21 = $d_21 + 4 | 0;
      var $j_02 = $65;
      __label__ = 6;
      break;
    }
   case 7:
    var $scevgep = $d_13 + 32 | 0;
    var $67 = $k_04 + 8 | 0;
    var $68 = HEAP32[$21 >> 2];
    if (($67 | 0) < ($68 | 0)) {
      var $d_13 = $scevgep;
      var $k_04 = $67;
      __label__ = 5;
      break;
    } else {
      var $d_1_lcssa = $scevgep;
      var $70 = $68;
      __label__ = 8;
      break;
    }
   case 8:
    var $70;
    var $d_1_lcssa;
    var $74 = $i_05 - 1 | 0;
    if (($74 | 0) > 0) {
      var $i_05 = $74;
      var $d_06 = $d_1_lcssa;
      var $Py_07 = $Py_07 + (HEAP32[$22 >> 2] << 6) | 0;
      var $24 = $70;
      __label__ = 4;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 9:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder16expanded_convertEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder8find_eoiEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if ((HEAP32[$this + 56 >> 2] | 0) == 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    HEAP32[$this + 9080 >> 2] = 16;
    var $6 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    var $7 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    var $8 = __ZN4jpgd12jpeg_decoder15process_markersEv($this);
    __label__ = 4;
    break;
   case 4:
    var $12 = $this + 13304 | 0;
    var $14 = HEAP32[$12 >> 2] - HEAP32[$this + 492 >> 2] | 0;
    HEAP32[$12 >> 2] = $14;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder6decodeEPPKvPj($this, $pScan_line, $pScan_line_len) {
  var __label__;
  __label__ = 2;
  var setjmpTable = {
    "6": (function(value) {
      __label__ = 27;
      $19 = value;
    }),
    dummy: 0
  };
  while (1) try {
    switch (__label__) {
     case 2:
      if ((HEAP32[$this + 13296 >> 2] | 0) == 0) {
        __label__ = 3;
        break;
      } else {
        var $_0 = -1;
        __label__ = 26;
        break;
      }
     case 3:
      if ((HEAP8[$this + 13300 | 0] & 1) << 24 >> 24 == 0) {
        var $_0 = -1;
        __label__ = 26;
        break;
      } else {
        __label__ = 4;
        break;
      }
     case 4:
      var $10 = $this + 384 | 0;
      if ((HEAP32[$10 >> 2] | 0) == 0) {
        var $_0 = 1;
        __label__ = 26;
        break;
      } else {
        __label__ = 5;
        break;
      }
     case 5:
      var $14 = $this + 388 | 0;
      var $15 = HEAP32[$14 >> 2];
      if (($15 | 0) == 0) {
        __label__ = 6;
        break;
      } else {
        var $36 = $15;
        __label__ = 13;
        break;
      }
     case 6:
      var $19 = (HEAP32[$this >> 2] = __label__, 0);
      __label__ = 27;
      break;
     case 27:
      if (($19 | 0) == 0) {
        __label__ = 7;
        break;
      } else {
        __label__ = 26;
        break;
      }
     case 7:
      if ((HEAP32[$this + 56 >> 2] | 0) == 0) {
        __label__ = 9;
        break;
      } else {
        __label__ = 8;
        break;
      }
     case 8:
      __ZN4jpgd12jpeg_decoder13load_next_rowEv($this);
      __label__ = 10;
      break;
     case 9:
      __ZN4jpgd12jpeg_decoder15decode_next_rowEv($this);
      __label__ = 10;
      break;
     case 10:
      var $29 = $this + 324 | 0;
      var $30 = HEAP32[$29 >> 2];
      if ((HEAP32[$10 >> 2] | 0) > ($30 | 0)) {
        var $34 = $30;
        __label__ = 12;
        break;
      } else {
        __label__ = 11;
        break;
      }
     case 11:
      __ZN4jpgd12jpeg_decoder8find_eoiEv($this);
      var $34 = HEAP32[$29 >> 2];
      __label__ = 12;
      break;
     case 12:
      var $34;
      HEAP32[$14 >> 2] = $34;
      var $36 = $34;
      __label__ = 13;
      break;
     case 13:
      var $36;
      if ((HEAP8[$this + 9120 | 0] & 1) << 24 >> 24 == 0) {
        __label__ = 15;
        break;
      } else {
        __label__ = 14;
        break;
      }
     case 14:
      __ZN4jpgd12jpeg_decoder16expanded_convertEv($this);
      var $43 = HEAP32[$this + 13288 >> 2];
      HEAP32[$pScan_line >> 2] = $43;
      __label__ = 25;
      break;
     case 15:
      var $46 = HEAP32[$this + 148 >> 2];
      if (($46 | 0) == 4) {
        __label__ = 16;
        break;
      } else if (($46 | 0) == 2) {
        __label__ = 19;
        break;
      } else if (($46 | 0) == 3) {
        __label__ = 20;
        break;
      } else if (($46 | 0) == 1) {
        __label__ = 23;
        break;
      } else if (($46 | 0) == 0) {
        __label__ = 24;
        break;
      } else {
        __label__ = 25;
        break;
      }
     case 16:
      if (($36 & 1 | 0) == 0) {
        __label__ = 17;
        break;
      } else {
        __label__ = 18;
        break;
      }
     case 17:
      __ZN4jpgd12jpeg_decoder11H2V2ConvertEv($this);
      var $52 = HEAP32[$this + 13288 >> 2];
      HEAP32[$pScan_line >> 2] = $52;
      __label__ = 25;
      break;
     case 18:
      var $55 = HEAP32[$this + 13292 >> 2];
      HEAP32[$pScan_line >> 2] = $55;
      __label__ = 25;
      break;
     case 19:
      __ZN4jpgd12jpeg_decoder11H2V1ConvertEv($this);
      var $58 = HEAP32[$this + 13288 >> 2];
      HEAP32[$pScan_line >> 2] = $58;
      __label__ = 25;
      break;
     case 20:
      if (($36 & 1 | 0) == 0) {
        __label__ = 21;
        break;
      } else {
        __label__ = 22;
        break;
      }
     case 21:
      __ZN4jpgd12jpeg_decoder11H1V2ConvertEv($this);
      var $64 = HEAP32[$this + 13288 >> 2];
      HEAP32[$pScan_line >> 2] = $64;
      __label__ = 25;
      break;
     case 22:
      var $67 = HEAP32[$this + 13292 >> 2];
      HEAP32[$pScan_line >> 2] = $67;
      __label__ = 25;
      break;
     case 23:
      __ZN4jpgd12jpeg_decoder11H1V1ConvertEv($this);
      var $70 = HEAP32[$this + 13288 >> 2];
      HEAP32[$pScan_line >> 2] = $70;
      __label__ = 25;
      break;
     case 24:
      __ZN4jpgd12jpeg_decoder12gray_convertEv($this);
      var $73 = HEAP32[$this + 13288 >> 2];
      HEAP32[$pScan_line >> 2] = $73;
      __label__ = 25;
      break;
     case 25:
      var $76 = HEAP32[$this + 392 >> 2];
      HEAP32[$pScan_line_len >> 2] = $76;
      var $78 = HEAP32[$14 >> 2] - 1 | 0;
      HEAP32[$14 >> 2] = $78;
      var $80 = HEAP32[$10 >> 2] - 1 | 0;
      HEAP32[$10 >> 2] = $80;
      var $_0 = 0;
      __label__ = 26;
      break;
     case 26:
      var $_0;
      return $_0;
     default:
      assert(0, "bad label: " + __label__);
    }
  } catch (e) {
    if (!e.longjmp) throw e;
    setjmpTable[e.label](e.value);
  }
}

__ZN4jpgd12jpeg_decoder6decodeEPPKvPj["X"] = 1;

function __ZN4jpgd12jpeg_decoder20calc_mcu_block_orderEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this + 152 | 0;
    var $2 = HEAP32[$1 >> 2];
    if (($2 | 0) > 0) {
      var $max_v_samp_08 = 0;
      var $max_h_samp_09 = 0;
      var $component_id_010 = 0;
      __label__ = 4;
      break;
    } else {
      var $max_h_samp_0_lcssa15 = 0;
      var $max_v_samp_0_lcssa16 = 0;
      __label__ = 6;
      break;
    }
   case 3:
    var $4 = $this + 44 | 0;
    var $5 = $_max_h_samp_0 - 1 | 0;
    var $6 = $this + 48 | 0;
    var $7 = $max_v_samp_1 - 1 | 0;
    var $component_id_15 = 0;
    __label__ = 5;
    break;
   case 4:
    var $component_id_010;
    var $max_h_samp_09;
    var $max_v_samp_08;
    var $9 = HEAP32[$this + 156 + ($component_id_010 << 2) >> 2];
    var $_max_h_samp_0 = ($9 | 0) > ($max_h_samp_09 | 0) ? $9 : $max_h_samp_09;
    var $12 = HEAP32[$this + 172 + ($component_id_010 << 2) >> 2];
    var $max_v_samp_1 = ($12 | 0) > ($max_v_samp_08 | 0) ? $12 : $max_v_samp_08;
    var $14 = $component_id_010 + 1 | 0;
    if (($14 | 0) < ($2 | 0)) {
      var $max_v_samp_08 = $max_v_samp_1;
      var $max_h_samp_09 = $_max_h_samp_0;
      var $component_id_010 = $14;
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 5:
    var $component_id_15;
    var $24 = ((($5 + HEAP32[$this + 156 + ($component_id_15 << 2) >> 2] * HEAP32[$4 >> 2] | 0) / ($_max_h_samp_0 | 0) & -1) + 7 | 0) / 8 & -1;
    HEAP32[$this + 220 + ($component_id_15 << 2) >> 2] = $24;
    var $33 = ((($7 + HEAP32[$this + 172 + ($component_id_15 << 2) >> 2] * HEAP32[$6 >> 2] | 0) / ($max_v_samp_1 | 0) & -1) + 7 | 0) / 8 & -1;
    HEAP32[$this + 236 + ($component_id_15 << 2) >> 2] = $33;
    var $35 = $component_id_15 + 1 | 0;
    if (($35 | 0) < (HEAP32[$1 >> 2] | 0)) {
      var $component_id_15 = $35;
      __label__ = 5;
      break;
    } else {
      var $max_h_samp_0_lcssa15 = $_max_h_samp_0;
      var $max_v_samp_0_lcssa16 = $max_v_samp_1;
      __label__ = 6;
      break;
    }
   case 6:
    var $max_v_samp_0_lcssa16;
    var $max_h_samp_0_lcssa15;
    var $38 = $this + 252 | 0;
    var $39 = HEAP32[$38 >> 2];
    if (($39 | 0) == 1) {
      __label__ = 7;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 7:
    var $43 = HEAP32[$this + 256 >> 2];
    var $45 = HEAP32[$this + 220 + ($43 << 2) >> 2];
    HEAP32[$this + 336 >> 2] = $45;
    var $48 = HEAP32[$this + 236 + ($43 << 2) >> 2];
    HEAP32[$this + 340 >> 2] = $48;
    var $51 = HEAP32[$this + 256 >> 2];
    HEAP32[$this + 344 >> 2] = $51;
    HEAP32[$this + 328 >> 2] = 1;
    __label__ = 13;
    break;
   case 8:
    var $61 = ($max_h_samp_0_lcssa15 - 1 + ((HEAP32[$this + 44 >> 2] + 7 | 0) / 8 & -1) | 0) / ($max_h_samp_0_lcssa15 | 0) & -1;
    HEAP32[$this + 336 >> 2] = $61;
    var $69 = ($max_v_samp_0_lcssa16 - 1 + ((HEAP32[$this + 48 >> 2] + 7 | 0) / 8 & -1) | 0) / ($max_v_samp_0_lcssa16 | 0) & -1;
    HEAP32[$this + 340 >> 2] = $69;
    var $71 = $this + 328 | 0;
    HEAP32[$71 >> 2] = 0;
    if (($39 | 0) > 0) {
      var $component_num_02 = 0;
      var $73 = $39;
      __label__ = 9;
      break;
    } else {
      __label__ = 13;
      break;
    }
   case 9:
    var $73;
    var $component_num_02;
    var $75 = HEAP32[$this + 256 + ($component_num_02 << 2) >> 2];
    var $80 = HEAP32[$this + 172 + ($75 << 2) >> 2] * HEAP32[$this + 156 + ($75 << 2) >> 2] | 0;
    if (($80 | 0) == 0) {
      var $87 = $73;
      __label__ = 12;
      break;
    } else {
      var $num_blocks_01 = $80;
      __label__ = 10;
      break;
    }
   case 10:
    var $num_blocks_01;
    var $82 = $num_blocks_01 - 1 | 0;
    var $83 = HEAP32[$71 >> 2];
    var $84 = $83 + 1 | 0;
    HEAP32[$71 >> 2] = $84;
    var $85 = $this + 344 + ($83 << 2) | 0;
    HEAP32[$85 >> 2] = $75;
    if (($82 | 0) == 0) {
      __label__ = 11;
      break;
    } else {
      var $num_blocks_01 = $82;
      __label__ = 10;
      break;
    }
   case 11:
    var $87 = HEAP32[$38 >> 2];
    __label__ = 12;
    break;
   case 12:
    var $87;
    var $88 = $component_num_02 + 1 | 0;
    if (($88 | 0) < ($87 | 0)) {
      var $component_num_02 = $88;
      var $73 = $87;
      __label__ = 9;
      break;
    } else {
      __label__ = 13;
      break;
    }
   case 13:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder20calc_mcu_block_orderEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder15make_huff_tableEiPNS0_11huff_tablesE($this, $index, $pH) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 1288;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $huffsize = __stackBase__;
    var $huffcode = __stackBase__ + 260;
    var $5 = HEAP8[$index + ($this + 60) | 0] << 24 >> 24 != 0 & 1;
    HEAP8[$pH | 0] = $5;
    var $7 = HEAP32[$this + 68 + ($index << 2) >> 2];
    var $l_033 = 1;
    var $p_034 = 0;
    __label__ = 3;
    break;
   case 3:
    var $p_034;
    var $l_033;
    var $9 = HEAPU8[$7 + $l_033 | 0];
    if ($9 << 24 >> 24 == 0) {
      var $p_1_lcssa = $p_034;
      __label__ = 5;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    var $12 = $9 & 255;
    var $13 = $12 + 1 | 0;
    var $scevgep = $huffsize + $p_034 | 0;
    var $14 = $13 >>> 0 > 2;
    var $15 = $14 ? $12 : 1;
    _memset($scevgep, $l_033 & 255, $15, 1);
    var $smax = $14 ? $13 : 2;
    var $p_1_lcssa = $p_034 - 1 + $smax | 0;
    __label__ = 5;
    break;
   case 5:
    var $p_1_lcssa;
    var $19 = $l_033 + 1 | 0;
    if (($19 | 0) == 17) {
      __label__ = 6;
      break;
    } else {
      var $l_033 = $19;
      var $p_034 = $p_1_lcssa;
      __label__ = 3;
      break;
    }
   case 6:
    HEAP8[$huffsize + $p_1_lcssa | 0] = 0;
    var $23 = HEAPU8[$huffsize | 0];
    if ($23 << 24 >> 24 == 0) {
      __label__ = 11;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 7:
    var $code_023 = 0;
    var $si_024 = $23 & 255;
    var $p_225 = 0;
    var $26 = $23;
    __label__ = 8;
    break;
   case 8:
    var $26;
    var $p_225;
    var $si_024;
    var $code_023;
    if (($26 & 255 | 0) == ($si_024 | 0)) {
      var $code_117 = $code_023;
      var $p_318 = $p_225;
      __label__ = 9;
      break;
    } else {
      var $code_1_lcssa = $code_023;
      var $p_3_lcssa = $p_225;
      var $36 = $26;
      __label__ = 10;
      break;
    }
   case 9:
    var $p_318;
    var $code_117;
    var $29 = $p_318 + 1 | 0;
    HEAP32[$huffcode + ($p_318 << 2) >> 2] = $code_117;
    var $31 = $code_117 + 1 | 0;
    var $33 = HEAPU8[$huffsize + $29 | 0];
    if (($33 & 255 | 0) == ($si_024 | 0)) {
      var $code_117 = $31;
      var $p_318 = $29;
      __label__ = 9;
      break;
    } else {
      var $code_1_lcssa = $31;
      var $p_3_lcssa = $29;
      var $36 = $33;
      __label__ = 10;
      break;
    }
   case 10:
    var $36;
    var $p_3_lcssa;
    var $code_1_lcssa;
    if ($36 << 24 >> 24 == 0) {
      __label__ = 11;
      break;
    } else {
      var $code_023 = $code_1_lcssa << 1;
      var $si_024 = $si_024 + 1 | 0;
      var $p_225 = $p_3_lcssa;
      var $26 = $36;
      __label__ = 8;
      break;
    }
   case 11:
    var $41 = ($p_1_lcssa | 0) > 0;
    var $42 = $pH + 4 | 0;
    for (var $$dest = $42 >> 2, $$stop = $$dest + 1088; $$dest < $$stop; $$dest++) {
      HEAP32[$$dest] = 0;
    }
    if ($41) {
      __label__ = 12;
      break;
    } else {
      __label__ = 31;
      break;
    }
   case 12:
    var $43 = $this + 100 + ($index << 2) | 0;
    var $nextfreeentry_012 = -1;
    var $p_413 = 0;
    var $45 = $23;
    __label__ = 13;
    break;
   case 13:
    var $45;
    var $p_413;
    var $nextfreeentry_012;
    var $49 = HEAPU8[HEAP32[$43 >> 2] + $p_413 | 0] & 255;
    var $51 = HEAPU32[$huffcode + ($p_413 << 2) >> 2];
    var $52 = $45 & 255;
    HEAP8[$49 + ($pH + 2052) | 0] = $45;
    if (($45 & 255) < 9) {
      __label__ = 14;
      break;
    } else {
      __label__ = 22;
      break;
    }
   case 14:
    var $56 = 8 - $52 | 0;
    var $57 = 1 << $56;
    if (($57 | 0) > 0) {
      __label__ = 15;
      break;
    } else {
      var $nextfreeentry_4 = $nextfreeentry_012;
      __label__ = 29;
      break;
    }
   case 15:
    var $59 = $51 << $56;
    var $60 = $49 & 15;
    var $63 = $52 << 8 | $49;
    var $64 = $52 + $60 | 0;
    var $66 = (1 << $60) - 1 | 0;
    var $67 = 8 - $64 | 0;
    var $69 = $49 | $64 << 8;
    var $70 = $57 + $59 | 0;
    var $brmerge = ($60 | 0) == 0 | ($64 | 0) > 8;
    var $code_23 = $59;
    __label__ = 16;
    break;
   case 16:
    var $code_23;
    HEAP32[$pH + 4 + ($code_23 << 2) >> 2] = $49;
    if ($brmerge) {
      __label__ = 19;
      break;
    } else {
      __label__ = 17;
      break;
    }
   case 17:
    var $75 = $code_23 >>> ($67 >>> 0) & $66;
    if (($75 | 0) < 32768) {
      __label__ = 20;
      break;
    } else {
      __label__ = 18;
      break;
    }
   case 18:
    ___assert_func(STRING_TABLE.__str114 | 0, 2294, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder15make_huff_tableEiPNS0_11huff_tablesE | 0, STRING_TABLE.__str11125 | 0);
    __label__ = 20;
    break;
   case 19:
    HEAP32[$pH + 1028 + ($code_23 << 2) >> 2] = $63;
    __label__ = 21;
    break;
   case 20:
    var $82 = $69 | $75 << 16 | 32768;
    HEAP32[$pH + 1028 + ($code_23 << 2) >> 2] = $82;
    __label__ = 21;
    break;
   case 21:
    var $85 = $code_23 + 1 | 0;
    if (($85 | 0) == ($70 | 0)) {
      var $nextfreeentry_4 = $nextfreeentry_012;
      __label__ = 29;
      break;
    } else {
      var $code_23 = $85;
      __label__ = 16;
      break;
    }
   case 22:
    var $89 = $51 >>> (($52 - 8 | 0) >>> 0) & 255;
    var $90 = $pH + 4 + ($89 << 2) | 0;
    var $91 = HEAPU32[$90 >> 2];
    if (($91 | 0) == 0) {
      __label__ = 23;
      break;
    } else {
      var $currententry_0 = $91;
      var $nextfreeentry_1 = $nextfreeentry_012;
      __label__ = 24;
      break;
    }
   case 23:
    HEAP32[$90 >> 2] = $nextfreeentry_012;
    HEAP32[$pH + 1028 + ($89 << 2) >> 2] = $nextfreeentry_012;
    var $currententry_0 = $nextfreeentry_012;
    var $nextfreeentry_1 = $nextfreeentry_012 - 2 | 0;
    __label__ = 24;
    break;
   case 24:
    var $nextfreeentry_1;
    var $currententry_0;
    var $98 = $51 << 24 - $52;
    var $103 = $pH + 2308 + (($currententry_0 - 1 + ($98 >>> 15 & 1) ^ -1) << 2) | 0;
    if (($45 & 255) > 9) {
      var $nextfreeentry_27 = $nextfreeentry_1;
      var $code_38 = $98;
      var $l_29 = $52;
      var $104 = $103;
      __label__ = 25;
      break;
    } else {
      var $nextfreeentry_2_lcssa = $nextfreeentry_1;
      var $_lcssa = $103;
      __label__ = 28;
      break;
    }
   case 25:
    var $104;
    var $l_29;
    var $code_38;
    var $nextfreeentry_27;
    var $105 = HEAP32[$104 >> 2];
    if (($105 | 0) == 0) {
      __label__ = 26;
      break;
    } else {
      var $currententry_3 = $105;
      var $nextfreeentry_3 = $nextfreeentry_27;
      __label__ = 27;
      break;
    }
   case 26:
    HEAP32[$104 >> 2] = $nextfreeentry_27;
    var $currententry_3 = $nextfreeentry_27;
    var $nextfreeentry_3 = $nextfreeentry_27 - 2 | 0;
    __label__ = 27;
    break;
   case 27:
    var $nextfreeentry_3;
    var $currententry_3;
    var $111 = $l_29 - 1 | 0;
    var $116 = $pH + 2308 + (($currententry_3 - 1 + ($code_38 >>> 14 & 1) ^ -1) << 2) | 0;
    if (($111 | 0) > 9) {
      var $nextfreeentry_27 = $nextfreeentry_3;
      var $code_38 = $code_38 << 1;
      var $l_29 = $111;
      var $104 = $116;
      __label__ = 25;
      break;
    } else {
      var $nextfreeentry_2_lcssa = $nextfreeentry_3;
      var $_lcssa = $116;
      __label__ = 28;
      break;
    }
   case 28:
    var $_lcssa;
    var $nextfreeentry_2_lcssa;
    HEAP32[$_lcssa >> 2] = $49;
    var $nextfreeentry_4 = $nextfreeentry_2_lcssa;
    __label__ = 29;
    break;
   case 29:
    var $nextfreeentry_4;
    var $117 = $p_413 + 1 | 0;
    if (($117 | 0) == ($p_1_lcssa | 0)) {
      __label__ = 31;
      break;
    } else {
      __label__ = 30;
      break;
    }
   case 30:
    var $_pre = HEAP8[$huffsize + $117 | 0];
    var $nextfreeentry_012 = $nextfreeentry_4;
    var $p_413 = $117;
    var $45 = $_pre;
    __label__ = 13;
    break;
   case 31:
    STACKTOP = __stackBase__;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder15make_huff_tableEiPNS0_11huff_tablesE["X"] = 1;

function __ZN4jpgd12jpeg_decoder9init_scanEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = __ZN4jpgd12jpeg_decoder17locate_sos_markerEv($this);
    if (($1 | 0) == 0) {
      var $_0 = 0;
      __label__ = 6;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    __ZN4jpgd12jpeg_decoder20calc_mcu_block_orderEv($this);
    __ZN4jpgd12jpeg_decoder17check_huff_tablesEv($this);
    __ZN4jpgd12jpeg_decoder18check_quant_tablesEv($this);
    var $5 = $this + 9128 | 0;
    var $8 = HEAP32[$this + 152 >> 2] << 2;
    _memset($5, 0, $8, 4);
    HEAP32[$this + 468 >> 2] = 0;
    var $11 = HEAP32[$this + 9088 >> 2];
    if (($11 | 0) == 0) {
      __label__ = 5;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    HEAP32[$this + 9092 >> 2] = $11;
    HEAP32[$this + 9096 >> 2] = 0;
    __label__ = 5;
    break;
   case 5:
    __ZN4jpgd12jpeg_decoder13fix_in_bufferEv($this);
    var $_0 = 1;
    __label__ = 6;
    break;
   case 6:
    var $_0;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder14coeff_buf_openEiiii($this, $block_num_x, $block_num_y, $block_len_x, $block_len_y) {
  var $1 = __ZN4jpgd12jpeg_decoder5allocEjb($this, 24, 0);
  var $2 = $1;
  HEAP32[$1 + 4 >> 2] = $block_num_x;
  HEAP32[$1 + 8 >> 2] = $block_num_y;
  HEAP32[$1 + 12 >> 2] = $block_len_x;
  HEAP32[$1 + 16 >> 2] = $block_len_y;
  var $12 = ($block_len_x << 1) * $block_len_y | 0;
  HEAP32[$1 + 20 >> 2] = $12;
  var $16 = $block_num_y * $block_num_x * $12 | 0;
  var $17 = __ZN4jpgd12jpeg_decoder5allocEjb($this, $16, 1);
  HEAP32[$1 >> 2] = $17;
  return $2;
}

function __ZN4jpgd12jpeg_decoder21decode_block_dc_firstEPS0_iii($pD, $component_id, $block_x, $block_y) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAP32[$pD + 436 + ($component_id << 2) >> 2];
    var $3 = __ZN4jpgd12jpeg_decoder14coeff_buf_getpEPNS0_9coeff_bufEii($2, $block_x, $block_y);
    var $7 = HEAP32[$pD + 404 + (HEAP32[$pD + 272 + ($component_id << 2) >> 2] << 2) >> 2];
    var $8 = __ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesE($pD, $7);
    if (($8 | 0) == 0) {
      var $s_0 = 0;
      __label__ = 5;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $11 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($pD, $8);
    var $12 = $8 & 15;
    if (($11 | 0) < (HEAP32[__ZN4jpgdL13s_extend_testE + ($12 << 2) >> 2] | 0)) {
      __label__ = 4;
      break;
    } else {
      var $s_0 = $11;
      __label__ = 5;
      break;
    }
   case 4:
    var $s_0 = HEAP32[__ZN4jpgdL15s_extend_offsetE + ($12 << 2) >> 2] + $11 | 0;
    __label__ = 5;
    break;
   case 5:
    var $s_0;
    var $21 = $pD + 9128 + ($component_id << 2) | 0;
    var $23 = HEAP32[$21 >> 2] + $s_0 | 0;
    HEAP32[$21 >> 2] = $23;
    HEAP16[$3 >> 1] = $23 << HEAP32[$pD + 312 >> 2] & 65535;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesE($this, $pH) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAPU32[$this + 9084 >> 2];
    var $5 = HEAPU32[$pH + 4 + ($2 >>> 24 << 2) >> 2];
    if (($5 | 0) < 0) {
      var $ofs_0 = 23;
      var $symbol_0 = $5;
      __label__ = 3;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 3:
    var $symbol_0;
    var $ofs_0;
    var $12 = HEAPU32[$pH + 2308 + (-($symbol_0 + ($2 >>> ($ofs_0 >>> 0) & 1)) << 2) >> 2];
    if (($12 | 0) < 0) {
      var $ofs_0 = $ofs_0 - 1 | 0;
      var $symbol_0 = $12;
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    var $17 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, 32 - $ofs_0 | 0);
    var $symbol_1 = $12;
    __label__ = 6;
    break;
   case 5:
    var $21 = HEAPU8[$5 + ($pH + 2052) | 0] & 255;
    var $22 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($this, $21);
    var $symbol_1 = $5;
    __label__ = 6;
    break;
   case 6:
    var $symbol_1;
    return $symbol_1;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder22decode_block_dc_refineEPS0_iii($pD, $component_id, $block_x, $block_y) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($pD, 1);
    if (($1 | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $5 = HEAP32[$pD + 436 + ($component_id << 2) >> 2];
    var $6 = __ZN4jpgd12jpeg_decoder14coeff_buf_getpEPNS0_9coeff_bufEii($5, $block_x, $block_y);
    HEAP16[$6 >> 1] = (HEAPU16[$6 >> 1] & 65535 | 1 << HEAP32[$pD + 312 >> 2]) & 65535;
    __label__ = 4;
    break;
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder18check_quant_tablesEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAP32[$this + 252 >> 2];
    var $i_0 = 0;
    __label__ = 3;
    break;
   case 3:
    var $i_0;
    if (($i_0 | 0) < ($2 | 0)) {
      __label__ = 4;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 4:
    if ((HEAP32[$this + 132 + (HEAP32[$this + 188 + (HEAP32[$this + 256 + ($i_0 << 2) >> 2] << 2) >> 2] << 2) >> 2] | 0) == 0) {
      __label__ = 5;
      break;
    } else {
      var $i_0 = $i_0 + 1 | 0;
      __label__ = 3;
      break;
    }
   case 5:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -235);
    throw "Reached an unreachable!";
   case 6:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder17check_huff_tablesEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAP32[$this + 252 >> 2];
    var $3 = $this + 304 | 0;
    var $4 = $this + 308 | 0;
    var $i_0 = 0;
    __label__ = 3;
    break;
   case 3:
    var $i_0;
    if (($i_0 | 0) < ($2 | 0)) {
      __label__ = 4;
      break;
    } else {
      var $i1_01 = 0;
      __label__ = 11;
      break;
    }
   case 4:
    if ((HEAP32[$3 >> 2] | 0) == 0) {
      __label__ = 5;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 5:
    if ((HEAP32[$this + 68 + (HEAP32[$this + 272 + (HEAP32[$this + 256 + ($i_0 << 2) >> 2] << 2) >> 2] << 2) >> 2] | 0) == 0) {
      __label__ = 6;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 6:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -234);
    throw "Reached an unreachable!";
   case 7:
    if ((HEAP32[$4 >> 2] | 0) > 0) {
      __label__ = 8;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 8:
    if ((HEAP32[$this + 68 + (HEAP32[$this + 288 + (HEAP32[$this + 256 + ($i_0 << 2) >> 2] << 2) >> 2] << 2) >> 2] | 0) == 0) {
      __label__ = 9;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 9:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -234);
    throw "Reached an unreachable!";
   case 10:
    var $i_0 = $i_0 + 1 | 0;
    __label__ = 3;
    break;
   case 11:
    var $i1_01;
    if ((HEAP32[$this + 68 + ($i1_01 << 2) >> 2] | 0) == 0) {
      __label__ = 15;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 12:
    var $36 = $this + 404 + ($i1_01 << 2) | 0;
    var $37 = HEAP32[$36 >> 2];
    if (($37 | 0) == 0) {
      __label__ = 13;
      break;
    } else {
      var $43 = $37;
      __label__ = 14;
      break;
    }
   case 13:
    var $40 = __ZN4jpgd12jpeg_decoder5allocEjb($this, 4356, 0);
    var $41 = $40;
    HEAP32[$36 >> 2] = $41;
    var $43 = $41;
    __label__ = 14;
    break;
   case 14:
    var $43;
    __ZN4jpgd12jpeg_decoder15make_huff_tableEiPNS0_11huff_tablesE($this, $i1_01, $43);
    __label__ = 15;
    break;
   case 15:
    var $45 = $i1_01 + 1 | 0;
    if (($45 | 0) == 8) {
      __label__ = 16;
      break;
    } else {
      var $i1_01 = $45;
      __label__ = 11;
      break;
    }
   case 16:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder17check_huff_tablesEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder10init_frameEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this + 152 | 0;
    var $2 = HEAP32[$1 >> 2];
    if (($2 | 0) == 1) {
      __label__ = 3;
      break;
    } else if (($2 | 0) == 3) {
      __label__ = 7;
      break;
    } else {
      __label__ = 26;
      break;
    }
   case 3:
    if ((HEAP32[$this + 156 >> 2] | 0) == 1) {
      __label__ = 4;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 4:
    if ((HEAP32[$this + 172 >> 2] | 0) == 1) {
      __label__ = 6;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -231);
    throw "Reached an unreachable!";
   case 6:
    HEAP32[$this + 148 >> 2] = 0;
    HEAP32[$this + 9104 >> 2] = 1;
    HEAP32[$this + 320 >> 2] = 8;
    HEAP32[$this + 324 >> 2] = 8;
    var $84 = 8;
    var $83 = 8;
    var $82 = 1;
    __label__ = 27;
    break;
   case 7:
    if ((HEAP32[$this + 160 >> 2] | 0) == 1) {
      __label__ = 8;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 8:
    var $22 = $this + 172 | 0;
    if ((HEAP32[$this + 176 >> 2] | 0) == 1) {
      __label__ = 9;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 9:
    if ((HEAP32[$this + 164 >> 2] | 0) == 1) {
      __label__ = 10;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 10:
    if ((HEAP32[$this + 180 >> 2] | 0) == 1) {
      __label__ = 12;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 11:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -231);
    throw "Reached an unreachable!";
   case 12:
    var $37 = HEAP32[$this + 156 >> 2];
    var $38 = ($37 | 0) == 1;
    if ($38) {
      __label__ = 13;
      break;
    } else {
      __label__ = 16;
      break;
    }
   case 13:
    if ((HEAP32[$22 >> 2] | 0) == 1) {
      __label__ = 15;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 14:
    var $60 = ($37 | 0) == 2;
    __label__ = 19;
    break;
   case 15:
    HEAP32[$this + 148 >> 2] = 1;
    HEAP32[$this + 9104 >> 2] = 3;
    HEAP32[$this + 320 >> 2] = 8;
    HEAP32[$this + 324 >> 2] = 8;
    var $84 = 8;
    var $83 = 8;
    var $82 = 4;
    __label__ = 27;
    break;
   case 16:
    var $49 = ($37 | 0) == 2;
    if ($49) {
      __label__ = 17;
      break;
    } else {
      __label__ = 25;
      break;
    }
   case 17:
    if ((HEAP32[$22 >> 2] | 0) == 1) {
      __label__ = 18;
      break;
    } else {
      var $60 = $49;
      __label__ = 19;
      break;
    }
   case 18:
    HEAP32[$this + 148 >> 2] = 2;
    HEAP32[$this + 9104 >> 2] = 4;
    HEAP32[$this + 320 >> 2] = 16;
    HEAP32[$this + 324 >> 2] = 8;
    var $84 = 16;
    var $83 = 8;
    var $82 = 4;
    __label__ = 27;
    break;
   case 19:
    var $60;
    if ($38) {
      __label__ = 20;
      break;
    } else {
      var $70 = $60;
      __label__ = 22;
      break;
    }
   case 20:
    if ((HEAP32[$22 >> 2] | 0) == 2) {
      __label__ = 21;
      break;
    } else {
      var $70 = $60;
      __label__ = 22;
      break;
    }
   case 21:
    HEAP32[$this + 148 >> 2] = 3;
    HEAP32[$this + 9104 >> 2] = 4;
    HEAP32[$this + 320 >> 2] = 8;
    HEAP32[$this + 324 >> 2] = 16;
    var $84 = 8;
    var $83 = 16;
    var $82 = 4;
    __label__ = 27;
    break;
   case 22:
    var $70;
    if ($70) {
      __label__ = 23;
      break;
    } else {
      __label__ = 25;
      break;
    }
   case 23:
    if ((HEAP32[$22 >> 2] | 0) == 2) {
      __label__ = 24;
      break;
    } else {
      __label__ = 25;
      break;
    }
   case 24:
    HEAP32[$this + 148 >> 2] = 4;
    HEAP32[$this + 9104 >> 2] = 6;
    HEAP32[$this + 320 >> 2] = 16;
    HEAP32[$this + 324 >> 2] = 16;
    var $84 = 16;
    var $83 = 16;
    var $82 = 4;
    __label__ = 27;
    break;
   case 25:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -231);
    throw "Reached an unreachable!";
   case 26:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -232);
    throw "Reached an unreachable!";
   case 27:
    var $82;
    var $83;
    var $84;
    var $86 = HEAP32[$this + 44 >> 2];
    var $89 = ($86 - 1 + $84 | 0) / ($84 | 0) & -1;
    var $90 = $this + 9100 | 0;
    HEAP32[$90 >> 2] = $89;
    var $91 = $this + 48 | 0;
    var $95 = (HEAP32[$91 >> 2] - 1 + $83 | 0) / ($83 | 0) & -1;
    HEAP32[$this + 9124 >> 2] = $95;
    var $97 = $this + 148 | 0;
    HEAP32[$this + 400 >> 2] = $82;
    var $101 = ($86 + 15 & 65520) * $82 | 0;
    var $102 = $this + 396 | 0;
    HEAP32[$102 >> 2] = $101;
    var $103 = $82 * $86 | 0;
    HEAP32[$this + 392 >> 2] = $103;
    var $105 = __ZN4jpgd12jpeg_decoder5allocEjb($this, $101, 1);
    HEAP32[$this + 13288 >> 2] = $105;
    if ((HEAP32[$97 >> 2] - 3 | 0) >>> 0 < 2) {
      __label__ = 28;
      break;
    } else {
      __label__ = 29;
      break;
    }
   case 28:
    var $109 = HEAP32[$102 >> 2];
    var $110 = __ZN4jpgd12jpeg_decoder5allocEjb($this, $109, 1);
    HEAP32[$this + 13292 >> 2] = $110;
    __label__ = 29;
    break;
   case 29:
    var $114 = $this + 9104 | 0;
    var $115 = HEAP32[$114 >> 2];
    var $116 = $115 * HEAP32[$90 >> 2] | 0;
    var $117 = $this + 332 | 0;
    HEAP32[$117 >> 2] = $116;
    if (($116 | 0) > 8192) {
      __label__ = 30;
      break;
    } else {
      __label__ = 31;
      break;
    }
   case 30:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -228);
    throw "Reached an unreachable!";
   case 31:
    var $121 = $115 << 7;
    var $122 = __ZN4jpgd12jpeg_decoder5allocEjb($this, $121, 0);
    var $123 = $122;
    HEAP32[$this + 9144 >> 2] = $123;
    if ((HEAP32[$114 >> 2] | 0) > 0) {
      var $i_03 = 0;
      __label__ = 32;
      break;
    } else {
      __label__ = 33;
      break;
    }
   case 32:
    var $i_03;
    HEAP32[$this + 9148 + ($i_03 << 2) >> 2] = 64;
    var $128 = $i_03 + 1 | 0;
    if (($128 | 0) < (HEAP32[$114 >> 2] | 0)) {
      var $i_03 = $128;
      __label__ = 32;
      break;
    } else {
      __label__ = 33;
      break;
    }
   case 33:
    var $135 = HEAP32[$this + 172 >> 2] * HEAP32[$this + 156 >> 2] | 0;
    HEAP32[$this + 9116 >> 2] = $135;
    var $138 = $135 * HEAP32[$1 >> 2] | 0;
    HEAP32[$this + 9108 >> 2] = $138;
    var $141 = HEAP32[$90 >> 2] * $138 | 0;
    HEAP32[$this + 9112 >> 2] = $141;
    var $144 = ($138 | 0) == 12;
    HEAP8[$this + 9120 | 0] = $144 & 1;
    if ($144) {
      __label__ = 34;
      break;
    } else {
      __label__ = 35;
      break;
    }
   case 34:
    var $147 = $141 << 6;
    var $148 = __ZN4jpgd12jpeg_decoder5allocEjb($this, $147, 0);
    HEAP32[$this + 9188 >> 2] = $148;
    __label__ = 36;
    break;
   case 35:
    var $152 = HEAP32[$117 >> 2] << 6;
    var $153 = __ZN4jpgd12jpeg_decoder5allocEjb($this, $152, 0);
    HEAP32[$this + 9188 >> 2] = $153;
    __label__ = 36;
    break;
   case 36:
    var $156 = HEAP32[$91 >> 2];
    HEAP32[$this + 384 >> 2] = $156;
    HEAP32[$this + 388 >> 2] = 0;
    __ZN4jpgd12jpeg_decoder15create_look_upsEv($this);
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder10init_frameEv["X"] = 1;

function __ZNK4jpgd12jpeg_decoder14get_error_codeEv($this_0_72_val) {
  return $this_0_72_val;
}

function __ZNK4jpgd12jpeg_decoder9get_widthEv($this_0_2_val) {
  return $this_0_2_val;
}

function __ZNK4jpgd12jpeg_decoder10get_heightEv($this_0_3_val) {
  return $this_0_3_val;
}

function __ZNK4jpgd12jpeg_decoder18get_num_componentsEv($this_0_11_val) {
  return $this_0_11_val;
}

function __ZN4jpgd19jpeg_decoder_streamC2Ev($this) {
  HEAP32[$this >> 2] = __ZTVN4jpgd19jpeg_decoder_streamE + 8 | 0;
  return;
}

function __ZN4jpgd12jpeg_decoder11decode_scanEPFvPS0_iiiE($this, $decode_block_func) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 32;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $block_x_mcu = __stackBase__;
    var $m_block_y_mcu = __stackBase__ + 16;
    var $1 = $m_block_y_mcu;
    HEAP32[$1 >> 2] = 0;
    HEAP32[$1 + 4 >> 2] = 0;
    HEAP32[$1 + 8 >> 2] = 0;
    HEAP32[$1 + 12 >> 2] = 0;
    var $2 = $this + 340 | 0;
    if ((HEAP32[$2 >> 2] | 0) > 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 22;
      break;
    }
   case 3:
    var $5 = $block_x_mcu;
    var $6 = $this + 336 | 0;
    var $7 = $this + 252 | 0;
    var $8 = $this + 256 | 0;
    var $9 = $this + 9088 | 0;
    var $10 = $this + 9092 | 0;
    var $11 = $this + 328 | 0;
    var $mcu_col_011 = 0;
    var $13 = HEAP32[$6 >> 2];
    __label__ = 4;
    break;
   case 4:
    var $13;
    var $mcu_col_011;
    HEAP32[$5 >> 2] = 0;
    HEAP32[$5 + 4 >> 2] = 0;
    HEAP32[$5 + 8 >> 2] = 0;
    HEAP32[$5 + 12 >> 2] = 0;
    if (($13 | 0) > 0) {
      var $mcu_row_04 = 1;
      __label__ = 5;
      break;
    } else {
      var $55 = $13;
      __label__ = 17;
      break;
    }
   case 5:
    var $mcu_row_04;
    if ((HEAP32[$9 >> 2] | 0) == 0) {
      __label__ = 8;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    if ((HEAP32[$10 >> 2] | 0) == 0) {
      __label__ = 7;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 7:
    __ZN4jpgd12jpeg_decoder15process_restartEv($this);
    __label__ = 8;
    break;
   case 8:
    if ((HEAP32[$11 >> 2] | 0) > 0) {
      var $mcu_block_01 = 0;
      var $block_x_mcu_ofs_02 = 0;
      var $block_y_mcu_ofs_03 = 0;
      __label__ = 9;
      break;
    } else {
      __label__ = 15;
      break;
    }
   case 9:
    var $block_y_mcu_ofs_03;
    var $block_x_mcu_ofs_02;
    var $mcu_block_01;
    var $24 = HEAP32[$this + 344 + ($mcu_block_01 << 2) >> 2];
    var $25 = $block_x_mcu + ($24 << 2) | 0;
    var $26 = HEAP32[$25 >> 2];
    var $27 = $26 + $block_x_mcu_ofs_02 | 0;
    var $30 = HEAP32[$m_block_y_mcu + ($24 << 2) >> 2] + $block_y_mcu_ofs_03 | 0;
    FUNCTION_TABLE[$decode_block_func]($this, $24, $27, $30);
    if ((HEAP32[$7 >> 2] | 0) == 1) {
      __label__ = 10;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 10:
    var $34 = $26 + 1 | 0;
    HEAP32[$25 >> 2] = $34;
    var $block_y_mcu_ofs_1 = $block_y_mcu_ofs_03;
    var $block_x_mcu_ofs_1 = $block_x_mcu_ofs_02;
    __label__ = 14;
    break;
   case 11:
    var $36 = $block_x_mcu_ofs_02 + 1 | 0;
    if (($36 | 0) == (HEAP32[$this + 156 + ($24 << 2) >> 2] | 0)) {
      __label__ = 12;
      break;
    } else {
      var $block_y_mcu_ofs_1 = $block_y_mcu_ofs_03;
      var $block_x_mcu_ofs_1 = $36;
      __label__ = 14;
      break;
    }
   case 12:
    var $41 = $block_y_mcu_ofs_03 + 1 | 0;
    if (($41 | 0) == (HEAP32[$this + 172 + ($24 << 2) >> 2] | 0)) {
      __label__ = 13;
      break;
    } else {
      var $block_y_mcu_ofs_1 = $41;
      var $block_x_mcu_ofs_1 = 0;
      __label__ = 14;
      break;
    }
   case 13:
    var $46 = $26 + $36 | 0;
    HEAP32[$25 >> 2] = $46;
    var $block_y_mcu_ofs_1 = 0;
    var $block_x_mcu_ofs_1 = 0;
    __label__ = 14;
    break;
   case 14:
    var $block_x_mcu_ofs_1;
    var $block_y_mcu_ofs_1;
    var $48 = $mcu_block_01 + 1 | 0;
    if (($48 | 0) < (HEAP32[$11 >> 2] | 0)) {
      var $mcu_block_01 = $48;
      var $block_x_mcu_ofs_02 = $block_x_mcu_ofs_1;
      var $block_y_mcu_ofs_03 = $block_y_mcu_ofs_1;
      __label__ = 9;
      break;
    } else {
      __label__ = 15;
      break;
    }
   case 15:
    var $52 = HEAP32[$10 >> 2] - 1 | 0;
    HEAP32[$10 >> 2] = $52;
    var $53 = HEAP32[$6 >> 2];
    if (($mcu_row_04 | 0) < ($53 | 0)) {
      __label__ = 16;
      break;
    } else {
      var $55 = $53;
      __label__ = 17;
      break;
    }
   case 16:
    var $mcu_row_04 = $mcu_row_04 + 1 | 0;
    __label__ = 5;
    break;
   case 17:
    var $55;
    var $56 = HEAP32[$7 >> 2];
    if (($56 | 0) == 1) {
      __label__ = 19;
      break;
    } else {
      __label__ = 18;
      break;
    }
   case 18:
    if (($56 | 0) > 0) {
      var $component_num_09 = 0;
      __label__ = 20;
      break;
    } else {
      __label__ = 21;
      break;
    }
   case 19:
    var $61 = $m_block_y_mcu + (HEAP32[$8 >> 2] << 2) | 0;
    var $63 = HEAP32[$61 >> 2] + 1 | 0;
    HEAP32[$61 >> 2] = $63;
    __label__ = 21;
    break;
   case 20:
    var $component_num_09;
    var $65 = HEAP32[$this + 256 + ($component_num_09 << 2) >> 2];
    var $68 = $m_block_y_mcu + ($65 << 2) | 0;
    var $70 = HEAP32[$68 >> 2] + HEAP32[$this + 172 + ($65 << 2) >> 2] | 0;
    HEAP32[$68 >> 2] = $70;
    var $71 = $component_num_09 + 1 | 0;
    if (($71 | 0) < ($56 | 0)) {
      var $component_num_09 = $71;
      __label__ = 20;
      break;
    } else {
      __label__ = 21;
      break;
    }
   case 21:
    var $73 = $mcu_col_011 + 1 | 0;
    if (($73 | 0) < (HEAP32[$2 >> 2] | 0)) {
      var $mcu_col_011 = $73;
      var $13 = $55;
      __label__ = 4;
      break;
    } else {
      __label__ = 22;
      break;
    }
   case 22:
    STACKTOP = __stackBase__;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder11decode_scanEPFvPS0_iiiE["X"] = 1;

function __ZN4jpgd12jpeg_decoder12decode_startEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    __ZN4jpgd12jpeg_decoder10init_frameEv($this);
    if ((HEAP32[$this + 56 >> 2] | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    __ZN4jpgd12jpeg_decoder16init_progressiveEv($this);
    __label__ = 5;
    break;
   case 4:
    __ZN4jpgd12jpeg_decoder15init_sequentialEv($this);
    __label__ = 5;
    break;
   case 5:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder11decode_initEPNS_19jpeg_decoder_streamE($this, $pStream) {
  __ZN4jpgd12jpeg_decoder4initEPNS_19jpeg_decoder_streamE($this, $pStream);
  __ZN4jpgd12jpeg_decoder17locate_sof_markerEv($this);
  return;
}

function __ZN4jpgd12jpeg_decoderC2EPNS_19jpeg_decoder_streamE($this, $pStream) {
  var __label__;
  __label__ = 2;
  var setjmpTable = {
    "2": (function(value) {
      __label__ = 5;
      $2 = value;
    }),
    dummy: 0
  };
  while (1) try {
    switch (__label__) {
     case 2:
      var $2 = (HEAP32[$this >> 2] = __label__, 0);
      __label__ = 5;
      break;
     case 5:
      if (($2 | 0) == 0) {
        __label__ = 3;
        break;
      } else {
        __label__ = 4;
        break;
      }
     case 3:
      __ZN4jpgd12jpeg_decoder11decode_initEPNS_19jpeg_decoder_streamE($this, $pStream);
      __label__ = 4;
      break;
     case 4:
      return;
     default:
      assert(0, "bad label: " + __label__);
    }
  } catch (e) {
    if (!e.longjmp) throw e;
    setjmpTable[e.label](e.value);
  }
}

function __ZN4jpgd12jpeg_decoder14begin_decodingEv($this) {
  var __label__;
  __label__ = 2;
  var setjmpTable = {
    "4": (function(value) {
      __label__ = 7;
      $11 = value;
    }),
    dummy: 0
  };
  while (1) try {
    switch (__label__) {
     case 2:
      var $1 = $this + 13300 | 0;
      if ((HEAP8[$1] & 1) << 24 >> 24 == 0) {
        __label__ = 3;
        break;
      } else {
        var $_0 = 0;
        __label__ = 6;
        break;
      }
     case 3:
      if ((HEAP32[$this + 13296 >> 2] | 0) == 0) {
        __label__ = 4;
        break;
      } else {
        var $_0 = -1;
        __label__ = 6;
        break;
      }
     case 4:
      var $11 = (HEAP32[$this >> 2] = __label__, 0);
      __label__ = 7;
      break;
     case 7:
      if (($11 | 0) == 0) {
        __label__ = 5;
        break;
      } else {
        __label__ = 6;
        break;
      }
     case 5:
      __ZN4jpgd12jpeg_decoder12decode_startEv($this);
      HEAP8[$1] = 1;
      var $_0 = 0;
      __label__ = 6;
      break;
     case 6:
      var $_0;
      return $_0;
     default:
      assert(0, "bad label: " + __label__);
    }
  } catch (e) {
    if (!e.longjmp) throw e;
    setjmpTable[e.label](e.value);
  }
}

function __ZN4jpgd12jpeg_decoderD2Ev($this) {
  __ZN4jpgd12jpeg_decoder15free_all_blocksEv($this);
  return;
}

function __ZN4jpgd24jpeg_decoder_file_streamC2Ev($this) {
  var $1 = $this | 0;
  __ZN4jpgd19jpeg_decoder_streamC2Ev($1);
  HEAP32[$this >> 2] = __ZTVN4jpgd24jpeg_decoder_file_streamE + 8 | 0;
  HEAP32[$this + 4 >> 2] = 0;
  HEAP8[$this + 8 | 0] = 0;
  HEAP8[$this + 9 | 0] = 0;
  return;
}

function __ZN4jpgd24jpeg_decoder_file_stream5closeEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this + 4 | 0;
    var $2 = HEAP32[$1 >> 2];
    if (($2 | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $5 = _fclose($2);
    HEAP32[$1 >> 2] = 0;
    __label__ = 4;
    break;
   case 4:
    HEAP8[$this + 8 | 0] = 0;
    HEAP8[$this + 9 | 0] = 0;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd24jpeg_decoder_file_streamD0Ev($this) {
  __ZN4jpgd24jpeg_decoder_file_streamD2Ev($this);
  var $1 = $this;
  __ZdlPv($1);
  return;
}

function __ZN4jpgd24jpeg_decoder_file_streamD2Ev($this) {
  HEAP32[$this >> 2] = __ZTVN4jpgd24jpeg_decoder_file_streamE + 8 | 0;
  __ZN4jpgd24jpeg_decoder_file_stream5closeEv($this);
  return;
}

function __ZN4jpgd24jpeg_decoder_file_stream4openEPKc($this) {
  __ZN4jpgd24jpeg_decoder_file_stream5closeEv($this);
  HEAP8[$this + 8 | 0] = 0;
  HEAP8[$this + 9 | 0] = 0;
  var $3 = _fopen(STRING_TABLE.__str5 | 0, STRING_TABLE.__str13127 | 0);
  HEAP32[$this + 4 >> 2] = $3;
  return ($3 | 0) != 0;
}

function __ZN4jpgd24jpeg_decoder_file_stream4readEPhiPb($this, $pBuf, $max_bytes_to_read, $pEOF_flag) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this + 4 | 0;
    var $2 = HEAP32[$1 >> 2];
    if (($2 | 0) == 0) {
      var $_0 = -1;
      __label__ = 10;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $5 = $this + 8 | 0;
    if ((HEAP8[$5] & 1) << 24 >> 24 == 0) {
      __label__ = 5;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    HEAP8[$pEOF_flag] = 1;
    var $_0 = 0;
    __label__ = 10;
    break;
   case 5:
    var $11 = $this + 9 | 0;
    if ((HEAP8[$11] & 1) << 24 >> 24 == 0) {
      __label__ = 6;
      break;
    } else {
      var $_0 = -1;
      __label__ = 10;
      break;
    }
   case 6:
    var $16 = _fread($pBuf, 1, $max_bytes_to_read, $2);
    if (($16 | 0) < ($max_bytes_to_read | 0)) {
      __label__ = 7;
      break;
    } else {
      var $_0 = $16;
      __label__ = 10;
      break;
    }
   case 7:
    var $19 = HEAP32[$1 >> 2];
    var $20 = _ferror($19);
    if (($20 | 0) == 0) {
      __label__ = 9;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 8:
    HEAP8[$11] = 1;
    var $_0 = -1;
    __label__ = 10;
    break;
   case 9:
    HEAP8[$5] = 1;
    HEAP8[$pEOF_flag] = 1;
    var $_0 = $16;
    __label__ = 10;
    break;
   case 10:
    var $_0;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd33decompress_jpeg_image_from_streamEPNS_19jpeg_decoder_streamEPiS2_S2_i($pStream, $width, $height, $actual_comps) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 13316;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $decoder = __stackBase__;
    var $pScan_line = __stackBase__ + 13308;
    var $scan_line_len = __stackBase__ + 13312;
    if (($actual_comps | 0) == 0) {
      var $_1 = 0;
      __label__ = 20;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    HEAP32[$actual_comps >> 2] = 0;
    if (($pStream | 0) == 0 | ($width | 0) == 0 | ($height | 0) == 0) {
      var $_1 = 0;
      __label__ = 20;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    __ZN4jpgd12jpeg_decoderC2EPNS_19jpeg_decoder_streamE($decoder, $pStream);
    var $decoder_idx_val = HEAP32[$decoder + 13296 >> 2];
    var $7 = __ZNK4jpgd12jpeg_decoder14get_error_codeEv($decoder_idx_val);
    if (($7 | 0) == 0) {
      __label__ = 5;
      break;
    } else {
      var $_0 = 0;
      __label__ = 19;
      break;
    }
   case 5:
    var $decoder_idx1_val = HEAP32[$decoder + 44 >> 2];
    var $10 = __ZNK4jpgd12jpeg_decoder9get_widthEv($decoder_idx1_val);
    var $decoder_idx2_val = HEAP32[$decoder + 48 >> 2];
    var $11 = __ZNK4jpgd12jpeg_decoder10get_heightEv($decoder_idx2_val);
    HEAP32[$width >> 2] = $10;
    HEAP32[$height >> 2] = $11;
    var $decoder_idx4 = $decoder + 152 | 0;
    var $decoder_idx4_val = HEAP32[$decoder_idx4 >> 2];
    var $12 = __ZNK4jpgd12jpeg_decoder18get_num_componentsEv($decoder_idx4_val);
    HEAP32[$actual_comps >> 2] = $12;
    var $13 = __ZN4jpgd12jpeg_decoder14begin_decodingEv($decoder);
    __label__ = 6;
    break;
   case 6:
    if (($13 | 0) == 0) {
      __label__ = 7;
      break;
    } else {
      var $_0 = 0;
      __label__ = 19;
      break;
    }
   case 7:
    var $17 = $10 * 3 | 0;
    var $18 = $17 * $11 | 0;
    var $19 = __ZN4jpgdL11jpgd_mallocEj($18);
    if (($19 | 0) == 0) {
      var $_0 = 0;
      __label__ = 19;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 8:
    var $21 = ($10 | 0) > 0;
    var $y_0 = 0;
    __label__ = 9;
    break;
   case 9:
    var $y_0;
    if (($y_0 | 0) < ($11 | 0)) {
      __label__ = 10;
      break;
    } else {
      var $_0 = $19;
      __label__ = 19;
      break;
    }
   case 10:
    var $25 = __ZN4jpgd12jpeg_decoder6decodeEPPKvPj($decoder, $pScan_line, $scan_line_len);
    __label__ = 11;
    break;
   case 11:
    if (($25 | 0) == 0) {
      __label__ = 13;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 12:
    __ZN4jpgdL9jpgd_freeEPv($19);
    var $_0 = 0;
    __label__ = 19;
    break;
   case 13:
    var $30 = $19 + $y_0 * $17 | 0;
    var $decoder_idx3_val = HEAP32[$decoder_idx4 >> 2];
    var $31 = __ZNK4jpgd12jpeg_decoder18get_num_componentsEv($decoder_idx3_val);
    if (($31 | 0) == 1) {
      __label__ = 14;
      break;
    } else if (($31 | 0) == 3) {
      __label__ = 16;
      break;
    } else {
      __label__ = 18;
      break;
    }
   case 14:
    if ($21) {
      var $pDst_016 = $30;
      var $x_017 = 0;
      __label__ = 15;
      break;
    } else {
      __label__ = 18;
      break;
    }
   case 15:
    var $x_017;
    var $pDst_016;
    var $34 = HEAP8[HEAP32[$pScan_line >> 2] + $x_017 | 0];
    HEAP8[$pDst_016] = $34;
    HEAP8[$pDst_016 + 1 | 0] = $34;
    HEAP8[$pDst_016 + 2 | 0] = $34;
    var $38 = $x_017 + 1 | 0;
    if (($38 | 0) == ($10 | 0)) {
      __label__ = 18;
      break;
    } else {
      var $pDst_016 = $pDst_016 + 3 | 0;
      var $x_017 = $38;
      __label__ = 15;
      break;
    }
   case 16:
    if ($21) {
      var $pDst_37 = $30;
      var $x4_08 = 0;
      __label__ = 17;
      break;
    } else {
      __label__ = 18;
      break;
    }
   case 17:
    var $x4_08;
    var $pDst_37;
    var $39 = $x4_08 << 2;
    var $42 = HEAP8[HEAP32[$pScan_line >> 2] + $39 | 0];
    HEAP8[$pDst_37] = $42;
    var $46 = HEAP8[HEAP32[$pScan_line >> 2] + ($39 | 1) | 0];
    HEAP8[$pDst_37 + 1 | 0] = $46;
    var $51 = HEAP8[HEAP32[$pScan_line >> 2] + ($39 | 2) | 0];
    HEAP8[$pDst_37 + 2 | 0] = $51;
    var $54 = $x4_08 + 1 | 0;
    if (($54 | 0) == ($10 | 0)) {
      __label__ = 18;
      break;
    } else {
      var $pDst_37 = $pDst_37 + 3 | 0;
      var $x4_08 = $54;
      __label__ = 17;
      break;
    }
   case 18:
    var $y_0 = $y_0 + 1 | 0;
    __label__ = 9;
    break;
   case 19:
    var $_0;
    __ZN4jpgd12jpeg_decoderD2Ev($decoder);
    var $_1 = $_0;
    __label__ = 20;
    break;
   case 20:
    var $_1;
    STACKTOP = __stackBase__;
    return $_1;
   case 21:
    var $lpad_loopexit = ___cxa_find_matching_catch(HEAP32[_llvm_eh_exception.buf >> 2], HEAP32[_llvm_eh_exception.buf + 4 >> 2], []);
    var $lpad_phi = $lpad_loopexit;
    __label__ = 23;
    break;
   case 22:
    var $lpad_nonloopexit = ___cxa_find_matching_catch(HEAP32[_llvm_eh_exception.buf >> 2], HEAP32[_llvm_eh_exception.buf + 4 >> 2], []);
    var $lpad_phi = $lpad_nonloopexit;
    __label__ = 23;
    break;
   case 23:
    var $lpad_phi;
    __ZN4jpgd12jpeg_decoderD2Ev($decoder);
    Module.print("Resuming exception");
    throw HEAP32[_llvm_eh_exception.buf >> 2];
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd33decompress_jpeg_image_from_streamEPNS_19jpeg_decoder_streamEPiS2_S2_i["X"] = 1;

function __ZN4jpgd12jpeg_decoder21decode_block_ac_firstEPS0_iii($pD, $component_id, $block_x, $block_y) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $pD + 468 | 0;
    var $2 = HEAP32[$1 >> 2];
    if (($2 | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $5 = $2 - 1 | 0;
    HEAP32[$1 >> 2] = $5;
    __label__ = 19;
    break;
   case 4:
    var $8 = HEAP32[$pD + 452 + ($component_id << 2) >> 2];
    var $9 = __ZN4jpgd12jpeg_decoder14coeff_buf_getpEPNS0_9coeff_bufEii($8, $block_x, $block_y);
    var $12 = $pD + 308 | 0;
    var $13 = $pD + 288 + ($component_id << 2) | 0;
    var $14 = $pD + 312 | 0;
    var $k_0 = HEAP32[$pD + 304 >> 2];
    __label__ = 5;
    break;
   case 5:
    var $k_0;
    if (($k_0 | 0) > (HEAP32[$12 >> 2] | 0)) {
      __label__ = 19;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    var $21 = HEAP32[$pD + 404 + (HEAP32[$13 >> 2] << 2) >> 2];
    var $22 = __ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesE($pD, $21);
    var $23 = $22 >> 4;
    var $24 = $22 & 15;
    if (($24 | 0) == 0) {
      __label__ = 12;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 7:
    var $27 = $23 + $k_0 | 0;
    if (($27 | 0) > 63) {
      __label__ = 8;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 8:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($pD, -230);
    throw "Reached an unreachable!";
   case 9:
    var $31 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($pD, $24);
    if (($31 | 0) < (HEAP32[__ZN4jpgdL13s_extend_testE + ($24 << 2) >> 2] | 0)) {
      __label__ = 10;
      break;
    } else {
      var $40 = $31;
      __label__ = 11;
      break;
    }
   case 10:
    var $40 = HEAP32[__ZN4jpgdL15s_extend_offsetE + ($24 << 2) >> 2] + $31 | 0;
    __label__ = 11;
    break;
   case 11:
    var $40;
    HEAP16[$9 + (HEAP32[__ZN4jpgdL5g_ZAGE + ($27 << 2) >> 2] << 1) >> 1] = $40 << HEAP32[$14 >> 2] & 65535;
    var $k_1 = $27;
    __label__ = 18;
    break;
   case 12:
    if (($23 | 0) == 15) {
      __label__ = 13;
      break;
    } else {
      __label__ = 15;
      break;
    }
   case 13:
    var $50 = $k_0 + 15 | 0;
    if (($50 | 0) > 63) {
      __label__ = 14;
      break;
    } else {
      var $k_1 = $50;
      __label__ = 18;
      break;
    }
   case 14:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($pD, -230);
    throw "Reached an unreachable!";
   case 15:
    var $54 = 1 << $23;
    HEAP32[$1 >> 2] = $54;
    if (($23 | 0) == 0) {
      var $61 = $54;
      __label__ = 17;
      break;
    } else {
      __label__ = 16;
      break;
    }
   case 16:
    var $57 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($pD, $23);
    var $59 = HEAP32[$1 >> 2] + $57 | 0;
    HEAP32[$1 >> 2] = $59;
    var $61 = $59;
    __label__ = 17;
    break;
   case 17:
    var $61;
    HEAP32[$1 >> 2] = $61 - 1 | 0;
    __label__ = 19;
    break;
   case 18:
    var $k_1;
    var $k_0 = $k_1 + 1 | 0;
    __label__ = 5;
    break;
   case 19:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder21decode_block_ac_firstEPS0_iii["X"] = 1;

function __ZN4jpgd12jpeg_decoder22decode_block_ac_refineEPS0_iii($pD, $component_id, $block_x, $block_y) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = HEAP32[$pD + 312 >> 2];
    var $3 = 1 << $2;
    var $4 = -1 << $2;
    var $6 = HEAP32[$pD + 452 + ($component_id << 2) >> 2];
    var $7 = __ZN4jpgd12jpeg_decoder14coeff_buf_getpEPNS0_9coeff_bufEii($6, $block_x, $block_y);
    var $8 = $pD + 308 | 0;
    if ((HEAP32[$8 >> 2] | 0) < 64) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    ___assert_func(STRING_TABLE.__str114 | 0, 2683, STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder22decode_block_ac_refineEPS0_iii | 0, STRING_TABLE.__str12126 | 0);
    __label__ = 4;
    break;
   case 4:
    var $14 = HEAP32[$pD + 304 >> 2];
    var $15 = $pD + 468 | 0;
    var $16 = HEAP32[$15 >> 2];
    if (($16 | 0) == 0) {
      __label__ = 5;
      break;
    } else {
      var $k_3 = $14;
      var $82 = $16;
      __label__ = 26;
      break;
    }
   case 5:
    var $18 = $pD + 288 + ($component_id << 2) | 0;
    var $k_0 = $14;
    __label__ = 6;
    break;
   case 6:
    var $k_0;
    if (($k_0 | 0) > (HEAP32[$8 >> 2] | 0)) {
      __label__ = 25;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 7:
    var $25 = HEAP32[$pD + 404 + (HEAP32[$18 >> 2] << 2) >> 2];
    var $26 = __ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesE($pD, $25);
    var $27 = $26 >> 4;
    var $28 = $26 & 15;
    if (($28 | 0) == 1) {
      __label__ = 9;
      break;
    } else if (($28 | 0) == 0) {
      __label__ = 11;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 8:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($pD, -230);
    throw "Reached an unreachable!";
   case 9:
    var $31 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($pD, 1);
    var $_ = ($31 | 0) == 0 ? $4 : $3;
    var $r_0_ph = $27;
    var $s_0_ph = $_;
    __label__ = 10;
    break;
   case 10:
    var $s_0_ph;
    var $r_0_ph;
    var $r_0 = $r_0_ph;
    var $k_1 = $k_0;
    __label__ = 14;
    break;
   case 11:
    if (($27 | 0) == 15) {
      var $r_0_ph = 15;
      var $s_0_ph = 0;
      __label__ = 10;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 12:
    var $36 = 1 << $27;
    HEAP32[$15 >> 2] = $36;
    if (($27 | 0) == 0) {
      var $k_3 = $k_0;
      var $82 = $36;
      __label__ = 26;
      break;
    } else {
      __label__ = 13;
      break;
    }
   case 13:
    var $39 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($pD, $27);
    var $41 = HEAP32[$15 >> 2] + $39 | 0;
    HEAP32[$15 >> 2] = $41;
    var $k_3 = $k_0;
    var $82 = $41;
    __label__ = 26;
    break;
   case 14:
    var $k_1;
    var $r_0;
    var $46 = $7 + (HEAP32[__ZN4jpgdL5g_ZAGE + (($k_1 & 63) << 2) >> 2] << 1) | 0;
    if (HEAP16[$46 >> 1] << 16 >> 16 == 0) {
      __label__ = 20;
      break;
    } else {
      __label__ = 15;
      break;
    }
   case 15:
    var $50 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($pD, 1);
    if (($50 | 0) == 0) {
      var $r_1 = $r_0;
      __label__ = 21;
      break;
    } else {
      __label__ = 16;
      break;
    }
   case 16:
    var $53 = HEAP16[$46 >> 1];
    var $54 = $53 << 16 >> 16;
    if (($54 & $3 | 0) == 0) {
      __label__ = 17;
      break;
    } else {
      var $r_1 = $r_0;
      __label__ = 21;
      break;
    }
   case 17:
    if ($53 << 16 >> 16 > -1) {
      __label__ = 18;
      break;
    } else {
      __label__ = 19;
      break;
    }
   case 18:
    var $61 = $54 + $3 & 65535;
    HEAP16[$46 >> 1] = $61;
    var $r_1 = $r_0;
    __label__ = 21;
    break;
   case 19:
    var $64 = $54 + $4 & 65535;
    HEAP16[$46 >> 1] = $64;
    var $r_1 = $r_0;
    __label__ = 21;
    break;
   case 20:
    var $66 = $r_0 - 1 | 0;
    if (($66 | 0) < 0) {
      var $k_2 = $k_1;
      __label__ = 22;
      break;
    } else {
      var $r_1 = $66;
      __label__ = 21;
      break;
    }
   case 21:
    var $r_1;
    var $68 = $k_1 + 1 | 0;
    if (($68 | 0) > (HEAP32[$8 >> 2] | 0)) {
      var $k_2 = $68;
      __label__ = 22;
      break;
    } else {
      var $r_0 = $r_1;
      var $k_1 = $68;
      __label__ = 14;
      break;
    }
   case 22:
    var $k_2;
    if (($s_0_ph | 0) != 0 & ($k_2 | 0) < 64) {
      __label__ = 23;
      break;
    } else {
      __label__ = 24;
      break;
    }
   case 23:
    HEAP16[$7 + (HEAP32[__ZN4jpgdL5g_ZAGE + ($k_2 << 2) >> 2] << 1) >> 1] = $s_0_ph & 65535;
    __label__ = 24;
    break;
   case 24:
    var $k_0 = $k_2 + 1 | 0;
    __label__ = 6;
    break;
   case 25:
    var $k_3 = $k_0;
    var $82 = HEAP32[$15 >> 2];
    __label__ = 26;
    break;
   case 26:
    var $82;
    var $k_3;
    if (($82 | 0) > 0) {
      __label__ = 27;
      break;
    } else {
      __label__ = 37;
      break;
    }
   case 27:
    if (($k_3 | 0) > (HEAP32[$8 >> 2] | 0)) {
      var $111 = $82;
      __label__ = 36;
      break;
    } else {
      var $k_41 = $k_3;
      __label__ = 28;
      break;
    }
   case 28:
    var $k_41;
    var $89 = $7 + (HEAP32[__ZN4jpgdL5g_ZAGE + (($k_41 & 63) << 2) >> 2] << 1) | 0;
    if (HEAP16[$89 >> 1] << 16 >> 16 == 0) {
      __label__ = 34;
      break;
    } else {
      __label__ = 29;
      break;
    }
   case 29:
    var $93 = __ZN4jpgd12jpeg_decoder19get_bits_no_markersEi($pD, 1);
    if (($93 | 0) == 0) {
      __label__ = 34;
      break;
    } else {
      __label__ = 30;
      break;
    }
   case 30:
    var $96 = HEAP16[$89 >> 1];
    var $97 = $96 << 16 >> 16;
    if (($97 & $3 | 0) == 0) {
      __label__ = 31;
      break;
    } else {
      __label__ = 34;
      break;
    }
   case 31:
    if ($96 << 16 >> 16 > -1) {
      __label__ = 32;
      break;
    } else {
      __label__ = 33;
      break;
    }
   case 32:
    var $104 = $97 + $3 & 65535;
    HEAP16[$89 >> 1] = $104;
    __label__ = 34;
    break;
   case 33:
    var $107 = $97 + $4 & 65535;
    HEAP16[$89 >> 1] = $107;
    __label__ = 34;
    break;
   case 34:
    var $108 = $k_41 + 1 | 0;
    if (($108 | 0) > (HEAP32[$8 >> 2] | 0)) {
      __label__ = 35;
      break;
    } else {
      var $k_41 = $108;
      __label__ = 28;
      break;
    }
   case 35:
    var $111 = HEAP32[$15 >> 2];
    __label__ = 36;
    break;
   case 36:
    var $111;
    HEAP32[$15 >> 2] = $111 - 1 | 0;
    __label__ = 37;
    break;
   case 37:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder22decode_block_ac_refineEPS0_iii["X"] = 1;

function __ZN4jpgd12jpeg_decoder16init_progressiveEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this + 152 | 0;
    var $2 = HEAP32[$1 >> 2];
    if (($2 | 0) == 4) {
      __label__ = 5;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    if (($2 | 0) > 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 4:
    var $5 = $this + 9100 | 0;
    var $6 = $this + 9124 | 0;
    var $i_03 = 0;
    __label__ = 7;
    break;
   case 5:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -232);
    throw "Reached an unreachable!";
   case 6:
    var $8 = $this + 304 | 0;
    var $9 = $this + 316 | 0;
    var $10 = $this + 308 | 0;
    var $11 = $this + 312 | 0;
    var $12 = $this + 9080 | 0;
    var $13 = $this + 252 | 0;
    __label__ = 8;
    break;
   case 7:
    var $i_03;
    var $16 = $this + 156 + ($i_03 << 2) | 0;
    var $18 = HEAP32[$16 >> 2] * HEAP32[$5 >> 2] | 0;
    var $20 = $this + 172 + ($i_03 << 2) | 0;
    var $22 = HEAP32[$20 >> 2] * HEAP32[$6 >> 2] | 0;
    var $23 = __ZN4jpgd12jpeg_decoder14coeff_buf_openEiiii($this, $18, $22, 1, 1);
    HEAP32[$this + 436 + ($i_03 << 2) >> 2] = $23;
    var $27 = HEAP32[$16 >> 2] * HEAP32[$5 >> 2] | 0;
    var $30 = HEAP32[$20 >> 2] * HEAP32[$6 >> 2] | 0;
    var $31 = __ZN4jpgd12jpeg_decoder14coeff_buf_openEiiii($this, $27, $30, 8, 8);
    HEAP32[$this + 452 + ($i_03 << 2) >> 2] = $31;
    var $33 = $i_03 + 1 | 0;
    if (($33 | 0) < (HEAP32[$1 >> 2] | 0)) {
      var $i_03 = $33;
      __label__ = 7;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 8:
    var $37 = __ZN4jpgd12jpeg_decoder9init_scanEv($this);
    if (($37 | 0) == 0) {
      __label__ = 23;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 9:
    var $40 = HEAP32[$8 >> 2];
    var $41 = ($40 | 0) == 0;
    var $42 = HEAP32[$9 >> 2];
    var $43 = ($42 | 0) != 0;
    var $44 = HEAP32[$10 >> 2];
    if (($40 | 0) > ($44 | 0) | ($44 | 0) > 63) {
      __label__ = 10;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 10:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -227);
    throw "Reached an unreachable!";
   case 11:
    if ($41) {
      __label__ = 12;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 12:
    if (($44 | 0) == 0) {
      __label__ = 16;
      break;
    } else {
      __label__ = 13;
      break;
    }
   case 13:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -227);
    throw "Reached an unreachable!";
   case 14:
    if ((HEAP32[$13 >> 2] | 0) == 1) {
      __label__ = 16;
      break;
    } else {
      __label__ = 15;
      break;
    }
   case 15:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -227);
    throw "Reached an unreachable!";
   case 16:
    if ($43) {
      __label__ = 17;
      break;
    } else {
      __label__ = 19;
      break;
    }
   case 17:
    if ((HEAP32[$11 >> 2] | 0) == ($42 - 1 | 0)) {
      __label__ = 19;
      break;
    } else {
      __label__ = 18;
      break;
    }
   case 18:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -226);
    throw "Reached an unreachable!";
   case 19:
    if ($41) {
      __label__ = 20;
      break;
    } else {
      __label__ = 21;
      break;
    }
   case 20:
    var $_ZN4jpgd12jpeg_decoder22decode_block_dc_refineEPS0_iii__ZN4jpgd12jpeg_decoder21decode_block_dc_firstEPS0_iii = $43 ? 2 : 4;
    var $decode_block_func_0 = $_ZN4jpgd12jpeg_decoder22decode_block_dc_refineEPS0_iii__ZN4jpgd12jpeg_decoder21decode_block_dc_firstEPS0_iii;
    __label__ = 22;
    break;
   case 21:
    var $_ZN4jpgd12jpeg_decoder22decode_block_ac_refineEPS0_iii__ZN4jpgd12jpeg_decoder21decode_block_ac_firstEPS0_iii = $43 ? 6 : 8;
    var $decode_block_func_0 = $_ZN4jpgd12jpeg_decoder22decode_block_ac_refineEPS0_iii__ZN4jpgd12jpeg_decoder21decode_block_ac_firstEPS0_iii;
    __label__ = 22;
    break;
   case 22:
    var $decode_block_func_0;
    __ZN4jpgd12jpeg_decoder11decode_scanEPFvPS0_iiiE($this, $decode_block_func_0);
    HEAP32[$12 >> 2] = 16;
    var $66 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    var $67 = __ZN4jpgd12jpeg_decoder8get_bitsEi($this, 16);
    __label__ = 8;
    break;
   case 23:
    var $69 = HEAP32[$1 >> 2];
    HEAP32[$13 >> 2] = $69;
    if (($69 | 0) > 0) {
      var $i_11 = 0;
      __label__ = 24;
      break;
    } else {
      __label__ = 25;
      break;
    }
   case 24:
    var $i_11;
    HEAP32[$this + 256 + ($i_11 << 2) >> 2] = $i_11;
    var $72 = $i_11 + 1 | 0;
    if (($72 | 0) < (HEAP32[$1 >> 2] | 0)) {
      var $i_11 = $72;
      __label__ = 24;
      break;
    } else {
      __label__ = 25;
      break;
    }
   case 25:
    __ZN4jpgd12jpeg_decoder20calc_mcu_block_orderEv($this);
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZN4jpgd12jpeg_decoder16init_progressiveEv["X"] = 1;

function __ZN4jpgd12jpeg_decoder15init_sequentialEv($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = __ZN4jpgd12jpeg_decoder9init_scanEv($this);
    if (($1 | 0) == 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    __ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE($this, -240);
    throw "Reached an unreachable!";
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd19jpeg_decoder_streamD1Ev($this) {
  return;
}

function __ZN4jpgd12DCT_Upsample8Matrix442atEii($this, $r, $c) {
  return $this + ($r << 4) + ($c << 2) | 0;
}

function __ZNK4jpgd12DCT_Upsample8Matrix442atEii($this, $r, $c) {
  return $this + ($r << 4) + ($c << 2) | 0;
}

function __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($info, $adjustedPtr, $path_below) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $info + 16 | 0;
    var $2 = HEAP32[$1 >> 2];
    if (($2 | 0) == 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    HEAP32[$1 >> 2] = $adjustedPtr;
    HEAP32[$info + 24 >> 2] = $path_below;
    HEAP32[$info + 36 >> 2] = 1;
    __label__ = 8;
    break;
   case 4:
    if (($2 | 0) == ($adjustedPtr | 0)) {
      __label__ = 5;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 5:
    var $10 = $info + 24 | 0;
    if ((HEAP32[$10 >> 2] | 0) == 2) {
      __label__ = 6;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 6:
    HEAP32[$10 >> 2] = $path_below;
    __label__ = 8;
    break;
   case 7:
    var $15 = $info + 36 | 0;
    var $17 = HEAP32[$15 >> 2] + 1 | 0;
    HEAP32[$15 >> 2] = $17;
    HEAP32[$info + 24 >> 2] = 2;
    HEAP8[$info + 54 | 0] = 1;
    __label__ = 8;
    break;
   case 8:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($info, $dst_ptr, $current_ptr, $path_below) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    HEAP8[$info + 53 | 0] = 1;
    if ((HEAP32[$info + 4 >> 2] | 0) == ($current_ptr | 0)) {
      __label__ = 3;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 3:
    HEAP8[$info + 52 | 0] = 1;
    var $7 = $info + 16 | 0;
    var $8 = HEAP32[$7 >> 2];
    if (($8 | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 4:
    HEAP32[$7 >> 2] = $dst_ptr;
    HEAP32[$info + 24 >> 2] = $path_below;
    HEAP32[$info + 36 >> 2] = 1;
    if ((HEAP32[$info + 48 >> 2] | 0) == 1 & ($path_below | 0) == 1) {
      __label__ = 5;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 5:
    HEAP8[$info + 54 | 0] = 1;
    __label__ = 12;
    break;
   case 6:
    if (($8 | 0) == ($dst_ptr | 0)) {
      __label__ = 7;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 7:
    var $22 = $info + 24 | 0;
    var $23 = HEAP32[$22 >> 2];
    if (($23 | 0) == 2) {
      __label__ = 8;
      break;
    } else {
      var $27 = $23;
      __label__ = 9;
      break;
    }
   case 8:
    HEAP32[$22 >> 2] = $path_below;
    var $27 = $path_below;
    __label__ = 9;
    break;
   case 9:
    var $27;
    if ((HEAP32[$info + 48 >> 2] | 0) == 1 & ($27 | 0) == 1) {
      __label__ = 10;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 10:
    HEAP8[$info + 54 | 0] = 1;
    __label__ = 12;
    break;
   case 11:
    var $35 = $info + 36 | 0;
    var $37 = HEAP32[$35 >> 2] + 1 | 0;
    HEAP32[$35 >> 2] = $37;
    HEAP8[$info + 54 | 0] = 1;
    __label__ = 12;
    break;
   case 12:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i["X"] = 1;

function __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi($info, $current_ptr, $path_below) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if ((HEAP32[$info + 4 >> 2] | 0) == ($current_ptr | 0)) {
      __label__ = 3;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 3:
    var $5 = $info + 28 | 0;
    if ((HEAP32[$5 >> 2] | 0) == 1) {
      __label__ = 5;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    HEAP32[$5 >> 2] = $path_below;
    __label__ = 5;
    break;
   case 5:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd31decompress_jpeg_image_from_fileEPKcPiS2_S2_i($width, $height, $actual_comps) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 12;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $file_stream = __stackBase__;
    __ZN4jpgd24jpeg_decoder_file_streamC2Ev($file_stream);
    var $1 = __ZN4jpgd24jpeg_decoder_file_stream4openEPKc($file_stream);
    if ($1) {
      __label__ = 3;
      break;
    } else {
      var $_0 = 0;
      __label__ = 4;
      break;
    }
   case 3:
    var $3 = $file_stream | 0;
    var $4 = __ZN4jpgd33decompress_jpeg_image_from_streamEPNS_19jpeg_decoder_streamEPiS2_S2_i($3, $width, $height, $actual_comps);
    var $_0 = $4;
    __label__ = 4;
    break;
   case 4:
    var $_0;
    __ZN4jpgd24jpeg_decoder_file_streamD2Ev($file_stream);
    STACKTOP = __stackBase__;
    return $_0;
   case 5:
    var $7 = ___cxa_find_matching_catch(HEAP32[_llvm_eh_exception.buf >> 2], HEAP32[_llvm_eh_exception.buf + 4 >> 2], []);
    __ZN4jpgd24jpeg_decoder_file_streamD2Ev($file_stream);
    Module.print("Resuming exception");
    throw HEAP32[_llvm_eh_exception.buf >> 2];
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd19jpeg_decoder_streamD0Ev($this) {
  var $1 = $this;
  __ZdlPv($1);
  return;
}

function __ZN4jpgd12jpeg_decoder9get_octetEv($this) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 4;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $padding_flag = __stackBase__;
    var $1 = __ZN4jpgd12jpeg_decoder8get_charEPb($this, $padding_flag);
    if (($1 | 0) == 255) {
      __label__ = 3;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 3:
    if ((HEAP8[$padding_flag] & 1) << 24 >> 24 == 0) {
      __label__ = 4;
      break;
    } else {
      var $_0 = -1;
      __label__ = 9;
      break;
    }
   case 4:
    var $8 = __ZN4jpgd12jpeg_decoder8get_charEPb($this, $padding_flag);
    if ((HEAP8[$padding_flag] & 1) << 24 >> 24 == 0) {
      __label__ = 6;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    __ZN4jpgd12jpeg_decoder10stuff_charEh($this, -1);
    var $_0 = -1;
    __label__ = 9;
    break;
   case 6:
    if (($8 | 0) == 0) {
      var $_0 = -1;
      __label__ = 9;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 7:
    var $16 = $8 & 255;
    __ZN4jpgd12jpeg_decoder10stuff_charEh($this, $16);
    __ZN4jpgd12jpeg_decoder10stuff_charEh($this, -1);
    var $_0 = -1;
    __label__ = 9;
    break;
   case 8:
    var $_0 = $1 & 255;
    __label__ = 9;
    break;
   case 9:
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN4jpgd12jpeg_decoder8get_charEPb($this, $pPadding_flag) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this + 492 | 0;
    if ((HEAP32[$1 >> 2] | 0) == 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 3:
    __ZN4jpgd12jpeg_decoder14prep_in_bufferEv($this);
    if ((HEAP32[$1 >> 2] | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 4:
    HEAP8[$pPadding_flag] = 1;
    var $8 = $this + 496 | 0;
    var $9 = HEAP32[$8 >> 2];
    var $10 = $9 ^ 1;
    HEAP32[$8 >> 2] = $10;
    var $_ = ($9 | 0) == 0 ? 255 : 217;
    var $_0 = $_;
    __label__ = 6;
    break;
   case 5:
    HEAP8[$pPadding_flag] = 0;
    var $13 = $this + 488 | 0;
    var $14 = HEAP32[$13 >> 2];
    var $15 = $14 + 1 | 0;
    HEAP32[$13 >> 2] = $15;
    var $17 = HEAPU8[$14] & 255;
    var $19 = HEAP32[$1 >> 2] - 1 | 0;
    HEAP32[$1 >> 2] = $19;
    var $_0 = $17;
    __label__ = 6;
    break;
   case 6:
    var $_0;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN10__cxxabiv116__shim_type_infoD2Ev($this) {
  var $1 = $this | 0;
  __ZNSt9type_infoD2Ev($1);
  return;
}

function __ZN10__cxxabiv117__class_type_infoD0Ev($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this | 0;
    __ZN10__cxxabiv116__shim_type_infoD2Ev($1);
    __label__ = 3;
    break;
   case 3:
    var $3 = $this;
    __ZdlPv($3);
    return;
   case 4:
    var $5 = ___cxa_find_matching_catch(HEAP32[_llvm_eh_exception.buf >> 2], HEAP32[_llvm_eh_exception.buf + 4 >> 2], []);
    var $6 = $this;
    __ZdlPv($6);
    Module.print("Resuming exception");
    throw HEAP32[_llvm_eh_exception.buf >> 2];
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZN10__cxxabiv120__si_class_type_infoD0Ev($this) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this | 0;
    __ZN10__cxxabiv116__shim_type_infoD2Ev($1);
    __label__ = 3;
    break;
   case 3:
    var $3 = $this;
    __ZdlPv($3);
    return;
   case 4:
    var $5 = ___cxa_find_matching_catch(HEAP32[_llvm_eh_exception.buf >> 2], HEAP32[_llvm_eh_exception.buf + 4 >> 2], []);
    var $6 = $this;
    __ZdlPv($6);
    Module.print("Resuming exception");
    throw HEAP32[_llvm_eh_exception.buf >> 2];
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv($this, $thrown_type, $adjustedPtr) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 56;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $info = __stackBase__;
    if (($this | 0) == ($thrown_type | 0)) {
      var $_0 = 1;
      __label__ = 7;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    if (($thrown_type | 0) == 0) {
      var $_0 = 0;
      __label__ = 7;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    var $6 = $thrown_type;
    var $7 = ___dynamic_cast($6, __ZTIN10__cxxabiv117__class_type_infoE);
    var $8 = $7;
    if (($7 | 0) == 0) {
      var $_0 = 0;
      __label__ = 7;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    var $11 = $info;
    for (var $$dest = $11 >> 2, $$stop = $$dest + 14; $$dest < $$stop; $$dest++) {
      HEAP32[$$dest] = 0;
    }
    HEAP32[$info >> 2] = $8;
    HEAP32[$info + 8 >> 2] = $this;
    HEAP32[$info + 12 >> 2] = -1;
    HEAP32[$info + 48 >> 2] = 1;
    var $19 = HEAP32[HEAP32[$7 >> 2] + 20 >> 2];
    var $20 = HEAP32[$adjustedPtr >> 2];
    FUNCTION_TABLE[$19]($8, $info, $20, 1);
    if ((HEAP32[$info + 24 >> 2] | 0) == 1) {
      __label__ = 6;
      break;
    } else {
      var $_0 = 0;
      __label__ = 7;
      break;
    }
   case 6:
    var $26 = HEAP32[$info + 16 >> 2];
    HEAP32[$adjustedPtr >> 2] = $26;
    var $_0 = 1;
    __label__ = 7;
    break;
   case 7:
    var $_0;
    STACKTOP = __stackBase__;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($this, $info, $adjustedPtr, $path_below) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if ((HEAP32[$info + 8 >> 2] | 0) == ($this | 0)) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($info, $adjustedPtr, $path_below);
    __label__ = 4;
    break;
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($this, $info, $adjustedPtr, $path_below) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if (($this | 0) == (HEAP32[$info + 8 >> 2] | 0)) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($info, $adjustedPtr, $path_below);
    __label__ = 5;
    break;
   case 4:
    var $8 = HEAP32[$this + 8 >> 2];
    var $12 = HEAP32[HEAP32[$8 >> 2] + 20 >> 2];
    FUNCTION_TABLE[$12]($8, $info, $adjustedPtr, $path_below);
    __label__ = 5;
    break;
   case 5:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function ___dynamic_cast($static_ptr, $dst_type) {
  var __stackBase__ = STACKTOP;
  STACKTOP += 56;
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $info = __stackBase__;
    var $2 = HEAP32[$static_ptr >> 2];
    var $6 = $static_ptr + HEAP32[$2 - 8 >> 2] | 0;
    var $8 = HEAP32[$2 - 4 >> 2];
    var $9 = $8;
    HEAP32[$info >> 2] = $dst_type;
    HEAP32[$info + 4 >> 2] = $static_ptr;
    HEAP32[$info + 8 >> 2] = __ZTIN10__cxxabiv116__shim_type_infoE;
    HEAP32[$info + 12 >> 2] = -1;
    var $14 = $info + 16 | 0;
    var $15 = $info + 20 | 0;
    var $16 = $info + 24 | 0;
    var $17 = $info + 28 | 0;
    var $18 = $info + 32 | 0;
    var $19 = $info + 40 | 0;
    var $20 = ($9 | 0) == ($dst_type | 0);
    var $21 = $14;
    for (var $$dest = $21 >> 2, $$stop = $$dest + 9; $$dest < $$stop; $$dest++) {
      HEAP32[$$dest] = 0;
    }
    HEAP16[$21 + 36 >> 1] = 0;
    HEAP8[$21 + 38] = 0;
    if ($20) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    HEAP32[$info + 48 >> 2] = 1;
    var $27 = HEAP32[HEAP32[$8 >> 2] + 12 >> 2];
    FUNCTION_TABLE[$27]($dst_type, $info, $6, $6, 1);
    var $_ = (HEAP32[$16 >> 2] | 0) == 1 ? $6 : 0;
    STACKTOP = __stackBase__;
    return $_;
   case 4:
    var $31 = $info + 36 | 0;
    var $35 = HEAP32[HEAP32[$8 >> 2] + 16 >> 2];
    FUNCTION_TABLE[$35]($9, $info, $6, 1);
    var $36 = HEAP32[$31 >> 2];
    if (($36 | 0) == 0) {
      __label__ = 5;
      break;
    } else if (($36 | 0) == 1) {
      __label__ = 8;
      break;
    } else {
      var $dst_ptr_0 = 0;
      __label__ = 13;
      break;
    }
   case 5:
    if ((HEAP32[$19 >> 2] | 0) == 1) {
      __label__ = 6;
      break;
    } else {
      var $dst_ptr_0 = 0;
      __label__ = 13;
      break;
    }
   case 6:
    if ((HEAP32[$17 >> 2] | 0) == 1) {
      __label__ = 7;
      break;
    } else {
      var $dst_ptr_0 = 0;
      __label__ = 13;
      break;
    }
   case 7:
    var $_1 = (HEAP32[$18 >> 2] | 0) == 1 ? HEAP32[$15 >> 2] : 0;
    var $dst_ptr_0 = $_1;
    __label__ = 13;
    break;
   case 8:
    if ((HEAP32[$16 >> 2] | 0) == 1) {
      __label__ = 12;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 9:
    if ((HEAP32[$19 >> 2] | 0) == 0) {
      __label__ = 10;
      break;
    } else {
      var $dst_ptr_0 = 0;
      __label__ = 13;
      break;
    }
   case 10:
    if ((HEAP32[$17 >> 2] | 0) == 1) {
      __label__ = 11;
      break;
    } else {
      var $dst_ptr_0 = 0;
      __label__ = 13;
      break;
    }
   case 11:
    if ((HEAP32[$18 >> 2] | 0) == 1) {
      __label__ = 12;
      break;
    } else {
      var $dst_ptr_0 = 0;
      __label__ = 13;
      break;
    }
   case 12:
    var $dst_ptr_0 = HEAP32[$14 >> 2];
    __label__ = 13;
    break;
   case 13:
    var $dst_ptr_0;
    STACKTOP = __stackBase__;
    return $dst_ptr_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

___dynamic_cast["X"] = 1;

function __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvi($this, $info, $current_ptr, $path_below) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $this | 0;
    if (($1 | 0) == (HEAP32[$info + 8 >> 2] | 0)) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi($info, $current_ptr, $path_below);
    __label__ = 19;
    break;
   case 4:
    if (($1 | 0) == (HEAP32[$info >> 2] | 0)) {
      __label__ = 5;
      break;
    } else {
      __label__ = 18;
      break;
    }
   case 5:
    if ((HEAP32[$info + 16 >> 2] | 0) == ($current_ptr | 0)) {
      __label__ = 7;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    var $15 = $info + 20 | 0;
    if ((HEAP32[$15 >> 2] | 0) == ($current_ptr | 0)) {
      __label__ = 7;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 7:
    if (($path_below | 0) == 1) {
      __label__ = 8;
      break;
    } else {
      __label__ = 19;
      break;
    }
   case 8:
    HEAP32[$info + 32 >> 2] = 1;
    __label__ = 19;
    break;
   case 9:
    HEAP32[$info + 32 >> 2] = $path_below;
    var $24 = $info + 44 | 0;
    if ((HEAP32[$24 >> 2] | 0) == 4) {
      __label__ = 19;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 10:
    var $28 = $info + 52 | 0;
    HEAP8[$28] = 0;
    var $29 = $info + 53 | 0;
    HEAP8[$29] = 0;
    var $31 = HEAP32[$this + 8 >> 2];
    var $35 = HEAP32[HEAP32[$31 >> 2] + 12 >> 2];
    FUNCTION_TABLE[$35]($31, $info, $current_ptr, $current_ptr, 1);
    if ((HEAP8[$29] & 1) << 24 >> 24 == 0) {
      var $is_dst_type_derived_from_static_type_01 = 0;
      __label__ = 12;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 11:
    if ((HEAP8[$28] & 1) << 24 >> 24 == 0) {
      var $is_dst_type_derived_from_static_type_01 = 1;
      __label__ = 12;
      break;
    } else {
      __label__ = 16;
      break;
    }
   case 12:
    var $is_dst_type_derived_from_static_type_01;
    HEAP32[$15 >> 2] = $current_ptr;
    var $42 = $info + 40 | 0;
    var $44 = HEAP32[$42 >> 2] + 1 | 0;
    HEAP32[$42 >> 2] = $44;
    if ((HEAP32[$info + 36 >> 2] | 0) == 1) {
      __label__ = 13;
      break;
    } else {
      __label__ = 15;
      break;
    }
   case 13:
    if ((HEAP32[$info + 24 >> 2] | 0) == 2) {
      __label__ = 14;
      break;
    } else {
      __label__ = 15;
      break;
    }
   case 14:
    HEAP8[$info + 54 | 0] = 1;
    if ($is_dst_type_derived_from_static_type_01) {
      __label__ = 16;
      break;
    } else {
      __label__ = 17;
      break;
    }
   case 15:
    if ($is_dst_type_derived_from_static_type_01) {
      __label__ = 16;
      break;
    } else {
      __label__ = 17;
      break;
    }
   case 16:
    HEAP32[$24 >> 2] = 3;
    __label__ = 19;
    break;
   case 17:
    HEAP32[$24 >> 2] = 4;
    __label__ = 19;
    break;
   case 18:
    var $58 = HEAP32[$this + 8 >> 2];
    var $62 = HEAP32[HEAP32[$58 >> 2] + 16 >> 2];
    FUNCTION_TABLE[$62]($58, $info, $current_ptr, $path_below);
    __label__ = 19;
    break;
   case 19:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvi["X"] = 1;

function __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvi($this, $info, $current_ptr, $path_below) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if ((HEAP32[$info + 8 >> 2] | 0) == ($this | 0)) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi($info, $current_ptr, $path_below);
    __label__ = 13;
    break;
   case 4:
    if ((HEAP32[$info >> 2] | 0) == ($this | 0)) {
      __label__ = 5;
      break;
    } else {
      __label__ = 13;
      break;
    }
   case 5:
    if ((HEAP32[$info + 16 >> 2] | 0) == ($current_ptr | 0)) {
      __label__ = 7;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    var $14 = $info + 20 | 0;
    if ((HEAP32[$14 >> 2] | 0) == ($current_ptr | 0)) {
      __label__ = 7;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 7:
    if (($path_below | 0) == 1) {
      __label__ = 8;
      break;
    } else {
      __label__ = 13;
      break;
    }
   case 8:
    HEAP32[$info + 32 >> 2] = 1;
    __label__ = 13;
    break;
   case 9:
    HEAP32[$info + 32 >> 2] = $path_below;
    HEAP32[$14 >> 2] = $current_ptr;
    var $23 = $info + 40 | 0;
    var $25 = HEAP32[$23 >> 2] + 1 | 0;
    HEAP32[$23 >> 2] = $25;
    if ((HEAP32[$info + 36 >> 2] | 0) == 1) {
      __label__ = 10;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 10:
    if ((HEAP32[$info + 24 >> 2] | 0) == 2) {
      __label__ = 11;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 11:
    HEAP8[$info + 54 | 0] = 1;
    __label__ = 12;
    break;
   case 12:
    HEAP32[$info + 44 >> 2] = 4;
    __label__ = 13;
    break;
   case 13:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($this, $info, $dst_ptr, $current_ptr, $path_below) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if (($this | 0) == (HEAP32[$info + 8 >> 2] | 0)) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($info, $dst_ptr, $current_ptr, $path_below);
    __label__ = 5;
    break;
   case 4:
    var $8 = HEAP32[$this + 8 >> 2];
    var $12 = HEAP32[HEAP32[$8 >> 2] + 12 >> 2];
    FUNCTION_TABLE[$12]($8, $info, $dst_ptr, $current_ptr, $path_below);
    __label__ = 5;
    break;
   case 5:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($this, $info, $dst_ptr, $current_ptr, $path_below) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if ((HEAP32[$info + 8 >> 2] | 0) == ($this | 0)) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($info, $dst_ptr, $current_ptr, $path_below);
    __label__ = 4;
    break;
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function _malloc($bytes) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if ($bytes >>> 0 < 245) {
      __label__ = 3;
      break;
    } else {
      __label__ = 28;
      break;
    }
   case 3:
    if ($bytes >>> 0 < 11) {
      var $8 = 16;
      __label__ = 5;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    var $8 = $bytes + 11 & -8;
    __label__ = 5;
    break;
   case 5:
    var $8;
    var $9 = $8 >>> 3;
    var $10 = HEAPU32[__gm_ >> 2];
    var $11 = $10 >>> ($9 >>> 0);
    if (($11 & 3 | 0) == 0) {
      __label__ = 12;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    var $17 = ($11 & 1 ^ 1) + $9 | 0;
    var $18 = $17 << 1;
    var $20 = __gm_ + 40 + ($18 << 2) | 0;
    var $21 = __gm_ + 40 + ($18 + 2 << 2) | 0;
    var $22 = HEAPU32[$21 >> 2];
    var $23 = $22 + 8 | 0;
    var $24 = HEAPU32[$23 >> 2];
    if (($20 | 0) == ($24 | 0)) {
      __label__ = 7;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 7:
    HEAP32[__gm_ >> 2] = $10 & (1 << $17 ^ -1);
    __label__ = 11;
    break;
   case 8:
    if ($24 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 10;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 9:
    HEAP32[$21 >> 2] = $24;
    HEAP32[$24 + 12 >> 2] = $20;
    __label__ = 11;
    break;
   case 10:
    _abort();
    throw "Reached an unreachable!";
   case 11:
    var $38 = $17 << 3;
    HEAP32[$22 + 4 >> 2] = $38 | 3;
    var $43 = $22 + ($38 | 4) | 0;
    var $45 = HEAP32[$43 >> 2] | 1;
    HEAP32[$43 >> 2] = $45;
    var $mem_0 = $23;
    __label__ = 39;
    break;
   case 12:
    if ($8 >>> 0 > HEAPU32[__gm_ + 8 >> 2] >>> 0) {
      __label__ = 13;
      break;
    } else {
      var $nb_0 = $8;
      __label__ = 31;
      break;
    }
   case 13:
    if (($11 | 0) == 0) {
      __label__ = 26;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 14:
    var $54 = 2 << $9;
    var $57 = $11 << $9 & ($54 | -$54);
    var $60 = ($57 & -$57) - 1 | 0;
    var $62 = $60 >>> 12 & 16;
    var $63 = $60 >>> ($62 >>> 0);
    var $65 = $63 >>> 5 & 8;
    var $66 = $63 >>> ($65 >>> 0);
    var $68 = $66 >>> 2 & 4;
    var $69 = $66 >>> ($68 >>> 0);
    var $71 = $69 >>> 1 & 2;
    var $72 = $69 >>> ($71 >>> 0);
    var $74 = $72 >>> 1 & 1;
    var $80 = ($65 | $62 | $68 | $71 | $74) + ($72 >>> ($74 >>> 0)) | 0;
    var $81 = $80 << 1;
    var $83 = __gm_ + 40 + ($81 << 2) | 0;
    var $84 = __gm_ + 40 + ($81 + 2 << 2) | 0;
    var $85 = HEAPU32[$84 >> 2];
    var $86 = $85 + 8 | 0;
    var $87 = HEAPU32[$86 >> 2];
    if (($83 | 0) == ($87 | 0)) {
      __label__ = 15;
      break;
    } else {
      __label__ = 16;
      break;
    }
   case 15:
    HEAP32[__gm_ >> 2] = $10 & (1 << $80 ^ -1);
    __label__ = 19;
    break;
   case 16:
    if ($87 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 18;
      break;
    } else {
      __label__ = 17;
      break;
    }
   case 17:
    HEAP32[$84 >> 2] = $87;
    HEAP32[$87 + 12 >> 2] = $83;
    __label__ = 19;
    break;
   case 18:
    _abort();
    throw "Reached an unreachable!";
   case 19:
    var $101 = $80 << 3;
    var $102 = $101 - $8 | 0;
    HEAP32[$85 + 4 >> 2] = $8 | 3;
    var $105 = $85;
    var $107 = $105 + $8 | 0;
    HEAP32[$105 + ($8 | 4) >> 2] = $102 | 1;
    HEAP32[$105 + $101 >> 2] = $102;
    var $113 = HEAPU32[__gm_ + 8 >> 2];
    if (($113 | 0) == 0) {
      __label__ = 25;
      break;
    } else {
      __label__ = 20;
      break;
    }
   case 20:
    var $116 = HEAP32[__gm_ + 20 >> 2];
    var $119 = $113 >>> 2 & 1073741822;
    var $121 = __gm_ + 40 + ($119 << 2) | 0;
    var $122 = HEAPU32[__gm_ >> 2];
    var $123 = 1 << ($113 >>> 3);
    if (($122 & $123 | 0) == 0) {
      __label__ = 21;
      break;
    } else {
      __label__ = 22;
      break;
    }
   case 21:
    HEAP32[__gm_ >> 2] = $122 | $123;
    var $F4_0 = $121;
    var $_pre_phi = __gm_ + 40 + ($119 + 2 << 2) | 0;
    __label__ = 24;
    break;
   case 22:
    var $129 = __gm_ + 40 + ($119 + 2 << 2) | 0;
    var $130 = HEAPU32[$129 >> 2];
    if ($130 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 23;
      break;
    } else {
      var $F4_0 = $130;
      var $_pre_phi = $129;
      __label__ = 24;
      break;
    }
   case 23:
    _abort();
    throw "Reached an unreachable!";
   case 24:
    var $_pre_phi;
    var $F4_0;
    HEAP32[$_pre_phi >> 2] = $116;
    HEAP32[$F4_0 + 12 >> 2] = $116;
    var $137 = $116 + 8 | 0;
    HEAP32[$137 >> 2] = $F4_0;
    var $138 = $116 + 12 | 0;
    HEAP32[$138 >> 2] = $121;
    __label__ = 25;
    break;
   case 25:
    HEAP32[__gm_ + 8 >> 2] = $102;
    HEAP32[__gm_ + 20 >> 2] = $107;
    var $mem_0 = $86;
    __label__ = 39;
    break;
   case 26:
    if ((HEAP32[__gm_ + 4 >> 2] | 0) == 0) {
      var $nb_0 = $8;
      __label__ = 31;
      break;
    } else {
      __label__ = 27;
      break;
    }
   case 27:
    var $145 = _tmalloc_small($8);
    if (($145 | 0) == 0) {
      var $nb_0 = $8;
      __label__ = 31;
      break;
    } else {
      var $mem_0 = $145;
      __label__ = 39;
      break;
    }
   case 28:
    if ($bytes >>> 0 > 4294967231) {
      var $nb_0 = -1;
      __label__ = 31;
      break;
    } else {
      __label__ = 29;
      break;
    }
   case 29:
    var $151 = $bytes + 11 & -8;
    if ((HEAP32[__gm_ + 4 >> 2] | 0) == 0) {
      var $nb_0 = $151;
      __label__ = 31;
      break;
    } else {
      __label__ = 30;
      break;
    }
   case 30:
    var $155 = _tmalloc_large($151);
    if (($155 | 0) == 0) {
      var $nb_0 = $151;
      __label__ = 31;
      break;
    } else {
      var $mem_0 = $155;
      __label__ = 39;
      break;
    }
   case 31:
    var $nb_0;
    var $157 = HEAPU32[__gm_ + 8 >> 2];
    if ($nb_0 >>> 0 > $157 >>> 0) {
      __label__ = 36;
      break;
    } else {
      __label__ = 32;
      break;
    }
   case 32:
    var $160 = $157 - $nb_0 | 0;
    var $161 = HEAPU32[__gm_ + 20 >> 2];
    if ($160 >>> 0 > 15) {
      __label__ = 33;
      break;
    } else {
      __label__ = 34;
      break;
    }
   case 33:
    var $164 = $161;
    HEAP32[__gm_ + 20 >> 2] = $164 + $nb_0 | 0;
    HEAP32[__gm_ + 8 >> 2] = $160;
    HEAP32[$164 + ($nb_0 + 4) >> 2] = $160 | 1;
    HEAP32[$164 + $157 >> 2] = $160;
    HEAP32[$161 + 4 >> 2] = $nb_0 | 3;
    __label__ = 35;
    break;
   case 34:
    HEAP32[__gm_ + 8 >> 2] = 0;
    HEAP32[__gm_ + 20 >> 2] = 0;
    HEAP32[$161 + 4 >> 2] = $157 | 3;
    var $179 = $161 + ($157 + 4) | 0;
    var $181 = HEAP32[$179 >> 2] | 1;
    HEAP32[$179 >> 2] = $181;
    __label__ = 35;
    break;
   case 35:
    var $mem_0 = $161 + 8 | 0;
    __label__ = 39;
    break;
   case 36:
    var $186 = HEAPU32[__gm_ + 12 >> 2];
    if ($nb_0 >>> 0 < $186 >>> 0) {
      __label__ = 37;
      break;
    } else {
      __label__ = 38;
      break;
    }
   case 37:
    var $189 = $186 - $nb_0 | 0;
    HEAP32[__gm_ + 12 >> 2] = $189;
    var $190 = HEAPU32[__gm_ + 24 >> 2];
    var $191 = $190;
    HEAP32[__gm_ + 24 >> 2] = $191 + $nb_0 | 0;
    HEAP32[$191 + ($nb_0 + 4) >> 2] = $189 | 1;
    HEAP32[$190 + 4 >> 2] = $nb_0 | 3;
    var $mem_0 = $190 + 8 | 0;
    __label__ = 39;
    break;
   case 38:
    var $202 = _sys_alloc($nb_0);
    var $mem_0 = $202;
    __label__ = 39;
    break;
   case 39:
    var $mem_0;
    return $mem_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

Module["_malloc"] = _malloc;

_malloc["X"] = 1;

function _tmalloc_small($nb) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = HEAP32[__gm_ + 4 >> 2];
    var $4 = ($1 & -$1) - 1 | 0;
    var $6 = $4 >>> 12 & 16;
    var $7 = $4 >>> ($6 >>> 0);
    var $9 = $7 >>> 5 & 8;
    var $10 = $7 >>> ($9 >>> 0);
    var $12 = $10 >>> 2 & 4;
    var $13 = $10 >>> ($12 >>> 0);
    var $15 = $13 >>> 1 & 2;
    var $16 = $13 >>> ($15 >>> 0);
    var $18 = $16 >>> 1 & 1;
    var $26 = HEAPU32[__gm_ + 304 + (($9 | $6 | $12 | $15 | $18) + ($16 >>> ($18 >>> 0)) << 2) >> 2];
    var $t_0 = $26;
    var $v_0 = $26;
    var $rsize_0 = (HEAP32[$26 + 4 >> 2] & -8) - $nb | 0;
    __label__ = 3;
    break;
   case 3:
    var $rsize_0;
    var $v_0;
    var $t_0;
    var $33 = HEAP32[$t_0 + 16 >> 2];
    if (($33 | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      var $39 = $33;
      __label__ = 5;
      break;
    }
   case 4:
    var $37 = HEAP32[$t_0 + 20 >> 2];
    if (($37 | 0) == 0) {
      __label__ = 6;
      break;
    } else {
      var $39 = $37;
      __label__ = 5;
      break;
    }
   case 5:
    var $39;
    var $43 = (HEAP32[$39 + 4 >> 2] & -8) - $nb | 0;
    var $44 = $43 >>> 0 < $rsize_0 >>> 0;
    var $_rsize_0 = $44 ? $43 : $rsize_0;
    var $_v_0 = $44 ? $39 : $v_0;
    var $t_0 = $39;
    var $v_0 = $_v_0;
    var $rsize_0 = $_rsize_0;
    __label__ = 3;
    break;
   case 6:
    var $46 = $v_0;
    var $47 = HEAPU32[__gm_ + 16 >> 2];
    if ($46 >>> 0 < $47 >>> 0) {
      __label__ = 49;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 7:
    var $50 = $46 + $nb | 0;
    var $51 = $50;
    if ($46 >>> 0 < $50 >>> 0) {
      __label__ = 8;
      break;
    } else {
      __label__ = 49;
      break;
    }
   case 8:
    var $55 = HEAPU32[$v_0 + 24 >> 2];
    var $57 = HEAPU32[$v_0 + 12 >> 2];
    if (($57 | 0) == ($v_0 | 0)) {
      __label__ = 12;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 9:
    var $61 = HEAPU32[$v_0 + 8 >> 2];
    if ($61 >>> 0 < $47 >>> 0) {
      __label__ = 11;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 10:
    HEAP32[$61 + 12 >> 2] = $57;
    HEAP32[$57 + 8 >> 2] = $61;
    var $R_1 = $57;
    __label__ = 19;
    break;
   case 11:
    _abort();
    throw "Reached an unreachable!";
   case 12:
    var $69 = $v_0 + 20 | 0;
    var $70 = HEAP32[$69 >> 2];
    if (($70 | 0) == 0) {
      __label__ = 13;
      break;
    } else {
      var $RP_0 = $69;
      var $R_0 = $70;
      __label__ = 14;
      break;
    }
   case 13:
    var $73 = $v_0 + 16 | 0;
    var $74 = HEAP32[$73 >> 2];
    if (($74 | 0) == 0) {
      var $R_1 = 0;
      __label__ = 19;
      break;
    } else {
      var $RP_0 = $73;
      var $R_0 = $74;
      __label__ = 14;
      break;
    }
   case 14:
    var $R_0;
    var $RP_0;
    var $76 = $R_0 + 20 | 0;
    var $77 = HEAP32[$76 >> 2];
    if (($77 | 0) == 0) {
      __label__ = 15;
      break;
    } else {
      var $RP_0 = $76;
      var $R_0 = $77;
      __label__ = 14;
      break;
    }
   case 15:
    var $80 = $R_0 + 16 | 0;
    var $81 = HEAPU32[$80 >> 2];
    if (($81 | 0) == 0) {
      __label__ = 16;
      break;
    } else {
      var $RP_0 = $80;
      var $R_0 = $81;
      __label__ = 14;
      break;
    }
   case 16:
    if ($RP_0 >>> 0 < $47 >>> 0) {
      __label__ = 18;
      break;
    } else {
      __label__ = 17;
      break;
    }
   case 17:
    HEAP32[$RP_0 >> 2] = 0;
    var $R_1 = $R_0;
    __label__ = 19;
    break;
   case 18:
    _abort();
    throw "Reached an unreachable!";
   case 19:
    var $R_1;
    if (($55 | 0) == 0) {
      __label__ = 39;
      break;
    } else {
      __label__ = 20;
      break;
    }
   case 20:
    var $91 = $v_0 + 28 | 0;
    var $93 = __gm_ + 304 + (HEAP32[$91 >> 2] << 2) | 0;
    if (($v_0 | 0) == (HEAP32[$93 >> 2] | 0)) {
      __label__ = 21;
      break;
    } else {
      __label__ = 23;
      break;
    }
   case 21:
    HEAP32[$93 >> 2] = $R_1;
    if (($R_1 | 0) == 0) {
      __label__ = 22;
      break;
    } else {
      __label__ = 29;
      break;
    }
   case 22:
    var $101 = HEAP32[__gm_ + 4 >> 2] & (1 << HEAP32[$91 >> 2] ^ -1);
    HEAP32[__gm_ + 4 >> 2] = $101;
    __label__ = 39;
    break;
   case 23:
    if ($55 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 27;
      break;
    } else {
      __label__ = 24;
      break;
    }
   case 24:
    var $107 = $55 + 16 | 0;
    if ((HEAP32[$107 >> 2] | 0) == ($v_0 | 0)) {
      __label__ = 25;
      break;
    } else {
      __label__ = 26;
      break;
    }
   case 25:
    HEAP32[$107 >> 2] = $R_1;
    __label__ = 28;
    break;
   case 26:
    HEAP32[$55 + 20 >> 2] = $R_1;
    __label__ = 28;
    break;
   case 27:
    _abort();
    throw "Reached an unreachable!";
   case 28:
    if (($R_1 | 0) == 0) {
      __label__ = 39;
      break;
    } else {
      __label__ = 29;
      break;
    }
   case 29:
    if ($R_1 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 38;
      break;
    } else {
      __label__ = 30;
      break;
    }
   case 30:
    HEAP32[$R_1 + 24 >> 2] = $55;
    var $123 = HEAPU32[$v_0 + 16 >> 2];
    if (($123 | 0) == 0) {
      __label__ = 34;
      break;
    } else {
      __label__ = 31;
      break;
    }
   case 31:
    if ($123 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 33;
      break;
    } else {
      __label__ = 32;
      break;
    }
   case 32:
    HEAP32[$R_1 + 16 >> 2] = $123;
    HEAP32[$123 + 24 >> 2] = $R_1;
    __label__ = 34;
    break;
   case 33:
    _abort();
    throw "Reached an unreachable!";
   case 34:
    var $135 = HEAPU32[$v_0 + 20 >> 2];
    if (($135 | 0) == 0) {
      __label__ = 39;
      break;
    } else {
      __label__ = 35;
      break;
    }
   case 35:
    if ($135 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 37;
      break;
    } else {
      __label__ = 36;
      break;
    }
   case 36:
    HEAP32[$R_1 + 20 >> 2] = $135;
    HEAP32[$135 + 24 >> 2] = $R_1;
    __label__ = 39;
    break;
   case 37:
    _abort();
    throw "Reached an unreachable!";
   case 38:
    _abort();
    throw "Reached an unreachable!";
   case 39:
    if ($rsize_0 >>> 0 < 16) {
      __label__ = 40;
      break;
    } else {
      __label__ = 41;
      break;
    }
   case 40:
    var $149 = $rsize_0 + $nb | 0;
    HEAP32[$v_0 + 4 >> 2] = $149 | 3;
    var $153 = $46 + ($149 + 4) | 0;
    var $155 = HEAP32[$153 >> 2] | 1;
    HEAP32[$153 >> 2] = $155;
    __label__ = 48;
    break;
   case 41:
    HEAP32[$v_0 + 4 >> 2] = $nb | 3;
    HEAP32[$46 + ($nb + 4) >> 2] = $rsize_0 | 1;
    HEAP32[$46 + ($rsize_0 + $nb) >> 2] = $rsize_0;
    var $164 = HEAPU32[__gm_ + 8 >> 2];
    if (($164 | 0) == 0) {
      __label__ = 47;
      break;
    } else {
      __label__ = 42;
      break;
    }
   case 42:
    var $167 = HEAPU32[__gm_ + 20 >> 2];
    var $170 = $164 >>> 2 & 1073741822;
    var $172 = __gm_ + 40 + ($170 << 2) | 0;
    var $173 = HEAPU32[__gm_ >> 2];
    var $174 = 1 << ($164 >>> 3);
    if (($173 & $174 | 0) == 0) {
      __label__ = 43;
      break;
    } else {
      __label__ = 44;
      break;
    }
   case 43:
    HEAP32[__gm_ >> 2] = $173 | $174;
    var $F1_0 = $172;
    var $_pre_phi = __gm_ + 40 + ($170 + 2 << 2) | 0;
    __label__ = 46;
    break;
   case 44:
    var $180 = __gm_ + 40 + ($170 + 2 << 2) | 0;
    var $181 = HEAPU32[$180 >> 2];
    if ($181 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 45;
      break;
    } else {
      var $F1_0 = $181;
      var $_pre_phi = $180;
      __label__ = 46;
      break;
    }
   case 45:
    _abort();
    throw "Reached an unreachable!";
   case 46:
    var $_pre_phi;
    var $F1_0;
    HEAP32[$_pre_phi >> 2] = $167;
    HEAP32[$F1_0 + 12 >> 2] = $167;
    HEAP32[$167 + 8 >> 2] = $F1_0;
    HEAP32[$167 + 12 >> 2] = $172;
    __label__ = 47;
    break;
   case 47:
    HEAP32[__gm_ + 8 >> 2] = $rsize_0;
    HEAP32[__gm_ + 20 >> 2] = $51;
    __label__ = 48;
    break;
   case 48:
    return $v_0 + 8 | 0;
   case 49:
    _abort();
    throw "Reached an unreachable!";
   default:
    assert(0, "bad label: " + __label__);
  }
}

_tmalloc_small["X"] = 1;

function _sys_alloc($nb) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if ((HEAP32[_mparams >> 2] | 0) == 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    _init_mparams();
    __label__ = 4;
    break;
   case 4:
    if ((HEAP32[__gm_ + 440 >> 2] & 4 | 0) == 0) {
      __label__ = 5;
      break;
    } else {
      var $tsize_125 = 0;
      __label__ = 24;
      break;
    }
   case 5:
    var $9 = HEAP32[__gm_ + 24 >> 2];
    if (($9 | 0) == 0) {
      __label__ = 7;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    var $12 = $9;
    var $13 = _segment_holding($12);
    if (($13 | 0) == 0) {
      __label__ = 7;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 7:
    var $15 = _sbrk(0);
    if (($15 | 0) == -1) {
      var $tsize_0121720_ph = 0;
      __label__ = 22;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 8:
    var $18 = HEAP32[_mparams + 8 >> 2];
    var $22 = $nb + 47 + $18 & -$18;
    var $23 = $15;
    var $24 = HEAP32[_mparams + 4 >> 2];
    var $25 = $24 - 1 | 0;
    if (($25 & $23 | 0) == 0) {
      var $asize_0 = $22;
      __label__ = 10;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 9:
    var $asize_0 = $22 - $23 + ($25 + $23 & -$24) | 0;
    __label__ = 10;
    break;
   case 10:
    var $asize_0;
    if ($asize_0 >>> 0 < 2147483647) {
      __label__ = 11;
      break;
    } else {
      var $tsize_0121720_ph = 0;
      __label__ = 22;
      break;
    }
   case 11:
    var $37 = _sbrk($asize_0);
    var $38 = ($37 | 0) == ($15 | 0);
    var $asize_0_ = $38 ? $asize_0 : 0;
    var $_ = $38 ? $15 : -1;
    var $tbase_0 = $_;
    var $tsize_0 = $asize_0_;
    var $asize_1 = $asize_0;
    var $br_0 = $37;
    __label__ = 14;
    break;
   case 12:
    var $41 = HEAP32[_mparams + 8 >> 2];
    var $46 = $nb + 47 - HEAP32[__gm_ + 12 >> 2] + $41 & -$41;
    if ($46 >>> 0 < 2147483647) {
      __label__ = 13;
      break;
    } else {
      var $tsize_0121720_ph = 0;
      __label__ = 22;
      break;
    }
   case 13:
    var $49 = _sbrk($46);
    var $55 = ($49 | 0) == (HEAP32[$13 >> 2] + HEAP32[$13 + 4 >> 2] | 0);
    var $_1 = $55 ? $46 : 0;
    var $_2 = $55 ? $49 : -1;
    var $tbase_0 = $_2;
    var $tsize_0 = $_1;
    var $asize_1 = $46;
    var $br_0 = $49;
    __label__ = 14;
    break;
   case 14:
    var $br_0;
    var $asize_1;
    var $tsize_0;
    var $tbase_0;
    var $57 = -$asize_1 | 0;
    if (($tbase_0 | 0) == -1) {
      __label__ = 15;
      break;
    } else {
      var $tsize_229 = $tsize_0;
      var $tbase_230 = $tbase_0;
      __label__ = 27;
      break;
    }
   case 15:
    if (($br_0 | 0) != -1 & $asize_1 >>> 0 < 2147483647) {
      __label__ = 16;
      break;
    } else {
      var $asize_2 = $asize_1;
      __label__ = 21;
      break;
    }
   case 16:
    if ($asize_1 >>> 0 < ($nb + 48 | 0) >>> 0) {
      __label__ = 17;
      break;
    } else {
      var $asize_2 = $asize_1;
      __label__ = 21;
      break;
    }
   case 17:
    var $66 = HEAP32[_mparams + 8 >> 2];
    var $71 = $nb + 47 - $asize_1 + $66 & -$66;
    if ($71 >>> 0 < 2147483647) {
      __label__ = 18;
      break;
    } else {
      var $asize_2 = $asize_1;
      __label__ = 21;
      break;
    }
   case 18:
    var $74 = _sbrk($71);
    if (($74 | 0) == -1) {
      __label__ = 20;
      break;
    } else {
      __label__ = 19;
      break;
    }
   case 19:
    var $asize_2 = $71 + $asize_1 | 0;
    __label__ = 21;
    break;
   case 20:
    var $79 = _sbrk($57);
    var $tsize_0121720_ph = $tsize_0;
    __label__ = 22;
    break;
   case 21:
    var $asize_2;
    if (($br_0 | 0) == -1) {
      __label__ = 23;
      break;
    } else {
      var $tsize_229 = $asize_2;
      var $tbase_230 = $br_0;
      __label__ = 27;
      break;
    }
   case 22:
    var $tsize_0121720_ph;
    var $83 = HEAP32[__gm_ + 440 >> 2] | 4;
    HEAP32[__gm_ + 440 >> 2] = $83;
    var $tsize_125 = $tsize_0121720_ph;
    __label__ = 24;
    break;
   case 23:
    var $85 = HEAP32[__gm_ + 440 >> 2] | 4;
    HEAP32[__gm_ + 440 >> 2] = $85;
    var $tsize_125 = $tsize_0;
    __label__ = 24;
    break;
   case 24:
    var $tsize_125;
    var $86 = HEAP32[_mparams + 8 >> 2];
    var $90 = $nb + 47 + $86 & -$86;
    if ($90 >>> 0 < 2147483647) {
      __label__ = 25;
      break;
    } else {
      __label__ = 50;
      break;
    }
   case 25:
    var $93 = _sbrk($90);
    var $94 = _sbrk(0);
    if (($94 | 0) != -1 & ($93 | 0) != -1 & $93 >>> 0 < $94 >>> 0) {
      __label__ = 26;
      break;
    } else {
      __label__ = 50;
      break;
    }
   case 26:
    var $98 = $94 - $93 | 0;
    var $100 = $98 >>> 0 > ($nb + 40 | 0) >>> 0;
    var $_tsize_1 = $100 ? $98 : $tsize_125;
    var $_tbase_1 = $100 ? $93 : -1;
    if (($_tbase_1 | 0) == -1) {
      __label__ = 50;
      break;
    } else {
      var $tsize_229 = $_tsize_1;
      var $tbase_230 = $_tbase_1;
      __label__ = 27;
      break;
    }
   case 27:
    var $tbase_230;
    var $tsize_229;
    var $103 = HEAP32[__gm_ + 432 >> 2] + $tsize_229 | 0;
    HEAP32[__gm_ + 432 >> 2] = $103;
    if ($103 >>> 0 > HEAPU32[__gm_ + 436 >> 2] >>> 0) {
      __label__ = 28;
      break;
    } else {
      __label__ = 29;
      break;
    }
   case 28:
    HEAP32[__gm_ + 436 >> 2] = $103;
    __label__ = 29;
    break;
   case 29:
    var $108 = HEAPU32[__gm_ + 24 >> 2];
    if (($108 | 0) == 0) {
      __label__ = 30;
      break;
    } else {
      var $sp_0 = __gm_ + 444 | 0;
      __label__ = 33;
      break;
    }
   case 30:
    var $111 = HEAPU32[__gm_ + 16 >> 2];
    if (($111 | 0) == 0 | $tbase_230 >>> 0 < $111 >>> 0) {
      __label__ = 31;
      break;
    } else {
      __label__ = 32;
      break;
    }
   case 31:
    HEAP32[__gm_ + 16 >> 2] = $tbase_230;
    __label__ = 32;
    break;
   case 32:
    HEAP32[__gm_ + 444 >> 2] = $tbase_230;
    HEAP32[__gm_ + 448 >> 2] = $tsize_229;
    HEAP32[__gm_ + 456 >> 2] = 0;
    var $116 = HEAP32[_mparams >> 2];
    HEAP32[__gm_ + 36 >> 2] = $116;
    HEAP32[__gm_ + 32 >> 2] = -1;
    _init_bins();
    _init_top($tbase_230, $tsize_229 - 40 | 0);
    __label__ = 48;
    break;
   case 33:
    var $sp_0;
    if (($sp_0 | 0) == 0) {
      __label__ = 39;
      break;
    } else {
      __label__ = 34;
      break;
    }
   case 34:
    var $122 = HEAPU32[$sp_0 >> 2];
    var $123 = $sp_0 + 4 | 0;
    var $124 = HEAPU32[$123 >> 2];
    if (($tbase_230 | 0) == ($122 + $124 | 0)) {
      __label__ = 36;
      break;
    } else {
      __label__ = 35;
      break;
    }
   case 35:
    var $sp_0 = HEAP32[$sp_0 + 8 >> 2];
    __label__ = 33;
    break;
   case 36:
    if ((HEAP32[$sp_0 + 12 >> 2] & 8 | 0) == 0) {
      __label__ = 37;
      break;
    } else {
      __label__ = 39;
      break;
    }
   case 37:
    var $135 = $108;
    if ($135 >>> 0 >= $122 >>> 0 & $135 >>> 0 < $tbase_230 >>> 0) {
      __label__ = 38;
      break;
    } else {
      __label__ = 39;
      break;
    }
   case 38:
    HEAP32[$123 >> 2] = $124 + $tsize_229 | 0;
    var $140 = HEAP32[__gm_ + 24 >> 2];
    var $142 = HEAP32[__gm_ + 12 >> 2] + $tsize_229 | 0;
    _init_top($140, $142);
    __label__ = 48;
    break;
   case 39:
    if ($tbase_230 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 40;
      break;
    } else {
      __label__ = 41;
      break;
    }
   case 40:
    HEAP32[__gm_ + 16 >> 2] = $tbase_230;
    __label__ = 41;
    break;
   case 41:
    var $146 = $tbase_230 + $tsize_229 | 0;
    var $sp_1 = __gm_ + 444 | 0;
    __label__ = 42;
    break;
   case 42:
    var $sp_1;
    if (($sp_1 | 0) == 0) {
      __label__ = 47;
      break;
    } else {
      __label__ = 43;
      break;
    }
   case 43:
    var $150 = $sp_1 | 0;
    if ((HEAP32[$150 >> 2] | 0) == ($146 | 0)) {
      __label__ = 45;
      break;
    } else {
      __label__ = 44;
      break;
    }
   case 44:
    var $sp_1 = HEAP32[$sp_1 + 8 >> 2];
    __label__ = 42;
    break;
   case 45:
    if ((HEAP32[$sp_1 + 12 >> 2] & 8 | 0) == 0) {
      __label__ = 46;
      break;
    } else {
      __label__ = 47;
      break;
    }
   case 46:
    HEAP32[$150 >> 2] = $tbase_230;
    var $161 = $sp_1 + 4 | 0;
    var $163 = HEAP32[$161 >> 2] + $tsize_229 | 0;
    HEAP32[$161 >> 2] = $163;
    var $164 = _prepend_alloc($tbase_230, $146, $nb);
    var $_0 = $164;
    __label__ = 51;
    break;
   case 47:
    _add_segment($tbase_230, $tsize_229);
    __label__ = 48;
    break;
   case 48:
    var $166 = HEAPU32[__gm_ + 12 >> 2];
    if ($166 >>> 0 > $nb >>> 0) {
      __label__ = 49;
      break;
    } else {
      __label__ = 50;
      break;
    }
   case 49:
    var $169 = $166 - $nb | 0;
    HEAP32[__gm_ + 12 >> 2] = $169;
    var $170 = HEAPU32[__gm_ + 24 >> 2];
    var $171 = $170;
    HEAP32[__gm_ + 24 >> 2] = $171 + $nb | 0;
    HEAP32[$171 + ($nb + 4) >> 2] = $169 | 1;
    HEAP32[$170 + 4 >> 2] = $nb | 3;
    var $_0 = $170 + 8 | 0;
    __label__ = 51;
    break;
   case 50:
    var $181 = ___errno();
    HEAP32[$181 >> 2] = 12;
    var $_0 = 0;
    __label__ = 51;
    break;
   case 51:
    var $_0;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

_sys_alloc["X"] = 1;

function _tmalloc_large($nb) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = -$nb | 0;
    var $2 = $nb >>> 8;
    if (($2 | 0) == 0) {
      var $idx_0 = 0;
      __label__ = 5;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    if ($nb >>> 0 > 16777215) {
      var $idx_0 = 31;
      __label__ = 5;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    var $9 = ($2 + 1048320 | 0) >>> 16 & 8;
    var $10 = $2 << $9;
    var $13 = ($10 + 520192 | 0) >>> 16 & 4;
    var $14 = $10 << $13;
    var $17 = ($14 + 245760 | 0) >>> 16 & 2;
    var $23 = 14 - ($13 | $9 | $17) + ($14 << $17 >>> 15) | 0;
    var $idx_0 = $nb >>> (($23 + 7 | 0) >>> 0) & 1 | $23 << 1;
    __label__ = 5;
    break;
   case 5:
    var $idx_0;
    var $31 = HEAPU32[__gm_ + 304 + ($idx_0 << 2) >> 2];
    if (($31 | 0) == 0) {
      var $v_2 = 0;
      var $rsize_2 = $1;
      var $t_1 = 0;
      __label__ = 12;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    if (($idx_0 | 0) == 31) {
      var $39 = 0;
      __label__ = 8;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 7:
    var $39 = 25 - ($idx_0 >>> 1) | 0;
    __label__ = 8;
    break;
   case 8:
    var $39;
    var $v_0 = 0;
    var $rsize_0 = $1;
    var $t_0 = $31;
    var $sizebits_0 = $nb << $39;
    var $rst_0 = 0;
    __label__ = 9;
    break;
   case 9:
    var $rst_0;
    var $sizebits_0;
    var $t_0;
    var $rsize_0;
    var $v_0;
    var $44 = HEAP32[$t_0 + 4 >> 2] & -8;
    var $45 = $44 - $nb | 0;
    if ($45 >>> 0 < $rsize_0 >>> 0) {
      __label__ = 10;
      break;
    } else {
      var $v_1 = $v_0;
      var $rsize_1 = $rsize_0;
      __label__ = 11;
      break;
    }
   case 10:
    if (($44 | 0) == ($nb | 0)) {
      var $v_2 = $t_0;
      var $rsize_2 = $45;
      var $t_1 = $t_0;
      __label__ = 12;
      break;
    } else {
      var $v_1 = $t_0;
      var $rsize_1 = $45;
      __label__ = 11;
      break;
    }
   case 11:
    var $rsize_1;
    var $v_1;
    var $51 = HEAPU32[$t_0 + 20 >> 2];
    var $54 = HEAPU32[$t_0 + 16 + ($sizebits_0 >>> 31 << 2) >> 2];
    var $rst_1 = ($51 | 0) == 0 | ($51 | 0) == ($54 | 0) ? $rst_0 : $51;
    if (($54 | 0) == 0) {
      var $v_2 = $v_1;
      var $rsize_2 = $rsize_1;
      var $t_1 = $rst_1;
      __label__ = 12;
      break;
    } else {
      var $v_0 = $v_1;
      var $rsize_0 = $rsize_1;
      var $t_0 = $54;
      var $sizebits_0 = $sizebits_0 << 1;
      var $rst_0 = $rst_1;
      __label__ = 9;
      break;
    }
   case 12:
    var $t_1;
    var $rsize_2;
    var $v_2;
    if (($t_1 | 0) == 0 & ($v_2 | 0) == 0) {
      __label__ = 13;
      break;
    } else {
      var $t_2_ph = $t_1;
      __label__ = 15;
      break;
    }
   case 13:
    var $62 = 2 << $idx_0;
    var $66 = HEAP32[__gm_ + 4 >> 2] & ($62 | -$62);
    if (($66 | 0) == 0) {
      var $rsize_3_lcssa = $rsize_2;
      var $v_3_lcssa = $v_2;
      __label__ = 18;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 14:
    var $71 = ($66 & -$66) - 1 | 0;
    var $73 = $71 >>> 12 & 16;
    var $74 = $71 >>> ($73 >>> 0);
    var $76 = $74 >>> 5 & 8;
    var $77 = $74 >>> ($76 >>> 0);
    var $79 = $77 >>> 2 & 4;
    var $80 = $77 >>> ($79 >>> 0);
    var $82 = $80 >>> 1 & 2;
    var $83 = $80 >>> ($82 >>> 0);
    var $85 = $83 >>> 1 & 1;
    var $t_2_ph = HEAP32[__gm_ + 304 + (($76 | $73 | $79 | $82 | $85) + ($83 >>> ($85 >>> 0)) << 2) >> 2];
    __label__ = 15;
    break;
   case 15:
    var $t_2_ph;
    if (($t_2_ph | 0) == 0) {
      var $rsize_3_lcssa = $rsize_2;
      var $v_3_lcssa = $v_2;
      __label__ = 18;
      break;
    } else {
      var $t_224 = $t_2_ph;
      var $rsize_325 = $rsize_2;
      var $v_326 = $v_2;
      __label__ = 16;
      break;
    }
   case 16:
    var $v_326;
    var $rsize_325;
    var $t_224;
    var $98 = (HEAP32[$t_224 + 4 >> 2] & -8) - $nb | 0;
    var $99 = $98 >>> 0 < $rsize_325 >>> 0;
    var $_rsize_3 = $99 ? $98 : $rsize_325;
    var $t_2_v_3 = $99 ? $t_224 : $v_326;
    var $101 = HEAPU32[$t_224 + 16 >> 2];
    if (($101 | 0) == 0) {
      __label__ = 17;
      break;
    } else {
      var $t_224 = $101;
      var $rsize_325 = $_rsize_3;
      var $v_326 = $t_2_v_3;
      __label__ = 16;
      break;
    }
   case 17:
    var $104 = HEAPU32[$t_224 + 20 >> 2];
    if (($104 | 0) == 0) {
      var $rsize_3_lcssa = $_rsize_3;
      var $v_3_lcssa = $t_2_v_3;
      __label__ = 18;
      break;
    } else {
      var $t_224 = $104;
      var $rsize_325 = $_rsize_3;
      var $v_326 = $t_2_v_3;
      __label__ = 16;
      break;
    }
   case 18:
    var $v_3_lcssa;
    var $rsize_3_lcssa;
    if (($v_3_lcssa | 0) == 0) {
      var $_0 = 0;
      __label__ = 80;
      break;
    } else {
      __label__ = 19;
      break;
    }
   case 19:
    if ($rsize_3_lcssa >>> 0 < (HEAP32[__gm_ + 8 >> 2] - $nb | 0) >>> 0) {
      __label__ = 20;
      break;
    } else {
      var $_0 = 0;
      __label__ = 80;
      break;
    }
   case 20:
    var $112 = $v_3_lcssa;
    var $113 = HEAPU32[__gm_ + 16 >> 2];
    if ($112 >>> 0 < $113 >>> 0) {
      __label__ = 79;
      break;
    } else {
      __label__ = 21;
      break;
    }
   case 21:
    var $116 = $112 + $nb | 0;
    var $117 = $116;
    if ($112 >>> 0 < $116 >>> 0) {
      __label__ = 22;
      break;
    } else {
      __label__ = 79;
      break;
    }
   case 22:
    var $121 = HEAPU32[$v_3_lcssa + 24 >> 2];
    var $123 = HEAPU32[$v_3_lcssa + 12 >> 2];
    if (($123 | 0) == ($v_3_lcssa | 0)) {
      __label__ = 26;
      break;
    } else {
      __label__ = 23;
      break;
    }
   case 23:
    var $127 = HEAPU32[$v_3_lcssa + 8 >> 2];
    if ($127 >>> 0 < $113 >>> 0) {
      __label__ = 25;
      break;
    } else {
      __label__ = 24;
      break;
    }
   case 24:
    HEAP32[$127 + 12 >> 2] = $123;
    HEAP32[$123 + 8 >> 2] = $127;
    var $R_1 = $123;
    __label__ = 33;
    break;
   case 25:
    _abort();
    throw "Reached an unreachable!";
   case 26:
    var $135 = $v_3_lcssa + 20 | 0;
    var $136 = HEAP32[$135 >> 2];
    if (($136 | 0) == 0) {
      __label__ = 27;
      break;
    } else {
      var $RP_0 = $135;
      var $R_0 = $136;
      __label__ = 28;
      break;
    }
   case 27:
    var $139 = $v_3_lcssa + 16 | 0;
    var $140 = HEAP32[$139 >> 2];
    if (($140 | 0) == 0) {
      var $R_1 = 0;
      __label__ = 33;
      break;
    } else {
      var $RP_0 = $139;
      var $R_0 = $140;
      __label__ = 28;
      break;
    }
   case 28:
    var $R_0;
    var $RP_0;
    var $142 = $R_0 + 20 | 0;
    var $143 = HEAP32[$142 >> 2];
    if (($143 | 0) == 0) {
      __label__ = 29;
      break;
    } else {
      var $RP_0 = $142;
      var $R_0 = $143;
      __label__ = 28;
      break;
    }
   case 29:
    var $146 = $R_0 + 16 | 0;
    var $147 = HEAPU32[$146 >> 2];
    if (($147 | 0) == 0) {
      __label__ = 30;
      break;
    } else {
      var $RP_0 = $146;
      var $R_0 = $147;
      __label__ = 28;
      break;
    }
   case 30:
    if ($RP_0 >>> 0 < $113 >>> 0) {
      __label__ = 32;
      break;
    } else {
      __label__ = 31;
      break;
    }
   case 31:
    HEAP32[$RP_0 >> 2] = 0;
    var $R_1 = $R_0;
    __label__ = 33;
    break;
   case 32:
    _abort();
    throw "Reached an unreachable!";
   case 33:
    var $R_1;
    if (($121 | 0) == 0) {
      __label__ = 53;
      break;
    } else {
      __label__ = 34;
      break;
    }
   case 34:
    var $157 = $v_3_lcssa + 28 | 0;
    var $159 = __gm_ + 304 + (HEAP32[$157 >> 2] << 2) | 0;
    if (($v_3_lcssa | 0) == (HEAP32[$159 >> 2] | 0)) {
      __label__ = 35;
      break;
    } else {
      __label__ = 37;
      break;
    }
   case 35:
    HEAP32[$159 >> 2] = $R_1;
    if (($R_1 | 0) == 0) {
      __label__ = 36;
      break;
    } else {
      __label__ = 43;
      break;
    }
   case 36:
    var $167 = HEAP32[__gm_ + 4 >> 2] & (1 << HEAP32[$157 >> 2] ^ -1);
    HEAP32[__gm_ + 4 >> 2] = $167;
    __label__ = 53;
    break;
   case 37:
    if ($121 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 41;
      break;
    } else {
      __label__ = 38;
      break;
    }
   case 38:
    var $173 = $121 + 16 | 0;
    if ((HEAP32[$173 >> 2] | 0) == ($v_3_lcssa | 0)) {
      __label__ = 39;
      break;
    } else {
      __label__ = 40;
      break;
    }
   case 39:
    HEAP32[$173 >> 2] = $R_1;
    __label__ = 42;
    break;
   case 40:
    HEAP32[$121 + 20 >> 2] = $R_1;
    __label__ = 42;
    break;
   case 41:
    _abort();
    throw "Reached an unreachable!";
   case 42:
    if (($R_1 | 0) == 0) {
      __label__ = 53;
      break;
    } else {
      __label__ = 43;
      break;
    }
   case 43:
    if ($R_1 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 52;
      break;
    } else {
      __label__ = 44;
      break;
    }
   case 44:
    HEAP32[$R_1 + 24 >> 2] = $121;
    var $189 = HEAPU32[$v_3_lcssa + 16 >> 2];
    if (($189 | 0) == 0) {
      __label__ = 48;
      break;
    } else {
      __label__ = 45;
      break;
    }
   case 45:
    if ($189 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 47;
      break;
    } else {
      __label__ = 46;
      break;
    }
   case 46:
    HEAP32[$R_1 + 16 >> 2] = $189;
    HEAP32[$189 + 24 >> 2] = $R_1;
    __label__ = 48;
    break;
   case 47:
    _abort();
    throw "Reached an unreachable!";
   case 48:
    var $201 = HEAPU32[$v_3_lcssa + 20 >> 2];
    if (($201 | 0) == 0) {
      __label__ = 53;
      break;
    } else {
      __label__ = 49;
      break;
    }
   case 49:
    if ($201 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 51;
      break;
    } else {
      __label__ = 50;
      break;
    }
   case 50:
    HEAP32[$R_1 + 20 >> 2] = $201;
    HEAP32[$201 + 24 >> 2] = $R_1;
    __label__ = 53;
    break;
   case 51:
    _abort();
    throw "Reached an unreachable!";
   case 52:
    _abort();
    throw "Reached an unreachable!";
   case 53:
    if ($rsize_3_lcssa >>> 0 < 16) {
      __label__ = 54;
      break;
    } else {
      __label__ = 55;
      break;
    }
   case 54:
    var $215 = $rsize_3_lcssa + $nb | 0;
    HEAP32[$v_3_lcssa + 4 >> 2] = $215 | 3;
    var $219 = $112 + ($215 + 4) | 0;
    var $221 = HEAP32[$219 >> 2] | 1;
    HEAP32[$219 >> 2] = $221;
    __label__ = 78;
    break;
   case 55:
    HEAP32[$v_3_lcssa + 4 >> 2] = $nb | 3;
    HEAP32[$112 + ($nb + 4) >> 2] = $rsize_3_lcssa | 1;
    HEAP32[$112 + ($rsize_3_lcssa + $nb) >> 2] = $rsize_3_lcssa;
    if ($rsize_3_lcssa >>> 0 < 256) {
      __label__ = 56;
      break;
    } else {
      __label__ = 61;
      break;
    }
   case 56:
    var $234 = $rsize_3_lcssa >>> 2 & 1073741822;
    var $236 = __gm_ + 40 + ($234 << 2) | 0;
    var $237 = HEAPU32[__gm_ >> 2];
    var $238 = 1 << ($rsize_3_lcssa >>> 3);
    if (($237 & $238 | 0) == 0) {
      __label__ = 57;
      break;
    } else {
      __label__ = 58;
      break;
    }
   case 57:
    HEAP32[__gm_ >> 2] = $237 | $238;
    var $F5_0 = $236;
    var $_pre_phi = __gm_ + 40 + ($234 + 2 << 2) | 0;
    __label__ = 60;
    break;
   case 58:
    var $244 = __gm_ + 40 + ($234 + 2 << 2) | 0;
    var $245 = HEAPU32[$244 >> 2];
    if ($245 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 59;
      break;
    } else {
      var $F5_0 = $245;
      var $_pre_phi = $244;
      __label__ = 60;
      break;
    }
   case 59:
    _abort();
    throw "Reached an unreachable!";
   case 60:
    var $_pre_phi;
    var $F5_0;
    HEAP32[$_pre_phi >> 2] = $117;
    HEAP32[$F5_0 + 12 >> 2] = $117;
    HEAP32[$112 + ($nb + 8) >> 2] = $F5_0;
    HEAP32[$112 + ($nb + 12) >> 2] = $236;
    __label__ = 78;
    break;
   case 61:
    var $257 = $116;
    var $258 = $rsize_3_lcssa >>> 8;
    if (($258 | 0) == 0) {
      var $I7_0 = 0;
      __label__ = 64;
      break;
    } else {
      __label__ = 62;
      break;
    }
   case 62:
    if ($rsize_3_lcssa >>> 0 > 16777215) {
      var $I7_0 = 31;
      __label__ = 64;
      break;
    } else {
      __label__ = 63;
      break;
    }
   case 63:
    var $265 = ($258 + 1048320 | 0) >>> 16 & 8;
    var $266 = $258 << $265;
    var $269 = ($266 + 520192 | 0) >>> 16 & 4;
    var $270 = $266 << $269;
    var $273 = ($270 + 245760 | 0) >>> 16 & 2;
    var $279 = 14 - ($269 | $265 | $273) + ($270 << $273 >>> 15) | 0;
    var $I7_0 = $rsize_3_lcssa >>> (($279 + 7 | 0) >>> 0) & 1 | $279 << 1;
    __label__ = 64;
    break;
   case 64:
    var $I7_0;
    var $286 = __gm_ + 304 + ($I7_0 << 2) | 0;
    HEAP32[$112 + ($nb + 28) >> 2] = $I7_0;
    var $289 = $112 + ($nb + 16) | 0;
    HEAP32[$112 + ($nb + 20) >> 2] = 0;
    HEAP32[$289 >> 2] = 0;
    var $293 = HEAP32[__gm_ + 4 >> 2];
    var $294 = 1 << $I7_0;
    if (($293 & $294 | 0) == 0) {
      __label__ = 65;
      break;
    } else {
      __label__ = 66;
      break;
    }
   case 65:
    var $298 = $293 | $294;
    HEAP32[__gm_ + 4 >> 2] = $298;
    HEAP32[$286 >> 2] = $257;
    HEAP32[$112 + ($nb + 24) >> 2] = $286;
    HEAP32[$112 + ($nb + 12) >> 2] = $257;
    HEAP32[$112 + ($nb + 8) >> 2] = $257;
    __label__ = 78;
    break;
   case 66:
    var $307 = HEAP32[$286 >> 2];
    if (($I7_0 | 0) == 31) {
      var $313 = 0;
      __label__ = 68;
      break;
    } else {
      __label__ = 67;
      break;
    }
   case 67:
    var $313 = 25 - ($I7_0 >>> 1) | 0;
    __label__ = 68;
    break;
   case 68:
    var $313;
    var $K12_0 = $rsize_3_lcssa << $313;
    var $T_0 = $307;
    __label__ = 69;
    break;
   case 69:
    var $T_0;
    var $K12_0;
    if ((HEAP32[$T_0 + 4 >> 2] & -8 | 0) == ($rsize_3_lcssa | 0)) {
      __label__ = 74;
      break;
    } else {
      __label__ = 70;
      break;
    }
   case 70:
    var $322 = $T_0 + 16 + ($K12_0 >>> 31 << 2) | 0;
    var $323 = HEAPU32[$322 >> 2];
    if (($323 | 0) == 0) {
      __label__ = 71;
      break;
    } else {
      var $K12_0 = $K12_0 << 1;
      var $T_0 = $323;
      __label__ = 69;
      break;
    }
   case 71:
    if ($322 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 73;
      break;
    } else {
      __label__ = 72;
      break;
    }
   case 72:
    HEAP32[$322 >> 2] = $257;
    HEAP32[$112 + ($nb + 24) >> 2] = $T_0;
    HEAP32[$112 + ($nb + 12) >> 2] = $257;
    HEAP32[$112 + ($nb + 8) >> 2] = $257;
    __label__ = 78;
    break;
   case 73:
    _abort();
    throw "Reached an unreachable!";
   case 74:
    var $339 = $T_0 + 8 | 0;
    var $340 = HEAPU32[$339 >> 2];
    var $342 = HEAPU32[__gm_ + 16 >> 2];
    if ($T_0 >>> 0 < $342 >>> 0) {
      __label__ = 77;
      break;
    } else {
      __label__ = 75;
      break;
    }
   case 75:
    if ($340 >>> 0 < $342 >>> 0) {
      __label__ = 77;
      break;
    } else {
      __label__ = 76;
      break;
    }
   case 76:
    HEAP32[$340 + 12 >> 2] = $257;
    HEAP32[$339 >> 2] = $257;
    HEAP32[$112 + ($nb + 8) >> 2] = $340;
    HEAP32[$112 + ($nb + 12) >> 2] = $T_0;
    HEAP32[$112 + ($nb + 24) >> 2] = 0;
    __label__ = 78;
    break;
   case 77:
    _abort();
    throw "Reached an unreachable!";
   case 78:
    var $_0 = $v_3_lcssa + 8 | 0;
    __label__ = 80;
    break;
   case 79:
    _abort();
    throw "Reached an unreachable!";
   case 80:
    var $_0;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

_tmalloc_large["X"] = 1;

function _release_unused_segments() {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $sp_0_in = __gm_ + 452 | 0;
    __label__ = 3;
    break;
   case 3:
    var $sp_0_in;
    var $sp_0 = HEAP32[$sp_0_in >> 2];
    var $3 = $sp_0 + 8 | 0;
    if (($sp_0 | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      var $sp_0_in = $3;
      __label__ = 3;
      break;
    }
   case 4:
    HEAP32[__gm_ + 32 >> 2] = -1;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function _sys_trim() {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if ((HEAP32[_mparams >> 2] | 0) == 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 3:
    _init_mparams();
    __label__ = 4;
    break;
   case 4:
    var $5 = HEAPU32[__gm_ + 24 >> 2];
    if (($5 | 0) == 0) {
      __label__ = 13;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    var $8 = HEAPU32[__gm_ + 12 >> 2];
    if ($8 >>> 0 > 40) {
      __label__ = 6;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 6:
    var $11 = HEAPU32[_mparams + 8 >> 2];
    var $13 = $8 - 41 + $11 | 0;
    var $14 = Math.floor(($13 >>> 0) / ($11 >>> 0));
    var $16 = ($14 - 1) * $11 | 0;
    var $17 = $5;
    var $18 = _segment_holding($17);
    if ((HEAP32[$18 + 12 >> 2] & 8 | 0) == 0) {
      __label__ = 7;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 7:
    var $24 = _sbrk(0);
    var $27 = $18 + 4 | 0;
    if (($24 | 0) == (HEAP32[$18 >> 2] + HEAP32[$27 >> 2] | 0)) {
      __label__ = 8;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 8:
    var $_ = $16 >>> 0 > 2147483646 ? -2147483648 - $11 | 0 : $16;
    var $34 = -$_ | 0;
    var $35 = _sbrk($34);
    var $36 = _sbrk(0);
    if (($35 | 0) != -1 & $36 >>> 0 < $24 >>> 0) {
      __label__ = 9;
      break;
    } else {
      __label__ = 11;
      break;
    }
   case 9:
    var $42 = $24 - $36 | 0;
    if (($24 | 0) == ($36 | 0)) {
      __label__ = 11;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 10:
    var $46 = HEAP32[$27 >> 2] - $42 | 0;
    HEAP32[$27 >> 2] = $46;
    var $48 = HEAP32[__gm_ + 432 >> 2] - $42 | 0;
    HEAP32[__gm_ + 432 >> 2] = $48;
    var $49 = HEAP32[__gm_ + 24 >> 2];
    var $51 = HEAP32[__gm_ + 12 >> 2] - $42 | 0;
    _init_top($49, $51);
    __label__ = 13;
    break;
   case 11:
    if (HEAPU32[__gm_ + 12 >> 2] >>> 0 > HEAPU32[__gm_ + 28 >> 2] >>> 0) {
      __label__ = 12;
      break;
    } else {
      __label__ = 13;
      break;
    }
   case 12:
    HEAP32[__gm_ + 28 >> 2] = -1;
    __label__ = 13;
    break;
   case 13:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

_sys_trim["X"] = 1;

function _free($mem) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if (($mem | 0) == 0) {
      __label__ = 128;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $3 = $mem - 8 | 0;
    var $4 = $3;
    var $5 = HEAPU32[__gm_ + 16 >> 2];
    if ($3 >>> 0 < $5 >>> 0) {
      __label__ = 127;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    var $10 = HEAPU32[$mem - 4 >> 2];
    var $11 = $10 & 3;
    if (($11 | 0) == 1) {
      __label__ = 127;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    var $14 = $10 & -8;
    var $15 = $mem + ($14 - 8) | 0;
    var $16 = $15;
    if (($10 & 1 | 0) == 0) {
      __label__ = 6;
      break;
    } else {
      var $p_0 = $4;
      var $psize_0 = $14;
      __label__ = 49;
      break;
    }
   case 6:
    var $21 = HEAPU32[$3 >> 2];
    if (($11 | 0) == 0) {
      __label__ = 128;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 7:
    var $_sum2 = -8 - $21 | 0;
    var $24 = $mem + $_sum2 | 0;
    var $25 = $24;
    var $26 = $21 + $14 | 0;
    if ($24 >>> 0 < $5 >>> 0) {
      __label__ = 127;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 8:
    if (($25 | 0) == (HEAP32[__gm_ + 20 >> 2] | 0)) {
      __label__ = 47;
      break;
    } else {
      __label__ = 9;
      break;
    }
   case 9:
    var $32 = $21 >>> 3;
    if ($21 >>> 0 < 256) {
      __label__ = 10;
      break;
    } else {
      __label__ = 16;
      break;
    }
   case 10:
    var $37 = HEAPU32[$mem + ($_sum2 + 8) >> 2];
    var $40 = HEAPU32[$mem + ($_sum2 + 12) >> 2];
    if (($37 | 0) == ($40 | 0)) {
      __label__ = 11;
      break;
    } else {
      __label__ = 12;
      break;
    }
   case 11:
    var $46 = HEAP32[__gm_ >> 2] & (1 << $32 ^ -1);
    HEAP32[__gm_ >> 2] = $46;
    var $p_0 = $25;
    var $psize_0 = $26;
    __label__ = 49;
    break;
   case 12:
    var $51 = __gm_ + 40 + (($21 >>> 2 & 1073741822) << 2) | 0;
    if (($37 | 0) != ($51 | 0) & $37 >>> 0 < $5 >>> 0) {
      __label__ = 15;
      break;
    } else {
      __label__ = 13;
      break;
    }
   case 13:
    if (($40 | 0) == ($51 | 0) | $40 >>> 0 >= $5 >>> 0) {
      __label__ = 14;
      break;
    } else {
      __label__ = 15;
      break;
    }
   case 14:
    HEAP32[$37 + 12 >> 2] = $40;
    HEAP32[$40 + 8 >> 2] = $37;
    var $p_0 = $25;
    var $psize_0 = $26;
    __label__ = 49;
    break;
   case 15:
    _abort();
    throw "Reached an unreachable!";
   case 16:
    var $62 = $24;
    var $65 = HEAPU32[$mem + ($_sum2 + 24) >> 2];
    var $68 = HEAPU32[$mem + ($_sum2 + 12) >> 2];
    if (($68 | 0) == ($62 | 0)) {
      __label__ = 20;
      break;
    } else {
      __label__ = 17;
      break;
    }
   case 17:
    var $73 = HEAPU32[$mem + ($_sum2 + 8) >> 2];
    if ($73 >>> 0 < $5 >>> 0) {
      __label__ = 19;
      break;
    } else {
      __label__ = 18;
      break;
    }
   case 18:
    HEAP32[$73 + 12 >> 2] = $68;
    HEAP32[$68 + 8 >> 2] = $73;
    var $R_1 = $68;
    __label__ = 27;
    break;
   case 19:
    _abort();
    throw "Reached an unreachable!";
   case 20:
    var $82 = $mem + ($_sum2 + 20) | 0;
    var $83 = HEAP32[$82 >> 2];
    if (($83 | 0) == 0) {
      __label__ = 21;
      break;
    } else {
      var $RP_0 = $82;
      var $R_0 = $83;
      __label__ = 22;
      break;
    }
   case 21:
    var $87 = $mem + ($_sum2 + 16) | 0;
    var $88 = HEAP32[$87 >> 2];
    if (($88 | 0) == 0) {
      var $R_1 = 0;
      __label__ = 27;
      break;
    } else {
      var $RP_0 = $87;
      var $R_0 = $88;
      __label__ = 22;
      break;
    }
   case 22:
    var $R_0;
    var $RP_0;
    var $90 = $R_0 + 20 | 0;
    var $91 = HEAP32[$90 >> 2];
    if (($91 | 0) == 0) {
      __label__ = 23;
      break;
    } else {
      var $RP_0 = $90;
      var $R_0 = $91;
      __label__ = 22;
      break;
    }
   case 23:
    var $94 = $R_0 + 16 | 0;
    var $95 = HEAPU32[$94 >> 2];
    if (($95 | 0) == 0) {
      __label__ = 24;
      break;
    } else {
      var $RP_0 = $94;
      var $R_0 = $95;
      __label__ = 22;
      break;
    }
   case 24:
    if ($RP_0 >>> 0 < $5 >>> 0) {
      __label__ = 26;
      break;
    } else {
      __label__ = 25;
      break;
    }
   case 25:
    HEAP32[$RP_0 >> 2] = 0;
    var $R_1 = $R_0;
    __label__ = 27;
    break;
   case 26:
    _abort();
    throw "Reached an unreachable!";
   case 27:
    var $R_1;
    if (($65 | 0) == 0) {
      var $p_0 = $25;
      var $psize_0 = $26;
      __label__ = 49;
      break;
    } else {
      __label__ = 28;
      break;
    }
   case 28:
    var $106 = $mem + ($_sum2 + 28) | 0;
    var $108 = __gm_ + 304 + (HEAP32[$106 >> 2] << 2) | 0;
    if (($62 | 0) == (HEAP32[$108 >> 2] | 0)) {
      __label__ = 29;
      break;
    } else {
      __label__ = 31;
      break;
    }
   case 29:
    HEAP32[$108 >> 2] = $R_1;
    if (($R_1 | 0) == 0) {
      __label__ = 30;
      break;
    } else {
      __label__ = 37;
      break;
    }
   case 30:
    var $116 = HEAP32[__gm_ + 4 >> 2] & (1 << HEAP32[$106 >> 2] ^ -1);
    HEAP32[__gm_ + 4 >> 2] = $116;
    var $p_0 = $25;
    var $psize_0 = $26;
    __label__ = 49;
    break;
   case 31:
    if ($65 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 35;
      break;
    } else {
      __label__ = 32;
      break;
    }
   case 32:
    var $122 = $65 + 16 | 0;
    if ((HEAP32[$122 >> 2] | 0) == ($62 | 0)) {
      __label__ = 33;
      break;
    } else {
      __label__ = 34;
      break;
    }
   case 33:
    HEAP32[$122 >> 2] = $R_1;
    __label__ = 36;
    break;
   case 34:
    HEAP32[$65 + 20 >> 2] = $R_1;
    __label__ = 36;
    break;
   case 35:
    _abort();
    throw "Reached an unreachable!";
   case 36:
    if (($R_1 | 0) == 0) {
      var $p_0 = $25;
      var $psize_0 = $26;
      __label__ = 49;
      break;
    } else {
      __label__ = 37;
      break;
    }
   case 37:
    if ($R_1 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 46;
      break;
    } else {
      __label__ = 38;
      break;
    }
   case 38:
    HEAP32[$R_1 + 24 >> 2] = $65;
    var $139 = HEAPU32[$mem + ($_sum2 + 16) >> 2];
    if (($139 | 0) == 0) {
      __label__ = 42;
      break;
    } else {
      __label__ = 39;
      break;
    }
   case 39:
    if ($139 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 41;
      break;
    } else {
      __label__ = 40;
      break;
    }
   case 40:
    HEAP32[$R_1 + 16 >> 2] = $139;
    HEAP32[$139 + 24 >> 2] = $R_1;
    __label__ = 42;
    break;
   case 41:
    _abort();
    throw "Reached an unreachable!";
   case 42:
    var $152 = HEAPU32[$mem + ($_sum2 + 20) >> 2];
    if (($152 | 0) == 0) {
      var $p_0 = $25;
      var $psize_0 = $26;
      __label__ = 49;
      break;
    } else {
      __label__ = 43;
      break;
    }
   case 43:
    if ($152 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 45;
      break;
    } else {
      __label__ = 44;
      break;
    }
   case 44:
    HEAP32[$R_1 + 20 >> 2] = $152;
    HEAP32[$152 + 24 >> 2] = $R_1;
    var $p_0 = $25;
    var $psize_0 = $26;
    __label__ = 49;
    break;
   case 45:
    _abort();
    throw "Reached an unreachable!";
   case 46:
    _abort();
    throw "Reached an unreachable!";
   case 47:
    var $165 = $mem + ($14 - 4) | 0;
    if ((HEAP32[$165 >> 2] & 3 | 0) == 3) {
      __label__ = 48;
      break;
    } else {
      var $p_0 = $25;
      var $psize_0 = $26;
      __label__ = 49;
      break;
    }
   case 48:
    HEAP32[__gm_ + 8 >> 2] = $26;
    var $171 = HEAP32[$165 >> 2] & -2;
    HEAP32[$165 >> 2] = $171;
    HEAP32[$mem + ($_sum2 + 4) >> 2] = $26 | 1;
    HEAP32[$15 >> 2] = $26;
    __label__ = 128;
    break;
   case 49:
    var $psize_0;
    var $p_0;
    var $177 = $p_0;
    if ($177 >>> 0 < $15 >>> 0) {
      __label__ = 50;
      break;
    } else {
      __label__ = 127;
      break;
    }
   case 50:
    var $181 = $mem + ($14 - 4) | 0;
    var $182 = HEAPU32[$181 >> 2];
    if (($182 & 1 | 0) == 0) {
      __label__ = 127;
      break;
    } else {
      __label__ = 51;
      break;
    }
   case 51:
    if (($182 & 2 | 0) == 0) {
      __label__ = 52;
      break;
    } else {
      __label__ = 101;
      break;
    }
   case 52:
    if (($16 | 0) == (HEAP32[__gm_ + 24 >> 2] | 0)) {
      __label__ = 53;
      break;
    } else {
      __label__ = 57;
      break;
    }
   case 53:
    var $193 = HEAP32[__gm_ + 12 >> 2] + $psize_0 | 0;
    HEAP32[__gm_ + 12 >> 2] = $193;
    HEAP32[__gm_ + 24 >> 2] = $p_0;
    var $194 = $193 | 1;
    HEAP32[$p_0 + 4 >> 2] = $194;
    if (($p_0 | 0) == (HEAP32[__gm_ + 20 >> 2] | 0)) {
      __label__ = 54;
      break;
    } else {
      __label__ = 55;
      break;
    }
   case 54:
    HEAP32[__gm_ + 20 >> 2] = 0;
    HEAP32[__gm_ + 8 >> 2] = 0;
    __label__ = 55;
    break;
   case 55:
    if ($193 >>> 0 > HEAPU32[__gm_ + 28 >> 2] >>> 0) {
      __label__ = 56;
      break;
    } else {
      __label__ = 128;
      break;
    }
   case 56:
    _sys_trim();
    __label__ = 128;
    break;
   case 57:
    if (($16 | 0) == (HEAP32[__gm_ + 20 >> 2] | 0)) {
      __label__ = 58;
      break;
    } else {
      __label__ = 59;
      break;
    }
   case 58:
    var $208 = HEAP32[__gm_ + 8 >> 2] + $psize_0 | 0;
    HEAP32[__gm_ + 8 >> 2] = $208;
    HEAP32[__gm_ + 20 >> 2] = $p_0;
    var $209 = $208 | 1;
    HEAP32[$p_0 + 4 >> 2] = $209;
    var $212 = $177 + $208 | 0;
    HEAP32[$212 >> 2] = $208;
    __label__ = 128;
    break;
   case 59:
    var $215 = ($182 & -8) + $psize_0 | 0;
    var $216 = $182 >>> 3;
    if ($182 >>> 0 < 256) {
      __label__ = 60;
      break;
    } else {
      __label__ = 68;
      break;
    }
   case 60:
    var $221 = HEAPU32[$mem + $14 >> 2];
    var $224 = HEAPU32[$mem + ($14 | 4) >> 2];
    if (($221 | 0) == ($224 | 0)) {
      __label__ = 61;
      break;
    } else {
      __label__ = 62;
      break;
    }
   case 61:
    var $230 = HEAP32[__gm_ >> 2] & (1 << $216 ^ -1);
    HEAP32[__gm_ >> 2] = $230;
    __label__ = 99;
    break;
   case 62:
    var $235 = __gm_ + 40 + (($182 >>> 2 & 1073741822) << 2) | 0;
    if (($221 | 0) == ($235 | 0)) {
      __label__ = 64;
      break;
    } else {
      __label__ = 63;
      break;
    }
   case 63:
    if ($221 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 67;
      break;
    } else {
      __label__ = 64;
      break;
    }
   case 64:
    if (($224 | 0) == ($235 | 0)) {
      __label__ = 66;
      break;
    } else {
      __label__ = 65;
      break;
    }
   case 65:
    if ($224 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 67;
      break;
    } else {
      __label__ = 66;
      break;
    }
   case 66:
    HEAP32[$221 + 12 >> 2] = $224;
    HEAP32[$224 + 8 >> 2] = $221;
    __label__ = 99;
    break;
   case 67:
    _abort();
    throw "Reached an unreachable!";
   case 68:
    var $250 = $15;
    var $253 = HEAPU32[$mem + ($14 + 16) >> 2];
    var $256 = HEAPU32[$mem + ($14 | 4) >> 2];
    if (($256 | 0) == ($250 | 0)) {
      __label__ = 72;
      break;
    } else {
      __label__ = 69;
      break;
    }
   case 69:
    var $261 = HEAPU32[$mem + $14 >> 2];
    if ($261 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 71;
      break;
    } else {
      __label__ = 70;
      break;
    }
   case 70:
    HEAP32[$261 + 12 >> 2] = $256;
    HEAP32[$256 + 8 >> 2] = $261;
    var $R7_1 = $256;
    __label__ = 79;
    break;
   case 71:
    _abort();
    throw "Reached an unreachable!";
   case 72:
    var $271 = $mem + ($14 + 12) | 0;
    var $272 = HEAP32[$271 >> 2];
    if (($272 | 0) == 0) {
      __label__ = 73;
      break;
    } else {
      var $RP9_0 = $271;
      var $R7_0 = $272;
      __label__ = 74;
      break;
    }
   case 73:
    var $276 = $mem + ($14 + 8) | 0;
    var $277 = HEAP32[$276 >> 2];
    if (($277 | 0) == 0) {
      var $R7_1 = 0;
      __label__ = 79;
      break;
    } else {
      var $RP9_0 = $276;
      var $R7_0 = $277;
      __label__ = 74;
      break;
    }
   case 74:
    var $R7_0;
    var $RP9_0;
    var $279 = $R7_0 + 20 | 0;
    var $280 = HEAP32[$279 >> 2];
    if (($280 | 0) == 0) {
      __label__ = 75;
      break;
    } else {
      var $RP9_0 = $279;
      var $R7_0 = $280;
      __label__ = 74;
      break;
    }
   case 75:
    var $283 = $R7_0 + 16 | 0;
    var $284 = HEAPU32[$283 >> 2];
    if (($284 | 0) == 0) {
      __label__ = 76;
      break;
    } else {
      var $RP9_0 = $283;
      var $R7_0 = $284;
      __label__ = 74;
      break;
    }
   case 76:
    if ($RP9_0 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 78;
      break;
    } else {
      __label__ = 77;
      break;
    }
   case 77:
    HEAP32[$RP9_0 >> 2] = 0;
    var $R7_1 = $R7_0;
    __label__ = 79;
    break;
   case 78:
    _abort();
    throw "Reached an unreachable!";
   case 79:
    var $R7_1;
    if (($253 | 0) == 0) {
      __label__ = 99;
      break;
    } else {
      __label__ = 80;
      break;
    }
   case 80:
    var $296 = $mem + ($14 + 20) | 0;
    var $298 = __gm_ + 304 + (HEAP32[$296 >> 2] << 2) | 0;
    if (($250 | 0) == (HEAP32[$298 >> 2] | 0)) {
      __label__ = 81;
      break;
    } else {
      __label__ = 83;
      break;
    }
   case 81:
    HEAP32[$298 >> 2] = $R7_1;
    if (($R7_1 | 0) == 0) {
      __label__ = 82;
      break;
    } else {
      __label__ = 89;
      break;
    }
   case 82:
    var $306 = HEAP32[__gm_ + 4 >> 2] & (1 << HEAP32[$296 >> 2] ^ -1);
    HEAP32[__gm_ + 4 >> 2] = $306;
    __label__ = 99;
    break;
   case 83:
    if ($253 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 87;
      break;
    } else {
      __label__ = 84;
      break;
    }
   case 84:
    var $312 = $253 + 16 | 0;
    if ((HEAP32[$312 >> 2] | 0) == ($250 | 0)) {
      __label__ = 85;
      break;
    } else {
      __label__ = 86;
      break;
    }
   case 85:
    HEAP32[$312 >> 2] = $R7_1;
    __label__ = 88;
    break;
   case 86:
    HEAP32[$253 + 20 >> 2] = $R7_1;
    __label__ = 88;
    break;
   case 87:
    _abort();
    throw "Reached an unreachable!";
   case 88:
    if (($R7_1 | 0) == 0) {
      __label__ = 99;
      break;
    } else {
      __label__ = 89;
      break;
    }
   case 89:
    if ($R7_1 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 98;
      break;
    } else {
      __label__ = 90;
      break;
    }
   case 90:
    HEAP32[$R7_1 + 24 >> 2] = $253;
    var $329 = HEAPU32[$mem + ($14 + 8) >> 2];
    if (($329 | 0) == 0) {
      __label__ = 94;
      break;
    } else {
      __label__ = 91;
      break;
    }
   case 91:
    if ($329 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 93;
      break;
    } else {
      __label__ = 92;
      break;
    }
   case 92:
    HEAP32[$R7_1 + 16 >> 2] = $329;
    HEAP32[$329 + 24 >> 2] = $R7_1;
    __label__ = 94;
    break;
   case 93:
    _abort();
    throw "Reached an unreachable!";
   case 94:
    var $342 = HEAPU32[$mem + ($14 + 12) >> 2];
    if (($342 | 0) == 0) {
      __label__ = 99;
      break;
    } else {
      __label__ = 95;
      break;
    }
   case 95:
    if ($342 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 97;
      break;
    } else {
      __label__ = 96;
      break;
    }
   case 96:
    HEAP32[$R7_1 + 20 >> 2] = $342;
    HEAP32[$342 + 24 >> 2] = $R7_1;
    __label__ = 99;
    break;
   case 97:
    _abort();
    throw "Reached an unreachable!";
   case 98:
    _abort();
    throw "Reached an unreachable!";
   case 99:
    HEAP32[$p_0 + 4 >> 2] = $215 | 1;
    HEAP32[$177 + $215 >> 2] = $215;
    if (($p_0 | 0) == (HEAP32[__gm_ + 20 >> 2] | 0)) {
      __label__ = 100;
      break;
    } else {
      var $psize_1 = $215;
      __label__ = 102;
      break;
    }
   case 100:
    HEAP32[__gm_ + 8 >> 2] = $215;
    __label__ = 128;
    break;
   case 101:
    HEAP32[$181 >> 2] = $182 & -2;
    HEAP32[$p_0 + 4 >> 2] = $psize_0 | 1;
    HEAP32[$177 + $psize_0 >> 2] = $psize_0;
    var $psize_1 = $psize_0;
    __label__ = 102;
    break;
   case 102:
    var $psize_1;
    if ($psize_1 >>> 0 < 256) {
      __label__ = 103;
      break;
    } else {
      __label__ = 108;
      break;
    }
   case 103:
    var $372 = $psize_1 >>> 2 & 1073741822;
    var $374 = __gm_ + 40 + ($372 << 2) | 0;
    var $375 = HEAPU32[__gm_ >> 2];
    var $376 = 1 << ($psize_1 >>> 3);
    if (($375 & $376 | 0) == 0) {
      __label__ = 104;
      break;
    } else {
      __label__ = 105;
      break;
    }
   case 104:
    HEAP32[__gm_ >> 2] = $375 | $376;
    var $F16_0 = $374;
    var $_pre_phi = __gm_ + 40 + ($372 + 2 << 2) | 0;
    __label__ = 107;
    break;
   case 105:
    var $382 = __gm_ + 40 + ($372 + 2 << 2) | 0;
    var $383 = HEAPU32[$382 >> 2];
    if ($383 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 106;
      break;
    } else {
      var $F16_0 = $383;
      var $_pre_phi = $382;
      __label__ = 107;
      break;
    }
   case 106:
    _abort();
    throw "Reached an unreachable!";
   case 107:
    var $_pre_phi;
    var $F16_0;
    HEAP32[$_pre_phi >> 2] = $p_0;
    HEAP32[$F16_0 + 12 >> 2] = $p_0;
    HEAP32[$p_0 + 8 >> 2] = $F16_0;
    HEAP32[$p_0 + 12 >> 2] = $374;
    __label__ = 128;
    break;
   case 108:
    var $393 = $p_0;
    var $394 = $psize_1 >>> 8;
    if (($394 | 0) == 0) {
      var $I18_0 = 0;
      __label__ = 111;
      break;
    } else {
      __label__ = 109;
      break;
    }
   case 109:
    if ($psize_1 >>> 0 > 16777215) {
      var $I18_0 = 31;
      __label__ = 111;
      break;
    } else {
      __label__ = 110;
      break;
    }
   case 110:
    var $401 = ($394 + 1048320 | 0) >>> 16 & 8;
    var $402 = $394 << $401;
    var $405 = ($402 + 520192 | 0) >>> 16 & 4;
    var $406 = $402 << $405;
    var $409 = ($406 + 245760 | 0) >>> 16 & 2;
    var $415 = 14 - ($405 | $401 | $409) + ($406 << $409 >>> 15) | 0;
    var $I18_0 = $psize_1 >>> (($415 + 7 | 0) >>> 0) & 1 | $415 << 1;
    __label__ = 111;
    break;
   case 111:
    var $I18_0;
    var $422 = __gm_ + 304 + ($I18_0 << 2) | 0;
    HEAP32[$p_0 + 28 >> 2] = $I18_0;
    HEAP32[$p_0 + 20 >> 2] = 0;
    HEAP32[$p_0 + 16 >> 2] = 0;
    var $426 = HEAP32[__gm_ + 4 >> 2];
    var $427 = 1 << $I18_0;
    if (($426 & $427 | 0) == 0) {
      __label__ = 112;
      break;
    } else {
      __label__ = 113;
      break;
    }
   case 112:
    var $431 = $426 | $427;
    HEAP32[__gm_ + 4 >> 2] = $431;
    HEAP32[$422 >> 2] = $393;
    HEAP32[$p_0 + 24 >> 2] = $422;
    HEAP32[$p_0 + 12 >> 2] = $p_0;
    HEAP32[$p_0 + 8 >> 2] = $p_0;
    __label__ = 125;
    break;
   case 113:
    var $436 = HEAP32[$422 >> 2];
    if (($I18_0 | 0) == 31) {
      var $442 = 0;
      __label__ = 115;
      break;
    } else {
      __label__ = 114;
      break;
    }
   case 114:
    var $442 = 25 - ($I18_0 >>> 1) | 0;
    __label__ = 115;
    break;
   case 115:
    var $442;
    var $K19_0 = $psize_1 << $442;
    var $T_0 = $436;
    __label__ = 116;
    break;
   case 116:
    var $T_0;
    var $K19_0;
    if ((HEAP32[$T_0 + 4 >> 2] & -8 | 0) == ($psize_1 | 0)) {
      __label__ = 121;
      break;
    } else {
      __label__ = 117;
      break;
    }
   case 117:
    var $451 = $T_0 + 16 + ($K19_0 >>> 31 << 2) | 0;
    var $452 = HEAPU32[$451 >> 2];
    if (($452 | 0) == 0) {
      __label__ = 118;
      break;
    } else {
      var $K19_0 = $K19_0 << 1;
      var $T_0 = $452;
      __label__ = 116;
      break;
    }
   case 118:
    if ($451 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 120;
      break;
    } else {
      __label__ = 119;
      break;
    }
   case 119:
    HEAP32[$451 >> 2] = $393;
    HEAP32[$p_0 + 24 >> 2] = $T_0;
    HEAP32[$p_0 + 12 >> 2] = $p_0;
    HEAP32[$p_0 + 8 >> 2] = $p_0;
    __label__ = 125;
    break;
   case 120:
    _abort();
    throw "Reached an unreachable!";
   case 121:
    var $465 = $T_0 + 8 | 0;
    var $466 = HEAPU32[$465 >> 2];
    var $468 = HEAPU32[__gm_ + 16 >> 2];
    if ($T_0 >>> 0 < $468 >>> 0) {
      __label__ = 124;
      break;
    } else {
      __label__ = 122;
      break;
    }
   case 122:
    if ($466 >>> 0 < $468 >>> 0) {
      __label__ = 124;
      break;
    } else {
      __label__ = 123;
      break;
    }
   case 123:
    HEAP32[$466 + 12 >> 2] = $393;
    HEAP32[$465 >> 2] = $393;
    HEAP32[$p_0 + 8 >> 2] = $466;
    HEAP32[$p_0 + 12 >> 2] = $T_0;
    HEAP32[$p_0 + 24 >> 2] = 0;
    __label__ = 125;
    break;
   case 124:
    _abort();
    throw "Reached an unreachable!";
   case 125:
    var $480 = HEAP32[__gm_ + 32 >> 2] - 1 | 0;
    HEAP32[__gm_ + 32 >> 2] = $480;
    if (($480 | 0) == 0) {
      __label__ = 126;
      break;
    } else {
      __label__ = 128;
      break;
    }
   case 126:
    _release_unused_segments();
    __label__ = 128;
    break;
   case 127:
    _abort();
    throw "Reached an unreachable!";
   case 128:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

Module["_free"] = _free;

_free["X"] = 1;

function _segment_holding($addr) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $sp_0 = __gm_ + 444 | 0;
    __label__ = 3;
    break;
   case 3:
    var $sp_0;
    var $3 = HEAPU32[$sp_0 >> 2];
    if ($3 >>> 0 > $addr >>> 0) {
      __label__ = 5;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    if (($3 + HEAP32[$sp_0 + 4 >> 2] | 0) >>> 0 > $addr >>> 0) {
      var $_0 = $sp_0;
      __label__ = 6;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    var $12 = HEAPU32[$sp_0 + 8 >> 2];
    if (($12 | 0) == 0) {
      var $_0 = 0;
      __label__ = 6;
      break;
    } else {
      var $sp_0 = $12;
      __label__ = 3;
      break;
    }
   case 6:
    var $_0;
    return $_0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function _init_top($p, $psize) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = $p;
    var $3 = $p + 8 | 0;
    if (($3 & 7 | 0) == 0) {
      var $10 = 0;
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $10 = -$3 & 7;
    __label__ = 4;
    break;
   case 4:
    var $10;
    var $13 = $psize - $10 | 0;
    HEAP32[__gm_ + 24 >> 2] = $1 + $10 | 0;
    HEAP32[__gm_ + 12 >> 2] = $13;
    HEAP32[$1 + ($10 + 4) >> 2] = $13 | 1;
    HEAP32[$1 + ($psize + 4) >> 2] = 40;
    var $19 = HEAP32[_mparams + 16 >> 2];
    HEAP32[__gm_ + 28 >> 2] = $19;
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function _init_bins() {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $i_02 = 0;
    __label__ = 3;
    break;
   case 3:
    var $i_02;
    var $2 = $i_02 << 1;
    var $4 = __gm_ + 40 + ($2 << 2) | 0;
    HEAP32[__gm_ + 40 + ($2 + 3 << 2) >> 2] = $4;
    HEAP32[__gm_ + 40 + ($2 + 2 << 2) >> 2] = $4;
    var $7 = $i_02 + 1 | 0;
    if (($7 | 0) == 32) {
      __label__ = 4;
      break;
    } else {
      var $i_02 = $7;
      __label__ = 3;
      break;
    }
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function __ZdlPv($ptr) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if (($ptr | 0) == 0) {
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    _free($ptr);
    __label__ = 4;
    break;
   case 4:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function _init_mparams() {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    if ((HEAP32[_mparams >> 2] | 0) == 0) {
      __label__ = 3;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 3:
    var $4 = _sysconf(8);
    if (($4 - 1 & $4 | 0) == 0) {
      __label__ = 5;
      break;
    } else {
      __label__ = 4;
      break;
    }
   case 4:
    _abort();
    throw "Reached an unreachable!";
   case 5:
    HEAP32[_mparams + 8 >> 2] = $4;
    HEAP32[_mparams + 4 >> 2] = $4;
    HEAP32[_mparams + 12 >> 2] = -1;
    HEAP32[_mparams + 16 >> 2] = 2097152;
    HEAP32[_mparams + 20 >> 2] = 0;
    HEAP32[__gm_ + 440 >> 2] = 0;
    var $10 = _time(0);
    HEAP32[_mparams >> 2] = $10 & -16 ^ 1431655768;
    __label__ = 6;
    break;
   case 6:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

function _prepend_alloc($newbase, $oldbase, $nb) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $2 = $newbase + 8 | 0;
    if (($2 & 7 | 0) == 0) {
      var $9 = 0;
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $9 = -$2 & 7;
    __label__ = 4;
    break;
   case 4:
    var $9;
    var $10 = $newbase + $9 | 0;
    var $12 = $oldbase + 8 | 0;
    if (($12 & 7 | 0) == 0) {
      var $19 = 0;
      __label__ = 6;
      break;
    } else {
      __label__ = 5;
      break;
    }
   case 5:
    var $19 = -$12 & 7;
    __label__ = 6;
    break;
   case 6:
    var $19;
    var $20 = $oldbase + $19 | 0;
    var $21 = $20;
    var $_sum = $9 + $nb | 0;
    var $25 = $newbase + $_sum | 0;
    var $26 = $25;
    var $27 = $20 - $10 - $nb | 0;
    HEAP32[$newbase + ($9 + 4) >> 2] = $nb | 3;
    if (($21 | 0) == (HEAP32[__gm_ + 24 >> 2] | 0)) {
      __label__ = 7;
      break;
    } else {
      __label__ = 8;
      break;
    }
   case 7:
    var $35 = HEAP32[__gm_ + 12 >> 2] + $27 | 0;
    HEAP32[__gm_ + 12 >> 2] = $35;
    HEAP32[__gm_ + 24 >> 2] = $26;
    var $36 = $35 | 1;
    HEAP32[$newbase + ($_sum + 4) >> 2] = $36;
    __label__ = 75;
    break;
   case 8:
    if (($21 | 0) == (HEAP32[__gm_ + 20 >> 2] | 0)) {
      __label__ = 9;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 9:
    var $44 = HEAP32[__gm_ + 8 >> 2] + $27 | 0;
    HEAP32[__gm_ + 8 >> 2] = $44;
    HEAP32[__gm_ + 20 >> 2] = $26;
    var $45 = $44 | 1;
    HEAP32[$newbase + ($_sum + 4) >> 2] = $45;
    var $49 = $newbase + ($44 + $_sum) | 0;
    HEAP32[$49 >> 2] = $44;
    __label__ = 75;
    break;
   case 10:
    var $53 = HEAPU32[$oldbase + ($19 + 4) >> 2];
    if (($53 & 3 | 0) == 1) {
      __label__ = 11;
      break;
    } else {
      var $oldfirst_0 = $21;
      var $qsize_0 = $27;
      __label__ = 52;
      break;
    }
   case 11:
    var $57 = $53 & -8;
    var $58 = $53 >>> 3;
    if ($53 >>> 0 < 256) {
      __label__ = 12;
      break;
    } else {
      __label__ = 20;
      break;
    }
   case 12:
    var $63 = HEAPU32[$oldbase + ($19 | 8) >> 2];
    var $66 = HEAPU32[$oldbase + ($19 + 12) >> 2];
    if (($63 | 0) == ($66 | 0)) {
      __label__ = 13;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 13:
    var $72 = HEAP32[__gm_ >> 2] & (1 << $58 ^ -1);
    HEAP32[__gm_ >> 2] = $72;
    __label__ = 51;
    break;
   case 14:
    var $77 = __gm_ + 40 + (($53 >>> 2 & 1073741822) << 2) | 0;
    if (($63 | 0) == ($77 | 0)) {
      __label__ = 16;
      break;
    } else {
      __label__ = 15;
      break;
    }
   case 15:
    if ($63 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 19;
      break;
    } else {
      __label__ = 16;
      break;
    }
   case 16:
    if (($66 | 0) == ($77 | 0)) {
      __label__ = 18;
      break;
    } else {
      __label__ = 17;
      break;
    }
   case 17:
    if ($66 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 19;
      break;
    } else {
      __label__ = 18;
      break;
    }
   case 18:
    HEAP32[$63 + 12 >> 2] = $66;
    HEAP32[$66 + 8 >> 2] = $63;
    __label__ = 51;
    break;
   case 19:
    _abort();
    throw "Reached an unreachable!";
   case 20:
    var $92 = $20;
    var $95 = HEAPU32[$oldbase + ($19 | 24) >> 2];
    var $98 = HEAPU32[$oldbase + ($19 + 12) >> 2];
    if (($98 | 0) == ($92 | 0)) {
      __label__ = 24;
      break;
    } else {
      __label__ = 21;
      break;
    }
   case 21:
    var $103 = HEAPU32[$oldbase + ($19 | 8) >> 2];
    if ($103 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 23;
      break;
    } else {
      __label__ = 22;
      break;
    }
   case 22:
    HEAP32[$103 + 12 >> 2] = $98;
    HEAP32[$98 + 8 >> 2] = $103;
    var $R_1 = $98;
    __label__ = 31;
    break;
   case 23:
    _abort();
    throw "Reached an unreachable!";
   case 24:
    var $_sum67 = $19 | 16;
    var $113 = $oldbase + ($_sum67 + 4) | 0;
    var $114 = HEAP32[$113 >> 2];
    if (($114 | 0) == 0) {
      __label__ = 25;
      break;
    } else {
      var $RP_0 = $113;
      var $R_0 = $114;
      __label__ = 26;
      break;
    }
   case 25:
    var $118 = $oldbase + $_sum67 | 0;
    var $119 = HEAP32[$118 >> 2];
    if (($119 | 0) == 0) {
      var $R_1 = 0;
      __label__ = 31;
      break;
    } else {
      var $RP_0 = $118;
      var $R_0 = $119;
      __label__ = 26;
      break;
    }
   case 26:
    var $R_0;
    var $RP_0;
    var $121 = $R_0 + 20 | 0;
    var $122 = HEAP32[$121 >> 2];
    if (($122 | 0) == 0) {
      __label__ = 27;
      break;
    } else {
      var $RP_0 = $121;
      var $R_0 = $122;
      __label__ = 26;
      break;
    }
   case 27:
    var $125 = $R_0 + 16 | 0;
    var $126 = HEAPU32[$125 >> 2];
    if (($126 | 0) == 0) {
      __label__ = 28;
      break;
    } else {
      var $RP_0 = $125;
      var $R_0 = $126;
      __label__ = 26;
      break;
    }
   case 28:
    if ($RP_0 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 30;
      break;
    } else {
      __label__ = 29;
      break;
    }
   case 29:
    HEAP32[$RP_0 >> 2] = 0;
    var $R_1 = $R_0;
    __label__ = 31;
    break;
   case 30:
    _abort();
    throw "Reached an unreachable!";
   case 31:
    var $R_1;
    if (($95 | 0) == 0) {
      __label__ = 51;
      break;
    } else {
      __label__ = 32;
      break;
    }
   case 32:
    var $138 = $oldbase + ($19 + 28) | 0;
    var $140 = __gm_ + 304 + (HEAP32[$138 >> 2] << 2) | 0;
    if (($92 | 0) == (HEAP32[$140 >> 2] | 0)) {
      __label__ = 33;
      break;
    } else {
      __label__ = 35;
      break;
    }
   case 33:
    HEAP32[$140 >> 2] = $R_1;
    if (($R_1 | 0) == 0) {
      __label__ = 34;
      break;
    } else {
      __label__ = 41;
      break;
    }
   case 34:
    var $148 = HEAP32[__gm_ + 4 >> 2] & (1 << HEAP32[$138 >> 2] ^ -1);
    HEAP32[__gm_ + 4 >> 2] = $148;
    __label__ = 51;
    break;
   case 35:
    if ($95 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 39;
      break;
    } else {
      __label__ = 36;
      break;
    }
   case 36:
    var $154 = $95 + 16 | 0;
    if ((HEAP32[$154 >> 2] | 0) == ($92 | 0)) {
      __label__ = 37;
      break;
    } else {
      __label__ = 38;
      break;
    }
   case 37:
    HEAP32[$154 >> 2] = $R_1;
    __label__ = 40;
    break;
   case 38:
    HEAP32[$95 + 20 >> 2] = $R_1;
    __label__ = 40;
    break;
   case 39:
    _abort();
    throw "Reached an unreachable!";
   case 40:
    if (($R_1 | 0) == 0) {
      __label__ = 51;
      break;
    } else {
      __label__ = 41;
      break;
    }
   case 41:
    if ($R_1 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 50;
      break;
    } else {
      __label__ = 42;
      break;
    }
   case 42:
    HEAP32[$R_1 + 24 >> 2] = $95;
    var $_sum3132 = $19 | 16;
    var $171 = HEAPU32[$oldbase + $_sum3132 >> 2];
    if (($171 | 0) == 0) {
      __label__ = 46;
      break;
    } else {
      __label__ = 43;
      break;
    }
   case 43:
    if ($171 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 45;
      break;
    } else {
      __label__ = 44;
      break;
    }
   case 44:
    HEAP32[$R_1 + 16 >> 2] = $171;
    HEAP32[$171 + 24 >> 2] = $R_1;
    __label__ = 46;
    break;
   case 45:
    _abort();
    throw "Reached an unreachable!";
   case 46:
    var $184 = HEAPU32[$oldbase + ($_sum3132 + 4) >> 2];
    if (($184 | 0) == 0) {
      __label__ = 51;
      break;
    } else {
      __label__ = 47;
      break;
    }
   case 47:
    if ($184 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 49;
      break;
    } else {
      __label__ = 48;
      break;
    }
   case 48:
    HEAP32[$R_1 + 20 >> 2] = $184;
    HEAP32[$184 + 24 >> 2] = $R_1;
    __label__ = 51;
    break;
   case 49:
    _abort();
    throw "Reached an unreachable!";
   case 50:
    _abort();
    throw "Reached an unreachable!";
   case 51:
    var $oldfirst_0 = $oldbase + ($57 | $19) | 0;
    var $qsize_0 = $57 + $27 | 0;
    __label__ = 52;
    break;
   case 52:
    var $qsize_0;
    var $oldfirst_0;
    var $200 = $oldfirst_0 + 4 | 0;
    var $202 = HEAP32[$200 >> 2] & -2;
    HEAP32[$200 >> 2] = $202;
    HEAP32[$newbase + ($_sum + 4) >> 2] = $qsize_0 | 1;
    HEAP32[$newbase + ($qsize_0 + $_sum) >> 2] = $qsize_0;
    if ($qsize_0 >>> 0 < 256) {
      __label__ = 53;
      break;
    } else {
      __label__ = 58;
      break;
    }
   case 53:
    var $212 = $qsize_0 >>> 2 & 1073741822;
    var $214 = __gm_ + 40 + ($212 << 2) | 0;
    var $215 = HEAPU32[__gm_ >> 2];
    var $216 = 1 << ($qsize_0 >>> 3);
    if (($215 & $216 | 0) == 0) {
      __label__ = 54;
      break;
    } else {
      __label__ = 55;
      break;
    }
   case 54:
    HEAP32[__gm_ >> 2] = $215 | $216;
    var $F4_0 = $214;
    var $_pre_phi = __gm_ + 40 + ($212 + 2 << 2) | 0;
    __label__ = 57;
    break;
   case 55:
    var $222 = __gm_ + 40 + ($212 + 2 << 2) | 0;
    var $223 = HEAPU32[$222 >> 2];
    if ($223 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 56;
      break;
    } else {
      var $F4_0 = $223;
      var $_pre_phi = $222;
      __label__ = 57;
      break;
    }
   case 56:
    _abort();
    throw "Reached an unreachable!";
   case 57:
    var $_pre_phi;
    var $F4_0;
    HEAP32[$_pre_phi >> 2] = $26;
    HEAP32[$F4_0 + 12 >> 2] = $26;
    HEAP32[$newbase + ($_sum + 8) >> 2] = $F4_0;
    HEAP32[$newbase + ($_sum + 12) >> 2] = $214;
    __label__ = 75;
    break;
   case 58:
    var $235 = $25;
    var $236 = $qsize_0 >>> 8;
    if (($236 | 0) == 0) {
      var $I7_0 = 0;
      __label__ = 61;
      break;
    } else {
      __label__ = 59;
      break;
    }
   case 59:
    if ($qsize_0 >>> 0 > 16777215) {
      var $I7_0 = 31;
      __label__ = 61;
      break;
    } else {
      __label__ = 60;
      break;
    }
   case 60:
    var $243 = ($236 + 1048320 | 0) >>> 16 & 8;
    var $244 = $236 << $243;
    var $247 = ($244 + 520192 | 0) >>> 16 & 4;
    var $248 = $244 << $247;
    var $251 = ($248 + 245760 | 0) >>> 16 & 2;
    var $257 = 14 - ($247 | $243 | $251) + ($248 << $251 >>> 15) | 0;
    var $I7_0 = $qsize_0 >>> (($257 + 7 | 0) >>> 0) & 1 | $257 << 1;
    __label__ = 61;
    break;
   case 61:
    var $I7_0;
    var $264 = __gm_ + 304 + ($I7_0 << 2) | 0;
    HEAP32[$newbase + ($_sum + 28) >> 2] = $I7_0;
    var $267 = $newbase + ($_sum + 16) | 0;
    HEAP32[$newbase + ($_sum + 20) >> 2] = 0;
    HEAP32[$267 >> 2] = 0;
    var $271 = HEAP32[__gm_ + 4 >> 2];
    var $272 = 1 << $I7_0;
    if (($271 & $272 | 0) == 0) {
      __label__ = 62;
      break;
    } else {
      __label__ = 63;
      break;
    }
   case 62:
    var $276 = $271 | $272;
    HEAP32[__gm_ + 4 >> 2] = $276;
    HEAP32[$264 >> 2] = $235;
    HEAP32[$newbase + ($_sum + 24) >> 2] = $264;
    HEAP32[$newbase + ($_sum + 12) >> 2] = $235;
    HEAP32[$newbase + ($_sum + 8) >> 2] = $235;
    __label__ = 75;
    break;
   case 63:
    var $285 = HEAP32[$264 >> 2];
    if (($I7_0 | 0) == 31) {
      var $291 = 0;
      __label__ = 65;
      break;
    } else {
      __label__ = 64;
      break;
    }
   case 64:
    var $291 = 25 - ($I7_0 >>> 1) | 0;
    __label__ = 65;
    break;
   case 65:
    var $291;
    var $K8_0 = $qsize_0 << $291;
    var $T_0 = $285;
    __label__ = 66;
    break;
   case 66:
    var $T_0;
    var $K8_0;
    if ((HEAP32[$T_0 + 4 >> 2] & -8 | 0) == ($qsize_0 | 0)) {
      __label__ = 71;
      break;
    } else {
      __label__ = 67;
      break;
    }
   case 67:
    var $300 = $T_0 + 16 + ($K8_0 >>> 31 << 2) | 0;
    var $301 = HEAPU32[$300 >> 2];
    if (($301 | 0) == 0) {
      __label__ = 68;
      break;
    } else {
      var $K8_0 = $K8_0 << 1;
      var $T_0 = $301;
      __label__ = 66;
      break;
    }
   case 68:
    if ($300 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 70;
      break;
    } else {
      __label__ = 69;
      break;
    }
   case 69:
    HEAP32[$300 >> 2] = $235;
    HEAP32[$newbase + ($_sum + 24) >> 2] = $T_0;
    HEAP32[$newbase + ($_sum + 12) >> 2] = $235;
    HEAP32[$newbase + ($_sum + 8) >> 2] = $235;
    __label__ = 75;
    break;
   case 70:
    _abort();
    throw "Reached an unreachable!";
   case 71:
    var $317 = $T_0 + 8 | 0;
    var $318 = HEAPU32[$317 >> 2];
    var $320 = HEAPU32[__gm_ + 16 >> 2];
    if ($T_0 >>> 0 < $320 >>> 0) {
      __label__ = 74;
      break;
    } else {
      __label__ = 72;
      break;
    }
   case 72:
    if ($318 >>> 0 < $320 >>> 0) {
      __label__ = 74;
      break;
    } else {
      __label__ = 73;
      break;
    }
   case 73:
    HEAP32[$318 + 12 >> 2] = $235;
    HEAP32[$317 >> 2] = $235;
    HEAP32[$newbase + ($_sum + 8) >> 2] = $318;
    HEAP32[$newbase + ($_sum + 12) >> 2] = $T_0;
    HEAP32[$newbase + ($_sum + 24) >> 2] = 0;
    __label__ = 75;
    break;
   case 74:
    _abort();
    throw "Reached an unreachable!";
   case 75:
    return $newbase + ($9 | 8) | 0;
   default:
    assert(0, "bad label: " + __label__);
  }
}

_prepend_alloc["X"] = 1;

function _add_segment($tbase, $tsize) {
  var __label__;
  __label__ = 2;
  while (1) switch (__label__) {
   case 2:
    var $1 = HEAPU32[__gm_ + 24 >> 2];
    var $2 = $1;
    var $3 = _segment_holding($2);
    var $5 = HEAP32[$3 >> 2];
    var $7 = HEAP32[$3 + 4 >> 2];
    var $8 = $5 + $7 | 0;
    var $10 = $5 + ($7 - 39) | 0;
    if (($10 & 7 | 0) == 0) {
      var $17 = 0;
      __label__ = 4;
      break;
    } else {
      __label__ = 3;
      break;
    }
   case 3:
    var $17 = -$10 & 7;
    __label__ = 4;
    break;
   case 4:
    var $17;
    var $18 = $5 + ($7 - 47 + $17) | 0;
    var $22 = $18 >>> 0 < ($1 + 16 | 0) >>> 0 ? $2 : $18;
    var $23 = $22 + 8 | 0;
    var $24 = $23;
    var $25 = $tbase;
    var $26 = $tsize - 40 | 0;
    _init_top($25, $26);
    var $28 = $22 + 4 | 0;
    HEAP32[$28 >> 2] = 27;
    HEAP32[$23 >> 2] = HEAP32[__gm_ + 444 >> 2];
    HEAP32[$23 + 4 >> 2] = HEAP32[__gm_ + 448 >> 2];
    HEAP32[$23 + 8 >> 2] = HEAP32[__gm_ + 452 >> 2];
    HEAP32[$23 + 12 >> 2] = HEAP32[__gm_ + 456 >> 2];
    HEAP32[__gm_ + 444 >> 2] = $tbase;
    HEAP32[__gm_ + 448 >> 2] = $tsize;
    HEAP32[__gm_ + 456 >> 2] = 0;
    HEAP32[__gm_ + 452 >> 2] = $24;
    var $30 = $22 + 28 | 0;
    HEAP32[$30 >> 2] = 7;
    if (($22 + 32 | 0) >>> 0 < $8 >>> 0) {
      var $33 = $30;
      __label__ = 5;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 5:
    var $33;
    var $34 = $33 + 4 | 0;
    HEAP32[$34 >> 2] = 7;
    if (($33 + 8 | 0) >>> 0 < $8 >>> 0) {
      var $33 = $34;
      __label__ = 5;
      break;
    } else {
      __label__ = 6;
      break;
    }
   case 6:
    if (($22 | 0) == ($2 | 0)) {
      __label__ = 30;
      break;
    } else {
      __label__ = 7;
      break;
    }
   case 7:
    var $42 = $22 - $1 | 0;
    var $43 = $2 + $42 | 0;
    var $45 = $2 + ($42 + 4) | 0;
    var $47 = HEAP32[$45 >> 2] & -2;
    HEAP32[$45 >> 2] = $47;
    var $48 = $42 | 1;
    HEAP32[$1 + 4 >> 2] = $48;
    var $50 = $43;
    HEAP32[$50 >> 2] = $42;
    if ($42 >>> 0 < 256) {
      __label__ = 8;
      break;
    } else {
      __label__ = 13;
      break;
    }
   case 8:
    var $55 = $42 >>> 2 & 1073741822;
    var $57 = __gm_ + 40 + ($55 << 2) | 0;
    var $58 = HEAPU32[__gm_ >> 2];
    var $59 = 1 << ($42 >>> 3);
    if (($58 & $59 | 0) == 0) {
      __label__ = 9;
      break;
    } else {
      __label__ = 10;
      break;
    }
   case 9:
    var $63 = $58 | $59;
    HEAP32[__gm_ >> 2] = $63;
    var $F_0 = $57;
    var $_pre_phi = __gm_ + 40 + ($55 + 2 << 2) | 0;
    __label__ = 12;
    break;
   case 10:
    var $65 = __gm_ + 40 + ($55 + 2 << 2) | 0;
    var $66 = HEAPU32[$65 >> 2];
    if ($66 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 11;
      break;
    } else {
      var $F_0 = $66;
      var $_pre_phi = $65;
      __label__ = 12;
      break;
    }
   case 11:
    _abort();
    throw "Reached an unreachable!";
   case 12:
    var $_pre_phi;
    var $F_0;
    HEAP32[$_pre_phi >> 2] = $1;
    HEAP32[$F_0 + 12 >> 2] = $1;
    HEAP32[$1 + 8 >> 2] = $F_0;
    HEAP32[$1 + 12 >> 2] = $57;
    __label__ = 30;
    break;
   case 13:
    var $76 = $1;
    var $77 = $42 >>> 8;
    if (($77 | 0) == 0) {
      var $I1_0 = 0;
      __label__ = 16;
      break;
    } else {
      __label__ = 14;
      break;
    }
   case 14:
    if ($42 >>> 0 > 16777215) {
      var $I1_0 = 31;
      __label__ = 16;
      break;
    } else {
      __label__ = 15;
      break;
    }
   case 15:
    var $84 = ($77 + 1048320 | 0) >>> 16 & 8;
    var $85 = $77 << $84;
    var $88 = ($85 + 520192 | 0) >>> 16 & 4;
    var $89 = $85 << $88;
    var $92 = ($89 + 245760 | 0) >>> 16 & 2;
    var $98 = 14 - ($88 | $84 | $92) + ($89 << $92 >>> 15) | 0;
    var $I1_0 = $42 >>> (($98 + 7 | 0) >>> 0) & 1 | $98 << 1;
    __label__ = 16;
    break;
   case 16:
    var $I1_0;
    var $105 = __gm_ + 304 + ($I1_0 << 2) | 0;
    HEAP32[$1 + 28 >> 2] = $I1_0;
    HEAP32[$1 + 20 >> 2] = 0;
    HEAP32[$1 + 16 >> 2] = 0;
    var $109 = HEAP32[__gm_ + 4 >> 2];
    var $110 = 1 << $I1_0;
    if (($109 & $110 | 0) == 0) {
      __label__ = 17;
      break;
    } else {
      __label__ = 18;
      break;
    }
   case 17:
    var $114 = $109 | $110;
    HEAP32[__gm_ + 4 >> 2] = $114;
    HEAP32[$105 >> 2] = $76;
    HEAP32[$1 + 24 >> 2] = $105;
    HEAP32[$1 + 12 >> 2] = $1;
    HEAP32[$1 + 8 >> 2] = $1;
    __label__ = 30;
    break;
   case 18:
    var $119 = HEAP32[$105 >> 2];
    if (($I1_0 | 0) == 31) {
      var $125 = 0;
      __label__ = 20;
      break;
    } else {
      __label__ = 19;
      break;
    }
   case 19:
    var $125 = 25 - ($I1_0 >>> 1) | 0;
    __label__ = 20;
    break;
   case 20:
    var $125;
    var $K2_0 = $42 << $125;
    var $T_0 = $119;
    __label__ = 21;
    break;
   case 21:
    var $T_0;
    var $K2_0;
    if ((HEAP32[$T_0 + 4 >> 2] & -8 | 0) == ($42 | 0)) {
      __label__ = 26;
      break;
    } else {
      __label__ = 22;
      break;
    }
   case 22:
    var $134 = $T_0 + 16 + ($K2_0 >>> 31 << 2) | 0;
    var $135 = HEAPU32[$134 >> 2];
    if (($135 | 0) == 0) {
      __label__ = 23;
      break;
    } else {
      var $K2_0 = $K2_0 << 1;
      var $T_0 = $135;
      __label__ = 21;
      break;
    }
   case 23:
    if ($134 >>> 0 < HEAPU32[__gm_ + 16 >> 2] >>> 0) {
      __label__ = 25;
      break;
    } else {
      __label__ = 24;
      break;
    }
   case 24:
    HEAP32[$134 >> 2] = $76;
    HEAP32[$1 + 24 >> 2] = $T_0;
    HEAP32[$1 + 12 >> 2] = $1;
    HEAP32[$1 + 8 >> 2] = $1;
    __label__ = 30;
    break;
   case 25:
    _abort();
    throw "Reached an unreachable!";
   case 26:
    var $148 = $T_0 + 8 | 0;
    var $149 = HEAPU32[$148 >> 2];
    var $151 = HEAPU32[__gm_ + 16 >> 2];
    if ($T_0 >>> 0 < $151 >>> 0) {
      __label__ = 29;
      break;
    } else {
      __label__ = 27;
      break;
    }
   case 27:
    if ($149 >>> 0 < $151 >>> 0) {
      __label__ = 29;
      break;
    } else {
      __label__ = 28;
      break;
    }
   case 28:
    HEAP32[$149 + 12 >> 2] = $76;
    HEAP32[$148 >> 2] = $76;
    HEAP32[$1 + 8 >> 2] = $149;
    HEAP32[$1 + 12 >> 2] = $T_0;
    HEAP32[$1 + 24 >> 2] = 0;
    __label__ = 30;
    break;
   case 29:
    _abort();
    throw "Reached an unreachable!";
   case 30:
    return;
   default:
    assert(0, "bad label: " + __label__);
  }
}

_add_segment["X"] = 1;

var i64Math = null;

var ERRNO_CODES = {
  E2BIG: 7,
  EACCES: 13,
  EADDRINUSE: 98,
  EADDRNOTAVAIL: 99,
  EAFNOSUPPORT: 97,
  EAGAIN: 11,
  EALREADY: 114,
  EBADF: 9,
  EBADMSG: 74,
  EBUSY: 16,
  ECANCELED: 125,
  ECHILD: 10,
  ECONNABORTED: 103,
  ECONNREFUSED: 111,
  ECONNRESET: 104,
  EDEADLK: 35,
  EDESTADDRREQ: 89,
  EDOM: 33,
  EDQUOT: 122,
  EEXIST: 17,
  EFAULT: 14,
  EFBIG: 27,
  EHOSTUNREACH: 113,
  EIDRM: 43,
  EILSEQ: 84,
  EINPROGRESS: 115,
  EINTR: 4,
  EINVAL: 22,
  EIO: 5,
  EISCONN: 106,
  EISDIR: 21,
  ELOOP: 40,
  EMFILE: 24,
  EMLINK: 31,
  EMSGSIZE: 90,
  EMULTIHOP: 72,
  ENAMETOOLONG: 36,
  ENETDOWN: 100,
  ENETRESET: 102,
  ENETUNREACH: 101,
  ENFILE: 23,
  ENOBUFS: 105,
  ENODATA: 61,
  ENODEV: 19,
  ENOENT: 2,
  ENOEXEC: 8,
  ENOLCK: 37,
  ENOLINK: 67,
  ENOMEM: 12,
  ENOMSG: 42,
  ENOPROTOOPT: 92,
  ENOSPC: 28,
  ENOSR: 63,
  ENOSTR: 60,
  ENOSYS: 38,
  ENOTCONN: 107,
  ENOTDIR: 20,
  ENOTEMPTY: 39,
  ENOTRECOVERABLE: 131,
  ENOTSOCK: 88,
  ENOTSUP: 95,
  ENOTTY: 25,
  ENXIO: 6,
  EOVERFLOW: 75,
  EOWNERDEAD: 130,
  EPERM: 1,
  EPIPE: 32,
  EPROTO: 71,
  EPROTONOSUPPORT: 93,
  EPROTOTYPE: 91,
  ERANGE: 34,
  EROFS: 30,
  ESPIPE: 29,
  ESRCH: 3,
  ESTALE: 116,
  ETIME: 62,
  ETIMEDOUT: 110,
  ETXTBSY: 26,
  EWOULDBLOCK: 11,
  EXDEV: 18
};

function ___setErrNo(value) {
  if (!___setErrNo.ret) ___setErrNo.ret = allocate([ 0 ], "i32", ALLOC_STATIC);
  HEAP32[___setErrNo.ret >> 2] = value;
  return value;
}

var _stdin = 0;

var _stdout = 0;

var _stderr = 0;

var __impure_ptr = 0;

var FS = {
  currentPath: "/",
  nextInode: 2,
  streams: [ null ],
  ignorePermissions: true,
  absolutePath: (function(relative, base) {
    if (typeof relative !== "string") return null;
    if (base === undefined) base = FS.currentPath;
    if (relative && relative[0] == "/") base = "";
    var full = base + "/" + relative;
    var parts = full.split("/").reverse();
    var absolute = [ "" ];
    while (parts.length) {
      var part = parts.pop();
      if (part == "" || part == ".") {} else if (part == "..") {
        if (absolute.length > 1) absolute.pop();
      } else {
        absolute.push(part);
      }
    }
    return absolute.length == 1 ? "/" : absolute.join("/");
  }),
  analyzePath: (function(path, dontResolveLastLink, linksVisited) {
    var ret = {
      isRoot: false,
      exists: false,
      error: 0,
      name: null,
      path: null,
      object: null,
      parentExists: false,
      parentPath: null,
      parentObject: null
    };
    path = FS.absolutePath(path);
    if (path == "/") {
      ret.isRoot = true;
      ret.exists = ret.parentExists = true;
      ret.name = "/";
      ret.path = ret.parentPath = "/";
      ret.object = ret.parentObject = FS.root;
    } else if (path !== null) {
      linksVisited = linksVisited || 0;
      path = path.slice(1).split("/");
      var current = FS.root;
      var traversed = [ "" ];
      while (path.length) {
        if (path.length == 1 && current.isFolder) {
          ret.parentExists = true;
          ret.parentPath = traversed.length == 1 ? "/" : traversed.join("/");
          ret.parentObject = current;
          ret.name = path[0];
        }
        var target = path.shift();
        if (!current.isFolder) {
          ret.error = ERRNO_CODES.ENOTDIR;
          break;
        } else if (!current.read) {
          ret.error = ERRNO_CODES.EACCES;
          break;
        } else if (!current.contents.hasOwnProperty(target)) {
          ret.error = ERRNO_CODES.ENOENT;
          break;
        }
        current = current.contents[target];
        if (current.link && !(dontResolveLastLink && path.length == 0)) {
          if (linksVisited > 40) {
            ret.error = ERRNO_CODES.ELOOP;
            break;
          }
          var link = FS.absolutePath(current.link, traversed.join("/"));
          ret = FS.analyzePath([ link ].concat(path).join("/"), dontResolveLastLink, linksVisited + 1);
          return ret;
        }
        traversed.push(target);
        if (path.length == 0) {
          ret.exists = true;
          ret.path = traversed.join("/");
          ret.object = current;
        }
      }
    }
    return ret;
  }),
  findObject: (function(path, dontResolveLastLink) {
    FS.ensureRoot();
    var ret = FS.analyzePath(path, dontResolveLastLink);
    if (ret.exists) {
      return ret.object;
    } else {
      ___setErrNo(ret.error);
      return null;
    }
  }),
  createObject: (function(parent, name, properties, canRead, canWrite) {
    if (!parent) parent = "/";
    if (typeof parent === "string") parent = FS.findObject(parent);
    if (!parent) {
      ___setErrNo(ERRNO_CODES.EACCES);
      throw new Error("Parent path must exist.");
    }
    if (!parent.isFolder) {
      ___setErrNo(ERRNO_CODES.ENOTDIR);
      throw new Error("Parent must be a folder.");
    }
    if (!parent.write && !FS.ignorePermissions) {
      ___setErrNo(ERRNO_CODES.EACCES);
      throw new Error("Parent folder must be writeable.");
    }
    if (!name || name == "." || name == "..") {
      ___setErrNo(ERRNO_CODES.ENOENT);
      throw new Error("Name must not be empty.");
    }
    if (parent.contents.hasOwnProperty(name)) {
      ___setErrNo(ERRNO_CODES.EEXIST);
      throw new Error("Can't overwrite object.");
    }
    parent.contents[name] = {
      read: canRead === undefined ? true : canRead,
      write: canWrite === undefined ? false : canWrite,
      timestamp: Date.now(),
      inodeNumber: FS.nextInode++
    };
    for (var key in properties) {
      if (properties.hasOwnProperty(key)) {
        parent.contents[name][key] = properties[key];
      }
    }
    return parent.contents[name];
  }),
  createFolder: (function(parent, name, canRead, canWrite) {
    var properties = {
      isFolder: true,
      isDevice: false,
      contents: {}
    };
    return FS.createObject(parent, name, properties, canRead, canWrite);
  }),
  createPath: (function(parent, path, canRead, canWrite) {
    var current = FS.findObject(parent);
    if (current === null) throw new Error("Invalid parent.");
    path = path.split("/").reverse();
    while (path.length) {
      var part = path.pop();
      if (!part) continue;
      if (!current.contents.hasOwnProperty(part)) {
        FS.createFolder(current, part, canRead, canWrite);
      }
      current = current.contents[part];
    }
    return current;
  }),
  createFile: (function(parent, name, properties, canRead, canWrite) {
    properties.isFolder = false;
    return FS.createObject(parent, name, properties, canRead, canWrite);
  }),
  createDataFile: (function(parent, name, data, canRead, canWrite) {
    if (typeof data === "string") {
      var dataArray = new Array(data.length);
      for (var i = 0, len = data.length; i < len; ++i) dataArray[i] = data.charCodeAt(i);
      data = dataArray;
    }
    var properties = {
      isDevice: false,
      contents: data
    };
    return FS.createFile(parent, name, properties, canRead, canWrite);
  }),
  createLazyFile: (function(parent, name, url, canRead, canWrite) {
    var properties = {
      isDevice: false,
      url: url
    };
    return FS.createFile(parent, name, properties, canRead, canWrite);
  }),
  createPreloadedFile: (function(parent, name, url, canRead, canWrite) {
    Browser.asyncLoad(url, (function(data) {
      FS.createDataFile(parent, name, data, canRead, canWrite);
    }));
  }),
  createLink: (function(parent, name, target, canRead, canWrite) {
    var properties = {
      isDevice: false,
      link: target
    };
    return FS.createFile(parent, name, properties, canRead, canWrite);
  }),
  createDevice: (function(parent, name, input, output) {
    if (!(input || output)) {
      throw new Error("A device must have at least one callback defined.");
    }
    var ops = {
      isDevice: true,
      input: input,
      output: output
    };
    return FS.createFile(parent, name, ops, Boolean(input), Boolean(output));
  }),
  forceLoadFile: (function(obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
    var success = true;
    if (typeof XMLHttpRequest !== "undefined") {
      assert("Cannot do synchronous binary XHRs in modern browsers. Use --embed-file or --preload-file in emcc");
    } else if (Module["read"]) {
      try {
        obj.contents = intArrayFromString(Module["read"](obj.url), true);
      } catch (e) {
        success = false;
      }
    } else {
      throw new Error("Cannot load without read() or XMLHttpRequest.");
    }
    if (!success) ___setErrNo(ERRNO_CODES.EIO);
    return success;
  }),
  ensureRoot: (function() {
    if (FS.root) return;
    FS.root = {
      read: true,
      write: true,
      isFolder: true,
      isDevice: false,
      timestamp: Date.now(),
      inodeNumber: 1,
      contents: {}
    };
  }),
  init: (function(input, output, error) {
    assert(!FS.init.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
    FS.init.initialized = true;
    FS.ensureRoot();
    input = input || Module["stdin"];
    output = output || Module["stdout"];
    error = error || Module["stderr"];
    var stdinOverridden = true, stdoutOverridden = true, stderrOverridden = true;
    if (!input) {
      stdinOverridden = false;
      input = (function() {
        if (!input.cache || !input.cache.length) {
          var result;
          if (typeof window != "undefined" && typeof window.prompt == "function") {
            result = window.prompt("Input: ");
            if (result === null) result = String.fromCharCode(0);
          } else if (typeof readline == "function") {
            result = readline();
          }
          if (!result) result = "";
          input.cache = intArrayFromString(result + "\n", true);
        }
        return input.cache.shift();
      });
    }
    function simpleOutput(val) {
      if (val === null || val === "\n".charCodeAt(0)) {
        output.printer(output.buffer.join(""));
        output.buffer = [];
      } else {
        output.buffer.push(String.fromCharCode(val));
      }
    }
    if (!output) {
      stdoutOverridden = false;
      output = simpleOutput;
    }
    if (!output.printer) output.printer = Module["print"];
    if (!output.buffer) output.buffer = [];
    if (!error) {
      stderrOverridden = false;
      error = simpleOutput;
    }
    if (!error.printer) error.printer = Module["print"];
    if (!error.buffer) error.buffer = [];
    try {
      FS.createFolder("/", "tmp", true, true);
    } catch (e) {}
    var devFolder = FS.createFolder("/", "dev", true, true);
    var stdin = FS.createDevice(devFolder, "stdin", input);
    var stdout = FS.createDevice(devFolder, "stdout", null, output);
    var stderr = FS.createDevice(devFolder, "stderr", null, error);
    FS.createDevice(devFolder, "tty", input, output);
    FS.streams[1] = {
      path: "/dev/stdin",
      object: stdin,
      position: 0,
      isRead: true,
      isWrite: false,
      isAppend: false,
      isTerminal: !stdinOverridden,
      error: false,
      eof: false,
      ungotten: []
    };
    FS.streams[2] = {
      path: "/dev/stdout",
      object: stdout,
      position: 0,
      isRead: false,
      isWrite: true,
      isAppend: false,
      isTerminal: !stdoutOverridden,
      error: false,
      eof: false,
      ungotten: []
    };
    FS.streams[3] = {
      path: "/dev/stderr",
      object: stderr,
      position: 0,
      isRead: false,
      isWrite: true,
      isAppend: false,
      isTerminal: !stderrOverridden,
      error: false,
      eof: false,
      ungotten: []
    };
    _stdin = allocate([ 1 ], "void*", ALLOC_STATIC);
    _stdout = allocate([ 2 ], "void*", ALLOC_STATIC);
    _stderr = allocate([ 3 ], "void*", ALLOC_STATIC);
    FS.createPath("/", "dev/shm/tmp", true, true);
    FS.streams[_stdin] = FS.streams[1];
    FS.streams[_stdout] = FS.streams[2];
    FS.streams[_stderr] = FS.streams[3];
    __impure_ptr = allocate([ allocate([ 0, 0, 0, 0, _stdin, 0, 0, 0, _stdout, 0, 0, 0, _stderr, 0, 0, 0 ], "void*", ALLOC_STATIC) ], "void*", ALLOC_STATIC);
  }),
  quit: (function() {
    if (!FS.init.initialized) return;
    if (FS.streams[2] && FS.streams[2].object.output.buffer.length > 0) FS.streams[2].object.output("\n".charCodeAt(0));
    if (FS.streams[3] && FS.streams[3].object.output.buffer.length > 0) FS.streams[3].object.output("\n".charCodeAt(0));
  }),
  standardizePath: (function(path) {
    if (path.substr(0, 2) == "./") path = path.substr(2);
    return path;
  }),
  deleteFile: (function(path) {
    var path = FS.analyzePath(path);
    if (!path.parentExists || !path.exists) {
      throw "Invalid path " + path;
    }
    delete path.parentObject.contents[path.name];
  })
};

var ___dirent_struct_layout = null;

function _open(path, oflag, varargs) {
  var mode = HEAP32[varargs >> 2];
  var accessMode = oflag & 3;
  var isWrite = accessMode != 0;
  var isRead = accessMode != 1;
  var isCreate = Boolean(oflag & 512);
  var isExistCheck = Boolean(oflag & 2048);
  var isTruncate = Boolean(oflag & 1024);
  var isAppend = Boolean(oflag & 8);
  var origPath = path;
  path = FS.analyzePath(Pointer_stringify(path));
  if (!path.parentExists) {
    ___setErrNo(path.error);
    return -1;
  }
  var target = path.object || null;
  var finalPath;
  if (target) {
    if (isCreate && isExistCheck) {
      ___setErrNo(ERRNO_CODES.EEXIST);
      return -1;
    }
    if ((isWrite || isCreate || isTruncate) && target.isFolder) {
      ___setErrNo(ERRNO_CODES.EISDIR);
      return -1;
    }
    if (isRead && !target.read || isWrite && !target.write) {
      ___setErrNo(ERRNO_CODES.EACCES);
      return -1;
    }
    if (isTruncate && !target.isDevice) {
      target.contents = [];
    } else {
      if (!FS.forceLoadFile(target)) {
        ___setErrNo(ERRNO_CODES.EIO);
        return -1;
      }
    }
    finalPath = path.path;
  } else {
    if (!isCreate) {
      ___setErrNo(ERRNO_CODES.ENOENT);
      return -1;
    }
    if (!path.parentObject.write) {
      ___setErrNo(ERRNO_CODES.EACCES);
      return -1;
    }
    target = FS.createDataFile(path.parentObject, path.name, [], mode & 256, mode & 128);
    finalPath = path.parentPath + "/" + path.name;
  }
  var id = FS.streams.length;
  if (target.isFolder) {
    var entryBuffer = 0;
    if (___dirent_struct_layout) {
      entryBuffer = _malloc(___dirent_struct_layout.__size__);
    }
    var contents = [];
    for (var key in target.contents) contents.push(key);
    FS.streams[id] = {
      path: finalPath,
      object: target,
      position: -2,
      isRead: true,
      isWrite: false,
      isAppend: false,
      error: false,
      eof: false,
      ungotten: [],
      contents: contents,
      currentEntry: entryBuffer
    };
  } else {
    FS.streams[id] = {
      path: finalPath,
      object: target,
      position: 0,
      isRead: isRead,
      isWrite: isWrite,
      isAppend: isAppend,
      error: false,
      eof: false,
      ungotten: []
    };
  }
  return id;
}

function _fopen(filename, mode) {
  var flags;
  mode = Pointer_stringify(mode);
  if (mode[0] == "r") {
    if (mode.indexOf("+") != -1) {
      flags = 2;
    } else {
      flags = 0;
    }
  } else if (mode[0] == "w") {
    if (mode.indexOf("+") != -1) {
      flags = 2;
    } else {
      flags = 1;
    }
    flags |= 512;
    flags |= 1024;
  } else if (mode[0] == "a") {
    if (mode.indexOf("+") != -1) {
      flags = 2;
    } else {
      flags = 1;
    }
    flags |= 512;
    flags |= 8;
  } else {
    ___setErrNo(ERRNO_CODES.EINVAL);
    return 0;
  }
  var ret = _open(filename, flags, allocate([ 511, 0, 0, 0 ], "i32", ALLOC_STACK));
  return ret == -1 ? 0 : ret;
}

function _close(fildes) {
  if (FS.streams[fildes]) {
    if (FS.streams[fildes].currentEntry) {
      _free(FS.streams[fildes].currentEntry);
    }
    delete FS.streams[fildes];
    return 0;
  } else {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1;
  }
}

function _fsync(fildes) {
  if (FS.streams[fildes]) {
    return 0;
  } else {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1;
  }
}

function _fclose(stream) {
  _fsync(stream);
  return _close(stream);
}

function _memset(ptr, value, num, align) {
  if (num >= 20) {
    var stop = ptr + num;
    while (ptr % 4) {
      HEAP8[ptr++] = value;
    }
    if (value < 0) value += 256;
    var ptr4 = ptr >> 2, stop4 = stop >> 2, value4 = value | value << 8 | value << 16 | value << 24;
    while (ptr4 < stop4) {
      HEAP32[ptr4++] = value4;
    }
    ptr = ptr4 << 2;
    while (ptr < stop) {
      HEAP8[ptr++] = value;
    }
  } else {
    while (num--) {
      HEAP8[ptr++] = value;
    }
  }
}

var _llvm_memset_p0i8_i32 = _memset;

function _memcpy(dest, src, num, align) {
  if (num >= 20 && src % 2 == dest % 2) {
    if (src % 4 == dest % 4) {
      var stop = src + num;
      while (src % 4) {
        HEAP8[dest++] = HEAP8[src++];
      }
      var src4 = src >> 2, dest4 = dest >> 2, stop4 = stop >> 2;
      while (src4 < stop4) {
        HEAP32[dest4++] = HEAP32[src4++];
      }
      src = src4 << 2;
      dest = dest4 << 2;
      while (src < stop) {
        HEAP8[dest++] = HEAP8[src++];
      }
    } else {
      var stop = src + num;
      if (src % 2) {
        HEAP8[dest++] = HEAP8[src++];
      }
      var src2 = src >> 1, dest2 = dest >> 1, stop2 = stop >> 1;
      while (src2 < stop2) {
        HEAP16[dest2++] = HEAP16[src2++];
      }
      src = src2 << 1;
      dest = dest2 << 1;
      if (src < stop) {
        HEAP8[dest++] = HEAP8[src++];
      }
    }
  } else {
    while (num--) {
      HEAP8[dest++] = HEAP8[src++];
    }
  }
}

var _llvm_memcpy_p0i8_p0i8_i32 = _memcpy;

function ___assert_func(filename, line, func, condition) {
  throw "Assertion failed: " + Pointer_stringify(condition) + ", at: " + [ Pointer_stringify(filename), line, Pointer_stringify(func) ];
}

function _pread(fildes, buf, nbyte, offset) {
  var stream = FS.streams[fildes];
  if (!stream || stream.object.isDevice) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1;
  } else if (!stream.isRead) {
    ___setErrNo(ERRNO_CODES.EACCES);
    return -1;
  } else if (stream.object.isFolder) {
    ___setErrNo(ERRNO_CODES.EISDIR);
    return -1;
  } else if (nbyte < 0 || offset < 0) {
    ___setErrNo(ERRNO_CODES.EINVAL);
    return -1;
  } else {
    var bytesRead = 0;
    while (stream.ungotten.length && nbyte > 0) {
      HEAP8[buf++] = stream.ungotten.pop();
      nbyte--;
      bytesRead++;
    }
    var contents = stream.object.contents;
    var size = Math.min(contents.length - offset, nbyte);
    for (var i = 0; i < size; i++) {
      HEAP8[buf + i] = contents[offset + i];
      bytesRead++;
    }
    return bytesRead;
  }
}

function _read(fildes, buf, nbyte) {
  var stream = FS.streams[fildes];
  if (!stream) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1;
  } else if (!stream.isRead) {
    ___setErrNo(ERRNO_CODES.EACCES);
    return -1;
  } else if (nbyte < 0) {
    ___setErrNo(ERRNO_CODES.EINVAL);
    return -1;
  } else {
    var bytesRead;
    if (stream.object.isDevice) {
      if (stream.object.input) {
        bytesRead = 0;
        while (stream.ungotten.length && nbyte > 0) {
          HEAP8[buf++] = stream.ungotten.pop();
          nbyte--;
          bytesRead++;
        }
        for (var i = 0; i < nbyte; i++) {
          try {
            var result = stream.object.input();
          } catch (e) {
            ___setErrNo(ERRNO_CODES.EIO);
            return -1;
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          HEAP8[buf + i] = result;
        }
        return bytesRead;
      } else {
        ___setErrNo(ERRNO_CODES.ENXIO);
        return -1;
      }
    } else {
      var ungotSize = stream.ungotten.length;
      bytesRead = _pread(fildes, buf, nbyte, stream.position);
      if (bytesRead != -1) {
        stream.position += stream.ungotten.length - ungotSize + bytesRead;
      }
      return bytesRead;
    }
  }
}

function _fread(ptr, size, nitems, stream) {
  var bytesToRead = nitems * size;
  if (bytesToRead == 0) return 0;
  var bytesRead = _read(stream, ptr, bytesToRead);
  var streamObj = FS.streams[stream];
  if (bytesRead == -1) {
    if (streamObj) streamObj.error = true;
    return -1;
  } else {
    if (bytesRead < bytesToRead) streamObj.eof = true;
    return Math.floor(bytesRead / size);
  }
}

function _longjmp(env, value) {
  throw {
    longjmp: true,
    label: HEAP32[env >> 2],
    value: value || 1
  };
}

var _setjmp;

function ___gxx_personality_v0() {}

function _ferror(stream) {
  return Number(stream in FS.streams && FS.streams[stream].error);
}

function ___cxa_pure_virtual() {
  ABORT = true;
  throw "Pure virtual function called!";
}

var __ZNSt9type_infoD2Ev;

var _llvm_memset_p0i8_i64 = _memset;

function _abort() {
  ABORT = true;
  throw "abort() at " + (new Error).stack;
}

function _sysconf(name) {
  switch (name) {
   case 8:
    return PAGE_SIZE;
   case 54:
   case 56:
   case 21:
   case 61:
   case 63:
   case 22:
   case 67:
   case 23:
   case 24:
   case 25:
   case 26:
   case 27:
   case 69:
   case 28:
   case 101:
   case 70:
   case 71:
   case 29:
   case 30:
   case 199:
   case 75:
   case 76:
   case 32:
   case 43:
   case 44:
   case 80:
   case 46:
   case 47:
   case 45:
   case 48:
   case 49:
   case 42:
   case 82:
   case 33:
   case 7:
   case 108:
   case 109:
   case 107:
   case 112:
   case 119:
   case 121:
    return 200809;
   case 13:
   case 104:
   case 94:
   case 95:
   case 34:
   case 35:
   case 77:
   case 81:
   case 83:
   case 84:
   case 85:
   case 86:
   case 87:
   case 88:
   case 89:
   case 90:
   case 91:
   case 94:
   case 95:
   case 110:
   case 111:
   case 113:
   case 114:
   case 115:
   case 116:
   case 117:
   case 118:
   case 120:
   case 40:
   case 16:
   case 79:
   case 19:
    return -1;
   case 92:
   case 93:
   case 5:
   case 72:
   case 6:
   case 74:
   case 92:
   case 93:
   case 96:
   case 97:
   case 98:
   case 99:
   case 102:
   case 103:
   case 105:
    return 1;
   case 38:
   case 66:
   case 50:
   case 51:
   case 4:
    return 1024;
   case 15:
   case 64:
   case 41:
    return 32;
   case 55:
   case 37:
   case 17:
    return 2147483647;
   case 18:
   case 1:
    return 47839;
   case 59:
   case 57:
    return 99;
   case 68:
   case 58:
    return 2048;
   case 0:
    return 2097152;
   case 3:
    return 65536;
   case 14:
    return 32768;
   case 73:
    return 32767;
   case 39:
    return 16384;
   case 60:
    return 1e3;
   case 106:
    return 700;
   case 52:
    return 256;
   case 62:
    return 255;
   case 2:
    return 100;
   case 65:
    return 64;
   case 36:
    return 20;
   case 100:
    return 16;
   case 20:
    return 6;
   case 53:
    return 4;
  }
  ___setErrNo(ERRNO_CODES.EINVAL);
  return -1;
}

function _time(ptr) {
  var ret = Math.floor(Date.now() / 1e3);
  if (ptr) {
    HEAP32[ptr >> 2] = ret;
  }
  return ret;
}

function ___errno_location() {
  return ___setErrNo.ret;
}

var ___errno = ___errno_location;

function _sbrk(bytes) {
  var self = _sbrk;
  if (!self.called) {
    STATICTOP = alignMemoryPage(STATICTOP);
    self.called = true;
    _sbrk.DYNAMIC_START = STATICTOP;
  }
  var ret = STATICTOP;
  if (bytes != 0) Runtime.staticAlloc(bytes);
  return ret;
}

function _pwrite(fildes, buf, nbyte, offset) {
  var stream = FS.streams[fildes];
  if (!stream || stream.object.isDevice) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1;
  } else if (!stream.isWrite) {
    ___setErrNo(ERRNO_CODES.EACCES);
    return -1;
  } else if (stream.object.isFolder) {
    ___setErrNo(ERRNO_CODES.EISDIR);
    return -1;
  } else if (nbyte < 0 || offset < 0) {
    ___setErrNo(ERRNO_CODES.EINVAL);
    return -1;
  } else {
    var contents = stream.object.contents;
    while (contents.length < offset) contents.push(0);
    for (var i = 0; i < nbyte; i++) {
      contents[offset + i] = HEAPU8[buf + i];
    }
    stream.object.timestamp = Date.now();
    return i;
  }
}

function _write(fildes, buf, nbyte) {
  var stream = FS.streams[fildes];
  if (!stream) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1;
  } else if (!stream.isWrite) {
    ___setErrNo(ERRNO_CODES.EACCES);
    return -1;
  } else if (nbyte < 0) {
    ___setErrNo(ERRNO_CODES.EINVAL);
    return -1;
  } else {
    if (stream.object.isDevice) {
      if (stream.object.output) {
        for (var i = 0; i < nbyte; i++) {
          try {
            stream.object.output(HEAP8[buf + i]);
          } catch (e) {
            ___setErrNo(ERRNO_CODES.EIO);
            return -1;
          }
        }
        stream.object.timestamp = Date.now();
        return i;
      } else {
        ___setErrNo(ERRNO_CODES.ENXIO);
        return -1;
      }
    } else {
      var bytesWritten = _pwrite(fildes, buf, nbyte, stream.position);
      if (bytesWritten != -1) stream.position += bytesWritten;
      return bytesWritten;
    }
  }
}

function _fputc(c, stream) {
  var chr = unSign(c & 255);
  HEAP8[_fputc.ret] = chr;
  var ret = _write(stream, _fputc.ret, 1);
  if (ret == -1) {
    if (stream in FS.streams) FS.streams[stream].error = true;
    return -1;
  } else {
    return chr;
  }
}

function _putchar(c) {
  return _fputc(c, HEAP32[_stdout >> 2]);
}

var Browser = {
  mainLoop: {
    scheduler: null,
    shouldPause: false,
    paused: false
  },
  pointerLock: false,
  moduleContextCreatedCallbacks: [],
  createContext: (function(canvas, useWebGL, setInModule) {
    try {
      var ctx = canvas.getContext(useWebGL ? "experimental-webgl" : "2d");
      if (!ctx) throw ":(";
    } catch (e) {
      Module.print("Could not create canvas - " + e);
      return null;
    }
    if (useWebGL) {
      canvas.style.backgroundColor = "black";
      canvas.addEventListener("webglcontextlost", (function(event) {
        alert("WebGL context lost. You will need to reload the page.");
      }), false);
    }
    if (setInModule) {
      Module.ctx = ctx;
      Module.useWebGL = useWebGL;
      Browser.moduleContextCreatedCallbacks.forEach((function(callback) {
        callback();
      }));
    }
    return ctx;
  }),
  requestFullScreen: (function() {
    var canvas = Module.canvas;
    function fullScreenChange() {
      if (Module["onFullScreen"]) Module["onFullScreen"]();
      if (document["webkitFullScreenElement"] === canvas || document["mozFullScreenElement"] === canvas || document["fullScreenElement"] === canvas) {
        canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"];
        canvas.requestPointerLock();
      }
    }
    document.addEventListener("fullscreenchange", fullScreenChange, false);
    document.addEventListener("mozfullscreenchange", fullScreenChange, false);
    document.addEventListener("webkitfullscreenchange", fullScreenChange, false);
    function pointerLockChange() {
      Browser.pointerLock = document["pointerLockElement"] === canvas || document["mozPointerLockElement"] === canvas || document["webkitPointerLockElement"] === canvas;
    }
    document.addEventListener("pointerlockchange", pointerLockChange, false);
    document.addEventListener("mozpointerlockchange", pointerLockChange, false);
    document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
    canvas.requestFullScreen = canvas["requestFullScreen"] || canvas["mozRequestFullScreen"] || (canvas["webkitRequestFullScreen"] ? (function() {
      canvas["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]);
    }) : null);
    canvas.requestFullScreen();
  }),
  requestAnimationFrame: (function(func) {
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || window["setTimeout"];
    }
    window.requestAnimationFrame(func);
  }),
  getMovementX: (function(event) {
    return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0;
  }),
  getMovementY: (function(event) {
    return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0;
  }),
  xhrLoad: (function(url, onload, onerror) {
    var xhr = new XMLHttpRequest;
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = (function() {
      if (xhr.status == 200) {
        onload(xhr.response);
      } else {
        onerror();
      }
    });
    xhr.onerror = onerror;
    xhr.send(null);
  }),
  asyncLoad: (function(url, callback) {
    Browser.xhrLoad(url, (function(arrayBuffer) {
      assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
      callback(new Uint8Array(arrayBuffer));
      removeRunDependency();
    }), (function(event) {
      throw 'Loading data file "' + url + '" failed.';
    }));
    addRunDependency();
  })
};

__ATINIT__.unshift({
  func: (function() {
    if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
  })
});

__ATMAIN__.push({
  func: (function() {
    FS.ignorePermissions = false;
  })
});

__ATEXIT__.push({
  func: (function() {
    FS.quit();
  })
});

Module["FS_createFolder"] = FS.createFolder;

Module["FS_createPath"] = FS.createPath;

Module["FS_createDataFile"] = FS.createDataFile;

Module["FS_createLazyFile"] = FS.createLazyFile;

Module["FS_createLink"] = FS.createLink;

Module["FS_createDevice"] = FS.createDevice;

___setErrNo(0);

_fputc.ret = allocate([ 0 ], "i8", ALLOC_STATIC);

Module["requestFullScreen"] = (function() {
  Browser.requestFullScreen();
});

Module.callMain = function callMain(args) {
  var argc = args.length + 1;
  function pad() {
    for (var i = 0; i < 4 - 1; i++) {
      argv.push(0);
    }
  }
  var argv = [ allocate(intArrayFromString("/bin/this.program"), "i8", ALLOC_STATIC) ];
  pad();
  for (var i = 0; i < argc - 1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), "i8", ALLOC_STATIC));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, "i32", ALLOC_STATIC);
  return _main(argc, argv, 0);
};

var __ZN4jpgdL5g_ZAGE;

var __ZN4jpgdL13s_extend_testE;

var __ZN4jpgdL15s_extend_offsetE;

var __ZTVN4jpgd24jpeg_decoder_file_streamE;

var __ZTIN4jpgd19jpeg_decoder_streamE;

var __ZTIN4jpgd24jpeg_decoder_file_streamE;

var __ZTVN4jpgd19jpeg_decoder_streamE;

var __ZTISt9type_info;

var __ZTIN10__cxxabiv116__shim_type_infoE;

var __ZTIN10__cxxabiv117__class_type_infoE;

var __ZTVN10__cxxabiv117__class_type_infoE;

var __ZTVN10__cxxabiv120__si_class_type_infoE;

var __ZTIN10__cxxabiv120__si_class_type_infoE;

var __gm_;

var _mparams;

STRING_TABLE.__str5 = allocate([ 105, 110, 112, 117, 116, 46, 106, 112, 103, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str114 = allocate([ 106, 112, 103, 100, 46, 99, 112, 112, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd4idctEPKsPhi = allocate([ 118, 111, 105, 100, 32, 106, 112, 103, 100, 58, 58, 105, 100, 99, 116, 40, 99, 111, 110, 115, 116, 32, 106, 112, 103, 100, 95, 98, 108, 111, 99, 107, 95, 116, 32, 42, 44, 32, 117, 105, 110, 116, 56, 32, 42, 44, 32, 105, 110, 116, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str1115 = allocate([ 98, 108, 111, 99, 107, 95, 109, 97, 120, 95, 122, 97, 103, 32, 62, 61, 32, 49, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str2116 = allocate([ 98, 108, 111, 99, 107, 95, 109, 97, 120, 95, 122, 97, 103, 32, 60, 61, 32, 54, 52, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__ZN4jpgdL16s_idct_row_tableE = allocate([ 1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 2, 1, 1, 0, 0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 0, 0, 3, 2, 1, 0, 0, 0, 0, 0, 4, 2, 1, 0, 0, 0, 0, 0, 4, 3, 1, 0, 0, 0, 0, 0, 4, 3, 2, 0, 0, 0, 0, 0, 4, 3, 2, 1, 0, 0, 0, 0, 4, 3, 2, 1, 1, 0, 0, 0, 4, 3, 2, 2, 1, 0, 0, 0, 4, 3, 3, 2, 1, 0, 0, 0, 4, 4, 3, 2, 1, 0, 0, 0, 5, 4, 3, 2, 1, 0, 0, 0, 6, 4, 3, 2, 1, 0, 0, 0, 6, 5, 3, 2, 1, 0, 0, 0, 6, 5, 4, 2, 1, 0, 0, 0, 6, 5, 4, 3, 1, 0, 0, 0, 6, 5, 4, 3, 2, 0, 0, 0, 6, 5, 4, 3, 2, 1, 0, 0, 6, 5, 4, 3, 2, 1, 1, 0, 6, 5, 4, 3, 2, 2, 1, 0, 6, 5, 4, 3, 3, 2, 1, 0, 6, 5, 4, 4, 3, 2, 1, 0, 6, 5, 5, 4, 3, 2, 1, 0, 6, 6, 5, 4, 3, 2, 1, 0, 7, 6, 5, 4, 3, 2, 1, 0, 8, 6, 5, 4, 3, 2, 1, 0, 8, 7, 5, 4, 3, 2, 1, 0, 8, 7, 6, 4, 3, 2, 1, 0, 8, 7, 6, 5, 3, 2, 1, 0, 8, 7, 6, 5, 4, 2, 1, 0, 8, 7, 6, 5, 4, 3, 1, 0, 8, 7, 6, 5, 4, 3, 2, 0, 8, 7, 6, 5, 4, 3, 2, 1, 8, 7, 6, 5, 4, 3, 2, 2, 8, 7, 6, 5, 4, 3, 3, 2, 8, 7, 6, 5, 4, 4, 3, 2, 8, 7, 6, 5, 5, 4, 3, 2, 8, 7, 6, 6, 5, 4, 3, 2, 8, 7, 7, 6, 5, 4, 3, 2, 8, 8, 7, 6, 5, 4, 3, 2, 8, 8, 8, 6, 5, 4, 3, 2, 8, 8, 8, 7, 5, 4, 3, 2, 8, 8, 8, 7, 6, 4, 3, 2, 8, 8, 8, 7, 6, 5, 3, 2, 8, 8, 8, 7, 6, 5, 4, 2, 8, 8, 8, 7, 6, 5, 4, 3, 8, 8, 8, 7, 6, 5, 4, 4, 8, 8, 8, 7, 6, 5, 5, 4, 8, 8, 8, 7, 6, 6, 5, 4, 8, 8, 8, 7, 7, 6, 5, 4, 8, 8, 8, 8, 7, 6, 5, 4, 8, 8, 8, 8, 8, 6, 5, 4, 8, 8, 8, 8, 8, 7, 5, 4, 8, 8, 8, 8, 8, 7, 6, 4, 8, 8, 8, 8, 8, 7, 6, 5, 8, 8, 8, 8, 8, 7, 6, 6, 8, 8, 8, 8, 8, 7, 7, 6, 8, 8, 8, 8, 8, 8, 7, 6, 8, 8, 8, 8, 8, 8, 8, 6, 8, 8, 8, 8, 8, 8, 8, 7, 8, 8, 8, 8, 8, 8, 8, 8 ], "i8", ALLOC_STATIC);

STRING_TABLE.__ZN4jpgdL16s_idct_col_tableE = allocate([ 1, 1, 2, 3, 3, 3, 3, 3, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8 ], "i8", ALLOC_STATIC);

STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder13fix_in_bufferEv = allocate([ 118, 111, 105, 100, 32, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 102, 105, 120, 95, 105, 110, 95, 98, 117, 102, 102, 101, 114, 40, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str3117 = allocate([ 40, 109, 95, 98, 105, 116, 115, 95, 108, 101, 102, 116, 32, 38, 32, 55, 41, 32, 61, 61, 32, 48, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder20transform_mcu_expandEi = allocate([ 118, 111, 105, 100, 32, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 116, 114, 97, 110, 115, 102, 111, 114, 109, 95, 109, 99, 117, 95, 101, 120, 112, 97, 110, 100, 40, 105, 110, 116, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str4118 = allocate([ 109, 95, 109, 99, 117, 95, 98, 108, 111, 99, 107, 95, 109, 97, 120, 95, 122, 97, 103, 91, 109, 99, 117, 95, 98, 108, 111, 99, 107, 93, 32, 62, 61, 32, 49, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str5119 = allocate([ 109, 95, 109, 99, 117, 95, 98, 108, 111, 99, 107, 95, 109, 97, 120, 95, 122, 97, 103, 91, 109, 99, 117, 95, 98, 108, 111, 99, 107, 93, 32, 60, 61, 32, 54, 52, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__ZN4jpgdL8s_max_rcE = allocate([ 17, 18, 34, 50, 50, 51, 52, 52, 52, 68, 84, 84, 84, 84, 85, 86, 86, 86, 86, 86, 102, 118, 118, 118, 118, 118, 118, 119, 120, 120, 120, 120, 120, 120, 120, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136, 136 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str6120 = allocate([ 102, 97, 108, 115, 101, 0 ], "i8", ALLOC_STATIC);

__ZN4jpgdL5g_ZAGE = allocate([ 0, 0, 0, 0, 1, 0, 0, 0, 8, 0, 0, 0, 16, 0, 0, 0, 9, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 10, 0, 0, 0, 17, 0, 0, 0, 24, 0, 0, 0, 32, 0, 0, 0, 25, 0, 0, 0, 18, 0, 0, 0, 11, 0, 0, 0, 4, 0, 0, 0, 5, 0, 0, 0, 12, 0, 0, 0, 19, 0, 0, 0, 26, 0, 0, 0, 33, 0, 0, 0, 40, 0, 0, 0, 48, 0, 0, 0, 41, 0, 0, 0, 34, 0, 0, 0, 27, 0, 0, 0, 20, 0, 0, 0, 13, 0, 0, 0, 6, 0, 0, 0, 7, 0, 0, 0, 14, 0, 0, 0, 21, 0, 0, 0, 28, 0, 0, 0, 35, 0, 0, 0, 42, 0, 0, 0, 49, 0, 0, 0, 56, 0, 0, 0, 57, 0, 0, 0, 50, 0, 0, 0, 43, 0, 0, 0, 36, 0, 0, 0, 29, 0, 0, 0, 22, 0, 0, 0, 15, 0, 0, 0, 23, 0, 0, 0, 30, 0, 0, 0, 37, 0, 0, 0, 44, 0, 0, 0, 51, 0, 0, 0, 58, 0, 0, 0, 59, 0, 0, 0, 52, 0, 0, 0, 45, 0, 0, 0, 38, 0, 0, 0, 31, 0, 0, 0, 39, 0, 0, 0, 46, 0, 0, 0, 53, 0, 0, 0, 60, 0, 0, 0, 61, 0, 0, 0, 54, 0, 0, 0, 47, 0, 0, 0, 55, 0, 0, 0, 62, 0, 0, 0, 63, 0, 0, 0 ], [ "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0 ], ALLOC_STATIC);

__ZN4jpgdL13s_extend_testE = allocate([ 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 8, 0, 0, 0, 16, 0, 0, 0, 32, 0, 0, 0, 64, 0, 0, 0, 128, 0, 0, 0, 256, 0, 0, 0, 512, 0, 0, 0, 1024, 0, 0, 0, 2048, 0, 0, 0, 4096, 0, 0, 0, 8192, 0, 0, 0, 16384, 0, 0, 0 ], [ "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0 ], ALLOC_STATIC);

__ZN4jpgdL15s_extend_offsetE = allocate([ 0, 0, 0, 0, -1, 0, 0, 0, -3, 0, 0, 0, -7, 0, 0, 0, -15, 0, 0, 0, -31, 0, 0, 0, -63, 0, 0, 0, -127, 0, 0, 0, -255, 0, 0, 0, -511, 0, 0, 0, -1023, 0, 0, 0, -2047, 0, 0, 0, -4095, 0, 0, 0, -8191, 0, 0, 0, -16383, 0, 0, 0, -32767, 0, 0, 0 ], [ "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0 ], ALLOC_STATIC);

STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder15decode_next_rowEv = allocate([ 118, 111, 105, 100, 32, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 100, 101, 99, 111, 100, 101, 95, 110, 101, 120, 116, 95, 114, 111, 119, 40, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str7121 = allocate([ 107, 32, 60, 32, 54, 52, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str8122 = allocate([ 107, 116, 32, 60, 61, 32, 54, 51, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str9123 = allocate([ 112, 91, 103, 95, 90, 65, 71, 91, 107, 93, 93, 32, 61, 61, 32, 48, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder15make_huff_tableEiPNS0_11huff_tablesE = allocate([ 118, 111, 105, 100, 32, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 109, 97, 107, 101, 95, 104, 117, 102, 102, 95, 116, 97, 98, 108, 101, 40, 105, 110, 116, 44, 32, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 104, 117, 102, 102, 95, 116, 97, 98, 108, 101, 115, 32, 42, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str11125 = allocate([ 101, 120, 116, 114, 97, 95, 98, 105, 116, 115, 32, 60, 61, 32, 48, 120, 55, 70, 70, 70, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder22decode_block_ac_refineEPS0_iii = allocate([ 115, 116, 97, 116, 105, 99, 32, 118, 111, 105, 100, 32, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 100, 101, 99, 111, 100, 101, 95, 98, 108, 111, 99, 107, 95, 97, 99, 95, 114, 101, 102, 105, 110, 101, 40, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 32, 42, 44, 32, 105, 110, 116, 44, 32, 105, 110, 116, 44, 32, 105, 110, 116, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str12126 = allocate([ 112, 68, 45, 62, 109, 95, 115, 112, 101, 99, 116, 114, 97, 108, 95, 101, 110, 100, 32, 60, 61, 32, 54, 51, 0 ], "i8", ALLOC_STATIC);

__ZTVN4jpgd24jpeg_decoder_file_streamE = allocate([ 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 12, 0, 0, 0, 14, 0, 0, 0 ], [ "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0 ], ALLOC_STATIC);

allocate(1, "void*", ALLOC_STATIC);

STRING_TABLE.__str13127 = allocate([ 114, 98, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__ZTSN4jpgd19jpeg_decoder_streamE = allocate([ 78, 52, 106, 112, 103, 100, 49, 57, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 95, 115, 116, 114, 101, 97, 109, 69, 0 ], "i8", ALLOC_STATIC);

__ZTIN4jpgd19jpeg_decoder_streamE = allocate(8, "*", ALLOC_STATIC);

STRING_TABLE.__ZTSN4jpgd24jpeg_decoder_file_streamE = allocate([ 78, 52, 106, 112, 103, 100, 50, 52, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 95, 102, 105, 108, 101, 95, 115, 116, 114, 101, 97, 109, 69, 0 ], "i8", ALLOC_STATIC);

__ZTIN4jpgd24jpeg_decoder_file_streamE = allocate(12, "*", ALLOC_STATIC);

__ZTVN4jpgd19jpeg_decoder_streamE = allocate([ 0, 0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0, 18, 0, 0, 0, 20, 0, 0, 0 ], [ "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0 ], ALLOC_STATIC);

allocate(1, "void*", ALLOC_STATIC);

STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder14coeff_buf_getpEPNS0_9coeff_bufEii = allocate([ 106, 112, 103, 100, 95, 98, 108, 111, 99, 107, 95, 116, 32, 42, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 99, 111, 101, 102, 102, 95, 98, 117, 102, 95, 103, 101, 116, 112, 40, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 99, 111, 101, 102, 102, 95, 98, 117, 102, 32, 42, 44, 32, 105, 110, 116, 44, 32, 105, 110, 116, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str14128 = allocate([ 40, 98, 108, 111, 99, 107, 95, 120, 32, 60, 32, 99, 98, 45, 62, 98, 108, 111, 99, 107, 95, 110, 117, 109, 95, 120, 41, 32, 38, 38, 32, 40, 98, 108, 111, 99, 107, 95, 121, 32, 60, 32, 99, 98, 45, 62, 98, 108, 111, 99, 107, 95, 110, 117, 109, 95, 121, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesERi = allocate([ 105, 110, 116, 32, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 104, 117, 102, 102, 95, 100, 101, 99, 111, 100, 101, 40, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 104, 117, 102, 102, 95, 116, 97, 98, 108, 101, 115, 32, 42, 44, 32, 105, 110, 116, 32, 38, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str15129 = allocate([ 40, 40, 115, 121, 109, 98, 111, 108, 32, 62, 62, 32, 56, 41, 32, 38, 32, 51, 49, 41, 32, 61, 61, 32, 112, 72, 45, 62, 99, 111, 100, 101, 95, 115, 105, 122, 101, 91, 115, 121, 109, 98, 111, 108, 32, 38, 32, 50, 53, 53, 93, 32, 43, 32, 40, 40, 115, 121, 109, 98, 111, 108, 32, 38, 32, 48, 120, 56, 48, 48, 48, 41, 32, 63, 32, 40, 115, 121, 109, 98, 111, 108, 32, 38, 32, 49, 53, 41, 32, 58, 32, 48, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder19get_bits_no_markersEi = allocate([ 117, 105, 110, 116, 32, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 103, 101, 116, 95, 98, 105, 116, 115, 95, 110, 111, 95, 109, 97, 114, 107, 101, 114, 115, 40, 105, 110, 116, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__str16130 = allocate([ 109, 95, 98, 105, 116, 115, 95, 108, 101, 102, 116, 32, 62, 61, 32, 48, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.___PRETTY_FUNCTION____ZN4jpgd12jpeg_decoder8get_bitsEi = allocate([ 117, 105, 110, 116, 32, 106, 112, 103, 100, 58, 58, 106, 112, 101, 103, 95, 100, 101, 99, 111, 100, 101, 114, 58, 58, 103, 101, 116, 95, 98, 105, 116, 115, 40, 105, 110, 116, 41, 0 ], "i8", ALLOC_STATIC);

STRING_TABLE.__ZTSN10__cxxabiv116__shim_type_infoE = allocate([ 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 54, 95, 95, 115, 104, 105, 109, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0 ], "i8", ALLOC_STATIC);

__ZTIN10__cxxabiv116__shim_type_infoE = allocate(12, "*", ALLOC_STATIC);

STRING_TABLE.__ZTSN10__cxxabiv117__class_type_infoE = allocate([ 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 55, 95, 95, 99, 108, 97, 115, 115, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0 ], "i8", ALLOC_STATIC);

__ZTIN10__cxxabiv117__class_type_infoE = allocate(12, "*", ALLOC_STATIC);

__ZTVN10__cxxabiv117__class_type_infoE = allocate([ 0, 0, 0, 0, 0, 0, 0, 0, 22, 0, 0, 0, 24, 0, 0, 0, 26, 0, 0, 0, 28, 0, 0, 0, 30, 0, 0, 0, 32, 0, 0, 0 ], [ "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0 ], ALLOC_STATIC);

allocate(1, "void*", ALLOC_STATIC);

__ZTVN10__cxxabiv120__si_class_type_infoE = allocate([ 0, 0, 0, 0, 0, 0, 0, 0, 22, 0, 0, 0, 34, 0, 0, 0, 26, 0, 0, 0, 36, 0, 0, 0, 38, 0, 0, 0, 40, 0, 0, 0 ], [ "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0 ], ALLOC_STATIC);

allocate(1, "void*", ALLOC_STATIC);

STRING_TABLE.__ZTSN10__cxxabiv120__si_class_type_infoE = allocate([ 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 50, 48, 95, 95, 115, 105, 95, 99, 108, 97, 115, 115, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0 ], "i8", ALLOC_STATIC);

__ZTIN10__cxxabiv120__si_class_type_infoE = allocate(12, "*", ALLOC_STATIC);

__gm_ = allocate(468, [ "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "*", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "i32", 0, 0, 0, "*", 0, 0, 0, "i32", 0, 0, 0, "*", 0, 0, 0, "i32", 0, 0, 0, "*", 0, 0, 0, "i32", 0, 0, 0 ], ALLOC_STATIC);

_mparams = allocate(24, "i32", ALLOC_STATIC);

HEAP32[__ZTVN4jpgd24jpeg_decoder_file_streamE + 4 >> 2] = __ZTIN4jpgd24jpeg_decoder_file_streamE;

HEAP32[__ZTIN4jpgd19jpeg_decoder_streamE >> 2] = __ZTVN10__cxxabiv117__class_type_infoE + 8 | 0;

HEAP32[__ZTIN4jpgd19jpeg_decoder_streamE + 4 >> 2] = STRING_TABLE.__ZTSN4jpgd19jpeg_decoder_streamE | 0;

HEAP32[__ZTIN4jpgd24jpeg_decoder_file_streamE >> 2] = __ZTVN10__cxxabiv120__si_class_type_infoE + 8 | 0;

HEAP32[__ZTIN4jpgd24jpeg_decoder_file_streamE + 4 >> 2] = STRING_TABLE.__ZTSN4jpgd24jpeg_decoder_file_streamE | 0;

HEAP32[__ZTIN4jpgd24jpeg_decoder_file_streamE + 8 >> 2] = __ZTIN4jpgd19jpeg_decoder_streamE;

HEAP32[__ZTVN4jpgd19jpeg_decoder_streamE + 4 >> 2] = __ZTIN4jpgd19jpeg_decoder_streamE;

HEAP32[__ZTIN10__cxxabiv116__shim_type_infoE >> 2] = __ZTVN10__cxxabiv120__si_class_type_infoE + 8 | 0;

HEAP32[__ZTIN10__cxxabiv116__shim_type_infoE + 4 >> 2] = STRING_TABLE.__ZTSN10__cxxabiv116__shim_type_infoE | 0;

HEAP32[__ZTIN10__cxxabiv116__shim_type_infoE + 8 >> 2] = __ZTISt9type_info;

HEAP32[__ZTIN10__cxxabiv117__class_type_infoE >> 2] = __ZTVN10__cxxabiv120__si_class_type_infoE + 8 | 0;

HEAP32[__ZTIN10__cxxabiv117__class_type_infoE + 4 >> 2] = STRING_TABLE.__ZTSN10__cxxabiv117__class_type_infoE | 0;

HEAP32[__ZTIN10__cxxabiv117__class_type_infoE + 8 >> 2] = __ZTIN10__cxxabiv116__shim_type_infoE;

HEAP32[__ZTVN10__cxxabiv117__class_type_infoE + 4 >> 2] = __ZTIN10__cxxabiv117__class_type_infoE;

HEAP32[__ZTVN10__cxxabiv120__si_class_type_infoE + 4 >> 2] = __ZTIN10__cxxabiv120__si_class_type_infoE;

HEAP32[__ZTIN10__cxxabiv120__si_class_type_infoE >> 2] = __ZTVN10__cxxabiv120__si_class_type_infoE + 8 | 0;

HEAP32[__ZTIN10__cxxabiv120__si_class_type_infoE + 4 >> 2] = STRING_TABLE.__ZTSN10__cxxabiv120__si_class_type_infoE | 0;

HEAP32[__ZTIN10__cxxabiv120__si_class_type_infoE + 8 >> 2] = __ZTIN10__cxxabiv117__class_type_infoE;

FUNCTION_TABLE = [ 0, 0, __ZN4jpgd12jpeg_decoder22decode_block_dc_refineEPS0_iii, 0, __ZN4jpgd12jpeg_decoder21decode_block_dc_firstEPS0_iii, 0, __ZN4jpgd12jpeg_decoder22decode_block_ac_refineEPS0_iii, 0, __ZN4jpgd12jpeg_decoder21decode_block_ac_firstEPS0_iii, 0, __ZN4jpgd24jpeg_decoder_file_streamD2Ev, 0, __ZN4jpgd24jpeg_decoder_file_streamD0Ev, 0, __ZN4jpgd24jpeg_decoder_file_stream4readEPhiPb, 0, __ZN4jpgd19jpeg_decoder_streamD1Ev, 0, __ZN4jpgd19jpeg_decoder_streamD0Ev, 0, ___cxa_pure_virtual, 0, __ZN10__cxxabiv116__shim_type_infoD2Ev, 0, __ZN10__cxxabiv117__class_type_infoD0Ev, 0, __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv, 0, __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i, 0, __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvi, 0, __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi, 0, __ZN10__cxxabiv120__si_class_type_infoD0Ev, 0, __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i, 0, __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvi, 0, __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi, 0 ];

Module["FUNCTION_TABLE"] = FUNCTION_TABLE;

function run(args) {
  args = args || Module["arguments"];
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
    while (Module["preRun"].length > 0) {
      Module["preRun"].pop()();
      if (runDependencies > 0) {
        return 0;
      }
    }
  }
  function doRun() {
    var ret = 0;
    if (Module["_main"]) {
      preMain();
      ret = Module.callMain(args);
      if (!Module["noExitRuntime"]) {
        exitRuntime();
      }
    }
    if (Module["postRun"]) {
      if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
      while (Module["postRun"].length > 0) {
        Module["postRun"].pop()();
      }
    }
    return ret;
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout((function() {
      setTimeout((function() {
        Module["setStatus"]("");
      }), 1);
      doRun();
    }), 1);
    return 0;
  } else {
    return doRun();
  }
}

Module["run"] = run;

initRuntime();

if (Module["noInitialRun"]) {
  addRunDependency();
}

if (runDependencies == 0) {
  var ret = run();
}
// EMSCRIPTEN_GENERATED_FUNCTIONS: ["__ZN4jpgd3RowILi1EE4idctEPiPKs","__ZN4jpgd3RowILi2EE4idctEPiPKs","__ZN4jpgd3RowILi3EE4idctEPiPKs","__ZN4jpgd3RowILi4EE4idctEPiPKs","__ZN4jpgd3RowILi5EE4idctEPiPKs","__ZN4jpgd3RowILi6EE4idctEPiPKs","__ZN4jpgd3RowILi7EE4idctEPiPKs","__ZN4jpgd3RowILi8EE4idctEPiPKs","__ZN4jpgd3ColILi1EE4idctEPhPKi","__ZN4jpgd3ColILi2EE4idctEPhPKi","_main","__ZN4jpgd4idctEPKsPhi","__ZN4jpgd3ColILi3EE4idctEPhPKi","__ZN4jpgd3ColILi4EE4idctEPhPKi","__ZN4jpgd3ColILi5EE4idctEPhPKi","__ZN4jpgd3ColILi6EE4idctEPhPKi","__ZN4jpgd3ColILi7EE4idctEPhPKi","__ZN4jpgd3ColILi8EE4idctEPhPKi","__ZN4jpgd12jpeg_decoder10word_clearEPvtj","__ZN4jpgd8idct_4x4EPKsPh","__ZN4jpgd12jpeg_decoder15free_all_blocksEv","__ZN4jpgdL9jpgd_freeEPv","__ZN4jpgd12jpeg_decoder13stop_decodingENS_11jpgd_statusE","__ZN4jpgdL11jpgd_mallocEj","__ZN4jpgd12jpeg_decoder8get_bitsEi","__ZN4jpgd12jpeg_decoder11next_markerEv","__ZN4jpgd12jpeg_decoder5allocEjb","__ZN4jpgd12jpeg_decoder14prep_in_bufferEv","__ZN4jpgd12jpeg_decoder15read_dht_markerEv","__ZN4jpgd12jpeg_decoder15read_dqt_markerEv","__ZN4jpgd12jpeg_decoder15read_sof_markerEv","__ZN4jpgd12jpeg_decoder20skip_variable_markerEv","__ZN4jpgd12jpeg_decoder15read_dri_markerEv","__ZN4jpgd12jpeg_decoder15read_sos_markerEv","__ZN4jpgd12jpeg_decoder15process_markersEv","__ZN4jpgd12jpeg_decoder15create_look_upsEv","__ZN4jpgd12jpeg_decoder10stuff_charEh","__ZN4jpgd12jpeg_decoder4initEPNS_19jpeg_decoder_streamE","__ZN4jpgd12jpeg_decoder13fix_in_bufferEv","__ZN4jpgd12jpeg_decoder19get_bits_no_markersEi","__ZN4jpgd12jpeg_decoder13transform_mcuEi","__ZN4jpgd12jpeg_decoder20transform_mcu_expandEi","__ZN4jpgd12DCT_Upsample3P_QILi1ELi1EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi1ELi1EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi1ELi2EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi1ELi2EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12jpeg_decoder17locate_soi_markerEv","__ZN4jpgd12jpeg_decoder17locate_sof_markerEv","__ZN4jpgd12jpeg_decoder17locate_sos_markerEv","__ZN4jpgd12DCT_Upsample3P_QILi2ELi2EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi2ELi2EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi3ELi2EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi3ELi2EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi3ELi3EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi3ELi3EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi3ELi4EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi3ELi4EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi4ELi4EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi4ELi4EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi5ELi4EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi5ELi4EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi5ELi5EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi5ELi5EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi5ELi6EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi5ELi6EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi6ELi6EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi6ELi6EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi7ELi6EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi7ELi6EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi7ELi7EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi7ELi7EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi7ELi8EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi7ELi8EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3P_QILi8ELi8EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgd12DCT_Upsample3R_SILi8ELi8EE4calcERNS0_8Matrix44ES4_PKs","__ZN4jpgdL13dequantize_acEii","__ZN4jpgd12jpeg_decoder5clampEi","__ZN4jpgd12DCT_UpsampleplERKNS0_8Matrix44ES3_","__ZN4jpgd12DCT_Upsample8Matrix44mIERKS1_","__ZN4jpgd12DCT_Upsample8Matrix4413add_and_storeEPsRKS1_S4_","__ZN4jpgd12DCT_Upsample8Matrix4413sub_and_storeEPsRKS1_S4_","__ZN4jpgd12jpeg_decoder13load_next_rowEv","__ZN4jpgd12jpeg_decoder14coeff_buf_getpEPNS0_9coeff_bufEii","__ZN4jpgd12jpeg_decoder8get_charEv","__ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesERi","__ZN4jpgd12jpeg_decoder11H1V1ConvertEv","__ZN4jpgd12jpeg_decoder15process_restartEv","__ZN4jpgd12jpeg_decoder15decode_next_rowEv","__ZN4jpgd12jpeg_decoder12gray_convertEv","__ZN4jpgd12jpeg_decoder11H2V1ConvertEv","__ZN4jpgd12jpeg_decoder11H1V2ConvertEv","__ZN4jpgd12jpeg_decoder11H2V2ConvertEv","__ZN4jpgd12jpeg_decoder16expanded_convertEv","__ZN4jpgd12jpeg_decoder8find_eoiEv","__ZN4jpgd12jpeg_decoder6decodeEPPKvPj","__ZN4jpgd12jpeg_decoder20calc_mcu_block_orderEv","__ZN4jpgd12jpeg_decoder15make_huff_tableEiPNS0_11huff_tablesE","__ZN4jpgd12jpeg_decoder9init_scanEv","__ZN4jpgd12jpeg_decoder14coeff_buf_openEiiii","__ZN4jpgd12jpeg_decoder21decode_block_dc_firstEPS0_iii","__ZN4jpgd12jpeg_decoder11huff_decodeEPNS0_11huff_tablesE","__ZN4jpgd12jpeg_decoder22decode_block_dc_refineEPS0_iii","__ZN4jpgd12jpeg_decoder18check_quant_tablesEv","__ZN4jpgd12jpeg_decoder17check_huff_tablesEv","__ZN4jpgd12jpeg_decoder10init_frameEv","__ZNK4jpgd12jpeg_decoder14get_error_codeEv","__ZNK4jpgd12jpeg_decoder9get_widthEv","__ZNK4jpgd12jpeg_decoder10get_heightEv","__ZNK4jpgd12jpeg_decoder18get_num_componentsEv","__ZN4jpgd19jpeg_decoder_streamC2Ev","__ZN4jpgd12jpeg_decoder11decode_scanEPFvPS0_iiiE","__ZN4jpgd12jpeg_decoder12decode_startEv","__ZN4jpgd12jpeg_decoder11decode_initEPNS_19jpeg_decoder_streamE","__ZN4jpgd12jpeg_decoderC2EPNS_19jpeg_decoder_streamE","__ZN4jpgd12jpeg_decoder14begin_decodingEv","__ZN4jpgd12jpeg_decoderD2Ev","__ZN4jpgd24jpeg_decoder_file_streamC2Ev","__ZN4jpgd24jpeg_decoder_file_stream5closeEv","__ZN4jpgd24jpeg_decoder_file_streamD0Ev","__ZN4jpgd24jpeg_decoder_file_streamD2Ev","__ZN4jpgd24jpeg_decoder_file_stream4openEPKc","__ZN4jpgd24jpeg_decoder_file_stream4readEPhiPb","__ZN4jpgd33decompress_jpeg_image_from_streamEPNS_19jpeg_decoder_streamEPiS2_S2_i","__ZN4jpgd12jpeg_decoder21decode_block_ac_firstEPS0_iii","__ZN4jpgd12jpeg_decoder22decode_block_ac_refineEPS0_iii","__ZN4jpgd12jpeg_decoder16init_progressiveEv","__ZN4jpgd12jpeg_decoder15init_sequentialEv","__ZN4jpgd19jpeg_decoder_streamD1Ev","__ZN4jpgd12DCT_Upsample8Matrix442atEii","__ZNK4jpgd12DCT_Upsample8Matrix442atEii","__ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi","__ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i","__ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi","__ZN4jpgd31decompress_jpeg_image_from_fileEPKcPiS2_S2_i","__ZN4jpgd19jpeg_decoder_streamD0Ev","__ZN4jpgd12jpeg_decoder9get_octetEv","__ZN4jpgd12jpeg_decoder8get_charEPb","__ZN10__cxxabiv116__shim_type_infoD2Ev","__ZN10__cxxabiv117__class_type_infoD0Ev","__ZN10__cxxabiv120__si_class_type_infoD0Ev","__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv","__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi","__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi","___dynamic_cast","__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvi","__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvi","__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i","__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i","_malloc","_tmalloc_small","_sys_alloc","_tmalloc_large","_release_unused_segments","_sys_trim","_free","_segment_holding","_init_top","_init_bins","__ZdlPv","_init_mparams","_prepend_alloc","_add_segment"]
return Module.return;
  }
