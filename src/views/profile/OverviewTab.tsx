// UX-Nav Phase 2C — Overview tab: the user's personal dashboard. 12-col grid so
// identity + membership + KPIs sit in the first desktop viewport, followed by
// lightweight Quick Actions, XP progression, and achievements. Avatar-upload
// logic is moved here verbatim from the old ProfileView (no logic change).

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowRight, BarChart3, BookOpen, CalendarClock, CalendarDays,
  Camera, Check, Edit2, GraduationCap, Layers, RefreshCw, Sparkles, Target,
  Upload, X, Zap,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Card } from "../../components/Atoms";
import { useFeature } from "../../hooks/useFeatureFlags";
import { useXp } from "../../hooks/useXp";
import { isPaidActive, daysLeft, planLabel } from "../../lib/plan";
import { daysUntilExam } from "../../hooks/useResolvedExamDate";
import { supabase } from "../../lib/supabase";
import { AchievementGallery } from "./AchievementGallery";
import type { ProfileTabKey } from "./profileTabs";

const TARGET_EXAM_LABELS: Record<string, string> = {
  "dgca-cpl": "DGCA CPL", "dgca-atpl": "DGCA ATPL", "dgca-rtr": "DGCA RTR", "dgca-ppl": "DGCA PPL",
  "type-a320": "Airbus A320", "type-a330": "Airbus A330", "type-b737": "Boeing B737",
  "type-b777": "Boeing B777", "type-atr72": "ATR 72",
  "faa-ppl": "FAA PPL", "faa-cpl": "FAA CPL", "faa-atpl": "FAA ATPL", "easa-atpl": "EASA ATPL",
  "dgca-cpl-mock": "DGCA CPL", "a320-type-rating": "Airbus A320", "atr72-type-rating": "ATR 72",
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const QUICK_ACTIONS = [
  { label: "Continue Study",  desc: "Resume Today",     to: "/today",    icon: BookOpen },
  { label: "Question Bank",   desc: "Browse modules",   to: "/modules",  icon: Layers },
  { label: "Practice",        desc: "Mock & exam",      to: "/practice", icon: GraduationCap },
  { label: "Review",          desc: "Saved & mistakes", to: "/review",   icon: Zap },
  { label: "Today's Mission", desc: "Generate plan",    to: "/today",    icon: Target },
  { label: "Planner",         desc: "Study schedule",   to: "/schedule", icon: CalendarDays },
] as const;

export default function OverviewTab({ onNavigateTab }: { onNavigateTab: (key: ProfileTabKey) => void }) {
  const { user, userData, updateUserData } = useAuth();
  const navigate = useNavigate();

  const [isUploading, setIsUploading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isEditingExamDate, setIsEditingExamDate] = useState(false);
  const [tempExamDate, setTempExamDate] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const savedDate = userData?.nextExam || "";

  useEffect(() => () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
  }, []);

  useEffect(() => { if (savedDate) setTempExamDate(savedDate); }, [savedDate]);

  const rawTargetExam: string = (userData as any)?.targetExam ?? (userData as any)?.target_exam ?? "";
  const targetExam = TARGET_EXAM_LABELS[rawTargetExam] || rawTargetExam || "DGCA CPL";
  const { streakCount = 0, photoURL: firestorePhotoURL } = userData || {};
  const xpEnabled = useFeature("xpSystem");
  const { balance: xpBalance, rank: xpRank } = useXp(1);
  const currentPhotoURL = firestorePhotoURL || user?.photoURL;

  const isPro = isPaidActive(userData);
  const subPlan: string = userData?.plan || "free";
  const subDaysLeft = daysLeft(userData);

  const planTitle =
    subPlan === "lifetime" ? "Captain · Lifetime" :
    subPlan === "pro" ? "Captain (Pro)" :
    subPlan === "trial" ? "Pro Trial" : "Cadet (Free)";

  const { daysDiff: rawDaysDiff, isPast } = daysUntilExam(savedDate || null);
  const daysDiff = isPast && rawDaysDiff !== null ? Math.abs(rawDaysDiff) : rawDaysDiff;

  // ── Avatar upload (moved verbatim) ──────────────────────────────────────────
  const startCamera = async () => {
    setUploadError(""); setUploadSuccess(false); setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 400 }, height: { ideal: 400 } }, audio: false,
      });
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 50);
    } catch (err) {
      console.error("Camera access error", err);
      setUploadError("Could not start live video feed. Use standard photo upload instead.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const convertBase64 = (file: Blob | File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.readAsDataURL(file);
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
    });

  const handleImageUpload = async (blobOrFile: Blob | File) => {
    if (blobOrFile.size > MAX_IMAGE_BYTES) { setUploadError("Image is too large. Maximum size is 5 MB."); return; }
    setIsUploading(true); setUploadError(""); setUploadSuccess(false);
    try {
      let downloadURL = "";
      try {
        const path = `profile_${user!.uid}_${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("avatars").upload(path, blobOrFile, { upsert: true, contentType: "image/jpeg" });
        if (error) throw error;
        downloadURL = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      } catch (storageErr) {
        console.warn("Supabase Storage upload warning. Falling back to Base64.", storageErr);
        downloadURL = await convertBase64(blobOrFile);
      }
      await updateUserData({ photoURL: downloadURL });
      setUploadSuccess(true);
      setAvatarError(false);
    } catch (err: any) {
      console.error("Supabase user photo saving failed", err);
      setUploadError(err.message || "Failed to save selected photo. Check your connection.");
    } finally {
      setIsUploading(false);
    }
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;
    const size = Math.min(video.videoWidth || 400, video.videoHeight || 400);
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const xOffset = (video.videoWidth - size) / 2;
      const yOffset = (video.videoHeight - size) / 2;
      ctx.drawImage(video, xOffset, yOffset, size, size, 0, 0, size, size);
      canvas.toBlob(async (blob) => { if (blob) await handleImageUpload(blob); }, "image/jpeg", 0.9);
    }
    stopCamera();
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { setUploadError("Unsupported file type. Upload a JPEG, PNG, WebP, or GIF image."); e.target.value = ""; return; }
    if (file.size > MAX_IMAGE_BYTES) { setUploadError("Image is too large. Maximum size is 5 MB."); e.target.value = ""; return; }
    setUploadError("");
    handleImageUpload(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {/* ── Row 1: identity (8) + membership summary (4) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <Card className="bg-paper p-6 lg:col-span-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative group shrink-0">
              <div className="w-24 h-24 rounded-full border-2 border-rule overflow-hidden bg-navy flex items-center justify-center relative shadow-sm">
                {currentPhotoURL && !avatarError ? (
                  <img src={currentPhotoURL} alt={user?.displayName ? `Profile photo of ${user.displayName}` : "Profile photo"} className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
                ) : (
                  <span className="font-serif text-3xl text-bg uppercase">{user?.displayName?.charAt(0) || "P"}</span>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-ink/70 flex items-center justify-center">
                    <RefreshCw className="text-bg animate-spin" size={24} />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload profile photo"
                className="absolute -bottom-1 -right-1 bg-paper border border-rule text-ink p-2.5 min-w-[44px] min-h-[44px] rounded-full shadow-md hover:bg-bg transition-colors flex items-center justify-center"
              >
                <Upload size={14} />
              </button>
            </div>

            <div className="text-center sm:text-left flex-1 min-w-0">
              <span className="eyebrow block mb-2 text-sky uppercase">Active Pilot</span>
              <h1 className="font-serif text-3xl md:text-4xl text-ink leading-none mb-2 truncate">{user?.displayName || "Unknown Commander"}</h1>
              <div className="font-mono text-[10px] text-muted-2 tracking-widest mb-4 truncate">{user?.email}</div>
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                {!cameraActive ? (
                  <Button variant="ghost" size="small" className="gap-1.5 text-xs text-ink-2 h-9 border border-rule hover:bg-paper/50" onClick={startCamera}>
                    <Camera size={14} /> Use Camera
                  </Button>
                ) : (
                  <Button variant="ghost" size="small" className="text-xs text-signal hover:bg-signal-soft border border-signal-soft h-9" onClick={stopCamera}>
                    <X size={14} /> Close Video
                  </Button>
                )}
                <Button variant="ghost" size="small" className="gap-1.5 text-xs text-ink-2 h-9 border border-rule hover:bg-paper/50" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} /> Choose File
                </Button>
                <input type="file" ref={fileInputRef} onChange={onFileInputChange} accept="image/*" aria-label="Upload profile photo" className="hidden" />
              </div>
              {uploadError && <div className="mt-3 text-xs text-signal flex items-center gap-1"><AlertCircle size={12} /> {uploadError}</div>}
              {uploadSuccess && <div className="mt-3 text-xs text-mint flex items-center gap-1 font-mono uppercase tracking-wider"><Check size={12} /> Photo Updated</div>}
            </div>
          </div>

          {cameraActive && (
            <div className="mt-6 p-4 bg-bg rounded-xl border border-rule flex flex-col items-center max-w-sm mx-auto">
              <div className="w-full aspect-square relative rounded-lg overflow-hidden border border-rule bg-ink mb-4 shadow-inner">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
              </div>
              <div className="flex gap-3 w-full">
                <Button variant="primary" className="flex-1 text-xs" onClick={captureSnapshot}>Capture Snapshot</Button>
                <Button variant="ghost" className="border border-rule text-xs hover:bg-bg-2" onClick={stopCamera}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>

        {/* Membership summary — links to the full Membership tab. */}
        <Card
          style={isPro ? { backgroundColor: "var(--color-navy)", borderColor: "var(--color-navy)" } : undefined}
          className={`p-6 lg:col-span-4 rounded-2xl relative overflow-hidden flex flex-col justify-between ${isPro ? "bg-navy border-navy text-bg" : subPlan === "trial" ? "bg-amber-soft/40 border border-amber/30" : "bg-panel border border-rule"}`}
        >
          <div className="space-y-1.5">
            <span className={`inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] font-bold ${isPro ? "text-[var(--pro-gold)]" : "text-muted"}`}>
              <Sparkles size={12} /> Membership
            </span>
            <h3 className={`font-serif text-2xl ${isPro ? "text-bg" : "text-ink"}`}>{planTitle}</h3>
            <div className={`font-mono text-[11px] tracking-wider ${isPro ? "text-bg/70" : "text-muted"}`}>
              {planLabel(userData)}{subPlan === "trial" && subDaysLeft !== null ? ` · ${subDaysLeft}d left` : ""}
            </div>
          </div>
          <Button
            variant={isPro ? "ghost" : "primary"}
            onClick={() => onNavigateTab("membership")}
            className={`h-10 mt-4 rounded-full font-mono text-[10px] uppercase tracking-wider px-5 gap-1.5 self-start ${isPro ? "border border-bg/30 text-bg hover:bg-bg/10" : "bg-navy text-bg hover:bg-navy/90"}`}
          >
            {isPro ? "Manage plan" : "Upgrade to Pro"} <ArrowRight size={14} />
          </Button>
        </Card>
      </div>

      {/* ── Row 2: KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Target Clearance">
          <div className="font-serif text-2xl text-ink leading-tight">{targetExam}</div>
        </KpiCard>
        <KpiCard label="Day Streak">
          <div className="font-serif text-3xl text-ink flex items-end gap-1.5">{streakCount}<span className="font-sans text-[10px] font-semibold text-muted pb-1.5 uppercase">days</span></div>
        </KpiCard>
        <KpiCard label="Time-to-Exam" action={savedDate && !isEditingExamDate ? () => { setTempExamDate(savedDate); setIsEditingExamDate(true); } : undefined}>
          {isEditingExamDate ? (
            <div className="space-y-2">
              <input type="date" value={tempExamDate} onChange={(e) => setTempExamDate(e.target.value)} className="w-full bg-bg border border-rule-strong rounded-md text-xs px-2 py-1.5 outline-none focus:border-ink text-ink" />
              <div className="flex gap-1.5">
                <Button variant="primary" size="small" className="flex-1 text-[11px] min-h-[40px]" onClick={async () => { await updateUserData({ nextExam: tempExamDate }); setIsEditingExamDate(false); }}>Save</Button>
                <Button variant="ghost" size="small" className="text-[11px] min-h-[40px] border border-rule text-ink" onClick={() => setIsEditingExamDate(false)}>Cancel</Button>
              </div>
            </div>
          ) : savedDate && daysDiff !== null ? (
            <div className="font-serif text-3xl text-ink flex items-end gap-1.5">
              {daysDiff === 0 ? <span className="text-xl font-bold text-mint">Exam Day!</span> : <>{daysDiff}<span className="font-sans text-[10px] font-semibold text-muted pb-1.5 uppercase">{isPast ? "days ago" : "days left"}</span></>}
            </div>
          ) : (
            <Button variant="ghost" size="small" className="text-xs h-9 border border-dashed border-rule w-full hover:border-sky hover:text-sky text-ink" onClick={() => { setTempExamDate(new Date().toISOString().split("T")[0]); setIsEditingExamDate(true); }}>
              <CalendarClock size={13} className="mr-1" /> Set date
            </Button>
          )}
        </KpiCard>
        <KpiCard label="Experience">
          <div className="font-serif text-3xl text-ink flex items-end gap-1.5"><Zap size={18} className="text-amber mb-1.5" />{xpEnabled ? xpBalance : 0}<span className="font-sans text-[10px] font-semibold text-muted pb-1.5 uppercase">xp</span></div>
        </KpiCard>
      </div>

      {/* ── Row 3: Quick Actions ── */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-bold block mb-3">Quick Actions</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map(({ label, desc, to, icon: Icon }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="group flex flex-col items-start gap-2 p-3.5 min-h-[44px] rounded-xl bg-paper border border-rule hover:border-ink/30 hover:bg-bg-2 transition-colors text-left outline-none focus-visible:ring-2 focus-visible:ring-sky/60"
            >
              <Icon size={16} className="text-muted-2 group-hover:text-ink transition-colors" />
              <div className="min-w-0">
                <div className="font-sans text-[13px] font-semibold text-ink leading-tight truncate">{label}</div>
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-2 mt-0.5 truncate">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 4: XP progression (gated) + achievements ── */}
      {xpEnabled && (
        <Card className="bg-paper p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-rule flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-bold">Flight Progression</span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber tabular-nums"><Zap size={12} /> {xpBalance} XP</span>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <div className="font-mono text-[10px] uppercase text-muted tracking-widest mb-1">Current Rank</div>
                <div className="font-serif text-2xl text-ink">{xpRank.rank.name}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[9px] uppercase text-muted-2 tracking-widest mb-1">{xpRank.isMax ? "Top Rank" : "Next"}</div>
                <div className="font-sans text-sm text-ink">{xpRank.isMax ? "—" : xpRank.next!.name}</div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-bg-2 overflow-hidden">
              <div className="h-full rounded-full bg-amber transition-all duration-500" style={{ width: `${Math.round(xpRank.progress * 100)}%` }} />
            </div>
            <div className="mt-2 font-mono text-[9px] text-muted-2 tracking-wide tabular-nums text-right">
              {xpRank.isMax ? "All certificate stages cleared" : `${xpRank.xpRemaining} XP to ${xpRank.next!.name}`}
            </div>
          </div>
        </Card>
      )}

      <AchievementGallery />

      {/* Referral mini-CTA — full dashboard lives in the Referral tab. */}
      <button
        onClick={() => onNavigateTab("referral")}
        className="w-full flex items-center justify-between gap-4 p-5 rounded-2xl bg-mint-soft/30 border border-mint/20 hover:bg-mint-soft/50 transition-colors text-left outline-none focus-visible:ring-2 focus-visible:ring-sky/60"
      >
        <div className="flex items-center gap-3 min-w-0">
          <BarChart3 size={18} className="text-mint shrink-0" />
          <div className="min-w-0">
            <div className="font-serif text-base text-ink">Refer a cadet & earn Pro days</div>
            <div className="font-sans text-xs text-muted truncate">You both get 30 days of Pro when they upgrade.</div>
          </div>
        </div>
        <ArrowRight size={16} className="text-mint shrink-0" />
      </button>
    </div>
  );
}

function KpiCard({ label, action, children }: { label: string; action?: () => void; children: React.ReactNode }) {
  return (
    <Card className="bg-paper p-4 flex flex-col gap-1.5">
      <div className="font-mono text-[10px] uppercase text-muted tracking-widest flex justify-between items-center">
        <span>{label}</span>
        {action && (
          <button onClick={action} aria-label={`Edit ${label}`} className="text-muted-2 hover:text-sky transition-colors p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center -mr-1.5">
            <Edit2 size={13} />
          </button>
        )}
      </div>
      {children}
    </Card>
  );
}
