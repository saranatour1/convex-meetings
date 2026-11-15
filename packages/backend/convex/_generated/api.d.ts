/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as api_auth from "../api/auth.js";
import type * as api_users from "../api/users.js";
import type * as internal_users from "../internal/users.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_workpools from "../lib/workpools.js";
import type * as models_roles from "../models/roles.js";
import type * as models_users from "../models/users.js";
import type * as tables_groupMembers from "../tables/groupMembers.js";
import type * as tables_groups from "../tables/groups.js";
import type * as tables_invites from "../tables/invites.js";
import type * as tables_meetingMembers from "../tables/meetingMembers.js";
import type * as tables_meetingTimes from "../tables/meetingTimes.js";
import type * as tables_meetings from "../tables/meetings.js";
import type * as tables_memberRoles from "../tables/memberRoles.js";
import type * as tables_members from "../tables/members.js";
import type * as tables_messages from "../tables/messages.js";
import type * as tables_organizations from "../tables/organizations.js";
import type * as tables_roles from "../tables/roles.js";
import type * as tables_schedules from "../tables/schedules.js";
import type * as tables_tokens from "../tables/tokens.js";
import type * as tables_users from "../tables/users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "api/auth": typeof api_auth;
  "api/users": typeof api_users;
  "internal/users": typeof internal_users;
  "lib/functions": typeof lib_functions;
  "lib/time": typeof lib_time;
  "lib/workpools": typeof lib_workpools;
  "models/roles": typeof models_roles;
  "models/users": typeof models_users;
  "tables/groupMembers": typeof tables_groupMembers;
  "tables/groups": typeof tables_groups;
  "tables/invites": typeof tables_invites;
  "tables/meetingMembers": typeof tables_meetingMembers;
  "tables/meetingTimes": typeof tables_meetingTimes;
  "tables/meetings": typeof tables_meetings;
  "tables/memberRoles": typeof tables_memberRoles;
  "tables/members": typeof tables_members;
  "tables/messages": typeof tables_messages;
  "tables/organizations": typeof tables_organizations;
  "tables/roles": typeof tables_roles;
  "tables/schedules": typeof tables_schedules;
  "tables/tokens": typeof tables_tokens;
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
};
