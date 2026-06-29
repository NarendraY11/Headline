import { blogMeta as blogPosts } from "../data/blogMeta";

const PROD_ORIGIN = "https://www.heading380.in";

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
    // ponytail: SearchAction removed — /exams/{slug} serves static landing pages, not
    // search results. Invalid SearchAction fails Google Sitelinks Searchbox validation.
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
    // ponytail: AggregateRating removed — homepage testimonials are qualitative quotes,
    // not a verifiable rated review pool. Fabricated ratingValue violates Google spam policy.
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
    schemas.push(buildSoftwareAppSchema(baseUrl));
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
          { "@type": "Offer", priceCurrency: "INR", price: "499", name: "Monthly Plan", availability: "https://schema.org/InStock" },
          { "@type": "Offer", priceCurrency: "INR", price: "2999", name: "Yearly Plan", availability: "https://schema.org/InStock" },
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
        image: {
          "@type": "ImageObject",
          url: `${baseUrl}/og-posts/${post.slug}.png`,
          width: 1200,
          height: 630,
        },
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
        "dgca-cpl":        { name: "DGCA CPL Exam Prep 2026",              desc: "Pass your DGCA CPL theory papers on your first attempt with mock exams and study diagnostics." },
        "dgca-atpl":       { name: "DGCA ATPL Exam Prep 2026",             desc: "Pass your DGCA ATPL theoretical knowledge examinations with full syllabus coverage." },
        "easa-atpl":       { name: "EASA ATPL Theoretical Knowledge Guide", desc: "Comprehensive study guides and simulations for all 14 EASA ATPL subjects." },
        "faa-written":     { name: "FAA Knowledge Tests Prep",              desc: "Master FAA Knowledge Tests for Private, Instrument, and Commercial ratings." },
        "a320-type-rating":{ name: "Airbus A320 Type Rating Prep",          desc: "Study A320 systems, ECAM abnormal logic, and FCOM procedures for type rating exams." },
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

      const EXAM_FAQ: Record<string, FaqQnA[]> = {
        "dgca-cpl": [
          {
            question: "How many papers are in the DGCA CPL theoretical knowledge examination?",
            answer:
              "The DGCA CPL theory examination has six papers: Air Navigation, Aviation Meteorology, Air Regulation, Technical General, Technical Specific, and RTR(A). Heading currently offers active mock papers for Air Navigation (450+ questions across General Navigation, Radio Navigation, and Aircraft Instruments), Aviation Meteorology, and Air Regulation. Technical General and Technical Specific content is under development.",
          },
          {
            question: "What is the pass mark for DGCA CPL theory, and does negative marking apply?",
            answer:
              "Most DGCA CPL papers require a minimum 70% score to pass. Negative marking applies at −0.25 marks per wrong answer. Heading mock papers simulate this exact cutoff and deduction rule so you experience real exam pressure before the actual test.",
          },
          {
            question: "How is the Air Navigation paper structured in Heading's DGCA CPL mock?",
            answer:
              "Heading splits Air Navigation into three sub-topics matching the DGCA syllabus: General Navigation (200 questions), Radio Navigation (150 questions), and Aircraft Instruments (100 questions). Full mock papers sample all three in the official ratio with a 120-minute limit and 70% pass threshold.",
          },
          {
            question: "Does Heading cover RTR(A) for the DGCA CPL licence?",
            answer:
              "RTR(A) content is on the Heading roadmap. The current active subjects are Air Navigation, Aviation Meteorology, and Air Regulation. RTR(A) questions covering radio telephony operations and aviation phraseology will be published ahead of the 2026 exam season.",
          },
          {
            question: "Can I study for the DGCA CPL on a mobile device or offline?",
            answer:
              "Yes. Heading is a Progressive Web App (PWA) installable on iOS and Android with no app store required. Bookmarks and recent quiz sessions cache locally, so you can practise offline. AI Instructor features require an active internet connection.",
          },
        ],

        "dgca-atpl": [
          {
            question: "How does the DGCA ATPL theory examination differ from the CPL?",
            answer:
              "The DGCA ATPL builds on all CPL theory subjects and adds advanced coverage of airline performance, multi-engine systems, high-altitude meteorology, and operational procedures at airline scale. Completion of all DGCA CPL theory papers is a prerequisite before appearing for the ATPL.",
          },
          {
            question: "What pass mark is required for each DGCA ATPL theory paper?",
            answer:
              "DGCA ATPL papers require a minimum 70% score per subject. The same negative-marking rule as CPL applies: +1 mark per correct answer and −0.25 for each wrong answer. Heading's full-paper mock mode replicates these conditions so you can calibrate your pacing and guessing strategy.",
          },
          {
            question: "Which ATPL-specific subjects does Heading cover that are not in the CPL?",
            answer:
              "The DGCA ATPL syllabus extends CPL content with deeper Principles of Flight (swept-wing aerodynamics, high-speed flight), advanced Performance and Mass & Balance calculations, and Operational Procedures at airline level. Heading layers these additional topics on top of the active CPL subjects in the same adaptive study interface.",
          },
          {
            question: "How many questions are in a typical DGCA ATPL mock paper on Heading?",
            answer:
              "Full ATPL mock papers on Heading contain 60–100 questions per subject, with time limits of 90–120 minutes per section matching DGCA examination structure. Multi-subject sessions are also available to test cross-topic readiness in a single sitting.",
          },
          {
            question: "Does Heading include VIVA oral preparation for the DGCA ATPL?",
            answer:
              "Yes. The VIVA module presents oral-style questions drawn from the ATPL syllabus — covering procedures, system logic, and regulation scenarios in the format used by DGCA-approved examiners. Sessions are self-assessed and can be repeated until you match examiner-level expectation.",
          },
        ],

        "easa-atpl": [
          {
            question: "How many subjects are in the EASA Part-FCL ATPL theoretical knowledge examination?",
            answer:
              "The EASA ATPL comprises 14 subjects: Air Law, AGK Systems, AGK Instrumentation, Mass & Balance, Performance, Flight Planning & Monitoring, Human Performance, Meteorology, General Navigation, Radio Navigation, Operational Procedures, Principles of Flight, VFR & IFR Communications, and Instrument Flight Procedures. Heading covers all 14, with active question banks currently live for Principles of Flight and General Navigation.",
          },
          {
            question: "What is the EASA ATPL pass mark and how long are subject passes valid?",
            answer:
              "Each EASA ATPL subject requires a minimum 75% score. A pass in any single subject is valid for 18 months. All 14 subjects must be passed within a 36-month window from the date of the first pass. Heading's analytics track your subject-level completion dates to help you manage these validity windows.",
          },
          {
            question: "Are Heading's EASA questions drawn from the official ECQB question bank?",
            answer:
              "Heading questions are aligned with the EASA ECQB learning objectives but are not licensed ECQB reproductions. They are written to test the same concepts, referencing the same Jeppesen, Oxford, and ATPL training framework sources, so the cognitive level and question style closely match what you encounter in an EASA-approved ATO examination room.",
          },
          {
            question: "Which EASA ATPL subjects have the lowest pass rates and how does Heading target them?",
            answer:
              "General Navigation, Radio Navigation, and Principles of Flight historically have the lowest first-attempt pass rates under EASA. Heading applies adaptive spaced repetition for these subjects, weighting weak sub-topics (chart projections, VOR/DME geometry, swept-wing aerodynamics, compressibility effects) heavily in your next session so you spend time where it matters most.",
          },
          {
            question: "Can an Indian cadet studying in India use Heading for EASA ATPL preparation?",
            answer:
              "Yes. EASA Part-FCL theoretical knowledge preparation is geography-independent. Heading supports both EASA and DGCA syllabi in the same platform, making it suitable for Indian cadets pursuing EASA licences through approved ATO programmes in Europe or approved distance-learning arrangements.",
          },
        ],

        "faa-written": [
          {
            question: "Which FAA Knowledge Tests does Heading prepare you for?",
            answer:
              "Heading covers preparation for the Private Pilot (PAR), Instrument Rating (IRA), and Commercial Pilot (CAX) FAA Knowledge Tests, plus the Airline Transport Pilot (ATP) written. Question sets reference the FAA Airman Certification Standards (ACS) and are updated when FAA revises its test specifications.",
          },
          {
            question: "What is the passing score for FAA Knowledge Tests, and is there negative marking?",
            answer:
              "All FAA Knowledge Tests require a minimum 70% score. Unlike EASA and DGCA exams, the FAA does not apply negative marking — unanswered or incorrect questions score zero. Heading's FAA mode replicates this: no deduction for wrong answers, with the focus on accuracy rather than penalised guessing.",
          },
          {
            question: "How many questions are in the FAA Private Pilot and Commercial Pilot Knowledge Tests?",
            answer:
              "The FAA Private Pilot written (PAR) contains 60 questions with a 2.5-hour limit. The Commercial Pilot (CAX) contains 100 questions with a 3-hour limit. Heading mock papers replicate these structures, sampling from across aerodynamics, regulations, weather, and navigation topics at the same difficulty distribution FAA publishes.",
          },
          {
            question: "Does Heading include sectional chart and instrument approach plate questions for the IRA?",
            answer:
              "Yes. FAA sectional chart interpretation, IFR en-route chart reading, and instrument approach plate questions are included in the Instrument Rating (IRA) preparation module. Chart-based questions are the highest-difficulty item type in IRA testing, and Heading provides annotated explanations referencing the chart legend for every figure-based question.",
          },
          {
            question: "How current are the FAA regulation questions in Heading — do they reflect the latest ACS revision?",
            answer:
              "Heading's FAA question content is reviewed against the current edition of the ACS documents published by the FAA. When FAA issues ACS amendments (typically tracked at faa.gov/training_testing), the affected questions are flagged and updated. The content version date is shown in the subject header inside the app.",
          },
        ],

        "a320-type-rating": [
          {
            question: "Which ATA chapters does the Heading A320 module cover?",
            answer:
              "Heading covers 16 ATA chapters with 1,478 questions in total: ATA 21 Air Conditioning (84 questions), ATA 22 Auto Flight (142), ATA 23 Communications (58), ATA 24 Electrical Power (96), ATA 26 Fire Protection (64), ATA 27 Flight Controls (188), ATA 28 Fuel (72), ATA 29 Hydraulic Power (108), ATA 30 Ice & Rain Protection (54), ATA 32 Landing Gear (86), ATA 33 Lights (32), ATA 34 Navigation (124), ATA 36 Pneumatic (68), ATA 49 APU (58), ATA 70 Powerplant CFM56 (162), and ATA 73 Engine Fuel & Control (78).",
          },
          {
            question: "How does Heading simulate A320 ECAM abnormal procedure questioning?",
            answer:
              "The ECAM abnormal section presents system failure scenarios drawn from FCOM Chapter 3 procedures. Questions test recall of the corrective action sequence, affected LRUs, inhibition logic, and crew coordination steps — matching the oral questioning format used by type rating examiners during simulator debrief sessions.",
          },
          {
            question: "How is ATA 27 Flight Controls structured in Heading, and does it cover degraded law modes?",
            answer:
              "ATA 27 is the largest module with 188 questions covering ELAC and SEC computer architecture, surface authority limits, and all three flight control law modes: Normal, Alternate, and Direct. Degraded law transitions, alpha protection logic, and ground spoiler arming conditions are all tested with schematic-based questions that reproduce FCOM figure formats.",
          },
          {
            question: "Does Heading's A320 content apply to the A319 and A321 variants?",
            answer:
              "Yes. The A320ceo and neo family (A318, A319, A320, A321) shares the same fly-by-wire architecture, ECAM philosophy, and FCOM structure. Heading content is applicable across CFM56-5B and CFM56-5A powered variants. IAE V2500 variant-specific differences are noted where they diverge from CFM56 behaviour.",
          },
          {
            question: "What pass rate should I target for an A320 type rating ground examination?",
            answer:
              "Most A320 type rating ground school exams set an 80–90% pass threshold. Heading's difficulty distribution across ATA chapters reflects this target: questions are graded standard, complex, and extreme, allowing you to drill the chapters most frequently tested by examiners — particularly ATA 22 Auto Flight, ATA 27 Flight Controls, and ATA 29 Hydraulics.",
          },
          {
            question: "Does Heading prepare me for the A320 type rating simulator check, or only the ground exam?",
            answer:
              "Heading prepares you for the theoretical ground examination component of the type rating. Simulator procedural handling — SID, STAR, non-precision approaches, and engine-out drills — requires actual sim hours with an approved training organisation. Heading's VIVA module is designed to rehearse the oral debrief style examiners use after each sim session.",
          },
        ],
      };

      const faqEntries = EXAM_FAQ[examId] ?? [
        {
          question: `How closely do Heading's questions match the real ${meta.name} exam?`,
          answer:
            "Heading mock exams mirror official syllabus weighting, negative-marking rules, and section timing. Questions are continuously updated against the latest published exam guidance.",
        },
        {
          question: "Can I track my readiness score before the real exam?",
          answer:
            "Yes. The Analytics dashboard shows per-subject mastery scores, weak-area flags, and a pass-probability estimate updated after every practice session.",
        },
      ];

      schemas.push(buildFaqSchema(faqEntries));
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
