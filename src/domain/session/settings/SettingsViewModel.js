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

import {ViewModel} from "../../ViewModel";
import {KeyBackupViewModel} from "./KeyBackupViewModel";
import {FeaturesViewModel} from "./FeaturesViewModel";
import {submitLogsFromSessionToDefaultServer} from "../../../domain/rageshake";

class PushNotificationStatus {
    constructor() {
        this.supported = null;
        this.enabled = false;
        this.updating = false;
        this.enabledOnServer = null;
        this.serverError = null;
    }
}

function formatKey(key) {
    const partLength = 4;
    const partCount = Math.ceil(key.length / partLength);
    let formattedKey = "";
    for (let i = 0; i < partCount; i += 1) {
        formattedKey += (formattedKey.length ? " " : "") + key.slice(i * partLength, (i + 1) * partLength);
    }
    return formattedKey;
}

export class SettingsViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._updateService = options.updateService;
        const {client} = options;
        this._client = client;
        this._keyBackupViewModel = this.track(new KeyBackupViewModel(this.childOptions({session: this._session})));
        this._closeUrl = this.urlRouter.urlUntilSegment("session");
        this._estimate = null;
        this.sentImageSizeLimit = null;
        this.minSentImageSizeLimit = 400;
        this.maxSentImageSizeLimit = 4000;
        this.pushNotifications = new PushNotificationStatus();
        this._activeTheme = undefined;
        this._logsFeedbackMessage = undefined;
        this._featuresViewModel = new FeaturesViewModel(this.childOptions());
    }

    get _session() {
        return this._client.session;
    }

    async logout() {
        this.navigation.push("logout", this._client.sessionId);
    }

    setSentImageSizeLimit(size) {
        if (size > this.maxSentImageSizeLimit || size < this.minSentImageSizeLimit) {
            this.sentImageSizeLimit = null;
            this.platform.settingsStorage.remove("sentImageSizeLimit");
        } else {
            this.sentImageSizeLimit = Math.round(size);
            this.platform.settingsStorage.setInt("sentImageSizeLimit", size);
        }
        this.emitChange("sentImageSizeLimit");
    }

    async load() {
        this._estimate = await this.platform.estimateStorageUsage();
        this.sentImageSizeLimit = await this.platform.settingsStorage.getInt("sentImageSizeLimit");
        this.pushNotifications.supported = await this.platform.notificationService.supportsPush();
        this.pushNotifications.enabled = await this._session.arePushNotificationsEnabled();
        if (!import.meta.env.DEV) {
            this._activeTheme = await this.platform.themeLoader.getActiveTheme();
        }
        this.emitChange("");
    }

    get closeUrl() {
        return this._closeUrl;
    }

    get fingerprintKey() {
        const key = this._session.fingerprintKey;
        if (!key) {
            return null;
        }
        return formatKey(key);
    }

    get deviceId() {
        return this._session.deviceId;
    }

    get userId() {
        return this._session.userId;
    }

    get version() {
        const {updateService} = this.platform; 
        if (updateService) {
            return `${updateService.version} (${updateService.buildHash})`;
        }
        return this.i18n`development version`;
    }

    checkForUpdate() {
        this.platform.updateService?.checkForUpdate();
    }

    get showUpdateButton() {
        return !!this.platform.updateService;
    }

    get keyBackupViewModel() {
        return this._keyBackupViewModel;
    }

    get featuresViewModel() {
        return this._featuresViewModel;
    }

    get storageQuota() {
        return this._formatBytes(this._estimate?.quota);
    }

    get storageUsage() {
        return this._formatBytes(this._estimate?.usage);
    }

    get themeMapping() {
        return this.platform.themeLoader.themeMapping;
    }

    get activeTheme() {
        return this._activeTheme;
    }

    _formatBytes(n) {
        if (typeof n === "number") {
            return Math.round(n / (1024 * 1024)).toFixed(1) + " MB";
        } else {
            return this.i18n`unknown`;
        }
    }

    async exportLogs() {
        const logs = await this.exportLogsBlob();
        this.platform.saveFileAs(logs, `hydrogen-logs-${this.platform.clock.now()}.json`);
    }

    async exportLogsBlob() {
        const persister = this.logger.reporters.find(r => typeof r.export === "function");
        const logExport = await persister.export();
        return logExport.asBlob();
    }

    get canSendLogsToServer() {
        return !!this.platform.config.bugReportEndpointUrl;
    }

    get logsServer() {
        const {bugReportEndpointUrl} = this.platform.config;
        try {
            if (bugReportEndpointUrl) {
                return new URL(bugReportEndpointUrl).hostname;
            }
        } catch (e) {}
        return "";
    }

    async sendLogsToServer() {
        this._logsFeedbackMessage = this.i18n`Sending logs…`;
        try {
            await submitLogsFromSessionToDefaultServer(this._session, this.platform);
            this._logsFeedbackMessage = this.i18n`Logs sent succesfully!`;
        } catch (err) {
            this._logsFeedbackMessage = err.message;
            this.emitChange();
        }
    }

    get logsFeedbackMessage() {
        return this._logsFeedbackMessage;
    }

    async togglePushNotifications() {
        this.pushNotifications.updating = true;
        this.pushNotifications.enabledOnServer = null;
        this.pushNotifications.serverError = null;
        this.emitChange("pushNotifications.updating");
        try {
            if (await this._session.enablePushNotifications(!this.pushNotifications.enabled)) {
                this.pushNotifications.enabled = !this.pushNotifications.enabled;
                if (this.pushNotifications.enabled) {
                    this.platform.notificationService.showNotification(this.i18n`Push notifications are now enabled`);
                }
            }
        } finally {
        this.pushNotifications.updating = false;
            this.emitChange("pushNotifications.updating");
        }
    }

    async checkPushEnabledOnServer() {
        this.pushNotifications.enabledOnServer = null;
        this.pushNotifications.serverError = null;
        try {
            this.pushNotifications.enabledOnServer = await this._session.checkPusherEnabledOnHomeserver();
            this.emitChange("pushNotifications.enabledOnServer");
        } catch (err) {
            this.pushNotifications.serverError = err;
            this.emitChange("pushNotifications.serverError");
        }
    }

    changeThemeOption(themeName, themeVariant) {
        this.platform.themeLoader.setTheme(themeName, themeVariant);
        // emit so that radio-buttons become displayed/hidden
        this.emitChange("themeOption");
    }
}

