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

export type Content = { [key: string]: any }

// T can be a string literal denoting the specific type of an event, like "m.room.message".
export type TimelineEvent<T extends string = string, C = Content, U = Content> = {
    content: C;
    type: T;
    event_id: string;
    sender: string;
    origin_server_ts: number;
    unsigned?: U;
}

// S can be a string literal denoting the state_key, most often it's ""
export type StateEvent<
    T extends string = string,
    C = Content,
    S extends string = string,
    U = Content
> = TimelineEvent<T, C, U> & { prev_content?: C; state_key: S };

