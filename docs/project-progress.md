# MoneyTimeline Progress Tracker

This file tracks active work, decisions, fixes, and approval state.

## Status Legend

- `Pending`: not started
- `In Progress`: actively being worked on
- `Needs Review`: implemented and waiting for user feedback
- `Approved`: user approved
- `Done`: approved and considered complete

## Current Task

### Data & Import / Import History

Status: `Done`

Started: 2026-05-24

Goal:
- Create a real Data & Import area from Settings.
- Show previous statement imports and recent imported transactions.
- Give users a clear place to review imported files, imported row counts, duplicates, failed rows, and links back to import/timeline.

Progress Log:
- 2026-05-24: Started task after user approval.
- 2026-05-24: Created this tracker so task progress and approvals are visible in the repo.
- 2026-05-24: Reviewed Settings, import save flow, transaction ledger, and existing Supabase import job data.
- 2026-05-24: Added a dedicated Data & Import route and screen for import history.
- 2026-05-24: Updated successful Supabase imports to write row counts back to `import_jobs`.
- 2026-05-24: Browser verification showed empty 0-row import-job shells in history; filtered those out so users only see meaningful imports/failures.
- 2026-05-24: Verified `/data-import` renders and Settings > Data & Import opens it.
- 2026-05-24: Updated the Settings data workspace card to use the same remote import history as `/data-import` for signed-in users.
- 2026-05-24: Fixed Settings import count loading so it waits for auth before choosing remote vs local history.

Issues Found:
- Settings currently links Data & Import directly to the upload screen, so users cannot view import history or import details.
- Local import history exists in AsyncStorage, but signed-in Supabase imports need a user-facing history view too.
- Import jobs exist in Supabase, but successful app imports were not updating imported/duplicate/failed row counts after save.
- Some earlier upload attempts created completed import jobs with 0 rows, which made the history look noisy and confusing.

Changes Made:
- Added `docs/project-progress.md`.
- Added `app/data-import.tsx`.
- Added `src/features/import/data-import-screen.tsx`.
- Updated `src/features/import/import-save-service.ts` and `src/features/import/import-statement-screen.tsx`.
- Updated `src/services/supabase/import-history-service.ts`.
- Updated Settings navigation to open `/data-import` instead of the upload screen.
- Updated Settings import counts to use Supabase history when a user is signed in.

Approval:
- 2026-05-24: User approved the Data & Import / Import History task.

Verification:
- `npm run typecheck` passed.
- Browser check: `/data-import` rendered with 4 real statement imports and 45 imported transactions.
- Browser check: Settings > Data & Import navigated to `/data-import?returnTo=settings`.
- Browser check: Settings data workspace showed 4 statements and 45 imported rows for the signed-in account.

## Recently Completed

### Statement Import Flow

Status: `Done`

Completed:
- Auto-extract starts immediately after file selection.
- Import summary opens automatically.
- Duplicate statement popup appears before confirm.
- Invalid zero/unreadable amount rows are skipped and counted as failed rows.
- Import complete screen shows newly added transactions.

Approved:
- User confirmed import was working well.
