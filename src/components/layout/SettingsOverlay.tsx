import {
    Moon, Sun,
    X
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { isPaidActive, planLabel } from "../../lib/plan";
import { Button } from "../Atoms";

import { CustomDropdown } from './CustomDropdown';
import { CustomToggle } from './CustomToggle';

export function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const { userData, updateUserData, resetAccount } = useAuth();
  
  // Use Auth settings if available, fallback to local storage
  const [preferredMode, setPreferredMode] = useState(() => userData?.settings?.defaultMode || localStorage.getItem("heading_preferred_mode") || "practice");
  const [isDark, setIsDark] = useState(() => {
    if (userData?.settings?.theme) return userData.settings.theme === "dark";
    return localStorage.getItem("heading_theme") === "dark";
  });
  const [reduceMotion, setReduceMotion] = useState(() => userData?.settings?.reduceMotion || false);
  const [negativeMarking, setNegativeMarking] = useState(() => userData?.settings?.negativeMarking || false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  useEffect(() => {
    if (userData?.settings?.theme) {
       setIsDark(userData.settings.theme === "dark");
    }
  }, [userData?.settings?.theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleModeChange = (mode: string) => {
    setPreferredMode(mode);
    localStorage.setItem("heading_preferred_mode", mode);
    updateUserData({ settings: { ...userData?.settings, defaultMode: mode, reduceMotion, negativeMarking } });
  };

  const handleToggleReduceMotion = () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion: next, negativeMarking } });
  };
  
  const handleToggleNegativeMarking = () => {
    const next = !negativeMarking;
    setNegativeMarking(next);
    updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion, negativeMarking: next } });
  };

  const handleThemeToggle = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (userData) {
      updateUserData({ settings: { ...userData.settings, theme: nextDark ? "dark" : "light" } });
    } else {
      if (nextDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("heading_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("heading_theme", "light");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/30 dark:bg-ink/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-paper border border-rule shadow-2xl rounded-xl w-full max-w-lg relative max-h-[85vh] flex flex-col">
        <div className="flex-shrink-0 p-8 pb-6 bg-paper rounded-t-xl z-10 sticky top-0 border-b border-transparent">
          <button onClick={onClose} className="absolute top-8 right-8 text-muted-2 hover:text-ink transition-colors"><X size={24} /></button>
          <h2 className="font-serif text-[32px] text-ink m-0 leading-none">Settings</h2>
        </div>
        
        <div className="p-8 pt-2 overflow-y-auto sidebar-nav-scroll pb-[32px]">
          <div className="space-y-[24px]">
            {/* Subscription / Plan Management */}
            <div>
               <div className="flex items-center gap-4 mb-4">
                  <h3 className="font-serif font-medium text-lg text-ink">Flight Clearance Plan</h3>
                  <div className="h-px bg-rule flex-1" />
               </div>
               <div className="bg-panel border border-rule rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                     <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 font-sans">
                        <span className="font-sans font-semibold text-[15px] text-ink">
                           {userData?.plan === "lifetime" ? "Captain (Lifetime Pro)" : 
                            userData?.plan === "pro" ? "Captain (Pro Access)" : 
                            userData?.plan === "trial" ? "Co-Pilot (7-Day Trial)" : "Cadet (Free Account)"}
                        </span>
                        {isPaidActive(userData) && (
                           <span className="bg-mint text-bg font-mono font-bold text-[8px] tracking-wider uppercase px-1.5 py-0.5 rounded leading-none shrink-0" title={planLabel(userData)}>
                              ACTIVE
                           </span>
                        )}
                     </div>
                     <p className="font-sans text-[11px] font-mono text-muted uppercase">
                        {planLabel(userData)}
                     </p>
                     {isPaidActive(userData) ? (
                        <p className="font-sans text-xs text-muted leading-relaxed">
                           Operational clearance active. Full cockpit access enabled. Thank you for your support, Captain!
                        </p>
                     ) : (
                        <p className="font-sans text-xs text-muted leading-relaxed">
                           Limited operational sandbox. Gated access on simulated models and ground instructor coaching.
                        </p>
                     )}
                  </div>
                  <Link to="/pricing" onClick={onClose} className="shrink-0 w-full sm:w-auto">
                     <Button variant="primary" className="w-full sm:w-auto h-9 text-xs px-4 bg-navy hover:bg-navy-dark text-bg rounded-md">
                        {isPaidActive(userData) ? "Manage Subscription" : "Upgrade to Pro"}
                     </Button>
                  </Link>
               </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
               <div className="flex justify-between items-center bg-transparent py-2">
                  <div>
                     <span className="block text-sm font-sans font-medium text-ink">Negative Marking</span>
                     <span className="block text-xs font-mono tracking-wide text-muted-2 mt-1">Deduct points in timed mode</span>
                  </div>
                  <CustomToggle isOn={negativeMarking} onToggle={handleToggleNegativeMarking} />
               </div>
               
               <div className="border-t border-rule" />
               
               <div className="flex justify-between items-center bg-transparent py-2">
                  <div>
                     <span className="block text-sm font-sans font-medium text-ink">Reduce Motion</span>
                     <span className="block text-xs font-mono tracking-wide text-muted-2 mt-1">Disable non-essential animations</span>
                  </div>
                  <CustomToggle isOn={reduceMotion} onToggle={handleToggleReduceMotion} />
               </div>
            </div>
            
            {/* Default Quiz Mode */}
            <div>
              <div className="flex items-center gap-4 mb-4">
                 <h3 className="font-serif font-medium text-lg text-ink">Default Quiz Mode</h3>
                 <div className="h-px bg-rule flex-1" />
              </div>
              <div className="flex flex-col gap-3">
                <label className={`block w-full text-left p-[16px] rounded-lg border-[1.5px] cursor-pointer transition-all ${preferredMode === "practice" ? 'border-[#0F1E3C] dark:border-[#4A7FA5] bg-[#FDFCF8] dark:bg-sky-soft dark:bg-opacity-20' : 'border-rule bg-paper hover:border-rule-strong'}`}>
                  <input 
                    type="radio" 
                    name="quizMode" 
                    checked={preferredMode === "practice"} 
                    onChange={() => handleModeChange("practice")}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                     <div>
                       <span className={`block font-sans text-[15px] font-bold ${preferredMode === "practice" ? 'text-ink' : 'text-ink-2'}`}>Practice</span>
                       <span className="block font-mono text-[11px] text-muted-2 uppercase tracking-tight mt-1.5">Immediate feedback, explanations</span>
                     </div>
                     <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 ${preferredMode === "practice" ? 'border-[#0F1E3C] dark:border-[#4A7FA5]' : 'border-rule'}`}>
                        {preferredMode === "practice" && <div className="w-2.5 h-2.5 rounded-full bg-[#0F1E3C] dark:bg-[#4A7FA5]" />}
                     </div>
                  </div>
                </label>
                
                <label className={`block w-full text-left p-[16px] rounded-lg border-[1.5px] cursor-pointer transition-all ${preferredMode === "viva" ? 'border-[#0F1E3C] dark:border-[#4A7FA5] bg-[#FDFCF8] dark:bg-sky-soft dark:bg-opacity-20' : 'border-rule bg-paper hover:border-rule-strong'}`}>
                  <input 
                    type="radio" 
                    name="quizMode" 
                    checked={preferredMode === "viva"} 
                    onChange={() => handleModeChange("viva")}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                     <div>
                       <span className={`block font-sans text-[15px] font-bold ${preferredMode === "viva" ? 'text-ink' : 'text-ink-2'}`}>Viva Flashcard</span>
                       <span className="block font-mono text-[11px] text-muted-2 uppercase tracking-tight mt-1.5">Self-eval, reveal answers</span>
                     </div>
                     <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 ${preferredMode === "viva" ? 'border-[#0F1E3C] dark:border-[#4A7FA5]' : 'border-rule'}`}>
                        {preferredMode === "viva" && <div className="w-2.5 h-2.5 rounded-full bg-[#0F1E3C] dark:bg-[#4A7FA5]" />}
                     </div>
                  </div>
                </label>
                
                <label className={`block w-full text-left p-[16px] rounded-lg border-[1.5px] cursor-pointer transition-all ${preferredMode === "exam" ? 'border-[#0F1E3C] dark:border-[#4A7FA5] bg-[#FDFCF8] dark:bg-sky-soft dark:bg-opacity-20' : 'border-rule bg-paper hover:border-rule-strong'}`}>
                  <input 
                    type="radio" 
                    name="quizMode" 
                    checked={preferredMode === "exam"} 
                    onChange={() => handleModeChange("exam")}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                     <div>
                       <span className={`block font-sans text-[15px] font-bold ${preferredMode === "exam" ? 'text-ink' : 'text-ink-2'}`}>Exam Simulator</span>
                       <span className="block font-mono text-[11px] text-muted-2 uppercase tracking-tight mt-1.5">Timed, strict evaluation</span>
                     </div>
                     <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 ${preferredMode === "exam" ? 'border-[#0F1E3C] dark:border-[#4A7FA5]' : 'border-rule'}`}>
                        {preferredMode === "exam" && <div className="w-2.5 h-2.5 rounded-full bg-[#0F1E3C] dark:bg-[#4A7FA5]" />}
                     </div>
                  </div>
                </label>
              </div>
            </div>
            
            {/* Layout Overrides */}
            <div>
               <div className="flex items-center gap-4 mb-4">
                  <h3 className="font-serif font-medium text-lg text-ink">Quiz Layout</h3>
                  <div className="h-px bg-rule flex-1" />
               </div>
               <div className="space-y-4">
                 <div className="flex justify-between items-center bg-transparent py-1">
                    <span className="font-sans text-[15px] text-ink font-medium">Practice Mode</span>
                    <CustomDropdown 
                      value={userData?.settings?.practiceLayout || 'auto'} 
                      options={[
                        { value: 'auto', label: 'Auto' },
                        { value: 'editorial', label: 'Editorial' },
                        { value: 'split', label: 'Split' }
                      ]}
                      onChange={(val) => updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion, negativeMarking, practiceLayout: val as any } })}
                    />
                 </div>
                 
                 <div className="flex justify-between items-center bg-transparent py-1">
                    <span className="font-sans text-[15px] text-ink font-medium">Timed Mode</span>
                    <CustomDropdown 
                      value={userData?.settings?.timedLayout || 'auto'} 
                      options={[
                        { value: 'auto', label: 'Auto' },
                        { value: 'instrument', label: 'Instrument' },
                        { value: 'editorial', label: 'Editorial' }
                      ]}
                      onChange={(val) => updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion, negativeMarking, timedLayout: val as any } })}
                    />
                 </div>
                 
                 <div className="flex justify-between items-center bg-transparent py-1">
                    <span className="font-sans text-[15px] text-ink font-medium">Viva Mode</span>
                    <CustomDropdown 
                      value={userData?.settings?.vivaLayout || 'auto'} 
                      options={[
                        { value: 'auto', label: 'Auto' },
                        { value: 'flashcard', label: 'Flashcard' },
                        { value: 'editorial', label: 'Editorial' }
                      ]}
                      onChange={(val) => updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion, negativeMarking, vivaLayout: val as any } })}
                    />
                 </div>
               </div>
            </div>
            
            {/* Theme Toggle */}
            <div>
               <div className="flex items-center gap-4 mb-4 mt-2">
                  <h3 className="font-serif font-medium text-lg text-ink">Night Mode</h3>
                  <div className="h-px bg-rule flex-1" />
               </div>
               <div className="space-y-4">
                 <div className="flex justify-between items-center py-1">
                    <div>
                       <span className="block text-sm font-sans font-medium text-ink">Night Mode</span>
                       <span className="block text-xs font-mono tracking-wide text-muted-2 mt-1">Dark theme for low light environments</span>
                     </div>
                    <button 
                      onClick={handleThemeToggle}
                      className="px-5 py-2.5 text-sm font-sans font-medium bg-panel border-2 border-rule rounded-full text-ink hover:border-rule-strong hover:bg-bg-2 transition-colors flex items-center gap-2 shadow-sm"
                    >
                      {isDark ? <Sun size={15} /> : <Moon size={15} />} {isDark ? 'Switch to Light' : 'Switch to Dark'}
                    </button>
                 </div>
                 
                 <div className="flex items-center gap-4 py-4">
                    <div className="h-px bg-rule flex-1" />
                 </div>
                 
                 <div className="flex justify-between items-center py-1">
                    <div>
                       <span className="block text-sm font-sans font-medium text-ink">Reset Setup</span>
                       <span className="block text-xs font-mono tracking-wide text-muted-2 mt-1">Replay the onboarding flow</span>
                     </div>
                    <button 
                      onClick={() => {
                         if (userData) {
                           updateUserData({ onboardingCompleted: false }).finally(() => {
                             localStorage.removeItem("heading_onboarding_completed");
                             window.location.reload();
                           });
                         } else {
                           localStorage.removeItem("heading_onboarding_completed");
                           window.location.reload();
                         }
                      }}
                      className="px-5 py-2.5 text-sm font-sans font-medium bg-panel border-2 border-rule rounded-full text-ink hover:border-rule-strong transition-colors flex items-center gap-2 shadow-sm"
                    >
                      Reset Setup
                    </button>
                 </div>
                 
                 <div className="flex justify-between items-center pt-2 relative">
                    <div>
                       <span className="block text-sm font-sans font-medium text-signal">Danger Zone</span>
                       <span className="block text-xs font-mono tracking-wide text-muted-2 mt-1">Permanently remove all data</span>
                     </div>
                    <button 
                      onClick={() => setShowWipeConfirm(true)}
                      className="px-5 py-2.5 text-sm font-sans font-medium bg-signal/5 border-2 border-signal/30 rounded-full text-signal hover:bg-signal/10 transition-colors flex items-center gap-2 shadow-sm"
                    >
                      Wipe Data
                    </button>
                    {showWipeConfirm && (
                      <div className="absolute right-0 bottom-full mb-4 w-72 bg-paper border border-signal/30 shadow-2xl rounded-xl p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
                         <div className="flex gap-3 items-start mb-3">
                           <div className="w-8 h-8 rounded-full bg-signal/10 flex items-center justify-center shrink-0">
                             <span className="text-signal font-serif text-lg leading-none">!</span>
                           </div>
                           <div>
                             <h4 className="font-sans font-medium text-ink text-sm mb-1">Confirm Quick Reset</h4>
                             <p className="font-sans text-xs text-ink-2 leading-relaxed">
                               This will permanently erase all your mock exam attempts, study history, and telemetry logs. This cannot be undone.
                             </p>
                           </div>
                         </div>
                         <div className="flex gap-2 justify-end">
                           <button onClick={() => setShowWipeConfirm(false)} className="px-3 py-1.5 font-sans text-xs font-medium text-ink bg-bg hover:bg-rule rounded-md transition-colors">
                             Cancel
                           </button>
                           <button onClick={async () => { await resetAccount(); onClose(); }} className="px-3 py-1.5 font-sans text-xs font-medium text-bg bg-signal hover:bg-signal/80 rounded-md transition-colors">
                             Wipe Data
                           </button>
                         </div>
                      </div>
                    )}
                 </div>
               </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
