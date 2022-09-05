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
import type { DexInstance } from "../plugins/dex";
import type { SynapseInstance } from "../plugins/synapsedocker";

describe("Login", () => {
    let synapse: SynapseInstance;
    let dex: DexInstance;

    beforeEach(() => {
        cy.startDex().then((data) => {
            dex = data;
            cy.startSynapse("sso").then((data) => {
                synapse = data;
            });
        });
    });

    afterEach(() => {
        cy.stopSynapse(synapse);
        cy.stopDex(dex);
    })

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

    it.only("Login using SSO", () => {
        /**
         *  Add the homeserver to the localStorage manually; clicking on the start sso button would normally do this but we can't
         *  use two different origins in a single cypress test!    
         */ 
        cy.visit("/");
        cy.window().then(win => win.localStorage.setItem("hydrogen_setting_v1_sso_ongoing_login_homeserver", synapse.baseUrl));
        // Perform the SSO login manually using requests
        const synapseAddress = synapse.baseUrl;
        const dexAddress = dex.baseUrl;
        // const dexAddress = `${Cypress.env("DEX_IP_ADDRESS")}:${Cypress.env("DEX_PORT")}`;
        const redirectAddress = Cypress.config().baseUrl;
        const ssoLoginUrl = `${synapseAddress}/_matrix/client/r0/login/sso/redirect?redirectUrl=${encodeURIComponent(redirectAddress)}`;
        cy.request(ssoLoginUrl).then(response => {
            // Request the Dex page
                const dexPageHtml = response.body;
                const loginWithExampleLink  = Cypress.$(dexPageHtml).find(`a:contains("Log in with Example")`).attr("href");
                cy.log("Login with example link", loginWithExampleLink);
                
                // Proceed to next page
                cy.request(`${dexAddress}${loginWithExampleLink}`).then(response => {
                    const secondDexPageHtml = response.body;
                    // This req token is used to approve this login in Dex
                    const req = Cypress.$(secondDexPageHtml).find(`input[name=req]`).attr("value");
                    cy.log("req for sso login", req);

                    // Next request will redirect us back to Synapse page with "Continue" link
                    cy.request("POST", `${dexAddress}/dex/approval?req=${req}&approval=approve`).then(response => {
                        const synapseHtml = response.body;
                        const hydrogenLinkWithToken = Cypress.$(synapseHtml).find(`a:contains("Continue")`).attr("href");
                        cy.log("SSO redirect link", hydrogenLinkWithToken);
                        cy.visit(hydrogenLinkWithToken);
                        cy.get(".SessionView");
                     });
                 });
        });
    })
});

