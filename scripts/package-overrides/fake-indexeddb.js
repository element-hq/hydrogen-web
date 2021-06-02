// we have our own main file for this module as we need both these symbols to
// be exported, and we also don't want to auto behaviour that modifies global vars
exports.FDBFactory = require("fake-indexeddb/lib/FDBFactory.js");
exports.FDBKeyRange = require("fake-indexeddb/lib/FDBKeyRange.js");