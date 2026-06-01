import {
    User as UserIcon
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../Atoms";


export function HeaderAuth() {
  const { user, loading, openAuthModal } = useAuth();
  
  if (loading) return <div className="w-8 h-8 rounded-full bg-rule animate-pulse hidden sm:block md:hidden" />;
  
  if (user) {
    return (
      <Link to="/profile" className="hidden sm:flex md:hidden items-center gap-2 hover:opacity-80 transition-opacity">
        {user.photoURL ? (
          <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-rule object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-navy text-bg flex items-center justify-center">
            <UserIcon size={16} />
          </div>
        )}
      </Link>
    );
  }
  
  return (
    <Button variant="ghost" onClick={() => openAuthModal("signin")} className="text-sm px-3 hidden sm:flex md:hidden">
      Sign In
    </Button>
  );
}
