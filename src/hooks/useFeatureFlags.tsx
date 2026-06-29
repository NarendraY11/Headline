import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type FlagKeys = "aiExplain" | "aiCoach" | "aiDiagnosis" | "aiPractice" | "weatherBriefing" | "mockExams" | "qotd" | "spacedRepetition" | "flashcards" | "cockpitLayouts" | "analytics" | "masteryCharts" | "blog" | "examSeoPages" | "a320Systems" | "adsense" | "pricingCheckout" | "freeTrial" | "proGating" | "maintenanceMode" | "cookieConsent" | "announcementBanner" | "announcementText" | "signupsOpen" | "themeToggle" | "referralProgram" | "notifications" | "bookmarksEnabled" | "searchEnabled" | "leaderboard" | "pwaInstallPrompt" | "aiStudyScheduler" | "masterySnapshots" | "examReadinessDashboard" | "sm2Algorithm" | "adaptiveRegen" | "masteryAnalytics" | "missionScores" | "sm2QualityTiming" | "examReadinessEta" | "predictiveIntelligence" | "advancedTesting" | "pushNotifications" | "calendarSync" | "missionEngine" | "xpSystem" | "contentRegistry" | "learningContext" | "contentCms" | "contentImport" | "contentDeliveryEngine" | "learningHierarchy" | "adaptiveLearning";

export type Flags = Record<FlagKeys, any>;

export const defaultFlags: Flags = {
  aiExplain: true,
  aiCoach: true,
  aiDiagnosis: true,
  aiPractice: true,
  weatherBriefing: true,
  mockExams: true,
  qotd: true,
  spacedRepetition: true,
  flashcards: true,
  cockpitLayouts: true,
  analytics: true,
  masteryCharts: true,
  blog: true,
  examSeoPages: true,
  a320Systems: true,
  adsense: true,
  pricingCheckout: true,
  freeTrial: true,
  proGating: true,
  maintenanceMode: false,
  cookieConsent: true,
  announcementBanner: true,
  announcementText: "Welcome to our platform!",
  signupsOpen: true,
  themeToggle: true,
  referralProgram: true,
  notifications: true,
  bookmarksEnabled: true,
  searchEnabled: true,
  leaderboard: false,
  pwaInstallPrompt: true,
  aiStudyScheduler: false,
  masterySnapshots: false,      // M8A: adaptive mastery engine (OFF until migration applied)
  examReadinessDashboard: false, // M8B: exam readiness gauge + subject ranking (OFF by default)
  sm2Algorithm: false,           // M8C: full SM-2 spaced repetition (gradual rollout 5→50→100%)
  adaptiveRegen: false,          // M8D: adaptive regeneration engine (OFF by default)
  masteryAnalytics: false,       // M8E: mastery heatmap + trend graph (pro users only, OFF by default)
  missionScores: false,          // M9A: score chip on completed missions
  sm2QualityTiming: false,       // M9B: response time → quality 3/5 in SM-2
  examReadinessEta: false,       // M9D: velocity + ETA projection in readiness gauge
  predictiveIntelligence: false, // M11: pass probability + subject risk + success forecast
  advancedTesting: false,        // M12: adaptive mocks, DGCA simulator, mistake analysis
  pushNotifications: false,      // M13: VAPID push subscription + reminders (infra pending)
  calendarSync: false,           // M13: ICS export + Google/Outlook/Apple calendar sync
  missionEngine: false,          // Phase 6: deterministic Mission Activation Engine (OFF until verified in prod)
  xpSystem: false,               // Phase 7.1: XP ledger writes + reads (OFF; history accrues only once ON)
  contentRegistry: false,        // Phase 1: canonical content registry + hidden admin CRUD (OFF until verified)
  learningContext: false,        // Phase 2: learning_profiles + enrollments dual-write + hidden context pages (OFF)
  contentCms: false,             // Phase 3: admin Content CMS (tree/editor/validation/versioning) (OFF; admin-only)
  contentImport: false,          // Phase 4: staged import engine (CSV/JSON→staging→preview→draft) (OFF; admin-only)
  contentDeliveryEngine: false,  // Phase 5: unified content delivery engine — resolveContentScope() wired into all consumers (OFF)
  learningHierarchy: false,      // Phase 8: student learning platform — Cert→Subject→Module→Topic hierarchy, module progress, course page (OFF)
  adaptiveLearning: false,       // Phase 9: adaptive learning engine — priority model, readiness score, study health, exam readiness (OFF; admin-only)
};

export const FeatureFlagsContext = createContext<{ flags: Flags; loading: boolean }>({ flags: defaultFlags, loading: true });

export const FeatureFlagsProvider = ({ children }: { children: React.ReactNode }) => {
  const [flags, setFlags] = useState<Flags>(defaultFlags);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlags = async () => {
      const { data, error } = await supabase.from('app_settings').select('flags').eq('id', 1).single();
      if (!error && data?.flags) {
        setFlags({ ...defaultFlags, ...data.flags });
      }
      setLoading(false);
    };
    fetchFlags();
  }, []);

  const value = useMemo(() => ({ flags, loading }), [flags, loading]);
  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};

export const useFeature = (key: FlagKeys) => {
  const { flags } = useContext(FeatureFlagsContext);
  return flags[key];
};

export const useFeatureFlags = () => useContext(FeatureFlagsContext);
