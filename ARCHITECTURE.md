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

| Table                    | Belongs to       | Purpose                                                                                                                                                                    |
| ------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                  | –                | Identity and profile only. Kept lean: nothing org- or team-specific.                                                                                                       |
| `organizations`          | –                | The tenant boundary                                                                                                                                                        |
| `members`                | organization     | `orgId` + `userId` + role. A row means "in this org".                                                                                                                      |
| `invites`                | organization     | Reusable join link (`token`) until `expiresAt`. Revoking deletes it.                                                                                                       |
| `groups`, `groupMembers` | organization     | Teams inside an org                                                                                                                                                        |
| `meetings`               | organization     | Title, start, duration, host                                                                                                                                               |
| `attendees`              | meeting          | The meeting invite (`pending` / `accepted` / `declined`). The host is an attendee too. `startsAt` is copied from the meeting so "my upcoming meetings" is one index range. |
| `schedules`              | user             | Weekly availability                                                                                                                                                        |
| `messages`               | meeting or group | Chat. `chatId` is the meeting or group the conversation belongs to.                                                                                                        |
| `tasks`                  | organization     | To-do items for an assignee                                                                                                                                                |

Rules:

- Tables and public `args` are validated with Zod, via `convex-helpers/server/zod4`. `tables/` exports one Zod schema per table, and field rules are reached through `.shape` (for example `zMeeting.shape.durationMinutes`). Convex `v` validators appear only where a library requires them: middleware arguments and the Convex Auth callbacks.
- Public queries and mutations have no `returns`. Internal functions declare `returns` only where a library needs it (the Convex Auth `createUser` callbacks).
- List queries paginate: `paginationOpts: zPaginationOpts` from `lib/validators.ts`, `.paginate()` on the server, `usePaginatedQuery` on the client. Single-document reads stay plain.
- Function builders in `lib/functions.ts`:
  - `authedQuery` / `authedMutation` inject `ctx.userId`, or throw `ConvexError("Unauthenticated")`.
  - `orgQuery` / `orgMutation` take `orgId`, inject `ctx.member`, and throw `ConvexError("Not a member")` for anyone outside the org.
  - Role checks use `requireRole` from `models/members.ts`.
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
| `features/<domain>/` | UI plus Convex calls for one domain: `auth`, `meetings`, `tasks`                                                        |
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
