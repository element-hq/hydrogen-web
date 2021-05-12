/*
The regex is split into component strings;
meaning that any escapes (\) must also
be escaped.
*/
const scheme = "(?:https|http|ftp):\\/\\/";
const host = "[a-zA-Z0-9:.\\[\\]-]";

/*
A URL containing path (/) or fragment (#) component
is allowed to end with any character which is not 
space nor punctuation. The ending character may be 
non-ASCII.
*/
const end = "[^\\s.,?!]";
const additional = `[\\/#][^\\s]*${end}`;

/*
Similarly, a URL not containing path or fragment must
also end with a character that is not space nor punctuation.
Additionally, the ending character must also be ASCII.
*/
const nonASCII = "\\u{80}-\\u{10ffff}";
const endASCII = `[^\\s${nonASCII}.,?!]`;

/*
Things to keep in mind:
1.  URL must not contain non-ascii characters in host but may contain
    them in path or fragment components.
    https://matrix.org/<smiley> - valid
    https://matrix.org<smiley> - invalid
2. Do not treat punctuation at the end as a part of the URL (.,?!)
*/
const urlRegex = `${scheme}${host}+(?:${additional}|${endASCII})`;

export const regex = new RegExp(urlRegex, "gui");
