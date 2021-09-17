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

import {SortedArray} from "../observable/index.js";
import {ViewModel} from "./ViewModel.js";
import {avatarInitials, getIdentifierColorNumber} from "./avatar.js";

class SessionItemViewModel extends ViewModel {
    constructor(options, pickerVM) {
        super(options);
        this._pickerVM = pickerVM;
        this._sessionInfo = options.sessionInfo;
        this._isDeleting = false;
        this._isClearing = false;
        this._error = null;
        this._exportDataUrl = null;
    }

    get error() {
        return this._error && this._error.message;
    }

    async delete() {
        this._isDeleting = true;
        this.emitChange("isDeleting");
        try {
            await this._pickerVM.delete(this.id);
        } catch(err) {
            this._error = err;
            console.error(err);
            this.emitChange("error");
        } finally {
            this._isDeleting = false;
            this.emitChange("isDeleting");
        }
    }

    async clear() {
        this._isClearing = true;
        this.emitChange();
        try {
            await this._pickerVM.clear(this.id);
        } catch(err) {
            this._error = err;
            console.error(err);
            this.emitChange("error");
        } finally {
            this._isClearing = false;
            this.emitChange("isClearing");
        }
    }

    get isDeleting() {
        return this._isDeleting;
    }

    get isClearing() {
        return this._isClearing;
    }

    get id() {
        return this._sessionInfo.id;
    }

    get openUrl() {
        return this.urlCreator.urlForSegment("session", this.id);
    }

    get label() {
        const {userId, comment} =  this._sessionInfo;
        if (comment) {
            return `${userId} (${comment})`;
        } else {
            return userId;
        }
    }

    get sessionInfo() {
        return this._sessionInfo;
    }

    get exportDataUrl() {
        return this._exportDataUrl;
    }

    async export() {
        try {
            const data = await this._pickerVM._exportData(this._sessionInfo.id);
            const json = JSON.stringify(data, undefined, 2);
            const blob = new Blob([json], {type: "application/json"});
            this._exportDataUrl = URL.createObjectURL(blob);
            this.emitChange("exportDataUrl");
        } catch (err) {
            alert(err.message);
            console.error(err);
        }
    }

    clearExport() {
        if (this._exportDataUrl) {
            URL.revokeObjectURL(this._exportDataUrl);
            this._exportDataUrl = null;
            this.emitChange("exportDataUrl");
        }
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._sessionInfo.userId);
    }

    get avatarInitials() {
        return avatarInitials(this._sessionInfo.userId);
    }
}


export class SessionPickerViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._sessions = new SortedArray((s1, s2) => s1.id.localeCompare(s2.id));
        this._loadViewModel = null;
        this._error = null;
    }

    // this loads all the sessions
    async load() {
        const sessions = await this.platform.sessionInfoStorage.getAll();
        this._sessions.setManyUnsorted(sessions.map(s => {
            return new SessionItemViewModel(this.childOptions({sessionInfo: s}), this);
        }));
    }

    // for the loading of 1 picked session
    get loadViewModel() {
        return this._loadViewModel;
    }

    async _exportData(id) {
        const sessionInfo = await this.platform.sessionInfoStorage.get(id);
        const stores = await this.logger.run("export", log => {
            return this.platform.storageFactory.export(id, log);
        });
        const data = {sessionInfo, stores};
        return data;
    }

    async import(json) {
        try {
            const data = JSON.parse(json);
            const {sessionInfo} = data;
            sessionInfo.comment = `Imported on ${new Date().toLocaleString()} from id ${sessionInfo.id}.`;
            sessionInfo.id = this._createSessionContainer().createNewSessionId();
            await this.logger.run("import", log => {
                return this.platform.storageFactory.import(sessionInfo.id, data.stores, log);
            });
            await this.platform.sessionInfoStorage.add(sessionInfo);
            this._sessions.set(new SessionItemViewModel(sessionInfo, this));
        } catch (err) {
            alert(err.message);
            console.error(err);
        }
    }

    async delete(id) {
        const idx = this._sessions.array.findIndex(s => s.id === id);
        await this.platform.sessionInfoStorage.delete(id);
        await this.platform.storageFactory.delete(id);
        this._sessions.remove(idx);
    }

    async clear(id) {
        await this.platform.storageFactory.delete(id);
    }

    get sessions() {
        return this._sessions;
    }

    get cancelUrl() {
        return this.urlCreator.urlForSegment("login");
    }
}
