import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type FlagKeys = "aiExplain" | "aiCoach" | "aiDiagnosis" | "aiPractice" | "weatherBriefing" | "mockExams" | "topicPractice" | "qotd" | "spacedRepetition" | "flashcards" | "cockpitLayouts" | "analytics" | "masteryCharts" | "blog" | "examSeoPages" | "a320Systems" | "adsense" | "pricingCheckout" | "freeTrial" | "proGating" | "maintenanceMode" | "cookieConsent" | "announcementBanner" | "announcementText" | "signupsOpen" | "themeToggle" | "vivaPractice" | "referralProgram" | "notifications" | "bookmarksEnabled" | "searchEnabled" | "leaderboard" | "offlineMode" | "pwaInstallPrompt" | "aiStudyScheduler" | "masterySnapshots" | "examReadinessDashboard" | "sm2Algorithm" | "adaptiveRegen" | "masteryAnalytics" | "missionScores" | "sm2QualityTiming" | "coachContextEnrichment" | "examReadinessEta" | "predictiveIntelligence" | "advancedTesting" | "pwaEnhanced" | "offlineMissions" | "pushNotifications" | "calendarSync" | "missionEngine";

export type Flags = Record<FlagKeys, any>;

export const defaultFlags: Flags = {
  aiExplain: true,
  aiCoach: true,
  aiDiagnosis: true,
  aiPractice: true,
  weatherBriefing: true,
  mockExams: true,
  topicPractice: true,
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
  vivaPractice: true,
  referralProgram: true,
  notifications: true,
  bookmarksEnabled: true,
  searchEnabled: true,
  leaderboard: false,
  offlineMode: true,
  pwaInstallPrompt: true,
  aiStudyScheduler: false,
  masterySnapshots: false,      // M8A: adaptive mastery engine (OFF until migration applied)
  examReadinessDashboard: false, // M8B: exam readiness gauge + subject ranking (OFF by default)
  sm2Algorithm: false,           // M8C: full SM-2 spaced repetition (gradual rollout 5→50→100%)
  adaptiveRegen: false,          // M8D: adaptive regeneration engine (OFF by default)
  masteryAnalytics: false,       // M8E: mastery heatmap + trend graph (pro users only, OFF by default)
  missionScores: false,          // M9A: score chip on completed missions
  sm2QualityTiming: false,       // M9B: response time → quality 3/5 in SM-2
  coachContextEnrichment: false, // M9C: mission rate + streak sent to coach on regen
  examReadinessEta: false,       // M9D: velocity + ETA projection in readiness gauge
  predictiveIntelligence: false, // M11: pass probability + subject risk + success forecast
  advancedTesting: false,        // M12: adaptive mocks, DGCA simulator, mistake analysis
  pwaEnhanced: false,            // M13: enhanced PWA install + shortcuts
  offlineMissions: false,        // M13: cache missions to localStorage for offline
  pushNotifications: false,      // M13: VAPID push subscription + reminders
  calendarSync: false,           // M13: ICS export + Google/Outlook/Apple calendar sync
  missionEngine: false,          // Phase 6: deterministic Mission Activation Engine (OFF until verified in prod)
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
