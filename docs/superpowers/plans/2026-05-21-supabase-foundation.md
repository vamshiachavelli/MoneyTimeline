# Supabase Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach MoneyTimeline to a production-minded Supabase backend for authentication, personal finance data, statement imports, Splitwise-style shared expenses, settlements, and future AI/payment features.

**Architecture:** Supabase becomes the source of truth for user-owned and group-shared product data. The Expo app talks to Supabase only through focused service modules; UI components continue using stores/hooks, but persistence moves from `AsyncStorage` to Supabase where the data is financial or collaborative. Files are stored in private Supabase Storage buckets, with Postgres holding metadata and import job state.

**Tech Stack:** Expo React Native, TypeScript, Supabase Postgres/Auth/Storage/Edge Functions, RLS policies, Zod-style validation helpers through local validation functions unless a dependency is approved.

---

### Task 1: Environment And Supabase Project Setup

**Files:**
- Modify: `.env`
- Modify: `.env.example`
- Create: `README.md`
- Create: `supabase/config.toml` if missing
- Create: `supabase/seed.sql` if missing

- [ ] **Step 1: Write local env values**

Set local Expo public values in `.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://fzjdleinikqgtedjkwzu.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<local anon public key>
```

Keep `.env` untracked. Do not place the real key in `.env.example`, README, migrations, functions, or committed source.

- [ ] **Step 2: Update `.env.example`**

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key

# Supabase Edge Function secrets for PDF and scanned statement extraction
PDF_OCR_WORKER_URL=https://your-secure-parser.example.com/parse
PDF_OCR_WORKER_KEY=your-worker-secret
```

- [ ] **Step 3: Initialize Supabase folder if needed**

Run:

```bash
npx supabase init
```

Expected: `supabase/config.toml` exists. If it already exists, keep the existing file.

- [ ] **Step 4: Add empty seed file**

Create `supabase/seed.sql` with:

```sql
-- MoneyTimeline seed file.
-- Production projects should not seed personal financial data.
```

- [ ] **Step 5: Verify env config**

Run:

```bash
npm run typecheck
```

Expected: TypeScript passes with no env-related errors.

### Task 2: Production Database Migration

**Files:**
- Replace or supersede: `supabase/migrations/0001_initial_schema.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Create enums and utility trigger**

Add enums for account type, transaction direction, transaction status, import status, file type, group role, expense status, split status, split method, settlement status, subscription status, audit action, and currency-safe amount fields.

- [ ] **Step 2: Create core tables**

Create:

```text
profiles
accounts
categories
uploaded_files
import_jobs
transactions
```

Use uuid primary keys, `auth.users(id)` references, `created_at`, `updated_at`, and soft-delete `deleted_at` where user data should be restorable.

- [ ] **Step 3: Create Splitwise-style tables**

Create:

```text
contacts
friendships
groups
group_members
expenses
expense_payers
expense_splits
settlements
```

Expenses represent shared expense records. Transactions may optionally link to an expense. Splits support equal, exact amount, percentage, and ratio in metadata.

- [ ] **Step 4: Create future-proof tables**

Create:

```text
subscriptions
user_settings
audit_logs
```

Use these for future paid plans, personalization, AI preferences, export preferences, and security/history tracking.

- [ ] **Step 5: Add indexes and constraints**

Add indexes for:

```text
user_id
account_id
group_id
transaction_date
uploaded_file_id
import_job_id
expense_id
contact_user_id
```

Add amount checks such as `amount_minor > 0` where amounts must be positive. Store money as integer minor units plus currency code to avoid floating-point drift.

- [ ] **Step 6: Update TypeScript database types**

Update `src/types/database.ts` to match the new schema enough for app services to compile, including row/insert/update types for all new tables.

- [ ] **Step 7: Verify migration syntax locally**

Run:

```bash
npx supabase db lint
npm run typecheck
```

Expected: SQL lint passes if CLI is available; TypeScript passes.

### Task 3: RLS And Storage Security

**Files:**
- Modify: `supabase/migrations/0001_initial_schema.sql`
- Create: `supabase/storage-policies.sql` if storage policies are better kept separate for review
- Modify: `README.md`

- [ ] **Step 1: Enable RLS on every user-facing table**

Enable RLS for every table except enum-only objects and trigger functions.

- [ ] **Step 2: Add personal finance policies**

Users can select/insert/update/delete only rows where `user_id = auth.uid()` for:

```text
profiles
accounts
categories
uploaded_files
import_jobs
transactions
contacts
friendships
subscriptions
user_settings
audit_logs
```

- [ ] **Step 3: Add group membership policies**

Group members can read groups, group members, expenses, payers, splits, and settlements only if they belong to the group. Group owners/admins can update group settings and remove members.

- [ ] **Step 4: Add involved-user policies**

Users can read expenses and settlements where they are payer, split participant, settlement payer, settlement recipient, or member of the linked group.

- [ ] **Step 5: Create private storage buckets**

Create private buckets:

```text
bank-statements
receipts
exports
```

- [ ] **Step 6: Add storage object policies**

Authenticated users can read, upload, update, and delete only objects where the first folder segment equals their `auth.uid()`:

```text
user_id/file_id/original_filename
```

- [ ] **Step 7: Document storage setup**

README must explain private buckets and folder format.

### Task 4: Edge Function Skeletons

**Files:**
- Create: `supabase/functions/process-upload/index.ts`
- Create: `supabase/functions/parse-csv/index.ts`
- Create: `supabase/functions/parse-excel/index.ts`
- Create: `supabase/functions/parse-pdf/index.ts`
- Keep: `supabase/functions/parse-statement/index.ts` unless replaced deliberately

- [ ] **Step 1: Implement `process-upload` skeleton**

The function must:

```text
read Authorization header
create Supabase client using request JWT
call auth.getUser()
accept JSON body with uploaded_file_id
fetch uploaded_files row
verify row owner is auth user
create or update import_jobs status to processing
detect file type
set job status to completed with placeholder metadata or failed with error
return JSON
```

- [ ] **Step 2: Add parser skeletons**

`parse-csv`, `parse-excel`, and `parse-pdf` return safe placeholder JSON explaining that parsing implementation is separate from upload processing.

- [ ] **Step 3: Verify function TypeScript shape**

Run:

```bash
npx supabase functions serve process-upload --no-verify-jwt
```

Expected: function starts locally if Docker/Supabase CLI is available.

### Task 5: Expo Supabase Services And Validation

**Files:**
- Create or modify: `src/lib/supabase.ts`
- Keep or bridge: `src/services/supabase/client.ts`
- Create: `src/services/supabase/auth-service.ts`
- Create: `src/services/supabase/account-service.ts`
- Create: `src/services/supabase/transaction-service.ts`
- Create: `src/services/supabase/upload-service.ts`
- Create: `src/services/supabase/group-service.ts`
- Create: `src/services/supabase/settlement-service.ts`
- Create: `src/services/validation/finance-validation.ts`

- [ ] **Step 1: Add central client**

`src/lib/supabase.ts` exports a configured Supabase client using:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

It should reuse the existing AsyncStorage auth storage.

- [ ] **Step 2: Keep existing auth working**

Update existing auth service/provider imports to use the central client or keep compatibility through `src/services/supabase/client.ts`.

- [ ] **Step 3: Add finance validation helpers**

Validate:

```text
amount_minor is a positive integer when required
currency is a 3-letter uppercase code
dates are ISO calendar dates
file type is pdf/csv/xlsx/xls
file size is within app limit
split percentages total 100
split exact amounts total expense amount
```

- [ ] **Step 4: Add service modules**

Each service should call Supabase in one place and return typed data:

```text
authService
accountService
transactionService
uploadService
groupService
settlementService
```

- [ ] **Step 5: Verify TypeScript**

Run:

```bash
npm run typecheck
```

Expected: no TypeScript errors.

### Task 6: Documentation And Deployment Checklist

**Files:**
- Create or modify: `README.md`

- [ ] **Step 1: Add Supabase CLI docs**

Include:

```bash
npm install
npx supabase init
npx supabase start
npx supabase login
npx supabase link --project-ref fzjdleinikqgtedjkwzu
npx supabase db push
npx supabase functions deploy process-upload
```

- [ ] **Step 2: Add env var docs**

Document:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
PDF_OCR_WORKER_URL
PDF_OCR_WORKER_KEY
```

- [ ] **Step 3: Add production checklist**

Checklist includes:

```text
RLS enabled
private storage buckets created
storage policies verified
edge functions deployed
anon key only in Expo
service role key never shipped
migrations pushed
PDF/OCR worker configured before scanned PDF support
```

- [ ] **Step 4: Final verification**

Run:

```bash
npm run typecheck
git diff --check
```

Expected: TypeScript passes and no whitespace errors.
