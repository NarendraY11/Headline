import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation, NavLink, useOutlet } from "react-router-dom";
import { trackEvent } from "./lib/track";
import { useDocumentMeta } from "./hooks/useDocumentMeta";
import { Wordmark, Button } from "./components/Atoms";
import { 
  Menu, 
  X, 
  ArrowUpRight, 
  Moon, 
  Sun, 
  User as UserIcon, 
  Settings, 
  Search,
  Flame,
  Compass,
  Layers,
  LayoutGrid,
  Plane,
  Mic,
  Zap,
  BarChart3,
  Pin,
  PinOff,
  MoveRight,
  ChevronDown,
  Check
} from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { lazy, Suspense } from "react";
import { OnboardingFlow } from "./views/OnboardingFlow";

const HomeView = lazy(() => import("./views/HomeView"));
const ModulesView = lazy(() => import("./views/ModulesView"));
const MockExamsView = lazy(() => import("./views/MockExamsView"));
const AnalyticsView = lazy(() => import("./views/AnalyticsView"));
const AboutView = lazy(() => import("./views/AboutView"));
const QuizView = lazy(() => import("./views/QuizView"));
const TopicView = lazy(() => import("./views/TopicView"));
const BookmarksView = lazy(() => import("./views/BookmarksView"));
const ProfileView = lazy(() => import("./views/ProfileView"));
const NotFoundView = lazy(() => import("./views/NotFoundView"));
const TodayView = lazy(() => import("./views/TodayView"));
const ResetPasswordView = lazy(() => import("./views/ResetPasswordView"));

import { AdminGuard } from "./components/AdminGuard";
import { AdminLayout } from "./components/AdminLayout";

const AdminDashboard = lazy(() => import("./views/admin/AdminDashboard"));
const SubjectsManager = lazy(() => import("./views/admin/SubjectsManager"));
const SubcategoriesManager = lazy(() => import("./views/admin/SubcategoriesManager"));
const QuestionsManager = lazy(() => import("./views/admin/QuestionsManager"));
const BulkImport = lazy(() => import("./views/admin/BulkImport"));
const UsersAnalytics = lazy(() => import("./views/admin/UsersAnalytics"));
const AdminActivity = lazy(() => import("./views/admin/AdminActivity"));
const AdminSettings = lazy(() => import("./views/admin/AdminSettings"));

import SearchOverlay from "./views/SearchOverlay";
import PricingView from "./views/PricingView";

function HeaderAuth() {
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

function SidebarAuth({ isExpanded }: { isExpanded: boolean }) {
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

function DarkModeToggle() {
  const { userData, updateUserData } = useAuth();
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("heading_theme");
    if (userData?.settings?.theme) {
      return userData.settings.theme === "dark";
    }
    return saved === "dark";
  });

  useEffect(() => {
    if (userData?.settings?.theme) {
      setIsDark(userData.settings.theme === "dark");
    }
  }, [userData?.settings?.theme]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("heading_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("heading_theme", "light");
    }
  }, [isDark]);

  const handleToggle = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (userData) {
      updateUserData({ settings: { ...userData.settings, theme: nextDark ? "dark" : "light" } });
    }
  };

  return (
    <button 
      onClick={handleToggle}
      className="p-3 -m-1.5 text-muted hover:text-ink hover:bg-rule rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none"
      title="Toggle Night Mode"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function CustomDropdown({ value, options, onChange }: { value: string, options: { value: string, label: string }[], onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label || value;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-36" onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsOpen(false);
        }
    }}>
      <div 
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="flex items-center justify-between bg-bg border border-rule rounded-md text-ink px-4 py-3 cursor-pointer select-none font-mono text-xs shadow-sm hover:bg-rule/30 transition-all focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy"
        aria-label={`Select option, current is ${selectedLabel}`}
      >
        <span className="uppercase tracking-wider">{selectedLabel}</span>
        <ChevronDown size={14} className="text-muted ml-3" />
      </div>
      {isOpen && (
        <div 
          role="listbox"
          className="absolute top-full right-0 mt-1.5 bg-paper border border-rule rounded-md shadow-md z-10 w-full overflow-hidden"
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              tabIndex={0}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                }
              }}
              className="px-4 py-2.5 text-sm font-sans flex items-center justify-between cursor-pointer hover:bg-[#FDFCF8] dark:hover:bg-bg-2 text-ink transition-colors focus:bg-[#FDFCF8] dark:focus:bg-bg-2 focus:outline-none"
            >
              <span className="capitalize">{opt.label}</span>
              {value === opt.value && <Check size={14} className="text-ink ml-4" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomToggle({ isOn, onToggle }: { isOn: boolean, onToggle: () => void }) {
  return (
    <button 
      role="switch"
      aria-checked={isOn}
      onClick={onToggle}
      className={`w-[44px] h-[24px] rounded-[12px] relative transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none focus:outline-none focus:ring-2 focus:ring-navy/50 ${isOn ? 'bg-[#0F1E3C] dark:bg-[#4A7FA5]' : 'bg-[#E5E0D5] dark:bg-[#3A3F4B]'}`}
      aria-label="Toggle setting"
    >
      <div className={`w-[20px] h-[20px] bg-white rounded-full absolute top-[2px] transition-all duration-200 shadow-sm ${isOn ? 'left-[22px]' : 'left-[2px]'}`} />
    </button>
  );
}

function SettingsOverlay({ onClose }: { onClose: () => void }) {
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
                         localStorage.removeItem("heading_onboarding_completed");
                         window.location.reload();
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

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-paper border border-rule shadow-2xl rounded-xl w-full max-w-md p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-ink"><X size={20} /></button>
        <h2 className="font-serif text-3xl text-ink mb-6">Keyboard Binding</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-rule pb-3">
            <span className="font-sans text-sm text-ink-2">Select Answer</span>
            <div className="flex gap-2 font-mono text-xs"><kbd className="px-2 py-1 bg-panel border border-rule rounded">1-4</kbd> <span className="opacity-50 text-xs mt-1">or</span> <kbd className="px-2 py-1 bg-panel border border-rule rounded">A-D</kbd></div>
          </div>
          <div className="flex justify-between items-center border-b border-rule pb-3">
            <span className="font-sans text-sm text-ink-2">Submit / Next</span>
            <kbd className="px-2 py-1 bg-panel border border-rule rounded font-mono text-xs">Enter</kbd>
          </div>
          <div className="flex justify-between items-center border-b border-rule pb-3">
            <span className="font-sans text-sm text-ink-2">Reveal (Viva Mode)</span>
            <kbd className="px-2 py-1 bg-panel border border-rule rounded font-mono text-xs">Spacebar</kbd>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="font-sans text-sm text-ink-2">Show Shortcuts</span>
            <kbd className="px-2 py-1 bg-panel border border-rule rounded font-mono text-xs">?</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}



import { AnimatePresence, motion, MotionConfig } from "motion/react";

function PublicLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { openAuthModal } = useAuth();

  // Close menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-stretch overflow-y-auto no-scrollbar font-sans" style={{ height: "100dvh" }}>
      {location.pathname !== '/' && (
      <header className="h-[calc(64px+var(--sat))] pt-[var(--sat)] border-b border-rule flex items-center justify-between px-4 md:px-6 bg-bg/95 backdrop-blur-md sticky top-0 z-50 flex-shrink-0">
        <Link to="/" className="hover:opacity-90 transition-opacity flex items-center gap-2">
          <Wordmark compassSize={26} />
          <span className="font-mono text-[9px] text-muted-2 tracking-widest uppercase md:hidden border border-rule px-1 rounded-sm mt-0.5">FL</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/about" className="text-sm font-sans text-muted hover:text-ink hidden md:block">Mission Specs</Link>
          <button onClick={() => openAuthModal("signin")} className="text-sm font-sans text-muted hover:text-ink hidden md:block cursor-pointer">Sign in</button>
          <Link to="/modules" className="hidden md:block">
            <Button variant="primary" className="h-[34px] px-3.5 text-xs font-sans font-semibold border-0">Start studying</Button>
          </Link>
          {/* Mobile Menu Activation (hamburger) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-3 -m-1.5 md:hidden text-ink hover:bg-panel rounded-full border border-transparent hover:border-rule transition-colors"
            aria-label="Toggle navigation menu"
            role="button"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      )}

      {/* MOBILE MENU NAV DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 top-[calc(64px+var(--sat))] bg-bg/95 backdrop-blur-xl border-b border-rule flex flex-col overflow-y-auto pb-safe md:hidden"
            style={{ height: 'calc(100dvh - 64px - var(--sat))' }}
          >
            <nav className="flex flex-col p-4 w-full gap-2 mt-4 font-sans text-xl">
               <NavLink to="/about" className="py-3 px-4 border-b border-rule/50 hover:bg-bg-2 transition-colors flex justify-between">
                  Theme & Specs <MoveRight size={18} className="text-muted" />
               </NavLink>
               <NavLink to="/modules" className="py-3 px-4 border-b border-rule/50 hover:bg-bg-2 transition-colors flex justify-between">
                  Study Modules <MoveRight size={18} className="text-muted" />
               </NavLink>
               <NavLink to="/today" className="py-3 px-4 border-b border-rule/50 hover:bg-bg-2 transition-colors flex justify-between">
                  Sign In <MoveRight size={18} className="text-muted" />
               </NavLink>
               <div className="mt-8 px-4 flex justify-between items-center text-sm">
                 <span className="text-muted">Display Mode</span>
                 <DarkModeToggle />
               </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 w-full bg-bg text-ink shrink-0 relative flex flex-col">
        <AnimatePresence mode="wait">
          <PageTransition keyId={location.pathname}>
            {outlet}
          </PageTransition>
        </AnimatePresence>
      </main>
      {location.pathname === '/' || location.pathname === '/pricing' ? (
        <footer 
          className="border-t border-rule pt-12 pb-[calc(3rem+var(--sab))] px-6 mt-12 shrink-0"
          style={{
            backgroundColor: "var(--bg-2)",
            borderColor: "var(--rule)",
          }}
        >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
             <div className="space-y-3">
               <div className="opacity-70">
                 <Wordmark compassSize={24} />
               </div>
               <p className="footnote text-[10px] text-muted-2">
                 © {new Date().getFullYear()} HEADING EDITORIAL AVIATION. ALL RIGHTS RESERVED.
               </p>
             </div>
             <div className="flex flex-wrap gap-8">
               <Link to="/about" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5">Mission Specs</Link>
               <a href="#" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5">Privacy Policy</a>
               <a href="#" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5">Terms of Service</a>
               <a href="#" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5">Contact Us</a>
               <a href="#" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5">Sitemap</a>
             </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 py-8 md:py-12 animate-pulse">
      {/* Header Eyebrow Skeleton */}
      <div className="h-3 w-24 bg-rule/50 rounded-full mb-3" />
      
      {/* Header Display Title Skeleton */}
      <div className="h-8 md:h-12 w-1/3 min-w-[200px] max-w-[360px] bg-rule-strong/40 rounded-lg mb-8" />
      
      {/* Grid Content Cabin Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="border border-rule rounded-2xl p-6 flex flex-col gap-4">
          <div className="h-4 w-12 bg-rule-strong/40 rounded-full" />
          <div className="h-6 w-3/4 bg-rule/50 rounded-lg" />
          <div className="h-3 w-1/2 bg-rule/30 rounded-full mt-2" />
          <div className="space-y-2 mt-4">
            <div className="h-2 w-full bg-rule/20 rounded-full" />
            <div className="h-2 w-5/6 bg-rule/20 rounded-full" />
            <div className="h-2 w-4/5 bg-rule/20 rounded-full" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="border border-rule rounded-2xl p-6 flex flex-col gap-4">
          <div className="h-4 w-16 bg-rule-strong/40 rounded-full" />
          <div className="h-6 w-2/3 bg-rule/50 rounded-lg" />
          <div className="h-3 w-2/5 bg-rule/30 rounded-full mt-2" />
          <div className="space-y-2 mt-4">
            <div className="h-2 w-full bg-rule/20 rounded-full" />
            <div className="h-2 w-11/12 bg-rule/20 rounded-full" />
            <div className="h-2 w-3/4 bg-rule/20 rounded-full" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="border border-rule rounded-2xl p-6 flex flex-col gap-4">
          <div className="h-4 w-14 bg-rule-strong/40 rounded-full" />
          <div className="h-6 w-5/6 bg-rule/50 rounded-lg" />
          <div className="h-3 w-1/3 bg-rule/30 rounded-full mt-2" />
          <div className="space-y-2 mt-4">
            <div className="h-2 w-full bg-rule/20 rounded-full" />
            <div className="h-2 w-4/5 bg-rule/20 rounded-full" />
            <div className="h-2 w-5/6 bg-rule/20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Decorative Table/List Skeleton below */}
      <div className="mt-12 border border-rule/70 rounded-2xl p-6 space-y-4">
        <div className="h-4 w-40 bg-rule-strong/40 rounded-full mb-3" />
        <div className="flex items-center justify-between py-2 border-b border-rule/30">
          <div className="h-3 w-1/4 bg-rule/40 rounded-full" />
          <div className="h-3 w-16 bg-rule/30 rounded-full" />
        </div>
        <div className="flex items-center justify-between py-2 border-b border-rule/30">
          <div className="h-3 w-1/3 bg-rule/40 rounded-full" />
          <div className="h-3 w-12 bg-rule/30 rounded-full" />
        </div>
        <div className="flex items-center justify-between py-2">
          <div className="h-3 w-1/5 bg-rule/40 rounded-full" />
          <div className="h-3 w-20 bg-rule/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function PageTransition({ children, keyId }: { children: React.ReactNode, keyId?: string }) {
  return (
    <motion.div
      key={keyId}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full h-full"
    >
      <Suspense fallback={<LoadingFallback />}>
        {children}
      </Suspense>
    </motion.div>
  );
}

function AuthOnboardingHandler() {
  const { user, loading } = useAuth();
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    if (!loading && user) {
      if (!localStorage.getItem("heading_onboarding_completed")) {
        setShow(true);
      }
    }
  }, [user, loading]);

  if (!show) return null;
  return <OnboardingFlow onClose={() => setShow(false)} />;
}

import { Pencil } from "lucide-react";

function NextCheckWidget({ isSidebarExpanded }: { isSidebarExpanded: boolean }) {
  const { userData, updateUserData } = useAuth();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const handleOpen = () => setShowModal(true);
    window.addEventListener("open-next-check-modal", handleOpen);
    return () => window.removeEventListener("open-next-check-modal", handleOpen);
  }, []);
  
  // Use userData if available, else localStorage
  const savedName = userData?.settings?.nextCheckName ?? localStorage.getItem("heading_nextCheckName") ?? "";
  const savedDate = userData?.settings?.nextCheckDate ?? localStorage.getItem("heading_nextCheckDate") ?? "";
  const savedTime = userData?.settings?.nextCheckTime ?? localStorage.getItem("heading_nextCheckTime") ?? "09:00";
  
  const [name, setName] = useState(savedName);
  const [dateStr, setDateStr] = useState(savedDate);
  const [timeStr, setTimeStr] = useState(savedTime);
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");
  const [error, setError] = useState("");

  // Update countdown every minute
  useEffect(() => {
    if (!savedDate) {
      setTimeLeftStr("");
      return;
    }
    const update = () => {
      const targetDate = new Date(`${savedDate}T${savedTime}:00`);
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeftStr("Time's up");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) {
        setTimeLeftStr(`${days}d ${hours}h Left`);
      } else {
        setTimeLeftStr(`${hours}h ${mins}m Left`);
      }
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [savedDate, savedTime]);

  const handleSave = () => {
    setError("");
    if (!name.trim()) {
      setError("Exam name is required.");
      return;
    }
    if (!dateStr) {
      setError("Date is required.");
      return;
    }
    const targetDate = new Date(`${dateStr}T${timeStr}:00`);
    if (targetDate.getTime() <= new Date().getTime()) {
      setError("Date and time must be in the future.");
      return;
    }

    localStorage.setItem("heading_nextCheckName", name);
    localStorage.setItem("heading_nextCheckDate", dateStr);
    localStorage.setItem("heading_nextCheckTime", timeStr);
    updateUserData({ settings: { ...userData?.settings, nextCheckName: name, nextCheckDate: dateStr, nextCheckTime: timeStr } as any });
    setShowModal(false);
  };

  const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  return (
    <>
      <div 
        onClick={() => setShowModal(true)}
        className={`p-4 bg-ink border border-rule/10 rounded-lg mx-3 mb-6 relative overflow-hidden transition-all duration-200 flex flex-col items-center justify-center cursor-pointer hover:bg-ink-2 group ${isSidebarExpanded ? '' : 'px-0 py-3 bg-transparent border-transparent'}`}
      >
        <div className="absolute inset-0 blueprint opacity-[0.03] pointer-events-none" />
        <div className={`relative z-10 flex w-full transition-all duration-200 ${isSidebarExpanded ? 'flex-col gap-1 items-start w-full' : 'items-center justify-center w-full'}`}>
          {isSidebarExpanded ? (
            <>
              <div className="flex justify-between items-center w-full">
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted">NEXT CHECK</span>
                <Pencil size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {savedDate ? (
                <>
                  <span className="font-serif text-sm font-semibold leading-tight text-paper truncate w-full">{savedName || "Check"}</span>
                  <span className="font-mono text-[10px] text-muted-2 whitespace-nowrap">
                    {new Date(savedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()} · {timeLeftStr}
                  </span>
                </>
              ) : (
                <div className="flex flex-col gap-1 items-start mt-1">
                  <span className="font-sans text-[11px] font-medium text-sky hover:text-sky/80 transition-colors">+ Set your next exam</span>
                </div>
              )}
            </>
          ) : (
            <Compass size={20} className="text-ink" />
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-paper border border-rule shadow-2xl rounded-xl w-full max-w-sm p-6 relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-muted hover:text-ink"><X size={20} /></button>
            <h2 className="font-serif text-2xl text-ink mb-6">Target Check</h2>
            <div className="space-y-4">
              {error && <div className="text-signal text-xs font-medium font-sans bg-signal/10 p-2 rounded">{error}</div>}
              <div>
                <label className="block font-sans text-xs font-semibold text-ink-2 mb-1.5">EXAM NAME</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. DGCA CPL Air Nav"
                  className="w-full bg-panel border border-rule rounded-md text-sm text-ink px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sky/60" 
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block font-sans text-xs font-semibold text-ink-2 mb-1.5">DATE</label>
                  <input 
                    type="date" 
                    min={getTodayStr()}
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full bg-panel border border-rule rounded-md text-sm text-ink px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sky/60" 
                  />
                </div>
                <div className="w-1/3">
                  <label className="block font-sans text-xs font-semibold text-ink-2 mb-1.5">TIME</label>
                  <input 
                    type="time" 
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    className="w-full bg-panel border border-rule rounded-md text-sm text-ink px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sky/60" 
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowModal(false)} className="text-sm">Cancel</Button>
                <Button variant="primary" onClick={handleSave} className="text-sm">Save Exam</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import AppShell from "./components/AppShell";

function LegacyAppShell() {
  const { userData } = useAuth();
  const location = useLocation();
  const outlet = useOutlet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(42);
  
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => 
    localStorage.getItem("heading_sidebar_pinned") === "true" || false
  );
  const [showHistory, setShowHistory] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isSidebarTappedForTablet, setIsSidebarTappedForTablet] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1200);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isSidebarPinnedOpen = isSidebarPinned && windowWidth >= 1024;
  const isSidebarExpanded = isSidebarPinnedOpen || isSidebarHovered || (isTablet && isSidebarTappedForTablet);
  
  const reduceMotion = userData?.settings?.reduceMotion ? "always" : "user";

  // Scroll to top on pathname change
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: userData?.settings?.reduceMotion ? "auto" : "smooth"
    });
    
    const mainContent = document.getElementById("app-main-content");
    if (mainContent) {
      mainContent.scrollTo({
        top: 0,
        behavior: userData?.settings?.reduceMotion ? "auto" : "smooth"
      });
    }

    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, userData?.settings?.reduceMotion]);

  // Watch global key bindings
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        setShowShortcuts(true);
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const [history, setHistory] = useState<{path: string, title: string}[]>([]);

  // Fetch real-time bookmark count securely
  useEffect(() => {
    if (userData?.bookmarks) {
      setBookmarkCount(userData.bookmarks.length);
    } else {
      try {
        const saved = localStorage.getItem("heading_bookmarks");
        if (saved) {
          setBookmarkCount(JSON.parse(saved).length);
        } else {
          setBookmarkCount(42); // default fallback to match visual specs
        }
      } catch {
        setBookmarkCount(42);
      }
    }
  }, [userData?.bookmarks]);

  // Compute clean, semantic breadcrumb titles based on route matching
  const getBreadcrumbTitle = (pathInput?: string) => {
    const path = pathInput || location.pathname;
    if (path === "/today") return "Today";
    if (path === "/modules") return "Question Bank";
    if (path.startsWith("/topic/")) {
      const id = path.replace("/topic/", "");
      if (id === "a320-systems") return "A320 Systems";
      return id.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    }
    if (path === "/mock-exams") return "Mock Exams";
    if (path.startsWith("/quiz/")) {
      const topicId = path.replace("/quiz/", "");
      if (topicId === "viva") return "VIVA Practice";
      if (topicId === "review") return "Daily Drill";
      if (topicId.startsWith("ai-generated-")) {
        const cleanId = topicId.replace("ai-generated-", "");
        if (cleanId === "a320-systems") return "A320 Dynamic Practice";
        return `AI Practice: ${cleanId.toUpperCase()}`;
      }
      return `Quiz: ${topicId.toUpperCase()}`;
    }
    if (path === "/bookmarks") return "Flashcards";
    if (path === "/analytics") return "Progress";
    if (path === "/profile") return "Profile";
    if (path === "/about") return "About";
    return "System";
  };

  useEffect(() => {
    const title = getBreadcrumbTitle(location.pathname);
    setHistory(prev => {
      const filtered = prev.filter(p => p.path !== location.pathname);
      return [{ path: location.pathname, title }, ...filtered].slice(0, 5);
    });
  }, [location.pathname]);

  const getReadingTime = () => {
    const p = location.pathname;
    if (p.startsWith("/quiz/")) return "12 min read";
    if (p.startsWith("/topic/") || p === "/mock-exams") return "8 min read";
    if (p === "/modules") return "1 min read";
    return "3 min read";
  };

  const isItemActive = (to: string) => {
    const path = location.pathname;
    
    // First, exact match for Today page
    if (to === "/today") return path === "/today";
    
    // For VIVA practice, route is /quiz/viva
    if (to === "/quiz/viva") {
      return path.startsWith("/quiz/viva");
    }
    
    // For A320 systems, route is /topic/a320-systems
    if (to === "/topic/a320-systems") {
      return path.startsWith("/topic/a320-systems") || path.startsWith("/quiz/ai-generated-a320-systems");
    }

    // For Mock exams, route is /mock-exams
    if (to === "/mock-exams") {
      const isQuizForMockExam = path.startsWith("/quiz/") && (
        path.includes("-cpl-") || 
        path.includes("-atpl-") || 
        path.includes("mini-mock") ||
        ["nav-cpl-01", "met-atpl-01", "ops-cpl-02", "agk-atpl-03"].some(eid => path.endsWith(eid))
      );
      return path.startsWith("/mock-exams") || isQuizForMockExam;
    }

    // For Flashcards, route is /bookmarks
    if (to === "/bookmarks") {
      return path.startsWith("/bookmarks") || path.startsWith("/quiz/bookmarks-review");
    }
    
    // For Question Bank, route is /modules
    if (to === "/modules") {
      if (path.startsWith("/modules")) return true;
      if (path.startsWith("/topic/") && !path.startsWith("/topic/a320-systems")) return true;
      if (path.startsWith("/quiz/")) {
        const isExcludedQuiz = 
          path.startsWith("/quiz/viva") || 
          path.startsWith("/quiz/bookmarks-review") || 
          path.startsWith("/quiz/ai-generated-a320-systems") ||
          path.includes("-cpl-") || 
          path.includes("-atpl-") || 
          path.includes("mini-mock") ||
          ["nav-cpl-01", "met-atpl-01", "ops-cpl-02", "agk-atpl-03"].some(eid => path.endsWith(eid));
        return !isExcludedQuiz;
      }
      return false;
    }
    
    return path.startsWith(to);
  };

  const navItems = [
    { label: "Today", to: "/today", icon: Compass },
    { label: "Question bank", to: "/modules", icon: Layers },
    { label: "Mock exams", to: "/mock-exams", icon: LayoutGrid },
    { label: "A320 systems", to: "/topic/a320-systems", icon: Plane },
    { label: "VIVA practice", to: "/quiz/viva", icon: Mic },
    { label: "Flashcards", to: "/bookmarks", icon: Zap },
    { label: "Progress", to: "/analytics", icon: BarChart3 },
  ];

  return (
    <MotionConfig reducedMotion={reduceMotion}>
        <div 
          id="app-shell"
          className="min-h-screen min-h-[100dvh] bg-bg text-ink flex flex-row overflow-x-hidden font-sans"
        >
          <AnimatePresence>
            {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
            {showSettings && <SettingsOverlay onClose={() => setShowSettings(false)} />}
            {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
          </AnimatePresence>
          <AuthOnboardingHandler />

          {/* PERSISTENT LEFT SIDEBAR (Desktop) */}
          <div 
            className={`hidden md:block flex-shrink-0 ${reduceMotion === 'always' ? 'transition-none' : 'transition-[width] duration-200 ease-in-out'} ${isSidebarPinnedOpen ? 'w-[240px]' : 'w-[64px]'}`} 
          />
          <aside 
            id="desktop-sidebar"
            className={`hidden md:flex flex-col h-screen fixed left-0 top-0 border-r border-rule bg-bg select-none z-40 overflow-hidden ${reduceMotion === 'always' ? 'transition-none' : 'transition-[width] duration-200 ease-in-out'} ${isSidebarExpanded ? 'w-[240px] shadow-[8px_0_24px_rgba(0,0,0,0.02)]' : 'w-[64px]'}`}
            onMouseEnter={() => !isSidebarPinnedOpen && setIsSidebarHovered(true)}
            onMouseLeave={() => !isSidebarPinnedOpen && setIsSidebarHovered(false)}
            aria-expanded={isSidebarExpanded}
          >
            {/* Top Logo / Wordmark + Pin Button */}
            <div className="h-[64px] flex items-center justify-between px-3 border-b border-rule/50 flex-shrink-0 relative overflow-hidden">
              <Link to="/" className={`hover:opacity-90 transition-opacity flex items-center flex-shrink-0 h-full ${!isSidebarExpanded ? 'w-full justify-center' : 'pl-2'}`}>
                <Wordmark compassSize={26} hideText={!isSidebarExpanded} />
              </Link>
              {isSidebarExpanded && windowWidth >= 1024 && (
                <button 
                  onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                  className="text-muted hover:text-ink transition-colors p-3 -m-1.5 rounded-md hover:bg-rule z-50 flex-shrink-0 ml-auto focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none"
                  title={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
                >
                  {isSidebarPinned ? <PinOff size={14} /> : <Pin size={14} />}
                </button>
              )}
            </div>

            {/* Tablet Expand/Collapse Toggle */}
            {isTablet && (
              <div className="border-b border-rule/50 flex-shrink-0">
                <button
                  onClick={() => setIsSidebarTappedForTablet(!isSidebarTappedForTablet)}
                  className={`flex items-center transition-colors hover:text-ink hover:bg-panel/40 w-full outline-none focus-visible:ring-2 focus-visible:ring-sky/60 ${isSidebarExpanded ? 'justify-between px-5 py-3 text-muted' : 'justify-center py-3 text-muted-2'}`}
                  aria-expanded={isSidebarExpanded}
                  title={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                >
                  {isSidebarExpanded ? (
                    <>
                      <span className="text-[11px] font-sans font-medium uppercase tracking-wider text-muted-2">Menu</span>
                      <Menu size={14} />
                    </>
                  ) : (
                    <Menu size={16} />
                  )}
                </button>
              </div>
            )}

            {/* Vertical scrollable Navigation List */}
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-hidden sidebar-nav-scroll">
              {navItems.map((item) => {
                const active = isItemActive(item.to);
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => {
                      if (isTablet && isSidebarTappedForTablet) setIsSidebarTappedForTablet(false);
                    }}
                    title={!isSidebarExpanded ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-sans font-medium tracking-tight transition-all border outline-none focus-visible:ring-2 focus-visible:ring-sky/60 ${
                      active
                        ? "bg-panel text-ink border-rule shadow-sm"
                        : "bg-transparent text-muted hover:text-ink hover:bg-panel/40 border-transparent"
                    } ${!isSidebarExpanded && !active ? "hover:bg-transparent" : ""}`}
                  >
                    <item.icon size={16} className={`flex-shrink-0 ${active ? "text-ink" : "text-muted-2"}`} />
                    <span 
                      className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarExpanded ? 'opacity-100 flex-grow' : 'opacity-0 w-0 hidden'}`}
                    >
                      {item.label}
                    </span>
                    {item.label === "Flashcards" && (
                      <span 
                        className={`font-mono text-[10px] ml-auto py-0.5 px-1.5 bg-bg-2 border border-rule rounded text-muted-2 transition-opacity duration-200 ${isSidebarExpanded ? 'opacity-100 flex-shrink-0' : 'opacity-0 w-0 hidden'}`}
                      >
                        {bookmarkCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Utility Nav (Settings, Dark Mode, Profile) */}
            <div className="px-3 pb-4 space-y-1 mt-auto">
              {/* Dark Mode toggle as a list item */}
              <button 
                onClick={() => {
                  const elem = document.documentElement;
                  const isDark = elem.classList.contains("dark");
                  if (isDark) {
                    elem.classList.remove("dark");
                    localStorage.setItem("heading_theme", "light");
                  } else {
                    elem.classList.add("dark");
                    localStorage.setItem("heading_theme", "dark");
                  }
                  if (isTablet && isSidebarTappedForTablet) setIsSidebarTappedForTablet(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-sans font-medium tracking-tight transition-all border outline-none focus-visible:ring-2 focus-visible:ring-sky/60 bg-transparent text-muted hover:text-ink hover:bg-panel/40 border-transparent w-full`}
                title={!isSidebarExpanded ? "Night Mode" : undefined}
              >
                <Moon size={16} className="text-muted-2 flex-shrink-0 hidden dark:block" />
                <Sun size={16} className="text-muted-2 flex-shrink-0 block dark:hidden" />
                <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
                  Night Mode
                </span>
              </button>

              <button 
                onClick={() => {
                  setShowSettings(true);
                  if (isTablet && isSidebarTappedForTablet) setIsSidebarTappedForTablet(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-sans font-medium tracking-tight transition-all border outline-none focus-visible:ring-2 focus-visible:ring-sky/60 bg-transparent text-muted hover:text-ink hover:bg-panel/40 border-transparent w-full`}
                title={!isSidebarExpanded ? "Settings" : undefined}
              >
                <Settings size={16} className="text-muted-2 flex-shrink-0" />
                <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
                  Settings
                </span>
              </button>
              <SidebarAuth isExpanded={isSidebarExpanded} />
            </div>

            {/* NEXT CHECK Sidebar footer slot */}
            <NextCheckWidget isSidebarExpanded={isSidebarExpanded} />
          </aside>

          {/* RIGHT AREA: Slim Top Bar + Scrollable Main Content Pane */}
          <div className="flex-1 flex flex-col min-w-0 min-h-screen">
            
            {/* SLIM TOP BAR */}
            <motion.header 
              id="app-header"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`h-[calc(64px+var(--sat))] pt-[var(--sat)] flex items-center justify-between px-6 sticky top-0 z-30 transition-all duration-300 border-b ${isScrolled ? 'bg-bg/40 backdrop-blur-2xl border-rule/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)]' : 'bg-bg/95 backdrop-blur-md border-rule'}`}
            >
              {/* Left side: Breadcrumb tracker, Tracker Dropdown, Status, Reading Time */}
              <div className="flex items-center gap-2 text-xs font-sans text-muted select-none min-w-0 flex-shrink mr-2 relative">
                <div className="w-2 h-2 rounded-full bg-mint animate-[pulse_2s_infinite]" title="Live session active" />
                <Link to="/" className="font-serif font-medium tracking-tighter text-[20px] text-ink hover:text-navy transition-colors cursor-pointer hidden sm:inline focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none rounded-sm px-1 leading-none">Heading</Link>
                
                <div className="relative hidden sm:block" onMouseLeave={() => setShowHistory(false)}>
                  <button 
                    onMouseEnter={() => setShowHistory(true)}
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-muted-2 hover:text-ink px-1 focus:outline-none"
                  >
                    /
                  </button>
                  <AnimatePresence>
                    {showHistory && (
                      <motion.div 
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 bg-paper border border-rule rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.06)] overflow-hidden py-1.5 z-50 origin-top"
                      >
                        <div className="px-3 py-1.5 mb-1 font-mono text-[9px] text-muted-2 uppercase tracking-[0.2em] border-b border-rule/30">Recent Flights</div>
                        {history.length > 0 ? history.map((h, i) => (
                           <Link 
                             key={`${h.path}-${i}`} 
                             to={h.path}
                             onClick={() => setShowHistory(false)}
                             className="block px-3 py-2 font-sans text-[13px] text-ink hover:bg-bg-2 transition-colors truncate mx-1.5 rounded-md"
                           >
                             {h.title}
                           </Link>
                        )) : (
                           <div className="px-3 py-2 text-[13px] text-muted">No history yet</div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <h2 className="text-ink font-medium tracking-tight truncate m-0 text-sm ml-1">{getBreadcrumbTitle()}</h2>
                <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest bg-rule/50 px-1.5 py-0.5 rounded-[4px] ml-1 whitespace-nowrap hidden md:inline">
                  {getReadingTime()}
                </span>
              </div>

              {/* Middle: Global Unified Search Pill (triggers SearchOverlay) */}
              <button 
                onClick={() => setShowSearch(true)}
                className="hidden md:flex items-center justify-center lg:justify-between gap-3 p-2 lg:px-4 lg:py-1.5 bg-panel border border-rule hover:border-rule-strong hover:bg-bg-2/50 rounded-full transition-all text-left text-xs cursor-pointer w-9 h-9 lg:w-[320px] lg:h-auto group shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Search size={13} className="text-muted-2 group-hover:text-ink transition-colors flex-shrink-0" />
                  <span className="font-sans font-light text-muted-2 group-hover:text-ink transition-colors hidden lg:inline truncate">Search questions, ATA chapters…</span>
                </div>
                <kbd className="hidden lg:inline-flex items-center gap-0.5 font-mono text-[9px] bg-bg-2 border border-rule px-1.5 py-0.5 rounded text-muted-2 uppercase select-none flex-shrink-0">
                  ⌘K
                </kbd>
              </button>

              {/* Right side: Streak, Actions, and Auth */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Streak flame indicator */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-signal/10 rounded-full border border-signal/10" title="Daily Prep Streak">
                  <Flame size={14} className="text-signal fill-signal/15" />
                  <span className="font-mono text-xs font-bold text-signal select-none">14</span>
                </div>
                
                {/* Settings button - mobile only */}
                <button 
                  onClick={() => setShowSettings(true)}
                  className="p-3 -m-1.5 text-muted hover:text-ink hover:bg-panel rounded-full border border-transparent hover:border-rule transition-colors focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none md:hidden"
                  title="Settings"
                >
                  <Settings size={18} />
                </button>
                
                {/* Dark Mode toggle - mobile only */}
                <div className="md:hidden">
                  <DarkModeToggle />
                </div>
                
                {/* Profile Avatar / Auth - mobile only */}
                <HeaderAuth />
                
                {/* Start studying primary CTA (retained) */}
                <Link to="/quiz/ata-27" className="hidden lg:inline-block">
                  <Button variant="primary" className="h-[34px] px-3.5 text-xs font-sans font-semibold border-0">
                    Start studying
                  </Button>
                </Link>

                {/* Mobile Menu Activation (hamburger) */}
                <button
                  id="mobile-menu-toggle"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-3 -m-1.5 md:hidden text-ink hover:bg-panel rounded-full border border-transparent hover:border-rule transition-colors"
                  aria-label="Toggle navigation menu"
                  role="button"
                >
                  {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
              </div>
            </motion.header>

            {/* MOBILE MENU NAV DRAWER */}
            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  id="mobile-nav-drawer"
                  className="md:hidden fixed top-[64px] left-0 right-0 z-40 bg-paper border-b border-rule shadow-2xl rounded-b-2xl px-6 py-6 flex flex-col gap-5"
                  style={{
                    borderColor: "var(--rule)",
                    maxHeight: "calc(100vh - 4.5rem)",
                    overflowY: "auto",
                  }}
                >
                  {/* Visual branding wordmark inside mobile drawer top */}
                  <div className="flex items-center justify-between border-b border-rule pb-3">
                    <Wordmark compassSize={24} />
                    <span className="footnote text-[10px] text-muted">Aviation exam prep</span>
                  </div>

                  {/* Mobile Search Input click trigger */}
                  <button 
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowSearch(true);
                    }}
                    className="flex items-center gap-2.5 px-4 py-2.5 bg-panel border border-rule hover:border-rule-strong rounded-lg transition-all text-left text-xs cursor-pointer w-full text-muted-2"
                  >
                    <Search size={14} />
                    <span>Search questions, ATA chapters…</span>
                  </button>

                  {/* Nav Links mapping */}
                  <nav className="flex flex-col gap-1.5">
                    {navItems.map((item) => {
                      const active = isItemActive(item.to);
                      return (
                        <Link 
                          key={item.label}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center justify-between p-3 rounded-lg text-sm font-sans font-medium tracking-tight transition-colors ${
                            active 
                              ? "bg-panel text-ink border border-rule shadow-sm" 
                              : "bg-transparent text-muted border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <item.icon size={16} className={active ? "text-ink" : "text-muted-2"} />
                            <span>{item.label}</span>
                          </div>
                          {item.label === "Flashcards" && (
                            <span className="font-mono text-[10px] bg-bg-2 border border-rule px-2 py-0.5 rounded text-muted-2">
                              {bookmarkCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                  
                  {/* Mobile Extra Drawer Footer Links */}
                  <div className="pt-4 border-t border-rule flex flex-col gap-3">
                    <div className="flex justify-between text-xs text-muted px-2">
                       <span>Streak: 14 Days</span>
                       <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="underline">Mission Specs</Link>
                    </div>
                    <Link to="/quiz/ata-27" className="w-full" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="primary" className="w-full justify-center h-[42px]">
                        Start studying <ArrowUpRight size={16} />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MAIN SCROLLABLE VIEW */}
            <main 
              id="app-main-content"
              className="flex-grow flex flex-col relative pb-[calc(70px+var(--sab))] md:pb-0"
            >
              {/* View insertion slot */}
              <div className="flex-grow">
                <AnimatePresence mode="wait">
                  <PageTransition keyId={location.pathname}>
                    {outlet}
                  </PageTransition>
                </AnimatePresence>
              </div>
            </main>

            {/* MOBILE BOTTOM TAB BAR */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg border-t border-rule pb-[var(--sab)] flex items-stretch justify-around px-2">
              <NavLink to="/today" className={({isActive}) => `flex flex-col items-center justify-center flex-1 py-3 gap-1 ${isActive ? 'text-ink [&>svg]:fill-ink' : 'text-muted hover:text-ink'}`}>
                <Compass size={22} />
                <span className="font-sans text-[10px] font-medium tracking-wide">Today</span>
              </NavLink>
              <NavLink to="/modules" className={({isActive}) => `flex flex-col items-center justify-center flex-1 py-3 gap-1 ${isActive ? 'text-ink [&>svg]:fill-ink' : 'text-muted hover:text-ink'}`}>
                <Layers size={22} />
                <span className="font-sans text-[10px] font-medium tracking-wide">Bank</span>
              </NavLink>
              <NavLink to="/mock-exams" className={({isActive}) => `flex flex-col items-center justify-center flex-1 py-3 gap-1 ${isActive ? 'text-ink [&>svg]:fill-ink' : 'text-muted hover:text-ink'}`}>
                <LayoutGrid size={22} />
                <span className="font-sans text-[10px] font-medium tracking-wide">Mock</span>
              </NavLink>
              <NavLink to="/topic/a320-systems" className={({isActive}) => `flex flex-col items-center justify-center flex-1 py-3 gap-1 ${isActive ? 'text-ink [&>svg]:fill-ink' : 'text-muted hover:text-ink'}`}>
                <Plane size={22} />
                <span className="font-sans text-[10px] font-medium tracking-wide">A320</span>
              </NavLink>
              <NavLink to="/analytics" className={({isActive}) => `flex flex-col items-center justify-center flex-1 py-3 gap-1 ${isActive ? 'text-ink [&>svg]:stroke-[2.5px]' : 'text-muted hover:text-ink'}`}>
                <BarChart3 size={22} />
                <span className="font-sans text-[10px] font-medium tracking-wide">Stats</span>
              </NavLink>
            </nav>

          </div>
        </div>
      </MotionConfig>
  );
}

function RouteMetaHelper() {
  useDocumentMeta();
  const location = useLocation();

  useEffect(() => {
    trackEvent("page_view", { metadata: { path: location.pathname } });
  }, [location.pathname]);

  return null;
}

import AuthModal from "./components/AuthModal";

function AuthModalTrigger() {
  const { authModalOpen, authModalTab, closeAuthModal } = useAuth();
  return (
    <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultTab={authModalTab} />
  );
}

export default function App() {
  return (
    <Router>
      <RouteMetaHelper />
      <AuthModalTrigger />
      <ErrorBoundary>
        <Routes>
          {/* PUBLIC ROUTES (No App Shell) */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomeView />} />
            <Route path="/about" element={<AboutView />} />
            <Route path="/pricing" element={<PricingView />} />
            <Route path="/reset-password" element={<ResetPasswordView />} />
          </Route>

          {/* NEW BASIC ROUTING AS REQUESTED */}
          <Route element={<AppShell />}>
            <Route path="/hero-placeholder" element={
              <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center animate-[fadeIn_0.5s_ease-out]">
                <h1 className="h-display text-ink mb-4">Placeholder Hero Content</h1>
                <p className="font-sans text-muted text-lg max-w-xl mx-auto">This is a placeholder route for the hero content, managed by the newly configured AppShell.</p>
              </div>
            } />
          </Route>

          {/* LOCKED ADMINISTRATIVE AREA */}
          <Route element={<AdminGuard><AdminLayout /></AdminGuard>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/subjects" element={<SubjectsManager />} />
            <Route path="/admin/subcategories" element={<SubcategoriesManager />} />
            <Route path="/admin/questions" element={<QuestionsManager />} />
            <Route path="/admin/import" element={<BulkImport />} />
            <Route path="/admin/users" element={<UsersAnalytics />} />
            <Route path="/admin/activity" element={<AdminActivity />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>

          {/* AUTHENTICATED APP ROUTES (With App Shell) */}
          <Route element={<LegacyAppShell />}>
            <Route path="/today" element={<TodayView />} />
            <Route path="/modules" element={<ModulesView />} />
            <Route path="/topic/:id" element={<TopicView />} />
            <Route path="/mock-exams" element={<MockExamsView />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/bookmarks" element={<BookmarksView />} />
            <Route path="/profile" element={<ProfileView />} />
            <Route path="/quiz/:topicId" element={<QuizView />} />
            <Route path="*" element={<NotFoundView />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}
