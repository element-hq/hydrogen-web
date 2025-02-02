/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

function normalizeHomeserver(homeserver) {
    if ( !homeserver.startsWith('http://') && !homeserver.startsWith('https://') ) {
        homeserver = 'https://' + homeserver;
    }
    try {
        return new URL(homeserver).origin;
    } catch (err) {
        return '';
    }
}

async function getWellKnownResponse(homeserver, request) {
    const requestOptions = {format: "json", timeout: 30000, method: "GET"};
    try {
        const wellKnownUrl = `${homeserver}/.well-known/matrix/client`;
        return await request(wellKnownUrl, requestOptions).response();
    } catch (err) {
        if (err.name === "ConnectionError") {
            // don't fail lookup on a ConnectionError,
            // there might be a missing CORS header on a 404 response or something,
            // which won't be a problem necessarily with homeserver requests later on ...
            return null;
        } else {
            throw err;
        }
    }
}

export async function lookupHomeserver(homeserver, request) {
    homeserver = normalizeHomeserver(homeserver);
    const wellKnownResponse = await getWellKnownResponse(homeserver, request);
    if (wellKnownResponse && wellKnownResponse.status === 200) {
        const {body} = wellKnownResponse;
        const wellKnownHomeserver = body["m.homeserver"]?.["base_url"];
        if (typeof wellKnownHomeserver === "string") {
            homeserver = normalizeHomeserver(wellKnownHomeserver);
        }
    }
    return homeserver;
}

export function tests() {
    return {
        "normalizing homeserver": assert => {
            assert.equal(normalizeHomeserver('matrix.org'), 'https://matrix.org');
            assert.equal(normalizeHomeserver('matrix.org:8008'), 'https://matrix.org:8008');
            assert.equal(normalizeHomeserver('https://matrix.org'), 'https://matrix.org');
            assert.equal(normalizeHomeserver('https://matrix.org:8008'), 'https://matrix.org:8008');
            assert.equal(normalizeHomeserver('localhost'), 'https://localhost');
            assert.equal(normalizeHomeserver('http:// invalid'), '');
            assert.equal(normalizeHomeserver('inv alid'), '');
        },
    }
}
