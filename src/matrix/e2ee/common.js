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

// use common prefix so it's easy to clear properties that are not e2ee related during session clear
export const SESSION_KEY_PREFIX = "e2ee:";
export const OLM_ALGORITHM = "m.olm.v1.curve25519-aes-sha2";
export const MEGOLM_ALGORITHM = "m.megolm.v1.aes-sha2";
