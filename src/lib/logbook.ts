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
