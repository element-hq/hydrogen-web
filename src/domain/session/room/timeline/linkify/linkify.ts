/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { regex } from "./regex.js";

/**
 * Splits text into links and non-links.
 * For each such separated token, callback is called
 * with the token and a boolean passed as argument.
 * The boolean indicates whether the token is a link or not.
 */
export function linkify(text: string, callback: (token: string, isLink: boolean) => void): void {
    const matches = text.matchAll(regex);
    let curr = 0;
    for (let match of matches) {
        const precedingText = text.slice(curr, match.index);
        callback(precedingText, false);
        callback(match[0], true);
        const len = match[0].length;
        curr = match.index! + len;
    }
    const remainingText = text.slice(curr);
    callback(remainingText, false);
}

export function tests(): any {

    class MockCallback {
        result: { type: "link" | "text", text: string }[];

        mockCallback(text: string, isLink: boolean): void {
            if (!text.length) {
                return;
            }
            if (!this.result) {
                this.result = [];
            }
            const type = isLink ? "link" : "text";
            this.result.push({ type: type, text: text });
        }
    }

    function test(assert, input, output): void {
        const m = new MockCallback;
        linkify(input, m.mockCallback.bind(m));
        assert.deepEqual(output, m.result);
    }

    function testLink(assert, link, expectFail = false): void {
        const input = link;
        const output = expectFail ? [{ type: "text", text: input }] :
            [{ type: "link", text: input }];
        test(assert, input, output);
    }

    return {
        "Link with host": (assert): void => {
            testLink(assert, "https://matrix.org");
        },

        "Link with host & path": (assert): void => {
            testLink(assert, "https://matrix.org/docs/develop");
        },

        "Link with host & fragment": (assert): void => {
            testLink(assert, "https://matrix.org#test");
        },

        "Link with host & query": (assert): void => {
            testLink(assert, "https://matrix.org/?foo=bar");
        },

        "Complex link": (assert): void => {
            const link = "https://www.foobar.com/url?sa=t&rct=j&q=&esrc=s&source" +
                "=web&cd=&cad=rja&uact=8&ved=2ahUKEwjyu7DJ-LHwAhUQyzgGHc" +
                "OKA70QFjAAegQIBBAD&url=https%3A%2F%2Fmatrix.org%2Fdocs%" +
                "2Fprojects%2Fclient%2Felement%2F&usg=AOvVaw0xpENrPHv_R-" +
                "ERkyacR2Bd";
            testLink(assert, link);
        },

        "Localhost link": (assert): void => {
            testLink(assert, "http://localhost");
            testLink(assert, "http://localhost:3000");
        },

        "IPV4 link": (assert): void => {
            testLink(assert, "https://192.0.0.1");
            testLink(assert, "https://250.123.67.23:5924");
        },

        "IPV6 link": (assert): void => {
            testLink(assert, "http://[2001:0db8:85a3:0000:0000:8a2e:0370:7334]");
            testLink(assert, "http://[2001:0db8:85a3:0000:0000:8a2e:0370:7334]:7000");
        },

        "Missing scheme must not linkify": (assert): void => {
            testLink(assert, "matrix.org/foo/bar", true);
        },

        "Punctuation at end of link must not linkify": (assert): void => {
            const link = "https://foo.bar/?nenjil=lal810";
            const end = ".,? ";
            for (const char of end) {
                const out = [{ type: "link", text: link }, { type: "text", text: char }];
                test(assert, link + char, out);
            }
        },

        "Link doesn't adopt closing parenthesis": (assert): void => {
            const link = "(https://matrix.org)";
            const out = [{ type: "text", text: "(" }, { type: "link", text: "https://matrix.org" }, { type: "text", text: ")" }];
            test(assert, link, out);
        },

        "Unicode in hostname must not linkify": (assert): void => {
            const link = "https://foo.bar\uD83D\uDE03.com";
            const out = [{ type: "link", text: "https://foo.bar" },
            { type: "text", text: "\uD83D\uDE03.com" }];
            test(assert, link, out);
        },

        "Link with unicode only after / must linkify": (assert): void => {
            testLink(assert, "https://foo.bar.com/\uD83D\uDE03");
        },

        "Link with unicode after fragment without path must linkify": (assert): void => {
            testLink(assert, "https://foo.bar.com#\uD83D\uDE03");
        },

        "Link ends with <": (assert): void => {
            const link = "https://matrix.org<";
            const out = [{ type: "link", text: "https://matrix.org" }, { type: "text", text: "<" }];
            test(assert, link, out);
        }
    };
}
