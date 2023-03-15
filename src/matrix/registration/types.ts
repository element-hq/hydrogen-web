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

export type AccountDetails = {
    username: string | null;
    password: string;
    initialDeviceDisplayName: string;
    inhibitLogin: boolean;
} 

export type RegistrationResponse = RegistrationResponseMoreDataNeeded | RegistrationResponseSuccess;

export type RegistrationResponseMoreDataNeeded = {
    completed?: string[];
    flows: RegistrationFlow[];
    params: Record<string, any>;
    session: string;
    status: 401;
} 

export type RegistrationResponseSuccess = {
    user_id: string;
    device_id: string;
    access_token?: string;
    status: 200;
}

export type AuthData = {
    userId: string;
    deviceId: string;
    homeserver: string;
    accessToken?: string;
}

export type RegistrationFlow = {
    stages: string[];
}

/* Types for Registration Stage */
export type AuthenticationData = {
    type: string;
    session: string;
    [key: string]: any;
}

// contains additional data needed to complete a stage, eg: link to privacy policy
export type RegistrationParams = {
    [key: string]: any;   
}
