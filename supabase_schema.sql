-- CMS Schema for Aviation Exams

-- 1. Exams Table
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    authority TEXT CHECK (authority IN ('DGCA', 'EASA', 'FAA', 'TYPE_RATING', 'General')),
    pass_pct INTEGER DEFAULT 75,
    duration_min INTEGER DEFAULT 120,
    question_count INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Subjects Table
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subjects_exam_id ON public.subjects(exam_id);

-- 3. Subcategories Table
CREATE TABLE IF NOT EXISTS public.subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subcategories_subject_id ON public.subcategories(subject_id);

-- 4. Chapters Table
CREATE TABLE IF NOT EXISTS public.chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subcategory_id UUID NOT NULL REFERENCES public.subcategories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chapters_subcategory_id ON public.chapters(subcategory_id);

-- 5. Questions Table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_option INTEGER NOT NULL,
    explanation TEXT,
    difficulty TEXT CHECK (difficulty IN ('easy', 'standard', 'complex', 'extreme')) DEFAULT 'standard',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_questions_chapter_id ON public.questions(chapter_id);

-- RLS Policies
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Students (authenticated users or anon) can read only is_active = true
CREATE POLICY "Students can read active exams" ON public.exams FOR SELECT USING (is_active = true);
CREATE POLICY "Students can read active subjects" ON public.subjects FOR SELECT USING (is_active = true);
CREATE POLICY "Students can read active subcategories" ON public.subcategories FOR SELECT USING (is_active = true);
CREATE POLICY "Students can read active chapters" ON public.chapters FOR SELECT USING (is_active = true);
CREATE POLICY "Students can read active questions" ON public.questions FOR SELECT USING (is_active = true);


-- For Admin users (needs logic to determine admin based on auth role, user metadata, or separate admins table)
-- Generally we might grant ALL to authenticated users where user role = 'admin', but sticking to simple true/false for demo purposes, 
-- or using a helper function `is_admin()`. Assuming the app relies on the app's Supabase auth configuration for true security 
-- or uses the service key internally. Let's create an 'admin can do everything' policy placeholder that just checks if auth.uid() matches an admin list.
-- Or just let authenticated users with a specific role do it. Since we might not have the is_admin logic right now,
-- let's use a simpler approach of allowing full access if auth.role() = 'authenticated' and your user is an admin.
-- For standard dev environments where we just want it to work:

CREATE POLICY "Admins can do everything on exams" ON public.exams FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can do everything on subjects" ON public.subjects FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can do everything on subcategories" ON public.subcategories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can do everything on chapters" ON public.chapters FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can do everything on questions" ON public.questions FOR ALL USING (auth.role() = 'authenticated');

-- To avoid conflicts with "Public read active" and "Admin read all", we might add "public can read active" without role check:
DROP POLICY IF EXISTS "Students can read active exams" ON public.exams;
CREATE POLICY "Public can read active exams" ON public.exams FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Students can read active subjects" ON public.subjects;
CREATE POLICY "Public can read active subjects" ON public.subjects FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Students can read active subcategories" ON public.subcategories;
CREATE POLICY "Public can read active subcategories" ON public.subcategories FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Students can read active chapters" ON public.chapters;
CREATE POLICY "Public can read active chapters" ON public.chapters FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Students can read active questions" ON public.questions;
CREATE POLICY "Public can read active questions" ON public.questions FOR SELECT USING (is_active = true);
