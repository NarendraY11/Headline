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
import { LoadingFallback } from './LoadingFallback';
import { PageTransition } from './PageTransition';
import { AuthOnboardingHandler } from './AuthOnboardingHandler';
import { NextCheckWidget } from './NextCheckWidget';
import { AppShell } from './AppShell';
import { RouteMetaHelper } from './RouteMetaHelper';
import { AuthModalTrigger } from './AuthModalTrigger';
import { FeatureGatingBlocks } from './FeatureGatingBlocks';

export function PublicLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, openAuthModal } = useAuth();

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
        <nav className="flex items-center gap-4" aria-label="Global support and authentication">
          <Link to="/about" className="text-sm font-sans text-muted hover:text-ink hidden md:block">Mission Specs</Link>
          {!user ? (
            <button onClick={() => openAuthModal("signin")} className="text-sm font-sans text-muted hover:text-ink hidden md:block cursor-pointer">Sign in</button>
          ) : (
            <Link to="/today" className="text-sm font-sans text-muted hover:text-ink hidden md:block">Dashboard</Link>
          )}
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
        </nav>
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
               {!user ? (
                 <button onClick={() => { setMobileMenuOpen(false); openAuthModal("signin"); }} className="py-3 px-4 border-b border-rule/50 hover:bg-bg-2 transition-colors flex justify-between w-full text-left">
                    Sign In <MoveRight size={18} className="text-muted" />
                 </button>
               ) : (
                 <NavLink to="/today" className="py-3 px-4 border-b border-rule/50 hover:bg-bg-2 transition-colors flex justify-between">
                    Dashboard <MoveRight size={18} className="text-muted" />
                 </NavLink>
               )}
               <div className="mt-8 px-4 flex justify-between items-center text-sm">
                 <span className="text-muted">Display Mode</span>
                 <DarkModeToggle />
               </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 w-full bg-bg text-ink shrink-0 relative flex flex-col">
        <Suspense fallback={<LoadingFallback />}>
          <AnimatePresence mode="wait">
            <PageTransition keyId={location.pathname}>
              <ErrorBoundary>
                {outlet}
              </ErrorBoundary>
            </PageTransition>
          </AnimatePresence>
        </Suspense>
      </main>
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
           <div className="flex flex-wrap gap-5 md:gap-7">
             <Link to="/about" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5">Mission Specs</Link>
             <Link to="/privacy" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5">Privacy Policy</Link>
             <Link to="/terms" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5">Terms & Conditions</Link>
             <Link to="/refund" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5">Refund Policy</Link>
             <Link to="/contact" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5">Contact Us</Link>
             <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5">Sitemap</a>
           </div>
        </div>
      </footer>
    </div>
  );
}
