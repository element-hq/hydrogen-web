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

import { StateEvent } from "./event";

// TODO: replace the hardcoded values of this throughout the codebase with the enum.
export enum RoomEventType {
  Aliases = "m.room.aliases",
  Avatar = "m.room.avatar",
  Bgd = "m.room.bgd",
  CanonicalAlias = "m.room.canonical_alias",
  Config = "m.room.config",
  Create = "m.room.create",
  Encrypted = "m.room.encrypted",
  Encryption = "m.room.encryption",
  Guest_access = "m.room.guest_access",
  HistoryVisibility = "m.room.history_visibility",
  JoinRules = "m.room.join_rules",
  Member = "m.room.member",
  MemberEvent = "m.room.member_event",
  Message = "m.room.message",
  Name = "m.room.name",
  PinnedEvents = "m.room.pinned_events",
  PowerLevels = "m.room.power_levels",
  Redaction = "m.room.redaction",
  ServerAcl = "m.room.server_acl",
  ThirdPartyInvite = "m.room.third_party_invite",
  Tombstone = "m.room.tombstone",
  Topic = "m.room.topic",
}

/**
 * https://spec.matrix.org/v1.4/client-server-api/#mroompower_levels
 */
export type PowerLevelsEvent = StateEvent<PowerLevelsContent, RoomEventType.PowerLevels, "">

type PowerLevelsContent = {
  ban: number;
  events: { RoomEventType: number }; // This is a mapping from event type to power level required.
  events_default: number;
  invite: number;
  kick: number;
  notifications: { room: number } // This is a mapping from key to power level for that notifications key.
  redact: number;
  state_default: number;
  users: { string: number } // This is a mapping from user_id to power level for that user.
  users_default: number;
}

export type HistoryVisibility = "invited" | "joined" | "shared" | "world readable"