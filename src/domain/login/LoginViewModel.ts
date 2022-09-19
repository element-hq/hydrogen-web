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

import {Client} from "../../matrix/Client.js";
import {Options as BaseOptions, ViewModel} from "../ViewModel";
import {PasswordLoginViewModel} from "./PasswordLoginViewModel";
import {StartSSOLoginViewModel} from "./StartSSOLoginViewModel";
import {CompleteSSOLoginViewModel} from "./CompleteSSOLoginViewModel";
import {LoadStatus} from "../../matrix/Client.js";
import {SessionLoadViewModel} from "../SessionLoadViewModel.js";
import {SegmentType} from "../navigation/index";

import type {PasswordLoginMethod, SSOLoginHelper, TokenLoginMethod, ILoginMethod} from "../../matrix/login";

type Options = {
    defaultHomeserver: string;
    ready: ReadyFn;
    loginToken?: string;
} & BaseOptions;

export class LoginViewModel extends ViewModel<SegmentType, Options> {
    private _ready: ReadyFn;
    private _loginToken?: string;
    private _client: Client;
    private _loginOptions?: LoginOptions;
    private _passwordLoginViewModel?: PasswordLoginViewModel;
    private _startSSOLoginViewModel?: StartSSOLoginViewModel;
    private _completeSSOLoginViewModel?: CompleteSSOLoginViewModel;
    private _loadViewModel?: SessionLoadViewModel;
    private _loadViewModelSubscription?: () => void;
    private _homeserver: string;
    private _queriedHomeserver?: string;
    private _abortHomeserverQueryTimeout?: () => void;
    private _abortQueryOperation?: () => void;

    private _hideHomeserver: boolean = false;
    private _isBusy: boolean = false;
    private _errorMessage: string = "";

    constructor(options: Readonly<Options>) {
        super(options);
        const {ready, defaultHomeserver, loginToken} = options;
        this._ready = ready;
        this._loginToken = loginToken;
        this._client = new Client(this.platform);
        this._homeserver = defaultHomeserver;
        this._initViewModels();
    }

    get passwordLoginViewModel(): PasswordLoginViewModel | undefined {
        return this._passwordLoginViewModel;
    }

    get startSSOLoginViewModel(): StartSSOLoginViewModel | undefined {
        return this._startSSOLoginViewModel;
    }

    get completeSSOLoginViewModel(): CompleteSSOLoginViewModel | undefined {
        return this._completeSSOLoginViewModel;
    }

    get homeserver(): string {
        return this._homeserver;
    }

    get resolvedHomeserver(): string | undefined {
        return this._loginOptions?.homeserver;
    }

    get errorMessage(): string {
        return this._errorMessage;
    }

    get showHomeserver(): boolean {
        return !this._hideHomeserver;
    }

    get loadViewModel(): SessionLoadViewModel {
        return this._loadViewModel;
    }

    get isBusy(): boolean {
        return this._isBusy;
    }

    get isFetchingLoginOptions(): boolean {
        return !!this._abortQueryOperation;
    }

    goBack(): void {
        this.navigation.push("session");
    }

    private _initViewModels(): void {
        if (this._loginToken) {
            this._hideHomeserver = true;
            this._completeSSOLoginViewModel = this.track(new CompleteSSOLoginViewModel(
                this.childOptions(
                    {
                        client: this._client,
                        attemptLogin: (loginMethod: TokenLoginMethod) => this.attemptLogin(loginMethod),
                        loginToken: this._loginToken
                    })));
            this.emitChange("completeSSOLoginViewModel");
        }
        else {
            void this.queryHomeserver();
        }
    }

    private _showPasswordLogin(): void {
        this._passwordLoginViewModel = this.track(new PasswordLoginViewModel(
            this.childOptions({
                loginOptions: this._loginOptions,
                attemptLogin: (loginMethod: PasswordLoginMethod) => this.attemptLogin(loginMethod)
        })));
        this.emitChange("passwordLoginViewModel");
    }

    private _showSSOLogin(): void {
        this._startSSOLoginViewModel = this.track(
            new StartSSOLoginViewModel(this.childOptions({loginOptions: this._loginOptions}))
        );
        this.emitChange("startSSOLoginViewModel");
    }

    private _showError(message: string): void {
        this._errorMessage = message;
        this.emitChange("errorMessage");
    }

    private _setBusy(status: boolean): void {
        this._isBusy = status;
        this._passwordLoginViewModel?.setBusy(status);
        this._startSSOLoginViewModel?.setBusy(status);
        this.emitChange("isBusy");
    }

    async attemptLogin(loginMethod: ILoginMethod): Promise<null> {
        this._setBusy(true);
        void this._client.startWithLogin(loginMethod, {inspectAccountSetup: true});
        const loadStatus = this._client.loadStatus;
        const handle = loadStatus.waitFor((status: LoadStatus) => status !== LoadStatus.Login);
        await handle.promise;
        this._setBusy(false);
        const status = loadStatus.get();
        if (status === LoadStatus.LoginFailed) {
            return this._client.loginFailure;
        }
        this._hideHomeserver = true;
        this.emitChange("hideHomeserver");
        this._disposeViewModels();
        void this._createLoadViewModel();
        return null;
    }

    private _createLoadViewModel(): void {
        this._loadViewModelSubscription = this.disposeTracked(this._loadViewModelSubscription);
        this._loadViewModel = this.disposeTracked(this._loadViewModel);
        this._loadViewModel = this.track(
            new SessionLoadViewModel(
                this.childOptions({
                    ready: (client) => {
                        // make sure we don't delete the session in dispose when navigating away
                        this._client = null;
                        this._ready(client);
                    },
                    client: this._client,
                    homeserver: this._homeserver
                })
            )
        );
        void this._loadViewModel.start();
        this.emitChange("loadViewModel");
        this._loadViewModelSubscription = this.track(
            this._loadViewModel.disposableOn("change", () => {
                if (!this._loadViewModel.loading) {
                    this._loadViewModelSubscription = this.disposeTracked(this._loadViewModelSubscription);
                }
                this._setBusy(false);
            })
        );
    }

    private _disposeViewModels(): void {
        this._startSSOLoginViewModel = this.disposeTracked(this._startSSOLoginViewModel);
        this._passwordLoginViewModel = this.disposeTracked(this._passwordLoginViewModel);
        this._completeSSOLoginViewModel = this.disposeTracked(this._completeSSOLoginViewModel);
        this.emitChange("disposeViewModels");
    }

    async setHomeserver(newHomeserver: string): Promise<void> {
        this._homeserver = newHomeserver;
        // clear everything set by queryHomeserver
        this._loginOptions = undefined;
        this._queriedHomeserver = undefined;
        this._showError("");
        this._disposeViewModels();
        this._abortQueryOperation = this.disposeTracked(this._abortQueryOperation);
        this.emitChange("loginViewModels"); // multiple fields changing
        // also clear the timeout if it is still running
        this.disposeTracked(this._abortHomeserverQueryTimeout);
        const timeout = this.clock.createTimeout(1000);
        this._abortHomeserverQueryTimeout = this.track(() => timeout.abort());
        try {
            await timeout.elapsed();
        } catch (err) {
            if (err.name === "AbortError") {
                return; // still typing, don't query
            } else {
                throw err;
            }
        }
        this._abortHomeserverQueryTimeout = this.disposeTracked(this._abortHomeserverQueryTimeout);
        void this.queryHomeserver();
    }

    async queryHomeserver(): Promise<void> {
        // don't repeat a query we've just done
        if (this._homeserver === this._queriedHomeserver || this._homeserver === "") {
            return;
        }
        this._queriedHomeserver = this._homeserver;
        // given that setHomeserver already clears everything set here,
        // and that is the only way to change the homeserver,
        // we don't need to reset things again here.
        // However, clear things set by setHomeserver:
        // if query is called before the typing timeout hits (e.g. field lost focus),
        // cancel the timeout so we don't query again.
        this._abortHomeserverQueryTimeout = this.disposeTracked(this._abortHomeserverQueryTimeout);
        // cancel ongoing query operation, if any
        this._abortQueryOperation = this.disposeTracked(this._abortQueryOperation);
        try {
            const queryOperation = this._client.queryLogin(this._homeserver);
            this._abortQueryOperation = this.track(() => queryOperation.abort());
            this.emitChange("isFetchingLoginOptions");
            this._loginOptions = await queryOperation.result;
            this.emitChange("resolvedHomeserver");
        }
        catch (e) {
            if (e.name === "AbortError") {
                return; //aborted, bail out
            } else {
                this._loginOptions = undefined;
            }
        } finally {
            this._abortQueryOperation = this.disposeTracked(this._abortQueryOperation);
            this.emitChange("isFetchingLoginOptions");
        }
        if (this._loginOptions) {
            if (this._loginOptions.sso) { this._showSSOLogin(); }
            if (this._loginOptions.password) { this._showPasswordLogin(); }
            if (!this._loginOptions.sso && !this._loginOptions.password) {
                this._showError("This homeserver supports neither SSO nor password based login flows");
            }
        }
        else {
            this._showError(`Could not query login methods supported by ${this.homeserver}`);
        }
    }

    dispose(): void {
        super.dispose();
        if (this._client) {
            // if we move away before we're done with initial sync
            // delete the session
            void this._client.deleteSession();
        }
    }
}

type ReadyFn = (client: Client) => void;

// TODO: move to Client.js when its converted to typescript.
export type LoginOptions = {
    homeserver: string;
    password?: (username: string, password: string) => PasswordLoginMethod;
    sso?: SSOLoginHelper;
    token?: (loginToken: string) => TokenLoginMethod;
};
