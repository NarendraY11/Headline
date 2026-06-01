import {
    User as UserIcon
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";


export function SidebarAuth({ isExpanded }: { isExpanded: boolean }) {
  const { user, loading, openAuthModal } = useAuth();
  
  if (loading) return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${!isExpanded ? 'justify-center' : ''}`}>
      <div className="w-6 h-6 rounded-full bg-rule animate-pulse flex-shrink-0" />
    </div>
  );
  
  if (user) {
    return (
      <Link 
        to="/profile" 
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-sans font-medium tracking-tight transition-all border outline-none focus-visible:ring-2 focus-visible:ring-sky/60 bg-transparent text-muted hover:text-ink hover:bg-panel/40 border-transparent w-full`}
        title={!isExpanded ? "Profile" : undefined}
      >
        <div className="flex-shrink-0 flex items-center justify-center w-4 h-4">
          {user.photoURL ? (
            <img src={user.photoURL} alt="Avatar" className="w-[18px] h-[18px] rounded-full border border-rule object-cover" />
          ) : (
            <div className="w-[18px] h-[18px] rounded-full bg-navy text-bg flex items-center justify-center">
              <UserIcon size={10} />
            </div>
          )}
        </div>
        <span className={`whitespace-nowrap truncate transition-opacity duration-200 ${isExpanded ? 'opacity-100 flex-grow text-left' : 'opacity-0 w-0 hidden'}`}>
          {user.displayName || "Profile"}
        </span>
      </Link>
    );
  }
  
  return (
    <button 
      onClick={() => openAuthModal("signin")} 
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-sans font-medium tracking-tight transition-all border outline-none focus-visible:ring-2 focus-visible:ring-sky/60 bg-transparent text-muted hover:text-ink hover:bg-panel/40 border-transparent w-full`}
      title={!isExpanded ? "Sign In" : undefined}
    >
      <UserIcon size={16} className="text-muted-2 flex-shrink-0" />
      <span className={`whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
        Sign In
      </span>
    </button>
  );
}
