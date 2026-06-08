import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { trackEvent } from "../../lib/track";
import { posthogPageview } from "../../lib/posthog";


export function RouteMetaHelper() {
  useDocumentMeta();
  const location = useLocation();

  useEffect(() => {
    trackEvent("page_view", { metadata: { path: location.pathname } });
    posthogPageview(location.pathname);

    // Growth: Capture campaign referral codes (e.g., ?ref=PILOT123)
    const params = new URLSearchParams(location.search);
    const refCode = params.get("ref");
    if (refCode) {
      localStorage.setItem("referred_by_code", refCode);
    }
  }, [location.pathname, location.search]);

  return null;
}
