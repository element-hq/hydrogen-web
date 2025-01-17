/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {test} from '@playwright/test';

test("App has no startup errors that prevent UI render", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Log In", { exact: true }).waitFor();
});
