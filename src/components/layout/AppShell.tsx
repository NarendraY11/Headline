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
import { RouteMetaHelper } from './RouteMetaHelper';
import { AuthModalTrigger } from './AuthModalTrigger';
import { FeatureGatingBlocks } from './FeatureGatingBlocks';

export function AppShell() {
  const { userData } = useAuth();
  const location = useLocation();
  const outlet = useOutlet();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(42);
  const [history, setHistory] = useState<{path: string, title: string}[]>([]);
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => 
    localStorage.getItem("heading_sidebar_pinned") === "true" || false
  );
  const [showHistory, setShowHistory] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isSidebarTappedForTablet, setIsSidebarTappedForTablet] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1200);
  const [isScrolled, setIsScrolled] = useState(false);

  const { logbook } = useLogbook();

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

  const uniqueDates = [
    ...new Set(
      logbook.map((att) => att.dateISO?.split("T")[0]).filter(Boolean)
    ),
  ]
    .sort()
    .reverse();

  let computedStreak = 0;
  if (uniqueDates.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
      let expectedDate = new Date(uniqueDates[0]);
      for (const dStr of uniqueDates) {
        if (dStr === expectedDate.toISOString().split("T")[0]) {
          computedStreak++;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
  }

  const displayedStreakValue = (userData?.streakCount ?? parseInt(localStorage.getItem("heading_streak_count") || "0")) || computedStreak;
  
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isSidebarPinnedOpen = isSidebarPinned && windowWidth >= 1024;
  const isSidebarExpanded = isSidebarPinnedOpen || isSidebarHovered || (isTablet && isSidebarTappedForTablet);
  
  const reduceMotion = userData?.settings?.reduceMotion ? "always" : "user";

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

  const mockExamsEnabled = useFeature("mockExams");
  const a320SystemsEnabled = useFeature("a320Systems");

  const navItems = [
    { label: "Today", to: "/today", icon: Compass },
    { label: "Question bank", to: "/modules", icon: Layers },
    ...(mockExamsEnabled ? [{ label: "Mock exams", to: "/mock-exams", icon: LayoutGrid }] : []),
    ...(a320SystemsEnabled ? [{ label: "A320 systems", to: "/topic/a320-systems", icon: Plane }] : []),
    { label: "VIVA practice", to: "/quiz/viva", icon: Mic },
    { label: "Flashcards", to: "/bookmarks", icon: Zap },
    { label: "Progress", to: "/analytics", icon: BarChart3 },
    { label: "Refer & earn", to: "/referral", icon: Gift },
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

              {/* Right side: Streak, Actions, and Auth */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Search icon button */}
                <button 
                  onClick={() => setShowSearch(true)}
                  className="p-2 text-muted hover:text-ink hover:bg-panel rounded-full border border-transparent hover:border-rule transition-colors focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none cursor-pointer"
                  title="Search questions, ATA chapters…"
                >
                  <Search size={18} />
                </button>

                {/* Interactive Streak Indicator */}
                <StreakWidget />

                {/* Notifications Dropdown */}
                <NotificationCenter />
                
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
                  initial={{ opacity: 0, y: -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  id="mobile-nav-drawer"
                  className="md:hidden fixed top-[64px] left-0 right-0 z-40 bg-paper border-b border-rule shadow-2xl rounded-b-2xl px-4 py-4 flex flex-col gap-4"
                  style={{
                    borderColor: "var(--rule)",
                    maxHeight: "calc(100vh - 4.5rem)",
                    overflowY: "auto",
                  }}
                >
                  {/* Wordmark and search row merged to save space */}
                  <div className="flex gap-2.5 items-center">
                    <div className="flex items-center flex-shrink-0">
                      <Wordmark compassSize={20} />
                    </div>
                    
                    <button 
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowSearch(true);
                      }}
                      className="flex flex-1 items-center gap-2 px-3 py-1.5 bg-panel border border-rule hover:border-rule-strong rounded-xl transition-all text-left text-[11px] cursor-pointer text-muted-2"
                    >
                      <Search size={12} className="text-muted-2" />
                      <span className="truncate">Search question bank...</span>
                    </button>
                  </div>

                  {/* Nav Links compact 2-column grid layout */}
                  <nav className="grid grid-cols-2 gap-2">
                    {navItems.map((item) => {
                      const active = isItemActive(item.to);
                      return (
                        <Link 
                          key={item.label}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-2 p-2 px-3 rounded-xl text-xs font-sans font-medium tracking-tight border transition-all ${
                            active 
                              ? "bg-panel text-ink border-rule shadow-sm" 
                              : "bg-bg text-muted hover:text-ink border-transparent hover:bg-panel/40"
                          }`}
                        >
                          <item.icon size={14} className={`flex-shrink-0 ${active ? "text-ink" : "text-muted-2"}`} />
                          <span className="truncate">{item.label}</span>
                          {item.label === "Flashcards" && (
                            <span className="font-mono text-[9px] bg-bg-2 border border-rule px-1 rounded text-muted-2 ml-auto">
                              {bookmarkCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                  
                  {/* Compact Mobile Footer Links */}
                  <div className="pt-3 border-t border-rule/55 flex flex-col gap-2.5">
                    <div className="flex justify-between text-[11px] text-muted-2 px-1">
                       <span className="flex items-center gap-1"><Flame size={12} className="text-signal" /> Streak: {displayedStreakValue} {displayedStreakValue === 1 ? "Day" : "Days"}</span>
                       <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="underline hover:text-ink transition-colors">Mission Specs</Link>
                    </div>
                    <Link to="/quiz/ata-27" className="w-full" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="primary" className="w-full justify-center h-9 text-xs">
                        Start studying <ArrowUpRight size={13} />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TRIAL & SUBSCRIPTION STATUS BANNER */}
            <TopSubscriptionBanner />

            {/* MAIN SCROLLABLE VIEW */}
            <main 
              id="app-main-content"
              className="flex-grow flex flex-col relative pb-[calc(70px+var(--sab))] md:pb-0"
            >
              {/* View insertion slot */}
              <div className="flex-grow">
                <Suspense fallback={<LoadingFallback />}>
                  <AnimatePresence mode="wait">
                    <PageTransition keyId={location.pathname}>
                      <ErrorBoundary>
                        {outlet}
                      </ErrorBoundary>
                    </PageTransition>
                  </AnimatePresence>
                </Suspense>
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
