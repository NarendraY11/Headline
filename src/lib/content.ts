import { supabase } from "./supabase";
import { Question } from "../data/questions";
import { rawSubjects, SubjectItem } from "../data/topics";
import { getCachedQuestions, getCachedQuestionsByIds, putQuestions } from "./offline/questionCache";
import { normalizeSlug } from "./slug";

const CACHE_TTL = 300000; // 5 minutes in milliseconds

function getLocalCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(`heading_cache_${key}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        return parsed.data as T;
      }
    }
  } catch (e) {
    console.warn("Failed to read from localStorage cache:", e);
  }
  return null;
}

function setLocalCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(
      `heading_cache_${key}`,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (e) {
    console.warn("Failed to set localStorage cache:", e);
  }
}

let cachedQuestions: Question[] | null = null;
let cachedSubjects: any[] | null = null;
let cachedSubcategories: any[] | null = null;
let cachedMergedSubjects: SubjectItem[] | null = null;

export async function fetchQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (!ids || ids.length === 0) return [];

  // Fill any ids the DB doesn't return from the static bank, so callers (e.g.
  // quiz resume) always get the questions they saved even when the DB is empty
  // or only partially seeded.
  const fillFromStatic = async (found: Question[]): Promise<Question[]> => {
    let foundIds = new Set(found.map((q) => q.id));
    let missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length === 0) return found;

    // Prefer the user's real cached questions (offline) over the generic
    // static bank, then fall back to static for anything still missing.
    try {
      const cached = await getCachedQuestionsByIds(missing);
      if (cached.length > 0) {
        found = [...found, ...cached];
        foundIds = new Set(found.map((q) => q.id));
        missing = ids.filter((id) => !foundIds.has(id));
        if (missing.length === 0) return found;
      }
    } catch {
      /* ignore cache miss */
    }

    try {
      const { staticQuestionBank } = await import("../data/staticQuestions");
      const byId = new Map(staticQuestionBank.map((q) => [q.id, q]));
      const filled = missing
        .map((id) => byId.get(id))
        .filter(Boolean) as Question[];
      return [...found, ...filled];
    } catch {
      return found;
    }
  };

  try {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .in("id", ids);

    if (error || !data) {
      console.warn("Error fetching questions by IDs, using static fallback:", error);
      return fillFromStatic([]);
    }

    const mapped = data.map((q: any) => ({
      id: q.id,
      topicId: q.subcategory_id || q.subject_id || "",
      subjectId: q.subject_id || "",
      subcategoryId: q.subcategory_id || "",
      examId: q.exam_id || "",
      ata: q.ata || "Uncategorized",
      difficulty: q.difficulty || "standard",
      prompt: q.prompt,
      diagramCaption: q.diagram_caption || undefined,
      choices: Array.isArray(q.choices)
        ? q.choices
        : (typeof q.choices === "string" ? JSON.parse(q.choices) : []),
      correct: q.correct,
      explanation: q.explanation || "",
      references: Array.isArray(q.refs)
        ? q.refs
        : (Array.isArray(q.references)
          ? q.references
          : (typeof q.refs === "string"
            ? JSON.parse(q.refs)
            : (typeof q.references === "string" ? JSON.parse(q.references) : []))),
      isAiGenerated: !!q.is_ai_generated,
    }));
    void putQuestions(mapped);
    return fillFromStatic(mapped);
  } catch (err) {
    console.error("Exception fetching questions by IDs, using static fallback:", err);
    return fillFromStatic([]);
  }
}

export async function fetchQuizQuestionsForTopic(
  topicId: string,
  limit = 40,
  randomize = true
): Promise<Question[]> {
  try {
    let { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("status", "published")
      .eq("subcategory_id", topicId);

    if (error || !data || data.length === 0) {
      const res = await supabase
        .from("questions")
        .select("*")
        .eq("status", "published")
        .eq("subject_id", topicId);
      data = res.data;
      error = res.error;
    }

    if (error || !data || data.length === 0) {
      const res = await supabase
        .from("questions")
        .select("*")
        .eq("status", "published");
      
      const normTarget = normalizeSlug(topicId);

      data = (res.data || []).filter((q: any) =>
        normalizeSlug(q.subject_id) === normTarget ||
        normalizeSlug(q.subcategory_id) === normTarget
      );
    }

    let questions: Question[] = (data || []).map((q: any) => ({
      id: q.id,
      topicId: q.subcategory_id || q.subject_id || "",
      subjectId: q.subject_id || "",
      subcategoryId: q.subcategory_id || "",
      examId: q.exam_id || "",
      ata: q.ata || "Uncategorized",
      difficulty: q.difficulty || "standard",
      prompt: q.prompt,
      diagramCaption: q.diagram_caption || undefined,
      choices: Array.isArray(q.choices)
        ? q.choices
        : (typeof q.choices === "string" ? JSON.parse(q.choices) : []),
      correct: q.correct,
      explanation: q.explanation || "",
      references: Array.isArray(q.refs)
        ? q.refs
        : (Array.isArray(q.references)
          ? q.references
          : (typeof q.refs === "string"
            ? JSON.parse(q.refs)
            : (typeof q.references === "string" ? JSON.parse(q.references) : []))),
      isAiGenerated: !!q.is_ai_generated,
    }));

    // Write successful DB results through to the offline cache so this topic
    // can be practised offline later.
    if (questions.length > 0) void putQuestions(questions);

    // Fallback when the DB has no published questions for this topic (no match,
    // or offline): prefer the user's real cached questions, then the bundled
    // static bank, so the quiz is never empty. Match the topic where possible.
    if (questions.length === 0) {
      const normTarget = normalizeSlug(topicId);
      const matchesTopic = (q: Question) =>
        normalizeSlug(q.subcategoryId) === normTarget ||
        normalizeSlug(q.subjectId) === normTarget ||
        normalizeSlug(q.topicId) === normTarget;

      const cachedAll = await getCachedQuestions();
      const cachedMatched = cachedAll.filter(matchesTopic);
      if (cachedMatched.length > 0) {
        questions = cachedMatched;
      } else {
        const { staticQuestionBank } = await import("../data/staticQuestions");
        const matched = staticQuestionBank.filter(matchesTopic);
        questions = matched.length > 0 ? matched : staticQuestionBank;
      }
    }

    if (randomize) {
      questions = questions.sort(() => Math.random() - 0.5);
    }

    return questions.slice(0, limit);
  } catch (err) {
    console.error("Failed fetching quiz questions server-side, using static fallback:", err);
    try {
      const { staticQuestionBank } = await import("../data/staticQuestions");
      const pool = randomize
        ? [...staticQuestionBank].sort(() => Math.random() - 0.5)
        : staticQuestionBank;
      return pool.slice(0, limit);
    } catch {
      return [];
    }
  }
}

export async function fetchPublishedQuestions(options?: {
  subjectId?: string;
  subcategoryId?: string;
  limit?: number;
  offset?: number;
}): Promise<Question[]> {
  if (options) {
    try {
      let query = supabase
        .from("questions")
        .select("*")
        .eq("status", "published");

      if (options.subjectId) {
        query = query.eq("subject_id", options.subjectId);
      }
      if (options.subcategoryId) {
        query = query.eq("subcategory_id", options.subcategoryId);
      }

      if (options.limit !== undefined) {
        const start = options.offset || 0;
        const end = start + options.limit - 1;
        query = query.range(start, end);
      }

      const { data, error } = await query;

      // Fallback when the DB returns nothing (no match, or offline): prefer the
      // user's real cached questions, then the bundled static bank so the quiz
      // is never empty.
      const staticFallback = async (): Promise<Question[]> => {
        const cached = await getCachedQuestions(options);
        if (cached.length > 0) return cached;
        const { staticQuestionBank } = await import("../data/staticQuestions");
        let pool = staticQuestionBank;
        if (options.subjectId) pool = pool.filter((q) => q.subjectId === options.subjectId);
        if (options.subcategoryId) pool = pool.filter((q) => q.subcategoryId === options.subcategoryId);
        if (pool.length === 0) pool = staticQuestionBank;
        const start = options.offset || 0;
        return options.limit !== undefined ? pool.slice(start, start + options.limit) : pool;
      };

      if (error) {
        console.warn("Error fetching questions with options, using static fallback:", error);
        return staticFallback();
      }

      const mapped: Question[] = (data || []).map((q: any) => ({
        id: q.id,
        topicId: q.subcategory_id || q.subject_id || "",
        subjectId: q.subject_id || "",
        subcategoryId: q.subcategory_id || "",
        examId: q.exam_id || "",
        ata: q.ata || "Uncategorized",
        difficulty: q.difficulty || "standard",
        prompt: q.prompt,
        diagramCaption: q.diagram_caption || undefined,
        choices: Array.isArray(q.choices)
          ? q.choices
          : (typeof q.choices === "string" ? JSON.parse(q.choices) : []),
        correct: q.correct,
        explanation: q.explanation || "",
        references: Array.isArray(q.refs)
          ? q.refs
          : (Array.isArray(q.references)
            ? q.references
            : (typeof q.refs === "string"
              ? JSON.parse(q.refs)
              : (typeof q.references === "string" ? JSON.parse(q.references) : []))),
        isAiGenerated: !!q.is_ai_generated,
      }));
      if (mapped.length > 0) {
        void putQuestions(mapped);
        return mapped;
      }
      return staticFallback();
    } catch (err) {
      console.warn("Exception fetching questions with options, using static fallback:", err);
      try {
        const cached = await getCachedQuestions(options);
        if (cached.length > 0) return cached;
        const { staticQuestionBank } = await import("../data/staticQuestions");
        const start = options.offset || 0;
        return options.limit !== undefined
          ? staticQuestionBank.slice(start, start + options.limit)
          : staticQuestionBank;
      } catch {
        return [];
      }
    }
  }

  if (cachedQuestions) return cachedQuestions;

  try {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("status", "published");

    if (error) {
      console.warn("Error fetching questions, using offline/static fallback:", error);
      const cached = await getCachedQuestions();
      const { staticQuestionBank } = await import("../data/staticQuestions");
      cachedQuestions = cached.length > 0 ? cached : staticQuestionBank;
    } else if (data && data.length > 0) {
      cachedQuestions = data.map((q: any) => ({
        id: q.id,
        topicId: q.subcategory_id || q.subject_id || "",
        subjectId: q.subject_id || "",
        subcategoryId: q.subcategory_id || "",
        examId: q.exam_id || "",
        ata: q.ata || "Uncategorized",
        difficulty: q.difficulty || "standard",
        prompt: q.prompt,
        diagramCaption: q.diagram_caption || undefined,
        choices: Array.isArray(q.choices)
          ? q.choices
          : (typeof q.choices === "string" ? JSON.parse(q.choices) : []),
        correct: q.correct,
        explanation: q.explanation || "",
        references: Array.isArray(q.refs)
          ? q.refs
          : (Array.isArray(q.references)
            ? q.references
            : (typeof q.refs === "string"
              ? JSON.parse(q.refs)
              : (typeof q.references === "string" ? JSON.parse(q.references) : []))),
        isAiGenerated: !!q.is_ai_generated,
      }));
      void putQuestions(cachedQuestions);
    } else {
      const cached = await getCachedQuestions();
      const { staticQuestionBank } = await import("../data/staticQuestions");
      cachedQuestions = cached.length > 0 ? cached : staticQuestionBank;
    }
  } catch (err) {
    console.warn("Exception fetching questions, using offline/static fallback:", err);
    const cached = await getCachedQuestions();
    const { staticQuestionBank } = await import("../data/staticQuestions");
    cachedQuestions = cached.length > 0 ? cached : staticQuestionBank;
  }

  if (!cachedQuestions) {
    const { staticQuestionBank } = await import("../data/staticQuestions");
    return staticQuestionBank;
  }
  return cachedQuestions;
}

export async function fetchPublishedSubjects(): Promise<any[]> {
  if (cachedSubjects) return cachedSubjects;
  const localCached = getLocalCache<any[]>("published_subjects");
  if (localCached) {
    cachedSubjects = localCached;
    return localCached;
  }

  try {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("Error fetching subjects, using static fallback:", error);
      cachedSubjects = rawSubjects.map(s => ({
        id: s.id,
        title: s.title,
        description: s.blurb,
        status: "published",
        sort_order: s.sort_order || parseInt(s.num) || 1,
        exam_authority: s.exam_authority,
        license: s.license,
      }));
    } else if (data && data.length > 0) {
      cachedSubjects = data;
    } else {
      cachedSubjects = rawSubjects.map(s => ({
        id: s.id,
        title: s.title,
        description: s.blurb,
        status: "published",
        sort_order: s.sort_order || parseInt(s.num) || 1,
        exam_authority: s.exam_authority,
        license: s.license,
      }));
    }
  } catch (err) {
    console.warn("Exception fetching subjects, using static fallback:", err);
    cachedSubjects = rawSubjects.map(s => ({
      id: s.id,
      title: s.title,
      description: s.blurb,
      status: "published",
      sort_order: s.sort_order || parseInt(s.num) || 1,
      exam_authority: s.exam_authority,
      license: s.license,
    }));
  }

  if (cachedSubjects) {
    setLocalCache("published_subjects", cachedSubjects);
  }
  return cachedSubjects || [];
}

export async function fetchPublishedSubcategories(): Promise<any[]> {
  if (cachedSubcategories) return cachedSubcategories;
  const localCached = getLocalCache<any[]>("published_subcategories");
  if (localCached) {
    cachedSubcategories = localCached;
    return localCached;
  }

  try {
    const { data, error } = await supabase
      .from("subcategories")
      .select("*")
      .eq("status", "published");

    if (error) {
      console.warn("Error fetching subcategories, using static fallback:", error);
      cachedSubcategories = rawSubjects.flatMap(s => 
        (s.subTopics || []).map((st, idx) => ({
          id: st.id,
          subject_id: s.id,
          title: st.title,
          code: st.code || "",
          description: st.description || "",
          status: "published",
          sort_order: idx + 1
        }))
      );
    } else if (data && data.length > 0) {
      cachedSubcategories = data;
    } else {
      cachedSubcategories = rawSubjects.flatMap(s => 
        (s.subTopics || []).map((st, idx) => ({
          id: st.id,
          subject_id: s.id,
          title: st.title,
          code: st.code || "",
          description: st.description || "",
          status: "published",
          sort_order: idx + 1
        }))
      );
    }
  } catch (err) {
    console.warn("Exception fetching subcategories, using static fallback:", err);
    cachedSubcategories = rawSubjects.flatMap(s => 
      (s.subTopics || []).map((st, idx) => ({
        id: st.id,
        subject_id: s.id,
        title: st.title,
        code: st.code || "",
        description: st.description || "",
        status: "published",
        sort_order: idx + 1
      }))
    );
  }

  if (cachedSubcategories) {
    setLocalCache("published_subcategories", cachedSubcategories);
  }
  return cachedSubcategories || [];
}

export async function fetchMergedSubjects(forceRefresh = false): Promise<SubjectItem[]> {
  if (cachedMergedSubjects && !forceRefresh) return cachedMergedSubjects;
  
  if (!forceRefresh) {
    const localCached = getLocalCache<SubjectItem[]>("merged_subjects");
    if (localCached) {
      cachedMergedSubjects = localCached;
      return localCached;
    }
  }

  const questionsList = await fetchPublishedQuestions();
  const dbSubjects = await fetchPublishedSubjects();
  const dbSubcats = await fetchPublishedSubcategories();

   const dbMerged = dbSubjects.map(dbSub => {
     const pMatch = rawSubjects.find(s => s.id === dbSub.id);
     
     const subcatsOfThisSubject = dbSubcats.filter(sc => sc.subject_id === dbSub.id);
     const subTopics = subcatsOfThisSubject.map((dbSubcat, idx) => {
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
         questionCount: questionsList.filter(q => q.topicId === dbSubcat.id).length,
         free_chapter: idx === 0 || !!dbSubcat.free_chapter || !!stMatch?.free_chapter,
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
       exam_authority: dbSub.exam_authority || pMatch?.exam_authority,
       license: dbSub.license || pMatch?.license,
       sort_order: dbSub.sort_order || pMatch?.sort_order,
       is_free: dbSub.is_free ?? (dbSub.id === "air-navigation" || pMatch?.is_free) ?? false,
     };
   });

   // Fold in static rawSubjects not present in dbMerged to handle fallback and static-only subjects
   const dbSubjectIds = new Set(dbSubjects.map(s => s.id));
   const unmatchedRawSubjects = rawSubjects.filter(rs => !dbSubjectIds.has(rs.id));

   const unmatchedMerged = unmatchedRawSubjects.map(rs => {
     const subTopics = (rs.subTopics || []).map((st, idx) => {
       return {
         id: st.id,
         code: st.code || undefined,
         title: st.title,
         description: st.description || undefined,
         spec: st.spec || undefined,
         figure: st.figure || undefined,
         sections: st.sections || undefined,
         status: (st.status || "reviewed") as any,
         questionCount: questionsList.filter(q => q.topicId === st.id).length || st.questionCount || 0,
         free_chapter: idx === 0 || !!st.free_chapter,
       };
     });

     const totalCount = subTopics.reduce((acc, st) => acc + st.questionCount, 0) || rs.questionCount || 0;
     const isComingSoon = totalCount === 0 && rs.status === "coming-soon";

     return {
       id: rs.id,
       num: rs.num || "01",
       title: rs.title,
       questionCount: totalCount,
       mastery: rs.mastery || 0,
       hue: (rs.hue || "navy") as any,
       blurb: rs.blurb || "",
       status: isComingSoon ? "coming-soon" as const : "active" as const,
       tags: rs.tags || [],
       subTopics: subTopics,
       exam_authority: rs.exam_authority,
       license: rs.license,
       sort_order: rs.sort_order,
       is_free: rs.is_free ?? (rs.id === "air-navigation") ?? false,
     };
   });

   const merged = [...dbMerged, ...unmatchedMerged];

  cachedMergedSubjects = merged;
  setLocalCache("merged_subjects", merged);
  return merged;
}

export interface ExamInfo {
  id: string;
  authority: "DGCA" | "EASA" | "FAA" | "TYPE_RATING" | "AIRLINE" | string;
  license: "PPL" | "CPL" | "ATPL" | "IR" | "TYPE" | "RECRUITMENT" | "OTHER" | string;
  title: string;
  pass_mark: number;
  duration_min: number;
  neg_marking_percent?: number;
  total_questions?: number;
  question_count?: number; // kept for compatibility
  negative_marking?: boolean; // kept for compatibility
  subject_ids: string[];
  status: "draft" | "published" | "archived";
}

export const staticExams: ExamInfo[] = [
  {
    id: "dgca-cpl-mock",
    authority: "DGCA",
    license: "CPL",
    title: "DGCA CPL Full Mock - All Core Subjects",
    pass_mark: 70,
    total_questions: 100,
    question_count: 100,
    duration_min: 120,
    negative_marking: false,
    subject_ids: ["air-navigation", "meteorology", "air-regulation", "technical-general", "technical-specific", "rtr-a"],
    status: "published"
  },
  {
    id: "dgca-atpl-mock",
    authority: "DGCA",
    license: "ATPL",
    title: "DGCA ATPL Theoretical License Simulation",
    pass_mark: 70,
    total_questions: 100,
    question_count: 100,
    duration_min: 120,
    negative_marking: false,
    subject_ids: ["air-navigation", "meteorology", "air-regulation"],
    status: "published"
  },
  {
    id: "easa-atpl-mock",
    authority: "EASA",
    license: "ATPL",
    title: "EASA ATPL (13 Subjects Compliance Deck)",
    pass_mark: 75,
    total_questions: 120,
    question_count: 120,
    duration_min: 120,
    negative_marking: false,
    subject_ids: ["principles-of-flight", "meteorology", "air-law", "agk", "instrumentation", "mass-balance", "flight-planning", "human-performance", "radio-navigation", "general-navigation", "operational-procedures", "vfr-comms", "ifr-comms"],
    status: "published"
  },
  {
    id: "faa-private-mock",
    authority: "FAA",
    license: "PPL",
    title: "FAA Private Pilot Airplane Simulation (PAR)",
    pass_mark: 70,
    total_questions: 60,
    question_count: 60,
    duration_min: 150,
    negative_marking: false,
    subject_ids: ["air-navigation", "meteorology"],
    status: "published"
  },
  {
    id: "faa-commercial-mock",
    authority: "FAA",
    license: "CPL",
    title: "FAA Commercial Pilot Airplane Exam (CAX)",
    pass_mark: 70,
    total_questions: 100,
    question_count: 100,
    duration_min: 180,
    negative_marking: false,
    subject_ids: ["air-navigation", "meteorology", "commercial-concepts"],
    status: "published"
  },
  {
    id: "faa-instrument-mock",
    authority: "FAA",
    license: "IR",
    title: "FAA Instrument Rating Airplane Exam (IRA)",
    pass_mark: 70,
    total_questions: 60,
    question_count: 60,
    duration_min: 150,
    negative_marking: false,
    subject_ids: ["instrument-procedures", "meteorology"],
    status: "published"
  },
  {
    id: "faa-atp-mock",
    authority: "FAA",
    license: "ATPL",
    title: "FAA Airline Transport Pilot Multi-Engine (ATM)",
    pass_mark: 70,
    total_questions: 125,
    question_count: 125,
    duration_min: 240,
    negative_marking: false,
    subject_ids: ["air-navigation", "meteorology", "atp-operations"],
    status: "published"
  },
  {
    id: "a320-technical-mock",
    authority: "TYPE_RATING",
    license: "TYPE",
    title: "Airbus A320 Technical Rating System (ATA Chapter-Weighted)",
    pass_mark: 75,
    total_questions: 80,
    question_count: 80,
    duration_min: 90,
    negative_marking: false,
    subject_ids: ["a320-systems"],
    status: "published"
  },
  {
    id: "b737-technical-mock",
    authority: "TYPE_RATING",
    license: "TYPE",
    title: "Boeing B737 Technical Course Simulation",
    pass_mark: 75,
    total_questions: 80,
    question_count: 80,
    duration_min: 90,
    negative_marking: false,
    subject_ids: ["b737-systems"],
    status: "published"
  },
  {
    id: "a330-technical-mock",
    authority: "TYPE_RATING",
    license: "TYPE",
    title: "Airbus A330 Technical Type Rating Simulator",
    pass_mark: 75,
    total_questions: 80,
    question_count: 80,
    duration_min: 90,
    negative_marking: false,
    subject_ids: ["a330-systems"],
    status: "published"
  },
  {
    id: "b777-technical-mock",
    authority: "TYPE_RATING",
    license: "TYPE",
    title: "Boeing B777 Theoretical Type Rating Exam",
    pass_mark: 75,
    total_questions: 80,
    question_count: 80,
    duration_min: 90,
    negative_marking: false,
    subject_ids: ["b777-systems"],
    status: "published"
  },
  {
    id: "atr72-technical-mock",
    authority: "TYPE_RATING",
    license: "TYPE",
    title: "ATR 72 Technical Course & ATA Chapters Review",
    pass_mark: 75,
    total_questions: 80,
    question_count: 80,
    duration_min: 90,
    negative_marking: false,
    subject_ids: ["atr72-systems"],
    status: "published"
  },
  {
    id: "airline-recruitment-mock",
    authority: "AIRLINE",
    license: "RECRUITMENT",
    title: "Airline Technical Pre-Employment Selection Mock",
    pass_mark: 80,
    total_questions: 50,
    question_count: 50,
    duration_min: 60,
    negative_marking: true,
    neg_marking_percent: 25,
    subject_ids: ["air-navigation", "meteorology", "aviation-aptitude"],
    status: "published"
  }
];

export async function fetchExams(): Promise<ExamInfo[]> {
  try {
    const { data, error } = await supabase
      .from("exams")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching exams, falling back to staticExams:", error);
      return staticExams;
    }
    if (data && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        authority: d.authority,
        license: d.license,
        title: d.title,
        pass_mark: d.pass_mark || 70,
        question_count: d.total_questions || d.question_count || 50,
        total_questions: d.total_questions || d.question_count || 50,
        duration_min: d.duration_min || 60,
        negative_marking: !!d.negative_marking || (Number(d.neg_marking_percent) > 0),
        neg_marking_percent: d.neg_marking_percent !== undefined ? Number(d.neg_marking_percent) : (d.negative_marking ? 25 : 0),
        subject_ids: Array.isArray(d.subject_ids)
          ? d.subject_ids
          : (typeof d.subject_ids === "string" ? JSON.parse(d.subject_ids) : []),
        status: d.status || "draft",
      }));
    }
    return staticExams;
  } catch (err) {
    console.warn("Exception fetching exams, falling back to staticExams:", err);
    return staticExams;
  }
}

export async function saveExam(exam: Omit<ExamInfo, "id"> & { id?: string }): Promise<any> {
  const id = exam.id || `exam-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const totalQ = exam.total_questions || exam.question_count || 50;
  const negP = exam.neg_marking_percent ?? (exam.negative_marking ? 25 : 0);
  
  const payload = {
    id,
    authority: exam.authority,
    license: exam.license,
    title: exam.title,
    pass_mark: exam.pass_mark,
    question_count: totalQ,
    total_questions: totalQ,
    duration_min: exam.duration_min,
    negative_marking: negP > 0,
    neg_marking_percent: negP,
    subject_ids: exam.subject_ids,
    status: exam.status,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("exams")
    .upsert(payload)
    .select();

  if (error) throw error;

  // Sync relational integrity on Subjects side: Set or clear exam_id
  try {
    if (exam.subject_ids && exam.subject_ids.length > 0) {
      // 1. Link selected subjects to this exam
      await supabase
        .from("subjects")
        .update({ exam_id: id })
        .in("id", exam.subject_ids);

      // 2. Unlink any other subjects that were link to this exam but are now deselected
      // Supabase filter for not in selected subjects list
      const formattingList = exam.subject_ids.map(sid => `'${sid}'`).join(",");
      await supabase
        .from("subjects")
        .update({ exam_id: null })
        .eq("exam_id", id)
        .filter("id", "not.in", `(${formattingList})`);
    } else {
      await supabase
        .from("subjects")
        .update({ exam_id: null })
        .eq("exam_id", id);
    }
  } catch (syncErr) {
    console.warn("Minor link subjects synching warning:", syncErr);
  }

  return data;
}

export async function deleteExam(id: string): Promise<any> {
  const { data, error } = await supabase
    .from("exams")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return data;
}

export interface MockPaperSpec {
  id: string;
  exam_id: string;
  title: string;
  duration_min: number;
  pass_mark: number;
  neg_marking_percent: number;
  total_questions: number;
  rules: { subject_id: string; subcategory_id?: string; count: number }[]; // Sample weighting rules
  status: "draft" | "published" | "archived";
}

export async function fetchMockPapersForExam(examId: string): Promise<MockPaperSpec[]> {
  try {
    const { data, error } = await supabase
      .from("mock_papers")
      .select("*")
      .eq("exam_id", examId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Error fetching mock papers from db:", error);
      return [];
    }
    return (data || []).map((m: any) => ({
      id: m.id,
      exam_id: m.exam_id,
      title: m.title,
      duration_min: m.duration_min || 120,
      pass_mark: m.pass_mark || 75,
      neg_marking_percent: Number(m.neg_marking_percent) || 0,
      total_questions: m.total_questions || 100,
      rules: Array.isArray(m.rules) ? m.rules : [],
      status: m.status || "draft",
    }));
  } catch (err) {
    console.error("Exception fetching mock papers:", err);
    return [];
  }
}

export async function saveMockPaper(mock: Omit<MockPaperSpec, "id"> & { id?: string }): Promise<any> {
  const id = mock.id || `mock-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const payload = {
    id,
    exam_id: mock.exam_id,
    title: mock.title,
    duration_min: mock.duration_min,
    pass_mark: mock.pass_mark,
    neg_marking_percent: mock.neg_marking_percent,
    total_questions: mock.total_questions,
    rules: mock.rules,
    status: mock.status,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("mock_papers")
    .upsert(payload)
    .select();

  if (error) throw error;
  return data;
}

export async function deleteMockPaper(id: string): Promise<any> {
  const { data, error } = await supabase
    .from("mock_papers")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return data;
}

export async function seedTaxonomy(): Promise<{ subjectsCount: number; examsCount: number; questionsCount: number }> {
  let subCount = 0;
  let exCount = 0;
  let qCount = 0;

  try {
    // 1. Seed rawSubjects
    for (const sub of rawSubjects) {
      const { data: exist } = await supabase
        .from("subjects")
        .select("id")
        .eq("id", sub.id)
        .maybeSingle();

      if (!exist) {
        const { error } = await supabase
          .from("subjects")
          .insert({
            id: sub.id,
            title: sub.title,
            description: sub.blurb,
            exam_authority: sub.exam_authority || "DGCA",
            license: sub.license || "CPL",
            sort_order: sub.sort_order || 99,
            status: "published", // seed as published so they show up for study
          });
        if (!error) subCount++;
      }
    }

    // 2. Seed subcategories of seeded subjects
    for (const sub of rawSubjects) {
      if (sub.subTopics && sub.subTopics.length > 0) {
        for (const st of sub.subTopics) {
          const { data: existSubcat } = await supabase
            .from("subcategories")
            .select("id")
            .eq("id", st.id)
            .maybeSingle();

          if (!existSubcat) {
            await supabase
              .from("subcategories")
              .insert({
                id: st.id,
                subject_id: sub.id,
                title: st.title,
                code: st.code || `ATA ${st.id.toUpperCase()}`,
                description: st.description || "",
                status: "published",
                sort_order: 1
              });
          }
        }
      }
    }

    // 3. Seed static exams
    for (const exam of staticExams) {
      const { data: existExam } = await supabase
        .from("exams")
        .select("id")
        .eq("id", exam.id)
        .maybeSingle();

      if (!existExam) {
        const { error } = await supabase
          .from("exams")
          .insert({
            id: exam.id,
            authority: exam.authority,
            license: exam.license,
            title: exam.title,
            pass_mark: exam.pass_mark,
            question_count: exam.question_count,
            duration_min: exam.duration_min,
            negative_marking: exam.negative_marking,
            subject_ids: exam.subject_ids,
            status: "published",
          });
        if (!error) exCount++;
      }
    }

    // 4. Seed questions
    const { staticQuestionBank } = await import("../data/staticQuestions");
    if (staticQuestionBank && staticQuestionBank.length > 0) {
       for (const q of staticQuestionBank) {
         const { data: existQ } = await supabase
           .from("questions")
           .select("id")
           .eq("id", q.id)
           .maybeSingle();
         
         if (!existQ) {
           const { error } = await supabase
             .from("questions")
             .insert({
               id: q.id,
               subcategory_id: q.topicId || q.subcategoryId || null,
               subject_id: q.subjectId || null,
               ata: q.ata || "Uncategorized",
               difficulty: q.difficulty || "standard",
               prompt: q.prompt,
               diagram_caption: q.diagramCaption,
               choices: q.choices,
               correct: q.correct,
               explanation: q.explanation || "",
               refs: q.references || [],
               status: "published",
             });
           if (!error) qCount++;
         }
       }
    }
  } catch (err) {
    console.error("Exception seeding taxonomy:", err);
  }

  return { subjectsCount: subCount, examsCount: exCount, questionsCount: qCount };
}
