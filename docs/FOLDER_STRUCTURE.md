# Folder Structure & Architecture

This project follows a strict **Model → Controller → View** layering. The
folder layout exists to make that layering mechanically enforceable (via
ESLint), not just a convention people are trusted to remember.

## Top-level layout

```
src/
  app/                        View layer (Next.js App Router)
    (admin)/                  Route group: super-admin area
    (dashboard)/
      assets/                 Route group: dashboard > assets pages
      administration/         Route group: dashboard > administration pages
    api/                      Route handlers (thin HTTP adapters)
  components/
    ui/                       Reusable, presentational UI primitives (shadcn/ui)
  modules/                    Model + Controller layer, grouped by domain
    assets/
    users/
    roles/
    companies/
    storage/
    email/
    # each module holds:
    #   queries.ts      - read-only data access (Model)
    #   mutations.ts     - write data access (Model)
    #   actions.ts       - orchestration/validation/authorization (Controller)
    #   validation.ts    - zod schemas for input/output shapes
    #   types.ts         - domain types shared across the module
  lib/
    supabase/                 Supabase client factories (browser/server/admin)
    permissions/              Authorization/RBAC helpers
  types/                      Cross-cutting/shared TypeScript types
  hooks/                      Shared React hooks (client-side only)
supabase/
  migrations/                 SQL migrations (source of truth for schema)
docs/                         Project documentation
```

## The layering

### Model — `src/modules/*/queries.ts` and `mutations.ts`

The only files in the entire codebase that are allowed to talk to Supabase
directly (import `@supabase/supabase-js` or `@supabase/ssr`, or use a client
built in `src/lib/supabase`). `queries.ts` holds read operations, `mutations.ts`
holds writes. These functions know about tables, columns, and storage buckets.
They should not know about HTTP, React, or authorization decisions.

### Controller — `src/modules/*/actions.ts`

The only entry point the outside world (pages, components, route handlers)
is allowed to call into a module through. An action:

1. Validates input using the module's `validation.ts` (zod) schemas.
2. Checks permissions using `src/lib/permissions`.
3. Calls the module's `queries.ts` / `mutations.ts`.
4. Returns a plain, serializable result (or throws a typed error).

Actions never leak a Supabase client, a `PostgrestError`, or any other
Supabase-shaped object back to the View layer.

### View — `src/app/**` and `src/components/**`

Pages, layouts, route handlers, and components. This layer is presentation
and request/response glue only. It calls `actions.ts` functions and renders
the result. It never imports a Supabase client, never imports `queries.ts` /
`mutations.ts` directly, and never embeds SQL or storage logic.

## The hard rule

> **Page and component files may never import a Supabase client directly.**

Concretely: nothing under `src/app/**` or `src/components/**` may import
`@supabase/supabase-js`, `@supabase/ssr`, or any `@supabase/*` package. If a
page needs data, it calls a function exported from `src/modules/*/actions.ts`.
If that action doesn't exist yet, it gets added to the module — the page
does not reach around it.

This is enforced by ESLint, not just documentation. See the
`no-restricted-imports` overrides in `.eslintrc.json`: any `@supabase/*`
import inside `src/app/**` or `src/components/**` is a lint error. The only
folders exempted from that restriction are `src/lib/supabase/**` (the client
factories) and each module's `queries.ts` / `mutations.ts` (the Model layer).

## Why

- **Testability** — actions can be unit-tested without spinning up a real
  Supabase client; queries/mutations can be tested in isolation from
  authorization and validation logic.
- **Swappability** — the database/storage layer can change without touching
  a single page or component, because nothing outside `modules/*` knows
  Supabase exists.
- **Authorization can't be bypassed by accident** — if the only way to reach
  data is through `actions.ts`, permission checks can't be skipped by a page
  that queries the database directly.
