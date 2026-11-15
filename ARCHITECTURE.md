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

| Folder      | Contains                                                                          | Generated path                  |
| ----------- | --------------------------------------------------------------------------------- | ------------------------------- |
| `api/`      | Public functions only: argument and return validators, then a call into `models/` | `api.api.<file>.<fn>`           |
| `internal/` | Internal functions only: Convex Auth callbacks, workpool jobs                     | `internal.internal.<file>.<fn>` |
| `models/`   | Plain TypeScript business logic that takes `ctx`. All reads and writes live here. | none                            |
| `tables/`   | Table definitions and shared validators. `schema.ts` composes them.               | none                            |
| `lib/`      | Building blocks: `authedMutation` middleware, workpool instances                  | none                            |

Rules:

- Functions that need a signed-in user use `authedMutation` from `lib/functions.ts`. It injects `ctx.userId` and throws `ConvexError("Unauthenticated")` otherwise.
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
