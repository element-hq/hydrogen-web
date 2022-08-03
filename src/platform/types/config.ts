/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

export type Config = {
    /**
     * The default homeserver used by Hydrogen; auto filled in the login UI.
     * eg: https://matrix.org
     * REQUIRED
     */
    defaultHomeServer: string;
    /**
     * The submit endpoint for your preferred rageshake server.
     * eg: https://element.io/bugreports/submit
     * Read more about rageshake at https://github.com/matrix-org/rageshake
     * OPTIONAL
     */
    bugReportEndpointUrl?: string;
    /**
     * Paths to theme-manifests
     * eg: ["assets/theme-element.json", "assets/theme-awesome.json"]
     * REQUIRED
     */
    themeManifests: string[];
    /**
     * This configures the default theme(s) used by Hydrogen.
     * These themes appear as "Default" option in the theme chooser UI and are also
     * used as a fallback when other themes fail to load.
     * Whether the dark or light variant is used depends on the system preference.
     * OPTIONAL
     */
    defaultTheme?: {
        // id of light theme
        light: string;
        // id of dark theme
        dark: string;
    };
    /**
     * Configuration for push notifications.
     * See https://spec.matrix.org/latest/client-server-api/#post_matrixclientv3pushersset
     * and https://github.com/matrix-org/sygnal/blob/main/docs/applications.md#webpush
     * OPTIONAL
     */
    push?: {
        // See app_id in the request body in above link
        appId: string;
        // The host used for pushing notification
        gatewayUrl: string;
        // See pushkey in above link
        applicationServerKey: string;
    };
};
