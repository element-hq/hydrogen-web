/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

const VERSION = "foo3";
const OFFLINE_FILES = ["hydrogen-129215894.js","hydrogen-1625084908.css","index.html","themes/element/bundle-1000196323.css","themes/bubbles/bundle-2682099160.css","icon-2793984973.png","icon-maskable-317721575.png"];
// TODO: cache these files when requested
// The difficulty is that these are relative filenames, and we don't have access to document.baseURI
// Clients.match({type: "window"}).url and assume they are all the same? they really should be ... safari doesn't support this though
const CACHE_FILES = ["themes/element/element-logo-2959259787.svg","themes/element/icons/chevron-right-787082136.svg","themes/element/icons/send-4065347741.svg","themes/element/inter/Inter-Black-276207522.woff","themes/element/inter/Inter-BlackItalic-3159247813.woff","themes/element/inter/Inter-Bold-4187626158.woff","themes/element/inter/Inter-BoldItalic-641187949.woff","themes/element/inter/Inter-ExtraBold-3888913940.woff","themes/element/inter/Inter-ExtraBoldItalic-2880676406.woff","themes/element/inter/Inter-ExtraLight-3277895962.woff","themes/element/inter/Inter-ExtraLightItalic-3022762143.woff","themes/element/inter/Inter-Italic-4024721388.woff","themes/element/inter/Inter-Light-3990448997.woff","themes/element/inter/Inter-LightItalic-412813693.woff","themes/element/inter/Inter-Medium-2285329551.woff","themes/element/inter/Inter-MediumItalic-1722521156.woff","themes/element/inter/Inter-Regular-2779214592.woff","themes/element/inter/Inter-SemiBold-1906312195.woff","themes/element/inter/Inter-SemiBoldItalic-3778207334.woff","themes/element/inter/Inter-Thin-1593561269.woff","themes/element/inter/Inter-ThinItalic-1888295987.woff"];
const cacheName = `hydrogen-${VERSION}`;

self.addEventListener('install', function(e) {
    console.log("installing service worker", VERSION);
    e.waitUntil(
        caches.open(cacheName).then(function(cache) {
            return cache.addAll(OFFLINE_FILES);
        })
    );
});

self.addEventListener('activate', (event) => {
    console.log("activating service worker", VERSION);
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== cacheName) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

self.addEventListener('fetch', (event) => {
    console.log("new fetch event in sw", event.request.headers);
    event.respondWith(
        caches.open(cacheName)
            .then(cache => cache.match(event.request))
            .then((response) => response || fetch(event.request))
    );
});

// service-worker.js
// Listen to the request
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PING') {
    // Select who we want to respond to
    self.clients.matchAll({
      includeUncontrolled: true,
      type: 'window',
    }).then((clients) => {
      if (clients && clients.length) {
        // Send a response - the clients
        // array is ordered by last focused
        clients[0].postMessage({
          type: 'PONG',
          files: OFFLINE_FILES,
          version: VERSION,
        });
      }
    });
  }
});
