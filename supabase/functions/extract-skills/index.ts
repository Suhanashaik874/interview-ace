import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resumeText } = await req.json();
    
    if (!resumeText) {
      return new Response(
        JSON.stringify({ error: 'Resume text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert resume analyzer. Extract technical skills from the resume text provided.
    
For each skill, determine a proficiency level based on context clues:
- "beginner": Mentioned briefly, coursework, learning, basic exposure
- "intermediate": Work experience, projects, comfortable usage
- "advanced": Years of experience, lead roles, expert, architected, designed systems

Return a JSON object with a "skills" array containing objects with "name" (string) and "level" (string) properties.
Focus on:
- Programming languages (Python, JavaScript, Java, C++, etc.)
- Frameworks & libraries (React, Angular, Django, etc.)
- Databases (MySQL, MongoDB, PostgreSQL, etc.)
- Cloud services (AWS, Azure, GCP)
- Tools & technologies (Docker, Kubernetes, Git, etc.)
- Concepts (Machine Learning, Data Structures, System Design, etc.)

Only return valid JSON, no additional text.`;

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
          { role: 'user', content: `Extract skills from this resume:\n\n${resumeText.slice(0, 8000)}` }
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
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    let skills = [];
    try {
      const parsed = JSON.parse(content);
      skills = parsed.skills || [];
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      // Fallback: try to extract skills using regex
      const skillMatches = resumeText.match(/\b(python|javascript|typescript|java|c\+\+|react|angular|vue|node\.js|express|django|flask|spring|aws|azure|gcp|docker|kubernetes|git|sql|mongodb|postgresql|mysql|html|css|tailwind|graphql|rest|api|machine learning|deep learning|data science|algorithms|data structures)\b/gi);
      if (skillMatches) {
        const uniqueSkills = [...new Set(skillMatches.map((s: string) => s.toLowerCase()))] as string[];
        skills = uniqueSkills.map((name) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), level: 'intermediate' }));
      }
    }

    console.log('Extracted skills:', skills);

    return new Response(
      JSON.stringify({ skills }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in extract-skills function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
