import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AuthModal from "../AuthModal";


export function AuthModalTrigger() {
  const { user, authModalOpen, authModalTab, closeAuthModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const PUBLIC_ROUTES = ["/", "/login", "/about", "/pricing", "/contact", "/privacy", "/terms", "/refund", "/blog", "/qotd", "/a320-systems"];
  const isOnPublicRoute = PUBLIC_ROUTES.includes(location.pathname) || location.pathname.startsWith("/exams/") || location.pathname.startsWith("/blog/");

  useEffect(() => {
    if (user) {
      const redirectFromState = location.state?.from;
      const redirectFromSession = sessionStorage.getItem("auth_redirect_path");
      const target = redirectFromState || redirectFromSession;

      if (target) {
        sessionStorage.removeItem("auth_redirect_path");
        navigate(target, { replace: true });
      } else if (isOnPublicRoute) {
        navigate("/today", { replace: true });
      }
    }
  }, [user, navigate, location]);

  return (
    <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultTab={authModalTab} />
  );
}
