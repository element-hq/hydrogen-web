export class Pusher {
    constructor(description) {
        this._description = description;
    }

    static httpPusher(host, appId, pushkey, data) {
        return new Pusher({
            kind: "http",
            append: true,   // as pushkeys are shared between multiple users on one origin
            data: Object.assign({}, data, {url: host + "/_matrix/push/v1/notify"}),
            pushkey,
            app_id: appId,
            app_display_name: "Hydrogen",
            device_display_name: "Hydrogen",
            lang: "en"
        });
    }

    static createDefaultPayload(sessionId) {
        return {session_id: sessionId};
    }

    async enable(hsApi, log) {
        await hsApi.setPusher(this._description, {log}).response();
    }

    async disable(hsApi, log) {
        const deleteDescription = Object.assign({}, this._description, {kind: null});
        await hsApi.setPusher(deleteDescription, {log}).response();
    }

    serialize() {
        return this._description;
    }
}
