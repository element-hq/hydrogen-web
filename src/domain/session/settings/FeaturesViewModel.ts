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
import type {Options as BaseOptions} from "../../ViewModel";
import {FeatureFlag, FeatureSet} from "../../../features";
import type {SegmentType} from "../../navigation/index";

export class FeaturesViewModel extends ViewModel {
    public readonly featureViewModels: ReadonlyArray<FeatureViewModel>;

    constructor(options) {
        super(options);
        this.featureViewModels = [
            new FeatureViewModel(this.childOptions({
                name: this.i18n`Audio/video calls`,
                description: this.i18n`Allows starting and participating in A/V calls compatible with Element Call (MSC3401). Look for the start call option in the room menu ((...) in the right corner) to start a call.`,
                feature: FeatureFlag.Calls
            })),
            new FeatureViewModel(this.childOptions({
                name: this.i18n`Cross-Signing`,
                description: this.i18n`Allows verifying the identity of people you chat with. This feature is still evolving constantly, expect things to break.`,
                feature: FeatureFlag.CrossSigning
            })),
        ];
    }
}

type FeatureOptions = BaseOptions & {
    feature: FeatureFlag,
    description: string,
    name: string
};

export class FeatureViewModel extends ViewModel<SegmentType, FeatureOptions> {
    get enabled(): boolean {
        return this.features.isFeatureEnabled(this.getOption("feature"));
    }

    async enableFeature(enabled: boolean): Promise<void> {
        let newFeatures;
        if (enabled) {
            newFeatures = this.features.withFeature(this.getOption("feature"));
        } else {
            newFeatures = this.features.withoutFeature(this.getOption("feature"));
        }
        await newFeatures.store(this.platform.settingsStorage);
        this.platform.restart();
    }

    get id(): string {
        return `${this.getOption("feature")}`;
    }

    get name(): string {
        return this.getOption("name");
    }

    get description(): string {
        return this.getOption("description");
    }
}
