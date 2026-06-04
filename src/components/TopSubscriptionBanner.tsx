import { AlertTriangle, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserPlanState } from '../lib/subscription';

export default function TopSubscriptionBanner() {
  const { userData, loading, user } = useAuth();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  
  if (!user || loading) return null;
  const { state, daysLeft } = getUserPlanState(userData);

  if (state === 'active') return null;

  return (
    <>
      <div className={`w-full py-2.5 px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs font-sans tracking-wide border-b ${
        state === 'trial' && daysLeft <= 2 
          ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/40 font-semibold" 
          : state === 'trial' 
          ? "bg-amber-soft/50 text-ink-2 hover:text-ink border-amber/20 dark:bg-amber-soft/30"
          : "bg-red-50 text-red-800 border-red-200 dark:bg-rose-950/60 dark:text-rose-100 font-medium"
      }`}>
        <div className="flex items-center gap-2">
          {state === 'trial' ? <Sparkles size={14} className={daysLeft <= 2 ? "text-rose-600 animate-pulse animate-bounce" : "text-[#DF9D38]"} /> : <AlertTriangle size={14} className="text-red-600" />}
          <span>
            {state === 'trial' && daysLeft <= 2
              ? `Trial · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left. Action Required: Upgrade now to maintain uninterrupted cockpit clearance!` 
              : state === 'trial' 
              ? `Trial · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
              : "No active plan — Unlock full access"
            }
          </span>
        </div>
        
        {state === 'trial' ? (
          <Link to="/pricing" className="shrink-0">
            <button className={`px-3 py-1 font-mono text-[9px] uppercase tracking-wider rounded-md font-semibold cursor-pointer ${
              daysLeft <= 2 
                ? "bg-rose-600 text-white hover:bg-rose-700" 
                : "bg-navy text-bg hover:bg-navy-dark"
            }`}>
              Upgrade Now
            </button>
          </Link>
        ) : (
          <button 
            onClick={() => setShowModal(true)}
            className="shrink-0 px-3 py-1 font-mono text-[9px] uppercase tracking-wider rounded-md font-semibold cursor-pointer bg-red-600 text-white hover:bg-red-700"
          >
            Buy Plan
          </button>
        )}
      </div>

      {showModal && (
          <div className="relative z-[100]" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div
              className="anim-fade fixed inset-0 bg-bg/80 backdrop-blur-sm"
              aria-hidden="true"
            />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div
                className="anim-pop mx-auto max-w-sm w-full bg-paper border border-rule rounded-[24px] p-6 shadow-xl relative text-left"
              >
                <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-muted hover:text-ink cursor-pointer">
                  <X size={16} />
                </button>
                <h2 id="modal-title" className="text-[20px] font-serif tracking-tight text-ink mb-2">
                  Subscription required
                </h2>
                <p className="text-sm font-sans text-muted mb-6">
                  You currently have no active plan. To access the question bank, mock exams, and analytics, please purchase a subscription.
                </p>
                
                <button 
                  onClick={() => {
                    setShowModal(false);
                    navigate("/pricing");
                  }}
                  className="w-full bg-navy text-bg py-3 px-4 rounded-full font-medium text-sm font-sans hover:bg-navy-dark transition-colors cursor-pointer"
                >
                  View Pricing Plans
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
