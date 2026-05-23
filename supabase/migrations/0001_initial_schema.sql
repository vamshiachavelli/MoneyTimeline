create extension if not exists pgcrypto;

do $$
begin
  create type public.account_type as enum ('checking', 'savings', 'credit_card', 'cash', 'loan', 'investment', 'other');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.transaction_direction as enum ('debit', 'credit');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.transaction_status as enum ('unclassified', 'personal', 'shared', 'ignored');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.uploaded_file_type as enum ('pdf', 'csv', 'xlsx', 'xls', 'image', 'other');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.import_job_status as enum ('queued', 'processing', 'review_ready', 'completed', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.group_member_role as enum ('owner', 'admin', 'member');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.group_member_status as enum ('invited', 'active', 'removed', 'left');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.expense_status as enum ('draft', 'posted', 'voided');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.split_method as enum ('equal', 'exact_amount', 'percentage', 'ratio');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.split_status as enum ('pending', 'accepted', 'settled', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.settlement_status as enum ('pending', 'user_confirmed', 'both_confirmed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.friendship_status as enum ('contact', 'invited', 'accepted', 'blocked');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.audit_action as enum ('created', 'updated', 'deleted', 'imported', 'classified', 'split', 'settled', 'signed_in', 'exported');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  display_name text,
  avatar_url text,
  phone text,
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'America/Los_Angeles',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  account_type public.account_type not null default 'other',
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  last_four text check (last_four is null or last_four ~ '^[0-9]{2,4}$'),
  color text,
  icon_name text,
  external_account_id text,
  opening_balance_minor bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  parent_category_id uuid references public.categories(id) on delete set null,
  name text not null,
  icon_name text,
  color text,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null,
  storage_path text not null,
  original_file_name text not null,
  file_type public.uploaded_file_type not null,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket_id, storage_path)
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  uploaded_file_id uuid references public.uploaded_files(id) on delete set null,
  status public.import_job_status not null default 'queued',
  source_type public.uploaded_file_type not null,
  total_rows integer not null default 0 check (total_rows >= 0),
  parsed_rows integer not null default 0 check (parsed_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  failed_rows integer not null default 0 check (failed_rows >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  parser_version text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  avatar_url text,
  avatar_color text,
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  avatar_url text,
  avatar_color text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  addressee_user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  status public.friendship_status not null default 'contact',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (addressee_user_id is not null or contact_id is not null)
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  role public.group_member_role not null default 'member',
  status public.group_member_status not null default 'active',
  display_name text,
  joined_at timestamptz,
  invited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (user_id is not null or contact_id is not null)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  uploaded_file_id uuid references public.uploaded_files(id) on delete set null,
  import_job_id uuid references public.import_jobs(id) on delete set null,
  title text not null,
  description text,
  merchant text,
  expense_date date not null,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  method public.split_method not null default 'equal',
  status public.expense_status not null default 'posted',
  receipt_file_id uuid references public.uploaded_files(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  uploaded_file_id uuid references public.uploaded_files(id) on delete set null,
  import_job_id uuid references public.import_jobs(id) on delete set null,
  expense_id uuid references public.expenses(id) on delete set null,
  transaction_date date not null,
  posted_at timestamptz,
  merchant text not null,
  description text,
  original_description text,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  direction public.transaction_direction not null default 'debit',
  status public.transaction_status not null default 'unclassified',
  duplicate_hash text not null,
  external_transaction_id text,
  confidence numeric(5, 4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  ai_category_suggestion jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, duplicate_hash)
);

create table if not exists public.expense_payers (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  payer_user_id uuid references auth.users(id) on delete set null,
  payer_contact_id uuid references public.contacts(id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (payer_user_id is not null or payer_contact_id is not null)
);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  participant_user_id uuid references auth.users(id) on delete set null,
  participant_contact_id uuid references public.contacts(id) on delete set null,
  owed_to_user_id uuid references auth.users(id) on delete set null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  percentage numeric(7, 4) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  ratio_weight numeric(12, 4) check (ratio_weight is null or ratio_weight >= 0),
  status public.split_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (participant_user_id is not null or participant_contact_id is not null)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  from_user_id uuid references auth.users(id) on delete set null,
  from_contact_id uuid references public.contacts(id) on delete set null,
  to_user_id uuid references auth.users(id) on delete set null,
  to_contact_id uuid references public.contacts(id) on delete set null,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  status public.settlement_status not null default 'pending',
  payment_method text,
  notes text,
  user_confirmed_at timestamptz,
  counterparty_confirmed_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (from_user_id is not null or from_contact_id is not null),
  check (to_user_id is not null or to_contact_id is not null)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  plan_key text not null,
  status public.subscription_status not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  appearance jsonb not null default '{}'::jsonb,
  notification_preferences jsonb not null default '{}'::jsonb,
  import_preferences jsonb not null default '{}'::jsonb,
  ai_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action public.audit_action not null,
  entity_table text not null,
  entity_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_group_member(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = target_user_id
      and gm.status = 'active'
      and gm.deleted_at is null
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = target_user_id
      and gm.role in ('owner', 'admin')
      and gm.status = 'active'
      and gm.deleted_at is null
  );
$$;

create or replace function public.expense_visible_to_user(target_expense_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.expenses e
    where e.id = target_expense_id
      and (
        e.created_by_user_id = target_user_id
        or (e.group_id is not null and public.is_group_member(e.group_id, target_user_id))
      )
  )
  or exists (
    select 1
    from public.expense_payers ep
    where ep.expense_id = target_expense_id
      and ep.payer_user_id = target_user_id
  )
  or exists (
    select 1
    from public.expense_splits es
    where es.expense_id = target_expense_id
      and (
        es.participant_user_id = target_user_id
        or es.owed_to_user_id = target_user_id
      )
  );
$$;

create or replace function public.settlement_visible_to_user(target_settlement_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.settlements s
    where s.id = target_settlement_id
      and (
        s.created_by_user_id = target_user_id
        or s.from_user_id = target_user_id
        or s.to_user_id = target_user_id
        or (s.group_id is not null and public.is_group_member(s.group_id, target_user_id))
      )
  );
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger uploaded_files_set_updated_at before update on public.uploaded_files
  for each row execute function public.set_updated_at();
create trigger import_jobs_set_updated_at before update on public.import_jobs
  for each row execute function public.set_updated_at();
create trigger groups_set_updated_at before update on public.groups
  for each row execute function public.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger friendships_set_updated_at before update on public.friendships
  for each row execute function public.set_updated_at();
create trigger group_members_set_updated_at before update on public.group_members
  for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger expense_payers_set_updated_at before update on public.expense_payers
  for each row execute function public.set_updated_at();
create trigger expense_splits_set_updated_at before update on public.expense_splits
  for each row execute function public.set_updated_at();
create trigger settlements_set_updated_at before update on public.settlements
  for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.import_jobs enable row level security;
alter table public.groups enable row level security;
alter table public.contacts enable row level security;
alter table public.friendships enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.transactions enable row level security;
alter table public.expense_payers enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_settings enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Profiles are self managed" on public.profiles;
create policy "Profiles are self managed" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Users manage own accounts" on public.accounts;
create policy "Users manage own accounts" on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage own categories" on public.categories;
create policy "Users manage own categories" on public.categories
  for all using (user_id = auth.uid() or is_system = true) with check (user_id = auth.uid());

drop policy if exists "Users manage own uploaded files" on public.uploaded_files;
create policy "Users manage own uploaded files" on public.uploaded_files
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage own import jobs" on public.import_jobs;
create policy "Users manage own import jobs" on public.import_jobs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage own contacts" on public.contacts;
create policy "Users manage own contacts" on public.contacts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage own friendships" on public.friendships;
create policy "Users manage own friendships" on public.friendships
  for all using (
    requester_user_id = auth.uid()
    or addressee_user_id = auth.uid()
    or exists (
      select 1 from public.contacts c
      where c.id = friendships.contact_id and c.user_id = auth.uid()
    )
  )
  with check (
    requester_user_id = auth.uid()
    or addressee_user_id = auth.uid()
    or exists (
      select 1 from public.contacts c
      where c.id = friendships.contact_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Group members can read groups" on public.groups;
create policy "Group members can read groups" on public.groups
  for select using (
    owner_user_id = auth.uid()
    or public.is_group_member(id, auth.uid())
  );

drop policy if exists "Owners create groups" on public.groups;
create policy "Owners create groups" on public.groups
  for insert with check (owner_user_id = auth.uid());

drop policy if exists "Admins manage groups" on public.groups;
create policy "Admins manage groups" on public.groups
  for update using (
    owner_user_id = auth.uid()
    or public.is_group_admin(id, auth.uid())
  )
  with check (
    owner_user_id = auth.uid()
    or public.is_group_admin(id, auth.uid())
  );

drop policy if exists "Owners delete groups" on public.groups;
create policy "Owners delete groups" on public.groups
  for delete using (owner_user_id = auth.uid());

drop policy if exists "Group members can read memberships" on public.group_members;
create policy "Group members can read memberships" on public.group_members
  for select using (
    user_id = auth.uid()
    or public.is_group_member(group_id, auth.uid())
  );

drop policy if exists "Admins manage memberships" on public.group_members;
create policy "Admins manage memberships" on public.group_members
  for all using (
    public.is_group_admin(group_id, auth.uid())
    or exists (
      select 1 from public.groups g
      where g.id = group_members.group_id
        and g.owner_user_id = auth.uid()
    )
  )
  with check (
    public.is_group_admin(group_id, auth.uid())
    or exists (
      select 1 from public.groups g
      where g.id = group_members.group_id
        and g.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own expenses" on public.expenses;
create policy "Users manage own expenses" on public.expenses
  for all using (
    created_by_user_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id, auth.uid()))
  )
  with check (
    created_by_user_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id, auth.uid()))
  );

drop policy if exists "Users manage visible transactions" on public.transactions;
create policy "Users manage visible transactions" on public.transactions
  for all using (
    user_id = auth.uid()
    or (expense_id is not null and public.expense_visible_to_user(expense_id, auth.uid()))
  )
  with check (user_id = auth.uid());

drop policy if exists "Users manage visible payers" on public.expense_payers;
create policy "Users manage visible payers" on public.expense_payers
  for all using (public.expense_visible_to_user(expense_id, auth.uid()))
  with check (public.expense_visible_to_user(expense_id, auth.uid()));

drop policy if exists "Users manage visible splits" on public.expense_splits;
create policy "Users manage visible splits" on public.expense_splits
  for all using (public.expense_visible_to_user(expense_id, auth.uid()))
  with check (public.expense_visible_to_user(expense_id, auth.uid()));

drop policy if exists "Users manage visible settlements" on public.settlements;
create policy "Users manage visible settlements" on public.settlements
  for all using (public.settlement_visible_to_user(id, auth.uid()))
  with check (
    created_by_user_id = auth.uid()
    or from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id, auth.uid()))
  );

drop policy if exists "Users manage own subscriptions" on public.subscriptions;
create policy "Users manage own subscriptions" on public.subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage own settings" on public.user_settings;
create policy "Users manage own settings" on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users read own audit logs" on public.audit_logs;
create policy "Users read own audit logs" on public.audit_logs
  for select using (user_id = auth.uid());

drop policy if exists "Users create own audit logs" on public.audit_logs;
create policy "Users create own audit logs" on public.audit_logs
  for insert with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('bank-statements', 'bank-statements', false, 52428800, array[
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  ('receipts', 'receipts', false, 26214400, array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif'
  ]),
  ('exports', 'exports', false, 52428800, array[
    'text/csv',
    'application/json',
    'application/pdf',
    'application/zip'
  ])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload files to own folder" on storage.objects;
create policy "Users upload files to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('bank-statements', 'receipts', 'exports')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read own files" on storage.objects;
create policy "Users read own files" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('bank-statements', 'receipts', 'exports')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own files" on storage.objects;
create policy "Users update own files" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('bank-statements', 'receipts', 'exports')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('bank-statements', 'receipts', 'exports')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own files" on storage.objects;
create policy "Users delete own files" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('bank-statements', 'receipts', 'exports')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create index if not exists accounts_user_id_idx on public.accounts(user_id) where deleted_at is null;
create index if not exists categories_user_id_idx on public.categories(user_id) where deleted_at is null;
create index if not exists uploaded_files_user_id_idx on public.uploaded_files(user_id) where deleted_at is null;
create index if not exists import_jobs_user_id_idx on public.import_jobs(user_id) where deleted_at is null;
create index if not exists import_jobs_uploaded_file_id_idx on public.import_jobs(uploaded_file_id);
create index if not exists groups_owner_user_id_idx on public.groups(owner_user_id) where deleted_at is null;
create index if not exists contacts_user_id_idx on public.contacts(user_id) where deleted_at is null;
create index if not exists contacts_linked_user_id_idx on public.contacts(linked_user_id);
create index if not exists friendships_requester_user_id_idx on public.friendships(requester_user_id) where deleted_at is null;
create index if not exists friendships_addressee_user_id_idx on public.friendships(addressee_user_id) where deleted_at is null;
create index if not exists group_members_group_id_idx on public.group_members(group_id) where deleted_at is null;
create index if not exists group_members_user_id_idx on public.group_members(user_id) where deleted_at is null;
create unique index if not exists group_members_unique_user_idx on public.group_members(group_id, user_id)
  where user_id is not null and deleted_at is null;
create unique index if not exists group_members_unique_contact_idx on public.group_members(group_id, contact_id)
  where contact_id is not null and deleted_at is null;
create index if not exists expenses_created_by_user_id_idx on public.expenses(created_by_user_id) where deleted_at is null;
create index if not exists expenses_group_id_idx on public.expenses(group_id) where deleted_at is null;
create index if not exists expenses_expense_date_idx on public.expenses(expense_date desc) where deleted_at is null;
create index if not exists expenses_uploaded_file_id_idx on public.expenses(uploaded_file_id);
create index if not exists transactions_user_id_date_idx on public.transactions(user_id, transaction_date desc) where deleted_at is null;
create index if not exists transactions_account_id_idx on public.transactions(account_id) where deleted_at is null;
create index if not exists transactions_uploaded_file_id_idx on public.transactions(uploaded_file_id);
create index if not exists transactions_import_job_id_idx on public.transactions(import_job_id);
create index if not exists transactions_expense_id_idx on public.transactions(expense_id);
create index if not exists expense_payers_expense_id_idx on public.expense_payers(expense_id) where deleted_at is null;
create index if not exists expense_payers_payer_user_id_idx on public.expense_payers(payer_user_id) where deleted_at is null;
create index if not exists expense_splits_expense_id_idx on public.expense_splits(expense_id) where deleted_at is null;
create index if not exists expense_splits_participant_user_id_idx on public.expense_splits(participant_user_id) where deleted_at is null;
create index if not exists settlements_group_id_idx on public.settlements(group_id) where deleted_at is null;
create index if not exists settlements_from_user_id_idx on public.settlements(from_user_id) where deleted_at is null;
create index if not exists settlements_to_user_id_idx on public.settlements(to_user_id) where deleted_at is null;
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id) where deleted_at is null;
create index if not exists audit_logs_user_id_created_at_idx on public.audit_logs(user_id, created_at desc);
