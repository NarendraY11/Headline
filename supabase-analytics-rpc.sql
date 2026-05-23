-- SUPABASE RPC SQL FUNCTIONS FOR HEAVY AGGREGATIONS --
-- Run these statements in the Supabase SQL Editor to enable RPC operations.

-- 1. Get Top 10 Usage By Subject filtered by relative time_range
CREATE OR REPLACE FUNCTION get_usage_by_subject(time_range TEXT)
RETURNS TABLE(subject_id TEXT, subject_title TEXT, usage_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.subject_id::text,
    COALESCE(s.title, e.subject_id)::text AS subject_title,
    COUNT(*)::BIGINT AS usage_count
  FROM events e
  LEFT JOIN subjects s ON s.id = e.subject_id
  WHERE e.event_type = 'quiz_start'
    AND (
      time_range = 'All'
      OR (time_range = 'Today' AND e.created_at >= NOW() - INTERVAL '1 day')
      OR (time_range = '7d' AND e.created_at >= NOW() - INTERVAL '7 days')
      OR (time_range = '30d' AND e.created_at >= NOW() - INTERVAL '30 days')
    )
  GROUP BY e.subject_id, s.title
  ORDER BY usage_count DESC
  LIMIT 10;
END;
$$;


-- 2. Get Subcategory Heatmap (answer count of questions per subject and subcategory)
CREATE OR REPLACE FUNCTION get_subcategory_heatmap(time_range TEXT)
RETURNS TABLE(subject_title TEXT, subcategory_code TEXT, subcategory_title TEXT, answer_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    subj.title::TEXT AS subject_title,
    subc.code::TEXT AS subcategory_code,
    subc.title::TEXT AS subcategory_title,
    COUNT(e.id)::BIGINT AS answer_count
  FROM events e
  JOIN subcategories subc ON subc.id = e.subcategory_id
  JOIN subjects subj ON subj.id = subc.subject_id
  WHERE e.event_type = 'question_answered'
    AND (
      time_range = 'All'
      OR (time_range = 'Today' AND e.created_at >= NOW() - INTERVAL '1 day')
      OR (time_range = '7d' AND e.created_at >= NOW() - INTERVAL '7 days')
      OR (time_range = '30d' AND e.created_at >= NOW() - INTERVAL '30 days')
    )
  GROUP BY subj.title, subc.code, subc.title
  ORDER BY answer_count DESC;
END;
$$;


-- 3. Get Hardest Questions (lowest correct response rates)
CREATE OR REPLACE FUNCTION get_hardest_questions(limit_count INT)
RETURNS TABLE(question_id TEXT, prompt TEXT, incorrect_count BIGINT, total_count BIGINT, correct_rate NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH question_stats AS (
    SELECT 
      e.question_id,
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE (e.metadata->>'correct')::boolean = true) AS correct_count
    FROM events e
    WHERE e.event_type = 'question_answered' AND e.question_id IS NOT NULL
    GROUP BY e.question_id
    HAVING COUNT(*) >= 1 -- list any question with at least one answer
  )
  SELECT 
    qs.question_id::TEXT,
    COALESCE(q.prompt, 'Question ID ' || qs.question_id)::TEXT AS prompt,
    (qs.total_count - qs.correct_count)::BIGINT AS incorrect_count,
    qs.total_count::BIGINT AS total_count,
    ROUND((qs.correct_count::numeric / qs.total_count::numeric) * 100, 1) AS correct_rate
  FROM question_stats qs
  LEFT JOIN questions q ON q.id = qs.question_id
  ORDER BY correct_rate ASC
  LIMIT limit_count;
END;
$$;
