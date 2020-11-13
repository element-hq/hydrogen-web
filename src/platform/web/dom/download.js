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

export async function downloadInIframe(container, iframeSrc, blob, filename) {
    let iframe = container.querySelector("iframe.downloadSandbox");
    if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.setAttribute("sandbox", "allow-scripts allow-downloads allow-downloads-without-user-activation");
        iframe.setAttribute("src", iframeSrc);
        iframe.className = "hidden";
        container.appendChild(iframe);
        let detach;
        await new Promise((resolve, reject) => {
            detach = () => {
                iframe.removeEventListener("load", resolve);
                iframe.removeEventListener("error", reject);    
            }
            iframe.addEventListener("load", resolve);
            iframe.addEventListener("error", reject);
        });
        detach();
    }
    iframe.contentWindow.postMessage({type: "download", blob: blob, filename: filename}, "*");
}
