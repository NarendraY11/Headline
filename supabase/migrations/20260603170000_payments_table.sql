-- =====================================================================
-- payments — durable Razorpay payment ledger
-- =====================================================================
-- One row per captured/verified Razorpay payment. Replaces the fragile
-- `plan_changes.note ILIKE '%payment_id%'` substring idempotency check
-- with a real unique key on razorpay_payment_id.
--
-- Writes happen only via the service-role admin client in
-- api/payment/verify.ts and api/payment/webhook.ts. No client INSERT
-- policy exists, so RLS denies all client writes by default.
-- =====================================================================

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  razorpay_payment_id text not null unique,
  razorpay_order_id text,
  amount integer not null,            -- in paise, as Razorpay reports it
  currency text not null default 'INR',
  status text not null default 'captured',
  interval text,                      -- 'monthly' | 'yearly'
  source text not null default 'verify',  -- 'verify' | 'webhook'
  notes jsonb,
  created_at timestamptz default now() not null
);

alter table public.payments enable row level security;

-- Users may read their own payment history (e.g. a future billing page).
drop policy if exists "Users read own payments" on public.payments;
create policy "Users read own payments"
  on public.payments for select
  using (auth.uid() = user_id);

-- Admins may read all payments.
drop policy if exists "Admins read payments" on public.payments;
create policy "Admins read payments"
  on public.payments for select
  using (public.is_admin());

-- Admins may manage payments for support/reconciliation.
drop policy if exists "Admins manage payments" on public.payments;
create policy "Admins manage payments"
  on public.payments for all
  using (public.is_admin())
  with check (public.is_admin());

-- No INSERT/UPDATE policy for `authenticated`/`anon`: server writes use the
-- service role, which bypasses RLS. Clients can never forge a payment row.

create index if not exists idx_payments_user on public.payments(user_id);
create index if not exists idx_payments_order on public.payments(razorpay_order_id);
