/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const env = {
    SYNAPSE_IP_ADDRESS: "172.18.0.5",
    SYNAPSE_PORT: "8008",
    DEX_IP_ADDRESS: "172.18.0.4",
    DEX_PORT: "5556",
}

export default function setupEnvironmentVariables() {
    for (const [key, value] of Object.entries(env)) {
        process.env[key] = value;
    }
}
