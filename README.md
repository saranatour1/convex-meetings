# convex-meetings

TanStack Start + Convex + Convex Auth v2 + COSS UI (shadcn registry), deployed to Cloudflare Workers.

## Develop

```bash
pnpm install
pnpm dev:backend   # convex dev
pnpm dev           # http://localhost:3000
```

`.env.local` needs `VITE_CONVEX_URL` (written by `npx convex dev`).

Sign-in methods: passkey (default for development), Google, GitHub, username/password.
Google/GitHub need `AUTH_{GOOGLE,GITHUB}_CLIENT_{ID,SECRET}` on the Convex deployment and the
callback `<CONVEX_SITE_URL>/oauth/<provider>/callback` registered with the provider.
`SITE_URL` on the deployment must match the app origin (passkeys are bound to it).
