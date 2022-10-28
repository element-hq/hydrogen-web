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

/**
 * The response from the v3 sync/ endpoint.
 * See https://spec.matrix.org/v1.4/client-server-api/#get_matrixclientv3sync
 */
export type SyncResponse = {
  account_data?: AccountData;
  device_lists?: DeviceLists;
  device_one_time_keys_count?: { string: number };
  next_batch: string;
  presence?: Presence;
  rooms?: Rooms;
  to_device?: ToDevice;
};

type AccountData = {
  events: SyncEvent[];
};

// Denoted as simply "Event" in the spec
type SyncEvent = {
  content: Object;
  type: string;
};

type DeviceLists = {
  changed?: string[];
  left?: string[];
};

type Presence = {
  events: SyncEvent[];
};

export type Rooms = {
  invite?: { string: InvitedRoom };
  join?: { string: JoinedRoom };
  knock?: { string: KnockedRoom };
  leave?: { string: LeftRoom };
};

export type InvitedRoom = {
  invite_state: InviteState;
};

type InviteState = {
  events: StrippedStateEvent[];
};

type StrippedStateEvent = {
  content: EventContent;
  sender: string;
  state_key: string;
  type: string;
};

export type JoinedRoom = {
  account_data?: AccountData;
  ephemeral?: Ephemeral;
  state?: State;
  summary?: RoomSummary;
  timeline?: Timeline;
  unread_notifications?: UnreadNotificationCounts;
  unread_thread_notifications?: { string: ThreadNotificationCounts };
};

type Ephemeral = {
  events: SyncEvent[];
};

type State = {
  events: ClientEventWithoutRoomID[];
};

export type ClientEventWithoutRoomID = {
  content: Object;
  event_id: string;
  origin_server_ts: number;
  sender: string;
  state_key?: string;
  type: string;
  unsigned?: UnsignedData;
};

type UnsignedData = {
  age?: number;
  prev_content?: EventContent;
  redacted_because?: ClientEventWithoutRoomID;
  transaction_id?: string;
};

type RoomSummary = {
  'm.heroes'?: string[];
  'm.invited_member_count'?: number;
  'm.joined_member_count'?: number;
};

export type Timeline = {
  events?: ClientEventWithoutRoomID[];
  limited?: boolean;
  prev_batch?: string;
};

type UnreadNotificationCounts = {
  highlight_count?: number;
  notification_count?: number;
};

type ThreadNotificationCounts = UnreadNotificationCounts;

type KnockedRoom = {
  knock_state: KnockState;
}

type KnockState = {
  events: StrippedStateEvent[];
}

export type LeftRoom = {
  account_data?: AccountData;
  state?: State;
  timeline?: Timeline;
}

type ToDevice = {
  events: ToDeviceEvent[];
};

// Denoted "Event" in the spec
type ToDeviceEvent = {
  content?: EventContent;
  type?: string;
  sender?: string;
};

type EventContent = Object;