
export class Emoji {

    constructor(name, emoji, type) {
        this._name = name;
        this._emoji = emoji;
        this._type = type;
    }
    
    get name() {
        return this._name;
    }
    
    get type() {
        return this._type;
    }
    
    get emoji() {
        return this._emoji;
    }
    
}
