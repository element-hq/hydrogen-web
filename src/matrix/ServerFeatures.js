const R0_5_0 = "r0.5.0";

export class ServerFeatures {
    constructor(versionResponse) {
        this._versionResponse = versionResponse;
    }

    _supportsVersion(version) {
        if (!this._versionResponse) {
            return false;
        }
        const {versions} = this._versionResponse;
        return Array.isArray(versions) && versions.includes(version);
    }

    get lazyLoadMembers() {
        return this._supportsVersion(R0_5_0);
    }
}
