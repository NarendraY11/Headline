import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AuthModal from "../AuthModal";


export function AuthModalTrigger() {
  const { user, authModalOpen, authModalTab, closeAuthModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Only these two routes auto-redirect a logged-in user into the app. The
  // other public pages (/pricing, /about, /blog, /contact, …) must stay
  // viewable while authenticated — otherwise logged-in users can't reach the
  // pricing/upgrade page that ProGate, ProfileView, QuizResults, etc. link to.
  const AUTH_LANDING_ROUTES = ["/", "/login"];
  const isOnAuthLanding = AUTH_LANDING_ROUTES.includes(location.pathname);

  useEffect(() => {
    if (user) {
      const redirectFromState = location.state?.from;
      const redirectFromSession = sessionStorage.getItem("auth_redirect_path");
      const target = redirectFromState || redirectFromSession;

      if (target) {
        sessionStorage.removeItem("auth_redirect_path");
        navigate(target, { replace: true });
      } else if (isOnAuthLanding) {
        navigate("/today", { replace: true });
      }
    }
  }, [user, navigate, location]);

  return (
    <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultTab={authModalTab} />
  );
}
