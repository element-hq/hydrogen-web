
export class Emoji {

	constructor(name, emoji) {
		this._name = name;
		this._emoji = emoji;
	}
	
	get name() {
		return this._name;
	}
	
	get emoji() {
		return this._emoji;
	}
	
}
