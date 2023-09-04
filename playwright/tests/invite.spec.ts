/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import {test} from '@playwright/test';
import {synapseStart, synapseStop, registerUser} from "../plugins/synapsedocker";
import type {SynapseInstance} from "../plugins/synapsedocker";

test.describe("Login", () => {
    let synapse: SynapseInstance;

    test.beforeEach(async () => {
        synapse = await synapseStart("default");
    });    

    test.afterEach(async () => {
        await synapseStop(synapse.synapseId);
    });

    test("Invite user using /invite command from composer", async ({ page }) => {
        const user1 = ["foobaraccount", "password123"] as const;
        const user2 = ["foobaraccount2", "password123"] as const;
        await registerUser(synapse, ...user1);
        const { userId } = await registerUser(synapse, ...user2);
        await page.goto("/");
        await page.locator("#homeserver").fill("");
        await page.locator("#homeserver").type(synapse.baseUrl);
        const [username, password] = user1;
        await page.locator("#username").type(username);
        await page.locator("#password").type(password);
        await page.getByText("Log In", { exact: true }).click();
        await page.locator(".SessionView").waitFor();
        // Create the room
        await page.getByLabel("Create room").click();
        await page.getByText("Create Room").click();
        await page.locator("#name").type("My Room");
        await page.locator(".CreateRoomView_detailsForm")
            .getByRole("button", { name: "Create room" })
            .click();
        await page.locator(".RoomList")
            .locator("li")
            .first()
            .click();
        await page.locator(".MessageComposer_input textarea").type(`/invite ${userId}`);
        await page.keyboard.press("Enter");
        await page.locator(".AnnouncementView").last().getByText("was invited to the room").waitFor();
    });

    test("Error is shown when using /invite command from composer", async ({ page }) => {
        const user1 = ["foobaraccount", "password123"] as const;
        await registerUser(synapse, ...user1);
        await page.goto("/");
        await page.locator("#homeserver").fill("");
        await page.locator("#homeserver").type(synapse.baseUrl);
        const [username, password] = user1;
        await page.locator("#username").type(username);
        await page.locator("#password").type(password);
        await page.getByText("Log In", { exact: true }).click();
        await page.locator(".SessionView").waitFor();
        // Create the room
        await page.getByLabel("Create room").click();
        await page.getByText("Create Room").click();
        await page.locator("#name").type("My Room");
        await page.locator(".CreateRoomView_detailsForm")
            .getByRole("button", { name: "Create room" })
            .click();
        await page.locator(".RoomList")
            .locator("li")
            .first()
            .click();
        await page.locator(".MessageComposer_input textarea").type("/invite foobar");
        await page.keyboard.press("Enter");
        await page.locator(".RoomView").locator(".ErrorView").waitFor();
    });
});
