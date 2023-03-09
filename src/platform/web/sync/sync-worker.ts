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
