# MoneyTimeline Progress Tracker

This file tracks active work, decisions, fixes, and approval state.

## Status Legend

- `Pending`: not started
- `In Progress`: actively being worked on
- `Needs Review`: implemented and waiting for user feedback
- `Approved`: user approved
- `Done`: approved and considered complete

## Current Task

### Payments / Transfers Polish

Status: `Done`

Started: 2026-05-25

Goal:
- Make payments and transfers visibly different from normal expenses across Timeline, Calendar day details, and Transaction Detail.
- Clarify that payments/transfers are money movement records and are not split eligible.
- Keep spend totals focused on actual expenses.

Progress Log:
- 2026-05-25: Started after user approved the next task.
- 2026-05-25: Reviewed Timeline, Calendar day sheet, Transaction Detail, and import completion behavior.
- 2026-05-25: Added money-movement visual treatment to Timeline payment/transfer cards.
- 2026-05-25: Added Calendar day sheet copy explaining payments/transfers are not split eligible.
- 2026-05-25: Added a Transaction Detail notice explaining payments/transfers are account reconciliation records, not spend.
- 2026-05-25: User approved the direction but asked payment cards to look more visually different from normal expense cards.
- 2026-05-25: Updated Timeline payment/transfer cards with a taller blue-tinted surface, left accent rail, and `Money movement` eyebrow.
- 2026-05-25: User requested Calendar Personal swipe not show a review/undo popup because there is nothing to review.
- 2026-05-25: User confirmed the real issue was row press firing after swipe and opening Transaction Detail.
- 2026-05-25: User found Shared swipe applies the Shared tag before the split flow is confirmed.

Issues Found:
- Payments/transfers are already excluded from spend totals, but the UI still presents them too similarly to expenses.
- Transaction Detail mentions excluded totals, but the copy is buried in a generic info row.
- Calendar day sheet disables swipe for payments/transfers, but does not explain why.
- Timeline money-movement cards still share too much of the normal transaction card silhouette.
- Calendar currently shows the classification undo toast for Personal swipes, which feels like an unnecessary popup in the fast review flow.
- Calendar swipe release can still trigger row press, opening Transaction Detail immediately after marking Personal.
- Calendar Shared swipe updates transaction classification before split confirmation, leaving a false Shared tag if the user backs out.

Changes Made:
- Updated `src/features/timeline/timeline-feed-screen.tsx`.
- Updated `src/features/calendar/calendar-home-screen.tsx`.
- Updated `src/features/transactions/transaction-detail-screen.tsx`.
- Updated Calendar classification behavior so Personal swipe no longer shows the undo/review toast.
- Added a short post-swipe press guard so Calendar row taps do not fire immediately after a completed swipe.
- Updated Calendar Shared swipe to open the split starter without persisting `shared` classification until the split is saved.

Verification:
- `npm run typecheck` passed.
- Browser check: Timeline payment/transfer rows show `Money movement` and `excluded from spend`.
- Browser check: Transaction Detail for a payment shows the money movement notice and explains it is not split eligible.
- Browser check: Calendar March 2 day sheet shows `Not split eligible` for payment/transfer rows.
- Browser check: Timeline payment/transfer card label remains visible after the distinct card styling update.
- `npm run typecheck` passed after removing the Personal swipe toast.
- `npm run typecheck` passed after deferring Shared classification until split save.

Approval:
- 2026-05-25: User tested and approved Payments / Transfers polish and Calendar split confirmation behavior.

## Previous Task

### Import Detail Page

Status: `Needs Review`

Started: 2026-05-24

Goal:
- Add a clean statement detail page from Data & Import.
- Show statement name, import date, detected account, imported transaction count, expense count, payment/transfer count, and imported transaction list.
- Keep the UI user-facing and simple: no failed rows, duplicate rows, or backend-style stats.

Progress Log:
- 2026-05-24: Started after user approved simplified Import Detail direction.
- 2026-05-24: User clarified failed/duplicate rows are not needed in this area.
- 2026-05-24: Added import detail route and screen.
- 2026-05-24: Removed failed/duplicate row metrics from Data & Import overview.
- 2026-05-24: Fixed Data & Import expense/payment counts to use the full statement, not only the recent preview rows.

Issues Found:
- Data & Import currently opens the timeline directly, so users cannot inspect one import as a clean statement summary first.
- Data & Import still exposes failed/duplicate row metrics, which the user does not want in the product UI.

Changes Made:
- Added `app/import-detail/[id].tsx`.
- Added `src/features/import/import-detail-screen.tsx`.
- Updated `src/features/import/data-import-screen.tsx` so import cards open the detail page and no longer show failed/duplicate metrics.

Verification:
- `npm run typecheck` passed.
- Browser check: Data & Import overview no longer shows failed/duplicate row labels.
- Browser check: Import detail showed statement name, account, imported transaction count, expenses, payments, and transaction list.
- Browser check: Import detail `Open in Timeline` navigated to the filtered timeline URL.

Approval:
- Waiting for implementation review.

## Previous Task

### Settings Account Identity / Month Spend Fix

Status: `Done`

Started: 2026-05-24

Goal:
- Stop demo profile data from appearing for a different signed-in account.
- Make the Settings month spend card reflect the latest imported transaction month when the current calendar month has no imported spending.

Progress Log:
- 2026-05-24: Started after user reported Settings showing Manish/demo profile while logged into a different account.
- 2026-05-24: Traced Settings profile data to local AsyncStorage profile settings shared across accounts.
- 2026-05-24: Traced Settings month spend to a hard-coded current month key instead of the latest imported transaction period.
- 2026-05-24: Implemented account-safe profile display and latest-import-month spend logic.
- 2026-05-24: User found remaining static `12% vs last month` text in the Settings month card.
- 2026-05-24: Replaced static month comparison with a real current-vs-previous displayed month calculation.

Issues Found:
- Local profile settings were not scoped to the signed-in email/user, so an older demo profile could override Supabase auth email-derived identity.
- The Settings card calculated only the current device month, while Calendar and Insights already fall back to the latest imported month when current month has no transactions.
- The month comparison label was still hardcoded as `12% vs last month`.

Changes Made:
- Added `isProfileForEmail` to `src/features/settings/profile-store.ts`.
- Updated `app/(tabs)/settings.tsx` to ignore saved profile names/emails that do not match the signed-in account.
- Updated `app/(tabs)/settings.tsx` to calculate Settings month spend from current month when present, otherwise the latest imported spend month.
- Updated `app/(tabs)/settings.tsx` to calculate the month comparison percentage from imported ledger transactions.

Verification:
- `npm run typecheck` passed.
- Browser check: Settings now shows signed-in account `vamshi` / `vamshiachavelli@gmail.com` instead of the older demo profile.
- Browser check: Settings month spend now shows `$268.03` from imported transactions instead of `$0.00`.
- Browser check: Settings month comparison now shows `-93% less than last month` instead of the static `12% vs last month`.

Approval:
- 2026-05-24: User approved the Settings identity and month spend fixes.

## Previous Task

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
