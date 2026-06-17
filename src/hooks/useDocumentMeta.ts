import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getMetaForRoute } from "../lib/seoMeta";
import { generateJsonLd } from "../lib/jsonLd";

export function useDocumentMeta() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const { title, description, ogImage } = getMetaForRoute(path);
    // Canonical/OG URLs must always use the production origin. During the
    // build-time prerender the page is served from http://localhost:5555, so
    // window.location.origin would bake "localhost" into the canonical, og:url
    // and og:image of every static snapshot. Pin the public origin instead;
    // fall back to window.location.origin only for non-prod hosts (preview).
    const PROD_ORIGIN = "https://www.heading380.in";
    const runtimeOrigin =
      typeof window !== "undefined" ? window.location.origin : PROD_ORIGIN;
    const isLocalhost = /localhost|127\.0\.0\.1/.test(runtimeOrigin);
    const origin = isLocalhost ? PROD_ORIGIN : runtimeOrigin;
    const canonicalUrl = `${origin}${path}`;

    // Update document title
    document.title = title;

    // Direct helper to set or create meta/link tags
    const setElementAttr = (tag: string, selector: string, attrName: string, attrVal: string, contentAttr: string, contentVal: string) => {
      let elem = document.querySelector(selector);
      if (!elem) {
        elem = document.createElement(tag);
        elem.setAttribute(attrName, attrVal);
        document.head.appendChild(elem);
      }
      elem.setAttribute(contentAttr, contentVal);
    };

    // Update canonical link URL
    setElementAttr("link", 'link[rel="canonical"]', "rel", "canonical", "href", canonicalUrl);

    // Robots: the site-wide default in index.html is index,follow. Authed,
    // admin, and transactional routes must NOT be indexed (they only ever
    // render the login/app shell to a crawler). Flip the meta per-route.
    const NONPUBLIC_PREFIXES = [
      "/login", "/reset-password", "/today", "/modules", "/topic",
      "/mock-exams", "/analytics", "/bookmarks", "/profile", "/referral",
      "/quiz", "/admin", "/dashboard",
    ];
    const isNonPublic = NONPUBLIC_PREFIXES.some(
      (p) => path === p || path.startsWith(p + "/")
    );
    setElementAttr(
      "meta", 'meta[name="robots"]', "name", "robots", "content",
      isNonPublic ? "noindex, follow" : "index, follow"
    );

    // Update Meta Description
    setElementAttr("meta", 'meta[name="description"]', "name", "description", "content", description);

    // Open Graph dynamic tags
    setElementAttr("meta", 'meta[property="og:title"]', "property", "og:title", "content", title);
    setElementAttr("meta", 'meta[property="og:description"]', "property", "og:description", "content", description);
    setElementAttr("meta", 'meta[property="og:url"]', "property", "og:url", "content", canonicalUrl);
    const ogType = /^\/blog\/.+/.test(path) ? "article" : "website";
    setElementAttr("meta", 'meta[property="og:type"]', "property", "og:type", "content", ogType);
    setElementAttr("meta", 'meta[property="og:image"]', "property", "og:image", "content", ogImage.startsWith("http") ? ogImage : `${origin}${ogImage}`);

    // Twitter card tags
    setElementAttr("meta", 'meta[name="twitter:card"]', "name", "twitter:card", "content", "summary_large_image");
    setElementAttr("meta", 'meta[name="twitter:title"]', "name", "twitter:title", "content", title);
    setElementAttr("meta", 'meta[name="twitter:description"]', "name", "twitter:description", "content", description);
    setElementAttr("meta", 'meta[name="twitter:image"]', "name", "twitter:image", "content", ogImage.startsWith("http") ? ogImage : `${origin}${ogImage}`);

    // Inject JSON-LD
    let scriptElem = document.querySelector('script[type="application/ld+json"]');
    if (!scriptElem) {
      scriptElem = document.createElement("script");
      scriptElem.setAttribute("type", "application/ld+json");
      document.head.appendChild(scriptElem);
    }
    const jsonLdData = generateJsonLd(path);
    scriptElem.textContent = JSON.stringify(jsonLdData);

  }, [location.pathname]);
}
