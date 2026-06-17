import { blogPosts } from "../data/blog";

const PROD_ORIGIN = "https://headline-blush.vercel.app";

function getBaseUrl(): string {
  // @ts-ignore
  const envUrl = typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_PUBLIC_URL;
  if (envUrl) return envUrl;
  if (typeof window !== "undefined") {
    const o = window.location.origin;
    return /localhost|127\.0\.0\.1/.test(o) ? PROD_ORIGIN : o;
  }
  return PROD_ORIGIN;
}

// ─── Typed schema builder helpers ────────────────────────────────────────────

export interface FaqQnA {
  question: string;
  answer: string;
}

export function buildFaqSchema(qnas: FaqQnA[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qnas.map((qna) => ({
      "@type": "Question",
      name: qna.question,
      acceptedAnswer: { "@type": "Answer", text: qna.answer },
    })),
  };
}

function buildOrgSchema(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    name: "Heading",
    url: baseUrl,
    logo: `${baseUrl}/favicon.svg`,
    sameAs: [
      "https://twitter.com/headingaviation",
      "https://www.instagram.com/headingaviation",
    ],
  };
}

function buildWebSiteSchema(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    url: baseUrl,
    name: "Heading — Pilot Exam Prep",
    publisher: { "@id": `${baseUrl}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${baseUrl}/exams/{search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

function buildSoftwareAppSchema(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Heading — Pilot Exam Prep",
    applicationCategory: "EducationApplication",
    operatingSystem: "Web, iOS, Android",
    url: baseUrl,
    description:
      "Premium pilot exam preparation system. Realistic mock exams with negative marking for EASA & DGCA licenses.",
    offers: [
      { "@type": "Offer", price: "0", priceCurrency: "INR", name: "Cadet (Free)" },
      { "@type": "Offer", price: "499", priceCurrency: "INR", name: "Captain Monthly" },
      { "@type": "Offer", price: "2999", priceCurrency: "INR", name: "Captain Yearly" },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "230",
    },
  };
}

// ─── Per-route FAQ data ───────────────────────────────────────────────────────

export const HOME_FAQ: FaqQnA[] = [
  {
    question: "Which official pilot syllabi does Heading cover?",
    answer:
      "Heading covers EASA Part-FCL and Indian DGCA curricula for CPL and ATPL theory. Both standard and negative-marking environments are supported. You can select your regulatory region during account setup.",
  },
  {
    question: "Can I use Heading offline?",
    answer:
      "Yes. Bookmarks and recent quizzes are cached locally. You can attempt mock exams without Wi-Fi. AI Instructor features require an active data connection.",
  },
  {
    question: "Does Heading support A320 Type Rating preparation?",
    answer:
      "Yes. A320 modules cover ATA chapters, ECAM abnormal logic, and FCOM procedures — suitable for cadets entering their first transition course or captains preparing for recurrent simulator checks.",
  },
  {
    question: "Is there a refund policy for the Pro plan?",
    answer:
      "Yes. If you are unsatisfied within the first 7 days, Heading issues an immediate no-questions-asked refund.",
  },
];

// ─── Main per-route schema generator ─────────────────────────────────────────

export function generateJsonLd(path: string): object[] {
  const baseUrl = getBaseUrl();

  const breadcrumbs: { "@type": string; position: number; name: string; item: string }[] = [
    { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
  ];

  const pushBc = (name: string, url: string) => {
    breadcrumbs.push({
      "@type": "ListItem",
      position: breadcrumbs.length + 1,
      name,
      item: `${baseUrl}${url}`,
    });
  };

  const schemas: object[] = [buildOrgSchema(baseUrl), buildWebSiteSchema(baseUrl)];

  if (path === "/") {
    schemas.push(buildSoftwareAppSchema(baseUrl));
    schemas.push(buildFaqSchema(HOME_FAQ));
  } else if (path === "/pricing") {
    pushBc("Pricing", path);
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Heading Captain Pro Access",
      description: "Premium pilot examination study access for EASA & DGCA syllabi.",
      brand: { "@type": "Brand", name: "Heading" },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "INR",
        lowPrice: "499",
        highPrice: "2999",
        offerCount: 2,
        offers: [
          { "@type": "Offer", priceCurrency: "INR", price: "499", name: "Monthly Plan" },
          { "@type": "Offer", priceCurrency: "INR", price: "2999", name: "Yearly Plan" },
        ],
      },
    });
  } else if (path === "/about") {
    pushBc("About", path);
  } else if (path === "/contact") {
    pushBc("Contact", path);
  } else if (path === "/blog") {
    pushBc("Blog", path);
  } else if (path.startsWith("/blog/")) {
    const slug = path.substring(6);
    const post = blogPosts.find((p) => p.slug === slug);
    pushBc("Blog", "/blog");
    if (post) {
      pushBc(post.title, path);
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.date,
        author: {
          "@type": "Person",
          name: post.author,
          jobTitle: post.authorRole,
        },
        publisher: { "@id": `${baseUrl}/#organization` },
        image: `${baseUrl}/og-posts/${post.slug}.png`,
        url: `${baseUrl}${path}`,
        mainEntityOfPage: { "@type": "WebPage", "@id": `${baseUrl}${path}` },
      });
    }
  } else if (path.startsWith("/exams/")) {
    pushBc("Exams", "/exams");
    const parts = path.substring(7).split("/").filter(Boolean);
    let currentPath = "/exams";
    parts.forEach((part) => {
      currentPath += `/${part}`;
      pushBc(part.toUpperCase().replace(/-/g, " "), currentPath);
    });

    if (parts.length === 1) {
      const examId = parts[0];
      const EXAM_META: Record<string, { name: string; desc: string }> = {
        "dgca-cpl": { name: "DGCA CPL Exam Prep 2026", desc: "Pass your DGCA CPL theory papers on your first attempt with mock exams and study diagnostics." },
        "dgca-atpl": { name: "DGCA ATPL Exam Prep 2026", desc: "Pass your DGCA ATPL theoretical knowledge examinations with full syllabus coverage." },
        "easa-atpl": { name: "EASA ATPL Theoretical Knowledge Guide", desc: "Comprehensive study guides and simulations for all 14 EASA ATPL subjects." },
        "faa-written": { name: "FAA Knowledge Tests Prep", desc: "Master FAA Knowledge Tests for Private, Instrument, and Commercial ratings." },
        "a320-type-rating": { name: "Airbus A320 Type Rating Prep", desc: "Study A320 systems, ECAM abnormal logic, and FCOM procedures for type rating exams." },
      };
      const meta = EXAM_META[examId] ?? { name: "Aviation Exam Prep", desc: "Theoretical preparation exams." };

      schemas.push({
        "@context": "https://schema.org",
        "@type": "Course",
        name: meta.name,
        description: meta.desc,
        provider: { "@type": "Organization", name: "Heading", sameAs: baseUrl },
        url: `${baseUrl}${path}`,
        educationalLevel: "Professional",
        inLanguage: "en",
      });

      schemas.push(
        buildFaqSchema([
          {
            question: `How closely do Heading's questions match the real ${meta.name} exam?`,
            answer:
              "Heading mock exams mirror official syllabus weighting, negative-marking rules, and section timing. Questions are continuously updated against the latest published exam guidance.",
          },
          {
            question: `What subjects are covered in ${meta.name} preparation?`,
            answer:
              "All required subjects are covered including Air Navigation, Aviation Meteorology, Air Law, Flight Performance, Aircraft General Knowledge, and Human Performance.",
          },
          {
            question: "Can I track my readiness score before the real exam?",
            answer:
              "Yes. The Analytics dashboard shows per-subject mastery scores, weak-area flags, and a pass-probability estimate updated after every practice session.",
          },
        ])
      );
    }
  } else if (path.startsWith("/topic/")) {
    pushBc("Question Bank", "/modules");
    const parts = path.substring(7).split("/").filter(Boolean);
    let currentPath = "/topic";
    parts.forEach((part) => {
      currentPath += `/${part}`;
      pushBc(
        part.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        currentPath
      );
    });
  } else {
    const parts = path.split("/").filter(Boolean);
    let currentPath = "";
    parts.forEach((part) => {
      currentPath += `/${part}`;
      pushBc(part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " "), currentPath);
    });
  }

  schemas.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs,
  });

  return schemas;
}
