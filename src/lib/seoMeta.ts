import { blogMeta as blogPosts } from "../data/blogMeta";

export interface RouteMeta {
  title: string;
  description: string;
  ogImage: string;
}

export function getMetaForRoute(path: string): RouteMeta {
  let title = "Heading — Premium Aviation Exam Prep";
  let description = "Premium Aviation Exam Preparation System. Simulated flight stress training for EASA/DGCA CPL & ATPL.";
  let ogImage = "/og-image.png";

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
  } else if (path === "/qotd") {
    title = "Question of the Day — Heading";
    description = "Practice a high-fidelity mock pilot study question of the day with instant diagnostic feedback and technical logic summaries.";
  } else if (path === "/contact") {
    title = "Contact — Heading";
    description = "Get in touch with the Heading team for support, partnerships, or feedback about your pilot exam preparation.";
  } else if (path === "/a320-systems") {
    title = "A320 Systems — Heading";
    description = "Practice A320 systems ECAM and FCOM questions with deep logic explanations.";
  } else if (path === "/referral") {
    title = "Refer & Earn Free Pro Days — Heading";
    description = "Invite pilot partners to join Heading. Gifting 30 days of active Pro membership for each pilot who signs up and upgrades.";
  } else if (path === "/blog") {
    title = "Pilot Theory Blog & Syllabus Updates — Heading";
    description = "Educational articles, DGCA 2026 ground syllabus updates, and professional strategies to pass the EASA and FAA pilot theoretical knowledge tests.";
  } else if (path === "/privacy") {
    title = "Privacy Policy — Heading";
    description = "Privacy policy and data handling procedures for Heading aviation system.";
  } else if (path === "/terms") {
    title = "Terms of Service — Heading";
    description = "Terms of Service for Heading aviation test preparation platform.";
  } else if (path === "/refund") {
    title = "Refund Policy — Heading";
    description = "Subscription and refund policy terms for Heading.";
  } else if (path.startsWith("/blog/")) {
    const slug = path.substring(6);
    const post = blogPosts.find(p => p.slug === slug);
    if (post) {
      title = `${post.title} — Heading Blog`;
      description = post.description;
      // PNG, not SVG — social scrapers (FB/LinkedIn/X/Slack) don't render SVG
      // og:image. Generated alongside the SVG by scripts/generate-og-images.ts.
      ogImage = `/og-posts/${post.slug}.png`;
    } else {
      title = "Aviation Article — Heading";
      description = "Read pilot guides and airline ground school theory insights.";
    }
  } else if (path.startsWith("/quiz/")) {
    title = "Quiz — Heading";
    description = "Attempt a timed DGCA/EASA pilot theory quiz with instant feedback, negative marking, and detailed explanations for every question.";
  } else if (path.startsWith("/exams/")) {
    const examId = path.substring(7);
    if (examId === "dgca-cpl") {
      title = "DGCA CPL Exam Prep 2026 — Mock Papers & Technical Syllabus";
      description = "Pass your DGCA CPL theory papers on your first attempt. Free trial mock exams, complete Air Navigation, Meteorology, Regulations, and Technical syllabus.";
    } else if (examId === "dgca-atpl") {
      title = "DGCA ATPL Exam Prep 2026 — Mock Papers & Technical Syllabus";
      description = "Pass your DGCA ATPL theoretical knowledge examinations. High-quality mock papers for General Navigation, Aviation Meteorology, and Air Regulations.";
    } else if (examId === "easa-atpl") {
      title = "EASA ATPL Theoretical Knowledge Exam Guide & Practice Trials";
      description = "Comprehensive study guides and active simulations for EASA 14 ATPL subjects. Realistic mock trials matching actual ECQB criteria and Jeppesen map grids.";
    } else if (examId === "faa-written") {
      title = "FAA Knowledge Tests Prep — Private, Instrument & Commercial";
      description = "Master the FAA Knowledge Tests with Heading guidance. Practice Private Pilot (PAR), Instrument Rating (IRA), and Commercial (CAX) aligned with current ACS rules.";
    } else if (examId === "a320-type-rating") {
      title = "Airbus A320 Type Rating Prep — A320 Systems & FCOM Exams";
      description = "The ultimate training suite for A320 flight rating exam prep. Study flight control computers (ELAC, SEC, FAC), hydraulics, pneumatic valves, and ECAM abnormal logic.";
    } else {
      title = "Aviation Theoretical Exam Prep — Heading";
      description = "Premium licensing and aircraft-type rating theoretical preparation exams.";
    }
  }

  return { title, description, ogImage };
}
