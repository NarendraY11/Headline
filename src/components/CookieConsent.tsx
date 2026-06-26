import { ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "./Atoms";
import { posthogConsentGranted, posthogConsentDeclined } from "../lib/posthog";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("heading_cookie_consent");
      if (!consent) {
        // Show after a subtle delay for UX elegance
        const timer = setTimeout(() => {
          setVisible(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn("Storage access failed for cookie consent check:", e);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem("heading_cookie_consent", "true");
    } catch (e) {
      console.warn("Failed to write cookie consent state:", e);
    }
    posthogConsentGranted();
    window.dispatchEvent(new CustomEvent("heading:cookieConsent", { detail: { consent: true } }));
    setVisible(false);
  };

  const handleDecline = () => {
    try {
      localStorage.setItem("heading_cookie_consent", "declined");
    } catch (e) {
      console.warn("Failed to write cookie consent state:", e);
    }
    posthogConsentDeclined();
    setVisible(false);
  };

  return (
    <>
      {visible && (
        <div
          data-md-skip="true"
          className="anim-pop fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:max-w-md z-9999 origin-bottom-right"
        >
          <div className="bg-paper border border-rule-strong shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-5 md:p-6 rounded-sm space-y-4 font-sans">
            <div className="flex items-start gap-3">
              <div className="bg-signal/10 p-2 rounded-sm text-signal shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div className="space-y-1">
                <h5 className="font-serif font-medium text-sm text-ink leading-tight">Consent Settings</h5>
                <span className="font-mono text-[10px] text-muted tracking-widest uppercase block">REGULATORY TRANSPARENCY</span>
              </div>
              <button 
                onClick={handleDecline} 
                className="ml-auto text-muted hover:text-ink transition-colors p-1 -m-1"
                aria-label="Dismiss consent notice"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed font-light">
              We employ cookie identifiers to personalize Google AdSense advertisements, deliver secure Google OAuth sessions, 
              and analyze our ground school study traffic. By clicking <strong>"Accept Calibrated Cookies"</strong>, you consent to our cooperative 
              networks in alignment with our <Link to="/privacy" className="text-ink hover:underline font-normal">Privacy Policy</Link> and <Link to="/terms" className="text-ink hover:underline font-normal">Terms of Conditions</Link>.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <Button 
                variant="primary" 
                onClick={handleAccept} 
                className="flex-1 h-9 text-xs font-semibold"
              >
                Accept Calibrated Cookies
              </Button>
              <button 
                onClick={handleDecline} 
                className="text-xs text-muted hover:text-ink font-mono underline transition-colors px-2 py-1"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
