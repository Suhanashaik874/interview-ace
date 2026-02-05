import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Award, 
  TrendingUp, 
  Clock, 
  Target,
  ArrowRight,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Code,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface EnrichedFeedback {
  feedback: string;
  optimal_solution?: string;
  time_complexity?: string;
  space_complexity?: string;
  solution_steps?: string;
  areas_to_improve?: string[];
}

const parseFeedback = (feedbackStr: string | null): EnrichedFeedback => {
  if (!feedbackStr) return { feedback: 'No feedback available' };
  try {
    const parsed = JSON.parse(feedbackStr);
    // If it's a valid object with feedback property, use it
    if (parsed && typeof parsed === 'object' && parsed.feedback) {
      return parsed;
    }
    // If it's just a string in JSON, return it as feedback
    if (typeof parsed === 'string') {
      return { feedback: parsed };
    }
    return { feedback: feedbackStr };
  } catch {
    return { feedback: feedbackStr };
  }
};

export default function InterviewResults() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchResults();
    }
  }, [user, id]);

  const fetchResults = async () => {
    try {
      const { data: interviewData } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', id)
        .single();

      const { data: questionsData } = await supabase
        .from('interview_questions')
        .select('*')
        .eq('interview_id', id);

      setInterview(interviewData);
      setQuestions(questionsData || []);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Improvement';
    return 'Keep Practicing';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const scorePercentage = interview?.max_score > 0 
    ? Math.round((interview.total_score / interview.max_score) * 100) 
    : 0;

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6"
            >
              <Award className="h-12 w-12 text-primary" />
            </motion.div>
            <h1 className="text-3xl font-bold mb-2">Interview Complete!</h1>
            <p className="text-muted-foreground capitalize">
              {interview?.interview_type} Interview Results
            </p>
          </div>

          {/* Score Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-8 mb-8 max-w-2xl mx-auto text-center"
          >
            <div className="mb-6">
              <div className={`text-6xl font-bold ${getScoreColor(scorePercentage)}`}>
                {scorePercentage}%
              </div>
              <p className={`text-xl font-medium mt-2 ${getScoreColor(scorePercentage)}`}>
                {getScoreLabel(scorePercentage)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-border">
              <div>
                <div className="text-2xl font-bold">{interview?.total_score || 0}</div>
                <p className="text-sm text-muted-foreground">Points Earned</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{interview?.max_score || 0}</div>
                <p className="text-sm text-muted-foreground">Max Points</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{questions.length}</div>
                <p className="text-sm text-muted-foreground">Questions</p>
              </div>
            </div>
          </motion.div>

          {/* Feedback */}
          {interview?.feedback && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card p-6 mb-8 max-w-3xl mx-auto"
            >
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Overall Feedback
              </h2>
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{typeof interview.feedback === 'string' ? interview.feedback : JSON.stringify(interview.feedback)}</ReactMarkdown>
              </div>
            </motion.div>
          )}
          
          {/* Show message if no feedback available */}
          {!interview?.feedback && interview?.status === 'completed' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card p-6 mb-8 max-w-3xl mx-auto text-center"
            >
              <p className="text-muted-foreground">
                Feedback is being generated. Please refresh the page in a moment.
              </p>
            </motion.div>
          )}

          {/* Question Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-xl font-semibold mb-4">Question Breakdown</h2>
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className="glass-card overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedQuestion(
                      expandedQuestion === question.id ? null : question.id
                    )}
                    className="w-full p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        question.is_correct 
                          ? 'bg-success/20 text-success' 
                          : 'bg-destructive/20 text-destructive'
                      }`}>
                        {question.is_correct ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Question {index + 1}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            question.difficulty === 'easy' 
                              ? 'bg-success/20 text-success' 
                              : question.difficulty === 'medium' 
                              ? 'bg-warning/20 text-warning' 
                              : 'bg-destructive/20 text-destructive'
                          }`}>
                            {question.difficulty}
                          </span>
                          {question.skill_name && (
                            <span className="text-primary">{question.skill_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{question.score || 0} pts</span>
                      {expandedQuestion === question.id ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </button>

                  {expandedQuestion === question.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="p-4 pt-0 border-t border-border"
                    >
                      <div className="pt-4 space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Question:</p>
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown>{question.question_text}</ReactMarkdown>
                          </div>
                        </div>

                        {question.user_code && (
                          <div>
                            <p className="text-sm font-medium mb-2">Your Code:</p>
                            <pre className="p-4 rounded-lg bg-background/50 font-mono text-sm overflow-auto">
                              {question.user_code}
                            </pre>
                          </div>
                        )}

                        {question.user_answer && (
                          <div>
                            <p className="text-sm font-medium mb-2">Your Answer:</p>
                            <p className="text-muted-foreground">{question.user_answer}</p>
                          </div>
                        )}

                        {question.ai_feedback && (() => {
                          const feedback = parseFeedback(question.ai_feedback);
                          return (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4 text-primary" />
                                  AI Feedback
                                </p>
                                <div className="prose prose-invert prose-sm max-w-none p-4 rounded-lg bg-primary/5 border border-primary/20">
                                  <ReactMarkdown>{feedback.feedback}</ReactMarkdown>
                                </div>
                              </div>

                              {feedback.optimal_solution && (
                                <div>
                                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <Code className="h-4 w-4 text-success" />
                                    Optimal Solution
                                    {feedback.time_complexity && (
                                      <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded">
                                        Time: {feedback.time_complexity}
                                      </span>
                                    )}
                                    {feedback.space_complexity && (
                                      <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                                        Space: {feedback.space_complexity}
                                      </span>
                                    )}
                                  </p>
                                  <pre className="p-4 rounded-lg bg-success/5 border border-success/20 font-mono text-sm overflow-auto whitespace-pre-wrap">
                                    {feedback.optimal_solution}
                                  </pre>
                                </div>
                              )}

                              {feedback.solution_steps && (
                                <div>
                                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-warning" />
                                    Solution Steps
                                  </p>
                                  <div className="prose prose-invert prose-sm max-w-none p-4 rounded-lg bg-warning/5 border border-warning/20">
                                    <ReactMarkdown>{feedback.solution_steps}</ReactMarkdown>
                                  </div>
                                </div>
                              )}

                              {feedback.areas_to_improve && feedback.areas_to_improve.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4 text-accent" />
                                    Areas to Improve
                                  </p>
                                  <ul className="space-y-2">
                                    {feedback.areas_to_improve.map((area, i) => (
                                      <li key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-accent/5 border border-accent/20">
                                        <span className="text-accent font-bold">{i + 1}.</span>
                                        <span className="text-muted-foreground">{area}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Actions */}
          <div className="flex justify-center gap-4 mt-12">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
            <Button variant="hero" onClick={() => navigate('/interview/select')}>
              Practice Again
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
