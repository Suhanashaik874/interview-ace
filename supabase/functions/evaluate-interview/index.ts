import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { interviewId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch all questions for this interview
    const { data: questions, error: fetchError } = await supabase
      .from('interview_questions')
      .select('*')
      .eq('interview_id', interviewId);

     if (fetchError) {
       console.error('Error fetching questions:', fetchError);
       throw fetchError;
     }
     
    if (!questions || questions.length === 0) {
       console.error('No questions found for interview:', interviewId);
       // Return a graceful response instead of throwing
       return new Response(
         JSON.stringify({ 
           totalScore: 0, 
           maxScore: 0,
           feedback: 'No questions were found for this interview. Please start a new interview session.',
           error: 'no_questions'
         }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

     console.log(`Evaluating ${questions.length} questions for interview ${interviewId}`);

    let totalScore = 0;
    let maxScore = 0;
    const evaluationPromises = [];

    for (const question of questions) {
      const pointsForDifficulty = {
        easy: 10,
        medium: 20,
        hard: 30,
      };
      
      const maxPoints = pointsForDifficulty[question.difficulty as keyof typeof pointsForDifficulty] || 20;
      maxScore += maxPoints;

      // Build evaluation prompt based on question type
      let evalPrompt = '';
      
      if (question.question_type === 'coding') {
        evalPrompt = `You are a senior software engineer evaluating a coding interview solution.

Question: ${question.question_text}

User's Code:
\`\`\`
${question.user_code || 'No code submitted'}
\`\`\`

Expected Approach: ${question.expected_answer || 'Not specified'}

Evaluate comprehensively based on:
1. Correctness (does it solve the problem?)
2. Code quality and readability
3. Time/space complexity
4. Edge case handling
5. Best practices followed

Return JSON with:
- score: number from 0-100 (percentage)
- is_correct: boolean
- feedback: markdown string with detailed analysis of their solution
- optimal_solution: provide the BEST optimized solution code with inline comments explaining key parts
- time_complexity: string describing time complexity of optimal solution (e.g., "O(n)")
- space_complexity: string describing space complexity of optimal solution (e.g., "O(1)")
- areas_to_improve: array of 3-5 specific, actionable improvement suggestions for the candidate`;
      } else if (question.question_type === 'hr') {
        evalPrompt = `You are an experienced HR interviewer evaluating a behavioral interview response.

Question: ${question.question_text}

User's Answer: ${question.user_answer || 'No answer submitted'}

Evaluate based on:
1. Use of STAR method (Situation, Task, Action, Result)
2. Clarity and structure of response
3. Relevance to the question
4. Demonstration of soft skills
5. Professionalism and communication

Return JSON with:
- score: number from 0-100 (percentage)
- is_correct: true if answer shows competency, false otherwise
- feedback: markdown string with detailed feedback on their response
- areas_to_improve: array of 3-5 specific suggestions for better answers`;
      } else {
        evalPrompt = `Evaluate this aptitude/reasoning answer:

Question: ${question.question_text}
${question.options ? `Options: ${JSON.stringify(question.options)}` : ''}

User's Answer: ${question.user_answer || 'No answer submitted'}
Expected Answer: ${question.expected_answer || 'Not specified'}

Return JSON with:
- score: 100 if correct, 0 if wrong
- is_correct: boolean  
- feedback: detailed explanation of why the answer is correct/incorrect
- solution_steps: step-by-step breakdown of how to solve this problem
- areas_to_improve: array of skills or concepts to review`;
      }

      evaluationPromises.push(
        fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: 'You are a fair and constructive technical interviewer. Provide helpful feedback that helps candidates learn and improve. Return only valid JSON.' },
              { role: 'user', content: evalPrompt }
            ],
            response_format: { type: 'json_object' },
          }),
        }).then(async (response) => {
          if (!response.ok) {
            console.error('AI evaluation failed for question:', question.id);
            return { question, evaluation: null, maxPoints };
          }
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          try {
            return { question, evaluation: JSON.parse(content), maxPoints };
          } catch {
            return { question, evaluation: null, maxPoints };
          }
        })
      );
    }

    const evaluations = await Promise.all(evaluationPromises);

    // Update each question with evaluation results
    for (const { question, evaluation, maxPoints } of evaluations) {
      const score = evaluation 
        ? Math.round((evaluation.score / 100) * maxPoints)
        : 0;
      
      totalScore += score;

      // Store enriched feedback as JSON
      const enrichedFeedback = evaluation ? {
        feedback: evaluation.feedback || 'Evaluation not available',
        optimal_solution: evaluation.optimal_solution || null,
        time_complexity: evaluation.time_complexity || null,
        space_complexity: evaluation.space_complexity || null,
        solution_steps: evaluation.solution_steps || null,
        areas_to_improve: evaluation.areas_to_improve || [],
      } : { feedback: 'Evaluation not available' };

      await supabase
        .from('interview_questions')
        .update({
          is_correct: evaluation?.is_correct ?? false,
          score,
          ai_feedback: JSON.stringify(enrichedFeedback),
        })
        .eq('id', question.id);
    }

    // Generate overall feedback
    const overallPrompt = `Based on these interview results:
Total Score: ${totalScore}/${maxScore} (${Math.round((totalScore/maxScore)*100)}%)

Question Performance:
${evaluations.map(({ question, evaluation }) => 
  `- ${question.question_type} (${question.difficulty}): ${evaluation?.is_correct ? 'Correct' : 'Incorrect'}`
).join('\n')}

Provide a brief, encouraging overall feedback (3-4 sentences) with:
1. What the candidate did well
2. Key areas to improve
3. Specific study recommendations

Return JSON with a "feedback" string field.`;

    const feedbackResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are an encouraging interview coach. Return only valid JSON.' },
          { role: 'user', content: overallPrompt }
        ],
        response_format: { type: 'json_object' },
      }),
    });

    let overallFeedback = 'Thank you for completing the interview. Keep practicing to improve your skills!';
    
    if (feedbackResponse.ok) {
      const feedbackData = await feedbackResponse.json();
      try {
        const parsed = JSON.parse(feedbackData.choices?.[0]?.message?.content);
        overallFeedback = parsed.feedback || overallFeedback;
      } catch {
        // Use default feedback
      }
    }

    console.log(`Interview ${interviewId} evaluated: ${totalScore}/${maxScore}`);

    return new Response(
      JSON.stringify({ 
        totalScore, 
        maxScore,
        feedback: overallFeedback,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in evaluate-interview function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
