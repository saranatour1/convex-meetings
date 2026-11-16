/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as api_annotations from "../api/annotations.js";
import type * as api_audit from "../api/audit.js";
import type * as api_auth from "../api/auth.js";
import type * as api_calls from "../api/calls.js";
import type * as api_guests from "../api/guests.js";
import type * as api_inbox from "../api/inbox.js";
import type * as api_invites from "../api/invites.js";
import type * as api_joinLinks from "../api/joinLinks.js";
import type * as api_meetings from "../api/meetings.js";
import type * as api_members from "../api/members.js";
import type * as api_messages from "../api/messages.js";
import type * as api_orgs from "../api/orgs.js";
import type * as api_roles from "../api/roles.js";
import type * as api_schedules from "../api/schedules.js";
import type * as api_settings from "../api/settings.js";
import type * as api_users from "../api/users.js";
import type * as http from "../http.js";
import type * as internal_guests from "../internal/guests.js";
import type * as internal_invites from "../internal/invites.js";
import type * as internal_migrations from "../internal/migrations.js";
import type * as internal_realtime from "../internal/realtime.js";
import type * as internal_users from "../internal/users.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_html from "../lib/html.js";
import type * as lib_presets from "../lib/presets.js";
import type * as lib_r2 from "../lib/r2.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_realtimekit from "../lib/realtimekit.js";
import type * as lib_recurrence from "../lib/recurrence.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_validate from "../lib/validate.js";
import type * as lib_webhooks from "../lib/webhooks.js";
import type * as lib_workpools from "../lib/workpools.js";
import type * as models_annotations from "../models/annotations.js";
import type * as models_audit from "../models/audit.js";
import type * as models_callSessions from "../models/callSessions.js";
import type * as models_calls from "../models/calls.js";
import type * as models_domains from "../models/domains.js";
import type * as models_guests from "../models/guests.js";
import type * as models_invites from "../models/invites.js";
import type * as models_joinLinks from "../models/joinLinks.js";
import type * as models_meetingAccess from "../models/meetingAccess.js";
import type * as models_meetings from "../models/meetings.js";
import type * as models_members from "../models/members.js";
import type * as models_messages from "../models/messages.js";
import type * as models_notifications from "../models/notifications.js";
import type * as models_orgs from "../models/orgs.js";
import type * as models_roles from "../models/roles.js";
import type * as models_schedules from "../models/schedules.js";
import type * as models_sessions from "../models/sessions.js";
import type * as models_settings from "../models/settings.js";
import type * as models_users from "../models/users.js";
import type * as tables_annotations from "../tables/annotations.js";
import type * as tables_auditEvents from "../tables/auditEvents.js";
import type * as tables_callPeers from "../tables/callPeers.js";
import type * as tables_groupMembers from "../tables/groupMembers.js";
import type * as tables_groups from "../tables/groups.js";
import type * as tables_invites from "../tables/invites.js";
import type * as tables_joinLinks from "../tables/joinLinks.js";
import type * as tables_meetingGuests from "../tables/meetingGuests.js";
import type * as tables_meetingMembers from "../tables/meetingMembers.js";
import type * as tables_meetingSessions from "../tables/meetingSessions.js";
import type * as tables_meetingTimes from "../tables/meetingTimes.js";
import type * as tables_meetings from "../tables/meetings.js";
import type * as tables_memberRoles from "../tables/memberRoles.js";
import type * as tables_members from "../tables/members.js";
import type * as tables_messageReactions from "../tables/messageReactions.js";
import type * as tables_messages from "../tables/messages.js";
import type * as tables_notifications from "../tables/notifications.js";
import type * as tables_organizations from "../tables/organizations.js";
import type * as tables_roles from "../tables/roles.js";
import type * as tables_schedules from "../tables/schedules.js";
import type * as tables_tokens from "../tables/tokens.js";
import type * as tables_userSettings from "../tables/userSettings.js";
import type * as tables_users from "../tables/users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "api/annotations": typeof api_annotations;
  "api/audit": typeof api_audit;
  "api/auth": typeof api_auth;
  "api/calls": typeof api_calls;
  "api/guests": typeof api_guests;
  "api/inbox": typeof api_inbox;
  "api/invites": typeof api_invites;
  "api/joinLinks": typeof api_joinLinks;
  "api/meetings": typeof api_meetings;
  "api/members": typeof api_members;
  "api/messages": typeof api_messages;
  "api/orgs": typeof api_orgs;
  "api/roles": typeof api_roles;
  "api/schedules": typeof api_schedules;
  "api/settings": typeof api_settings;
  "api/users": typeof api_users;
  http: typeof http;
  "internal/guests": typeof internal_guests;
  "internal/invites": typeof internal_invites;
  "internal/migrations": typeof internal_migrations;
  "internal/realtime": typeof internal_realtime;
  "internal/users": typeof internal_users;
  "lib/functions": typeof lib_functions;
  "lib/html": typeof lib_html;
  "lib/presets": typeof lib_presets;
  "lib/r2": typeof lib_r2;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/realtimekit": typeof lib_realtimekit;
  "lib/recurrence": typeof lib_recurrence;
  "lib/time": typeof lib_time;
  "lib/validate": typeof lib_validate;
  "lib/webhooks": typeof lib_webhooks;
  "lib/workpools": typeof lib_workpools;
  "models/annotations": typeof models_annotations;
  "models/audit": typeof models_audit;
  "models/callSessions": typeof models_callSessions;
  "models/calls": typeof models_calls;
  "models/domains": typeof models_domains;
  "models/guests": typeof models_guests;
  "models/invites": typeof models_invites;
  "models/joinLinks": typeof models_joinLinks;
  "models/meetingAccess": typeof models_meetingAccess;
  "models/meetings": typeof models_meetings;
  "models/members": typeof models_members;
  "models/messages": typeof models_messages;
  "models/notifications": typeof models_notifications;
  "models/orgs": typeof models_orgs;
  "models/roles": typeof models_roles;
  "models/schedules": typeof models_schedules;
  "models/sessions": typeof models_sessions;
  "models/settings": typeof models_settings;
  "models/users": typeof models_users;
  "tables/annotations": typeof tables_annotations;
  "tables/auditEvents": typeof tables_auditEvents;
  "tables/callPeers": typeof tables_callPeers;
  "tables/groupMembers": typeof tables_groupMembers;
  "tables/groups": typeof tables_groups;
  "tables/invites": typeof tables_invites;
  "tables/joinLinks": typeof tables_joinLinks;
  "tables/meetingGuests": typeof tables_meetingGuests;
  "tables/meetingMembers": typeof tables_meetingMembers;
  "tables/meetingSessions": typeof tables_meetingSessions;
  "tables/meetingTimes": typeof tables_meetingTimes;
  "tables/meetings": typeof tables_meetings;
  "tables/memberRoles": typeof tables_memberRoles;
  "tables/members": typeof tables_members;
  "tables/messageReactions": typeof tables_messageReactions;
  "tables/messages": typeof tables_messages;
  "tables/notifications": typeof tables_notifications;
  "tables/organizations": typeof tables_organizations;
  "tables/roles": typeof tables_roles;
  "tables/schedules": typeof tables_schedules;
  "tables/tokens": typeof tables_tokens;
  "tables/userSettings": typeof tables_userSettings;
  "tables/users": typeof tables_users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
  authPasskey: import("@convex-dev/auth/components/passkey/_generated/component.js").ComponentApi<"authPasskey">;
  authGoogle: import("@convex-dev/auth/components/google/_generated/component.js").ComponentApi<"authGoogle">;
  authGithub: import("@convex-dev/auth/components/github/_generated/component.js").ComponentApi<"authGithub">;
  avatarWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"avatarWorkpool">;
  emailWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"emailWorkpool">;
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  cloudflareEmail: import("@sarant/cloudflare-email-component/_generated/component.js").ComponentApi<"cloudflareEmail">;
};
