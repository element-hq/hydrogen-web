// TODO

self.onconnect = (event) => {
    const port = event.ports[0];
    port.postMessage("hello from sync worker");
    console.log("hello from sync worker");
}
