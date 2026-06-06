import { AlertTriangle, Eye, ImageOff, PowerOff, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/Atoms";
import { useToast } from "../../components/ui/Toast";
import { defaultFlags, FlagKeys, Flags } from "../../hooks/useFeatureFlags";
import { supabase } from "../../lib/supabase";
import { Spinner } from "../../components/Spinner";
import { getFeatureMedia } from "./featureMedia";

interface HoverState {
  key: FlagKeys;
  label: string;
  caption: string;
  x: number;
  y: number;
}

// Floating preview that follows the cursor. Tries to load the feature's
// preview asset; if it is missing, shows a styled placeholder telling the
// admin where to drop the file.
function FeaturePreview({ hover }: { hover: HoverState }) {
  const media = getFeatureMedia(hover.key);
  const [failed, setFailed] = useState(false);

  // Reset the error state whenever the hovered feature changes.
  useEffect(() => setFailed(false), [hover.key]);

  const PANEL_W = 340;
  const PANEL_H = 280;
  const left = Math.min(hover.x + 24, window.innerWidth - PANEL_W - 12);
  const top = Math.min(hover.y + 24, window.innerHeight - PANEL_H - 12);

  return (
    <div
      className="fixed z-[1000] pointer-events-none rounded-xl border border-rule-strong bg-paper shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ left, top, width: PANEL_W }}
    >
      <div className="px-3 py-2 border-b border-rule/60 bg-bg-2/60 flex items-center gap-1.5">
        <Eye size={13} className="text-ink" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 truncate">
          {hover.label}
        </span>
      </div>

      <div className="w-full h-[190px] bg-bg-2 flex items-center justify-center">
        {failed ? (
          <div className="flex flex-col items-center justify-center text-center px-4">
            <ImageOff size={22} className="text-muted-2 mb-2" />
            <p className="font-sans text-[11px] text-muted-2">No preview asset yet.</p>
            <p className="font-mono text-[9px] text-muted-2/70 mt-1 break-all">
              add <span className="text-ink">public{media.src}</span>
            </p>
          </div>
        ) : media.type === "video" ? (
          <video
            src={media.src}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={media.src}
            alt={`${hover.label} preview`}
            onError={() => setFailed(true)}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <p className="px-3 py-2.5 text-[11px] leading-snug text-muted font-sans">{media.caption}</p>
    </div>
  );
}

export default function FeatureControl() {
  const [flags, setFlags] = useState<Flags>(defaultFlags);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hover, setHover] = useState<HoverState | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    const { data, error } = await supabase.from("app_settings").select("flags").eq("id", 1).single();
    if (error) {
      console.error("Error fetching flags:", error);
    } else if (data?.flags) {
      setFlags({ ...defaultFlags, ...data.flags });
    }
    setLoading(false);
  };

  const handleChange = (key: FlagKeys, value: boolean | string) => {
    setFlags((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAllAi = (status: boolean) => {
    setFlags(prev => ({
      ...prev,
      aiExplain: status,
      aiCoach: status,
      aiDiagnosis: status,
      aiPractice: status,
      weatherBriefing: status
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({ id: 1, flags });
    setSaving(false);
    if (error) {
      showToast({ type: "error", title: "Save Failed", message: error.message });
    } else {
      showToast({ type: "success", title: "Saved successfully", message: "Feature flags updated." });
    }
  };

  const renderToggle = (key: FlagKeys, label: string, description?: string) => {
    const on = flags[key] as boolean;
    return (
      <div
        onMouseEnter={(e) => setHover({ key, label, caption: "", x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setHover((h) => (h && h.key === key ? { ...h, x: e.clientX, y: e.clientY } : h))}
        onMouseLeave={() => setHover((h) => (h && h.key === key ? null : h))}
        className="group flex items-center justify-between gap-3 p-4 bg-paper border border-rule-strong rounded-lg mb-3 transition-all hover:border-ink/40 hover:shadow-md cursor-help"
      >
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-ink font-sans flex items-center gap-1.5">
            {label}
            <Eye size={12} className="text-muted-2 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h4>
          {description && <p className="text-[11px] text-muted-2 mt-0.5">{description}</p>}
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            role="switch"
            aria-label={label}
            className="sr-only peer"
            checked={on}
            onChange={(e) => handleChange(key, e.target.checked)}
          />
          <div className="w-11 h-6 bg-rule peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
        </label>
      </div>
    );
  };

  if (loading) {
    return <Spinner label="Loading feature flags" />;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-serif text-ink tracking-tight mb-2">Feature Control</h1>
          <p className="text-muted text-sm font-sans">
            Globally enable or disable app features. Disabled features will immediately hide from the UI and reject API requests.
          </p>
          <p className="text-[11px] text-muted-2 mt-1.5 flex items-center gap-1.5">
            <Eye size={13} className="text-ink" /> Hover any feature to preview what it changes.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => toggleAllAi(false)} className="text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200">
            <PowerOff size={16} className="mr-2" /> All AI Off (Panic)
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            <Save size={16} className="mr-2" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-serif text-ink mb-4 border-b border-rule pb-2">AI Features (cost-bearing)</h2>
          <p className="text-xs text-amber-600 dark:text-amber-500 mb-4 flex items-center gap-1.5"><AlertTriangle size={14}/> Disabling stops Gemini API spend.</p>
          {renderToggle("aiExplain", "AI Explain (Quiz)", "Explains answers dynamically within mock exams.")}
          {renderToggle("aiCoach", "AI Weak-Area Coach", "Generates performance study plans in Dashboard.")}
          {renderToggle("aiDiagnosis", "AI Analytics Diagnosis", "Synthesizes diagnostic text from user history in Analytics.")}
          {renderToggle("aiPractice", "Topic Practice Generator", "Creates practice questions per ATA chapter using AI.")}
          {renderToggle("weatherBriefing", "Smart Weather Briefing", "Parses METAR lines into a readable AI summary.")}
        </section>

        <section>
          <h2 className="text-lg font-serif text-ink mb-4 border-b border-rule pb-2">Learning Features</h2>
          {renderToggle("mockExams", "Mock Exams", "Toggle the main exams catalog.")}
          {renderToggle("topicPractice", "Topic Practice", "Free practice and module navigation.")}
          {renderToggle("vivaPractice", "VIVA Practice", "Oral exam simulation mode.")}
          {renderToggle("qotd", "Question of the Day", "Daily question challenge section.")}
          {renderToggle("spacedRepetition", "Spaced Repetition", "Smart review and weak-area algorithm.")}
          {renderToggle("a320Systems", "A320 Systems", "Technical system diagram study (Interactive).")}
          {renderToggle("bookmarksEnabled", "Bookmarks & Flashcards", "Allow users to bookmark questions and use flashcard view.")}
          {renderToggle("leaderboard", "Leaderboard", "Show ranked performance leaderboard (beta).")}
        </section>

        <section>
          <h2 className="text-lg font-serif text-ink mb-4 border-b border-rule pb-2">UI/UX & System</h2>
          {renderToggle("flashcards", "Flashcard Layout", "Exam alternate view.")}
          {renderToggle("cockpitLayouts", "Cockpit/Instrument Layouts", "Exam alternate view.")}
          {renderToggle("themeToggle", "Dark Mode Toggle", "Allow users to switch between light/dark themes.")}
          {renderToggle("searchEnabled", "Global Search", "Enable the search overlay across all app content.")}
          {renderToggle("notifications", "Notifications", "Show the notification bell and real-time alerts.")}
          {renderToggle("offlineMode", "Offline Mode (PWA)", "Allow the app to work without internet via service worker cache.")}
          {renderToggle("pwaInstallPrompt", "PWA Install Prompt", "Show the install-to-homescreen banner.")}
          {renderToggle("cookieConsent", "Cookie Consent Banner", "Show the EU GDPR cookie acceptance.")}
          {renderToggle("maintenanceMode", "Maintenance Mode", "Locks out non-admins from using the app entirely.")}
          {renderToggle("signupsOpen", "Signups Open", "Toggle to restrict new sign ups (creates).")}
        </section>

        <section>
          <h2 className="text-lg font-serif text-ink mb-4 border-b border-rule pb-2">Monetization & Growth</h2>
          {renderToggle("proGating", "Pro Gating", "If disabled, ALL users get premium features (skips auth check).")}
          {renderToggle("pricingCheckout", "Pricing/Checkout", "Allows people to buy lifetime or subscribing.")}
          {renderToggle("freeTrial", "Free Trial", "Enable the 3-day free trial system.")}
          {renderToggle("referralProgram", "Referral Program", "Show Refer & Earn section and track referral codes.")}
          {renderToggle("adsense", "Ad placements", "Toggle standard ad slots in the UI.")}
          {renderToggle("analytics", "Analytics Dashboard", "Show users their performance stats.")}
          {renderToggle("masteryCharts", "Mastery Charts", "Show subject and progress details in Stats view.")}
          {renderToggle("blog", "Blog / Content", "Enable the CMS articles.")}
          {renderToggle("examSeoPages", "Exam SEO Pages", "Show the public mock exam promotional pages.")}
        </section>
      </div>

      <section className="bg-bg-2 p-5 border border-rule-strong rounded-xl">
        <h2 className="text-lg font-serif text-ink mb-4">Announcement Banner</h2>
        {renderToggle("announcementBanner", "Show Top Banner", "Display an announcement block across all pages.")}
        <div className="mt-4">
          <label className="block text-sm font-semibold text-ink font-sans mb-1.5">Announcement Text</label>
          <textarea
            className="w-full text-sm bg-bg border border-rule-strong p-3 rounded-md focus:border-ink transition-colors"
            rows={2}
            value={flags.announcementText}
            onChange={(e) => handleChange("announcementText", e.target.value)}
          />
        </div>
      </section>

      {hover && <FeaturePreview hover={hover} />}
    </div>
  );
}
