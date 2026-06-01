import { AlertTriangle, PowerOff, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/Atoms";
import { useToast } from "../../components/ui/Toast";
import { defaultFlags, FlagKeys, Flags } from "../../hooks/useFeatureFlags";
import { supabase } from "../../lib/supabase";

export default function FeatureControl() {
  const [flags, setFlags] = useState<Flags>(defaultFlags);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const renderToggle = (key: FlagKeys, label: string, description?: string) => (
    <div className="flex items-center justify-between p-4 bg-paper border border-rule-strong rounded-lg mb-3">
      <div>
        <h4 className="text-sm font-semibold text-ink font-sans">{label}</h4>
        {description && <p className="text-[11px] text-muted-2 mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          role="switch"
          className="sr-only peer" 
          checked={flags[key] as boolean} 
          onChange={(e) => handleChange(key, e.target.checked)} 
        />
        <div className="w-11 h-6 bg-rule peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
      </label>
    </div>
  );

  if (loading) {
    return <div className="p-8 text-muted-2">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-serif text-ink tracking-tight mb-2">Feature Control</h1>
          <p className="text-muted text-sm font-sans">
            Globally enable or disable app features. Disabled features will immediately hide from the UI and reject API requests.
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
          {renderToggle("qotd", "Question of the Day", "Daily question challenge section.")}
          {renderToggle("spacedRepetition", "Spaced Repetition", "Smart review and weak-area algorithm.")}
          {renderToggle("a320Systems", "A320 Systems", "Technical system diagram study (Interactive).")}
        </section>

        <section>
          <h2 className="text-lg font-serif text-ink mb-4 border-b border-rule pb-2">UI/UX & System</h2>
          {renderToggle("flashcards", "Flashcard Layout", "Exam alternate view.")}
          {renderToggle("cockpitLayouts", "Cockpit/Instrument Layouts", "Exam alternate view.")}
          {renderToggle("themeToggle", "Dark Mode Toggle", "Allow users to switch between light/dark themes.")}
          {renderToggle("cookieConsent", "Cookie Consent Banner", "Show the EU GDPR cookie acceptance.")}
          {renderToggle("maintenanceMode", "Maintenance Mode", "Locks out non-admins from using the app entirely.")}
          {renderToggle("signupsOpen", "Signups Open", "Toggle to restrict new sign ups (creates).")}
        </section>

        <section>
          <h2 className="text-lg font-serif text-ink mb-4 border-b border-rule pb-2">Monetization & Growth</h2>
          {renderToggle("proGating", "Pro Gating", "If disabled, ALL users get premium features (skips auth check).")}
          {renderToggle("pricingCheckout", "Pricing/Checkout", "Allows people to buy lifetime or subscribing.")}
          {renderToggle("freeTrial", "Free Trial", "Enable the 3-day free trial system.")}
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
    </div>
  );
}
