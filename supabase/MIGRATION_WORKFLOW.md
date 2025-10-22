# Supabase Migration Workflow

This repository now relies on the full migrations directory rather than the legacy single-file bootstrap. Use the steps below to keep a clean snapshot for production releases.

## Day-to-day development
- Apply migrations locally with `npx supabase db push` (the `create-tables.sh` helper wraps this).
- Add new SQL files under `supabase/migrations/` using the Supabase CLI (`npx supabase migration new`).
- Always run `npx supabase db lint` before submitting a PR to catch ordering or dependency issues.

## Packaging a release bundle
- Tag a remote snapshot once the branch is ready: `npx supabase db remote commit --tag release-YYYYMMDD`.
- Download that snapshot for operators who cannot run migrations directly: `npx supabase db pull --schema public --project-ref <ref> --tag release-YYYYMMDD > supabase/bundles/release-YYYYMMDD.sql`.
- Commit the SQL bundle under `supabase/bundles/` and reference it in deployment notes.

## Updating environments
- Use `scripts/setup-supabase.sh` when linking a fresh Supabase project; it runs `supabase db push` end to end.
- For air-gapped ops, apply the latest bundle manually in the Supabase SQL editor, then backfill realtime table settings as described in the script output.
- Keep the bundle tag noted in release PRs so downstream agents know which snapshot to apply.
