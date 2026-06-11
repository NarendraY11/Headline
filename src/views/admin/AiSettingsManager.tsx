import { Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Atoms";
import { Spinner } from "../../components/Spinner";
import { useToast } from "../../components/ui/Toast";
import { supabase } from "../../lib/supabase";

interface AiSettings {
  plan_horizon_days: number;
  coach_cache_ttl_hours: number;
  regen_cooldown_hours: number;
  regen_daily_limit: number;
  sm2_initial_interval: number;
  sm2_min_ef: number;
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  plan_horizon_days: 7,
  coach_cache_ttl_hours: 24,
  regen_cooldown_hours: 24,
  regen_daily_limit: 3,
  sm2_initial_interval: 1,
  sm2_min_ef: 130,
};

interface FieldDef {
  key: keyof AiSettings;
  label: string;
  description: string;
  min: number;
  max: number;
  unit: string;
}

const FIELDS: FieldDef[] = [
  { key: "plan_horizon_days",     label: "Plan Horizon",           description: "Default study plan length for new AI-generated plans",       min: 3,   max: 14,  unit: "days"        },
  { key: "coach_cache_ttl_hours", label: "Coach Cache TTL",        description: "Hours an AI-generated plan is cached before regenerating",   min: 1,   max: 72,  unit: "hours"       },
  { key: "regen_cooldown_hours",  label: "Regen Cooldown",         description: "Minimum hours between adaptive plan regenerations per user", min: 1,   max: 168, unit: "hours"       },
  { key: "regen_daily_limit",     label: "Regen Daily Limit",      description: "Max automatic plan regenerations per user per calendar day", min: 1,   max: 10,  unit: "regens/day"  },
  { key: "sm2_initial_interval",  label: "SM-2 Initial Interval",  description: "First review interval for newly-learned spaced-rep cards",   min: 1,   max: 7,   unit: "days"        },
  { key: "sm2_min_ef",            label: "SM-2 Min Ease Factor",   description: "Minimum ease factor × 100 (130 = 1.30, never drops below)", min: 100, max: 300, unit: "× 0.01"      },
];

const GROUPS: { title: string; keys: (keyof AiSettings)[] }[] = [
  { title: "Study Planning",               keys: ["plan_horizon_days",    "coach_cache_ttl_hours"] },
  { title: "Adaptive Regeneration",        keys: ["regen_cooldown_hours", "regen_daily_limit"]     },
  { title: "Spaced Repetition (SM-2)",     keys: ["sm2_initial_interval", "sm2_min_ef"]            },
];

export default function AiSettingsManager() {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const savedRef                = useRef<AiSettings>(DEFAULT_AI_SETTINGS);
  const { showToast }           = useToast();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("ai_settings").eq("id", 1).single();
      if (data?.ai_settings && Object.keys(data.ai_settings).length > 0) {
        const merged = { ...DEFAULT_AI_SETTINGS, ...data.ai_settings } as AiSettings;
        setSettings(merged);
        savedRef.current = merged;
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleChange = (key: keyof AiSettings, raw: string) => {
    const field = FIELDS.find((f) => f.key === key)!;
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    const clamped = Math.min(field.max, Math.max(field.min, Math.round(v)));
    setSettings((prev) => ({ ...prev, [key]: clamped }));
  };

  const handleSave = async () => {
    const optimistic = { ...settings };
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: 1, ai_settings: optimistic });
    setSaving(false);
    if (error) {
      setSettings(savedRef.current);
      showToast({ type: "error", title: "Save failed", message: error.message });
    } else {
      savedRef.current = optimistic;
      showToast({ type: "success", title: "AI settings saved", message: "Changes apply to new AI operations." });
    }
  };

  if (loading) return <Spinner label="Loading AI settings" />;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif text-ink tracking-tight mb-1">AI Settings</h1>
          <p className="text-sm text-muted font-sans">
            Tune AI model behaviour, caching, and spaced-repetition parameters.
          </p>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          <Save size={15} className="mr-1.5" /> {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="font-serif text-lg text-ink border-b border-rule pb-2 mb-4">{group.title}</h2>
          <div className="space-y-3">
            {group.keys.map((key) => {
              const field = FIELDS.find((f) => f.key === key)!;
              const isDefault = settings[key] === DEFAULT_AI_SETTINGS[key];
              return (
                <div
                  key={key}
                  className="p-4 bg-paper border border-rule-strong rounded-lg flex items-center justify-between gap-6"
                >
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`ai-${key}`}
                      className="block text-sm font-semibold text-ink font-sans"
                    >
                      {field.label}
                    </label>
                    <p className="text-[11px] text-muted-2 mt-0.5">{field.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="font-mono text-[9px] text-muted-2">
                        Range: {field.min}–{field.max}
                      </span>
                      {!isDefault && (
                        <span className="font-mono text-[9px] text-amber-600">
                          default: {DEFAULT_AI_SETTINGS[key]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      id={`ai-${key}`}
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={1}
                      value={settings[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="w-24 text-sm bg-bg border border-rule-strong rounded px-3 py-2 text-ink font-mono text-right focus:outline-none focus:border-ink"
                    />
                    <span className="font-mono text-[10px] text-muted-2 w-20 shrink-0">
                      {field.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="p-3 bg-bg-2 border border-rule rounded-lg">
        <p className="text-[11px] text-muted-2 font-sans">
          Changes affect new AI operations only. Active study plans, cached responses, and
          in-progress SM-2 cards are not modified retroactively.
        </p>
      </div>
    </div>
  );
}
