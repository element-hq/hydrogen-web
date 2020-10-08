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

import {SessionViewModel} from "./session/SessionViewModel.js";
import {SessionLoadViewModel} from "./SessionLoadViewModel.js";
import {LoginViewModel} from "./LoginViewModel.js";
import {SessionPickerViewModel} from "./SessionPickerViewModel.js";
import {ViewModel} from "./ViewModel.js";

export class BrawlViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {createSessionContainer, sessionInfoStorage, storageFactory} = options;
        this._createSessionContainer = createSessionContainer;
        this._sessionInfoStorage = sessionInfoStorage;
        this._storageFactory = storageFactory;

        this._error = null;
        this._sessionViewModel = null;
        this._loginViewModel = null;
        this._sessionPickerViewModel = null;

        this._sessionContainer = null;
        this._sessionCallback = this._sessionCallback.bind(this);

    }

    async load() {
        this.track(this.navigation.observe("login").subscribe(shown => {
            if (shown) {
                this._showLogin();
            }
        }));
        this.track(this.navigation.observe("session").subscribe(sessionId => {
            if (sessionId === true) {
                this._showPicker();
            } else if (sessionId) {
                this._showSessionLoader(sessionId);
            }
        }));

        const isLogin = this.navigation.observe("login").get();
        const sessionId = this.navigation.observe("session").get();
        if (isLogin) {
            this._showLogin();
        } else if (sessionId === true) {
            this._showPicker();
        } else if (sessionId) {
            this._showSessionLoader(sessionId);
        } else {
            const sessionInfos = await this._sessionInfoStorage.getAll();
            let url;
            if (sessionInfos.length === 0) {
                url = this.urlRouter.urlForSegment("login");
            } else if (sessionInfos.length === 1) {
                url = this.urlRouter.urlForSegment("session", sessionInfos[0].id);
            } else {
                url = this.urlRouter.urlForSegment("session");
            }
            this.urlRouter.replaceUrl(url);
        }
    }

    _sessionCallback(sessionContainer) {
        if (sessionContainer) {
            this._setSection(() => {
                this._sessionContainer = sessionContainer;
                this._sessionViewModel = new SessionViewModel(this.childOptions({sessionContainer}));
                this._sessionViewModel.start();
            });
        } else {
            // switch between picker and login
            if (this.activeSection === "login") {
                this._showPicker();
            } else {
                this._showLogin();
            }
        }
    }

    async _showPicker() {
        this._setSection(() => {
            this._sessionPickerViewModel = new SessionPickerViewModel({
                sessionInfoStorage: this._sessionInfoStorage,
                storageFactory: this._storageFactory,
                createSessionContainer: this._createSessionContainer,
                sessionCallback: this._sessionCallback,
            });
        });
        try {
            await this._sessionPickerViewModel.load();
        } catch (err) {
            this._setSection(() => this._error = err);
        }
    }

    _showLogin() {
        this._setSection(() => {
            this._loginViewModel = new LoginViewModel({
                defaultHomeServer: "https://matrix.org",
                createSessionContainer: this._createSessionContainer,
                sessionCallback: this._sessionCallback,
            });
        });
    }

    _showSessionLoader(sessionId) {
        this._setSection(() => {
            this._sessionLoadViewModel = new SessionLoadViewModel({
                createAndStartSessionContainer: () => {
                    const sessionContainer = this._createSessionContainer();
                    sessionContainer.startWithExistingSession(sessionId);
                    return sessionContainer;
                },
                sessionCallback: sessionContainer => this._sessionCallback(sessionContainer)
            });
            this._sessionLoadViewModel.start();
        });
    }

    get activeSection() {
        if (this._error) {
            return "error";
        } else if (this._sessionViewModel) {
            return "session";
        } else if (this._loginViewModel) {
            return "login";
        } else if (this._sessionPickerViewModel) {
            return "picker";
        } else if (this._sessionLoadViewModel) {
            return "loading";
        } else {
            return "redirecting";
        }
    }

    _setSection(setter) {
        // clear all members the activeSection depends on
        this._error = null;
        this._sessionViewModel = null;
        this._loginViewModel = null;
        this._sessionPickerViewModel = null;
        this._sessionLoadViewModel = null;

        if (this._sessionContainer) {
            this._sessionContainer.stop();
            this._sessionContainer = null;
        }
        // now set it again
        setter();
        this.emitChange("activeSection");
    }

    get error() { return this._error; }
    get sessionViewModel() { return this._sessionViewModel; }
    get loginViewModel() { return this._loginViewModel; }
    get sessionPickerViewModel() { return this._sessionPickerViewModel; }
    get sessionLoadViewModel() { return this._sessionLoadViewModel; }
}
