import {Emoji} from "./Emoji";

export class EmojisDirectory {
	constructor() {
		this._emojisList = new Map();
		this._symbol = null;
		this._emojiclass = Emoji;
	}
	
	addEmoji(emoji) {
		this._emojisList.set(emoji.name, emoji);
	}

	getEmoji(emojiName) {
		return this._emojisList.get(emoji.name);
	}

	deleteEmoji(emojiName) {
		return this._emojisList.delete(emoji.name, emoji);
	}
	
	setSeparateSymbol(symbol) {
		this._symbol = symbol;
	}

	get separateSymbol () {
		return this._symbol;
	}

	parseEmojis(text) {
		let ret = "";
		let betweenSymbols = false;
		let n = 0;
		console.log("n", n)
		for (const part of text.split(this._symbol)) {
			console.log(part)
			console.log(n)
			console.log(betweenSymbols)
			n++;
			if (betweenSymbols && text.split(this._symbol).length !== n) {
				if (part.includes(" ")) {
					ret += this._symbol + part;
					continue; // in "I am :really happy:happy:", we don't replace "really happy"
				} 
				for (const emoji in this._emojisList) {
					if (emoji.name == part) {
						ret += emoji.emoji();
					}
				}
			} else {
				ret += (n == 1 ? "" : this._symbol) + part;
			};
			betweenSymbols = !betweenSymbols; // in "I :am:really:happy:", the double points are for am and happy
		}
		return ret;
	}

}
