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

import {Client} from "../matrix/Client.js";
import {SessionViewModel} from "./session/SessionViewModel.js";
import {SessionLoadViewModel} from "./SessionLoadViewModel.js";
import {LoginViewModel} from "./login/LoginViewModel";
import {LogoutViewModel} from "./LogoutViewModel";
import {ForcedLogoutViewModel} from "./ForcedLogoutViewModel";
import {SessionPickerViewModel} from "./SessionPickerViewModel.js";
import {ViewModel} from "./ViewModel";

export class RootViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._error = null;
        this._sessionPickerViewModel = null;
        this._sessionLoadViewModel = null;
        this._loginViewModel = null;
        this._logoutViewModel = null;
        this._forcedLogoutViewModel = null;
        this._sessionViewModel = null;
        this._pendingClient = null;
    }

    async load() {
        this.track(this.navigation.observe("login").subscribe(() => this._applyNavigation()));
        this.track(this.navigation.observe("session").subscribe(() => this._applyNavigation()));
        this.track(this.navigation.observe("sso").subscribe(() => this._applyNavigation()));
        this.track(this.navigation.observe("logout").subscribe(() => this._applyNavigation()));
        this._applyNavigation(true);
    }

    async _applyNavigation(shouldRestoreLastUrl) {
        const isLogin = this.navigation.path.get("login");
        const logoutSessionId = this.navigation.path.get("logout")?.value;
        const isForcedLogout = this.navigation.path.get("forced")?.value;
        const sessionId = this.navigation.path.get("session")?.value;
        const loginToken = this.navigation.path.get("sso")?.value;
        if (isLogin) {
            if (this.activeSection !== "login") {
                this._showLogin();
            }
        } else if (logoutSessionId && isForcedLogout) {
            if (this.activeSection !== "forced-logout") {
                this._showForcedLogout(logoutSessionId);
            }
        } else if (logoutSessionId) {
            if (this.activeSection !== "logout") {
                this._showLogout(logoutSessionId);
            }
        } else if (sessionId === true) {
            if (this.activeSection !== "picker") {
                this._showPicker();
            }
        } else if (sessionId) {
            if (!this._sessionViewModel || this._sessionViewModel.id !== sessionId) {
                // see _showLogin for where _pendingClient comes from
                if (this._pendingClient && this._pendingClient.sessionId === sessionId) {
                    const client = this._pendingClient;
                    this._pendingClient = null;
                    this._showSession(client);
                } else {
                    // this should never happen, but we want to be sure not to leak it
                    if (this._pendingClient) {
                        this._pendingClient.dispose();
                        this._pendingClient = null;
                    }
                    this._showSessionLoader(sessionId);
                }
            }
        } else if (loginToken) {
            this.urlRouter.normalizeUrl();
            if (this.activeSection !== "login") {
                this._showLogin(loginToken);
            }
        }
        else {
            try {
                if (!(shouldRestoreLastUrl && this.urlRouter.tryRestoreLastUrl())) {
                    const sessionInfos = await this.platform.sessionInfoStorage.getAll();
                    if (sessionInfos.length === 0) {
                        this.navigation.push("login");
                    } else if (sessionInfos.length === 1) {
                        this.navigation.push("session", sessionInfos[0].id);
                    } else {
                        this.navigation.push("session");
                    }
                }
            } catch (err) {
                this._setSection(() => this._error = err);
            }
        }
    }

    async _showPicker() {
        this._setSection(() => {
            this._sessionPickerViewModel = new SessionPickerViewModel(this.childOptions());
        });
        try {
            await this._sessionPickerViewModel.load();
        } catch (err) {
            this._setSection(() => this._error = err);
        }
    }

    _showLogin(loginToken) {
        this._setSection(() => {
            this._loginViewModel = new LoginViewModel(this.childOptions({
                defaultHomeserver: this.platform.config["defaultHomeServer"],
                ready: client => {
                    // we don't want to load the session container again,
                    // but we also want the change of screen to go through the navigation
                    // so we store the session container in a temporary variable that will be
                    // consumed by _applyNavigation, triggered by the navigation change
                    //
                    // Also, we should not call _setSection before the navigation is in the correct state,
                    // as url creation (e.g. in RoomTileViewModel)
                    // won't be using the correct navigation base path.
                    this._pendingClient = client;
                    this.navigation.push("session", client.sessionId);
                },
                loginToken
            }));
        });
    }

    _showLogout(sessionId) {
        this._setSection(() => {
            this._logoutViewModel = new LogoutViewModel(this.childOptions({sessionId}));
        });
    }

    _showForcedLogout(sessionId) {
        this._setSection(() => {
            this._forcedLogoutViewModel = new ForcedLogoutViewModel(this.childOptions({sessionId}));
        });
    }

    _showSession(client) {
        this._setSection(() => {
            this._sessionViewModel = new SessionViewModel(this.childOptions({client}));
            this._sessionViewModel.start();
        });
    }

    _showSessionLoader(sessionId) {
        const client = new Client(this.platform);
        client.startWithExistingSession(sessionId);
        this._setSection(() => {
            this._sessionLoadViewModel = new SessionLoadViewModel(this.childOptions({
                client,
                ready: client => this._showSession(client)
            }));
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
        } else if (this._logoutViewModel) {
            return "logout";
        } else if (this._forcedLogoutViewModel) {
            return "forced-logout";
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
        this._sessionPickerViewModel = this.disposeTracked(this._sessionPickerViewModel);
        this._sessionLoadViewModel = this.disposeTracked(this._sessionLoadViewModel);
        this._loginViewModel = this.disposeTracked(this._loginViewModel);
        this._logoutViewModel = this.disposeTracked(this._logoutViewModel);
        this._forcedLogoutViewModel = this.disposeTracked(this._forcedLogoutViewModel);
        this._sessionViewModel = this.disposeTracked(this._sessionViewModel);
        // now set it again
        setter();
        this._sessionPickerViewModel && this.track(this._sessionPickerViewModel);
        this._sessionLoadViewModel && this.track(this._sessionLoadViewModel);
        this._loginViewModel && this.track(this._loginViewModel);
        this._logoutViewModel && this.track(this._logoutViewModel);
        this._forcedLogoutViewModel && this.track(this._forcedLogoutViewModel);
        this._sessionViewModel && this.track(this._sessionViewModel);
        this.emitChange("activeSection");
    }

    get error() { return this._error; }
    get sessionViewModel() { return this._sessionViewModel; }
    get loginViewModel() { return this._loginViewModel; }
    get logoutViewModel() { return this._logoutViewModel; }
    get forcedLogoutViewModel() { return this._forcedLogoutViewModel; }
    get sessionPickerViewModel() { return this._sessionPickerViewModel; }
    get sessionLoadViewModel() { return this._sessionLoadViewModel; }
}
