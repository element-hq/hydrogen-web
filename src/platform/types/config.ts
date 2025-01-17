/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
