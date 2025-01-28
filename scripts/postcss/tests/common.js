/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const postcss = require("postcss");

module.exports.createTestRunner = function (plugin) {
    return async function run(input, output, opts = {}, assert) {
        let result = await postcss([plugin(opts)]).process(input, { from: undefined, });
        assert.strictEqual(
            result.css.replaceAll(/\s/g, ""),
            output.replaceAll(/\s/g, "")
        );
        assert.strictEqual(result.warnings().length, 0);
    };
}


