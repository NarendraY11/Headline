import React, { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "../hooks/useFeatureFlags";
import { isPaidActive } from "../lib/plan";

// Define the global adsbygoogle array
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

// Load the AdSense library on demand — only the first time an ad-eligible slot
// actually mounts — instead of eagerly in index.html for every visitor. This
// keeps the heavy third-party script off the initial load / main thread.
let adsenseScriptPromise: Promise<void> | null = null;
function ensureAdsenseLoaded(): Promise<void> {
  if (adsenseScriptPromise) return adsenseScriptPromise;
  adsenseScriptPromise = new Promise<void>((resolve, reject) => {
    const client = import.meta.env.VITE_ADSENSE_CLIENT;
    const existing = document.querySelector('script[data-adsbygoogle-loader]');
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js${client ? `?client=${client}` : ""}`;
    s.setAttribute("data-adsbygoogle-loader", "true");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("AdSense script failed to load"));
    document.head.appendChild(s);
  });
  return adsenseScriptPromise;
}

interface AdSlotProps {
  className?: string;
  slotId?: string;
  format?: "auto" | "fluid" | "rectangle";
  responsive?: boolean;
}

export const AdSlot: React.FC<AdSlotProps> = ({ 
  className = "", 
  slotId = import.meta.env.VITE_ADSENSE_SLOT_DEFAULT,
  format = "auto",
  responsive = true
}) => {
  const { user } = useAuth();
  const { isEnabled } = useFeature("adsense");
  const adsContainerRef = useRef<HTMLModElement>(null);
  
  // Conditionally render Ad
  // Only render if adsense flag is true AND user is NOT on a paid plan
  const showAd = isEnabled && (!user || !isPaidActive(user));

  useEffect(() => {
    if (!showAd || !adsContainerRef.current) return;
    let cancelled = false;
    ensureAdsenseLoaded()
      .then(() => {
        if (cancelled) return;
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      })
      .catch((err) => console.error("AdSense error:", err));
    return () => { cancelled = true; };
  }, [showAd]);

  if (!showAd) {
    return null;
  }

  return (
    <div className={`mt-6 mb-8 flex flex-col items-center justify-center text-center max-w-full overflow-hidden ${className}`}>
      <span className="text-[10px] uppercase tracking-widest text-muted-2 mb-2 font-mono">Advertisement</span>
      <ins
        className="adsbygoogle bg-rule/5 rounded flex w-full min-h-[100px]"
        style={{ display: "block" }}
        data-ad-client={import.meta.env.VITE_ADSENSE_CLIENT}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
        ref={adsContainerRef}
      />
    </div>
  );
};
