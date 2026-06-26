// Agent-facing exam catalog. The `id` of each entry is the SAME id used by the
// /exams/:examId SEO routes (see the `examsData` keys in
// views/ExamsSeoView.tsx). `authority`/`license` map each public exam type onto
// the real exam configs in lib/content.ts (`staticExams` / the `exams` table),
// so the WebMCP start-test tool and MockExamsView resolve the same target
// without either side hard-coding internal exam ids.
export interface ExamType {
  id: string; // matches /exams/:examId
  label: string;
  authority: string; // matches ExamInfo.authority
  license: string; // matches ExamInfo.license
}

export const EXAM_TYPES: ExamType[] = [
  { id: "dgca-cpl", label: "DGCA CPL", authority: "DGCA", license: "CPL" },
  { id: "dgca-atpl", label: "DGCA ATPL", authority: "DGCA", license: "ATPL" },
  { id: "easa-atpl", label: "EASA ATPL", authority: "EASA", license: "ATPL" },
  { id: "faa-written", label: "FAA Written", authority: "FAA", license: "PPL" },
  { id: "a320-type-rating", label: "A320 Type Rating", authority: "TYPE_RATING", license: "TYPE" },
];

export const EXAM_TYPE_IDS = EXAM_TYPES.map((e) => e.id);

export const getExamType = (id: string): ExamType | undefined =>
  EXAM_TYPES.find((e) => e.id === id);
