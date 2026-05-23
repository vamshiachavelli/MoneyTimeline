do $$
begin
  create type public.transaction_kind as enum ('expense', 'income', 'payment', 'transfer');
exception
  when duplicate_object then null;
end $$;

alter table public.transactions
  add column if not exists kind public.transaction_kind not null default 'expense';

create index if not exists transactions_user_kind_idx
  on public.transactions (user_id, kind)
  where deleted_at is null;
