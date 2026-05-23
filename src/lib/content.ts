import { supabase } from "./supabase";
import { Question, staticQuestionBank } from "../data/questions";
import { rawSubjects, SubjectItem } from "../data/topics";

let cachedQuestions: Question[] | null = null;
let cachedSubjects: any[] | null = null;
let cachedSubcategories: any[] | null = null;
let cachedMergedSubjects: SubjectItem[] | null = null;

export async function fetchPublishedQuestions(): Promise<Question[]> {
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

  try {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("status", "published")
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("Error fetching subjects, using static fallback:", error);
      cachedSubjects = rawSubjects.map(s => ({
        id: s.id,
        title: s.title,
        description: s.blurb,
        status: "published",
        sort_order: parseInt(s.num) || 1,
      }));
    } else if (data && data.length > 0) {
      cachedSubjects = data;
    } else {
      cachedSubjects = rawSubjects.map(s => ({
        id: s.id,
        title: s.title,
        description: s.blurb,
        status: "published",
        sort_order: parseInt(s.num) || 1,
      }));
    }
  } catch (err) {
    console.warn("Exception fetching subjects, using static fallback:", err);
    cachedSubjects = rawSubjects.map(s => ({
      id: s.id,
      title: s.title,
      description: s.blurb,
      status: "published",
      sort_order: parseInt(s.num) || 1,
    }));
  }

  return cachedSubjects || [];
}

export async function fetchPublishedSubcategories(): Promise<any[]> {
  if (cachedSubcategories) return cachedSubcategories;

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

  return cachedSubcategories || [];
}

export async function fetchMergedSubjects(forceRefresh = false): Promise<SubjectItem[]> {
  if (cachedMergedSubjects && !forceRefresh) return cachedMergedSubjects;

  const questionsList = await fetchPublishedQuestions();
  const dbSubjects = await fetchPublishedSubjects();
  const dbSubcats = await fetchPublishedSubcategories();

  const merged = dbSubjects.map(dbSub => {
    const pMatch = rawSubjects.find(s => s.id === dbSub.id);
    
    const subcatsOfThisSubject = dbSubcats.filter(sc => sc.subject_id === dbSub.id);
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
        questionCount: questionsList.filter(q => q.topicId === dbSubcat.id).length,
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

  cachedMergedSubjects = merged;
  return merged;
}
