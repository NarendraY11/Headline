import { useEffect, useState } from "react";
import type { SubjectItem } from "../data/topics";
import { fetchMergedSubjects } from "../lib/content";

export function useSubjects() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMergedSubjects()
      .then((merged) => { if (active) setSubjects(merged); })
      .catch(console.error)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { subjects, loading };
}
