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

export function CustomDropdown({ value, options, onChange }: { value: string, options: { value: string, label: string }[], onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label || value;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-36" onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsOpen(false);
        }
    }}>
      <div 
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="flex items-center justify-between bg-bg border border-rule rounded-md text-ink px-4 py-3 cursor-pointer select-none font-mono text-xs shadow-sm hover:bg-rule/30 transition-all focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy"
        aria-label={`Select option, current is ${selectedLabel}`}
      >
        <span className="uppercase tracking-wider">{selectedLabel}</span>
        <ChevronDown size={14} className="text-muted ml-3" />
      </div>
      {isOpen && (
        <div 
          role="listbox"
          className="absolute top-full right-0 mt-1.5 bg-paper border border-rule rounded-md shadow-md z-10 w-full overflow-hidden"
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              tabIndex={0}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                }
              }}
              className="px-4 py-2.5 text-sm font-sans flex items-center justify-between cursor-pointer hover:bg-[#FDFCF8] dark:hover:bg-bg-2 text-ink transition-colors focus:bg-[#FDFCF8] dark:focus:bg-bg-2 focus:outline-none"
            >
              <span className="capitalize">{opt.label}</span>
              {value === opt.value && <Check size={14} className="text-ink ml-4" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
