/*
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

export function domEventAsPromise(element: HTMLElement, successEvent: string): Promise<void> {
    return new Promise((resolve, reject) => {
        let detach;
        const handleError = evt => {
            detach();
            reject(evt.target.error);
        };
        const handleSuccess = () => {
            detach();
            resolve();
        };
        detach = () => {
            element.removeEventListener(successEvent, handleSuccess);
            element.removeEventListener("error", handleError);
        };
        element.addEventListener(successEvent, handleSuccess);
        element.addEventListener("error", handleError);
    });
}

// Copies the given text to clipboard and returns a boolean of whether the action was
// successful
export async function copyPlaintext(text: string): Promise<boolean> {
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;

            // Avoid scrolling to bottom
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";

            document.body.appendChild(textArea);

            const selection = document.getSelection();
            if (!selection) {
                console.error('copyPlaintext: Unable to copy text to clipboard in fallback mode because `selection` was null/undefined');
                return false;
            }

            const range = document.createRange();
            // range.selectNodeContents(textArea);
            range.selectNode(textArea);
            selection.removeAllRanges();
            selection.addRange(range);

            const successful = document.execCommand("copy");
            selection.removeAllRanges();
            document.body.removeChild(textArea);
            if(!successful) {
                console.error('copyPlaintext: Unable to copy text to clipboard in fallback mode because the `copy` command is unsupported or disabled');
            }
            return successful;
        }
    } catch (err) {
        console.error("copyPlaintext: Ran into an error", err);
    }
    return false;
}
