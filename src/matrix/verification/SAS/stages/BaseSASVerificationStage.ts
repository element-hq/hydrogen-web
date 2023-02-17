/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import type {ILogItem} from "../../../../lib.js";
import type {Room} from "../../../room/Room.js";
import {Disposables} from "../../../../utils/Disposables";

export type UserData = {
    userId: string;
    deviceId: string;
}

export type Options = {
    room: Room;
    ourUser: UserData;
    otherUserId: string;
    log: ILogItem;
}

export abstract class BaseSASVerificationStage extends Disposables {
    protected room: Room;
    protected ourUser: UserData;
    protected otherUserId: string;
    protected log: ILogItem;
    protected requestEventId: string;
    protected previousResult: undefined | any;
    protected _nextStage: BaseSASVerificationStage;

    constructor(options: Options) {
        super();
        this.room = options.room;
        this.ourUser = options.ourUser;
        this.otherUserId = options.otherUserId;
        this.log = options.log;
    }

    setRequestEventId(id: string) {
        this.requestEventId = id;
        // todo: can this race with incoming message?
        this.nextStage?.setRequestEventId(id);
    }

    setResultFromPreviousStage(result?: any) {
        this.previousResult = result;
    }

    setNextStage(stage: BaseSASVerificationStage) {
        this._nextStage = stage;
    }

    get nextStage(): BaseSASVerificationStage {
        return this._nextStage;
    }

    abstract get type(): string;
    abstract completeStage(): Promise<any>;
}
