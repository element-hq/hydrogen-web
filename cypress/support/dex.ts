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

/// <reference types="cypress" />

import Chainable = Cypress.Chainable;
import AUTWindow = Cypress.AUTWindow;
import { DexInstance } from "../plugins/dex";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Start the dex server
             */
            startDex(): Chainable<DexInstance>;

            /**
             * Stop the dex server
             * @param dex the dex instance returned by startSynapse
             */
            stopDex(dex: DexInstance): Chainable<AUTWindow>;
        }
    }
}

function startDex(): Chainable<DexInstance> {
    return cy.task<DexInstance>("dexStart");
}

function stopDex(dex?: DexInstance): Chainable<AUTWindow> {
    if (!dex) return;
    cy.task("dexStop", dex.dexId);
}

Cypress.Commands.add("startDex", startDex);
Cypress.Commands.add("stopDex", stopDex);
