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

import type {RequestResult} from "../web/dom/request/fetch.js";
import type {RequestBody} from "../../matrix/net/common";
import type { BaseObservableValue } from "../../observable/ObservableValue";

export interface IRequestOptions {
    uploadProgress?: (loadedBytes: number) => void;
    timeout?: number;
    body?: RequestBody;
    headers?: Map<string, string|number>;
    cache?: boolean;
    method?: string;
    format?: string;
}

export type RequestFunction = (url: string, options: IRequestOptions) => RequestResult;

export interface IBlobHandle {
    nativeBlob: any;
    url: string;
    size: number;
    mimeType: string;
    readAsBuffer(): BufferSource;
    dispose()
}

export type File = {
    readonly name: string;
    readonly blob: IBlobHandle;
}

export interface ITimeFormatter {
    formatTime(date: Date): string;
    formatRelativeDate(date: Date): string;
    formatMachineReadableDate(date: Date): string;
}