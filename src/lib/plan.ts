export type PlanType = 'free' | 'trial' | 'pro' | 'lifetime';
export const TRIAL_DAYS = 7;

export function isPaidActive(userData: any): boolean {
  if (!userData) return false;
  const plan = userData.plan;
  if (plan === 'lifetime') return true;
  
  const planExpiresAt = userData.planExpiresAt || userData.plan_expires_at;
  if (plan === 'pro') {
    if (!planExpiresAt) return true; // pro is true if plan_expires_at is null OR in the future
    return new Date(planExpiresAt).getTime() > new Date().getTime();
  }
  
  if (plan === 'trial') {
    if (!planExpiresAt) return false;
    return new Date(planExpiresAt).getTime() > new Date().getTime();
  }
  
  return false;
}

export function daysLeft(userData: any): number | null {
  if (!userData) return null;
  const plan = userData.plan;
  if (plan === 'lifetime' || plan === 'free') return null;
  
  const planExpiresAt = userData.planExpiresAt || userData.plan_expires_at;
  if (!planExpiresAt) return null;
  
  const expiry = new Date(planExpiresAt).getTime();
  const now = new Date().getTime();
  const diff = expiry - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function planLabel(userData: any): string {
  if (!userData) return "FREE";
  const plan = userData.plan || "free";
  
  if (plan === 'lifetime') return "PRO · LIFETIME";
  
  const hasPaid = isPaidActive(userData);
  const left = daysLeft(userData);
  
  if (plan === 'pro') {
    if (!hasPaid) {
      return "EXPIRED";
    }
    const planExpiresAt = userData.planExpiresAt || userData.plan_expires_at;
    if (!planExpiresAt) return "PRO · LIFETIME";
    const formattedDate = new Date(planExpiresAt).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    return `PRO · expires ${formattedDate}`;
  }
  
  if (plan === 'trial') {
    if (!hasPaid) {
      return "TRIAL EXPIRED";
    }
    const days = left ?? 0;
    return `TRIAL · ${days} ${days === 1 ? 'day' : 'days'} left`;
  }
  
  return "FREE";
}
