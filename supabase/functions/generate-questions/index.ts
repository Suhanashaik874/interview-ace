import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Skill {
  skill_name: string;
  proficiency_level: 'beginner' | 'intermediate' | 'advanced';
}

function getDifficultyFromLevel(level: string): string {
  switch (level) {
    case 'beginner': return 'easy';
    case 'intermediate': return 'medium';
    case 'advanced': return 'hard';
    default: return 'medium';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { interviewType, skills, interviewId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const numQuestions = interviewType === 'combined' ? 6 : 4;
    const skillsList = skills as Skill[];

    let systemPrompt = '';
    
    if (interviewType === 'coding' || interviewType === 'combined') {
      systemPrompt = `You are an expert technical interviewer generating coding interview questions.

Generate ${interviewType === 'combined' ? 3 : numQuestions} unique coding questions based on these skills and levels:
${skillsList.map((s: Skill) => `- ${s.skill_name} (${s.proficiency_level} → ${getDifficultyFromLevel(s.proficiency_level)} difficulty)`).join('\n')}

For each skill level:
- Beginner (easy): Basic syntax, simple loops, conditionals, basic data structures
- Intermediate (medium): Multi-step problems, algorithm implementation, debugging
- Advanced (hard): Optimization, complex algorithms, system design thinking

Each question must be scenario-based and practical. Include:
1. A real-world context
2. Clear problem statement
3. Input/output examples
4. Constraints

Return JSON with "questions" array. Each question has:
- question_type: "coding"
- skill_name: the skill being tested
- difficulty: "easy" | "medium" | "hard"
- question_text: full problem in markdown with examples
- expected_answer: brief description of optimal approach`;
    }

    if (interviewType === 'aptitude' || interviewType === 'combined') {
      const aptitudePrompt = `${interviewType === 'combined' ? '\n\nAlso generate' : 'Generate'} ${interviewType === 'combined' ? 3 : numQuestions} aptitude/reasoning questions covering:
- Logical reasoning
- Verbal ability
- Quantitative aptitude

Include multiple choice options (4 options each) and mark the correct answer.
Vary difficulty based on: ${skillsList.length > 0 ? 'the average skill level' : 'medium difficulty'}.

For aptitude questions, include:
- question_type: "aptitude" | "logical" | "verbal"
- difficulty: based on complexity
- question_text: the question in markdown
- options: array of 4 choices
- expected_answer: the correct option`;

      systemPrompt += aptitudePrompt;
    }

    systemPrompt += '\n\nReturn only valid JSON with a "questions" array. Make each question unique and engaging.';

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate interview questions now. Interview ID: ${interviewId}. Timestamp: ${Date.now()} (use this to ensure uniqueness)` }
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    let questions = [];
    try {
      const parsed = JSON.parse(content);
      questions = parsed.questions || [];
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      // Fallback questions
      questions = [
        {
          question_type: 'coding',
          skill_name: 'JavaScript',
          difficulty: 'medium',
          question_text: '**Two Sum Problem**\n\nGiven an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\n**Example:**\n```\nInput: nums = [2, 7, 11, 15], target = 9\nOutput: [0, 1]\nExplanation: nums[0] + nums[1] = 2 + 7 = 9\n```',
          expected_answer: 'Use a hash map to store seen values and their indices for O(n) time complexity.',
        }
      ];
    }

    console.log('Generated questions:', questions.length);

    return new Response(
      JSON.stringify({ questions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-questions function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
