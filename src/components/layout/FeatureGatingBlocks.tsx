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
import { NextCheckWidget } from './NextCheckWidget';
import { AppShell } from './AppShell';
import { RouteMetaHelper } from './RouteMetaHelper';
import { AuthModalTrigger } from './AuthModalTrigger';

export function FeatureGatingBlocks() {
  const maintenanceMode = useFeature("maintenanceMode");
  const announcementBanner = useFeature("announcementBanner");
  const announcementText = useFeature("announcementText");
  const { userData } = useAuth(); // don't block admins even if maintenance is on
  
  if (maintenanceMode && userData?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="p-8 max-w-md text-center bg-paper border border-rule-strong rounded-xl shadow-sm">
          <AlertCircle className="w-12 h-12 text-muted-2 mx-auto mb-4" />
          <h1 className="text-xl font-serif text-ink mb-2">Scheduled Maintenance</h1>
          <p className="text-muted text-sm">
            Our systems are currently undergoing required maintenance. We will be back online shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {announcementBanner && announcementText && (
        <div className="w-full bg-indigo-600 dark:bg-indigo-500/20 dark:border-b dark:border-indigo-500 text-white dark:text-sky text-[11px] font-sans font-medium text-center py-1.5 px-4 tracking-wide shadow-sm z-[100] relative">
          {announcementText}
        </div>
      )}
    </>
  );
}
