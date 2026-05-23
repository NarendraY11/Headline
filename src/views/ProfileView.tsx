import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card } from "../components/Atoms";
import { AlertCircle, LogOut, LogIn, Camera, Upload, X, Check, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function ProfileView() {
  const { user, userData, logout, resetAccount, loading, openAuthModal, updateUserData } = useAuth();
  const navigate = useNavigate();

  const [isUploading, setIsUploading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      // Shutdown stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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

  const { targetExam = "DGCA CPL", streaks = 0, photoURL: firestorePhotoURL } = userData || {};
  const currentPhotoURL = firestorePhotoURL || user.photoURL;

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

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageUpload(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 md:py-24 px-4 w-full">
      <div className="mb-12 border-b border-rule pb-10">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <Card className="bg-panel border-rule p-6">
          <div className="font-mono text-[10px] uppercase text-muted tracking-widest mb-1">Target Clearance</div>
          <div className="font-serif text-3xl text-ink">{targetExam}</div>
        </Card>
        <Card className="bg-panel border-rule p-6">
          <div className="font-mono text-[10px] uppercase text-muted tracking-widest mb-1">Consecutive Days</div>
          <div className="font-serif text-3xl text-ink flex items-end gap-2">
            {streaks} <span className="font-sans text-xs font-medium text-muted pb-1">DAY STREAK</span>
          </div>
        </Card>
      </div>

      <div className="space-y-8">
        <div className="border border-signal-soft rounded-xl bg-bg p-8 flex flex-col items-start gap-4">
          <div className="flex items-center gap-3 text-signal">
            <AlertCircle size={24} />
            <span className="font-sans font-semibold text-lg text-ink">Danger Zone</span>
          </div>
          <p className="font-sans text-sm text-ink-2 font-light leading-relaxed max-w-md">
            Wiping your logbook will permanently erase all mock exam attempts, study history, and telemetry. This cannot be reversed.
          </p>
          <Button variant="ghost" className="text-signal hover:bg-signal-soft border border-signal-soft" onClick={() => {
              if (window.confirm("Are you sure you want to permanently erase all records?")) {
                  resetAccount();
              }
          }}>
            Wipe Logbook & Progress
          </Button>
        </div>

        <div className="pt-4 flex justify-between border-t border-rule mt-8">
          <Button variant="ghost" onClick={logout} className="gap-2 text-muted-2 hover:text-ink">
            <LogOut size={16} /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
