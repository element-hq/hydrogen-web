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

function normalizeHomeserver(homeServer) {
    try {
        return new URL(homeServer).origin;
    } catch (err) {
        return new URL(`https://${homeServer}`).origin;
    }
}

function getRetryHomeServer(homeServer) {
    const url = new URL(homeServer);
    const {host} = url;
    const dotCount = host.split(".").length - 1;
    if (dotCount === 1) {
        url.host = `www.${host}`;
        return url.origin;
    }
}

export async function lookupHomeServer(homeServer, request) {
        homeServer = normalizeHomeserver(homeServer);
        const requestOptions = {format: "json", timeout: 30000, method: "GET"};
        let wellKnownResponse = null;
        while (!wellKnownResponse) {
            try {
                const wellKnownUrl = `${homeServer}/.well-known/matrix/client`;
                wellKnownResponse = await request(wellKnownUrl, requestOptions).response();
            } catch (err) {
                if (err.name === "ConnectionError") {
                    const retryHS = getRetryHomeServer(homeServer);
                    if (retryHS) {
                        homeServer = retryHS;
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
            const wellKnownHomeServer = body["m.homeserver"]?.["base_url"];
            if (typeof wellKnownHomeServer === "string") {
                homeServer = normalizeHomeserver(wellKnownHomeServer);
            }
        }
        return homeServer
}
