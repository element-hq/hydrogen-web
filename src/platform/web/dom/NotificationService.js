/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

export class NotificationService {
    constructor(serviceWorkerHandler, pushConfig) {
        this._serviceWorkerHandler = serviceWorkerHandler;
        this._pushConfig = pushConfig;
    }

    async enablePush(pusherFactory, defaultPayload, hsApi) {
        const registration = await this._serviceWorkerHandler?.getRegistration();
        if (registration?.pushManager) {
            const response = await hsApi.capabilities().response();
            var webPushCapability = response?.capabilities?.["m.webpush"]
            if (!webPushCapability)
                webPushCapability = response?.capabilities?.["org.matrix.msc4174.webpush"]

            var supportDirectWebPush = false;
            var applicationServerKey = this._pushConfig.applicationServerKey
            if (webPushCapability && webPushCapability?.enabled == true) {
                supportDirectWebPush = true;
                applicationServerKey = webPushCapability?.vapid
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey,
            });
            const subscriptionData = subscription.toJSON();
            const pushkey = subscriptionData.keys.p256dh;
            const data = {
                endpoint: subscriptionData.endpoint,
                auth: subscriptionData.keys.auth,
                // don't deliver unread count push messages
                // as we don't want to show a notification in this case
                events_only: true,
                default_payload: defaultPayload
            };
            if (supportDirectWebPush) {
                return pusherFactory.webpushPusher(
                    this._pushConfig.appId,
                    pushkey,
                    data
                );
            } else {
                return pusherFactory.httpPusher(
                    this._pushConfig.gatewayUrl,
                    this._pushConfig.appId,
                    pushkey,
                    data
                );
            }
        }
    }

    async disablePush() {
        const registration = await this._serviceWorkerHandler?.getRegistration();
        if (registration?.pushManager) {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
            }
        }
    }

    async isPushEnabled() {
        const registration = await this._serviceWorkerHandler?.getRegistration();
        if (registration?.pushManager) {
            const subscription = await registration.pushManager.getSubscription();
            return !!subscription;
        }
        return false;
    }

    async supportsPush() {
        if (!this._pushConfig) {
            return false;
        }
        const registration = await this._serviceWorkerHandler?.getRegistration();
        return registration && "pushManager" in registration;
    }

    async enableNotifications() {
        if ("Notification" in window) {
            return (await Notification.requestPermission()) === "granted";
        }
        return false;
    }

    async supportsNotifications() {
        return "Notification" in window;
    }

    async areNotificationsEnabled() {
        if ("Notification" in window) {
            return Notification.permission === "granted";
        } else {
            return false;
        }
    }

    async showNotification(title, body = undefined) {
        if ("Notification" in window) {
            new Notification(title, {body});
            return;
        }
        // Chrome on Android does not support the Notification constructor
        const registration = await this._serviceWorkerHandler?.getRegistration();
        registration?.showNotification(title, {body});
    }
}
