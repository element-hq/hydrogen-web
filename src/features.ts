/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {SettingsStorage} from "./platform/web/dom/SettingsStorage";

export enum FeatureFlag {
    Calls = 1 << 0,
    CrossSigning = 1 << 1
}

export class FeatureSet {
    constructor(public readonly flags: number = 0) {}

    withFeature(flag: FeatureFlag): FeatureSet {
        return new FeatureSet(this.flags | flag);
    }

    withoutFeature(flag: FeatureFlag): FeatureSet {
        return new FeatureSet(this.flags ^ flag);
    }
    
    isFeatureEnabled(flag: FeatureFlag): boolean {
        return (this.flags & flag) !== 0;
    }

    get calls(): boolean {
        return this.isFeatureEnabled(FeatureFlag.Calls);
    }

    get crossSigning(): boolean {
        return this.isFeatureEnabled(FeatureFlag.CrossSigning);
    }

    static async load(settingsStorage: SettingsStorage): Promise<FeatureSet> {
        const flags = await settingsStorage.getInt("enabled_features") || 0;
        return new FeatureSet(flags);
    }

    async store(settingsStorage: SettingsStorage): Promise<void> {
        await settingsStorage.setInt("enabled_features", this.flags);
    }
}
