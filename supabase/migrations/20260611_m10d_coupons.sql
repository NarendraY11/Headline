-- M10D: Billing & Subscription Management — coupon table
-- Used by the admin Billing page for creating and managing discount codes.
-- Checkout integration (applying at order creation) is a separate concern.

CREATE TABLE IF NOT EXISTS public.coupons (
  id              bigint generated always as identity primary key,
  code            text        NOT NULL UNIQUE,
  discount_type   text        NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value  numeric     NOT NULL CHECK (discount_value > 0),
  expires_at      timestamptz,
  usage_limit     integer,                         -- null = unlimited
  usage_count     integer     NOT NULL DEFAULT 0,
  is_active       boolean     NOT NULL DEFAULT true,
  created_by_email text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_admin_all" ON public.coupons
  FOR ALL
  USING  ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE INDEX IF NOT EXISTS idx_coupons_code   ON public.coupons (code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons (is_active) WHERE is_active = true;
