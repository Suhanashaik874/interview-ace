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

    if (fetchError) throw fetchError;
    if (!questions || questions.length === 0) {
      throw new Error('No questions found for this interview');
    }

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

      // Prepare evaluation prompt
      const evalPrompt = question.question_type === 'coding' 
        ? `Evaluate this coding solution:

Question: ${question.question_text}

User's Code:
\`\`\`
${question.user_code || 'No code submitted'}
\`\`\`

Expected Approach: ${question.expected_answer || 'Not specified'}

Evaluate based on:
1. Correctness (does it solve the problem?)
2. Code quality and readability
3. Time/space complexity
4. Edge case handling

Return JSON with:
- score: number from 0-100 (percentage)
- is_correct: boolean
- feedback: markdown string with what was done well, what could improve, and optimal approach explanation`
        : `Evaluate this answer:

Question: ${question.question_text}
${question.options ? `Options: ${JSON.stringify(question.options)}` : ''}

User's Answer: ${question.user_answer || 'No answer submitted'}
Expected Answer: ${question.expected_answer || 'Not specified'}

Return JSON with:
- score: 100 if correct, 0 if wrong
- is_correct: boolean  
- feedback: brief explanation of why the answer is correct/incorrect and the right approach`;

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

      await supabase
        .from('interview_questions')
        .update({
          is_correct: evaluation?.is_correct ?? false,
          score,
          ai_feedback: evaluation?.feedback || 'Evaluation not available',
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
