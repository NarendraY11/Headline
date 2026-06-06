import { IndianRupee, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/Atoms";
import { Spinner } from "../../components/Spinner";
import { useToast } from "../../components/ui/Toast";
import { supabase } from "../../lib/supabase";

interface PricingTier {
  key: string;
  label: string;
  amount: number;
  currency: string;
  description?: string;
}

const DEFAULT_TIERS: PricingTier[] = [
  { key: "monthly", label: "Captain Monthly", amount: 499, currency: "INR", description: "Monthly subscription" },
  { key: "yearly",  label: "Captain Yearly",  amount: 2999, currency: "INR", description: "Annual subscription (save ~50%)" },
];

export default function PricingManager() {
  const [tiers, setTiers] = useState<PricingTier[]>(DEFAULT_TIERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTier, setNewTier] = useState<Partial<PricingTier>>({ currency: "INR" });
  const { showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("pricing").eq("id", 1).single();
      if (data?.pricing && Object.keys(data.pricing).length > 0) {
        const parsed: PricingTier[] = Object.entries(data.pricing).map(([key, val]: [string, any]) => ({
          key,
          label: val.label || key,
          amount: val.amount || 0,
          currency: val.currency || "INR",
          description: val.description || "",
        }));
        setTiers(parsed);
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateTier = (key: string, field: keyof PricingTier, value: string | number) => {
    setTiers((prev) => prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  };

  const removeTier = (key: string) => {
    setTiers((prev) => prev.filter((t) => t.key !== key));
  };

  const addTier = () => {
    if (!newTier.key || !newTier.label || !newTier.amount) {
      showToast({ type: "error", title: "Missing fields", message: "Key, label and amount are required." });
      return;
    }
    if (tiers.some((t) => t.key === newTier.key)) {
      showToast({ type: "error", title: "Duplicate key", message: `"${newTier.key}" already exists.` });
      return;
    }
    setTiers((prev) => [...prev, {
      key: newTier.key!,
      label: newTier.label!,
      amount: Number(newTier.amount),
      currency: newTier.currency || "INR",
      description: newTier.description || "",
    }]);
    setNewTier({ currency: "INR" });
  };

  const handleSave = async () => {
    setSaving(true);
    const pricingObj: Record<string, any> = {};
    tiers.forEach((t) => {
      pricingObj[t.key] = { label: t.label, amount: t.amount, currency: t.currency, description: t.description };
    });
    const { error } = await supabase.from("app_settings").upsert({ id: 1, pricing: pricingObj });
    setSaving(false);
    if (error) {
      showToast({ type: "error", title: "Save failed", message: error.message });
    } else {
      showToast({ type: "success", title: "Pricing updated", message: "Changes live on next checkout." });
    }
  };

  if (loading) return <Spinner label="Loading pricing" />;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif text-ink tracking-tight mb-1">Pricing Manager</h1>
          <p className="text-sm text-muted font-sans">
            Edit subscription prices and tiers. Changes apply to new Razorpay orders immediately.
          </p>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          <Save size={15} /> {saving ? "Saving..." : "Save Pricing"}
        </Button>
      </div>

      {/* Current tiers */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg text-ink border-b border-rule pb-2">Current Tiers</h2>
        {tiers.map((tier) => (
          <div key={tier.key} className="p-4 bg-paper border border-rule-strong rounded-lg grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-2 mb-1">Key</label>
              <div className="font-mono text-[12px] bg-bg-2 border border-rule rounded px-2 py-1.5 text-ink">{tier.key}</div>
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-2 mb-1">Label</label>
              <input
                type="text"
                value={tier.label}
                onChange={(e) => updateTier(tier.key, "label", e.target.value)}
                className="w-full text-sm bg-bg border border-rule-strong rounded px-2 py-1.5 text-ink focus:outline-none focus:border-ink"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-2 mb-1">Amount (₹)</label>
              <div className="relative">
                <IndianRupee size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-2" />
                <input
                  type="number"
                  min={1}
                  value={tier.amount}
                  onChange={(e) => updateTier(tier.key, "amount", Number(e.target.value))}
                  className="w-full text-sm bg-bg border border-rule-strong rounded pl-6 pr-2 py-1.5 text-ink focus:outline-none focus:border-ink"
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-2 mb-1">Description</label>
                <input
                  type="text"
                  value={tier.description || ""}
                  onChange={(e) => updateTier(tier.key, "description", e.target.value)}
                  className="w-full text-sm bg-bg border border-rule-strong rounded px-2 py-1.5 text-ink focus:outline-none focus:border-ink"
                />
              </div>
              <button
                onClick={() => removeTier(tier.key)}
                className="p-2 mb-0.5 text-muted-2 hover:text-signal transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60"
                title="Remove tier"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new tier */}
      <div className="p-5 bg-bg-2 border border-rule-strong rounded-xl">
        <h2 className="font-serif text-lg text-ink mb-4">Add New Tier</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-2 mb-1">Key</label>
            <input
              type="text"
              placeholder="e.g. lifetime"
              value={newTier.key || ""}
              onChange={(e) => setNewTier((p) => ({ ...p, key: e.target.value }))}
              className="w-full text-sm bg-bg border border-rule-strong rounded px-2 py-1.5 text-ink focus:outline-none focus:border-ink placeholder:text-muted-2"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-2 mb-1">Label</label>
            <input
              type="text"
              placeholder="Captain Lifetime"
              value={newTier.label || ""}
              onChange={(e) => setNewTier((p) => ({ ...p, label: e.target.value }))}
              className="w-full text-sm bg-bg border border-rule-strong rounded px-2 py-1.5 text-ink focus:outline-none focus:border-ink placeholder:text-muted-2"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-2 mb-1">Amount (₹)</label>
            <input
              type="number"
              min={1}
              placeholder="9999"
              value={newTier.amount || ""}
              onChange={(e) => setNewTier((p) => ({ ...p, amount: Number(e.target.value) }))}
              className="w-full text-sm bg-bg border border-rule-strong rounded px-2 py-1.5 text-ink focus:outline-none focus:border-ink placeholder:text-muted-2"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-2 mb-1">Description</label>
            <input
              type="text"
              placeholder="One-time payment"
              value={newTier.description || ""}
              onChange={(e) => setNewTier((p) => ({ ...p, description: e.target.value }))}
              className="w-full text-sm bg-bg border border-rule-strong rounded px-2 py-1.5 text-ink focus:outline-none focus:border-ink placeholder:text-muted-2"
            />
          </div>
        </div>
        <Button variant="ghost" onClick={addTier}>
          <Plus size={14} /> Add tier
        </Button>
      </div>

      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-sans">
          <strong>Note:</strong> Amount is in ₹ (INR). The Razorpay order API multiplies by 100 (paise). Existing active subscriptions are not affected — only new checkouts use the new price.
        </p>
      </div>
    </div>
  );
}
