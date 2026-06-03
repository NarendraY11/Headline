import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

// Lazy so the motion-heavy onboarding modal — and its vendor-motion chunk —
// never load with the always-mounted shell. It only renders once, right after
// a new user signs up; keeping it out of the entry graph keeps vendor-motion
// off the critical path of every route (incl. the public landing page).
const OnboardingFlow = lazy(() =>
  import("../../views/OnboardingFlow").then((m) => ({ default: m.OnboardingFlow }))
);

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
  return (
    <Suspense fallback={null}>
      <OnboardingFlow onClose={() => setShow(false)} />
    </Suspense>
  );
}
