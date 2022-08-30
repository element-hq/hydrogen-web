/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import type { SynapseInstance } from "../plugins/synapsedocker";

describe("Login", () => {
    let synapse: SynapseInstance;

    beforeEach(() => {
        cy.startSynapse("consent").then((data) => {
            synapse = data;
        });
    });

    it("Login using username/password", () => {
        const username = "foobaraccount";
        const password = "password123";
        cy.registerUser(synapse, username, password);
        cy.visit("/");
        cy.get("#homeserver").clear().type(synapse.baseUrl);
        cy.get("#username").clear().type(username);
        cy.get("#password").clear().type(password);
        cy.contains("Log In").click();
        cy.get(".SessionView");
    });
});

