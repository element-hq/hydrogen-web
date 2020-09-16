module.exports = class Buffer {
    static isBuffer(array) {return array instanceof Uint8Array;}
    static from(arrayBuffer) {return arrayBuffer;}
    static allocUnsafe(size) {return Buffer.alloc(size);}
    static alloc(size) {return new Uint8Array(size);}
};
