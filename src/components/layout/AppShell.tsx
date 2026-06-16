import {
    ArrowUpRight,
    BarChart3,
    Bookmark,
    CalendarDays,
    Compass,
    Flame,
    Gift,
    GraduationCap,
    Layers, LayoutGrid,
    Menu,
    Mic,
    Moon,
    Pin,
    PinOff,
    Plane,
    Search,
    Settings,
    Sun,
    X,
    Zap
} from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useOutlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useFeature } from "../../hooks/useFeatureFlags";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import { useLogbook } from "../../hooks/useLogbook";
import { Button, Wordmark } from "../Atoms";
import { ErrorBoundary } from "../ErrorBoundary";
import NotificationCenter from "../NotificationCenter";
import StreakWidget from "../StreakWidget";
import TopSubscriptionBanner from "../TopSubscriptionBanner";

import { AuthOnboardingHandler } from './AuthOnboardingHandler';
import { DarkModeToggle } from './DarkModeToggle';
import { HeaderAuth } from './HeaderAuth';
import { LoadingFallback } from './LoadingFallback';
import { NextCheckWidget } from './NextCheckWidget';
import { PageTransition } from './PageTransition';
import { SidebarAuth } from './SidebarAuth';

// Overlays render only on user action (search/settings/shortcuts); lazy-load
// them so their code stays out of the initial shell/entry chunk.
const SearchOverlay = lazy(() => import("../../views/SearchOverlay"));
const SettingsOverlay = lazy(() => import('./SettingsOverlay').then((m) => ({ default: m.SettingsOverlay })));
const ShortcutsOverlay = lazy(() => import('./ShortcutsOverlay').then((m) => ({ default: m.ShortcutsOverlay })));

export function AppShell() {
  const { userData, user, openAuthModal } = useAuth();
  const { isAdmin } = useIsAdmin();
  const location = useLocation();
  const outlet = useOutlet();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(() => {
    try {
      const saved = localStorage.getItem("heading_bookmarks");
      return saved ? JSON.parse(saved).length : 0;
    } catch {
      return 0;
    }
  });
  const [isSidebarPinned, setIsSidebarPinned] = useState(() =>
    localStorage.getItem("heading_sidebar_pinned") === "true" || false
  );
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
          setBookmarkCount(0);
        }
      } catch {
        setBookmarkCount(0);
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
    if (path === "/schedule") return "Flight Schedule";
    if (path === "/referral") return "Refer & Earn";
    if (path === "/mock-exams") return "Mock Exams";
    if (path === "/a320-systems" || path.startsWith("/topic/a320")) return "A320 Systems";
    if (path.startsWith("/topic/")) {
      const slug = path.replace("/topic/", "");
      return slug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    if (path === "/admin") return "Admin Dashboard";
    if (path.startsWith("/admin/")) {
      const sub = path.replace("/admin/", "");
      return sub.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    return "Heading";
  };

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
  const aiStudySchedulerEnabled = useFeature("aiStudyScheduler");
  const advancedTestingEnabled = useFeature("advancedTesting");

  const navItems = [
    { label: "Today", to: "/today", icon: Compass },
    { label: "Question bank", to: "/modules", icon: Layers },
    ...(advancedTestingEnabled ? [{ label: "Exam Centre", to: "/exam-centre", icon: GraduationCap }] : []),
    ...(mockExamsEnabled ? [{ label: "Mock exams", to: "/mock-exams", icon: LayoutGrid }] : []),
    ...(a320SystemsEnabled ? [{ label: "A320 systems", to: "/topic/a320-systems", icon: Plane }] : []),
    { label: "VIVA practice", to: "/quiz/viva", icon: Mic },
    { label: "Flashcards", to: "/bookmarks", icon: Zap },
    { label: "Progress", to: "/analytics", icon: BarChart3 },
    ...(aiStudySchedulerEnabled ? [{ label: "Flight Schedule", to: "/schedule", icon: CalendarDays }] : []),
    { label: "Refer & earn", to: "/referral", icon: Gift },
    ...(isAdmin ? [{ label: "Administrative Deck", to: "/admin", icon: Settings }] : []),
  ];

  return (
        <div
          id="app-shell"
          className="min-h-screen min-h-[100dvh] bg-bg text-ink flex flex-row overflow-x-hidden font-sans"
        >
          {/* Skip navigation link for keyboard users */}
          <a
            href="#app-main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[200] focus:bg-paper focus:border focus:border-rule focus:px-4 focus:py-2 focus:rounded-lg focus:text-ink focus:text-sm focus:font-medium focus:shadow-lg"
          >
            Skip to main content
          </a>
          <Suspense fallback={null}>
            {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
            {showSettings && <SettingsOverlay onClose={() => setShowSettings(false)} />}
            {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
          </Suspense>
          <AuthOnboardingHandler />

          {/* PERSISTENT LEFT SIDEBAR (Desktop) */}
          <div 
            className={`hidden md:block flex-shrink-0 ${reduceMotion === 'always' ? 'transition-none' : 'transition-[width] duration-200 ease-in-out'} ${isSidebarPinnedOpen ? 'w-[240px]' : 'w-[64px]'}`} 
          />
          <aside
            id="desktop-sidebar"
            aria-label="Main navigation"
            className={`hidden md:flex flex-col h-screen fixed left-0 top-0 border-r border-rule bg-bg select-none z-40 overflow-hidden ${reduceMotion === 'always' ? 'transition-none' : 'transition-[width] duration-200 ease-in-out'} ${isSidebarExpanded ? 'w-[240px] shadow-[8px_0_24px_rgba(0,0,0,0.02)]' : 'w-[64px]'}`}
            onMouseEnter={() => !isSidebarPinnedOpen && setIsSidebarHovered(true)}
            onMouseLeave={() => !isSidebarPinnedOpen && setIsSidebarHovered(false)}
          >
            {/* Top Logo / Wordmark + Pin Button */}
            <div className="h-[64px] flex items-center justify-between px-3 border-b border-rule/50 flex-shrink-0 relative overflow-hidden">
              <Link to="/" className={`hover:opacity-90 transition-opacity flex items-center flex-shrink-0 h-full ${!isSidebarExpanded ? 'w-full justify-center' : 'pl-2'}`}>
                <Wordmark compassSize={26} hideText={!isSidebarExpanded} />
              </Link>
              {isSidebarExpanded && windowWidth >= 1024 && (
                <button
                  onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                  className="text-muted hover:text-ink transition-colors p-3 -m-1.5 rounded-md hover:bg-bg-2 z-50 flex-shrink-0 ml-auto focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none"
                  title={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
                  aria-label={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
                  aria-pressed={isSidebarPinned}
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
                    aria-label={!isSidebarExpanded ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-[13px] font-sans font-medium tracking-tight transition-all border outline-none focus-visible:ring-2 focus-visible:ring-sky/60 ${
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

            {/* Saved Bookmarks Quick-Access Panel */}
            {isSidebarExpanded && bookmarkCount > 0 && (
              <div className="mx-3 mb-2 p-3 rounded-lg border border-rule bg-bg-2/60">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Bookmark size={12} className="text-muted-2" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">Saved</span>
                  </div>
                  <span className="font-mono text-[10px] text-ink font-semibold">{bookmarkCount}</span>
                </div>
                <Link
                  to="/bookmarks"
                  className="flex items-center gap-1 text-[11px] font-sans text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 rounded"
                >
                  View saved questions
                  <ArrowUpRight size={10} />
                </Link>
              </div>
            )}

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
                className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-[13px] font-sans font-medium tracking-tight transition-all border outline-none focus-visible:ring-2 focus-visible:ring-sky/60 bg-transparent text-muted hover:text-ink hover:bg-panel/40 border-transparent w-full`}
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
                className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-[13px] font-sans font-medium tracking-tight transition-all border outline-none focus-visible:ring-2 focus-visible:ring-sky/60 bg-transparent text-muted hover:text-ink hover:bg-panel/40 border-transparent w-full`}
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
            <header
              id="app-header"
              className={`anim-fade h-[calc(64px+var(--sat))] pt-[var(--sat)] flex items-center justify-between px-6 sticky top-0 z-30 transition-all duration-300 border-b ${isScrolled ? 'bg-bg/40 backdrop-blur-2xl border-rule/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)]' : 'bg-bg/95 backdrop-blur-md border-rule'}`}
            >
              {/* Left side: Breadcrumb tracker, Tracker Dropdown, Status, Reading Time */}
              <div className="flex items-center gap-2 text-xs font-sans text-muted select-none min-w-0 flex-shrink mr-2 relative">
                <div className="w-2 h-2 rounded-full bg-mint animate-[pulse_2s_infinite]" title="Live session active" />
                <Link to="/" className="font-serif font-medium tracking-tighter text-[20px] text-ink hover:text-navy transition-colors cursor-pointer hidden sm:inline focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none rounded-sm px-1 leading-none">Heading</Link>
                
                <span className="text-muted-2 hidden sm:inline px-1" aria-hidden="true">/</span>
                <h2 className="text-ink font-medium tracking-tight truncate m-0 text-sm ml-1 max-w-[100px] xs:max-w-[140px] sm:max-w-none">{getBreadcrumbTitle()}</h2>
              </div>

              {/* Right side: Streak, Actions, and Auth */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Search icon button */}
                <button
                  onClick={() => setShowSearch(true)}
                  className="p-2 text-muted hover:text-ink hover:bg-panel rounded-full border border-transparent hover:border-rule transition-colors focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none cursor-pointer"
                  title="Search questions, ATA chapters…"
                  aria-label="Search questions and ATA chapters"
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
                  className="p-3 -m-1.5 text-muted hover:text-ink hover:bg-panel rounded-full border border-transparent hover:border-rule transition-colors focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Settings"
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
            </header>

            {/* MOBILE MENU NAV DRAWER */}
            {mobileMenuOpen && (
                <>
                  {/* Backdrop — closes menu on outside tap */}
                  <div
                    className="md:hidden fixed inset-0 z-30 top-[64px] bg-ink/20 backdrop-blur-[2px]"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-hidden="true"
                  />
                <div
                  id="mobile-nav-drawer"
                  role="navigation"
                  aria-label="Mobile navigation"
                  className="anim-drawer md:hidden fixed top-[64px] left-0 right-0 z-40 bg-paper border-b border-rule shadow-2xl rounded-b-2xl px-4 py-4 flex flex-col gap-4"
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
                    {!user && (
                      <button
                        onClick={() => { setMobileMenuOpen(false); openAuthModal("signin"); }}
                        className="w-full py-2 px-4 rounded-xl border border-rule text-xs font-sans font-medium text-ink hover:bg-panel/40 transition-colors text-center"
                      >
                        Sign In / Create Account
                      </button>
                    )}
                    {user && (
                      <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="w-full py-2 px-4 rounded-xl border border-rule text-xs font-sans font-medium text-ink hover:bg-panel/40 transition-colors text-center">
                        My Profile
                      </Link>
                    )}
                    <Link to="/quiz/ata-27" className="w-full" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="primary" className="w-full justify-center h-9 text-xs">
                        Start studying <ArrowUpRight size={13} />
                      </Button>
                    </Link>
                  </div>
                </div>
                </>
              )}

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
                  <PageTransition keyId={location.pathname}>
                    <ErrorBoundary>
                      {outlet}
                    </ErrorBoundary>
                  </PageTransition>
                </Suspense>
              </div>
            </main>

            {/* MOBILE BOTTOM TAB BAR */}
            <nav aria-label="Bottom navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg border-t border-rule pb-[var(--sab)] flex items-stretch justify-around px-2">
              <NavLink to="/today" className={({isActive}) => `relative flex flex-col items-center justify-center flex-1 py-3 gap-1 transition-colors ${isActive ? 'text-ink [&>svg]:fill-ink' : 'text-muted hover:text-ink'}`}>
                {({isActive}) => (<>
                  {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-ink" aria-hidden="true" />}
                  <Compass size={22} />
                  <span className="font-sans text-[10px] font-medium tracking-wide">Today</span>
                </>)}
              </NavLink>
              <NavLink to="/modules" className={({isActive}) => `relative flex flex-col items-center justify-center flex-1 py-3 gap-1 transition-colors ${isActive ? 'text-ink [&>svg]:fill-ink' : 'text-muted hover:text-ink'}`}>
                {({isActive}) => (<>
                  {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-ink" aria-hidden="true" />}
                  <Layers size={22} />
                  <span className="font-sans text-[10px] font-medium tracking-wide">Bank</span>
                </>)}
              </NavLink>
              <NavLink to="/mock-exams" className={({isActive}) => `relative flex flex-col items-center justify-center flex-1 py-3 gap-1 transition-colors ${isActive ? 'text-ink [&>svg]:fill-ink' : 'text-muted hover:text-ink'}`}>
                {({isActive}) => (<>
                  {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-ink" aria-hidden="true" />}
                  <LayoutGrid size={22} />
                  <span className="font-sans text-[10px] font-medium tracking-wide">Mock</span>
                </>)}
              </NavLink>
              <NavLink to="/topic/a320-systems" className={({isActive}) => `relative flex flex-col items-center justify-center flex-1 py-3 gap-1 transition-colors ${isActive ? 'text-ink [&>svg]:fill-ink' : 'text-muted hover:text-ink'}`}>
                {({isActive}) => (<>
                  {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-ink" aria-hidden="true" />}
                  <Plane size={22} />
                  <span className="font-sans text-[10px] font-medium tracking-wide">A320</span>
                </>)}
              </NavLink>
              <NavLink to="/analytics" className={({isActive}) => `relative flex flex-col items-center justify-center flex-1 py-3 gap-1 transition-colors ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                {({isActive}) => (<>
                  {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-ink" aria-hidden="true" />}
                  <BarChart3 size={22} className={isActive ? 'stroke-[2.5px]' : ''} />
                  <span className="font-sans text-[10px] font-medium tracking-wide">Stats</span>
                </>)}
              </NavLink>
            </nav>

          </div>
        </div>
  );
}
