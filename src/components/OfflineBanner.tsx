import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// Slim "you're offline" indicator. The app stays usable offline (cached
// questions, local write-sync), so this is informational, not blocking.
export function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="anim-toast fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-full bg-ink text-bg px-4 py-2 shadow-lg font-sans text-[13px] font-medium"
    >
      <WifiOff size={14} className="shrink-0" />
      Offline — practising from your cached questions
    </div>
  );
}
