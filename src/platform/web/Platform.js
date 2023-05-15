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

import {createFetchRequest} from "./dom/request/fetch.js";
import {xhrRequest} from "./dom/request/xhr.js";
import {StorageFactory} from "../../matrix/storage/idb/StorageFactory";
import {SessionInfoStorage} from "../../matrix/sessioninfo/localstorage/SessionInfoStorage";
import {SettingsStorage} from "./dom/SettingsStorage.js";
import {Encoding} from "./utils/Encoding.js";
import {OlmWorker} from "../../matrix/e2ee/OlmWorker.js";
import {IDBLogPersister} from "../../logging/IDBLogPersister";
import {ConsoleReporter} from "../../logging/ConsoleReporter";
import {Logger} from "../../logging/Logger";
import {RootView} from "./ui/RootView.js";
import {Clock} from "./dom/Clock.js";
import {ServiceWorkerHandler} from "./dom/ServiceWorkerHandler.js";
import {NotificationService} from "./dom/NotificationService.js";
import {History} from "./dom/History.js";
import {OnlineStatus} from "./dom/OnlineStatus.js";
import {Crypto} from "./dom/Crypto.js";
import {estimateStorageUsage} from "./dom/StorageEstimate.js";
import {WorkerPool} from "./dom/WorkerPool.js";
import {BlobHandle} from "./dom/BlobHandle.js";
import {hasReadPixelPermission, ImageHandle, VideoHandle} from "./dom/ImageHandle.js";
import {downloadInIframe} from "./dom/download.js";
import {Disposables} from "../../utils/Disposables";
import {parseHTML} from "./parsehtml.js";
import {handleAvatarError} from "./ui/avatar";
import {MediaDevicesWrapper} from "./dom/MediaDevices";
import {DOMWebRTC} from "./dom/WebRTC";
import {ThemeLoader} from "./theming/ThemeLoader";
import {TimeFormatter} from "./dom/TimeFormatter";
import {copyPlaintext} from "./dom/utils";

function addScript(src) {
    return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.setAttribute("src", src );
        s.onload=resolve;
        s.onerror=reject;
        document.body.appendChild(s);
    });
}

async function loadOlm(olmPaths) {
    // make crypto.getRandomValues available without
    // a prefix on IE11, needed by olm to work
    if (window.msCrypto && !window.crypto) {
        window.crypto = window.msCrypto;
    }
    if (olmPaths) {
        if (window.WebAssembly) {
            await addScript(olmPaths.wasmBundle);
            await window.Olm.init({locateFile: () => olmPaths.wasm});
        } else {
            await addScript(olmPaths.legacyBundle);
            await window.Olm.init();
        }
        return window.Olm;
    }
    return null;
}
// turn asset path to absolute path if it isn't already
// so it can be loaded independent of base
function assetAbsPath(assetPath) {
    if (!assetPath.startsWith("/")) {
        return new URL(assetPath, document.location.href).pathname;
    }
    return assetPath;
}

async function loadOlmWorker(assetPaths) {
    const workerPool = new WorkerPool(assetPaths.worker, 4);
    await workerPool.init();
    await workerPool.sendAll({
        type: "load_olm",
        path: assetAbsPath(assetPaths.olm.legacyBundle)
    });
    const olmWorker = new OlmWorker(workerPool);
    return olmWorker;
}

// needed for mobile Safari which shifts the layout viewport up without resizing it
// when the keyboard shows (see https://bugs.webkit.org/show_bug.cgi?id=141832)
function adaptUIOnVisualViewportResize(container) {
    if (!window.visualViewport) {
        return;
    }
    const handler = () => {
        const sessionView = container.querySelector('.SessionView');
        if (!sessionView) {
            return;
        }

        const scrollable = container.querySelector('.bottom-aligned-scroll');
        let scrollTopBefore, heightBefore, heightAfter;

        if (scrollable) {
            scrollTopBefore = scrollable.scrollTop;
            heightBefore = scrollable.offsetHeight;
        }

        // Ideally we'd use window.visualViewport.offsetTop but that seems to occasionally lag
        // behind (last tested on iOS 14.4 simulator) so we have to compute the offset manually
        const offsetTop = sessionView.offsetTop + sessionView.offsetHeight - window.visualViewport.height;

        container.style.setProperty('--ios-viewport-height', window.visualViewport.height.toString() + 'px');
        container.style.setProperty('--ios-viewport-top', offsetTop.toString() + 'px');

        if (scrollable) {
            heightAfter = scrollable.offsetHeight;
            scrollable.scrollTop = scrollTopBefore + heightBefore - heightAfter;
        }
    };
    window.visualViewport.addEventListener('resize', handler);
    return () => {
        window.visualViewport.removeEventListener('resize', handler);
    };
}

export class Platform {
    constructor({ container, assetPaths, config, configURL, logger, options = null, cryptoExtras = null }) {
        this._container = container;
        this._assetPaths = assetPaths;
        this._config = config;
        this._configURL = configURL;
        this.settingsStorage = new SettingsStorage("hydrogen_setting_v1_");
        this.clock = new Clock();
        this.encoding = new Encoding();
        this.random = Math.random;
        this.logger = logger ?? this._createLogger(options?.development);
        this.history = new History();
        this.onlineStatus = new OnlineStatus();
        this.timeFormatter = new TimeFormatter();
        this._serviceWorkerHandler = null;
        if (assetPaths.serviceWorker && "serviceWorker" in navigator) {
            this._serviceWorkerHandler = new ServiceWorkerHandler();
            this._serviceWorkerHandler.registerAndStart(assetPaths.serviceWorker);
        }
        this.notificationService = undefined;
        // Only try to use crypto when olm is provided
        if(this._assetPaths.olm) {
            this.crypto = new Crypto(cryptoExtras);
        }
        this.storageFactory = new StorageFactory(this._serviceWorkerHandler);
        this.sessionInfoStorage = new SessionInfoStorage("hydrogen_sessions_v1");
        this.estimateStorageUsage = estimateStorageUsage;
        if (typeof fetch === "function") {
            this.request = createFetchRequest(this.clock.createTimeout, this._serviceWorkerHandler);
        } else {
            this.request = xhrRequest;
        }
        const isIE11 = !!window.MSInputMethodContext && !!document.documentMode;
        this.isIE11 = isIE11;
        // From https://stackoverflow.com/questions/9038625/detect-if-device-is-ios/9039885
        const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) && !window.MSStream;
        this.isIOS = isIOS;
        this._disposables = new Disposables();
        this._olmPromise = undefined;
        this._workerPromise = undefined;
        this.mediaDevices = new MediaDevicesWrapper(navigator.mediaDevices);
        this.webRTC = new DOMWebRTC();
        this._themeLoader = import.meta.env.DEV? null: new ThemeLoader(this);
    }

    async init() {
        try {
            await this.logger.run("Platform init", async (log) => {
                if (!this._config) {
                    if (!this._configURL) {
                        throw new Error("Neither config nor configURL was provided!");
                    }
                    const {status, body}= await this.request(this._configURL, {method: "GET", format: "json", cache: true}).response();
                    if (status === 404) {
                        throw new Error(`Could not find ${this._configURL}. Did you copy over config.sample.json?`);
                    } else if (status >= 400) {
                        throw new Error(`Got status ${status} while trying to fetch ${this._configURL}`);
                    }
                    this._config = body;
                }
                this.notificationService = new NotificationService(
                    this._serviceWorkerHandler,
                    this._config.push
                );
                if (this._themeLoader) {
                    const manifests = this.config["themeManifests"];
                    await this._themeLoader?.init(manifests, log);
                    const { themeName, themeVariant } = await this._themeLoader.getActiveTheme();
                    log.log({ l: "Active theme", name: themeName, variant: themeVariant });
                    await this._themeLoader.setTheme(themeName, themeVariant, log);
                }
            });
        } catch (err) {
            this._container.innerText = err.message;
            throw err;
        }
    }

    _createLogger(isDevelopment) {
        const logger = new Logger({platform: this});
        // Make sure that loginToken does not end up in the logs
        const transformer = (item) => {
            if (item.e?.stack) {
                item.e.stack = item.e.stack.replace(/\/\?loginToken=(.+)/, "?loginToken=<snip>");
            }
            return item;
        };
        const logPersister = new IDBLogPersister({name: "hydrogen_logs", platform: this, serializedTransformer: transformer});
        logger.addReporter(logPersister);
        if (isDevelopment) {
            logger.addReporter(new ConsoleReporter());
        }
        return logger;
    }

    get updateService() {
        return this._serviceWorkerHandler;
    }

    loadOlm() {
        if (!this._olmPromise) {
            this._olmPromise = loadOlm(this._assetPaths.olm);
        }
        return this._olmPromise;
    }

    get config() {
        return this._config;
    }

    async loadOlmWorker() {
        if (!window.WebAssembly) {
            if (!this._workerPromise) {
                this._workerPromise = loadOlmWorker(this._assetPaths);
            }
            return this._workerPromise;
        }
    }

    createAndMountRootView(vm) {
        if (this.isIE11) {
            this._container.className += " legacy";
        }
        if (this.isIOS) {
            this._container.className += " ios";
            const disposable = adaptUIOnVisualViewportResize(this._container);
            if (disposable) {
                this._disposables.track(disposable);
            }
        }
        this._container.addEventListener("error", handleAvatarError, true);
        this._disposables.track(() => this._container.removeEventListener("error", handleAvatarError, true));
        window.__hydrogenViewModel = vm;
        const view = new RootView(vm);
        this._container.appendChild(view.mount());
    }

    setNavigation(navigation) {
        this._serviceWorkerHandler?.setNavigation(navigation);
    }

    createBlob(buffer, mimetype) {
        return BlobHandle.fromBuffer(buffer, mimetype);
    }

    saveFileAs(blobHandle, filename) {
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blobHandle.nativeBlob, filename);
        } else {
            downloadInIframe(this._container, this._assetPaths.downloadSandbox, blobHandle, filename, this.isIOS);
        }
    }

    async copyPlaintext(text) {
        return await copyPlaintext(text);
    }

    restart() {
        document.location.reload();
    }

    openFile(mimeType = null) {
        const input = document.createElement("input");
        input.setAttribute("type", "file");
        input.className = "hidden";
        if (mimeType) {
            input.setAttribute("accept", mimeType);
        }
        const promise = new Promise(resolve => {
            const checkFile = () => {
                input.removeEventListener("change", checkFile, true);
                const file = input.files[0];
                this._container.removeChild(input);
                if (file) {
                    // ok to not filter mimetypes as these are local files
                    resolve({name: file.name, blob: BlobHandle.fromBlobUnsafe(file)});
                } else {
                    resolve();
                }
            }
            input.addEventListener("change", checkFile, true);
        });
        // IE11 needs the input to be attached to the document
        this._container.appendChild(input);
        input.click();
        return promise;
    }

    openUrl(url) {
        location.href = url;
    }

    parseHTML(html) {
        return parseHTML(html);
    }

    async loadImage(blob) {
        return ImageHandle.fromBlob(blob);
    }

    async loadVideo(blob) {
        return VideoHandle.fromBlob(blob);
    }

    hasReadPixelPermission() {
        return hasReadPixelPermission();
    }

    get devicePixelRatio() {
        return window.devicePixelRatio || 1;
    }

    get version() {
        return DEFINE_VERSION;
    }

    get themeLoader() {
        return this._themeLoader;
    }

    async replaceStylesheet(newPath, log) {
        const error = await this.logger.wrapOrRun(log, { l: "replaceStylesheet", location: newPath, }, async (l) => {
            let error;
            const head = document.querySelector("head");
            // remove default theme 
            document.querySelectorAll(".theme").forEach(e => e.remove());
            // add new theme
            const styleTag = document.createElement("link");
            styleTag.href = newPath;
            styleTag.rel = "stylesheet";
            styleTag.type = "text/css";
            styleTag.className = "theme";
            const promise = new Promise(resolve => {
                styleTag.onerror = () => {
                    error = new Error(`Failed to load stylesheet from ${newPath}`);
                    l.catch(error);
                    resolve();
                };
                styleTag.onload = () => {
                    resolve();
                };
            });
            head.appendChild(styleTag);
            await promise;
            return error;
        });
        if (error) {
            throw error;
        }
    }

    get description() {
        return "web-" + (navigator.userAgent ?? "<unknown>");
    }

    dispose() {
        this._disposables.dispose();
    }
}

import {LogItem} from "../../logging/LogItem";
export function tests() {
    return {
        "loginToken should not be in logs": (assert) => {
            const logPersister = Object.create(IDBLogPersister.prototype);
            logPersister._queuedItems = [];
            logPersister.options = {
                serializedTransformer: (item) => {
                    if (item.e?.stack) {
                        item.e.stack = item.e.stack.replace(/(?<=\/\?loginToken=).+/, "<snip>");
                    }
                    return item;
                }
            };
            const logger = { _now() {return 5;} };
            const logItem = new LogItem("test", 1, logger);
            logItem.error = new Error();
            logItem.error.stack = "main http://localhost:3000/src/main.js:55\n<anonymous> http://localhost:3000/?loginToken=secret:26"
            logPersister.reportItem(logItem, null, false);
            const item = logPersister._queuedItems.pop();
            assert.strictEqual(item.json.search("secret"), -1);
        }
    };
}
