import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card } from "../components/Atoms";
import { AlertCircle, LogOut, LogIn, Camera, Upload, X, Check, RefreshCw, Mail, Gift, Edit2, Sparkles, ShieldCheck, CalendarClock, ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { isPaidActive, daysLeft, planLabel } from "../lib/plan";

export default function ProfileView() {
  const { user, userData, logout, logoutEverywhere, resetAccount, loading, openAuthModal, updateUserData } = useAuth();
  const navigate = useNavigate();

  const [isUploading, setIsUploading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [isEditingExamDate, setIsEditingExamDate] = useState(false);
  const [tempExamDate, setTempExamDate] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const savedDate = userData?.nextExam || "";

  useEffect(() => {
    return () => {
      // Shutdown stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (savedDate) {
      setTempExamDate(savedDate);
    }
  }, [savedDate]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="relative min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-20 z-0" />
        <div className="max-w-md mx-auto w-full text-center flex flex-col items-center relative z-10">
          <div className="w-16 h-16 rounded-full bg-paper border border-rule shadow-sm flex items-center justify-center mb-6">
            <LogIn className="text-muted" size={32} />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-ink mb-3 tracking-tight">Pilot Records Restricted</h1>
          <p className="font-mono text-xs text-muted mb-8 max-w-[300px] mx-auto leading-relaxed">
            Sign in to access your logbook, progress, and exam history.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-[280px] mx-auto">
            <Button 
              variant="primary" 
              className="w-full h-12 rounded-full shadow-sm"
              onClick={() => openAuthModal("signin")}
            >
              Sign In →
            </Button>
            <Button 
              variant="ghost" 
              className="w-full h-12 rounded-full text-muted hover:text-ink hover:bg-paper/50"
              onClick={() => navigate('/')}
            >
              ← Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { targetExam = "DGCA CPL", streakCount = 0, photoURL: firestorePhotoURL } = userData || {};
  const currentPhotoURL = firestorePhotoURL || user.photoURL;

  // Subscription / clearance details.
  const isPro = isPaidActive(userData);
  const subPlan: string = userData?.plan || "free";
  const subDaysLeft = daysLeft(userData);
  const fmtSubDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

  let daysDiff: number | null = null;
  let isPast = false;
  
  if (savedDate) {
    const d = new Date(savedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diffTime = d.getTime() - today.getTime();
    daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysDiff < 0) {
      isPast = true;
      daysDiff = Math.abs(daysDiff);
    }
  }

  const startCamera = async () => {
    setUploadError("");
    setUploadSuccess(false);
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 400 }, height: { ideal: 400 } },
        audio: false
      });
      // Small timeout to allow element mounting and reference validation
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err: any) {
      console.error("Camera access error", err);
      setUploadError("Could not start live video feed. Use standard photo upload instead.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const convertBase64 = (file: Blob | File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onload = () => {
        resolve(fileReader.result as string);
      };
      fileReader.onerror = (error) => {
        reject(error);
      };
    });
  };

  const handleImageUpload = async (blobOrFile: Blob | File) => {
    // Defense-in-depth: catch oversized blobs (e.g. camera captures) that
    // bypass the file-input check.
    if (blobOrFile.size > 5 * 1024 * 1024) {
      setUploadError("Image is too large. Maximum size is 5 MB.");
      return;
    }
    setIsUploading(true);
    setUploadError("");
    setUploadSuccess(false);
    try {
      let downloadURL = "";
      try {
        const path = `profile_${user.uid}_${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("avatars")
          .upload(path, blobOrFile, { upsert: true, contentType: 'image/jpeg' });
        
        if (error) {
          throw error;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);
        
        downloadURL = publicUrl;
      } catch (storageErr) {
        console.warn("Supabase Storage bucket upload warning. Falling back to local Base64 Data URL.", storageErr);
        downloadURL = await convertBase64(blobOrFile);
      }

      // Sync user profile photo inside Supabase Auth + Profiles settings
      await updateUserData({ photoURL: downloadURL });
      
      setUploadSuccess(true);
    } catch (err: any) {
      console.error("Supabase user photo saving failed", err);
      setUploadError(err.message || "Failed to save selected photo. Check your connection.");
    } finally {
      setIsUploading(false);
    }
  };

  const captureSnapshot = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      // Create square dimensions matching layout
      const size = Math.min(video.videoWidth || 400, video.videoHeight || 400);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Crop center of camera stream for neat circular look
        const xOffset = (video.videoWidth - size) / 2;
        const yOffset = (video.videoHeight - size) / 2;
        ctx.drawImage(video, xOffset, yOffset, size, size, 0, 0, size, size);
        canvas.toBlob(async (blob) => {
          if (blob) {
            await handleImageUpload(blob);
          }
        }, "image/jpeg", 0.9);
      }
      stopCamera();
    }
  };

  // Avatar upload constraints. `accept="image/*"` is only a UI hint; validate
  // the real MIME type and size here so non-images / oversized files are
  // rejected before they reach storage or the profile photoURL.
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Unsupported file type. Upload a JPEG, PNG, WebP, or GIF image.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("Image is too large. Maximum size is 5 MB.");
      e.target.value = "";
      return;
    }

    setUploadError("");
    handleImageUpload(file);
    e.target.value = ""; // allow re-selecting the same file after an error
  };

  return (
    <div className="max-w-4xl mx-auto py-10 md:py-16 px-4 w-full">
      <div className="mb-8 border-b border-rule pb-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full border-2 border-rule overflow-hidden bg-navy flex items-center justify-center relative shadow-sm">
              {currentPhotoURL ? (
                <img src={currentPhotoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="font-serif text-3xl text-bg uppercase">
                  {user.displayName?.charAt(0) || "P"}
                </span>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-ink/70 flex items-center justify-center">
                  <RefreshCw className="text-bg animate-spin" size={24} />
                </div>
              )}
            </div>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              title="Upload file"
              className="absolute -bottom-1 -right-1 bg-paper border border-rule text-ink p-1.5 rounded-full shadow-md hover:bg-bg transition-colors"
            >
              <Upload size={14} />
            </button>
          </div>

          <div className="text-center md:text-left flex-1">
            <span className="eyebrow block mb-2 text-sky uppercase">Active Pilot</span>
            <h1 className="font-serif text-4xl text-ink leading-none mb-2">{user.displayName || "Unknown Commander"}</h1>
            <div className="font-mono text-[10px] text-muted-2 tracking-widest mb-4">{user.email}</div>
            
            <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
              {!cameraActive ? (
                <Button 
                  variant="ghost" 
                  size="small"
                  className="gap-1.5 text-xs text-ink-2 h-9 border border-rule hover:bg-paper/50"
                  onClick={startCamera}
                >
                  <Camera size={14} /> Use Camera
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="small"
                    className="text-xs text-signal hover:bg-signal-soft border border-signal-soft h-9"
                    onClick={stopCamera}
                  >
                    <X size={14} /> Close Video
                  </Button>
                </div>
              )}
              
              <Button 
                variant="ghost" 
                size="small"
                className="gap-1.5 text-xs text-ink-2 h-9 border border-rule hover:bg-paper/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} /> Choose File
              </Button>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={onFileInputChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>

            {uploadError && (
              <div className="mt-3 text-xs text-signal flex items-center gap-1">
                <AlertCircle size={12} /> {uploadError}
              </div>
            )}
            
            {uploadSuccess && (
              <div className="mt-3 text-xs text-mint flex items-center gap-1 font-mono uppercase tracking-wider">
                <Check size={12} /> Photo Updated Successfully
              </div>
            )}
          </div>
        </div>

        {/* Live Camera Feed Segment */}
        {cameraActive && (
          <div className="mt-8 p-4 bg-bg rounded-xl border border-rule flex flex-col items-center max-w-sm mx-auto">
            <div className="w-full aspect-square relative rounded-lg overflow-hidden border border-rule bg-ink mb-4 shadow-inner">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover transform -scale-x-100" 
              />
            </div>
            <div className="flex gap-3 w-full">
              <Button 
                variant="primary" 
                className="flex-1 text-xs"
                onClick={captureSnapshot}
              >
                Capture Snapshot
              </Button>
              <Button 
                variant="ghost" 
                className="border border-rule text-xs hover:bg-bg-2"
                onClick={stopCamera}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Subscription / Clearance status */}
      <Card
        className={`p-6 md:p-8 mb-8 rounded-2xl relative overflow-hidden ${
          isPro
            ? "bg-navy border-navy text-bg"
            : subPlan === "trial"
            ? "bg-panel border-l-4 border-l-amber"
            : "bg-panel border-l-4 border-l-navy"
        }`}
      >
        {isPro && (
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#DF9D38]/10 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        )}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span
              className={`inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] font-bold ${
                isPro ? "text-[#DF9D38]" : "text-muted"
              }`}
            >
              {isPro ? <Sparkles size={12} /> : <ShieldCheck size={12} />} Membership
            </span>
            {subPlan === "trial" && (
              <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest font-bold text-amber bg-amber-soft border border-amber/20 px-2 py-0.5 rounded-full align-middle">
                Trial{subDaysLeft !== null ? ` · ${subDaysLeft}d left` : ""}
              </span>
            )}
            <h3 className={`font-serif text-2xl md:text-3xl ${isPro ? "text-bg" : "text-ink"}`}>
              {subPlan === "lifetime"
                ? "Captain (Pro) · Lifetime"
                : subPlan === "pro"
                ? "Captain (Pro)"
                : subPlan === "trial"
                ? "Pro Trial"
                : "Cadet (Free)"}
            </h3>
            <div className={`font-mono text-[11px] tracking-wider ${isPro ? "text-bg/70" : "text-muted"}`}>
              {planLabel(userData)}
            </div>
          </div>

          {isPro ? (
            <div className="flex flex-wrap gap-6 md:gap-8 shrink-0">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-bg/50 mb-1">Started</div>
                <div className="font-sans text-sm font-semibold text-bg">{fmtSubDate(userData?.planStartedAt)}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-bg/50 mb-1">Renews / Expires</div>
                <div className="font-sans text-sm font-semibold text-bg">
                  {userData?.planExpiresAt ? fmtSubDate(userData.planExpiresAt) : "Never"}
                </div>
              </div>
              {subDaysLeft !== null && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-bg/50 mb-1 flex items-center gap-1">
                    <CalendarClock size={10} /> Days Left
                  </div>
                  <div className="font-sans text-sm font-semibold text-[#DF9D38]">{subDaysLeft}</div>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={() => navigate("/pricing")}
              className="h-11 rounded-full font-mono text-[10px] uppercase tracking-wider px-6 shrink-0 gap-1.5 bg-navy text-bg hover:bg-navy/90"
            >
              Upgrade to Pro <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </Card>

      {/* Account Overview — the three vitals unified into one divided strip so
          they read as a connected snapshot, not three sparse islands. */}
      <Card className="bg-paper p-0 mb-8 overflow-hidden">
        <div className="px-6 pt-5 pb-3 border-b border-rule">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-bold">Account Overview</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-rule">
          <div className="p-6">
            <div className="font-mono text-[10px] uppercase text-muted tracking-widest mb-1">Target Clearance</div>
            <div className="font-serif text-3xl text-ink">{targetExam}</div>
          </div>
          <div className="p-6">
            <div className="font-mono text-[10px] uppercase text-muted tracking-widest mb-1">Consecutive Days</div>
            <div className="font-serif text-3xl text-ink flex items-end gap-2">
              {streakCount} <span className="font-sans text-xs font-semibold text-muted pb-1">DAY STREAK</span>
            </div>
          </div>
          <div className="p-6 relative group">
            <div className="font-mono text-[10px] uppercase text-muted tracking-widest mb-1 flex justify-between items-center">
              <span>Time-to-Exam</span>
              {savedDate && !isEditingExamDate && (
                <button
                  onClick={() => {
                    setTempExamDate(savedDate);
                    setIsEditingExamDate(true);
                  }}
                  className="text-muted-2 hover:text-sky transition-colors cursor-pointer"
                  title="Change Exam Date"
                >
                  <Edit2 size={11} />
                </button>
              )}
            </div>

          {isEditingExamDate ? (
            <div className="space-y-2 mt-2">
              <input 
                type="date" 
                value={tempExamDate}
                onChange={(e) => setTempExamDate(e.target.value)}
                className="w-full bg-bg border border-rule-strong rounded-md text-xs px-2 py-1 outline-none focus:border-ink text-ink text-center transition-colors"
              />
              <div className="flex gap-2">
                <Button 
                  variant="primary" 
                  size="small" 
                  className="flex-1 text-[10px] py-1 h-7 text-white"
                  onClick={async () => {
                    await updateUserData({ nextExam: tempExamDate });
                    setIsEditingExamDate(false);
                  }}
                >
                  Save
                </Button>
                <Button 
                  variant="ghost" 
                  size="small" 
                  className="flex-1 text-[10px] py-1 h-7 border border-rule text-ink hover:bg-paper/50"
                  onClick={() => setIsEditingExamDate(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : savedDate ? (
            <div className="font-serif text-3xl text-ink flex items-end gap-2 mt-1">
              {daysDiff !== null ? (
                <>
                  {daysDiff === 0 ? (
                    <div className="text-[20px] font-bold text-mint tracking-tight">Exam Day!</div>
                  ) : isPast ? (
                    <div className="flex items-baseline gap-1">
                      <span>{daysDiff}</span>
                      <span className="font-sans text-xs font-semibold text-muted">DAYS AGO</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span>{daysDiff}</span>
                      <span className="font-sans text-xs font-semibold text-muted">DAYS LEFT</span>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-muted text-xs">Invalid date</span>
              )}
            </div>
          ) : (
            <div className="mt-2 text-center">
              <span className="font-mono text-[9px] text-muted block mb-2">NO EXAM DATE SET</span>
              <Button 
                variant="ghost" 
                size="small" 
                className="text-xs h-7 border border-dashed border-rule w-full hover:border-sky hover:text-sky text-ink bg-transparent hover:bg-paper/30"
                onClick={() => {
                  const todayStr = new Date().toISOString().split("T")[0];
                  setTempExamDate(todayStr);
                  setIsEditingExamDate(true);
                }}
              >
                Set Target Date
              </Button>
            </div>
          )}
          </div>
        </div>
      </Card>

      {/* Lower section uses two columns on desktop so the bottom half fills
          horizontal space instead of stacking full-width. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 items-stretch">
        {/* Notification Preferences — both toggles grouped into one scannable
            card: label · short desc · toggle per row. */}
        <Card className="bg-paper p-0 overflow-hidden flex flex-col">
          <div className="px-6 pt-5 pb-3 border-b border-rule">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-bold">Notification Preferences</span>
          </div>
          <div className="divide-y divide-rule flex-1">
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <h3 className="font-sans text-sm font-semibold text-ink">Spaced Review Reminders</h3>
                <p className="font-mono text-[10px] tracking-wide text-muted-2 mt-1 uppercase">Gentle digests when recall is due</p>
              </div>
              <div className="shrink-0 flex items-center gap-2.5">
                <span className="font-mono text-[9px] uppercase font-bold tracking-widest text-muted-2 hidden sm:block">
                  {userData?.settings?.remindersEnabled ? "OPTED IN" : "MUTED"}
                </span>
                <button
                  aria-label="Toggle spaced review reminder emails"
                  onClick={() => {
                    const currentSettings = userData?.settings || {};
                    const currentStatus = !!currentSettings.remindersEnabled;
                    updateUserData({
                      settings: {
                        ...currentSettings,
                        remindersEnabled: !currentStatus
                      }
                    });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 outline-none cursor-pointer ${userData?.settings?.remindersEnabled ? 'bg-mint' : 'bg-rule-strong'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${userData?.settings?.remindersEnabled ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <h3 className="font-sans text-sm font-semibold text-ink flex items-center gap-1.5">
                  <Mail size={14} className="text-navy shrink-0" /> Weekly Tips & QOTD
                </h3>
                <p className="font-mono text-[10px] tracking-wide text-muted-2 mt-1 uppercase">Question of the day + hiring bulletins</p>
              </div>
              <div className="shrink-0 flex items-center gap-2.5">
                <span className="font-mono text-[9px] uppercase font-bold tracking-widest text-muted-2 hidden sm:block">
                  {userData?.newsletterOptIn ? "SUBSCRIBED" : "OPTED OUT"}
                </span>
                <button
                  id="newsletterOptInToggleBtn"
                  aria-label="Toggle weekly tips newsletter"
                  onClick={() => {
                    const currentStatus = !!userData?.newsletterOptIn;
                    updateUserData({
                      newsletterOptIn: !currentStatus
                    });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 outline-none cursor-pointer ${userData?.newsletterOptIn ? 'bg-mint' : 'bg-rule-strong'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${userData?.newsletterOptIn ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Referral CTA */}
        <Card className="bg-emerald-500/5 border border-emerald-500/10 p-6 md:p-8 flex flex-col justify-between gap-4 rounded-2xl">
          <div className="space-y-1">
            <span className="block font-mono text-[9px] uppercase tracking-widest text-[#10B981] font-bold">PILOT COOP</span>
            <h3 className="font-serif text-xl font-bold text-ink flex items-center gap-2">
              <Gift size={18} className="text-emerald-600" /> Refer a Cadet & Earn
            </h3>
            <p className="font-sans text-xs text-muted leading-relaxed font-light">
              Share your dispatch URL. When your referred peer upgrades, you both get <strong className="text-[#10B981]">30 days of free Pro</strong> credited immediately.
            </p>
          </div>
          <Button
            id="profileReferEarnBtn"
            variant="ghost"
            onClick={() => navigate("/referral")}
            className="h-10 rounded-full font-mono text-[10px] uppercase tracking-wider px-6 border-emerald-600/20 hover:bg-emerald-500/10 text-emerald-700 bg-transparent self-start"
          >
            Dispatch Invites
          </Button>
        </Card>
      </div>

      {/* Account actions + Danger Zone, paired on desktop. Sign-out is no
          longer a bare button buried under Danger Zone. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <div className="border border-rule-strong rounded-xl bg-paper p-6 flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-bold">Account</span>
          <p className="font-sans text-sm text-ink-2 font-light leading-relaxed">
            Sign out of this device, or end every active session at once.
          </p>
          <div className="mt-auto flex flex-col gap-3 pt-2">
            {/* Primary, everyday action — promoted to a visible bordered button. */}
            <Button variant="ghost" onClick={logout} className="gap-2 justify-center border border-rule-strong text-ink hover:bg-bg-2">
              <LogOut size={16} /> Sign out
            </Button>
            {/* Security escape hatch (lost/stolen/shared device): revokes every
                session server-side. Kept subordinate so it doesn't compete. */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Log out of all devices? This ends every active session, including this one.")) {
                  logoutEverywhere();
                }
              }}
              className="text-[11px] font-sans text-muted-2 hover:text-signal underline underline-offset-2 transition-colors self-center"
            >
              Lost a device? Sign out of all devices
            </button>
          </div>
        </div>

        <div className="border border-signal-soft rounded-xl bg-bg p-6 flex flex-col items-start gap-3">
          <div className="flex items-center gap-3 text-signal">
            <AlertCircle size={22} />
            <span className="font-sans font-semibold text-lg text-ink">Danger Zone</span>
          </div>
          <p className="font-sans text-sm text-ink-2 font-light leading-relaxed">
            Wiping your logbook permanently erases all mock attempts, study history, and telemetry. This cannot be reversed.
          </p>
          <Button variant="ghost" className="mt-auto text-signal hover:bg-signal-soft border border-signal-soft" onClick={() => {
              if (window.confirm("Are you sure you want to permanently erase all records?")) {
                  resetAccount();
              }
          }}>
            Wipe Logbook & Progress
          </Button>
        </div>
      </div>
    </div>
  );
}
