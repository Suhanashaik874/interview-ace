import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';

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

export default function Interview() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [interview, setInterview] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState('// Write your code here\n');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);

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
        setQuestions(savedQuestions);
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
      const { data, error } = await supabase.functions.invoke('execute-code', {
        body: { 
          code,
          language: 'javascript',
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
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setCode('// Write your code here\n');
      setOutput('');
      
      // Load existing answer if any
      const nextQ = questions[currentIndex + 1];
      if (nextQ.user_code) setCode(nextQ.user_code);
      if (nextQ.user_answer) setSelectedAnswer(nextQ.user_answer);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedAnswer(null);
      setCode('// Write your code here\n');
      setOutput('');
      
      const prevQ = questions[currentIndex - 1];
      if (prevQ.user_code) setCode(prevQ.user_code);
      if (prevQ.user_answer) setSelectedAnswer(prevQ.user_answer);
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
                    : 'bg-success/10'
                }`}>
                  {interview?.interview_type === 'coding' ? (
                    <Code className="h-5 w-5 text-primary" />
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
                className="glass-card p-6"
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
                </div>

                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown>{currentQuestion.question_text}</ReactMarkdown>
                </div>

                {/* Multiple Choice Options */}
                {currentQuestion.question_type !== 'coding' && currentQuestion.options && (
                  <div className="mt-6 space-y-3">
                    {currentQuestion.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedAnswer(option)}
                        className={`w-full p-4 rounded-lg text-left transition-all ${
                          selectedAnswer === option
                            ? 'bg-primary/20 border-2 border-primary'
                            : 'bg-secondary/50 border-2 border-transparent hover:bg-secondary'
                        }`}
                      >
                        <span className="font-medium mr-3">{String.fromCharCode(65 + idx)}.</span>
                        {option}
                      </button>
                    ))}
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
                      <span className="text-sm font-medium">Code Editor</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCode('// Write your code here\n')}
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
                        defaultLanguage="javascript"
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
                          <p className="text-muted-foreground">{selectedAnswer}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Brain className="h-16 w-16 mx-auto text-muted-foreground" />
                          <p className="text-muted-foreground">Select an answer from the options</p>
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
