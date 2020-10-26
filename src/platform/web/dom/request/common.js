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

export function addCacheBuster(urlStr, random = Math.random) {
    // XHR doesn't have a good way to disable cache,
    // so add a random query param
    // see https://davidtranscend.com/blog/prevent-ie11-cache-ajax-requests/
    if (urlStr.includes("?")) {
        urlStr = urlStr + "&";
    } else {
        urlStr = urlStr + "?";
    }
    return urlStr + `_cacheBuster=${Math.ceil(random() * Number.MAX_SAFE_INTEGER)}`;
}

export function tests() {
    return {
        "add cache buster": assert => {
            const random = () => 0.5;
            assert.equal(addCacheBuster("http://foo", random), "http://foo?_cacheBuster=4503599627370496");
            assert.equal(addCacheBuster("http://foo?bar=baz", random), "http://foo?bar=baz&_cacheBuster=4503599627370496");
        }
    }
}
