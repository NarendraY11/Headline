import { UserData } from '../contexts/AuthContext';

export type PlanState = 'active' | 'trial' | 'expired' | 'none';

export function getUserPlanState(user: Partial<UserData> | null): { state: PlanState, daysLeft: number } {
  if (!user) return { state: 'none', daysLeft: 0 };

  const now = Date.now();
  const plan = user.plan;
  const expiresAt =
    (user as any).planExpiresAt || (user as any).plan_expires_at || null;

  // Lifetime is always active.
  if (plan === 'lifetime') return { state: 'active', daysLeft: 0 };

  // Trial: active while the trial window (or generic expiry) is in the future.
  if (plan === 'trial') {
    const endRaw = user.trialEndsAt || expiresAt;
    const end = endRaw ? new Date(endRaw).getTime() : 0;
    if (end > now) {
      return { state: 'trial', daysLeft: Math.ceil((end - now) / (1000 * 60 * 60 * 24)) };
    }
    return { state: 'expired', daysLeft: 0 };
  }

  // Pro: active if there's no expiry (lifetime-style) or it's still in the
  // future. Do NOT require plan_status === 'active' — older purchases and
  // admin grants leave plan_status unset, which previously showed "no plan".
  if (plan === 'pro') {
    if (!expiresAt) return { state: 'active', daysLeft: 0 };
    const end = new Date(expiresAt).getTime();
    if (end > now) {
      return { state: 'active', daysLeft: Math.ceil((end - now) / (1000 * 60 * 60 * 24)) };
    }
    return { state: 'expired', daysLeft: 0 };
  }

  if (user.planStatus === 'expired') return { state: 'expired', daysLeft: 0 };
  return { state: 'none', daysLeft: 0 };
}
