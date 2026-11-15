# convex-meetings

TanStack Start + Convex + Convex Auth v2 + COSS UI, built with Vite+ and deployed to Cloudflare Workers.

## Workspace

| Path | Package | What |
| --- | --- | --- |
| `apps/web` | `@meetings/web` | TanStack Start app |
| `packages/backend` | `@meetings/backend` | Convex functions and schema |
| `packages/ui` | `@meetings/ui` | COSS UI components, hooks and theme |

## Develop

```bash
pnpm install
pnpm dev
```

- `pnpm dev` runs Convex and the web app at http://localhost:3000
- `pnpm check` formats, lints and type-checks
- `pnpm test` runs the workspace tests
- `pnpm build` builds the web app

Env files (gitignored):

- `packages/backend/.env.local`: `CONVEX_DEPLOYMENT`, written by `convex dev`
- `apps/web/.env.local`: `VITE_CONVEX_URL`

Sign-in methods: passkey (default for development), Google, GitHub, username/password.
Google/GitHub need `AUTH_{GOOGLE,GITHUB}_CLIENT_{ID,SECRET}` on the Convex deployment and the
callback `<CONVEX_SITE_URL>/oauth/<provider>/callback` registered with the provider.
`SITE_URL` on the deployment must match the app origin (passkeys are bound to it).

New COSS components go into the shared package: run `pnpm dlx shadcn@latest add @coss/<name>` from `packages/ui`.
