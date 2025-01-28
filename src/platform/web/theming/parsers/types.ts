/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export type NormalVariant = {
    id: string;
    cssLocation: string;
    variables?: any;
};

export type Variant = NormalVariant & {
    variantName: string;
};

export type DefaultVariant = {
    dark: Variant;
    light: Variant;
    default: Variant;
}

export type ThemeInformation = NormalVariant | DefaultVariant; 

export enum ColorSchemePreference {
    Dark,
    Light
};
