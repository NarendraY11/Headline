import { UserData } from '../contexts/AuthContext';

export type PlanState = 'active' | 'trial' | 'expired' | 'none';

export function getUserPlanState(user: Partial<UserData> | null): { state: PlanState, daysLeft: number } {
  if (!user) return { state: 'none', daysLeft: 0 };
  
  // if trial
  if (user.plan === 'trial') {
    const end = user.trialEndsAt ? new Date(user.trialEndsAt).getTime() : 0;
    const now = Date.now();
    
    if (end > now) {
      const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      return { state: 'trial', daysLeft };
    } else {
      return { state: 'expired', daysLeft: 0 };
    }
  }
  
  if (user.plan === 'pro' && user.planStatus === 'active') {
    return { state: 'active', daysLeft: 0 };
  }
  
  if (user.planStatus === 'expired') {
    return { state: 'expired', daysLeft: 0 };
  }
  
  return { state: 'none', daysLeft: 0 };
}
