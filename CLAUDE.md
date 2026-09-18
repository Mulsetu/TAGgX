# CLAUDE.md

Guidance for Claude Code (and any contributor) working in this repo.

## Stack

- **Framework**: Next.js 14, App Router.
- **Language**: TypeScript, `strict: true` + `noUncheckedIndexedAccess: true`.
- **UI**: Tailwind CSS + shadcn/ui (`src/components/ui`).
- **Database/Auth**: Supabase — Postgres, Auth, Row Level Security (RLS).
- **File storage**: Cloudflare R2.
- **Transactional email**: Brevo.

## Folder layering

Full rationale and folder map: [`/docs/FOLDER_STRUCTURE.md`](./docs/FOLDER_STRUCTURE.md).

> **View (`app/`, `components/`) → Controller (`modules/*/actions.ts`) → Model
> (`modules/*/queries.ts` + `mutations.ts`) → Database — one direction only,
> no exceptions.**

- No file under `src/app/**` or `src/components/**` may import
  `@supabase/*` directly. Data access always goes through a module's
  `actions.ts`.
- The only places allowed to import `@supabase/*` are `src/lib/supabase/**`
  and `src/modules/*/{queries,mutations}.ts`. This is enforced by the
  `no-restricted-imports` ESLint rule — a lint error means the architecture
  is being violated, not that the rule needs loosening.
- Pages never call `queries.ts`/`mutations.ts` directly, even transitively
  bypassing `actions.ts`. Actions are the only public surface of a module.

## Architecture

- This is a **multi-tenant SaaS**. Every tenant-owned table has a
  `company_id` column.
- **RLS is enforced on every table**, no exceptions — a table without an RLS
  policy is a bug, not an oversight to fix later. Never rely on
  application-layer filtering alone to isolate tenants.
- New tables ship with their RLS policy in the same migration that creates
  them (`supabase/migrations`).

## Security

- Validate all input with `zod` (`modules/*/validation.ts`) before it
  reaches a mutation or query — no unvalidated data crosses into the Model
  layer.
- Never trust a client-supplied `company_id` or `role`. Derive both from the
  authenticated session/JWT server-side inside `actions.ts`; a request body
  or query param claiming a tenant or role is not authoritative.
- Parameterize all queries. No string-concatenated or template-literal SQL.
- Before any R2 upload: check file type (allow-list, not deny-list) and size
  server-side. Never trust a client-reported MIME type alone.
- Rate-limit all mutating endpoints (route handlers and Server Actions that
  write data).

## Performance

- Server Components by default. Add `"use client"` only when a component
  needs interactivity, state, or browser APIs.
- Images go through `next/image`, not raw `<img>`.
- Any list that can exceed 50 rows must be paginated (or cursor/infinite
  scrolled) — never render an unbounded list.

## Style

- No `any`. If a type is genuinely unknown, use `unknown` and narrow it.
- No unused exports — if a module's export has no caller, delete it.
- Every new domain gets the same 5-file module pattern under
  `src/modules/<domain>/`:
  - `queries.ts` — reads
  - `mutations.ts` — writes
  - `actions.ts` — validation + authorization + orchestration (the only
    layer pages/components call into)
  - `validation.ts` — zod schemas
  - `types.ts` — domain types
