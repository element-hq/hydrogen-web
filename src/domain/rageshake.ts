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

import type {BlobHandle} from "../platform/web/dom/BlobHandle";
import type {RequestFunction} from "../platform/types/types";
import type {Platform} from "../platform/web/Platform";
import type {ILogger} from "../logging/types";
import type { IDBLogPersister } from "../logging/IDBLogPersister";
import type { Session } from "../matrix/Session";

// see https://github.com/matrix-org/rageshake#readme
type RageshakeData = {
    // A textual description of the problem. Included in the details.log.gz file.
    text?: string;
    // Application user-agent. Included in the details.log.gz file.
    userAgent: string;
    // Identifier for the application (eg 'riot-web'). Should correspond to a mapping configured in the configuration file for github issue reporting to work.
    app: string;
    // Application version. Included in the details.log.gz file.
    version: string;
    // Label to attach to the github issue, and include in the details file.
    label?: string;
};

export async function submitLogsToRageshakeServer(data: RageshakeData, logsBlob: BlobHandle, submitUrl: string, request: RequestFunction): Promise<void> {
    const formData = new Map<string, string | {name: string, blob: BlobHandle}>();
    if (data.text) {
        formData.set("text", data.text);
    }
    formData.set("user_agent", data.userAgent);
    formData.set("app", data.app);
    formData.set("version", data.version);
    if (data.label) {
        formData.set("label", data.label);
    }
    formData.set("file", {name: "logs.json", blob: logsBlob});
    const headers: Map<string, string> = new Map();
    headers.set("Accept", "application/json");
    const result = request(submitUrl, {
        method: "POST",
        body: formData,
        headers
    });
    let response;
    try {
        response = await result.response();
    } catch (err) {
        throw new Error(`Could not submit logs to ${submitUrl}, got error ${err.message}`);
    }
    const {status, body} = response;
    if (status < 200 || status >= 300) {
        throw new Error(`Could not submit logs to ${submitUrl}, got status code ${status} with body ${body}`);
    }
    // we don't bother with reading report_url from the body as the rageshake server doesn't always return it
    // and would have to have CORS setup properly for us to be able to read it.
}

/** @throws {Error} */
export async function submitLogsFromSessionToDefaultServer(session: Session, platform: Platform): Promise<void> {
    const {bugReportEndpointUrl} = platform.config;
    if (!bugReportEndpointUrl) {
        throw new Error("no server configured to submit logs");
    }
    const logReporters = (platform.logger as ILogger).reporters;
    const exportReporter = logReporters.find(r => !!r["export"]) as IDBLogPersister | undefined;
    if (!exportReporter) {
        throw new Error("No logger that can export configured");
    }
    const logExport = await exportReporter.export();
    await submitLogsToRageshakeServer(
        {
            app: "hydrogen",
            userAgent: platform.description,
            version: platform.version,
            text: `Submit logs from settings for user ${session.userId} on device ${session.deviceId}`,
        },
        logExport.asBlob(),
        bugReportEndpointUrl,
        platform.request
    );
}
