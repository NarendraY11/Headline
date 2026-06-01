import type { FlagKeys } from "../../hooks/useFeatureFlags";

export type FeatureMediaType = "image" | "video";

export interface FeatureMedia {
  /** Public-folder path to the preview asset. */
  src: string;
  /** "image" covers png/jpg/gif; "video" covers mp4/webm. */
  type: FeatureMediaType;
  /** Short caption rendered under the preview. */
  caption: string;
}

// Convention: drop preview assets in `public/feature-previews/<key>.<ext>`.
// A .gif/.png/.jpg is treated as an image; an .mp4/.webm as a video.
// Missing assets fall back to a styled placeholder automatically, so this
// map only needs an entry where a custom path/type/caption is wanted.
const PREVIEW_DIR = "/feature-previews";

const captions: Partial<Record<FlagKeys, string>> = {
  aiExplain: "AI-written answer explanation appearing inside a mock exam.",
  aiCoach: "Weak-area study plan generated on the dashboard.",
  aiDiagnosis: "Diagnostic summary synthesized in the Analytics view.",
  aiPractice: "AI generating fresh practice questions for an ATA chapter.",
  weatherBriefing: "Raw METAR parsed into a plain-language briefing.",
  mockExams: "The mock exams catalog users land on.",
  topicPractice: "Free topic/module practice navigation.",
  qotd: "The Question-of-the-Day challenge card.",
  spacedRepetition: "Smart review queue surfacing due weak areas.",
  a320Systems: "Interactive A320 system schematic study view.",
  flashcards: "Flashcard alternate exam layout.",
  cockpitLayouts: "Cockpit / instrument alternate exam layout.",
  themeToggle: "Light/dark theme switch in the header.",
  cookieConsent: "GDPR cookie consent banner.",
  maintenanceMode: "Lockout screen shown to non-admins.",
  signupsOpen: "Sign-up form availability on the auth modal.",
  proGating: "Pro lock overlays on premium features.",
  pricingCheckout: "Pricing page and checkout flow.",
  freeTrial: "Free-trial activation banner and flow.",
  adsense: "Ad slots placed throughout the UI.",
  analytics: "User-facing performance analytics dashboard.",
  masteryCharts: "Subject mastery and progress charts.",
  blog: "Blog / CMS article pages.",
  examSeoPages: "Public exam promotional SEO pages.",
  announcementBanner: "Site-wide announcement bar at the top of every page.",
};

const explicitType: Partial<Record<FlagKeys, FeatureMediaType>> = {
  // Override here when a preview is provided as a video instead of a gif.
  // e.g. aiPractice: "video",
};

export function getFeatureMedia(key: FlagKeys): FeatureMedia {
  const type = explicitType[key] ?? "image";
  const ext = type === "video" ? "mp4" : "gif";
  return {
    src: `${PREVIEW_DIR}/${key}.${ext}`,
    type,
    caption: captions[key] ?? "Preview of what toggling this feature changes.",
  };
}
