import { blogPosts } from "../data/blog";

export function buildFaqSchema(qnas: {question: string, answer: string}[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": qnas.map(qna => ({
      "@type": "Question",
      "name": qna.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": qna.answer
      }
    }))
  };
}

export function generateJsonLd(path: string): object[] {
  // @ts-ignore
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_PUBLIC_URL;
  // Prefer an explicit public URL, then the actual origin we're served from,
  // and only fall back to a literal as a last resort (was wrongly www.heading.com).
  const baseUrl =
    envUrl ||
    (typeof window !== "undefined" && window.location?.origin) ||
    "https://headline-blush.vercel.app";
  
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Heading",
    "url": baseUrl,
    "logo": `${baseUrl}/favicon.svg`
  };

  const breadcrumbs: any[] = [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": baseUrl }
  ];

  const buildBreadcrumb = (name: string, url: string) => {
    breadcrumbs.push({
      "@type": "ListItem",
      "position": breadcrumbs.length + 1,
      "name": name,
      "item": `${baseUrl}${url}`
    });
  };

  const schemas: any[] = [orgSchema];

  if (path === "/") {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Course",
      "name": "Heading Pilot Exam Prep",
      "description": "Premium pilot exam preparation system. Realistic mock exams with negative marking for EASA & DGCA licenses.",
      "provider": {
        "@type": "Organization",
        "name": "Heading",
        "sameAs": baseUrl
      }
    });
  } else if (path === "/pricing") {
    buildBreadcrumb("Pricing", path);
    schemas.push({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Heading Pro Access",
        "description": "Premium pilot examination study access.",
        "offers": {
          "@type": "AggregateOffer",
          "priceCurrency": "INR",
          "lowPrice": "499",
          "highPrice": "2999",
          "offerCount": 2,
          "offers": [
            {
              "@type": "Offer",
              "priceCurrency": "INR",
              "price": "499",
              "name": "Monthly Plan"
            },
            {
              "@type": "Offer",
              "priceCurrency": "INR",
              "price": "2999",
              "name": "Yearly Plan"
            }
          ]
        }
    });
  } else if (path.startsWith("/blog/")) {
    const slug = path.substring(6);
    const post = blogPosts.find(p => p.slug === slug);
    buildBreadcrumb("Blog", "/blog");
    if (post) {
      buildBreadcrumb(post.title, path);
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": post.title,
        "datePublished": post.date,
        "author": {
          "@type": "Person",
          "name": "Heading Aviation"
        },
        "image": `${baseUrl}/og-posts/${post.slug}.svg`
      });
    }
  } else if (path.startsWith("/blog")) {
    buildBreadcrumb("Blog", "/blog");
  } else if (path.startsWith("/exams/")) {
    buildBreadcrumb("Exams", "/exams");
    const parts = path.substring(7).split("/").filter(Boolean);
    let currentPath = "/exams";
    parts.forEach(part => {
      currentPath += `/${part}`;
      buildBreadcrumb(part.toUpperCase().replace(/-/g, " "), currentPath);
    });
    
    // Only add course and FAQ schemas for the main exam landing pages (1 segment deep)
    if (parts.length === 1) {
      const examId = parts[0];
      let courseName = "Aviation Exam Prep";
      let desc = "Theoretical preparation exams.";
      if (examId === "dgca-cpl") { courseName = "DGCA CPL Exam Prep 2026"; desc = "Pass your DGCA CPL theory papers on your first attempt."; }
      else if (examId === "dgca-atpl") { courseName = "DGCA ATPL Exam Prep 2026"; desc = "Pass your DGCA ATPL theoretical knowledge examinations."; }
      else if (examId === "easa-atpl") { courseName = "EASA ATPL Exam Guide"; desc = "Comprehensive study guides and active simulations for EASA 14 ATPL subjects."; }
      else if (examId === "faa-written") { courseName = "FAA Knowledge Tests Prep"; desc = "Master the FAA Knowledge Tests with Heading guidance."; }
      else if (examId === "a320-type-rating") { courseName = "Airbus A320 Type Rating Prep"; desc = "The ultimate training suite for A320 flight rating exam prep."; }

      schemas.push({
        "@context": "https://schema.org",
        "@type": "Course",
        "name": courseName,
        "description": desc,
        "provider": {
          "@type": "Organization",
          "name": "Heading",
          "sameAs": baseUrl
        }
      });

      schemas.push(buildFaqSchema([
        { question: `How closely do the questions match the real ${examId.toUpperCase().replace("-", " ")} exam?`, answer: "Our mock exams are constantly updated to reflect the latest syllabus and question patterns for the most accurate simulation possible." },
        { question: "What topics are covered in this preparation?", answer: "All required subjects including Air Navigation, Meteorology, Regulations, and specific Technical areas are comprehensively covered." },
        { question: "Can I track my progress?", answer: "Yes, our Analytics dashboard provides detailed insights into your performance across different subcategories to help you target weak areas." }
      ]));
    }
  } else if (path.startsWith("/topic/")) {
    buildBreadcrumb("Topic Modules", "/modules");
    const parts = path.substring(7).split("/").filter(Boolean);
    let currentPath = "/topic";
    parts.forEach(part => {
      currentPath += `/${part}`;
      buildBreadcrumb(part.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '), currentPath);
    });
  } else {
    const parts = path.split("/").filter(Boolean);
    let currentPath = "";
    parts.forEach(part => {
      currentPath += `/${part}`;
      buildBreadcrumb(part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '), currentPath);
    });
  }

  schemas.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs
  });

  return schemas;
}
