create extension if not exists pgcrypto;

create type public.classification_status as enum ('unclassified', 'personal', 'shared');
create type public.statement_status as enum ('processing', 'review_ready', 'imported', 'failed');
create type public.settlement_status as enum ('pending', 'user_confirmed', 'both_confirmed', 'cancelled');
create type public.split_method as enum ('equal', 'custom_amount', 'percentage', 'item_level');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  last_four text,
  account_type text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  file_name text not null,
  file_type text not null check (file_type in ('pdf', 'csv', 'xlsx', 'xls')),
  file_path text,
  status public.statement_status not null default 'processing',
  total_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  failed_rows integer not null default 0,
  imported_rows integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  statement_id uuid references public.statements(id) on delete set null,
  date date not null,
  merchant text not null,
  description text,
  amount numeric(12, 2) not null,
  category text,
  classification_status public.classification_status not null default 'unclassified',
  duplicate_hash text not null,
  split_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, duplicate_hash)
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  avatar_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  avatar_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, person_id)
);

create table public.splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  method public.split_method not null,
  user_share_amount numeric(12, 2) not null,
  counterparty_share_amount numeric(12, 2) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (group_id is not null or person_id is not null)
);

alter table public.transactions
  add constraint transactions_split_id_fkey
  foreign key (split_id) references public.splits(id) on delete set null;

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  amount numeric(12, 2) not null,
  status public.settlement_status not null default 'pending',
  user_confirmed_at timestamptz,
  counterparty_confirmed_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (group_id is not null or person_id is not null)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger statements_set_updated_at before update on public.statements
  for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger people_set_updated_at before update on public.people
  for each row execute function public.set_updated_at();
create trigger groups_set_updated_at before update on public.groups
  for each row execute function public.set_updated_at();
create trigger splits_set_updated_at before update on public.splits
  for each row execute function public.set_updated_at();
create trigger settlements_set_updated_at before update on public.settlements
  for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;
alter table public.statements enable row level security;
alter table public.transactions enable row level security;
alter table public.people enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.splits enable row level security;
alter table public.settlements enable row level security;

create policy "Users manage own accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own statements" on public.statements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own people" on public.people
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own groups" on public.groups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage group members through own groups" on public.group_members
  for all using (
    exists (
      select 1 from public.groups
      where groups.id = group_members.group_id
      and groups.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.groups
      where groups.id = group_members.group_id
      and groups.user_id = auth.uid()
    )
  );

create policy "Users manage own splits" on public.splits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own settlements" on public.settlements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index accounts_user_id_idx on public.accounts(user_id);
create index statements_user_id_idx on public.statements(user_id);
create index transactions_user_id_date_idx on public.transactions(user_id, date desc);
create index transactions_user_id_status_idx on public.transactions(user_id, classification_status);
create index people_user_id_idx on public.people(user_id);
create index groups_user_id_idx on public.groups(user_id);
create index splits_user_id_idx on public.splits(user_id);
create index settlements_user_id_status_idx on public.settlements(user_id, status);
