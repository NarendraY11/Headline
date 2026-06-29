import {
    BookOpen,
    ChevronDown,
    GraduationCap,
    LayoutGrid,
    Menu,
    MoveRight,
    Plane,
    X
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useOutlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Wordmark } from "../Atoms";
import { ErrorBoundary } from "../ErrorBoundary";

import { DarkModeToggle } from './DarkModeToggle';
import { LoadingFallback } from './LoadingFallback';
import { PageTransition } from './PageTransition';

const RESOURCES = [
  { label: "Blog", to: "/blog", icon: BookOpen, desc: "Exam guides & theory articles" },
  { label: "DGCA CPL", to: "/exams/dgca-cpl", icon: GraduationCap, desc: "CPL prep & mock papers" },
  { label: "EASA ATPL", to: "/exams/easa-atpl", icon: LayoutGrid, desc: "14-subject ATPL prep" },
  { label: "A320 Systems", to: "/a320-systems", icon: Plane, desc: "ATA chapters & ECAM logic" },
];

export function PublicLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const resourcesRef = useRef<HTMLDivElement>(null);
  const { user, openAuthModal } = useAuth();

  useEffect(() => {
    setMobileMenuOpen(false);
    setResourcesOpen(false);
  }, [location.pathname]);

  // Close Resources dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (resourcesRef.current && !resourcesRef.current.contains(e.target as Node)) {
        setResourcesOpen(false);
      }
    }
    if (resourcesOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [resourcesOpen]);

  // Close Resources dropdown on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setResourcesOpen(false);
    }
    if (resourcesOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [resourcesOpen]);

  return (
    <div className="min-h-screen flex flex-col items-stretch overflow-y-auto no-scrollbar font-sans" style={{ height: "100dvh" }}>
      <a href="#public-main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-navy focus:text-bg focus:rounded-md focus:text-sm focus:font-sans focus:outline-none">
        Skip to main content
      </a>
      {location.pathname !== '/' && (
      <header className="h-[calc(64px+var(--sat))] pt-[var(--sat)] border-b border-rule flex items-center justify-between px-4 md:px-6 bg-bg/95 backdrop-blur-md sticky top-0 z-50 flex-shrink-0">
        <Link
          to="/"
          className="hover:opacity-90 transition-opacity flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60 rounded-sm"
        >
          <Wordmark compassSize={26} />
          <span className="font-mono text-[9px] text-muted-2 tracking-widest uppercase md:hidden border border-rule px-1 rounded-sm mt-0.5">FL</span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Primary navigation">
          {/* Resources progressive disclosure dropdown */}
          <div ref={resourcesRef} className="relative hidden md:block">
            <button
              onClick={() => setResourcesOpen(!resourcesOpen)}
              aria-haspopup="true"
              aria-expanded={resourcesOpen}
              className="flex items-center gap-1 text-sm font-sans text-muted hover:text-ink px-3 py-2 rounded-md hover:bg-bg-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60"
            >
              Resources
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${resourcesOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {resourcesOpen && (
              <div
                role="menu"
                className="absolute top-full left-0 mt-2 w-64 bg-paper border border-rule rounded-xl shadow-lg py-2 z-50 animate-[fadeIn_0.15s_ease-out]"
              >
                {RESOURCES.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    className="flex items-start gap-3 px-4 py-3 hover:bg-bg-2 active:bg-panel transition-colors focus-visible:outline-none focus-visible:bg-bg-2 group"
                  >
                    <item.icon size={16} className="text-navy mt-0.5 flex-shrink-0 group-hover:text-ink transition-colors" aria-hidden="true" />
                    <div>
                      <span className="block text-sm font-medium text-ink group-hover:text-navy transition-colors">{item.label}</span>
                      <span className="block text-[11px] text-muted leading-snug">{item.desc}</span>
                    </div>
                  </Link>
                ))}
                <div className="border-t border-rule mt-2 pt-2 px-4 pb-1">
                  <Link
                    to="/pricing"
                    role="menuitem"
                    className="flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-wider text-navy hover:text-navy-strong font-semibold focus-visible:outline-none focus-visible:underline"
                  >
                    View Pricing <MoveRight size={12} />
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            to="/about"
            className="text-sm font-sans text-muted hover:text-ink hidden md:block px-3 py-2 rounded-md hover:bg-bg-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60"
          >
            Mission
          </Link>

          {!user ? (
            <button
              onClick={() => openAuthModal("signin")}
              className="text-sm font-sans text-muted hover:text-ink hidden md:block px-3 py-2 rounded-md hover:bg-bg-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60"
            >
              Sign in
            </button>
          ) : (
            <Link
              to="/today"
              className="text-sm font-sans text-muted hover:text-ink hidden md:block px-3 py-2 rounded-md hover:bg-bg-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60"
            >
              Dashboard
            </Link>
          )}

          <Link to="/modules" className="hidden md:block ml-1">
            <Button
              variant="primary"
              className="h-[40px] px-4 text-xs font-sans font-semibold border-0 focus-visible:ring-2 focus-visible:ring-navy/60 focus-visible:ring-offset-2"
            >
              Start studying
            </Button>
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 md:hidden text-ink hover:bg-panel rounded-full border border-transparent hover:border-rule transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-nav"
          >
            {mobileMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </nav>
      </header>
      )}

      {/* MOBILE MENU NAV DRAWER */}
      {mobileMenuOpen && (
        <div
          id="public-mobile-nav"
          role="navigation"
          aria-label="Mobile navigation"
          className="anim-drawer fixed inset-0 z-40 top-[calc(64px+var(--sat))] bg-bg/95 backdrop-blur-xl border-b border-rule flex flex-col overflow-y-auto pb-safe md:hidden"
          style={{ height: 'calc(100dvh - 64px - var(--sat))' }}
        >
          <nav className="flex flex-col p-4 w-full gap-1 mt-4 font-sans text-base">
            <NavLink
              to="/about"
              className="py-3 px-4 rounded-lg border border-transparent hover:bg-bg-2 active:bg-panel transition-colors flex justify-between items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60"
            >
              Mission Specs <MoveRight size={16} className="text-muted" aria-hidden="true" />
            </NavLink>

            <NavLink
              to="/pricing"
              className="py-3 px-4 rounded-lg border border-transparent hover:bg-bg-2 active:bg-panel transition-colors flex justify-between items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60"
            >
              Pricing <MoveRight size={16} className="text-muted" aria-hidden="true" />
            </NavLink>

            {/* Resources section (flat in mobile — no nested dropdown needed) */}
            <p className="px-4 pt-4 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-2">Resources</p>
            {RESOURCES.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="py-3 px-4 rounded-lg border border-transparent hover:bg-bg-2 active:bg-panel transition-colors flex justify-between items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60"
              >
                <span className="flex items-center gap-2.5">
                  <item.icon size={16} className="text-navy" aria-hidden="true" />
                  {item.label}
                </span>
                <MoveRight size={16} className="text-muted" aria-hidden="true" />
              </NavLink>
            ))}

            <NavLink
              to="/modules"
              className="py-3 px-4 rounded-lg border border-transparent hover:bg-bg-2 active:bg-panel transition-colors flex justify-between items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60"
            >
              Study Modules <MoveRight size={16} className="text-muted" aria-hidden="true" />
            </NavLink>

            {!user ? (
              <button
                onClick={() => { setMobileMenuOpen(false); openAuthModal("signin"); }}
                className="py-3 px-4 rounded-lg border border-transparent hover:bg-bg-2 active:bg-panel transition-colors flex justify-between items-center w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60"
              >
                Sign In <MoveRight size={16} className="text-muted" aria-hidden="true" />
              </button>
            ) : (
              <NavLink
                to="/today"
                className="py-3 px-4 rounded-lg border border-transparent hover:bg-bg-2 active:bg-panel transition-colors flex justify-between items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60"
              >
                Dashboard <MoveRight size={16} className="text-muted" aria-hidden="true" />
              </NavLink>
            )}

            <div className="mt-6 px-4 flex justify-between items-center text-sm border-t border-rule pt-4">
              <span className="text-muted">Display Mode</span>
              <DarkModeToggle />
            </div>
          </nav>
        </div>
      )}

      <main id="public-main-content" className="flex-1 w-full bg-bg text-ink shrink-0 relative flex flex-col">
        <Suspense fallback={<LoadingFallback />}>
          <PageTransition keyId={location.pathname}>
            <ErrorBoundary>
              {outlet}
            </ErrorBoundary>
          </PageTransition>
        </Suspense>
      </main>

      <footer
        className="border-t border-rule pt-12 pb-[calc(3rem+var(--sab))] px-6 mt-12 shrink-0"
        style={{ backgroundColor: "var(--bg-2)", borderColor: "var(--rule)" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-3">
            <Wordmark compassSize={24} />
            <p className="footnote text-[10px] text-muted-2">
              © {new Date().getFullYear()} HEADING EDITORIAL AVIATION. ALL RIGHTS RESERVED.
            </p>
          </div>
          <div className="flex flex-wrap gap-5 md:gap-7">
            <Link to="/about" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:underline">Mission Specs</Link>
            <Link to="/privacy" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:underline">Privacy Policy</Link>
            <Link to="/terms" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:underline">Terms & Conditions</Link>
            <Link to="/refund" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:underline">Refund Policy</Link>
            <Link to="/contact" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:underline">Contact Us</Link>
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="footnote hover:text-ink transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:underline">Sitemap</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
