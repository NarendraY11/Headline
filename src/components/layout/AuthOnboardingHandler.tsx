import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { OnboardingFlow } from "../../views/OnboardingFlow";


export function AuthOnboardingHandler() {
  const { user, userData, loading } = useAuth();
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    if (!loading && user && userData) {
      if (!userData.onboardingCompleted && !localStorage.getItem("heading_onboarding_completed")) {
        setShow(true);
      }
    }
  }, [user, userData, loading]);

  if (!show) return null;
  return <OnboardingFlow onClose={() => setShow(false)} />;
}
