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

function normalizeHomeserver(homeserver) {
    try {
        return new URL(homeserver).origin;
    } catch (err) {
        return new URL(`https://${homeserver}`).origin;
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
