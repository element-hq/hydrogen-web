import {openDatabase, txnAsPromise, select} from "../../matrix/storage/idb/utils.js";

function createLogDatabase(db) {
    db.createObjectStore("logs", {keyPath: "start"});
}

export default class IDBLogPersister {
    constructor(db, name) {
        this.db = db;
        this.name = name;
    }

    static async open(name) {
        const db = await openDatabase(name, createLogDatabase, 1);
        return new IDBLogPersister(db, name);
    }

    loadTempItems() {
        const key = `${this.name}_tempItems`;
        const json = window.localStorage.getItem(key);
        if (json) {
            window.localStorage.removeItem(key);
            return JSON.parse(json);
        }
        return [];
    }

    persistItems(items) {
        const txn = this.db.transaction(["logs"], "readwrite");
        const logs = txn.objectStore("logs");
        for(const i of items) {
            logs.add(i);
        }
        return txnAsPromise(txn);
    }

    loadItems() {
        return select(this.db, "logs");
    }

    persistTempItems(items) {
        window.localStorage.setItem(`${this.name}_tempItems`, JSON.stringify(items));
    }

}
