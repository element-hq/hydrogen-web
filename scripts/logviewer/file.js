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

export function openFile(mimeType = null) {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.className = "hidden";
    if (mimeType) {
        input.setAttribute("accept", mimeType);
    }
    const promise = new Promise((resolve, reject) => {
        const checkFile = () => {
            input.removeEventListener("change", checkFile, true);
            const file = input.files[0];
            document.body.removeChild(input);
            if (file) {
                resolve(file);   
            } else {
                reject(new Error("no file picked"));
            }
        }
        input.addEventListener("change", checkFile, true);
    });
    // IE11 needs the input to be attached to the document
    document.body.appendChild(input);
    input.click();
    return promise;
}

export function readFileAsText(file) {
    const reader = new FileReader();
    const promise = new Promise((resolve, reject) => {
        reader.addEventListener("load", evt => resolve(evt.target.result));
        reader.addEventListener("error", evt => reject(evt.target.error));
    });
    reader.readAsText(file);
    return promise;
}
