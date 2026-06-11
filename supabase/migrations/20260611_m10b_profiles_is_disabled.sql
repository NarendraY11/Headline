-- M10B: User Management — soft-disable flag on profiles
-- Admins can set is_disabled=true to prevent access for a user.
-- Enforcement is at the application layer (AuthContext checks this column).
-- The existing profiles_admin_update RLS policy covers writes to this column.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_disabled
  ON public.profiles (is_disabled)
  WHERE is_disabled = true;
