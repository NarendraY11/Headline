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
}

export const rawSubjects: SubjectItem[] = [
  {
    id: "a320-systems",
    num: "01",
    title: "Airbus A320 Systems",
    questionCount: 1478,
    mastery: 0.72,
    hue: "navy",
    blurb: "Deep dive into A320 technical systems based on FCOM & FCTM.",
    status: "active",
    tags: [
      { label: "ADAPTIVE", variant: "default" },
      { label: "ATA", variant: "mint" }
    ],
    subTopics: [
      { 
        id: "ata-21", 
        code: "ATA 21", 
        title: "Air Conditioning", 
        questionCount: 84, 
        status: "reviewed", 
        description: "Controls cabin pressure and temperature using engine bleed air." 
      },
      { id: "ata-22", code: "ATA 22", title: "Auto Flight", questionCount: 142, status: "reviewed" },
      { id: "ata-23", code: "ATA 23", title: "Communications", questionCount: 58, status: "new" },
      { id: "ata-24", code: "ATA 24", title: "Electrical Power", questionCount: 96, status: "in-progress" },
      { id: "ata-26", code: "ATA 26", title: "Fire Protection", questionCount: 64, status: "new" },
      { 
        id: "ata-27", 
        code: "ATA 27", 
        title: "Flight Controls", 
        questionCount: 188, 
        status: "reviewed",
        description: "Two FCPCs (PRIMs) and three FCSCs (SECs) command the moving surfaces via hydraulic servocontrols. In Normal Law, the THS handles long-term pitch trim; elevators handle short-term commands. Below 100 ft the system blends to Flare law.",
        spec: [
          { label: "COMPUTERS", value: "2 PRIM · 3 SEC" },
          { label: "SURFACES", value: "12" },
          { label: "LAWS", value: "Normal · Alt · Direct · Mech" },
          { label: "REFERENCE", value: "FCOM 1.27" }
        ],
        figure: {
          caption: "FIG. 27-04 · PITCH TRIM AUTHORITY HIERARCHY",
          source: "SOURCE: A320 FCOM REV 41 · PLATE 27-04",
          type: "a320-flight-controls"
        },
        sections: [
          { id: "27-10", title: "Aileron", description: "Two surfaces, hydraulically powered, ±25° down / ±25° up. Used as roll spoilers when speed brakes deflected." },
          { id: "27-20", title: "Rudder", description: "Single surface with mechanical yaw damper backup. Travel limiter scheduled with airspeed." },
          { id: "27-30", title: "Elevator & THS", description: "Two elevators ±30°, THS −13° to +4°, driven by FCPCs through screwjack. Manual trim wheel mechanical." },
          { id: "27-50", title: "Spoilers", description: "Five panels per wing — speed brakes (panels 2–4), ground spoilers (all), roll assist." }
        ]
      },
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
    id: "meteorology",
    num: "02",
    title: "Meteorology",
    questionCount: 100,
    mastery: 0.45,
    hue: "sky",
    blurb: "Decoding aviation weather, air masses, frontal structures, and reports.",
    status: "active",
    tags: [{ label: "TIMED", variant: "solid" }],
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
    blurb: "Rules of the air, DGCA/EASA conventions, and procedures.",
    status: "active",
    tags: [{ label: "NEGATIVE MARKING", variant: "signal" }],
    subTopics: [
      { id: "reg-1", title: "Air Reg Test 1", questionCount: 50, status: "reviewed" }
    ]
  },
  {
    id: "air-navigation",
    num: "04",
    title: "Air Navigation",
    questionCount: 450,
    mastery: 0.25,
    hue: "navy",
    blurb: "Gen Nav, Radio Nav, and Instruments. Chart your course.",
    status: "active",
    tags: [{ label: "COMPLEX", variant: "amber" }],
    subTopics: [
      { id: "nav-gen", title: "General Navigation", questionCount: 200, status: "in-progress" },
      { id: "nav-rad", title: "Radio Navigation", questionCount: 150, status: "new" },
      { id: "nav-inst", title: "Aircraft Instruments", questionCount: 100, status: "reviewed" },
    ]
  },
  {
    id: "atg",
    num: "05",
    title: "Aircraft Technical General",
    questionCount: 0,
    mastery: 0,
    hue: "mint",
    blurb: "Airframes, systems, and powerplants (general).",
    status: "coming-soon",
    tags: []
  },
  {
    id: "flight-performance",
    num: "06",
    title: "Flight Performance",
    questionCount: 0,
    mastery: 0,
    hue: "navy",
    blurb: "Takeoff, en-route, and landing performance calculations.",
    status: "coming-soon",
    tags: []
  },
  {
    id: "principles-of-flight",
    num: "07",
    title: "Principles of Flight",
    questionCount: 180,
    mastery: 0.55,
    hue: "sky",
    blurb: "Stability, aerodynamics, and high-speed flight concepts.",
    status: "active",
    tags: [{ label: "ADAPTIVE", variant: "default" }],
    subTopics: [
      { id: "pof-stability", title: "Stability & Control", questionCount: 60, status: "reviewed" },
      { id: "pof-highspeed", title: "High-Speed Flight", questionCount: 60, status: "in-progress" },
      { id: "pof-sweptwing", title: "Swept-Wing Aerodynamics", questionCount: 60, status: "new" },
    ]
  },
  {
    id: "brain-booster",
    num: "08",
    title: "The Brain Booster",
    questionCount: 120,
    mastery: 0.10,
    hue: "signal",
    blurb: "Full mock papers. Final preparation before the authority exam.",
    status: "active",
    tags: [{ label: "MIXED SETS", variant: "solid" }],
    subTopics: [
      { id: "mock-paper-1", title: "Mock Paper 1", questionCount: 120, status: "new" }
    ]
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

