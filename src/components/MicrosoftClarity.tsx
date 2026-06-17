import { useEffect } from "react";
import { clarityConsentGranted, initClarity } from "../lib/clarity";

// Mounts in App.tsx (alongside CookieConsent). Fires initClarity on mount —
// which is a no-op if the user hasn't consented yet. CookieConsent calls
// clarityConsentGranted() when the user accepts, which injects the script at
// that point instead. The script itself is inserted asynchronously and does
// not block rendering.
export function MicrosoftClarity() {
  useEffect(() => {
    initClarity();

    // Listen for consent granted by CookieConsent component
    function onConsent(e: CustomEvent) {
      if (e.detail?.consent === true) {
        clarityConsentGranted();
      }
    }
    window.addEventListener("heading:cookieConsent" as any, onConsent);
    return () => window.removeEventListener("heading:cookieConsent" as any, onConsent);
  }, []);

  return null;
}
