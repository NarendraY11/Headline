import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AuthModal from "../AuthModal";


export function AuthModalTrigger() {
  const { user, authModalOpen, authModalTab, closeAuthModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      const redirectFromState = location.state?.from;
      const redirectFromSession = sessionStorage.getItem("auth_redirect_path");
      const target = redirectFromState || redirectFromSession;

      if (target) {
        sessionStorage.removeItem("auth_redirect_path");
        navigate(target, { replace: true });
      }
    }
  }, [user, navigate, location]);

  return (
    <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultTab={authModalTab} />
  );
}
