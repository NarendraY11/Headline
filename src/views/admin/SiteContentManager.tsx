import { Eye, EyeOff, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/Atoms";
import { Spinner } from "../../components/Spinner";
import { useToast } from "../../components/ui/Toast";
import { supabase } from "../../lib/supabase";

interface SiteContent {
  hero_headline: string;
  hero_subheadline: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  stats_question_count_label: string;
  stats_subjects_label: string;
  stats_pilots_label: string;
  [key: string]: string;
}

const DEFAULT_CONTENT: SiteContent = {
  hero_headline: "Ace Your Pilot Theory Exams",
  hero_subheadline: "Syllabus-aligned preparation for DGCA CPL, ATPL, EASA, and A320 Type Rating. Realistic mock exams, adaptive practice, and AI-powered coaching.",
  hero_cta_primary: "Start studying",
  hero_cta_secondary: "Sign in",
  stats_question_count_label: "Questions in bank",
  stats_subjects_label: "Subjects covered",
  stats_pilots_label: "Active pilots",
};

const FIELDS: { key: string; label: string; description: string; multiline?: boolean }[] = [
  { key: "hero_headline", label: "Hero Headline", description: "Main H1 shown above the fold", multiline: false },
  { key: "hero_subheadline", label: "Hero Sub-headline", description: "Supporting paragraph under the headline", multiline: true },
  { key: "hero_cta_primary", label: "Primary CTA Button", description: 'e.g. "Start studying"' },
  { key: "hero_cta_secondary", label: "Secondary CTA Button", description: 'e.g. "Sign in"' },
  { key: "stats_question_count_label", label: "Stats: Question count label", description: "Label below the question count stat" },
  { key: "stats_subjects_label", label: "Stats: Subjects label", description: "Label below the subject count stat" },
  { key: "stats_pilots_label", label: "Stats: Active pilots label", description: "Label below the pilot count stat" },
];

export default function SiteContentManager() {
  const [content, setContent] = useState<SiteContent>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("site_content").eq("id", 1).single();
      if (data?.site_content && Object.keys(data.site_content).length > 0) {
        setContent({ ...DEFAULT_CONTENT, ...data.site_content });
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleChange = (key: string, value: string) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({ id: 1, site_content: content });
    setSaving(false);
    if (error) {
      showToast({ type: "error", title: "Save failed", message: error.message });
    } else {
      showToast({ type: "success", title: "Content saved", message: "Landing page will reflect changes on next visit." });
    }
  };

  if (loading) return <Spinner label="Loading site content" />;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif text-ink tracking-tight mb-1">Site Content</h1>
          <p className="text-sm text-muted font-sans">
            Edit landing page text. Preview updates live as you type.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPreview ? "Hide preview" : "Show preview"}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className={`grid gap-8 ${showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-2xl"}`}>
        {/* Editor panel */}
        <div className="space-y-5">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-semibold text-ink font-sans mb-0.5">{field.label}</label>
              <p className="text-[11px] text-muted-2 mb-1.5">{field.description}</p>
              {field.multiline ? (
                <textarea
                  rows={3}
                  value={content[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="w-full text-sm bg-bg border border-rule-strong rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={content[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="w-full text-sm bg-bg border border-rule-strong rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink"
                />
              )}
            </div>
          ))}
        </div>

        {/* Live preview panel */}
        {showPreview && (
          <div className="sticky top-6 self-start">
            <div className="text-[10px] font-mono text-muted-2 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Eye size={11} /> Live preview
            </div>
            <div className="rounded-xl overflow-hidden border border-rule-strong shadow-sm bg-[#f5f2ea]">
              {/* Mock hero */}
              <div className="p-6 bg-gradient-to-br from-[#f3eee0] to-[#ede8dc]">
                <div className="text-[10px] font-mono text-muted-2 uppercase tracking-[0.2em] mb-3">HEADLINE</div>
                <h2 className="font-serif text-2xl text-[#0f1e3c] leading-tight mb-3 tracking-tight">
                  {content.hero_headline || <span className="text-muted-2 italic">Empty</span>}
                </h2>
                <p className="font-sans text-sm text-[#4a5568] font-light leading-relaxed mb-4">
                  {content.hero_subheadline || <span className="text-muted-2 italic">Empty</span>}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <div className="px-4 py-2 bg-[#0f1e3c] text-[#f5f2ea] text-[12px] font-sans font-medium rounded-full">
                    {content.hero_cta_primary || "—"}
                  </div>
                  <div className="px-4 py-2 border border-[#0f1e3c]/30 text-[#0f1e3c] text-[12px] font-sans font-medium rounded-full">
                    {content.hero_cta_secondary || "—"}
                  </div>
                </div>
              </div>

              {/* Mock stats */}
              <div className="grid grid-cols-3 border-t border-rule/30 bg-[#f8f5ed]">
                {[
                  { count: "6,940+", label: content.stats_question_count_label },
                  { count: "28", label: content.stats_subjects_label },
                  { count: "230+", label: content.stats_pilots_label },
                ].map((stat) => (
                  <div key={stat.label} className="p-4 text-center border-r border-rule/30 last:border-r-0">
                    <div className="font-serif text-lg text-[#0f1e3c] font-bold">{stat.count}</div>
                    <div className="font-sans text-[10px] text-[#6b7280] leading-tight mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-muted-2 font-sans mt-2">
              This is a simplified preview. Visit the live site to see full rendering.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
