import { SubjectItem } from "../data/topics";
import { normalizeSlug } from "./slug";

export function getSubjectMastery(
  logbook: any[],
  subject: SubjectItem,
  questionProgressRecord?: Record<string, any>
): number {
  // Try to load fine-grained per-question progress from passed record or local storage fallback
  let progressMap: Record<string, any> = {};
  if (questionProgressRecord && Object.keys(questionProgressRecord).length > 0) {
    progressMap = questionProgressRecord;
  } else {
    try {
      const saved = localStorage.getItem("heading_question_progress");
      if (saved) {
        progressMap = JSON.parse(saved);
      }
    } catch (e) {
      console.error("Local storage error in getSubjectMastery:", e);
    }
  }

  // Create a normalized set of topic IDs for this subject
  const subjectTopics = new Set<string>();

  subjectTopics.add(normalizeSlug(subject.id));
  if (subject.subTopics) {
    subject.subTopics.forEach(st => subjectTopics.add(normalizeSlug(st.id)));
  }

  let correctCount = 0;
  let totalTracked = 0;

  Object.values(progressMap).forEach((prog: any) => {
    if (prog.topic_id) {
      const normalizedTopic = normalizeSlug(prog.topic_id);
      let isMatch = subjectTopics.has(normalizedTopic);
      if (!isMatch) {
        // Match base/parent prefix (e.g. subtopics of nested hierarchies)
        isMatch = Array.from(subjectTopics).some(t => normalizedTopic.startsWith(t));
      }
      
      if (isMatch) {
        totalTracked++;
        if (prog.correct) {
          correctCount++;
        }
      }
    }
  });

  // Fallback to traditional block logbook if fine-grained question progress isn't recorded yet
  if (totalTracked === 0) {
    if (!logbook || logbook.length === 0) return 0;

    let correct = 0;
    let total = 0;
    
    logbook.forEach(entry => {
      // We can use entry.topicId which matches either subject.id or subject.subTopics[].id
      const isDirectMatch = entry.topicId === subject.id;
      const isSubtopicMatch = subject.subTopics?.some(st => st.id === entry.topicId);
      
      if (isDirectMatch || isSubtopicMatch) {
         correct += entry.correct || 0;
         total += entry.total || 0;
      }
    });
    
    if (total === 0) return 0;
    return correct / total;
  }

  return correctCount / totalTracked;
}

export function getDailyReviewItems(logbook: any[]): string[] {
  if (!logbook || logbook.length === 0) return [];
  
  // Aggregate all wrong question IDs
  const wrongIds = new Set<string>();
  logbook.forEach(entry => {
     if (entry.wrongQuestionIds && Array.isArray(entry.wrongQuestionIds)) {
        entry.wrongQuestionIds.forEach((id: string) => wrongIds.add(id));
     }
  });
  
  // For a basic "Spaced Repetition" simulation, just shuffle and take 10
  const sortedIds = Array.from(wrongIds).sort(() => Math.random() - 0.5);
  return sortedIds.slice(0, 10);
}
