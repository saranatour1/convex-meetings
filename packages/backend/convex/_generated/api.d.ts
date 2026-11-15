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
import type * as lib_workpools from "../lib/workpools.js";
import type * as models_users from "../models/users.js";
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
  "lib/workpools": typeof lib_workpools;
  "models/users": typeof models_users;
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
