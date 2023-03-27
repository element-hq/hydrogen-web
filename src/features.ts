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
