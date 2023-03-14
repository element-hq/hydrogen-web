/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

// TODO: Figure out how to get WebWorkers Typescript lib working. For now we just disable checks on the whole file.
// @ts-nocheck

// The empty export makes this a module. It can be removed once there's at least one import.
export {}

declare let self: SharedWorkerGlobalScope;

self.onconnect = (event: MessageEvent) => {
    const port = event.ports[0];
    port.postMessage("hello from sync worker");
    console.log("hello from sync worker");
}
