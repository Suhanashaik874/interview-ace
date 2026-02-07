import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Loader2,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Send,
  MessageSquare,
  Camera,
  Timer,
  MicIcon,
  StopCircle
} from 'lucide-react';
import { useQuestionTimer } from '@/hooks/useQuestionTimer';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Textarea } from '@/components/ui/textarea';

interface Question {
  id?: string;
  question_type: string;
  difficulty: string;
  question_text: string;
  expected_answer?: string;
  user_answer?: string;
}

export default function HRInterview() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [interview, setInterview] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isPracticeMode, setIsPracticeMode] = useState(true);

  // Per-question timer
  const timer = useQuestionTimer(0);

  // Use a ref to always have the latest answers without stale closures
  const questionsRef = useRef<Question[]>([]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  const answerRef = useRef('');
  useEffect(() => { answerRef.current = answer; }, [answer]);

  const currentIndexRef = useRef(0);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // Update answer in questions array for persistence
  const updateQuestionAnswer = useCallback((index: number, newAnswer: string) => {
    setQuestions(prev => {
      const updated = prev.map((q, i) => 
        i === index ? { ...q, user_answer: newAnswer } : q
      );
      questionsRef.current = updated;
      return updated;
    });
  }, []);

  // Speech-to-text for voice answers — receives only NEW finalized text
  const handleVoiceTranscript = useCallback((text: string) => {
    setAnswer(prev => {
      const updated = prev ? prev + ' ' + text : text;
      // Also sync to questions array immediately
      updateQuestionAnswer(currentIndexRef.current, updated);
      return updated;
    });
  }, [updateQuestionAnswer]);

  const speech = useSpeechToText(handleVoiceTranscript);

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

  // Old timer removed - using useQuestionTimer hook instead

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Sync video stream to video element
  useEffect(() => {
    if (videoRef.current && stream && isVideoOn) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [stream, isVideoOn]);

  // formatTime is now handled by the useQuestionTimer hook

  const toggleVideo = async () => {
    if (isVideoOn) {
      if (stream) {
        stream.getVideoTracks().forEach(track => track.stop());
      }
      setIsVideoOn(false);
    } else {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: isMicOn });
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        setStream(mediaStream);
        setIsVideoOn(true);
        toast.success('Camera enabled');
      } catch (error) {
        console.error('Error accessing camera:', error);
        toast.error('Could not access camera. Please check permissions.');
      }
    }
  };

  const toggleMic = async () => {
    if (isMicOn) {
      if (stream) {
        stream.getAudioTracks().forEach(track => track.stop());
      }
      setIsMicOn(false);
    } else {
      try {
        if (isVideoOn && stream) {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getAudioTracks().forEach(track => {
            stream.addTrack(track);
          });
        } else {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setStream(mediaStream);
        }
        setIsMicOn(true);
        toast.success('Microphone enabled');
      } catch (error) {
        console.error('Error accessing microphone:', error);
        toast.error('Could not access microphone. Please check permissions.');
      }
    }
  };

  // Fetch resume text and skills for the current user
  const fetchResumeContext = async (): Promise<{ resumeText: string; skills: any[] }> => {
    try {
      const { data: resumes } = await supabase
        .from('resumes')
        .select('raw_text')
        .eq('user_id', user?.id)
        .order('uploaded_at', { ascending: false })
        .limit(1);

      const { data: skillsData } = await supabase
        .from('extracted_skills')
        .select('skill_name, proficiency_level')
        .eq('user_id', user?.id);

      return {
        resumeText: resumes?.[0]?.raw_text || '',
        skills: skillsData || [],
      };
    } catch (error) {
      console.error('Error fetching resume context:', error);
      return { resumeText: '', skills: [] };
    }
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

      const { data: existingQuestions } = await supabase
        .from('interview_questions')
        .select('*')
        .eq('interview_id', id);

      if (existingQuestions && existingQuestions.length > 0) {
        setQuestions(existingQuestions);
        questionsRef.current = existingQuestions;
        if (existingQuestions[0].user_answer) {
          setAnswer(existingQuestions[0].user_answer);
        }
      } else {
        await generateQuestions();
      }
    } catch (error) {
      console.error('Error fetching interview:', error);
      toast.error('Failed to load interview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateQuestions = async () => {
    setGenerating(true);
    try {
      // Fetch resume context for personalized HR questions
      const { resumeText, skills: userSkills } = await fetchResumeContext();

      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: { 
          interviewType: 'hr', 
          skills: userSkills,
          interviewId: id,
          difficulty: searchParams.get('difficulty') || 'medium',
          resumeText: resumeText,
        },
      });

      if (error) {
        console.error('Generate questions error:', error);
        throw error;
      }
       
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No questions generated');
      }

      const questionsToInsert = data.questions.map((q: Question) => ({
        interview_id: id,
        question_type: q.question_type,
        difficulty: q.difficulty,
        question_text: q.question_text,
        expected_answer: q.expected_answer,
      }));

      const { data: savedQuestions, error: insertError } = await supabase
        .from('interview_questions')
        .insert(questionsToInsert)
        .select();

      if (insertError) {
        console.error('Failed to save questions:', JSON.stringify(insertError));
        // Retry once after a short delay (could be auth token refresh needed)
        await new Promise(resolve => setTimeout(resolve, 1500));
        const { data: retryQuestions, error: retryError } = await supabase
          .from('interview_questions')
          .insert(questionsToInsert)
          .select();

        if (retryError) {
          console.error('Retry also failed:', JSON.stringify(retryError));
          // Use temp IDs — finishInterview will handle saving via service role
          const tempQuestions = data.questions.map((q: Question, idx: number) => ({ ...q, id: `temp-${idx}` }));
          setQuestions(tempQuestions);
          questionsRef.current = tempQuestions;
          toast.info('Questions loaded. Your answers will be saved when you finish the interview.');
        } else if (retryQuestions && retryQuestions.length > 0) {
          setQuestions(retryQuestions);
          questionsRef.current = retryQuestions;
          toast.success('Questions generated successfully!');
        }
      } else if (savedQuestions && savedQuestions.length > 0) {
        setQuestions(savedQuestions);
        questionsRef.current = savedQuestions;
        toast.success('Questions generated successfully!');
      } else {
        // No error but no data — use temp IDs
        const tempQuestions = data.questions.map((q: Question, idx: number) => ({ ...q, id: `temp-${idx}` }));
        setQuestions(tempQuestions);
        questionsRef.current = tempQuestions;
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      toast.error('Failed to generate questions. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const saveAnswerToDB = async (questionId: string | undefined, answerText: string) => {
    if (!questionId || questionId.startsWith('temp-')) return;
    try {
      await supabase
        .from('interview_questions')
        .update({ user_answer: answerText })
        .eq('id', questionId);
    } catch (err) {
      console.error('Failed to save answer to DB:', err);
    }
  };

  const saveAnswer = async () => {
    updateQuestionAnswer(currentIndex, answer);
    await saveAnswerToDB(questions[currentIndex]?.id, answer);
  };

  const nextQuestion = async () => {
    // Save current answer to state and DB
    updateQuestionAnswer(currentIndex, answer);
    await saveAnswerToDB(questions[currentIndex]?.id, answer);
    
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      timer.switchToQuestion(nextIdx);
      speech.stopListening();
      speech.resetTranscript();
      const nextAnswer = questionsRef.current[nextIdx]?.user_answer || '';
      setAnswer(nextAnswer);
    }
  };

  const prevQuestion = () => {
    // Save current answer to state
    updateQuestionAnswer(currentIndex, answer);
    saveAnswerToDB(questions[currentIndex]?.id, answer);
    
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      timer.switchToQuestion(prevIdx);
      speech.stopListening();
      speech.resetTranscript();
      const prevAnswer = questionsRef.current[prevIdx]?.user_answer || '';
      setAnswer(prevAnswer);
    }
  };

  const goToQuestion = async (idx: number) => {
    // Save current answer first
    updateQuestionAnswer(currentIndex, answer);
    await saveAnswerToDB(questions[currentIndex]?.id, answer);
    setCurrentIndex(idx);
    timer.switchToQuestion(idx);
    speech.stopListening();
    speech.resetTranscript();
    const targetAnswer = questionsRef.current[idx]?.user_answer || '';
    setAnswer(targetAnswer);
  };

  const finishInterview = async () => {
    speech.stopListening();
    setSubmitting(true);
    try {
      // Save current answer to state
      updateQuestionAnswer(currentIndex, answer);
      
      // Build final questions with all answers
      const finalQuestions = questionsRef.current.map((q, i) => ({
        ...q,
        user_answer: i === currentIndex ? answer : (q.user_answer || ''),
      }));

      // Try to save to DB first
      const savedIds = finalQuestions.filter(q => q.id && !q.id.startsWith('temp-'));
      
      if (savedIds.length > 0) {
        // Questions are in DB — bulk save all answers
        await Promise.all(
          savedIds.map(q => saveAnswerToDB(q.id!, q.user_answer || ''))
        );
      } else if (finalQuestions.length > 0) {
        // Questions were never saved to DB — try to insert them now
        const questionsToInsert = finalQuestions.map(q => ({
          interview_id: id,
          question_type: q.question_type,
          difficulty: q.difficulty,
          question_text: q.question_text,
          expected_answer: q.expected_answer || '',
          user_answer: q.user_answer || '',
        }));
        
        const { data: saved, error: insertErr } = await supabase
          .from('interview_questions')
          .insert(questionsToInsert)
          .select();
          
        if (insertErr) {
          console.error('Insert failed, will pass data to evaluator:', insertErr);
        } else if (saved) {
          questionsRef.current = saved;
        }
      }

      // Call evaluate-interview, passing questions as fallback for unsaved data
      const { data, error } = await supabase.functions.invoke('evaluate-interview', {
        body: { 
          interviewId: id,
          // Pass questions as fallback in case DB insert failed
          questionsData: finalQuestions.map(q => ({
            question_type: q.question_type,
            difficulty: q.difficulty,
            question_text: q.question_text,
            expected_answer: q.expected_answer || '',
            user_answer: q.user_answer || '',
            user_code: '',
          })),
        },
      });

      if (error) {
        console.error('Evaluate function error:', error);
        throw error;
      }

      // Handle the no_questions graceful response
      if (data.error === 'no_questions') {
        toast.error('No questions could be evaluated. Please try starting a new interview.');
        setSubmitting(false);
        return;
      }

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

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

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
        <p className="text-lg font-medium">Preparing your HR interview...</p>
        <p className="text-sm text-muted-foreground">Generating personalized questions from your resume</p>
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
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-warning/10">
                  <Video className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium">HR / Behavioral Interview</p>
                  <p className="text-sm text-muted-foreground">
                    Question {currentIndex + 1} of {questions.length}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground" title="Total time">
                    <Clock className="h-4 w-4" />
                    <span className="timer-display">{timer.formattedTotalTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-warning/10 text-warning text-sm font-medium" title="Time on this question">
                    <Timer className="h-3.5 w-3.5" />
                    <span>{timer.formattedQuestionTime}</span>
                  </div>
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
            className="h-full bg-warning transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-8">
          {currentQuestion && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Question Panel with Video */}
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Video Preview */}
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Practice Mode - See yourself as the interviewer sees you
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={isVideoOn ? "default" : "outline"}
                        size="sm"
                        onClick={toggleVideo}
                      >
                        {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant={isMicOn ? "default" : "outline"}
                        size="sm"
                        onClick={toggleMic}
                      >
                        {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="aspect-video bg-background/50 rounded-lg overflow-hidden relative">
                    {isVideoOn ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover transform scale-x-[-1]"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <VideoOff className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Camera is off</p>
                          <Button variant="outline" size="sm" className="mt-2" onClick={toggleVideo}>
                            Enable Camera
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    💡 Tip: Practice maintaining eye contact with the camera and speaking clearly
                  </p>
                </div>

                {/* Question */}
                <div className="glass-card p-6">
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
                    <span className="px-2 py-1 rounded text-xs font-medium bg-warning/20 text-warning">
                      Behavioral Question
                    </span>
                  </div>

                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown>{currentQuestion.question_text}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>

              {/* Answer Panel */}
              <motion.div
                key={`answer-${currentIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <span className="font-medium">Your Response</span>
                  </div>
                  {speech.isSupported && (
                    <Button
                      variant={speech.isListening ? "destructive" : "outline"}
                      size="sm"
                      onClick={speech.toggleListening}
                      className="gap-2"
                    >
                      {speech.isListening ? (
                        <>
                          <StopCircle className="h-4 w-4 animate-pulse" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <MicIcon className="h-4 w-4" />
                          Voice Input
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {speech.isListening && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
                    </span>
                    Listening... Speak your answer clearly
                  </div>
                )}

                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer or click 'Voice Input' to speak. Use the STAR method (Situation, Task, Action, Result) for behavioral questions..."
                  className="min-h-[250px] resize-none"
                />

                <div className="mt-4 p-4 rounded-lg bg-secondary/30">
                  <p className="text-sm font-medium mb-2">💡 Tips for a great answer:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Use the STAR method: Situation, Task, Action, Result</li>
                    <li>• Be specific with examples from your experience</li>
                    <li>• Keep your answer focused and concise (1-2 minutes)</li>
                    <li>• Highlight your skills and learnings</li>
                    <li>• Stay positive, even when discussing challenges</li>
                  </ul>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button onClick={() => {
                    updateQuestionAnswer(currentIndex, answer);
                    saveAnswer();
                    toast.success('Answer saved');
                  }} variant="outline">
                    <Send className="h-4 w-4 mr-2" />
                    Save Answer
                  </Button>
                </div>
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
                  onClick={() => goToQuestion(idx)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                    idx === currentIndex
                      ? 'bg-warning text-warning-foreground'
                      : questionsRef.current[idx]?.user_answer
                      ? 'bg-success/30 text-success'
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
