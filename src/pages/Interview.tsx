import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Loader2,
  Code,
  Brain,
  Play,
  RefreshCw,
  Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Question {
  id?: string;
  question_type: string;
  skill_name?: string;
  difficulty: string;
  question_text: string;
  expected_answer?: string;
  user_answer?: string;
  user_code?: string;
  options?: string[];
}

const languageMap: Record<string, { monaco: string; piston: string; display: string; template: string }> = {
  javascript: { 
    monaco: 'javascript', 
    piston: 'javascript', 
    display: 'JavaScript',
    template: '// Write your JavaScript code here\n\nfunction solution() {\n  // Your code here\n}\n\n// Test your solution\nconsole.log(solution());'
  },
  typescript: { 
    monaco: 'typescript', 
    piston: 'typescript', 
    display: 'TypeScript',
    template: '// Write your TypeScript code here\n\nfunction solution(): void {\n  // Your code here\n}\n\n// Test your solution\nsolution();'
  },
  python: { 
    monaco: 'python', 
    piston: 'python', 
    display: 'Python',
    template: '# Write your Python code here\n\ndef solution():\n    # Your code here\n    pass\n\n# Test your solution\nprint(solution())'
  },
  java: { 
    monaco: 'java', 
    piston: 'java', 
    display: 'Java',
    template: 'public class Main {\n    public static void main(String[] args) {\n        // Your code here\n        System.out.println("Hello, World!");\n    }\n}'
  },
  cpp: { 
    monaco: 'cpp', 
    piston: 'c++', 
    display: 'C++',
    template: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    cout << "Hello, World!" << endl;\n    return 0;\n}'
  },
  c: { 
    monaco: 'c', 
    piston: 'c', 
    display: 'C',
    template: '#include <stdio.h>\n\nint main() {\n    // Your code here\n    printf("Hello, World!\\n");\n    return 0;\n}'
  },
  go: { 
    monaco: 'go', 
    piston: 'go', 
    display: 'Go',
    template: 'package main\n\nimport "fmt"\n\nfunc main() {\n    // Your code here\n    fmt.Println("Hello, World!")\n}'
  },
  rust: { 
    monaco: 'rust', 
    piston: 'rust', 
    display: 'Rust',
    template: 'fn main() {\n    // Your code here\n    println!("Hello, World!");\n}'
  },
  ruby: { 
    monaco: 'ruby', 
    piston: 'ruby', 
    display: 'Ruby',
    template: '# Write your Ruby code here\n\ndef solution\n  # Your code here\nend\n\n# Test your solution\nputs solution'
  },
  php: { 
    monaco: 'php', 
    piston: 'php', 
    display: 'PHP',
    template: '<?php\n// Write your PHP code here\n\nfunction solution() {\n    // Your code here\n    return "Hello, World!";\n}\n\necho solution();\n?>'
  },
};

export default function Interview() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [interview, setInterview] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(searchParams.get('language') || 'javascript');
  const [code, setCode] = useState(languageMap[searchParams.get('language') || 'javascript']?.template || '');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const selectedDifficulty = searchParams.get('difficulty') || 'adaptive';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchInterview();
    }
  }, [user, id]);

  useEffect(() => {
    // Timer
    const interval = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update code template when language changes
  useEffect(() => {
    const lang = languageMap[selectedLanguage];
    if (lang && !questions[currentIndex]?.user_code) {
      setCode(lang.template);
    }
  }, [selectedLanguage]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchInterview = async () => {
    try {
      const { data: interviewData } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', id)
        .single();

      if (!interviewData) {
        navigate('/dashboard');
        return;
      }

      setInterview(interviewData);

      // Check if questions already exist
      const { data: existingQuestions } = await supabase
        .from('interview_questions')
        .select('*')
        .eq('interview_id', id);

      if (existingQuestions && existingQuestions.length > 0) {
        setQuestions(existingQuestions);
        if (existingQuestions[0].user_code) {
          setCode(existingQuestions[0].user_code);
        }
        if (existingQuestions[0].user_answer) {
          setSelectedAnswer(existingQuestions[0].user_answer);
        }
      } else {
        await generateQuestions(interviewData.interview_type);
      }
    } catch (error) {
      console.error('Error fetching interview:', error);
      toast.error('Failed to load interview');
    } finally {
      setLoading(false);
    }
  };

  const generateQuestions = async (interviewType: string) => {
    setGenerating(true);
    try {
      // Fetch user skills
      const { data: skills } = await supabase
        .from('extracted_skills')
        .select('*')
        .eq('user_id', user?.id);

      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: { 
          interviewType, 
          skills: skills || [],
          interviewId: id,
          difficulty: selectedDifficulty,
          language: selectedLanguage,
        },
      });

      if (error) throw error;

      setQuestions(data.questions);
      
      // Save questions to database
      const questionsToInsert = data.questions.map((q: Question) => ({
        interview_id: id,
        question_type: q.question_type,
        skill_name: q.skill_name,
        difficulty: q.difficulty,
        question_text: q.question_text,
        expected_answer: q.expected_answer,
      }));

      const { data: savedQuestions } = await supabase
        .from('interview_questions')
        .insert(questionsToInsert)
        .select();

      if (savedQuestions) {
        // Merge options from generated questions with saved questions
        const mergedQuestions = savedQuestions.map((sq: any, idx: number) => ({
          ...sq,
          options: data.questions[idx]?.options,
        }));
        setQuestions(mergedQuestions);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      toast.error('Failed to generate questions. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const runCode = async () => {
    setRunning(true);
    setOutput('Running...');
    
    try {
      const lang = languageMap[selectedLanguage];
      const { data, error } = await supabase.functions.invoke('execute-code', {
        body: { 
          code,
          language: lang?.piston || 'javascript',
        },
      });

      if (error) throw error;
      setOutput(data.output || 'No output');
    } catch (error) {
      console.error('Error running code:', error);
      setOutput('Error executing code. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  const saveAnswer = async () => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion?.id) return;

    const updateData: any = {};
    
    if (currentQuestion.question_type === 'coding') {
      updateData.user_code = code;
    } else {
      updateData.user_answer = selectedAnswer;
    }

    await supabase
      .from('interview_questions')
      .update(updateData)
      .eq('id', currentQuestion.id);
  };

  const nextQuestion = async () => {
    await saveAnswer();
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setSelectedAnswer(null);
      
      // Load existing answer if any, or reset to template
      const nextQ = questions[nextIdx];
      if (nextQ.user_code) {
        setCode(nextQ.user_code);
      } else if (nextQ.question_type === 'coding') {
        setCode(languageMap[selectedLanguage]?.template || '');
      }
      if (nextQ.user_answer) setSelectedAnswer(nextQ.user_answer);
      setOutput('');
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setSelectedAnswer(null);
      
      const prevQ = questions[prevIdx];
      if (prevQ.user_code) {
        setCode(prevQ.user_code);
      } else if (prevQ.question_type === 'coding') {
        setCode(languageMap[selectedLanguage]?.template || '');
      }
      if (prevQ.user_answer) setSelectedAnswer(prevQ.user_answer);
      setOutput('');
    }
  };

  const finishInterview = async () => {
    setSubmitting(true);
    try {
      await saveAnswer();
      
      // Get AI evaluation
      const { data, error } = await supabase.functions.invoke('evaluate-interview', {
        body: { interviewId: id },
      });

      if (error) throw error;

      // Update interview status
      await supabase
        .from('interviews')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_score: data.totalScore,
          max_score: data.maxScore,
          feedback: data.feedback,
        })
        .eq('id', id);

      toast.success('Interview completed!');
      navigate(`/interview/results/${id}`);
    } catch (error) {
      console.error('Error finishing interview:', error);
      toast.error('Failed to submit interview. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="text-lg font-medium">Generating personalized questions...</p>
        <p className="text-sm text-muted-foreground">This may take a moment</p>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 pt-16">
        {/* Header Bar */}
        <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-16 z-40">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  interview?.interview_type === 'coding' 
                    ? 'bg-primary/10' 
                    : interview?.interview_type === 'aptitude' 
                    ? 'bg-accent/10' 
                    : interview?.interview_type === 'hr'
                    ? 'bg-orange-500/10'
                    : 'bg-success/10'
                }`}>
                  {interview?.interview_type === 'coding' ? (
                    <Code className="h-5 w-5 text-primary" />
                  ) : interview?.interview_type === 'hr' ? (
                    <Video className="h-5 w-5 text-orange-500" />
                  ) : (
                    <Brain className="h-5 w-5 text-accent" />
                  )}
                </div>
                <div>
                  <p className="font-medium capitalize">{interview?.interview_type} Interview</p>
                  <p className="text-sm text-muted-foreground">
                    Question {currentIndex + 1} of {questions.length}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="timer-display">{formatTime(timeElapsed)}</span>
                </div>
                
                <Button
                  variant="hero"
                  onClick={finishInterview}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Finish Interview
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-secondary">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-8">
          {currentQuestion && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Question Panel */}
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-6 max-h-[calc(100vh-12rem)] overflow-y-auto"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    currentQuestion.difficulty === 'easy' 
                      ? 'bg-success/20 text-success' 
                      : currentQuestion.difficulty === 'medium' 
                      ? 'bg-warning/20 text-warning' 
                      : 'bg-destructive/20 text-destructive'
                  }`}>
                    {currentQuestion.difficulty.toUpperCase()}
                  </span>
                  {currentQuestion.skill_name && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-primary/20 text-primary">
                      {currentQuestion.skill_name}
                    </span>
                  )}
                  {currentQuestion.question_type === 'coding' && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-accent/20 text-accent">
                      {languageMap[selectedLanguage]?.display || 'JavaScript'}
                    </span>
                  )}
                </div>

                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown>{currentQuestion.question_text}</ReactMarkdown>
                </div>

                {/* Multiple Choice Options - Now properly displayed */}
                {currentQuestion.question_type !== 'coding' && currentQuestion.options && currentQuestion.options.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Select your answer:</p>
                    {currentQuestion.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedAnswer(option)}
                        className={`w-full p-4 rounded-lg text-left transition-all ${
                          selectedAnswer === option
                            ? 'bg-primary/20 border-2 border-primary'
                            : 'bg-secondary/50 border-2 border-transparent hover:bg-secondary hover:border-primary/30'
                        }`}
                      >
                        <span className="font-medium mr-3 text-primary">{String.fromCharCode(65 + idx)}.</span>
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {/* Text input for HR questions without options */}
                {currentQuestion.question_type === 'hr' && (!currentQuestion.options || currentQuestion.options.length === 0) && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Your response:</p>
                    <textarea
                      value={selectedAnswer || ''}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      placeholder="Type your answer here. Think about specific examples from your experience..."
                      className="w-full min-h-[200px] p-4 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                )}
              </motion.div>

              {/* Code Editor / Answer Panel */}
              <motion.div
                key={`editor-${currentIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card overflow-hidden"
              >
                {currentQuestion.question_type === 'coding' ? (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-border">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">Code Editor</span>
                        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(languageMap).map(([key, value]) => (
                              <SelectItem key={key} value={key}>
                                {value.display}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCode(languageMap[selectedLanguage]?.template || '')}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Reset
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={runCode}
                          disabled={running}
                        >
                          {running ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              Run
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-h-[400px]">
                      <Editor
                        height="100%"
                        language={languageMap[selectedLanguage]?.monaco || 'javascript'}
                        theme="vs-dark"
                        value={code}
                        onChange={(value) => setCode(value || '')}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          padding: { top: 16 },
                          scrollBeyondLastLine: false,
                        }}
                      />
                    </div>

                    <div className="border-t border-border">
                      <div className="p-4">
                        <p className="text-sm font-medium mb-2">Output</p>
                        <pre className="p-4 rounded-lg bg-background/50 font-mono text-sm min-h-[100px] max-h-[200px] overflow-auto">
                          {output || 'Run your code to see output here'}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 flex items-center justify-center min-h-[500px]">
                    <div className="text-center">
                      {selectedAnswer ? (
                        <div className="space-y-4">
                          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                            <Check className="h-8 w-8 text-primary" />
                          </div>
                          <p className="text-lg font-medium">Answer Selected</p>
                          <p className="text-muted-foreground max-w-md mx-auto line-clamp-3">{selectedAnswer}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Brain className="h-16 w-16 mx-auto text-muted-foreground" />
                          <p className="text-muted-foreground">
                            {currentQuestion.options && currentQuestion.options.length > 0 
                              ? 'Select an answer from the options on the left'
                              : 'Enter your response in the text area on the left'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="outline"
              onClick={prevQuestion}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              {questions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    saveAnswer();
                    setCurrentIndex(idx);
                  }}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                    idx === currentIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <Button
              onClick={nextQuestion}
              disabled={currentIndex === questions.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
