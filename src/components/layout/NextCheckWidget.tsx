import React, { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation, NavLink, useOutlet, useNavigate } from "react-router-dom";
import { Wordmark, Button } from "../Atoms";
import { 
  Menu, X, ArrowUpRight, Moon, Sun, User as UserIcon, Settings, Search,
  Flame, Compass, Layers, LayoutGrid, Plane, Mic, Zap, BarChart3, Pin,
  PinOff, MoveRight, ChevronDown, Check, Gift,
  AlertCircle, Pencil
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { ErrorBoundary } from "../ErrorBoundary";
import { useFeature } from "../../hooks/useFeatureFlags";
import { OnboardingFlow } from "../../views/OnboardingFlow";
import TopSubscriptionBanner from "../TopSubscriptionBanner";
import { isPaidActive, planLabel } from "../../lib/plan";
import SearchOverlay from "../../views/SearchOverlay";
import NotificationCenter from "../NotificationCenter";
import StreakWidget from "../StreakWidget";
import { useLogbook } from "../../hooks/useLogbook";
import { trackEvent } from "../../lib/track";
import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import AuthModal from "../AuthModal";
import { CookieConsent } from "../CookieConsent";
import { GlobalToastListener } from "../GlobalToastListener";

import { HeaderAuth } from './HeaderAuth';
import { SidebarAuth } from './SidebarAuth';
import { DarkModeToggle } from './DarkModeToggle';
import { CustomDropdown } from './CustomDropdown';
import { CustomToggle } from './CustomToggle';
import { SettingsOverlay } from './SettingsOverlay';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import { PublicLayout } from './PublicLayout';
import { LoadingFallback } from './LoadingFallback';
import { PageTransition } from './PageTransition';
import { AuthOnboardingHandler } from './AuthOnboardingHandler';
import { AppShell } from './AppShell';
import { RouteMetaHelper } from './RouteMetaHelper';
import { AuthModalTrigger } from './AuthModalTrigger';
import { FeatureGatingBlocks } from './FeatureGatingBlocks';

export function NextCheckWidget({ isSidebarExpanded }: { isSidebarExpanded: boolean }) {
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
