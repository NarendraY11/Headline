import { SubjectItem } from "../data/topics";

export function getSubjectMastery(logbook: any[], subject: SubjectItem): number {
  if (!logbook || logbook.length === 0) return subject.mastery;

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
  
  if (total === 0) return subject.mastery; // fallback to hardcoded if no data
  return correct / total;
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
