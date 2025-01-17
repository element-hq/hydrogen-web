/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
