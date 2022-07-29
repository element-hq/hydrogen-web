import {Emoji} from "./Emoji";
import {default_emojis} from "./emojis";

export class EmojisDirectory {
	constructor() {
		this._emojisList = new Map();
		this._symbol = null;
		this._emojiclass = Emoji;
	}
	
	init() {
		let emojiIndex = 0;
		for () {
			for (const emojilist of emojis) {
				
				this.addEmoji(new Emoji(...emoji));
			}
		}
		this.setSeparateSymbol(':');
	}
	
	addEmoji(emoji) {
		this._emojisList.set(emoji.name, emoji);
	}

	getEmoji(emojiName) {
		return this._emojisList.get(emojiName);
	}

	deleteEmoji(emojiName) {
		return this._emojisList.delete(emojiName);
	}
	
	setSeparateSymbol(symbol) {
		this._symbol = symbol;
	}

	get separateSymbol () {
		return this._symbol;
	}

	parseEmojis(text) {
		let ret = "";
		let n = 0;
		let lastWasEmoji = true; // no double points available
		for (const part of text.split(this._symbol)) {
			n++;
			if (!lastWasEmoji) { // because the double points belongs to emojis. If the last one was an emoji, the actual part is not an emoji.
				if (part.includes(" ")) {
					ret += this._symbol + part;
					lastWasEmoji = false;
					continue; // in "I am :really happy:happy:", we don't replace "really happy". We always consider that the next one can be an emoji.
				} 
				for (const emoji of this._emojisList.keys()) {
					if (emoji == part) {
						ret += this._emojisList.get(part).emoji;
						lastWasEmoji = true;
					}
				}
				if (!lastWasEmoji) { // no emoji found, consider as it was two single double points.
					ret += (n !== 1 && !lastWasEmoji ? this._symbol : "") + part;
					lastWasEmoji = false;
				}
			} else {
				ret += (n !== 1 && !lastWasEmoji ? this._symbol : "") + part;// if the last was an emoji, the double points shouldn't been added, they're part of the emoji.
				lastWasEmoji = false;
			}
		}
		console.log(text, ret);
		return ret;
	}

	searchEmojis(emojiName) {
		let ret = new Array();
		for (const emoname of this._emojisList.keys()) {
			if (emoname.includes(emojiName)) {
				ret.push(this._emojisList.get(emoname));
			}
		}
		return ret;
	}

}
