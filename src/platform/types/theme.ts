/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

export type ThemeManifest = Partial<{
    /**
     * Version number of the theme manifest.
     * This must be incremented when backwards incompatible changes are introduced.
     */
    version: number;
    // A user-facing string that is the name for this theme-collection.
    name: string;
    // An identifier for this theme
    id: string;
    /**
     * Id of the theme that this theme derives from.
     * Only present for derived/runtime themes.
    */
    extends: string;
    /**
     * This is added to the manifest during the build process and includes data
     * that is needed to load themes at runtime.
     */
    source: {
        /**
         * This is a mapping from theme-id to location of css file relative to the location of the
         * manifest.
         * eg: {"element-light": "theme-element-light.10f9bb22.css", ...}
         *
         * Here theme-id is 'theme-variant' where 'theme' is the key used to specify the manifest
         * location for this theme-collection in vite.config.js (where the themeBuilder plugin is
         * initialized) and 'variant' is the key used to specify the variant details in the values
         * section below.
         */
        "built-asset": Record<string, string>;
        // Location of css file that will be used for themes derived from this theme.
        "runtime-asset": string;
        // Array of derived-variables
        "derived-variables": Array<string>;
        /**
         * Mapping from icon variable to location of icon in build output with query parameters
         * indicating how it should be colored for this particular theme.
         * eg: "icon-url-1": "element-logo.86bc8565.svg?primary=accent-color"
         */
        icon: Record<string, string>;
    };
    values: {
        /**
         * Mapping from variant key to details pertaining to this theme-variant.
         * This variant key is used for forming theme-id as mentioned above.
         */
        variants: Record<string, Variant>;
    };
}>;

type Variant = Partial<{
    /**
     * If true, this variant is used a default dark/light variant and will be the selected theme
     * when "Match system theme" is selected for this theme collection in settings.
     */
    default: boolean;
    // A user-facing string that is the name for this variant.
    name: string;
    // A boolean indicating whether this is a dark theme or not
    dark: boolean;
    /**
     * Mapping from css variable to its value.
     * eg: {"background-color-primary": "#21262b", ...} 
     */
    variables: Record<string, string>;
}>;
