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
    const { code, language } = await req.json();
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Piston API for code execution (free, no API key required)
    const pistonResponse = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: language || 'javascript',
        version: '*',
        files: [
          {
            name: 'main',
            content: code,
          }
        ],
        run_timeout: 10000, // 10 seconds timeout
      }),
    });

    if (!pistonResponse.ok) {
      throw new Error('Code execution service unavailable');
    }

    const result = await pistonResponse.json();
    
    let output = '';
    if (result.run) {
      output = result.run.output || '';
      if (result.run.stderr) {
        output += '\n' + result.run.stderr;
      }
      if (result.run.signal === 'SIGKILL') {
        output = 'Error: Execution timed out (10 second limit)';
      }
    } else if (result.compile && result.compile.stderr) {
      output = 'Compilation Error:\n' + result.compile.stderr;
    } else {
      output = 'No output';
    }

    return new Response(
      JSON.stringify({ 
        output: output.trim(),
        exitCode: result.run?.code || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in execute-code function:', error);
    return new Response(
      JSON.stringify({ 
        output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        exitCode: 1,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
