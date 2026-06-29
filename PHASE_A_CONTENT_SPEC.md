# Phase A — Content Seeding Specification

You asked what format you need to prepare for Phase A content seeding. Here's the exact spec.

---

## What I Need from You

**≥1,500 DGCA CPL questions with explanations** across ~10 subjects (Air Navigation, Meteorology, Air Regulations, Technical General/Specific, RTR, Performance, Principles of Flight, Flight Planning, Human Performance, Mass & Balance).

**Plus 3–5 full timed mock papers** (100 questions each, subject mix matching real exam distribution).

---

## Format Options (Pick One)

### Option 1: CSV (simplest, recommended)

One row per question. The import parser is case-insensitive and accepts many synonyms for column names. **Required columns:**

| Column | Example | Notes |
|--------|---------|-------|
| `prompt` or `question` | "What is the standard temperature lapse rate in the ISA troposphere?" | The question text. |
| `choices` or `options` or `answers` | "A) 2°C per 1000ft\|B) 1.98°C per 1000ft\|C) 3°C per 1000ft\|D) 1°C per 1000ft" | Pipe-separated (or newline, or as separate columns choice_a/choice_b/choice_c/choice_d). |
| `correct` or `answer` | "B" or "1.98°C per 1000ft" | The correct choice. Accepts letter (A/B/C/D), number (1/2/3/4), or exact choice text match. |
| `explanation` or `rationale` or `why` | "ISA standard lapse rate is 1.98°C per 1000 feet (approximately 2°C) up to the tropopause at 36,089 feet." | Why the answer is correct. |

**Optional columns (highly recommended):**

| Column | Example | Notes |
|--------|---------|-------|
| `subject` or `subject_id` | "air-navigation" or "Air Navigation" | Maps to your subject taxonomy. Case-insensitive slugs. |
| `module` or `subcategory` | "dead-reckoning" | Finer grouping under subject. |
| `topic` or `topic_id` | "wind-velocity" | Finest grain. |
| `difficulty` | "standard" or "complex" or "extreme" | Defaults to "standard". |
| `ata` or `ata_chapter` | "27" or "27-FLIGHT CONTROLS" | ATA chapter (for type-rating). |
| `authority` | "DGCA" or "EASA" or "FAA" | Regulatory authority. |
| `certification` or `exam` | "dgca-cpl" or "CPL" | Target exam. Resolver maps "CPL" → "dgca-cpl" if authority=DGCA. |
| `tags` or `topic_tags` | "vectors, relative velocity, crosswind" | Comma-separated keywords. |
| `references` or `refs` | "ICAO Annex 2, CAR Section 3" | Comma-separated citations. |
| `regulation` or `reg` | "CAR 2.3.1" | Specific rule reference. |

**Minimal working CSV (3 columns):**
```csv
prompt,choices,correct,explanation
"What is the standard temperature lapse rate?","2°C/1000ft|1.98°C/1000ft|3°C/1000ft|1°C/1000ft","1.98°C/1000ft","ISA lapse rate is 1.98°C per 1000ft."
```

**Full CSV (all columns):**
```csv
prompt,choice_a,choice_b,choice_c,choice_d,correct,explanation,difficulty,subject,module,topic,authority,certification,ata,tags,references
"What is the standard temperature lapse rate in the ISA troposphere?","2°C per 1000ft","1.98°C per 1000ft","3°C per 1000ft","1°C per 1000ft","B","ISA standard lapse rate is 1.98°C per 1000 feet up to 36,089 feet.","standard","meteorology","atmosphere","isa-standard-atmosphere","DGCA","dgca-cpl","","atmospheric science, ISA","ICAO Annex 3"
```

---

### Option 2: JSON

Array of objects, or `{ "questions": [...] }` wrapper. Same field names as CSV (case-insensitive).

```json
[
  {
    "prompt": "What is the standard temperature lapse rate in the ISA troposphere?",
    "choices": ["2°C per 1000ft", "1.98°C per 1000ft", "3°C per 1000ft", "1°C per 1000ft"],
    "correct": "B",
    "explanation": "ISA standard lapse rate is 1.98°C per 1000 feet up to the tropopause at 36,089 feet.",
    "difficulty": "standard",
    "subject": "meteorology",
    "module": "atmosphere",
    "topic": "isa-standard-atmosphere",
    "authority": "DGCA",
    "certification": "dgca-cpl",
    "tags": ["atmospheric science", "ISA"],
    "references": ["ICAO Annex 3"]
  }
]
```

---

### Option 3: I scaffold the template, you fill it

If you don't have questions in CSV/JSON yet, I can:
1. Generate an empty CSV template with 1,500 rows pre-structured (subject distribution matching DGCA CPL syllabus).
2. You fill the `prompt`, `choices`, `correct`, `explanation` columns.
3. I import it.

Let me know if you want this.

---

## Mock Papers

Separately, I need **3–5 mock paper definitions**. These are metadata (not individual questions — questions come from the main bank above).

**Mock paper spec (CSV or JSON):**

| Field | Example | Notes |
|-------|---------|-------|
| `id` | "dgca-cpl-mock-1" | Unique slug. |
| `title` | "DGCA CPL Mock Paper 1" | Display name. |
| `exam_id` | "dgca-cpl-01" | Links to exams table. |
| `duration_min` | 180 | Total time (minutes). |
| `pass_mark` | 75 | Pass percentage. |
| `neg_marking_percent` | 0.25 | Penalty per wrong answer (0.25 = −¼). |
| `total_questions` | 100 | Total Q count. |
| `rules` | `[{"subject_id": "air-navigation", "count": 15}, {"subject_id": "meteorology", "count": 12}, ...]` | JSON array: how many questions from each subject. |

**Minimal mock paper JSON:**
```json
[
  {
    "id": "dgca-cpl-mock-1",
    "title": "DGCA CPL Mock Paper 1",
    "exam_id": "dgca-cpl-01",
    "duration_min": 180,
    "pass_mark": 75,
    "total_questions": 100,
    "rules": [
      {"subject_id": "air-navigation", "count": 15},
      {"subject_id": "meteorology", "count": 12},
      {"subject_id": "air-regulations", "count": 10}
    ]
  }
]
```

The import pipeline will validate rules sum to `total_questions`.

---

## What Happens Next

Once you provide the files:
1. I run the import via `/admin/content-import` (flag `contentImport`, already built, 268 tests pass).
2. Parser normalizes your CSV/JSON → canonical question model.
3. Validator checks: required fields, choice count (2–6), correct answer exists, no duplicate prompts (via hash).
4. Deduplicator shows you any existing questions with the same prompt hash (so you can skip or override).
5. You preview + approve the batch.
6. I publish to `questions` table (status=published).
7. Mock papers saved to `mock_papers` table.
8. I un-hardcode the timed-mock gate (`QuizView.tsx:1504`, `QuizSetup.tsx:66`) so all mocks unlock.

**ETA after you supply files:** 2–3 hours (import + gate fixes + smoke test).

---

## Summary

**Minimum viable Phase A delivery:**
- 1 CSV or JSON file with ≥1,500 questions (columns: prompt, choices, correct, explanation, subject).
- 1 CSV or JSON file with 3–5 mock paper specs (id, title, duration, rules).

**Or:** tell me you want me to scaffold empty templates first, and you'll fill them.

Ready when you are.
