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

function buildHRPrompt(numQuestions: number, resumeText?: string, skills?: Skill[]): string {
  const hasResume = resumeText && resumeText.trim().length > 0;
  const hasSkills = skills && skills.length > 0;

  let context = '';
  if (hasResume) {
    context += `\n\nCANDIDATE'S RESUME (use this to personalize questions):\n${resumeText.slice(0, 6000)}\n`;
  }
  if (hasSkills) {
    context += `\nCANDIDATE'S SKILLS: ${skills.map(s => `${s.skill_name} (${s.proficiency_level})`).join(', ')}\n`;
  }

  return `You are an expert HR interviewer generating highly personalized behavioral and situational interview questions.
${context}

Generate ${numQuestions} HR/behavioral interview questions. 

${hasResume ? `CRITICAL INSTRUCTIONS FOR PERSONALIZATION:
- Extract project names, technologies, and experiences mentioned in the resume.
- At least 50% of the questions MUST be directly about specific projects or experiences from the resume.
- Ask about the tech stack choices they made in specific projects (e.g., "In your [project name] project, why did you choose [technology]?")
- Ask about challenges they faced during specific projects mentioned in the resume
- Ask about their role and contributions in team projects mentioned
- Ask about what they would do differently if they rebuilt a specific project
- Reference actual project names, company names, or technologies from their resume

Examples of good personalized questions:
- "Tell me about your [Project Name] project. What was the biggest technical challenge you faced and how did you overcome it?"
- "You mentioned using [Technology] in your [Project Name]. Why did you choose this over alternatives?"
- "What was your specific role in the [Project Name] project? How did you collaborate with your team?"
- "If you could rebuild [Project Name] from scratch, what would you do differently and why?"
` : ''}

Mix the following question types:
1. Project-specific questions (about projects from resume) - at least ${hasResume ? '50%' : '0%'} of questions
2. Behavioral questions (Tell me about a time when...) with STAR method focus
3. Situational questions (What would you do if...)
4. Technical decision-making questions (Why did you choose X over Y?)

Cover these areas:
- Project challenges and problem-solving
- Tech stack decisions and trade-offs
- Leadership and teamwork
- Communication skills
- Conflict resolution and adaptability
- Career goals and motivation

For each question, provide:
- question_type: "hr"
- difficulty: "easy" | "medium" | "hard"
- question_text: the interview question (reference specific projects/technologies from resume when possible)
- expected_answer: key points and structure that a good answer should include (for evaluation purposes)

Vary the difficulty:
- Easy: Basic self-introduction and motivation questions
- Medium: Behavioral questions requiring specific examples from projects
- Hard: Complex situational questions requiring strategic thinking about architecture/design decisions

Return only valid JSON with a "questions" array. Make each question unique, engaging, and deeply personalized to this candidate's background.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { interviewType, skills, interviewId, difficulty, language, resumeText } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const numQuestions = interviewType === 'combined' ? 6 : 4;
    const skillsList = skills as Skill[];
    const selectedLang = language || 'javascript';
    const selectedDifficulty = difficulty || 'adaptive';

    let systemPrompt = '';
    
    if (interviewType === 'coding' || interviewType === 'combined') {
      const codingDifficulties = selectedDifficulty !== 'adaptive' 
        ? `All questions should be ${selectedDifficulty} difficulty.`
        : `Match difficulty to skill levels:\n${skillsList.map((s: Skill) => `- ${s.skill_name}: ${getDifficultyFromLevel(s.proficiency_level)} difficulty`).join('\n')}`;

      systemPrompt = `You are an expert technical interviewer generating ${selectedLang.toUpperCase()} coding interview questions.

Generate ${interviewType === 'combined' ? 3 : numQuestions} unique coding questions.

Programming Language: ${selectedLang}
${codingDifficulties}

For each difficulty level:
- Easy: Basic syntax, simple loops, conditionals, basic data structures
- Medium: Multi-step problems, algorithm implementation, debugging
- Hard: Optimization, complex algorithms, system design thinking

Each question must be scenario-based and practical. Include:
1. A real-world context
2. Clear problem statement in ${selectedLang}
3. Input/output examples using ${selectedLang} syntax
4. Constraints

Return JSON with "questions" array. Each question has:
- question_type: "coding"
- skill_name: "${selectedLang}"
- difficulty: "easy" | "medium" | "hard"
- question_text: full problem in markdown with examples using ${selectedLang} code
- expected_answer: brief description of optimal approach`;
    }

    if (interviewType === 'aptitude' || interviewType === 'combined') {
      const aptitudeDifficulty = selectedDifficulty !== 'adaptive' 
        ? `All questions should be ${selectedDifficulty} difficulty.`
        : 'Vary difficulty based on: medium difficulty by default.';

      const aptitudePrompt = `${interviewType === 'combined' ? '\n\nAlso generate' : 'Generate'} ${interviewType === 'combined' ? 3 : numQuestions} aptitude/reasoning questions covering:
- Logical reasoning
- Verbal ability  
- Quantitative aptitude

CRITICAL: Each question MUST include exactly 4 multiple choice options.
${aptitudeDifficulty}

For aptitude questions, the JSON structure MUST be:
- question_type: "aptitude" | "logical" | "verbal"
- difficulty: "easy" | "medium" | "hard"
- question_text: the question in markdown (do NOT include options here)
- options: ["Option A text", "Option B text", "Option C text", "Option D text"] - EXACTLY 4 options as an array of strings
- expected_answer: the exact text of the correct option (must match one of the options exactly)`;

      systemPrompt += aptitudePrompt;
    }

    if (interviewType === 'hr') {
      systemPrompt = buildHRPrompt(numQuestions, resumeText, skillsList);
    }

    systemPrompt += '\n\nReturn only valid JSON with a "questions" array. Make each question unique and engaging. Ensure all aptitude questions have exactly 4 options in the options array.';

    console.log('Generating questions with:', { interviewType, difficulty: selectedDifficulty, language: selectedLang, hasResumeContext: !!resumeText });

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
      
      // Ensure all aptitude questions have proper options array
      questions = questions.map((q: any) => {
        if (q.question_type !== 'coding' && q.question_type !== 'hr') {
          if (!Array.isArray(q.options) || q.options.length !== 4) {
            console.warn('Question missing proper options, generating defaults:', q.question_text?.substring(0, 50));
            q.options = ['Option A', 'Option B', 'Option C', 'Option D'];
          }
        }
        return q;
      });
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      if (interviewType === 'aptitude') {
        questions = [
          {
            question_type: 'logical',
            difficulty: 'medium',
            question_text: '**Pattern Recognition**\n\nWhat comes next in the sequence: 2, 6, 12, 20, 30, ?',
            options: ['40', '42', '44', '48'],
            expected_answer: '42',
          },
          {
            question_type: 'verbal',
            difficulty: 'medium',
            question_text: '**Synonym Selection**\n\nChoose the word most similar in meaning to "EPHEMERAL":',
            options: ['Permanent', 'Transient', 'Eternal', 'Stable'],
            expected_answer: 'Transient',
          },
          {
            question_type: 'aptitude',
            difficulty: 'easy',
            question_text: '**Basic Calculation**\n\nIf a train travels 120 km in 2 hours, what is its average speed?',
            options: ['50 km/h', '60 km/h', '70 km/h', '80 km/h'],
            expected_answer: '60 km/h',
          },
          {
            question_type: 'logical',
            difficulty: 'hard',
            question_text: '**Logical Deduction**\n\nAll roses are flowers. Some flowers fade quickly. Which statement must be true?',
            options: [
              'All roses fade quickly',
              'Some roses may fade quickly',
              'No roses fade quickly',
              'All flowers are roses'
            ],
            expected_answer: 'Some roses may fade quickly',
          },
        ];
      } else if (interviewType === 'hr') {
        questions = [
          {
            question_type: 'hr',
            difficulty: 'medium',
            question_text: '**Tell me about a time when you had to deal with a difficult team member. How did you handle the situation?**',
            expected_answer: 'A good answer should: 1) Describe the specific situation clearly, 2) Explain the actions taken to address the conflict, 3) Focus on communication and understanding, 4) Describe the positive outcome or lessons learned.',
          },
          {
            question_type: 'hr',
            difficulty: 'easy',
            question_text: '**Why are you interested in this position and our company?**',
            expected_answer: 'A good answer should: 1) Show research about the company, 2) Connect personal skills and goals to the role, 3) Demonstrate genuine enthusiasm, 4) Be specific rather than generic.',
          },
          {
            question_type: 'hr',
            difficulty: 'hard',
            question_text: '**Describe a situation where you had to make a difficult decision with incomplete information. What was your approach?**',
            expected_answer: 'A good answer should: 1) Explain the context and stakes involved, 2) Describe the decision-making framework used, 3) Show how risks were assessed, 4) Explain the outcome and what was learned.',
          },
          {
            question_type: 'hr',
            difficulty: 'medium',
            question_text: '**Tell me about a project you led that failed. What did you learn from it?**',
            expected_answer: 'A good answer should: 1) Take ownership of the failure, 2) Analyze what went wrong objectively, 3) Show self-awareness and growth mindset, 4) Describe specific changes made afterwards.',
          },
        ];
      } else {
        questions = [
          {
            question_type: 'coding',
            skill_name: selectedLang,
            difficulty: 'medium',
            question_text: `**Two Sum Problem**\n\nGiven an array of integers and a target value, return indices of the two numbers that add up to the target.\n\n**Example (${selectedLang}):**\n\`\`\`\nInput: nums = [2, 7, 11, 15], target = 9\nOutput: [0, 1]\nExplanation: nums[0] + nums[1] = 2 + 7 = 9\n\`\`\``,
            expected_answer: 'Use a hash map to store seen values and their indices for O(n) time complexity.',
          }
        ];
      }
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
