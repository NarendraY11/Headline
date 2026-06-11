import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type FlagKeys = "aiExplain" | "aiCoach" | "aiDiagnosis" | "aiPractice" | "weatherBriefing" | "mockExams" | "topicPractice" | "qotd" | "spacedRepetition" | "flashcards" | "cockpitLayouts" | "analytics" | "masteryCharts" | "blog" | "examSeoPages" | "a320Systems" | "adsense" | "pricingCheckout" | "freeTrial" | "proGating" | "maintenanceMode" | "cookieConsent" | "announcementBanner" | "announcementText" | "signupsOpen" | "themeToggle" | "vivaPractice" | "referralProgram" | "notifications" | "bookmarksEnabled" | "searchEnabled" | "leaderboard" | "offlineMode" | "pwaInstallPrompt" | "aiStudyScheduler" | "masterySnapshots" | "examReadinessDashboard" | "sm2Algorithm";

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
};

const FeatureFlagsContext = createContext<{ flags: Flags; loading: boolean }>({ flags: defaultFlags, loading: true });

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

  return <FeatureFlagsContext.Provider value={{ flags, loading }}>{children}</FeatureFlagsContext.Provider>;
};

export const useFeature = (key: FlagKeys) => {
  const { flags } = useContext(FeatureFlagsContext);
  return flags[key];
};

export const useFeatureFlags = () => useContext(FeatureFlagsContext);
