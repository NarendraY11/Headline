import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getMetaForRoute } from "../lib/seoMeta";
import { generateJsonLd } from "../lib/jsonLd";

export function useDocumentMeta() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const { title, description, ogImage } = getMetaForRoute(path);
    const origin = window.location.origin;
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
