import { questionBank } from "./questions";

export interface ExamSimulation {
  id: string;
  code: string;
  subject: string;
  minutes: number;
  questions: number;
  passingScore: number;
  difficulty: "standard" | "complex" | "extreme";
}

export const mockExams: ExamSimulation[] = [
  {
    id: "nav-cpl-01",
    code: "REG-NAV-CPL",
    subject: "Aviation General Navigation Mock 4",
    minutes: 120,
    questions: 100,
    passingScore: 70,
    difficulty: "complex",
  },
  {
    id: "met-atpl-01",
    code: "REG-MET-ATPL",
    subject: "General Climatology & High Altitude Fronts 1",
    minutes: 60,
    questions: 50,
    passingScore: 75,
    difficulty: "standard",
  },
  {
    id: "ops-cpl-02",
    code: "REG-OPS-CPL",
    subject: "Aviation Operational & Dispatch Rules 2",
    minutes: 90,
    questions: 60,
    passingScore: 70,
    difficulty: "standard",
  },
  {
    id: "agk-atpl-03",
    code: "REG-AGK-ATPL",
    subject: "Turboprop Engines & Gas Turbine Systems 3",
    minutes: 120,
    questions: 80,
    passingScore: 75,
    difficulty: "extreme",
  },
];

export interface SubTopic {
  id: string;
  code?: string;
  title: string;
  questionCount: number;
  status: "reviewed" | "in-progress" | "new";
  description?: string;
  spec?: { label: string; value: string }[];
  figure?: { caption: string; source: string; type: string };
  sections?: { id: string; title: string; description: string }[];
  free_chapter?: boolean;
}

export interface SubjectItem {
  id: string;
  num: string;
  title: string;
  questionCount: number;
  mastery: number; // 0..1
  hue: "navy" | "signal" | "amber" | "sky" | "mint";
  blurb: string;
  status: "active" | "coming-soon";
  tags: { label: string; variant: "default" | "solid" | "signal" | "amber" | "mint" | "sky" }[];
  subTopics?: SubTopic[];
  exam_authority?: "DGCA" | "EASA" | "FAA" | "TYPE_RATING" | string;
  license?: "PPL" | "CPL" | "ATPL" | "IR" | "TYPE" | string;
  sort_order?: number;
  is_free?: boolean;
}

export const rawSubjects: SubjectItem[] = [
  // DGCA CPL Subjects
  {
    id: "air-navigation",
    num: "01",
    title: "Air Navigation",
    questionCount: 450,
    mastery: 0.25,
    hue: "navy",
    blurb: "General Navigation, Radio Navigation, and Aircraft Instruments for DGCA CPL.",
    status: "active",
    exam_authority: "DGCA",
    license: "CPL",
    sort_order: 1,
    tags: [{ label: "DGCA CPL", variant: "default" }, { label: "COMPLEX", variant: "amber" }],
    subTopics: [
      { id: "nav-gen", title: "General Navigation", questionCount: 200, status: "in-progress" },
      { id: "nav-rad", title: "Radio Navigation", questionCount: 150, status: "new" },
      { id: "nav-inst", title: "Aircraft Instruments", questionCount: 100, status: "reviewed" },
    ]
  },
  {
    id: "meteorology",
    num: "02",
    title: "Aviation Meteorology",
    questionCount: 100,
    mastery: 0.45,
    hue: "sky",
    blurb: "Aviation weather reports, atmospheric structure, ice, wind, and cloud masses.",
    status: "active",
    exam_authority: "DGCA",
    license: "CPL",
    sort_order: 2,
    tags: [{ label: "DGCA CPL", variant: "solid" }, { label: "TIMED", variant: "solid" }],
    subTopics: [
      { id: "met-1", title: "Met Test 1", questionCount: 50, status: "reviewed" },
      { id: "met-2", title: "Met Test 2", questionCount: 50, status: "new" },
    ]
  },
  {
    id: "air-regulation",
    num: "03",
    title: "Air Regulation",
    questionCount: 50,
    mastery: 0.88,
    hue: "amber",
    blurb: "Rules of the air, national procedures, and basic airworthiness rules.",
    status: "active",
    exam_authority: "DGCA",
    license: "CPL",
    sort_order: 3,
    tags: [{ label: "DGCA CPL", variant: "signal" }, { label: "NEGATIVE", variant: "signal" }],
    subTopics: [
      { id: "reg-1", title: "Air Reg Test 1", questionCount: 50, status: "reviewed" }
    ]
  },
  {
    id: "dgca-tech-general",
    num: "04",
    title: "Technical General",
    questionCount: 0,
    mastery: 0,
    hue: "mint",
    blurb: "Airframe, engines, electrical, and hydraulic systems basic structures.",
    status: "coming-soon",
    exam_authority: "DGCA",
    license: "CPL",
    sort_order: 4,
    tags: [{ label: "DGCA CPL", variant: "solid" }]
  },
  {
    id: "dgca-tech-specific",
    num: "05",
    title: "Technical Specific",
    questionCount: 0,
    mastery: 0,
    hue: "navy",
    blurb: "Specific training for Cessna 172, multi-engine aircraft systems.",
    status: "coming-soon",
    exam_authority: "DGCA",
    license: "CPL",
    sort_order: 5,
    tags: [{ label: "DGCA CPL", variant: "default" }]
  },
  {
    id: "dgca-rtr",
    num: "06",
    title: "RTR(A)",
    questionCount: 0,
    mastery: 0,
    hue: "amber",
    blurb: "Aviation radio telephony operations, rules, and mock logs.",
    status: "coming-soon",
    exam_authority: "DGCA",
    license: "CPL",
    sort_order: 6,
    tags: [{ label: "DGCA CPL", variant: "amber" }]
  },

  // EASA ATPL Subjects (the 13 subjects)
  {
    id: "easa-air-law",
    num: "11",
    title: "Air Law",
    questionCount: 0,
    mastery: 0,
    hue: "navy",
    blurb: "International agreements, conventions, ICAO annexes, and ATS.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 11,
    tags: [{ label: "EASA ATPL", variant: "default" }]
  },
  {
    id: "easa-agk-systems",
    num: "12",
    title: "AGK - Systems",
    questionCount: 0,
    mastery: 0,
    hue: "mint",
    blurb: "Aircraft General Knowledge - Airframe, systems, and powerplants.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 12,
    tags: [{ label: "EASA ATPL", variant: "solid" }]
  },
  {
    id: "easa-agk-instrumentation",
    num: "13",
    title: "AGK - Instrumentation",
    questionCount: 0,
    mastery: 0,
    hue: "signal",
    blurb: "Flight instruments, automatic flight control systems, and warning devices.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 13,
    tags: [{ label: "EASA ATPL", variant: "signal" }]
  },
  {
    id: "easa-mass-balance",
    num: "14",
    title: "Mass & Balance",
    questionCount: 0,
    mastery: 0,
    hue: "amber",
    blurb: "Center of gravity calculations, limits, loading lists, and schedules.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 14,
    tags: [{ label: "EASA ATPL", variant: "amber" }]
  },
  {
    id: "easa-performance",
    num: "15",
    title: "Performance",
    questionCount: 0,
    mastery: 0,
    hue: "sky",
    blurb: "Takeoff, climb, cruise, and landing of single/multi-engine aeroplanes.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 15,
    tags: [{ label: "EASA ATPL", variant: "sky" }]
  },
  {
    id: "easa-flight-planning",
    num: "16",
    title: "Flight Planning",
    questionCount: 0,
    mastery: 0,
    hue: "navy",
    blurb: "Fuel scheduling, route selection, and weather integration blueprints.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 16,
    tags: [{ label: "EASA ATPL", variant: "default" }]
  },
  {
    id: "easa-human-perf",
    num: "17",
    title: "Human Performance",
    questionCount: 0,
    mastery: 0,
    hue: "mint",
    blurb: "Human physiology, psychology, navigation awareness, and cockpit stress.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 17,
    tags: [{ label: "EASA ATPL", variant: "solid" }]
  },
  {
    id: "easa-met",
    num: "18",
    title: "Meteorology",
    questionCount: 0,
    mastery: 0,
    hue: "sky",
    blurb: "EASA Climatology, frontal weather systems, air masses, and wind trends.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 18,
    tags: [{ label: "EASA ATPL", variant: "sky" }]
  },
  {
    id: "easa-gen-nav",
    num: "19",
    title: "General Navigation",
    questionCount: 0,
    mastery: 0,
    hue: "navy",
    blurb: "Great circles, rhumb lines, chart projections, and wind triangle math.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 19,
    tags: [{ label: "EASA ATPL", variant: "default" }]
  },
  {
    id: "easa-rad-nav",
    num: "20",
    title: "Radio Navigation",
    questionCount: 0,
    mastery: 0,
    hue: "amber",
    blurb: "NDB/ADF, VOR, DME, ILS, radar principles, GPS navigation, and GNSS.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 20,
    tags: [{ label: "EASA ATPL", variant: "amber" }]
  },
  {
    id: "easa-ops-proc",
    num: "21",
    title: "Operational Procedures",
    questionCount: 0,
    mastery: 0,
    hue: "signal",
    blurb: "Special operational requirements, emergency landings, windshear, and fire drills.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 21,
    tags: [{ label: "EASA ATPL", variant: "signal" }]
  },
  {
    id: "principles-of-flight",
    num: "22",
    title: "Principles of Flight",
    questionCount: 180,
    mastery: 0.55,
    hue: "sky",
    blurb: "Stability, aerodynamics, and high-speed flight concepts.",
    status: "active",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 22,
    tags: [{ label: "EASA ATPL", variant: "sky" }, { label: "ADAPTIVE", variant: "default" }],
    subTopics: [
      { id: "pof-stability", title: "Stability & Control", questionCount: 60, status: "reviewed" },
      { id: "pof-highspeed", title: "High-Speed Flight", questionCount: 60, status: "in-progress" },
      { id: "pof-sweptwing", title: "Swept-Wing Aerodynamics", questionCount: 60, status: "new" },
    ]
  },
  {
    id: "easa-communications",
    num: "23",
    title: "Communications",
    questionCount: 0,
    mastery: 0,
    hue: "mint",
    blurb: "VFR and IFR communications protocols, distress calls, and clearances.",
    status: "coming-soon",
    exam_authority: "EASA",
    license: "ATPL",
    sort_order: 23,
    tags: [{ label: "EASA ATPL", variant: "solid" }]
  },

  // FAA Subjects
  {
    id: "faa-private",
    num: "31",
    title: "Private Pilot written",
    questionCount: 0,
    mastery: 0,
    hue: "navy",
    blurb: "FAA PPL written test prep: aerodynamics, FAA rules, cross-country, and weather.",
    status: "coming-soon",
    exam_authority: "FAA",
    license: "PPL",
    sort_order: 31,
    tags: [{ label: "FAA PPL", variant: "default" }]
  },
  {
    id: "faa-commercial",
    num: "32",
    title: "Commercial Pilot written",
    questionCount: 0,
    mastery: 0,
    hue: "amber",
    blurb: "FAA CPL written test preparation questions, airworthiness, complex systems.",
    status: "coming-soon",
    exam_authority: "FAA",
    license: "CPL",
    sort_order: 32,
    tags: [{ label: "FAA CPL", variant: "amber" }]
  },
  {
    id: "faa-instrument",
    num: "33",
    title: "Instrument Rating written",
    questionCount: 0,
    mastery: 0,
    hue: "sky",
    blurb: "FAA Instrument written test prep, IFR charts, procedures, holding patterns.",
    status: "coming-soon",
    exam_authority: "FAA",
    license: "IR",
    sort_order: 33,
    tags: [{ label: "FAA IR", variant: "sky" }]
  },
  {
    id: "faa-atp",
    num: "34",
    title: "ATP written",
    questionCount: 0,
    mastery: 0,
    hue: "signal",
    blurb: "FAA Airline Transport Pilot written test prep, Part 121, gas turbines, airline ops.",
    status: "coming-soon",
    exam_authority: "FAA",
    license: "ATPL",
    sort_order: 34,
    tags: [{ label: "FAA ATPL", variant: "signal" }]
  },

  // Type Rating Subjects
  {
    id: "a320-systems",
    num: "41",
    title: "Airbus A320 Family",
    questionCount: 1478,
    mastery: 0.72,
    hue: "navy",
    blurb: "Deep dive into A320 technical systems based on FCOM & FCTM.",
    status: "active",
    exam_authority: "TYPE_RATING",
    license: "TYPE",
    sort_order: 41,
    tags: [{ label: "A320 Family", variant: "default" }, { label: "ATA", variant: "mint" }],
    subTopics: [
      { id: "ata-21", code: "ATA 21", title: "Air Conditioning", questionCount: 84, status: "reviewed", description: "Controls cabin pressure and temperature using engine bleed air." },
      { id: "ata-22", code: "ATA 22", title: "Auto Flight", questionCount: 142, status: "reviewed" },
      { id: "ata-23", code: "ATA 23", title: "Communications", questionCount: 58, status: "new" },
      { id: "ata-24", code: "ATA 24", title: "Electrical Power", questionCount: 96, status: "in-progress" },
      { id: "ata-26", code: "ATA 26", title: "Fire Protection", questionCount: 64, status: "new" },
      { id: "ata-27", code: "ATA 27", title: "Flight Controls", questionCount: 188, status: "reviewed", description: "Two FCPCs and three FCSCs command the moving surfaces.", spec: [{ label: "COMPUTERS", value: "2 PRIM · 3 SEC" }], figure: { caption: "PITCH AUTHORITY", source: "FCOM", type: "a320-flight-controls" }, sections: [{ id: "27-10", title: "Aileron", description: "Two surfaces ±25°." }] },
      { id: "ata-28", code: "ATA 28", title: "Fuel", questionCount: 72, status: "in-progress" },
      { id: "ata-29", code: "ATA 29", title: "Hydraulic Power", questionCount: 108, status: "reviewed" },
      { id: "ata-30", code: "ATA 30", title: "Ice & Rain Protection", questionCount: 54, status: "reviewed" },
      { id: "ata-32", code: "ATA 32", title: "Landing Gear", questionCount: 86, status: "reviewed" },
      { id: "ata-33", code: "ATA 33", title: "Lights", questionCount: 32, status: "new" },
      { id: "ata-34", code: "ATA 34", title: "Navigation", questionCount: 124, status: "reviewed" },
      { id: "ata-36", code: "ATA 36", title: "Pneumatic", questionCount: 68, status: "in-progress" },
      { id: "ata-49", code: "ATA 49", title: "APU", questionCount: 58, status: "reviewed" },
      { id: "ata-70", code: "ATA 70", title: "Powerplant CFM56", questionCount: 162, status: "reviewed" },
      { id: "ata-73", code: "ATA 73", title: "Engine Fuel & Control", questionCount: 78, status: "new" },
    ]
  },
  {
    id: "type-b737",
    num: "42",
    title: "Boeing 737 Classic/NG/MAX",
    questionCount: 0,
    mastery: 0,
    hue: "mint",
    blurb: "B737 type rating preparation, hydraulic redundancy, and Boeing FMA rules.",
    status: "coming-soon",
    exam_authority: "TYPE_RATING",
    license: "TYPE",
    sort_order: 42,
    tags: [{ label: "B737 Family", variant: "solid" }]
  },
  {
    id: "type-a330",
    num: "43",
    title: "Airbus A330 Type Exam",
    questionCount: 0,
    mastery: 0,
    hue: "sky",
    blurb: "Airbus widebody A330 technical differences, fuel transfer systems, and cockpit details.",
    status: "coming-soon",
    exam_authority: "TYPE_RATING",
    license: "TYPE",
    sort_order: 43,
    tags: [{ label: "A330 widebody", variant: "sky" }]
  },
  {
    id: "type-b777",
    num: "44",
    title: "Boeing 777 Type Exam",
    questionCount: 0,
    mastery: 0,
    hue: "navy",
    blurb: "Boeing 777 systems, fly-by-wire envelopes, GE90 limits, and checklist operations.",
    status: "coming-soon",
    exam_authority: "TYPE_RATING",
    license: "TYPE",
    sort_order: 44,
    tags: [{ label: "B777 widebody", variant: "default" }]
  },
  {
    id: "type-atr72",
    num: "45",
    title: "ATR 72 Type Exam",
    questionCount: 0,
    mastery: 0,
    hue: "amber",
    blurb: "ATR 72 turboprop mechanical systems, PEC indicators, and regional profiles.",
    status: "coming-soon",
    exam_authority: "TYPE_RATING",
    license: "TYPE",
    sort_order: 45,
    tags: [{ label: "ATR Turboprop", variant: "amber" }]
  }
];

import { supabase } from "../lib/supabase";

export let subjects: SubjectItem[] = [];

try {
  const { data: dbSubjects, error: sError } = await supabase
    .from("subjects")
    .select("*")
    .eq("status", "published");

  const { data: dbSubcats, error: scError } = await supabase
    .from("subcategories")
    .select("*")
    .eq("status", "published");

  if (sError || scError || !dbSubjects || dbSubjects.length === 0) {
    console.warn("Could not retrieve published subjects/subcategories from Supabase, using static fallback:", sError || scError);
    // Use static rawSubjects mapping
    subjects = rawSubjects.map(subj => {
      const subTopics = subj.subTopics?.map(st => {
        const count = questionBank.filter(q => q.topicId === st.id).length;
        return {
          ...st,
          questionCount: count
        };
      });

      const totalCount = subTopics
        ? subTopics.reduce((acc, st) => acc + st.questionCount, 0)
        : 0;

      const isComingSoon = totalCount === 0 || subj.status === "coming-soon";

      return {
        ...subj,
        subTopics,
        questionCount: totalCount,
        status: isComingSoon ? "coming-soon" as const : "active" as const
      };
    });
  } else {
    // Merge successfully retrieved database subjects and subcategories
    const publishedDbSubjects = dbSubjects.filter(ds => ds.status === "published");
    const publishedDbSubcats = (dbSubcats || []).filter(dsc => dsc.status === "published");

    subjects = publishedDbSubjects.map(dbSub => {
      const pMatch = rawSubjects.find(s => s.id === dbSub.id);
      
      const subcatsOfThisSubject = publishedDbSubcats.filter(sc => sc.subject_id === dbSub.id);
      const subTopics = subcatsOfThisSubject.map(dbSubcat => {
        const stMatch = pMatch?.subTopics?.find(st => st.id === dbSubcat.id) || 
          rawSubjects.flatMap(s => s.subTopics || []).find(st => st.id === dbSubcat.id);
        
        return {
          id: dbSubcat.id,
          code: dbSubcat.code || stMatch?.code || undefined,
          title: dbSubcat.title,
          description: dbSubcat.description || stMatch?.description || undefined,
          spec: stMatch?.spec || undefined,
          figure: stMatch?.figure || undefined,
          sections: stMatch?.sections || undefined,
          status: (dbSubcat.status || "reviewed") as any,
          questionCount: questionBank.filter(q => q.topicId === dbSubcat.id).length,
        };
      });

      const totalCount = subTopics.reduce((acc, st) => acc + st.questionCount, 0);
      const isComingSoon = totalCount === 0;

      return {
        id: dbSub.id,
        num: dbSub.sort_order ? String(dbSub.sort_order).padStart(2, '0') : (pMatch?.num || "01"),
        title: dbSub.title,
        questionCount: totalCount,
        mastery: pMatch?.mastery || 0,
        hue: (pMatch?.hue || "navy") as any,
        blurb: dbSub.description || pMatch?.blurb || "",
        status: isComingSoon ? "coming-soon" as const : "active" as const,
        tags: pMatch?.tags || [],
        subTopics: subTopics,
      };
    });
  }
} catch (e) {
  console.warn("Exception retrieving subjects/subcategories, using static fallback:", e);
  // Static fallback block
  subjects = rawSubjects.map(subj => {
    const subTopics = subj.subTopics?.map(st => {
      const count = questionBank.filter(q => q.topicId === st.id).length;
      return {
        ...st,
        questionCount: count
      };
    });

    const totalCount = subTopics
      ? subTopics.reduce((acc, st) => acc + st.questionCount, 0)
      : 0;

    const isComingSoon = totalCount === 0 || subj.status === "coming-soon";

    return {
      ...subj,
      subTopics,
      questionCount: totalCount,
      status: isComingSoon ? "coming-soon" as const : "active" as const
    };
  });
}

