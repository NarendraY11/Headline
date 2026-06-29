import React, { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Wordmark } from "./branding/Wordmark";
import { LayoutDashboard, BookOpen, Layers, HelpCircle, UploadCloud, Users, Settings, LogOut, Menu, X, ArrowLeft, Activity, ShieldCheck, FileText, SlidersHorizontal, ChevronDown, ChevronRight, Bell, IndianRupee, Globe, UserCog, Bot, Filter, CreditCard, Database, Star, Plane, UserCheck, FileSearch, BarChart3, Import } from "lucide-react";

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);
  const [registryOpen, setRegistryOpen] = useState(false);
  const navigate = useNavigate();

  const mainNavItems = [
    { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { label: "Subjects", path: "/admin/subjects", icon: BookOpen },
    { label: "Exams", path: "/admin/exams", icon: ShieldCheck },
    { label: "Subcategories", path: "/admin/subcategories", icon: Layers },
    { label: "Questions", path: "/admin/questions", icon: HelpCircle },
    { label: "Student Cohorts", path: "/admin/users", icon: Users },
    { label: "Funnel Analytics", path: "/admin/funnel", icon: Filter },
    { label: "Billing", path: "/admin/billing", icon: CreditCard },
    { label: "Notifications", path: "/admin/notifications", icon: Bell },
    { label: "Blog Publisher", path: "/admin/blog", icon: FileText },
  ];

  const contentNavItems = [
    { label: "CMS", path: "/admin/cms", icon: Database },
    { label: "Content Import", path: "/admin/content-import", icon: Import },
    { label: "Content Quality", path: "/admin/content-quality", icon: BarChart3 },
    { label: "Bulk Import (Legacy)", path: "/admin/import", icon: UploadCloud },
  ];

  const registryNavItems = [
    { label: "Registry Hub", path: "/admin/registry", icon: Database },
    { label: "Programs", path: "/admin/registry/programs", icon: Star },
    { label: "Certifications", path: "/admin/registry/certifications", icon: ShieldCheck },
    { label: "Aircraft", path: "/admin/registry/aircraft", icon: Plane },
    { label: "Enrollments", path: "/admin/registry/enrollments", icon: UserCheck },
  ];

  const secondaryNavItems = [
    { label: "Admin Activity", path: "/admin/activity", icon: Activity },
    { label: "Feature Control", path: "/admin/features", icon: SlidersHorizontal },
    { label: "Pricing Manager", path: "/admin/pricing", icon: IndianRupee },
    { label: "Site Content", path: "/admin/site-content", icon: Globe },
    { label: "AI Settings", path: "/admin/ai-settings", icon: Bot },
    { label: "Admin Roles", path: "/admin/roles", icon: UserCog },
    { label: "Admin Settings", path: "/admin/settings", icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const renderNavLinks = (items: typeof mainNavItems) => (
    items.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/admin"}
          onClick={() => setMobileMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 h-10 rounded-lg text-xs font-medium uppercase font-mono tracking-wider transition-colors select-none ${
              isActive
                ? "bg-ink text-paper font-semibold shadow-sm"
                : "text-muted hover:text-ink hover:bg-bg-2"
            }`
          }
        >
          <Icon size={14} className="shrink-0" />
          <span>{item.label}</span>
        </NavLink>
      );
    })
  );

  return (
    <div className="min-h-screen flex bg-bg text-ink font-sans">
      {/* Sidebar for Desktop / Large displays */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-paper border-r border-rule shrink-0 relative z-10 select-none">
        {/* Brand Header */}
        <div className="h-[64px] border-b border-rule flex items-center px-6 shrink-0 justify-between">
          <Wordmark />
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="font-mono text-[8.5px] text-muted-2 uppercase tracking-widest px-3 mb-2 font-bold">
            Administrative Deck
          </div>
          {renderNavLinks(mainNavItems)}

          <div className="pt-2">
            <button
              onClick={() => setContentOpen(!contentOpen)}
              className="flex items-center justify-between w-full px-3 h-10 rounded-lg text-xs font-medium uppercase font-mono tracking-wider text-muted hover:text-ink hover:bg-bg-2 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <Database size={14} className="shrink-0" />
                <span>Content Platform</span>
              </div>
              {contentOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {contentOpen && (
              <div className="mt-1 space-y-1.5 pl-3 border-l-2 border-rule ml-4">
                {renderNavLinks(contentNavItems)}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={() => setRegistryOpen(!registryOpen)}
              className="flex items-center justify-between w-full px-3 h-10 rounded-lg text-xs font-medium uppercase font-mono tracking-wider text-muted hover:text-ink hover:bg-bg-2 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <FileSearch size={14} className="shrink-0" />
                <span>Registry</span>
              </div>
              {registryOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {registryOpen && (
              <div className="mt-1 space-y-1.5 pl-3 border-l-2 border-rule ml-4">
                {renderNavLinks(registryNavItems)}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center justify-between w-full px-3 h-10 rounded-lg text-xs font-medium uppercase font-mono tracking-wider text-muted hover:text-ink hover:bg-bg-2 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <Settings size={14} className="shrink-0" />
                <span>System & Config</span>
              </div>
              {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {advancedOpen && (
              <div className="mt-1 space-y-1.5 pl-3 border-l-2 border-rule ml-4">
                {renderNavLinks(secondaryNavItems)}
              </div>
            )}
          </div>
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-rule space-y-2 bg-bg-2/30">
          <div className="px-3 py-2 bg-paper border border-rule rounded-lg mb-2">
            <div className="font-sans font-semibold text-[11px] text-ink truncate">
              {user?.displayName || "Aviation Admin"}
            </div>
            <div className="font-mono text-[9px] text-muted truncate mt-0.5">
              {user?.email || "admin@heading.aero"}
            </div>
          </div>
          
          <Link
            to="/"
            className="flex items-center gap-2.5 px-3 h-9 rounded-lg text-[11px] font-medium text-ink hover:bg-bg-2 font-mono uppercase tracking-wide transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Student Portal</span>
          </Link>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-mono uppercase tracking-wide transition-colors cursor-pointer select-none"
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Small displays / Mobile Layout top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-[64px] border-b border-rule flex items-center justify-between px-6 bg-paper shrink-0">
          <Wordmark />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 border border-rule hover:bg-bg-2 rounded-lg cursor-pointer"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Mobile Dropdown Menu overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-[64px] z-50 bg-bg border-b border-rule flex flex-col p-4 animate-fadeIn select-none">
            <nav className="space-y-1.5 flex-1 overflow-y-auto">
              <div className="font-mono text-[8.5px] text-muted-2 uppercase tracking-widest px-3 mb-2 font-bold">
                Administrative Deck
              </div>
              {renderNavLinks(mainNavItems)}

              <div className="pt-2">
                <button
                  onClick={() => setContentOpen(!contentOpen)}
                  className="flex items-center justify-between w-full px-3 h-10 rounded-lg text-xs font-medium uppercase font-mono tracking-wider text-muted hover:text-ink hover:bg-bg-2 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <Database size={14} className="shrink-0" />
                    <span>Content Platform</span>
                  </div>
                  {contentOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {contentOpen && (
                  <div className="mt-1 space-y-1.5 pl-3 border-l-2 border-rule ml-4">
                    {renderNavLinks(contentNavItems)}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setRegistryOpen(!registryOpen)}
                  className="flex items-center justify-between w-full px-3 h-10 rounded-lg text-xs font-medium uppercase font-mono tracking-wider text-muted hover:text-ink hover:bg-bg-2 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <FileSearch size={14} className="shrink-0" />
                    <span>Registry</span>
                  </div>
                  {registryOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {registryOpen && (
                  <div className="mt-1 space-y-1.5 pl-3 border-l-2 border-rule ml-4">
                    {renderNavLinks(registryNavItems)}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  className="flex items-center justify-between w-full px-3 h-10 rounded-lg text-xs font-medium uppercase font-mono tracking-wider text-muted hover:text-ink hover:bg-bg-2 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <Settings size={14} className="shrink-0" />
                    <span>System & Config</span>
                  </div>
                  {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {advancedOpen && (
                  <div className="mt-1 space-y-1.5 pl-3 border-l-2 border-rule ml-4">
                    {renderNavLinks(secondaryNavItems)}
                  </div>
                )}
              </div>
            </nav>

            <div className="border-t border-rule pt-4 space-y-2 bg-paper/20 p-2 rounded-xl mt-4 border border-rule/50">
              <div className="px-3 pb-2 border-b border-rule/50 mb-2">
                <div className="font-sans font-semibold text-xs text-ink">
                  {user?.displayName || "Aviation Admin"}
                </div>
                <div className="font-mono text-[9px] text-muted truncate mt-0.5">
                  {user?.email || ""}
                </div>
              </div>
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 h-9 text-xs font-medium text-ink hover:bg-bg-2 font-mono uppercase tracking-wide transition-colors"
              >
                <ArrowLeft size={13} />
                <span>Return to Student Terminal</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 h-9 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-mono uppercase tracking-wide transition-colors"
              >
                <LogOut size={13} />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}

        {/* Core nested admin route content */}
        <main className="flex-grow p-6 lg:p-8 overflow-y-auto w-full max-w-7xl mx-auto min-h-[calc(100vh-64px)] lg:min-h-screen">
          <React.Suspense fallback={
            <div className="h-[250px] flex flex-col items-center justify-center p-8">
              <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-mono text-[10px] text-muted tracking-widest uppercase">Loading Panel...</p>
            </div>
          }>
            <Outlet />
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}
