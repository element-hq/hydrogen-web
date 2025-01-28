/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
The regex is split into component strings;
meaning that any escapes (\) must also
be escaped.
*/
const scheme = "(?:https|http|ftp):\\/\\/";
const noSpaceNorPunctuation = "[^\\s.,?!)]";
const hostCharacter = "[a-zA-Z0-9:.\\[\\]-]";

/*
Using non-consuming group here to combine two criteria for the last character.
See point 1 below.
*/
const host = `${hostCharacter}*(?=${hostCharacter})${noSpaceNorPunctuation}`;

/*
Use sub groups so we accept just / or #; but if anything comes after it,
it should not end with punctuation or space.
*/
const pathOrFragment = `(?:[\\/#](?:[^\\s]*${noSpaceNorPunctuation})?)`;

/*
Things to keep in mind:
1.  URL must not contain non-ascii characters in host but may contain
    them in path or fragment components.
    https://matrix.org/<smiley> - valid
    https://matrix.org<smiley> - invalid
2. Do not treat punctuation at the end as a part of the URL (.,?!)
3. Path/fragment is optional.
*/
const urlRegex = `${scheme}${host}${pathOrFragment}?`;

export const regex = new RegExp(urlRegex, "gi");
