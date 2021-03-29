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

export function getStyleSheetElements() {
    const styleSheets = Object.create(null);
    for (const link of document.getElementsByTagName("link")) {
        const match = link.href.match(/^.*\/themes\/(.*)\/.*\.css$/);
        if (match) {
            styleSheets[match[1]] = link;
        }
    }
    return styleSheets;
}

export function setTheme(name, styleSheetElements) {
    if (!styleSheetElements) {
        styleSheetElements = getStyleSheetElements();
    }

    if (!(name in styleSheetElements)) {
        return;
    }

    styleSheetElements[name].disabled = false;

    return new Promise(resolve => {
        const switchTheme = function() {
            styleSheetElements[name].disabled = false; // Poor man's race condition precaution
            for (const other in styleSheetElements) {
                if (other !== name) {
                    styleSheetElements[other].disabled = true;
                }
            }
            resolve();
        };

        // Firefox preloads the CSS for disabled link elements while other browsers don't

        let cssLoaded = false;

        styleSheetElements[name].onload = switchTheme;

        for (const styleSheet of document.styleSheets) {
            if (styleSheet && styleSheet.href === styleSheetElements[name].href) {
                cssLoaded = true;
                break;
            }
        }

        if (cssLoaded) {
            styleSheetElements[name].onload = undefined;
            switchTheme();
        }
    });
}
