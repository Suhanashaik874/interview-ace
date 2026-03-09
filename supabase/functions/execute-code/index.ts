import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Judge0 CE language IDs
const languageIds: Record<string, number> = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54,
  c: 50,
  typescript: 74,
  ruby: 72,
  go: 60,
  rust: 73,
  php: 68,
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, language, testCases } = await req.json();
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const langId = languageIds[language || 'javascript'] || 63;

    // If testCases provided, run each test case
    if (testCases && Array.isArray(testCases) && testCases.length > 0) {
      const results = [];
      for (const tc of testCases) {
        const result = await executeCode(code, langId, tc.input || '');
        const passed = result.output.trim() === (tc.expectedOutput || '').trim();
        results.push({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: result.output,
          passed,
          exitCode: result.exitCode,
        });
      }
      return new Response(
        JSON.stringify({ testResults: results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single execution
    const result = await executeCode(code, langId, '');
    return new Response(
      JSON.stringify({ output: result.output, exitCode: result.exitCode }),
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

async function executeCode(code: string, langId: number, stdin: string) {
  // Submit to Judge0 CE
  const submitRes = await fetch('https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': Deno.env.get('JUDGE0_API_KEY') || '',
      'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
    },
    body: JSON.stringify({
      source_code: code,
      language_id: langId,
      stdin: stdin,
      cpu_time_limit: 10,
      wall_time_limit: 15,
    }),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    console.error('Judge0 submit error:', errText);
    // Fallback: try the free public endpoint without API key
    return await executeCodeFallback(code, langId, stdin);
  }

  const { token } = await submitRes.json();
  
  // Poll for result
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const pollRes = await fetch(`https://judge0-ce.p.rapidapi.com/submissions/${token}?base64_encoded=false`, {
      headers: {
        'X-RapidAPI-Key': Deno.env.get('JUDGE0_API_KEY') || '',
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
      },
    });
    const result = await pollRes.json();
    
    // Status: 1=In Queue, 2=Processing, 3=Accepted, 4=Wrong Answer, 5=TLE, 6+=errors
    if (result.status && result.status.id > 2) {
      if (result.compile_output) {
        return { output: 'Compilation Error:\n' + result.compile_output, exitCode: 1 };
      }
      if (result.status.id === 5) {
        return { output: 'Error: Time Limit Exceeded', exitCode: 1 };
      }
      if (result.status.id === 6) {
        return { output: 'Error: Runtime Error\n' + (result.stderr || ''), exitCode: 1 };
      }
      const output = result.stdout || result.stderr || 'No output';
      return { output: output.trim(), exitCode: result.status.id === 3 ? 0 : 1 };
    }
  }
  
  return { output: 'Error: Execution timed out waiting for result', exitCode: 1 };
}

async function executeCodeFallback(code: string, langId: number, stdin: string) {
  // Use free Judge0 CE endpoint (no API key)
  const submitRes = await fetch('https://ce.judge0.com/submissions?base64_encoded=false&wait=true&fields=stdout,stderr,compile_output,status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_code: code,
      language_id: langId,
      stdin: stdin,
      cpu_time_limit: 10,
    }),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    console.error('Judge0 fallback error:', errText);
    throw new Error('Code execution service unavailable');
  }

  const result = await submitRes.json();
  
  if (result.compile_output) {
    return { output: 'Compilation Error:\n' + result.compile_output, exitCode: 1 };
  }
  if (result.status?.id === 5) {
    return { output: 'Error: Time Limit Exceeded', exitCode: 1 };
  }
  
  const output = result.stdout || result.stderr || 'No output';
  return { output: output.trim(), exitCode: result.status?.id === 3 ? 0 : 1 };
}
