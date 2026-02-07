import { useState, useEffect, useRef, useCallback } from 'react';

interface QuestionTimerState {
  /** Seconds elapsed on the current question */
  questionTime: number;
  /** Accumulated times per question index */
  questionTimes: Record<number, number>;
  /** Total elapsed seconds across all questions */
  totalTime: number;
  /** Reset and start timing a new question index */
  switchToQuestion: (index: number) => void;
  /** Get formatted MM:SS for the current question */
  formattedQuestionTime: string;
  /** Get formatted MM:SS for total time */
  formattedTotalTime: string;
  /** Get formatted time for a specific question index */
  getFormattedTime: (index: number) => string;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function useQuestionTimer(initialIndex = 0): QuestionTimerState {
  const [questionTime, setQuestionTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const currentIndexRef = useRef(initialIndex);
  const questionTimeRef = useRef(0);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setQuestionTime(prev => {
        const next = prev + 1;
        questionTimeRef.current = next;
        return next;
      });
      setTotalTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const switchToQuestion = useCallback((newIndex: number) => {
    // Save time spent on previous question
    setQuestionTimes(prev => ({
      ...prev,
      [currentIndexRef.current]: (prev[currentIndexRef.current] || 0) + questionTimeRef.current,
    }));
    // Reset for new question
    currentIndexRef.current = newIndex;
    questionTimeRef.current = 0;
    setQuestionTime(0);
  }, []);

  const getFormattedTime = useCallback((index: number) => {
    const saved = questionTimes[index] || 0;
    const extra = index === currentIndexRef.current ? questionTimeRef.current : 0;
    return formatTime(saved + extra);
  }, [questionTimes]);

  return {
    questionTime,
    questionTimes,
    totalTime,
    switchToQuestion,
    formattedQuestionTime: formatTime(questionTime),
    formattedTotalTime: formatTime(totalTime),
    getFormattedTime,
  };
}
