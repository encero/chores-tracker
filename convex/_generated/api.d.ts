/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as children from "../children.js";
import type * as choreInstances from "../choreInstances.js";
import type * as choreTemplates from "../choreTemplates.js";
import type * as crons from "../crons.js";
import type * as lib_hash from "../lib/hash.js";
import type * as scheduledChores from "../scheduledChores.js";
import type * as scheduler from "../scheduler.js";
import type * as settings from "../settings.js";
import type * as withdrawals from "../withdrawals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  children: typeof children;
  choreInstances: typeof choreInstances;
  choreTemplates: typeof choreTemplates;
  crons: typeof crons;
  "lib/hash": typeof lib_hash;
  scheduledChores: typeof scheduledChores;
  scheduler: typeof scheduler;
  settings: typeof settings;
  withdrawals: typeof withdrawals;
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

export declare const components: {};
