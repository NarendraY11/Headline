import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useDocumentMeta() {
  const location = useLocation();

  useEffect(() => {
    let title = "Heading — Premium Aviation Exam Prep";
    let description = "Premium Aviation Exam Preparation System. Simulated flight stress training for EASA/DGCA CPL & ATPL.";

    const path = location.pathname;

    if (path === "/") {
      title = "Heading — DGCA, EASA & A320 Exam Prep for Pilots";
      description = "Syllabus-aligned preparation for standard EASA and DGCA pilot theoretical training. Practice mock theoretical trials and check active study logs.";
    } else if (path === "/pricing") {
      title = "Pricing — Heading";
      description = "Premium pilot examination study access and CADET features. Review plans and complete your navigation, systems, and stress training.";
    } else if (path === "/modules") {
      title = "Question Bank — Heading";
      description = "Detailed question prep logs, complete aviation quiz banks covering navigation, flight instruments, meteorology, and A320 ECAM systems.";
    } else if (path === "/mock-exams") {
      title = "Mock Exams — Heading";
      description = "Take realistic pilot mock examinations with negative marking. Strict EASA/DGCA cutoffs, section counts, and real-time flight stress cabin simulation.";
    } else if (path === "/about") {
      title = "About — Heading";
      description = "Explore standard hardware guidelines, aviation designs, and calibration specs including the classic amber paper theme and cognitive metrics.";
    }

    // Update document title
    document.title = title;

    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute("content", description);

    // Update Open Graph Dynamic Tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute("content", title);
    }
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute("content", description);
    }
    
    // Update Twitter Dynamic Tags
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
      twitterTitle.setAttribute("content", title);
    }
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescription) {
      twitterDescription.setAttribute("content", description);
    }
  }, [location.pathname]);
}
