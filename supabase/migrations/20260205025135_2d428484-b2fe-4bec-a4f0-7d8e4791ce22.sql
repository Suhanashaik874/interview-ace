-- Drop existing check constraint
ALTER TABLE public.interviews DROP CONSTRAINT IF EXISTS interviews_interview_type_check;

-- Add new check constraint that includes 'hr' type
ALTER TABLE public.interviews ADD CONSTRAINT interviews_interview_type_check 
CHECK (interview_type IN ('coding', 'aptitude', 'combined', 'hr'));