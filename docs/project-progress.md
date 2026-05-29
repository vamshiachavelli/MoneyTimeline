# MoneyTimeline Progress Tracker

This file tracks active work, decisions, fixes, and approval state.

## Status Legend

- `Pending`: not started
- `In Progress`: actively being worked on
- `Needs Review`: implemented and waiting for user feedback
- `Approved`: user approved
- `Done`: approved and considered complete

## Current Task

### Settings Danger Zone Sheet

Status: `Done`

Started: 2026-05-28

Goal:
- Replace the Settings Danger Zone banner notice with the polished Part 2 sheet pattern.
- Make destructive actions feel intentionally protected, not half-implemented.
- Explain future reset/delete controls without enabling them in MVP.

Progress Log:
- 2026-05-28: Started after pushing Insights Recap Share.
- 2026-05-28: Found Settings Danger Zone still uses a one-line protected notice.
- 2026-05-28: Reused the Part 2 sheet pattern for Danger Zone.

Issues Found:
- Danger Zone is a high-risk area, so a brief banner does not give enough context about why it is protected.

Changes Made:
- Updated `app/(tabs)/settings.tsx`.
- Added a Danger Zone Part 2 sheet with scoped safety bullets.
- Replaced the old one-line protected notice with the sheet.

Verification:
- `npm run typecheck` passed.
- Browser check: tapping Danger Zone opens the Part 2 sheet.
- Browser check: sheet explains delete/reset/account deletion protections.
- Browser check: old one-line banner no longer appears.

Approval:
- 2026-05-28: User approved Settings Danger Zone Sheet.

## Previous Task

### Insights Recap Share

Status: `Done`

Started: 2026-05-28

Goal:
- Replace the Insights `Share Recap` placeholder with a working MVP share action.
- Generate a clean text recap using the visible monthly insight data.
- Use native share where available and web clipboard copy as the browser fallback.

Progress Log:
- 2026-05-28: Started after committing and pushing Settings Coming Soon Sheet.
- 2026-05-28: Found `Share Recap` still shows placeholder copy.
- 2026-05-28: Added real recap generation and sharing/copy/download behavior.
- 2026-05-28: Added a web fallback for blocked clipboard access.

Issues Found:
- Insights presents `Share Recap` as a finished action, but it only says export/social cards arrive after MVP.
- Browser clipboard access can fail when the document is not focused, so web needs a download fallback.

Changes Made:
- Updated `src/features/insights/insights-screen.tsx`.
- `Share Recap` now builds a text recap from the selected month's actual insight data.
- Native uses the platform share sheet.
- Web uses Web Share when available, then clipboard, then a `.txt` download fallback.
- Placeholder share notice was removed.

Verification:
- `npm run typecheck` passed.
- Browser check: Insights loads a month with transactions and shows `Share Recap`.
- Browser check: tapping `Share Recap` shows a success notice.
- Browser check: placeholder notice no longer appears.

Approval:
- 2026-05-28: User approved Insights Recap Share.

## Previous Task

### Settings Coming Soon Sheet

Status: `Done`

Started: 2026-05-28

Goal:
- Replace generic Settings placeholder notices with a polished Part 2 information sheet.
- Make Notifications, Privacy & Security, and Support feel intentional instead of broken.
- Keep the user on Settings with clear next-step context.

Progress Log:
- 2026-05-28: Started after committing and pushing profile cleanup.
- 2026-05-28: Found Settings still uses generic placeholder notices for non-routed rows.
- 2026-05-28: Added a reusable Part 2 information sheet for non-MVP Settings rows.

Issues Found:
- Notifications, Privacy & Security, and Support rows show generic placeholder copy instead of a product-quality state.

Changes Made:
- Updated `app/(tabs)/settings.tsx`.
- Removed the generic `ready as a placeholder` notice path for Settings rows.
- Added Part 2 sheets for Notifications, Privacy & Security, and Support.
- Each sheet has scoped product bullets and a clear `Got it` close action.

Verification:
- `npm run typecheck` passed.
- Browser check: tapping Notifications opens the Part 2 sheet.
- Browser check: sheet includes feature-specific bullets and `Got it`.
- Browser check: generic placeholder notice no longer appears.

Approval:
- 2026-05-28: User approved Settings Coming Soon Sheet.

## Previous Task

### Profile Placeholder Cleanup

Status: `Done`

Started: 2026-05-28

Goal:
- Remove fake profile actions that behave like placeholders.
- Keep real MVP profile editing focused on name, phone, and avatar icon.
- Make account deletion clearly protected for Part 2 instead of tappable placeholder behavior.

Progress Log:
- 2026-05-28: Started after user approved moving to the next Settings cleanup task.
- 2026-05-28: Found profile image upload and account deletion still show placeholder notices.
- 2026-05-28: Removed fake image upload action and made account deletion visibly protected.

Issues Found:
- `Upload Image` appears actionable but only says camera roll support arrives after MVP.
- `Delete account` appears actionable but only arms/shows placeholder copy.

Changes Made:
- Updated `src/features/settings/profile-screen.tsx`.
- Removed the `Upload Image` placeholder action.
- Kept `Select Icon` as the real MVP avatar customization action.
- Disabled the delete account action and changed the copy to make Part 2 protection explicit.

Verification:
- `npm run typecheck` passed.
- Browser check: Profile page shows `Select Icon`.
- Browser check: `Upload Image` is removed.
- Browser check: delete account shows protected Part 2 copy.
- Browser check: placeholder copy no longer appears on the profile page.

Approval:
- 2026-05-28: User approved Profile Placeholder Cleanup.

## Previous Task

### MVP CSV Export

Status: `Done`

Started: 2026-05-28

Goal:
- Replace the Settings `Export data` placeholder with a working MVP transaction CSV export.
- Export the current signed-in user's ledger data without exposing placeholder behavior.
- Keep the export simple and useful for testing: date, merchant, amount, account, category, status, kind, notes, split/import ids.

Progress Log:
- 2026-05-28: Started after user approved the next task.
- 2026-05-28: Found `Export data` in Settings still uses placeholder notice text.
- 2026-05-28: Replaced the placeholder with a real CSV generator and web download/native share fallback.
- 2026-05-28: Added a loading guard so export cannot falsely report no transactions before remote ledger data finishes loading.

Issues Found:
- The Settings Data workspace presents `CSV export` like a real feature, but tapping it only shows placeholder copy.
- Export can be tapped while remote transactions are still loading, so the UI needs a clear loading state.

Changes Made:
- Updated `app/(tabs)/settings.tsx`.
- Added CSV generation for current ledger transactions.
- Export columns include date, merchant, amount, kind, classification, category, account, description, split connection, import batch id, and transaction id.
- Web export downloads a `.csv` file.
- Native fallback shares the CSV content through the platform share sheet.
- Settings export card now shows loading/preparing states instead of placeholder copy.

Verification:
- `npm run typecheck` passed.
- Browser check: Settings shows Export data / CSV export after transactions load.
- Browser check: tapping Export data shows `Exported 45 transactions to CSV.`
- Browser check: placeholder notice no longer appears.

Approval:
- 2026-05-28: User approved MVP CSV Export.

## Previous Task

### Data Import Focus Refresh

Status: `Done`

Started: 2026-05-27

Goal:
- Keep Data & Import accurate after upload/delete flows without requiring a manual refresh.
- Refresh import history whenever the Data & Import screen becomes active.
- Avoid stale statement cards after a statement has been deleted.

Progress Log:
- 2026-05-27: Started after pushing the approved deleted-import cleanup.
- 2026-05-27: Confirmed Data & Import currently loads on user change but not on every screen focus.
- 2026-05-27: Added focus-based refresh for Data & Import.

Issues Found:
- Returning to Data & Import from delete/upload flows can leave old history visible until manual refresh.

Changes Made:
- Updated `src/features/import/data-import-screen.tsx`.
- Data & Import now reloads import history every time the screen is focused.
- Removed the mount-only history load path so refresh behavior is consistent.

Verification:
- `npm run typecheck` passed.
- Browser check: `/data-import?focusrefresh=1` renders Data & Import, upload action, and import history/empty state correctly.

Approval:
- 2026-05-28: User approved Data Import Focus Refresh.

## Previous Task

### Deleted Import Cleanup Polish

Status: `Done`

Started: 2026-05-27

Goal:
- Make old recent-import timeline links clear after the related statement has been deleted.
- Avoid showing a generic empty timeline when the real state is "that import no longer exists here."
- Keep deleted import cleanup behavior consistent with Data & Import.

Progress Log:
- 2026-05-27: Started after user approved moving to the next task.
- 2026-05-27: Confirmed Timeline supports `importBatchId` filtering for recent imports.
- 2026-05-27: Found that a deleted or missing import batch currently falls through to the generic empty state.
- 2026-05-27: Added a dedicated removed-import state for stale recent-import Timeline links.

Issues Found:
- If a user lands on an old recent-import Timeline URL after deleting that statement, the screen can imply there are no transactions generally instead of explaining that the import was removed.
- The removed-import state should not show normal search/filter controls because those controls imply the import still exists.

Changes Made:
- Updated `src/features/timeline/timeline-feed-screen.tsx`.
- Timeline now detects when `importBatchId` has no matching imported transactions.
- Missing/deleted imports show `Import was removed` and a direct `Back to Data & Import` action.
- Search and filter controls are hidden for the removed-import state.
- Valid recent-import links still show the normal recent import timeline.

Verification:
- `npm run typecheck` passed.
- Browser check: fake deleted import URL shows the removed-import message and back action.
- Browser check: fake deleted import URL hides search and filter controls.
- Browser check: current valid recent-import URL still shows the normal `Recently imported` timeline.

Approval:
- 2026-05-27: User approved Deleted Import Cleanup Polish.

## Previous Task

### Statement Delete / Account Source Lock

Status: `Done`

Started: 2026-05-26

Goal:
- Keep imported statement accounts read-only because the account should come from the PDF statement itself.
- Remove the manual account-change direction from statement detail.
- Let users delete a statement, which also removes the imported transactions tied to that statement.

Progress Log:
- 2026-05-26: Started after user approved the next task.
- 2026-05-26: Confirmed imported transactions use both `account_id` and `metadata.import_account_name`.
- 2026-05-26: Confirmed account data comes from the account store and Supabase account service.
- 2026-05-26: Added account-name fallback from transaction/import account IDs in import history.
- 2026-05-27: User clarified that account reassignment should not exist because the PDF statement is the source of truth.
- 2026-05-27: Removed the account-picker direction and pivoted to a statement delete flow.

Issues Found:
- Older imports can still show `Imported account` because metadata was saved before parser/account detection improvements.
- Manual account reassignment would undermine the product rule that the statement account is extracted from the PDF.
- Soft-deleting imported transactions would keep the duplicate hash locked, so deletion needs to actually remove imported transaction rows.

Changes Made:
- Updated `src/services/supabase/import-history-service.ts`.
- Updated `src/features/import/data-import-screen.tsx`.
- Updated `src/features/import/import-detail-screen.tsx`.
- Import history now falls back to account table names when import metadata is missing.
- Statement detail no longer exposes any account-edit behavior.
- Statement detail now has a delete statement action with confirmation.
- Deleting a remote statement removes its imported transaction rows, marks the import job cancelled/deleted, removes the uploaded file from storage, and refreshes the ledger.
- Deleting a local saved import removes the local import batch.
- Deleting a statement also clears any saved local split records tied to those imported transactions.

Verification:
- `npm run typecheck` passed.
- Browser check: import detail page shows `Delete Statement`.
- Browser check: no account-change or account-picker text appears.
- Browser check: delete confirmation modal opens.
- Browser check intentionally did not confirm deletion to avoid removing live imported data during verification.

Approval:
- 2026-05-27: User approved Statement Delete / Account Source Lock.

## Previous Task

### Import History / Recent Import Polish

Status: `Done`

Started: 2026-05-26

Goal:
- Make the post-import experience clearly show what was just added.
- Improve recent import and import detail surfaces so users do not need to search the full timeline manually.
- Keep imported batches scoped to the signed-in user and grouped by account/card where possible.

Progress Log:
- 2026-05-26: Started after user approved the next task.
- 2026-05-26: Confirmed the existing flow has `/import-complete`, `/data-import`, `/import-detail/[id]`, and Timeline `importBatchId` filtering.
- 2026-05-26: Improved the import-complete page with statement metadata, a detail shortcut, and clearer expense/payment preview rows.
- 2026-05-26: Improved Data & Import history cards with expense spend and payments moved totals.
- 2026-05-26: Improved statement detail pages by grouping expenses separately from payments/transfers.

Issues Found:
- Import-complete was useful but too generic for answering "what did I just upload?"
- Data & Import cards showed counts but not enough financial meaning per statement.
- Statement detail mixed expenses and payments/transfers in one list, making card payments look too much like spend.

Changes Made:
- Updated `src/features/import/import-complete-screen.tsx`.
- Updated `src/features/import/data-import-screen.tsx`.
- Updated `src/features/import/import-detail-screen.tsx`.
- Updated `src/navigation/return-target.ts`.
- Added a statement metadata strip and Details shortcut on import complete.
- Added grouped transaction preview styling for recent imports.
- Added expense spend and payments moved totals to import history cards.
- Added grouped statement detail sections for expenses, payments/transfers, and other activity.

Verification:
- `npm run typecheck` passed.
- Browser check: `/data-import?polish=1` renders import history with `Expense spend` and `Payments moved` totals.
- Browser check: `/import-detail/99dbd7a4-f4cb-473c-974d-f33baf1829a9?returnTo=dataImport` renders grouped Expenses and Payments / transfers sections.

Approval:
- 2026-05-26: User approved Import History / Recent Import Polish.

## Previous Task

### Invalid Statement Upload Handling

Status: `Done`

Started: 2026-05-26

Goal:
- If a user uploads a PDF or file that is not a readable bank/credit card statement, stop the import before saving.
- Show a clean popup with an OK button.
- Clear the staged file after OK so the user can upload a different statement.

Progress Log:
- 2026-05-26: Started after user approved the invalid statement handling task.
- 2026-05-26: Reviewed the import screen and confirmed it already has summary and duplicate modal patterns.
- 2026-05-26: Changed import flow to parse/validate before uploading/registering files.
- 2026-05-26: Added a modal for unreadable or non-statement files with OK reset behavior.

Issues Found:
- Import currently stages/uploads the file before the parser proves it is a usable statement.
- If parsing finds no transactions, the UI can fall back to inline errors instead of a clear modal reset flow.

Changes Made:
- Updated `src/features/import/import-statement-screen.tsx`.
- Added invalid statement detection when parsing finds zero transactions and zero duplicates.
- Added `InvalidStatementModal`.
- OK clears the selected file, progress, parse result, summary, and error state.
- Reordered Supabase upload/registration so it only happens after the parser finds a valid statement.

Verification:
- `npm run typecheck` passed.
- Browser check: `/import?returnTo=calendar&invalidcheck=1` renders the upload screen.
- `npm run check:pdf-parser` passed after the import-flow changes.

Approval:
- 2026-05-26: User approved Invalid Statement Upload Handling.

## Previous Task

### PDF Parser Improvement

Status: `Done`

Started: 2026-05-26

Goal:
- Improve real PDF statement parsing reliability using the user's sample statements.
- Add repeatable parser checks so future changes can be verified against the same PDF layouts.
- Keep import behavior production-safe: no placeholder rows, no zero-amount rows, and clean duplicate/payment handling.

Progress Log:
- 2026-05-26: Started after user approved the next task.
- 2026-05-26: Confirmed the mobile app routes PDF parsing through `supabase/functions/parse-statement`.
- 2026-05-26: Confirmed the local UI parser only delegates PDFs to the Supabase Edge Function.
- 2026-05-26: Confirmed sample PDFs are available locally for Apple Card, Chase/statement-list, Wells Fargo/eStmt, and February-March statement layouts.
- 2026-05-26: Added a local-only PDF parser check script so sample statements can be tested without sending PDFs to a remote endpoint.
- 2026-05-26: Improved PDF parsing for statement periods, cent-only amounts, zero-dollar rows, card payment detection, interest charge rows, and account detection.

Issues Found:
- No repeatable parser check exists yet for the real sample PDFs.
- The PDF parser is duplicated in the Edge Function with no shared test harness.
- Cent-only amounts like `.85` can be missed by the current money parser.
- Zero-dollar rows can be parsed as transactions and later fail during save.
- Bank of America checking statements can be misdetected as Chase because Chase appears as a payment merchant.
- American Express statements can be misdetected as Chase when Chase appears in statement text.
- Apple Card statements can contain older installment purchase rows outside the current statement period.
- Interest charge transaction rows were being treated as noise instead of imported spend.

Changes Made:
- Added dev-only `pdfjs-dist` and `npm run check:pdf-parser`.
- Added `scripts/check-pdf-parser.mjs`.
- Updated `supabase/functions/parse-statement/index.ts`.
- Updated `src/features/import/statement-parser.ts`.
- Added statement-period filtering for PDF transactions.
- Added parsing for cent-only amount formats.
- Skipped zero-dollar PDF transaction rows.
- Improved payment classification for Apple Card, Chase credit card e-pay, and `DES:PAYMENT` rows.
- Reordered account detection so statement institutions win over merchant names inside transactions.
- Kept interest charges as importable expense rows.
- Deployed the updated `parse-statement` Supabase Edge Function.

Verification:
- `npm run check:pdf-parser` passed for all four local sample PDFs.
- Local parser check results: Apple Card 17 transactions, Chase 7 transactions, Bank of America checking 15 transactions, American Express 8 transactions.
- `npm run typecheck` passed.
- `npx supabase functions deploy parse-statement` succeeded for project `fzjdleinikqgtedjkwzu`.

Approval:
- 2026-05-26: User approved PDF Parser Improvement.

## Previous Task

### Profile Sync To Supabase

Status: `Done`

Started: 2026-05-25

Goal:
- Load signed-in profile fields from the Supabase `profiles` table.
- Save first name, last name, display name, and phone to Supabase.
- Keep profile display account-specific, while preserving local avatar icon preference until we add real avatar uploads.

Progress Log:
- 2026-05-25: Started after user said to continue to the next task.
- 2026-05-25: Confirmed the existing database has `profiles` with RLS and self-managed policies.
- 2026-05-25: Confirmed email should stay sourced from Supabase Auth; profile table does not store editable email.
- 2026-05-25: Added Supabase profile service for reading/upserting profile rows.
- 2026-05-25: Made local profile cache scoped per signed-in user.
- 2026-05-25: Wired Settings and Profile screens to hydrate from Supabase `profiles`.
- 2026-05-25: Wired Profile save to upsert first name, last name, display name, and phone to Supabase.

Issues Found:
- Profile screen still loads and saves only local AsyncStorage profile data.
- Settings has a local guard against stale profile email, but it does not yet hydrate profile fields from Supabase.
- Avatar icon is app-local because the database currently supports `avatar_url`, not the local icon enum.

Changes Made:
- Added `src/services/supabase/profile-service.ts`.
- Updated `src/features/settings/profile-store.ts`.
- Updated `src/features/settings/profile-screen.tsx`.
- Updated `app/(tabs)/settings.tsx`.

Verification:
- `npm run typecheck` passed.
- Browser check: Settings still shows the signed-in auth account (`vamshi`, `vamshiachavelli@gmail.com`).
- Browser check: Profile screen shows `Email from sign in`, making email source explicit.

Approval:
- 2026-05-25: User approved Profile sync to Supabase.

## Previous Task

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
