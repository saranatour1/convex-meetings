# Architecture

## Workspace

| Package                                  | Owns                                                |
| ---------------------------------------- | --------------------------------------------------- |
| `apps/web` (`@meetings/web`)             | TanStack Start app: routes, layouts, features       |
| `packages/backend` (`@meetings/backend`) | Convex schema and functions, typed client API       |
| `packages/ui` (`@meetings/ui`)           | COSS UI components, Kloq calendar, hooks, theme CSS |

Rules:

- Shared versions live in the pnpm catalog (`pnpm-workspace.yaml`). Packages reference them with `catalog:`.
- Lint and format config lives only in the root `vite.config.ts`.
- `#/…` imports are package-local and always include the file extension (`#/lib/utils.ts`).
- Functions are arrow functions assigned to `const`, enforced by the `func-style` lint rule. Vendored COSS files are exempt. Route components are defined above `export const Route` because `const` isn't hoisted.
- First-party code has no comments. Names, types and this file carry the meaning. Vendored COSS files and generated files stay as shipped.
- Kloq (`packages/ui/src/components/kloq`) is the coss calendar, copied from its registry (`https://coss.com/kloq/r/kloq.json`, MIT). It stays as shipped and is excluded from format and lint, so it can be replaced wholesale on update. Import it through `@meetings/ui/kloq`, `@meetings/ui/kloq/rrule`, `@meetings/ui/kloq/timezone` and `@meetings/ui/kloq/rrule-builder`.

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
| `joinLinks`              | organization | Shareable invite link: role, use count and limit, the token, revoked time                                                      |
| `auditEvents`            | organization | Who changed membership, roles, invites, links or settings, and when                                                            |
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
  - `publicQuery` takes Zod args and needs no sign-in (invite previews).
  - `authedQuery` / `authedMutation` inject `ctx.userId`, or throw `ConvexError("Unauthenticated")`.
  - `orgQuery` / `orgMutation` take `orgId` and inject `ctx.userId`, `ctx.member` and `ctx.requirePermission(permission)`. They throw `ConvexError("Not a member")` for anyone outside the org.
  - `zPaginationOpts` is Convex's `paginationOptsValidator` converted to Zod, for the `paginationOpts` arg of list queries.
  - `OrgQueryCtx` / `OrgMutationCtx` are the context types for model functions that run inside them.
- `ctx.run*`, the scheduler and workpools only target `internal.internal.*`.
- Environment variables are declared in `convex.config.ts` and read through the typed `env` from `_generated/server`.
- Email goes out through `@sarant/cloudflare-email-component` (`components.cloudflareEmail`) from actions on `emailWorkpool`, which never retries because Cloudflare has no idempotency key. It needs `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (Email Sending: Edit) and `EMAIL_FROM` on an onboarded domain.
- Roles: every org has the built-in Owner and Admin (all permissions, can't be edited or deleted) and Member (default for invites, can't be renamed or deleted) roles, plus any custom roles. `manageRoles` covers changing members' roles and editing roles; `manageOrganization` covers renaming, domain join, the activity log and seeing when members were last active. Escalation rules live in `models/orgs.ts`: `assertCanGrant` (you can only create, edit, assign or hand out by link a role whose permissions you hold; only owners give the Owner role) and `assertOutranks` (you can't change or remove someone with permissions you lack, or an owner unless you are one). Deleting a role moves its holders to Member. Nobody can remove, demote or leave as the last owner.
- Meetings: Convex owns every meeting, invitee, chat message and recap. Cloudflare RealtimeKit only carries audio and video. The first Join creates the RealtimeKit meeting; each person joins with a preset from `lib/presets.ts` (kind × host or participant), with RealtimeKit's own chat turned off. Joining opens a full-screen call (`?call=true` on `/meetings/$code`) built in `features/meetings/call/`: a lobby with a preview and device pickers, the room, and a left-the-call screen with Rejoin. Every control is our own button. Panels and dialogs that RealtimeKit draws (people, polls, plugins, AI transcript, settings, breakout rooms, Leave confirmation) open by dispatching its `rtkStateUpdate` event (`emitCallUi` in `call/call-ui.ts`); the open panel is `?side=` and chat is the Convex chat. While someone shares a screen, `call/share-stage.tsx` shows it large with a people strip (`?expand=true` hides the strip). Plugins are registered when joining (`whiteboardPlugin`: Cloudflare's hosted whiteboard in an iframe); add more by appending to `defaults.plugins` in `meeting-call.tsx`. RealtimeKit components are themed with `provideRtkDesignSystem`.
- Meetings are addressed by a short `code` (`abc-defg-hij`), never by their table id. URLs, links and the header's "Code or link" box all use it. `internal.internal.realtime.setup` creates the presets and registers the webhook (`/realtime/webhook`, RSA-signed) once per deployment. It needs `REALTIMEKIT_APP_ID` and `REALTIMEKIT_API_TOKEN` (Realtime Admin).
- Recaps: each call is a `meetingSessions` row filled by the RealtimeKit webhook. The summary is stored as text. The transcript is downloaded as JSON into Convex storage (`transcriptId`). Recordings go to your R2 bucket (configured once in the RealtimeKit dashboard) and are addressed by `recordingKey` (`RECORDINGS_PATH` + file name). `meetings.recordingUrl` signs an R2 link with `@convex-dev/r2` when `R2_*` is set, else falls back to Cloudflare's 7-day link.
- Inbox: `notifications` rows are written by meeting create (invite), respond (to the host), cancel, and the first summary of a call (recap ready). `inbox.unreadCount` feeds the sidebar badge.
- Invites: the link carries a random secret; `tokens.value` stores only its SHA-256. Links expire after 7 days and work once. Accepting one marks the user verified with the invited address.
- Joining an org: email invites (up to 50 at once, existing members skipped), invite links (`joinLinks`: a role, an expiry of 1, 7 or 30 days, an optional use limit; the secret is shown once and only its hash is kept), and domain join (`organizations.joinDomain`: people with a verified email at that domain see the org on the empty-org screen and on `/orgs/new` and join with a click; setting it needs your own verified email there, and public mail providers are refused).
- Activity: `auditEvents` rows come from the `audit()` helper in `models/audit.ts`, called by every mutation that changes membership, roles, invites, links, domain join or the org name. Org settings shows them to `manageOrganization`.
- Sessions: sign-in sessions live in the Convex Auth component. `users.sessions` lists the caller's, `users.signOutEverywhere` revokes them, and owners can sign a member out everywhere (`members.signOutEverywhere`). Revoking takes effect immediately because `getAuthUserId` checks the session.
- Rate limits: `lib/rateLimits.ts` (`@convex-dev/rate-limiter`) caps invites and link creation per org, and accepting invites, links or domain joins per user. Call `enforceRateLimit` in the mutation before the work.
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
| `features/<domain>/` | UI plus Convex calls for one domain: `auth`, `meetings`, `orgs`, `schedules`                                            |
| `components/`        | Domain-free building blocks with no Convex calls: `EmptyState`, `FormError`, `LoadingScreen`                            |
| `lib/`               | Pure helpers                                                                                                            |

Rules:

- Settings live behind the user menu at the bottom of the sidebar: `/settings/account`, `/settings/general` (appearance, time zone and hours), `/settings/meetings` and `/settings/org`. Per-person preferences are the `userSettings` table (`api.settings.getMine` / `setMine`, defaults in `models/settings.ts`).
- Theme: `lib/theme.ts` puts `dark` or `light` on `<html>` (Kloq and COSS both follow it), remembers the choice locally, and an inline `THEME_SCRIPT` restores it before paint. The saved `userSettings.theme` is applied on a new device. Calls pick RealtimeKit's light or dark tokens from it.
- UI state lives in the URL. Routes declare it with `validateSearch`. Examples: `/schedule?zone=…&zones=…&view=list&inviteFor=…`, `/calendar?zones=…`, `/sign-in?with=password&mode=signup`.
- Changing URL state:
  - Declarative navigation is a `<Link>` anywhere: features, layouts or routes.
  - Imperative navigation (`navigate`) belongs to routes. Features receive it as callbacks (`onClose`, `onInvite`).
- Server data comes from Convex `useQuery` / `useMutation`.
- Times are UTC milliseconds plus an IANA zone name, converted with Luxon in `lib/schedule.ts`. No hand-written UTC offsets. Its tests sit next to it (`schedule.test.ts`) and run with `pnpm test`.
- The active organization is `?org=` on every signed-in route, kept across links by `retainSearchParams`. `OrgGate` falls back to the first org, or asks to create one. Features read it with `useActiveOrg()`.
- Find a time shows the org's members (`features/orgs/people.ts` maps them to `Person`). Busy times come from `meetings.busy`, and the calendar and Home read `meetings.mine`.
- Search-param updates that only change what is shown pass `resetScroll: false`, so the page doesn't jump to the top.
- Form state comes from TanStack Form (`useForm`). Server errors come back through `validators.onSubmitAsync`.
- No `useEffect`. Scroll, layout and visibility use CSS or declarative components (`<Authenticated>`, `<Navigate>`). For example, the invite chat stays scrolled to the newest message because its scroll container is `flex-col-reverse`.
- Allowed `useState`, until the data lives in Convex:
  - `features/meetings/invite-panel.tsx`: the local chat messages and composer draft.
  - COSS components' own internal state in `packages/ui`.
