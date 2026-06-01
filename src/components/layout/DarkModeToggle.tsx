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
import { CustomDropdown } from './CustomDropdown';
import { CustomToggle } from './CustomToggle';
import { SettingsOverlay } from './SettingsOverlay';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import { PublicLayout } from './PublicLayout';
import { LoadingFallback } from './LoadingFallback';
import { PageTransition } from './PageTransition';
import { AuthOnboardingHandler } from './AuthOnboardingHandler';
import { NextCheckWidget } from './NextCheckWidget';
import { AppShell } from './AppShell';
import { RouteMetaHelper } from './RouteMetaHelper';
import { AuthModalTrigger } from './AuthModalTrigger';
import { FeatureGatingBlocks } from './FeatureGatingBlocks';

export function DarkModeToggle() {
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
