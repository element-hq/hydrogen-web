/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

const VERSION = "%%VERSION%%";
const GLOBAL_HASH = "%%GLOBAL_HASH%%";
const UNHASHED_PRECACHED_ASSETS = [];
const HASHED_PRECACHED_ASSETS = [];
const HASHED_CACHED_ON_REQUEST_ASSETS = [];
const NOTIFICATION_BADGE_ICON = "assets/icon.png";
const unhashedCacheName = `hydrogen-assets-${GLOBAL_HASH}`;
const hashedCacheName = `hydrogen-assets`;
const mediaThumbnailCacheName = `hydrogen-media-thumbnails-v2`;

self.addEventListener('install', function(e) {
    e.waitUntil((async () => {
        const unhashedCache = await caches.open(unhashedCacheName);
        await unhashedCache.addAll(UNHASHED_PRECACHED_ASSETS);
        const hashedCache = await caches.open(hashedCacheName);
        await Promise.all(HASHED_PRECACHED_ASSETS.map(async asset => {
            if (!await hashedCache.match(asset)) {
                await hashedCache.add(asset);
            }
        }));
    })());
});

self.addEventListener('activate', (event) => {
    // on a first page load/sw install,
    // start using the service worker on all pages straight away
    self.clients.claim();
    event.waitUntil(purgeOldCaches());
});

async function purgeOldCaches() {
    // remove any caches we don't know about
    const keyList = await caches.keys();
    for (const key of keyList) {
        if (key !== unhashedCacheName && key !== hashedCacheName && key !== mediaThumbnailCacheName) {
            await caches.delete(key);
        }
    }
    // remove the cache for any old hashed resource
    const hashedCache = await caches.open(hashedCacheName);
    const keys = await hashedCache.keys();
    const hashedAssetURLs =
        HASHED_PRECACHED_ASSETS
        .concat(HASHED_CACHED_ON_REQUEST_ASSETS)
        .map(a => new URL(a, self.registration.scope).href);

    for (const request of keys) {
        if (!hashedAssetURLs.some(url => url === request.url)) {
            hashedCache.delete(request);
        }
    }
}

self.addEventListener('fetch', (event) => {
    /*
    service worker shouldn't handle xhr uploads because otherwise
    the progress events won't fire.
    This has to do with xhr not being supported in service workers.
    */
    if (event.request.method === "GET") {
        event.respondWith(handleRequest(event.request));
    }
});

function isCacheableThumbnail(url) {
    if (url.pathname.startsWith("/_matrix/media/r0/thumbnail/")) {
        const width = parseInt(url.searchParams.get("width"), 10);
        const height = parseInt(url.searchParams.get("height"), 10);
        if (width <= 50 && height <= 50) {
            return true;
        }
    }
    return false;
}

const baseURL = new URL(self.registration.scope);
let pendingFetchAbortController = new AbortController();
async function handleRequest(request) {
    try {
        const url = new URL(request.url);
        // rewrite / to /index.html so it hits the cache
        if (url.origin === baseURL.origin && url.pathname === baseURL.pathname) {
            request = new Request(new URL("index.html", baseURL.href));
        }
        let response = await readCache(request);
        if (!response) {
            // use cors so the resource in the cache isn't opaque and uses up to 7mb
            // https://developers.google.com/web/tools/chrome-devtools/progressive-web-apps?utm_source=devtools#opaque-responses
            if (isCacheableThumbnail(url)) {
                response = await fetch(request, {signal: pendingFetchAbortController.signal, mode: "cors", credentials: "omit"});
            } else {
                response = await fetch(request, {signal: pendingFetchAbortController.signal});
            }
            await updateCache(request, response);
        }
        return response;
    } catch (err) {
        if (err.name !== "TypeError" && err.name !== "AbortError") {
            console.error("error in service worker", err);
        }
        throw err;
    }
}

async function updateCache(request, response) {
    // don't write error responses to the cache
    if (response.status >= 400) {
        return;
    }
    const url = new URL(request.url);
    const baseURL = self.registration.scope;
    if (isCacheableThumbnail(url)) {
        const cache = await caches.open(mediaThumbnailCacheName);
        cache.put(request, response.clone());
    } else if (request.url.startsWith(baseURL)) {
        let assetName = request.url.substr(baseURL.length);
        if (HASHED_CACHED_ON_REQUEST_ASSETS.includes(assetName)) {
            const cache = await caches.open(hashedCacheName);
            await cache.put(request, response.clone());
        }
    }
}

async function readCache(request) {
    const unhashedCache = await caches.open(unhashedCacheName);
    let response = await unhashedCache.match(request);
    if (response) {
        return response;
    }
    const hashedCache = await caches.open(hashedCacheName);
    response = await hashedCache.match(request);
    if (response) {
        return response;
    }
    
    const url = new URL(request.url);
    if (isCacheableThumbnail(url)) {
        const mediaThumbnailCache = await caches.open(mediaThumbnailCacheName);
        response = await mediaThumbnailCache.match(request);
        // added in 0.1.26, remove previously cached error responses, remove this in some time
        if (response?.status >= 400) {
            await mediaThumbnailCache.delete(request);
            response = null;
        }
    }
    return response;
}

self.addEventListener('message', (event) => {
    const reply = payload => event.source.postMessage({replyTo: event.data.id, payload});
    const {replyTo} = event.data;
    if (replyTo) {
        const resolve = pendingReplies.get(replyTo);
        if (resolve) {
            pendingReplies.delete(replyTo);
            resolve(event.data.payload);
        }
    } else {
        switch (event.data?.type) {
            case "version":
                reply({version: VERSION, buildHash: GLOBAL_HASH});
                break;
            case "skipWaiting":
                self.skipWaiting();
                break;
            case "haltRequests":
                event.waitUntil(haltRequests().finally(() => reply()));
                break;
            case "closeSession":
                event.waitUntil(
                    closeSession(event.data.payload.sessionId, event.source.id)
                        .finally(() => reply())
                );
                break;
        }
    }
});

const NOTIF_TAG_NEW_MESSAGE = "new_message";

async function openClientFromNotif(event) {
    if (event.notification.tag !== NOTIF_TAG_NEW_MESSAGE) {
        console.log("clicked notif with tag", event.notification.tag);
        return;
    }
    const {sessionId, roomId} = event.notification.data;
    const sessionHash = `#/session/${sessionId}`;
    const roomHash = `${sessionHash}/room/${roomId}`;
    const clientWithSession = await findClient(async client => {
        return await sendAndWaitForReply(client, "hasSessionOpen", {sessionId});
    });
    if (clientWithSession) {
        console.log("notificationclick: client has session open, showing room there");
        // use a message rather than clientWithSession.navigate here as this refreshes the page on chrome
        clientWithSession.postMessage({type: "openRoom", payload: {roomId}});
        if ('focus' in clientWithSession) {
            try {
                await clientWithSession.focus();
            } catch (err) { console.error(err); } // I've had this throw on me on Android
        }
    } else if (self.clients.openWindow) {
        console.log("notificationclick: no client found with session open, opening new window");
        const roomURL = new URL(`./${roomHash}`, baseURL).href;
        await self.clients.openWindow(roomURL);
    }
}

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(openClientFromNotif(event));
});

async function handlePushNotification(n) {
    console.log("got a push message", n);
    const sessionId = n.session_id;
    let sender = n.sender_display_name || n.sender;
    if (sender && n.event_id) {
        const roomId = n.room_id;
        const hasFocusedClientOnRoom = !!await findClient(async client => {
            if (client.visibilityState === "visible" && client.focused) {
                return await sendAndWaitForReply(client, "hasRoomOpen", {sessionId, roomId});
            }
        });
        if (hasFocusedClientOnRoom) {
            console.log("client is focused, room is open, don't show notif");
            return;
        }
        const newMessageNotifs = Array.from(await self.registration.getNotifications({tag: NOTIF_TAG_NEW_MESSAGE}));
        const notifsForRoom = newMessageNotifs.filter(n => n.data.roomId === roomId);
        const hasMultiNotification = notifsForRoom.some(n => n.data.multi);
        const hasSingleNotifsForRoom = newMessageNotifs.some(n => !n.data.multi);
        const roomName = n.room_name || n.room_alias;
        let multi = false;
        let label;
        let body;
        if (hasMultiNotification) {
            console.log("already have a multi message, don't do anything");
            return;
        } else if (hasSingleNotifsForRoom) {
            console.log("showing multi message notification");
            multi = true;
            label = roomName || sender;
            body = "New messages";
        } else {
            console.log("showing new message notification");
            if (roomName && roomName !== sender) {
                label = `${sender} in ${roomName}`;
            } else {
                label = sender;
            }
            body = n.content?.body || "New message";
        }
        await self.registration.showNotification(label, {
            body,
            data: {sessionId, roomId, multi},
            tag: NOTIF_TAG_NEW_MESSAGE,
            badge: NOTIFICATION_BADGE_ICON
        });
    }
    // we could consider hiding previous notifications here based on the unread count
    // (although we can't really figure out which notifications to hide) and also hiding
    // notifications makes it hard to ensure we always show a notification after a push message
    // when no client is visible, see https://goo.gl/yqv4Q4
}

self.addEventListener('push', event => {
    event.waitUntil(handlePushNotification(event.data.json()));
});

async function closeSession(sessionId, requestingClientId) {
    const clients = await self.clients.matchAll();
    await Promise.all(clients.map(async client => {
        if (client.id !== requestingClientId) {
            await sendAndWaitForReply(client, "closeSession", {sessionId});
        }
    }));
}

async function haltRequests() {
    // first ask all clients to block sending any more requests
    const clients = await self.clients.matchAll({type: "window"});
    await Promise.all(clients.map(client => {
        return sendAndWaitForReply(client, "haltRequests");
    }));
    // and only then abort the current requests
    pendingFetchAbortController.abort();
}

const pendingReplies = new Map();
let messageIdCounter = 0;
function sendAndWaitForReply(client, type, payload) {
    messageIdCounter += 1;
    const id = messageIdCounter;
    const promise = new Promise(resolve => {
        pendingReplies.set(id, resolve);
    });
    client.postMessage({type, id, payload});
    return promise;
}

async function findClient(predicate) {
    const clientList = await self.clients.matchAll({type: "window"});
    for (const client of clientList) {
        if (await predicate(client)) {
            return client;
        }
    }
}
