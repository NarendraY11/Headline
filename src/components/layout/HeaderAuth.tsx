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
import { NextCheckWidget } from './NextCheckWidget';
import { AppShell } from './AppShell';
import { RouteMetaHelper } from './RouteMetaHelper';
import { AuthModalTrigger } from './AuthModalTrigger';
import { FeatureGatingBlocks } from './FeatureGatingBlocks';

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
