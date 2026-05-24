import { supabase } from "./supabase";
import { Question, staticQuestionBank } from "../data/questions";
import { rawSubjects, SubjectItem } from "../data/topics";

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
  try {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .in("id", ids);

    if (error || !data) {
      console.warn("Error fetching questions by IDs:", error);
      return [];
    }

    return data.map((q: any) => ({
      id: q.id,
      topicId: q.subcategory_id || q.subject_id || "",
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
  } catch (err) {
    console.error("Exception fetching questions by IDs:", err);
    return [];
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
      
      const normalize = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
      const normTarget = normalize(topicId);
      
      data = (res.data || []).filter((q: any) => 
        normalize(q.subject_id || "") === normTarget || 
        normalize(q.subcategory_id || "") === normTarget
      );
    }

    let questions = (data || []).map((q: any) => ({
      id: q.id,
      topicId: q.subcategory_id || q.subject_id || "",
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

    if (randomize) {
      questions = questions.sort(() => Math.random() - 0.5);
    }

    return questions.slice(0, limit);
  } catch (err) {
    console.error("Failed fetching quiz questions server-side:", err);
    return [];
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
      if (error) {
        console.warn("Error fetching questions with options:", error);
        return [];
      }

      return (data || []).map((q: any) => ({
        id: q.id,
        topicId: q.subcategory_id || q.subject_id || "",
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
    } catch (err) {
      console.warn("Exception fetching questions with options:", err);
      return [];
    }
  }

  if (cachedQuestions) return cachedQuestions;

  try {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("status", "published");

    if (error) {
      console.warn("Error fetching questions, using static fallback:", error);
      cachedQuestions = staticQuestionBank;
    } else if (data && data.length > 0) {
      cachedQuestions = data.map((q: any) => ({
        id: q.id,
        topicId: q.subcategory_id || q.subject_id || "",
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
    } else {
      cachedQuestions = staticQuestionBank;
    }
  } catch (err) {
    console.warn("Exception fetching questions, using static fallback:", err);
    cachedQuestions = staticQuestionBank;
  }

  return cachedQuestions || staticQuestionBank;
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

   const merged = dbSubjects.map(dbSub => {
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

  cachedMergedSubjects = merged;
  setLocalCache("merged_subjects", merged);
  return merged;
}

export interface ExamInfo {
  id: string;
  authority: "DGCA" | "EASA" | "FAA" | "TYPE_RATING";
  license: "PPL" | "CPL" | "ATPL" | "IR" | "TYPE" | "OTHER";
  title: string;
  pass_mark: number;
  question_count: number;
  duration_min: number;
  negative_marking: boolean;
  subject_ids: string[];
  status: "draft" | "published" | "archived";
}

export const staticExams: ExamInfo[] = [
  {
    id: "dgca-cpl-mock",
    authority: "DGCA",
    license: "CPL",
    title: "DGCA CPL Full Mock - Air Navigation & Meteorology",
    pass_mark: 70,
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
    title: "EASA ATPL Principles of Flight & Meteorology",
    pass_mark: 75,
    question_count: 120,
    duration_min: 120,
    negative_marking: false,
    subject_ids: ["principles-of-flight", "meteorology"],
    status: "published"
  },
  {
    id: "faa-private-mock",
    authority: "FAA",
    license: "PPL",
    title: "FAA Private Pilot Airplane Simulation",
    pass_mark: 70,
    question_count: 60,
    duration_min: 150,
    negative_marking: false,
    subject_ids: ["air-navigation", "meteorology"],
    status: "published"
  },
  {
    id: "a320-technical-mock",
    authority: "TYPE_RATING",
    license: "TYPE",
    title: "A320 Airbus Technical Mock Exam",
    pass_mark: 75,
    question_count: 80,
    duration_min: 90,
    negative_marking: false,
    subject_ids: ["a320-systems"],
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
        question_count: d.question_count || 50,
        duration_min: d.duration_min || 60,
        negative_marking: !!d.negative_marking,
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
  const payload = {
    id,
    authority: exam.authority,
    license: exam.license,
    title: exam.title,
    pass_mark: exam.pass_mark,
    question_count: exam.question_count,
    duration_min: exam.duration_min,
    negative_marking: exam.negative_marking,
    subject_ids: exam.subject_ids,
    status: exam.status,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("exams")
    .upsert(payload)
    .select();

  if (error) throw error;
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

export async function seedTaxonomy(): Promise<{ subjectsCount: number; examsCount: number }> {
  let subCount = 0;
  let exCount = 0;

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
  } catch (err) {
    console.error("Exception seeding taxonomy:", err);
  }

  return { subjectsCount: subCount, examsCount: exCount };
}
