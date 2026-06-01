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
import { PublicLayout } from './PublicLayout';
import { LoadingFallback } from './LoadingFallback';
import { PageTransition } from './PageTransition';
import { AuthOnboardingHandler } from './AuthOnboardingHandler';
import { NextCheckWidget } from './NextCheckWidget';
import { AppShell } from './AppShell';
import { RouteMetaHelper } from './RouteMetaHelper';
import { AuthModalTrigger } from './AuthModalTrigger';
import { FeatureGatingBlocks } from './FeatureGatingBlocks';

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
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
