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
import { DarkModeToggle } from './DarkModeToggle';
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
