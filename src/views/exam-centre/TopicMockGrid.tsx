// M12: Topic Mock Exam Grid — one card per DGCA subject

import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useMasterySnapshots } from "../../hooks/useMasterySnapshots";

interface TopicConfig {
  subjectId: string;
  label: string;
  code: string;
  questions: number;
  minutes: number;
  passMark: number;
  hue: string;
}

const TOPICS: TopicConfig[] = [
  { subjectId: "air-navigation",  label: "Navigation",      code: "NAV", questions: 40, minutes: 50, passMark: 70, hue: "text-navy" },
  { subjectId: "meteorology",     label: "Meteorology",     code: "MET", questions: 30, minutes: 40, passMark: 70, hue: "text-sky-500" },
  { subjectId: "air-regulation",  label: "Air Regulations", code: "REG", questions: 35, minutes: 45, passMark: 70, hue: "text-mint" },
  { subjectId: "technical-general", label: "Technical General", code: "TGK", questions: 30, minutes: 40, passMark: 70, hue: "text-amber" },
  { subjectId: "rtr-a",           label: "RTR (A)",         code: "RTR", questions: 25, minutes: 35, passMark: 70, hue: "text-signal" },
];

const MASTERY_BAR_COLOR = (m: number) =>
  m >= 80 ? "#16a34a" : m >= 65 ? "#e5a93c" : m < 50 ? "#e33a2e" : "#557B96";

export function TopicMockGrid() {
  const navigate = useNavigate();
  const { snapshots } = useMasterySnapshots();

  const masteryMap: Record<string, number> = {};
  for (const s of snapshots) masteryMap[s.subject_id] = s.mastery;

  function launch(topic: TopicConfig) {
    navigate(`/quiz/${topic.subjectId}`, {
      state: {
        overrideTimeLimit: topic.minutes * 60,
        overridePassMark: topic.passMark,
        examTitle: `${topic.label} Topic Mock`,
      },
    });
  }

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen size={15} className="text-navy" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">Topic Mocks</span>
      </div>
      <h3 className="font-serif text-[18px] text-ink mb-4">By Subject</h3>

      <div className="space-y-2">
        {TOPICS.map(t => {
          const mastery = masteryMap[t.subjectId];
          const hasMastery = mastery !== undefined;
          return (
            <button
              key={t.subjectId}
              onClick={() => launch(t)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-rule hover:border-navy/30 hover:bg-bg-2/40 transition-colors text-left"
            >
              <span className={`font-mono text-[9px] font-bold w-8 flex-shrink-0 ${t.hue}`}>{t.code}</span>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[12px] text-ink font-medium">{t.label}</p>
                <p className="font-mono text-[8px] text-muted-2">{t.questions}Q · {t.minutes}min · {t.passMark}% pass</p>
                {hasMastery && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-1 bg-bg-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${mastery}%`, backgroundColor: MASTERY_BAR_COLOR(mastery) }}
                      />
                    </div>
                    <span className="font-mono text-[7px] text-muted-2">{mastery}%</span>
                  </div>
                )}
              </div>
              <span className="font-mono text-[9px] text-muted-2 flex-shrink-0">Start →</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
