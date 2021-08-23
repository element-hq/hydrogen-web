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

function getRetryHomeserver(homeserver) {
    const url = new URL(homeserver);
    const {host} = url;
    const dotCount = host.split(".").length - 1;
    if (dotCount === 1) {
        url.host = `www.${host}`;
        return url.origin;
    }
}

export async function lookupHomeserver(homeserver, request) {
    homeserver = normalizeHomeserver(homeserver);
    const requestOptions = {format: "json", timeout: 30000, method: "GET"};
    let wellKnownResponse = null;
    while (!wellKnownResponse) {
        try {
            const wellKnownUrl = `${homeserver}/.well-known/matrix/client`;
            wellKnownResponse = await request(wellKnownUrl, requestOptions).response();
        } catch (err) {
            if (err.name === "ConnectionError") {
                const retryHS = getRetryHomeserver(homeserver);
                if (retryHS) {
                    homeserver = retryHS;
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }
    }
    if (wellKnownResponse.status === 200) {
        const {body} = wellKnownResponse;
        const wellKnownHomeserver = body["m.homeserver"]?.["base_url"];
        if (typeof wellKnownHomeserver === "string") {
            homeserver = normalizeHomeserver(wellKnownHomeserver);
        }
    }
    return homeserver;
}
