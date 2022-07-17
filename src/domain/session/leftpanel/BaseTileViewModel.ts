/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";
import {Options, ViewModel} from "../../ViewModel";
import {MediaRepository} from "../../../matrix/net/MediaRepository";

const KIND_ORDER = ["roomBeingCreated", "invite", "room"] as const;
export type Kind = typeof KIND_ORDER[number];

export abstract class BaseTileViewModel extends ViewModel {
    private _isOpen: boolean = false;
    private _hidden: boolean = false;

    constructor(options: Readonly<Options>) {
        super(options);
    }

    abstract get name(): string;
    abstract get kind(): Kind;

    get hidden(): boolean {
        return this._hidden;
    }

    set hidden(value: boolean) {
        if (value !== this._hidden) {
            this._hidden = value;
            this.emitChange("hidden");
        }
    }

    close(): void {
        if (this._isOpen) {
            this._isOpen = false;
            this.emitChange("isOpen");
        }
    }

    open(): void {
        if (!this._isOpen) {
            this._isOpen = true;
            this.emitChange("isOpen");
        }
    }

    get isOpen(): boolean {
        return this._isOpen;
    }

    compare(other: BaseTileViewModel): number {
        if (other.kind !== this.kind) {
            return KIND_ORDER.indexOf(this.kind) - KIND_ORDER.indexOf(other.kind);
        }
        return 0;
    }

    protected abstract get _avatarSource(): AvatarSource;

    // Avatar view model contract
    get avatarLetter(): string {
        return avatarInitials(this.name);
    }

    get avatarColorNumber(): number {
        return getIdentifierColorNumber(this._avatarSource.avatarColorId);
    }

    avatarUrl(size: number): string | null {
        if (this._avatarSource.avatarUrl) {
            return getAvatarHttpUrl(this._avatarSource.avatarUrl, size, this.platform, this._avatarSource.mediaRepository);
        }
        return null;
    }

    get avatarTitle(): string {
        return this.name;
    }
}

export type AvatarSource = {
    avatarColorId: string;
    avatarUrl: string | undefined;
    mediaRepository: MediaRepository;
}
