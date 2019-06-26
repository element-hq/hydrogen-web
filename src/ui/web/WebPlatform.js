export default {
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
}
