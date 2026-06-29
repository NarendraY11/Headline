import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlayCircle, X } from "lucide-react";
import { QUIZ_STATE_PREFIX } from "../../lib/storageKeys";

interface ResumeInfo {
  topicId: string;
  label: string;
  currentIndex: number;
  total: number;
}

// Reads the most recent in-progress quiz session from localStorage and offers
// a one-tap resume on the dashboard.
export function ResumeCard() {
  const navigate = useNavigate();
  const [resume, setResume] = useState<ResumeInfo | null>(null);

  useEffect(() => {
    try {
      let best: { info: ResumeInfo; ts: number } | null = null;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(QUIZ_STATE_PREFIX)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const st = JSON.parse(raw);
        if (st?.status !== "active" || !(st.timeElapsed > 0)) continue;
        const topicId = key.replace(QUIZ_STATE_PREFIX, "");
        const total = Array.isArray(st.questionIds) ? st.questionIds.length : 0;
        const info: ResumeInfo = {
          topicId,
          label: topicId.replace(/[-_]/g, " "),
          currentIndex: (st.currentIndex || 0) + 1,
          total,
        };
        const ts = st.savedAt || st.timeElapsed || 0;
        if (!best || ts > best.ts) best = { info, ts };
      }
      if (best) setResume(best.info);
    } catch {
      /* ignore */
    }
  }, []);

  if (!resume) return null;

  return (
    <div className="relative flex items-center justify-between gap-3 bg-navy/5 border border-navy/20 rounded-xl p-4 mb-6">
      <button
        onClick={() => setResume(null)}
        className="absolute top-2 right-2 p-1.5 -m-1.5 text-muted-2 hover:text-ink"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <div className="min-w-0">
        <div className="font-mono text-[9px] uppercase tracking-wide text-navy mb-0.5">Resume where you left off</div>
        <div className="font-serif text-base text-ink truncate capitalize">{resume.label}</div>
        {resume.total > 0 && (
          <div className="font-sans text-[11px] text-muted-2 mt-0.5">
            Question {resume.currentIndex} of {resume.total}
          </div>
        )}
      </div>
      <button
        onClick={() => navigate(`/quiz/${resume.topicId}`)}
        className="shrink-0 inline-flex items-center gap-1.5 bg-navy text-bg hover:bg-navy-dark px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider font-bold transition-colors"
      >
        <PlayCircle size={14} /> Resume
      </button>
    </div>
  );
}
