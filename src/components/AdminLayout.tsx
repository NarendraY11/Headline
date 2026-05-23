import React, { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Wordmark } from "./branding/Wordmark";
import { LayoutDashboard, BookOpen, Layers, HelpCircle, UploadCloud, Users, Settings, LogOut, Menu, X, ArrowLeft } from "lucide-react";

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { label: "Subjects Manager", path: "/admin/subjects", icon: BookOpen },
    { label: "Subcategories", path: "/admin/subcategories", icon: Layers },
    { label: "Questions Catalog", path: "/admin/questions", icon: HelpCircle },
    { label: "Bulk Importer", path: "/admin/import", icon: UploadCloud },
    { label: "Student cohorts", path: "/admin/users", icon: Users },
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

  return (
    <div className="min-h-screen flex bg-[#fbfaf6] text-ink font-sans">
      {/* Sidebar for Desktop / Large displays */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-white border-r border-rule shrink-0 relative z-10 select-none">
        {/* Brand Header */}
        <div className="h-[64px] border-b border-rule flex items-center px-6 shrink-0 justify-between">
          <Wordmark />
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="font-mono text-[8.5px] text-muted uppercase tracking-widest px-3 mb-2 font-bold">
            Administrative Deck
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/admin"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 h-10 rounded-lg text-xs font-medium uppercase font-mono tracking-wider transition-colors select-none ${
                    isActive
                      ? "bg-ink text-bg font-semibold"
                      : "text-muted hover:text-ink hover:bg-bg-2"
                  }`
                }
              >
                <Icon size={14} className="shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-rule space-y-2 bg-bg-2/30">
          <div className="px-3 py-2 bg-white border border-rule rounded-lg mb-2">
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
            className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 font-mono uppercase tracking-wide transition-colors cursor-pointer select-none"
          >
            <LogOut size={13} />
            <span>Sign logout</span>
          </button>
        </div>
      </aside>

      {/* Small displays / Mobile Layout top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-[64px] border-b border-rule flex items-center justify-between px-6 bg-white shrink-0">
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
          <div className="lg:hidden fixed inset-0 top-[64px] z-50 bg-[#fbfaf6] border-b border-rule flex flex-col p-4 animate-fadeIn select-none">
            <nav className="space-y-1.5 flex-1 overflow-y-auto">
              <div className="font-mono text-[8.5px] text-muted uppercase tracking-widest px-3 mb-2 font-bold">
                Administrative Deck
              </div>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/admin"}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 h-10 rounded-lg text-xs font-medium uppercase font-mono tracking-wider transition-colors ${
                        isActive
                          ? "bg-ink text-bg font-semibold"
                          : "text-muted hover:text-ink hover:bg-bg-2"
                      }`
                    }
                  >
                    <Icon size={14} className="shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="border-t border-rule pt-4 space-y-2 bg-white/20 p-2 rounded-xl mt-4">
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
                className="w-full flex items-center gap-2 px-3 h-9 text-xs font-semibold text-rose-600 hover:bg-rose-50 font-mono uppercase tracking-wide transition-colors"
              >
                <LogOut size={13} />
                <span>Sign Out Account</span>
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
