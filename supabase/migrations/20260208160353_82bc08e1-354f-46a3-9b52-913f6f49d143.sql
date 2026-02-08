-- Drop the old check constraint that doesn't include 'hr'
ALTER TABLE public.interview_questions DROP CONSTRAINT interview_questions_question_type_check;

-- Add updated check constraint that includes 'hr'
ALTER TABLE public.interview_questions ADD CONSTRAINT interview_questions_question_type_check 
CHECK (question_type = ANY (ARRAY['coding'::text, 'aptitude'::text, 'logical'::text, 'verbal'::text, 'hr'::text]));