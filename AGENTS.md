# Working in this repo

Read `ARCHITECTURE.md` before changing code. It says where things go. This file says how to work.

## Commands

- `pnpm install`
- `pnpm dev` runs Convex and the web app at http://localhost:3000
- `pnpm exec vp check` formats, lints and type-checks (`--fix` to apply formatting)
- `pnpm test` runs the workspace tests
- `pnpm build` builds the web app

All three of check, test and build must pass before a PR opens. CI runs the same.

## Git

- Never commit to `main`. Every change is a branch plus a pull request.
- Branch names: `feat/…`, `fix/…`, `refactor/…`, `chore/…`, `docs/…`, `test/…`, `ci/…`.
- Commit messages and PR titles follow Conventional Commits.
- PR descriptions say what changed, how to test it, and what is not done.

## Code rules

- No comments in first-party code. Names, types and `ARCHITECTURE.md` carry the meaning.
- Arrow functions assigned to `const`. No `function` declarations.
- No `import * as` namespaces.
- React: no `useEffect`. No `useState` for UI state; it lives in the URL. Forms use TanStack Form.
- Vendored COSS UI files in `packages/ui/src` are not edited by hand. Add components with `pnpm dlx shadcn@latest add @coss/<name>` from `packages/ui`.

## Convex rules

- Prefer official Convex components (workpool, workflow, rate limiter, …) over hand-rolled equivalents.
- One table per file in `convex/tables`, defined from a Zod schema.
- Public function arguments are Zod schemas. Public queries and mutations declare no `returns`.
- List queries paginate.
- Times and time zones go through Luxon.
- After changing the schema, run `pnpm --filter @meetings/backend test -u` to regenerate `packages/backend/SCHEMA.md`.
