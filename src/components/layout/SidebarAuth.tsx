import {
    User as UserIcon
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getUserPlanState } from "../../lib/subscription";


export function SidebarAuth({ isExpanded }: { isExpanded: boolean }) {
  const { user, userData, loading, openAuthModal } = useAuth();
  const planState = getUserPlanState(userData);
  const [avatarError, setAvatarError] = useState(false);
  
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
          {user.photoURL && !avatarError ? (
            <img src={user.photoURL} alt="Avatar" className="w-[18px] h-[18px] rounded-full border border-rule object-cover" onError={() => setAvatarError(true)} />
          ) : (
            <div className="w-[18px] h-[18px] rounded-full bg-navy text-bg flex items-center justify-center">
              <UserIcon size={10} />
            </div>
          )}
        </div>
        <span className={`whitespace-nowrap truncate transition-opacity duration-200 ${isExpanded ? 'opacity-100 flex-grow text-left' : 'opacity-0 w-0 hidden'}`}>
          {user.displayName || "Profile"}
        </span>
        {(planState.state === "active" || planState.state === "trial") && (
          isExpanded ? (
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded-md font-mono text-[8px] font-bold uppercase tracking-widest ${
                planState.state === "active"
                  ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-600 border border-amber-500/30"
              }`}
            >
              {planState.state === "active" ? "PRO" : `TRIAL ${planState.daysLeft}d`}
            </span>
          ) : (
            <span
              className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                planState.state === "active" ? "bg-emerald-500" : "bg-amber-500"
              }`}
              title={planState.state === "active" ? "Pro active" : `Trial · ${planState.daysLeft}d left`}
            />
          )
        )}
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
