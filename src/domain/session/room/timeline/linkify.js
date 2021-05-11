export function linkify(text, callback) {
    const regex = /(?:https|http|ftp):\/\/[a-zA-Z0-9:.\[\]#-]+(?:\/[^\s]*[^\s.,?!]|[^\s\u{80}-\u{10ffff}.,?!])/gui
    const matches = text.matchAll(regex);
    let curr = 0;
    for (let match of matches) {
        callback(text.slice(curr, match.index), false);
        callback(match[0], true);
        const len = match[0].length;
        curr = match.index + len;
    }
    callback(text.slice(curr), false);
}
