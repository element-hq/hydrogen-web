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

const VERSION = "%%VERSION%%";
const OFFLINE_FILES = "%%OFFLINE_FILES%%";
// TODO: cache these files when requested
// The difficulty is that these are relative filenames, and we don't have access to document.baseURI
// Clients.match({type: "window"}).url and assume they are all the same? they really should be ... safari doesn't support this though
const CACHE_FILES = "%%CACHE_FILES%%";
const cacheName = `hydrogen-${VERSION}`;

self.addEventListener('install', function(e) {
    e.waitUntil(
        caches.open(cacheName).then(function(cache) {
            return cache.addAll(OFFLINE_FILES);
        })
    );
});

self.addEventListener('activate', (event) => {
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
  event.respondWith(
    caches.open(cacheName)
        .then(cache => cache.match(event.request))
        .then((response) => response || fetch(event.request))
  );
});
