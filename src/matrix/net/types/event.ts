/*
Copyright 2022 Isaiah Becker-Mayer (isaiah@becker-mayer.com)

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
import {Content} from "../../storage/types";

/**
 * Taken together, TimelineEvent and StateEvent comprise the Event type returned by
 * the /notifications endpoint (https://spec.matrix.org/v1.4/client-server-api/#get_matrixclientv3notifications).
 * They are delineated as they are here based on the similar delineation in src/matrix/storage/types.ts.
 *
 * It may be the case that these two should ultimately be married into a single Event type and/or integrated with
 * the types in src/matrix/storage/types.ts.
 */

export type TimelineEvent<C = Content, Type = string, U = Content> = {
    content: C;
    type: Type;
    event_id: string;
    room_id: string;
    sender: string;
    origin_server_ts: number;
    unsigned?: U;
}

export type StateEvent<C = Content, Type = string, StateKey = string, U = Content> = TimelineEvent<C, Type, U> & { prev_content?: C, state_key: StateKey }