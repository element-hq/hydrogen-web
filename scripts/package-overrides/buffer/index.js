module.exports = class Buffer {
    static isBuffer() {return false;}
    static from(arrayBuffer) {return arrayBuffer;}
    static allocUnsafe(size) {return Buffer.alloc(size);}
    static alloc(size) {return new Uint8Array(size);}
};
