/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {test} from '@playwright/test';
import {synapseStart, synapseStop, registerUser} from "../plugins/synapsedocker";
import {dexStart, dexStop} from "../plugins/dex";
import type {DexInstance} from "../plugins/dex";
import type {SynapseInstance} from "../plugins/synapsedocker";

test.describe("Login", () => {
    let synapse: SynapseInstance;
    let dex: DexInstance;

    test.beforeEach(async () => {
        dex = await dexStart();
        synapse = await synapseStart("sso");
    });    

    test.afterEach(async () => {
        await synapseStop(synapse.synapseId);
        await dexStop(dex.dexId);
    });

    test("Login using username/password", async ({ page }) => {
        const username = "foobaraccount";
        const password = "password123";
        await registerUser(synapse, username, password);
        await page.goto("/");
        await page.locator("#homeserver").fill("");
        await page.locator("#homeserver").type(synapse.baseUrl);
        await page.locator("#username").type(username);
        await page.locator("#password").type(password);
        await page.getByText('Log In', { exact: true }).click();
        await page.locator(".SessionView").waitFor();
    });

    test("Login using SSO", async ({ page }) => {
        await page.goto("/");
        await page.locator("#homeserver").fill("");
        await page.locator("#homeserver").type(synapse.baseUrl);
        await page.locator(".StartSSOLoginView_button").click();
        await page.getByText("Log in with Example").click();
        await page.locator(".dex-btn-text", {hasText: "Grant Access"}).click();
        await page.locator(".primary-button", {hasText: "Continue"}).click();
        await page.locator(".SessionView").waitFor();
    });
});
