import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AuthModal from "../AuthModal";


export function AuthModalTrigger() {
  const { user, authModalOpen, authModalTab, closeAuthModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prevUser = useRef<typeof user>(null);

  // Only these two routes auto-redirect a logged-in user into the app. The
  // other public pages (/pricing, /about, /blog, /contact, …) must stay
  // viewable while authenticated — otherwise logged-in users can't reach the
  // pricing/upgrade page that ProGate, ProfileView, QuizResults, etc. link to.
  const AUTH_LANDING_ROUTES = ["/", "/login"];
  const isOnAuthLanding = AUTH_LANDING_ROUTES.includes(location.pathname);

  useEffect(() => {
    if (!user) {
      prevUser.current = null;
      return;
    }

    const justLoggedIn = prevUser.current === null;
    prevUser.current = user;

    if (justLoggedIn) {
      // Consume the stored redirect target exactly once, right after login.
      // Reading sessionStorage on every location change causes a race: if the
      // item was set by AuthGuard (e.g. "/today") but never cleared because the
      // user later navigated directly to /pricing, the stale value would
      // redirect them away from the page they intentionally navigated to.
      const redirectFromState = location.state?.from;
      const redirectFromSession = sessionStorage.getItem("auth_redirect_path");
      const target = redirectFromState || redirectFromSession;

      if (target) {
        sessionStorage.removeItem("auth_redirect_path");
        navigate(target, { replace: true });
        return;
      }
    }

    // Always redirect auth-landing routes (/,/login) → /today for logged-in
    // users, regardless of whether this is a fresh login or a subsequent nav.
    if (isOnAuthLanding) {
      navigate("/today", { replace: true });
    }
  }, [user, navigate, location, isOnAuthLanding]);

  return (
    <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultTab={authModalTab} />
  );
}
