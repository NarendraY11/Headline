import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Eye, PowerOff, Save } from "lucide-react";
import { PreviewModeProvider } from "../../preview/PreviewModeProvider";
import { usePreviewSelection } from "../../preview/usePreviewMode";
import { usePreviewRenderDiagnostics } from "../../preview/previewDiagnostics";
import { Button } from "../../components/Atoms";
import { AdminBreadcrumb } from "../../components/AdminBreadcrumb";
import { Spinner } from "../../components/Spinner";
import { useToast } from "../../components/ui/Toast";
import { defaultFlags, FlagKeys, Flags } from "../../hooks/useFeatureFlags";
import { supabase } from "../../lib/supabase";
import { FeaturePreviewPanel } from "./FeaturePreviewPanel";
import {
  adminFeatureDefinitions,
  announcementBannerFeature,
  announcementTextFeature,
  type FeatureDefinition,
} from "./featureRegistry";
import { featurePreviewRegistry } from "./featurePreviewRegistry";

interface FeatureControlContentProps {
  flags: Flags;
  saving: boolean;
  onChange: (key: FlagKeys, value: boolean | string) => void;
  onSave: () => Promise<void>;
  onToggleAllAi: (status: boolean) => void;
}

interface FeatureToggleRowProps {
  feature: FeatureDefinition;
  checked: boolean;
  isSelected: boolean;
  onSelect: (feature: FeatureDefinition) => void;
  onToggle: (key: FlagKeys, value: boolean) => void;
}

const FeatureToggleRow = memo(function FeatureToggleRow({
  feature,
  checked,
  isSelected,
  onSelect,
  onToggle,
}: FeatureToggleRowProps) {
  const handleRowSelect = useCallback(() => {
    onSelect(feature);
  }, [feature, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(feature);
      }
    },
    [feature, onSelect]
  );

  const handleToggleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onToggle(feature.key, e.target.checked);
    },
    [feature.key, onToggle]
  );

  return (
    <div
      onClick={handleRowSelect}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      className={`group flex items-center justify-between gap-3 p-4 bg-paper border rounded-lg mb-3 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 ${
        isSelected
          ? "border-ink shadow-md bg-bg-2/40"
          : "border-rule-strong hover:border-ink/40 hover:shadow-md"
      }`}
    >
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-ink font-sans flex items-center gap-1.5">
          {feature.title}
          <Eye
            size={12}
            className={`text-muted-2 transition-opacity ${
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          />
        </h4>
        {feature.description && (
          <p className="text-[11px] text-muted-2 mt-0.5">{feature.description}</p>
        )}
      </div>
      <label
        className="relative inline-flex items-center cursor-pointer shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          role="switch"
          aria-label={feature.title}
          className="sr-only peer"
          checked={checked}
          onChange={handleToggleChange}
        />
        <div className="w-11 h-6 bg-rule peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
      </label>
    </div>
  );
});

interface FeatureSectionProps {
  category: string;
  features: FeatureDefinition[];
  flags: Flags;
  selectedKey: FlagKeys | null;
  onSelect: (feature: FeatureDefinition) => void;
  onToggle: (key: FlagKeys, value: boolean) => void;
}

const FeatureSection = memo(function FeatureSection({
  category,
  features,
  flags,
  selectedKey,
  onSelect,
  onToggle,
}: FeatureSectionProps) {
  return (
    <section>
      <h2 className="text-lg font-serif text-ink mb-4 border-b border-rule pb-2">
        {category}
      </h2>
      {category === "AI Features (cost-bearing)" && (
        <p className="text-xs text-amber-600 dark:text-amber-500 mb-4 flex items-center gap-1.5">
          <AlertTriangle size={14} />
          Disabling stops Gemini API spend.
        </p>
      )}
      {features.map((feature) => (
        <FeatureToggleRow
          key={feature.key}
          feature={feature}
          checked={Boolean(flags[feature.key])}
          isSelected={selectedKey === feature.key}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </section>
  );
});

interface FeatureListProps {
  flags: Flags;
  onChange: (key: FlagKeys, value: boolean | string) => void;
}

const FeatureList = memo(function FeatureList({ flags, onChange }: FeatureListProps) {
  usePreviewRenderDiagnostics("FeatureList");
  const { selectedFeature, selectFeature } = usePreviewSelection();
  const selectedKey = selectedFeature?.key ?? null;

  const handleSelectFeature = useCallback(
    (feature: FeatureDefinition) => {
      selectFeature(feature);
    },
    [selectFeature]
  );

  const handleToggle = useCallback(
    (key: FlagKeys, value: boolean) => {
      onChange(key, value);
    },
    [onChange]
  );

  const sectionProps = useMemo(
    () =>
      adminFeatureDefinitions.map((section) => ({
        category: section.category,
        features: section.features,
      })),
    []
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {sectionProps.map((section) => (
          <FeatureSection
            key={section.category}
            category={section.category}
            features={section.features}
            flags={flags}
            selectedKey={selectedKey}
            onSelect={handleSelectFeature}
            onToggle={handleToggle}
          />
        ))}
      </div>

      <section className="bg-bg-2 p-5 border border-rule-strong rounded-xl">
        <h2 className="text-lg font-serif text-ink mb-4">Announcement Banner</h2>
        <FeatureToggleRow
          feature={announcementBannerFeature}
          checked={Boolean(flags[announcementBannerFeature.key])}
          isSelected={selectedKey === announcementBannerFeature.key}
          onSelect={handleSelectFeature}
          onToggle={handleToggle}
        />
        <div className="mt-4">
          <label className="block text-sm font-semibold text-ink font-sans mb-1.5">
            {announcementTextFeature.title}
          </label>
          <textarea
            className="w-full text-sm bg-bg border border-rule-strong p-3 rounded-md focus:border-ink transition-colors"
            rows={2}
            value={flags[announcementTextFeature.key]}
            onChange={(e) => onChange(announcementTextFeature.key, e.target.value)}
            onFocus={() => handleSelectFeature(announcementBannerFeature)}
          />
        </div>
      </section>
    </>
  );
});

const PreviewSidebar = memo(function PreviewSidebar() {
  usePreviewRenderDiagnostics("PreviewSidebar");
  const { selectedFeature, clearPreview } = usePreviewSelection();

  return (
    <aside className="xl:sticky xl:top-8">
      <FeaturePreviewPanel />
      {selectedFeature && (
        <button
          type="button"
          onClick={clearPreview}
          className="mt-3 text-[11px] font-mono uppercase tracking-widest text-muted-2 hover:text-ink transition-colors"
        >
          Clear selection
        </button>
      )}
    </aside>
  );
});

function FeatureControlContent({
  flags,
  saving,
  onChange,
  onSave,
  onToggleAllAi,
}: FeatureControlContentProps) {
  usePreviewRenderDiagnostics("FeatureControlContent");

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <AdminBreadcrumb crumbs={[{ label: "Feature Control" }]} />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-serif text-ink tracking-tight mb-2">Feature Control</h1>
          <p className="text-muted text-sm font-sans">
            Globally enable or disable app features. Disabled features will immediately hide from the UI and reject API requests.
          </p>
          <p className="text-[11px] text-muted-2 mt-1.5 flex items-center gap-1.5">
            <Eye size={13} className="text-ink" /> Select any feature to open its preview workspace.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => onToggleAllAi(false)}
            className="text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200"
          >
            <PowerOff size={16} className="mr-2" /> All AI Off (Panic)
          </Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            <Save size={16} className="mr-2" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
        <div className="space-y-8">
          <FeatureList flags={flags} onChange={onChange} />
        </div>

        <PreviewSidebar />
      </div>
    </div>
  );
}

export default function FeatureControl() {
  usePreviewRenderDiagnostics("FeatureControl");
  const [flags, setFlags] = useState<Flags>(defaultFlags);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<Flags>(defaultFlags);
  const { showToast } = useToast();

  const fetchFlags = useCallback(async () => {
    const { data, error } = await supabase.from("app_settings").select("flags").eq("id", 1).single();
    if (error) {
      console.error("Error fetching flags:", error);
    } else if (data?.flags) {
      const merged = { ...defaultFlags, ...data.flags };
      setFlags(merged);
      savedRef.current = merged;
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleChange = useCallback((key: FlagKeys, value: boolean | string) => {
    setFlags((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleAllAi = useCallback((status: boolean) => {
    setFlags((prev) => ({
      ...prev,
      aiExplain: status,
      aiCoach: status,
      aiDiagnosis: status,
      aiPractice: status,
      weatherBriefing: status,
    }));
  }, []);

  const handleSave = useCallback(async () => {
    const optimistic = { ...flags };
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({ id: 1, flags: optimistic });
    setSaving(false);
    if (error) {
      setFlags(savedRef.current);
      showToast({ type: "error", title: "Save Failed", message: error.message });
    } else {
      savedRef.current = optimistic;
      showToast({
        type: "success",
        title: "Saved successfully",
        message: "Feature flags updated.",
      });
    }
  }, [flags, showToast]);

  const resolvePreviewStatus = useCallback((feature: FeatureDefinition) => {
    const preview = featurePreviewRegistry[feature.key];
    if (preview.implementationStatus === "unsupported" || preview.previewType === "none") {
      return "unavailable";
    }
    return "selected";
  }, []);

  if (loading) {
    return <Spinner label="Loading feature flags" />;
  }

  return (
    <PreviewModeProvider
      draftFlags={flags}
      onDraftFlagsChange={setFlags}
      resolvePreviewStatus={resolvePreviewStatus}
    >
      <FeatureControlContent
        flags={flags}
        saving={saving}
        onChange={handleChange}
        onSave={handleSave}
        onToggleAllAi={toggleAllAi}
      />
    </PreviewModeProvider>
  );
}
