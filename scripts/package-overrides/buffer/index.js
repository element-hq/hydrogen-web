var Buffer = {
    isBuffer: function(array) {return array instanceof Uint8Array;},
    from: function(arrayBuffer) {return arrayBuffer;},
    allocUnsafe: function(size) {return Buffer.alloc(size);},
    alloc: function(size) {return new Uint8Array(size);}
};
export default Buffer;
