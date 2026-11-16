# Architecture

## Workspace

| Package                                  | Owns                                          |
| ---------------------------------------- | --------------------------------------------- |
| `apps/web` (`@meetings/web`)             | TanStack Start app: routes, layouts, features |
| `packages/backend` (`@meetings/backend`) | Convex schema and functions, typed client API |
| `packages/ui` (`@meetings/ui`)           | COSS UI components, hooks, theme CSS          |

Rules:

- Shared versions live in the pnpm catalog (`pnpm-workspace.yaml`). Packages reference them with `catalog:`.
- Lint and format config lives only in the root `vite.config.ts`.
- `#/…` imports are package-local and always include the file extension (`#/lib/utils.ts`).
- Functions are arrow functions assigned to `const`, enforced by the `func-style` lint rule. Vendored COSS files are exempt. Route components are defined above `export const Route` because `const` isn't hoisted.
- First-party code has no comments. Names, types and this file carry the meaning. Vendored COSS files and generated files stay as shipped.

## Backend (`packages/backend/convex`)

| Folder      | Contains                                                                                                             | Generated path                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `api/`      | Public functions only: Zod `args`, then a call into `models/`                                                        | `api.api.<file>.<fn>`           |
| `internal/` | Internal functions only: Convex Auth callbacks, workpool jobs                                                        | `internal.internal.<file>.<fn>` |
| `models/`   | Plain TypeScript business logic that takes `ctx`. All reads and writes live here.                                    | none                            |
| `tables/`   | One Zod schema per table plus `defineTable(zodToConvexFields(...))`, one file per domain. `schema.ts` composes them. | none                            |
| `lib/`      | Building blocks: function middleware, shared Zod validators, workpool instances                                      | none                            |

### Data model

[`packages/backend/SCHEMA.md`](packages/backend/SCHEMA.md) has the generated diagram of every table, relationship and index. CI posts it on any PR that changes it.

| Table                    | Belongs to   | Purpose                                                                                                                        |
| ------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `users`                  | –            | Identity and profile only. Nothing org- or team-specific.                                                                      |
| `organizations`          | –            | The tenant boundary                                                                                                            |
| `members`                | organization | `orgId` + `userId`. A row means "in this org".                                                                                 |
| `roles`                  | organization | Named roles an org defines. `permissions` maps each fixed permission (such as `inviteMembers`, `createMeetings`) to on or off. |
| `memberRoles`            | member       | Assigns roles to a member. A member holds every permission any of their roles grants.                                          |
| `tokens`                 | –            | Secret values that expire. Links in old emails stop working once their token expires.                                          |
| `invites`                | organization | Org invite: which role a newcomer gets, who invited them, and the token in the link                                            |
| `groups`, `groupMembers` | organization | Teams inside an org                                                                                                            |
| `meetings`               | organization | Who created it and its title                                                                                                   |
| `meetingTimes`           | meeting      | When it happens: `date` (epoch day), `start` / `end` (`HH:mm`), `timeZone`. Luxon turns these into instants per person.        |
| `meetingMembers`         | meeting      | Who is invited (`pending` / `accepted` / `declined`)                                                                           |
| `messages`               | meeting      | The meeting's chat. Each message is written by a meeting member.                                                               |
| `schedules`              | user         | Weekly availability, ISO weekdays (1 = Monday)                                                                                 |

Rules:

- One table per file in `tables/`, each exporting its Zod schema and table. Field rules are reached through `.shape` (for example `zUser.shape.bio`).
- Tables and public `args` are validated with Zod, via `convex-helpers/server/zod4`. Time values use the Luxon-backed validators in `lib/time.ts`. Convex `v` validators appear only where a library requires them: middleware arguments and the Convex Auth callbacks.
- Convex tables only enforce field types. Model functions call `parseOrThrow(zTable, value)` from `lib/validate.ts` before every `insert`, `patch` or `replace`, so trimming, length and format rules always apply.
- Public queries and mutations have no `returns`. Internal functions declare `returns` only where a library needs it (the Convex Auth `createUser` callbacks).
- List queries paginate with Convex's `paginationOptsValidator`, `.paginate()` on the server, and `usePaginatedQuery` on the client. Single-document reads stay plain.
- Function builders in `lib/functions.ts`:
  - `authedQuery` / `authedMutation` inject `ctx.userId`, or throw `ConvexError("Unauthenticated")`.
  - `orgQuery` / `orgMutation` take `orgId` and inject `ctx.userId`, `ctx.member` and `ctx.requirePermission(permission)`. They throw `ConvexError("Not a member")` for anyone outside the org.
  - `OrgQueryCtx` / `OrgMutationCtx` are the context types for model functions that run inside them.
- `ctx.run*`, the scheduler and workpools only target `internal.internal.*`.
- Environment variables are declared in `convex.config.ts` and read through the typed `env` from `_generated/server`.
- Tests sit next to the code (`*.test.ts`). Convex never deploys files with two dots in the name. Tests use `convex-test` and run with `pnpm test`.

### Why `api.api`

Convex names functions after their file path, so `convex/api/users.ts` becomes `api.api.users`. Inside the backend that full path is used as is. Clients import the re-export instead:

```ts
import { api } from "@meetings/backend";

api.users.viewer;
```

`@meetings/backend` exports `api.api` as `api`, plus the `Doc` and `Id` types. It never exports `internal`.

## Web app (`apps/web/src`)

Layers depend downward only: `routes` → `layouts` → `features` → `components` / `lib`.

| Path                 | Contains                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `start.ts`           | Global request middleware (security headers, CSRF for server functions) and client-only rendering (`defaultSsr: false`) |
| `providers/`         | App-wide providers (`ConvexWithAuthProvider` wires Convex and Convex Auth)                                              |
| `routes/`            | Route config, search-param validation, auth gates, and handing URL state to layouts and features                        |
| `layouts/`           | Page frames that compose features, such as `app-shell/` (sidebar and header for signed-in pages)                        |
| `features/<domain>/` | UI plus Convex calls for one domain: `auth`, `meetings`                                                                 |
| `components/`        | Domain-free building blocks with no Convex calls: `EmptyState`, `FormError`, `LoadingScreen`                            |
| `lib/`               | Pure helpers                                                                                                            |

Rules:

- UI state lives in the URL. Routes declare it with `validateSearch`. Examples: `/?schedule=true&inviteFor=…`, `/sign-in?with=password&mode=signup`.
- Changing URL state:
  - Declarative navigation is a `<Link>` anywhere: features, layouts or routes.
  - Imperative navigation (`navigate`) belongs to routes. Features receive it as callbacks (`onClose`, `onInvite`).
- Server data comes from Convex `useQuery` / `useMutation`.
- Form state comes from TanStack Form (`useForm`). Server errors come back through `validators.onSubmitAsync`.
- No `useEffect`. Scroll, layout and visibility use CSS or declarative components (`<Authenticated>`, `<Navigate>`). For example, the invite chat stays scrolled to the newest message because its scroll container is `flex-col-reverse`.
- Allowed `useState`, until the data lives in Convex:
  - `features/meetings/invite-panel.tsx`: the local chat messages and composer draft.
  - COSS components' own internal state in `packages/ui`.
