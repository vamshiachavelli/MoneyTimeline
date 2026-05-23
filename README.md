# MoneyTimeline

MoneyTimeline is a mobile-first Expo React Native app for importing financial statements, reviewing transactions on a calendar timeline, and splitting shared expenses with people and groups.

## Prerequisites

- Node.js compatible with Expo 52
- npm
- Docker Desktop for local Supabase
- Supabase CLI through `npx supabase`

Install app dependencies:

```bash
npm install
```

## Environment

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Required Expo public variables:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

Edge Function secrets for PDF and scanned statement extraction:

```dotenv
PDF_OCR_WORKER_URL=https://your-secure-parser.example.com/parse
PDF_OCR_WORKER_KEY=your-worker-secret
```

Never commit `.env`, service role keys, worker secrets, or production database passwords.

## Supabase CLI

Initialize Supabase locally if the `supabase/` folder is missing:

```bash
npx supabase init
```

Start the local Supabase stack:

```bash
npx supabase start
```

Log in to Supabase:

```bash
npx supabase login
```

Link this repo to the MoneyTimeline project:

```bash
npx supabase link --project-ref fzjdleinikqgtedjkwzu
```

Push migrations to the linked remote project:

```bash
npx supabase db push
```

Deploy the upload processor:

```bash
npx supabase functions deploy process-upload
```

Deploy parser skeletons when needed:

```bash
npx supabase functions deploy parse-csv
npx supabase functions deploy parse-excel
npx supabase functions deploy parse-pdf
```

## Database Model

Backend code lives under:

```text
supabase/
  config.toml
  migrations/
  functions/
  seed.sql
```

Core finance tables:

- `profiles`
- `accounts`
- `categories`
- `uploaded_files`
- `import_jobs`
- `transactions`

Splitwise-style shared expense tables:

- `contacts`
- `friendships`
- `groups`
- `group_members`
- `expenses`
- `expense_payers`
- `expense_splits`
- `settlements`

Future-ready tables:

- `subscriptions`
- `user_settings`
- `audit_logs`

Money amounts are stored as integer minor units, for example `$12.34` is stored as `1234` with `currency = 'USD'`.

## Storage

Private Supabase Storage buckets are created by the migration:

- `bank-statements`
- `receipts`
- `exports`

Files use this private path format:

```text
user_id/file_id/original_filename
```

The database stores metadata in `uploaded_files`; the original PDF/CSV/Excel files are not stored in Postgres.

Storage policies allow authenticated users to read, upload, update, and delete only files inside their own top-level `user_id` folder.

## Edge Functions

`process-upload` is the first production skeleton. It:

- verifies the JWT user
- accepts `uploaded_file_id`
- fetches the `uploaded_files` row
- verifies ownership
- creates an `import_jobs` row
- detects file type
- marks the job as completed or failed with placeholder metadata

CSV, Excel, and PDF parser functions exist as placeholders:

- `parse-csv`
- `parse-excel`
- `parse-pdf`

Full PDF/OCR parsing is intentionally separate because scanned bank statements need a secure worker.

## App Data Access

Supabase calls should go through service files, not random UI components:

```text
src/lib/supabase.ts
src/services/supabase/auth-service.ts
src/services/supabase/account-service.ts
src/services/supabase/transaction-service.ts
src/services/supabase/upload-service.ts
src/services/supabase/group-service.ts
src/services/supabase/settlement-service.ts
```

Validation helpers live in:

```text
src/services/validation/finance-validation.ts
```

## Development

Run Expo:

```bash
npm run start
```

Run TypeScript verification:

```bash
npm run typecheck
```

## Production Deployment Checklist

- RLS is enabled on every user-facing table.
- Personal finance rows are scoped to `auth.uid()`.
- Group data is visible only to members.
- Group settings and membership removal are owner/admin scoped.
- Private storage buckets exist.
- Storage policies restrict access to `user_id/file_id/original_filename`.
- Edge Functions are deployed.
- Expo app uses only the anon public key.
- Service role key is never shipped to the app.
- Migrations are pushed with `npx supabase db push`.
- `process-upload` is deployed.
- PDF/OCR worker secrets are configured before scanned PDF support is enabled.
