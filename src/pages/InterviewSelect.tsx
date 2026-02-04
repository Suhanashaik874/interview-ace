import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Code, Brain, Award, ArrowRight, AlertCircle, Video, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const interviewTypes = [
  {
    id: 'coding',
    icon: Code,
    title: 'Coding Interview',
    description: 'Practice technical coding challenges with AI-generated problems based on your skills',
    features: ['Live code editor', 'Multiple languages', 'Real-time execution', 'Solution analysis'],
    gradient: 'from-primary/20 to-cyan-500/20',
    borderColor: 'hover:border-primary/50',
  },
  {
    id: 'aptitude',
    icon: Brain,
    title: 'Aptitude Test',
    description: 'Test your logical reasoning, verbal ability, and analytical thinking',
    features: ['Logical reasoning', 'Verbal ability', 'Quantitative aptitude', 'Data interpretation'],
    gradient: 'from-accent/20 to-purple-500/20',
    borderColor: 'hover:border-accent/50',
  },
  {
    id: 'combined',
    icon: Award,
    title: 'Combined Interview',
    description: 'Full mock interview experience with both coding and aptitude sections',
    features: ['Complete assessment', 'Mixed question types', 'Comprehensive feedback', 'Interview simulation'],
    gradient: 'from-success/20 to-green-500/20',
    borderColor: 'hover:border-success/50',
  },
  {
    id: 'hr',
    icon: Video,
    title: 'HR Interview',
    description: 'Practice behavioral and HR interview questions with AI feedback',
    features: ['Video practice', 'Behavioral questions', 'Communication tips', 'Body language feedback'],
    gradient: 'from-orange-500/20 to-amber-500/20',
    borderColor: 'hover:border-orange-500/50',
  },
];

const difficultyLevels = [
  { id: 'easy', label: 'Easy', description: 'Basic concepts and fundamentals', color: 'text-success' },
  { id: 'medium', label: 'Medium', description: 'Intermediate problems requiring deeper understanding', color: 'text-warning' },
  { id: 'hard', label: 'Hard', description: 'Advanced problems with optimization focus', color: 'text-destructive' },
  { id: 'adaptive', label: 'Adaptive (Based on Skills)', description: 'Difficulty adapts to your skill levels', color: 'text-primary' },
];

const programmingLanguages = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'python', name: 'Python' },
  { id: 'java', name: 'Java' },
  { id: 'cpp', name: 'C++' },
  { id: 'c', name: 'C' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'go', name: 'Go' },
  { id: 'rust', name: 'Rust' },
  { id: 'ruby', name: 'Ruby' },
  { id: 'php', name: 'PHP' },
];

export default function InterviewSelect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedType, setSelectedType] = useState<string | null>(searchParams.get('type'));
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('adaptive');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('javascript');
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSkills();
    }
  }, [user]);

  const fetchSkills = async () => {
    try {
      const { data } = await supabase
        .from('extracted_skills')
        .select('*')
        .eq('user_id', user?.id);
      
      setSkills(data || []);
    } catch (error) {
      console.error('Error fetching skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const startInterview = async () => {
    if (!selectedType) return;
    
    setStarting(true);
    try {
      // Create a new interview session with difficulty and language preferences
      const { data: interview, error } = await supabase
        .from('interviews')
        .insert({
          user_id: user?.id,
          interview_type: selectedType,
          status: 'in_progress',
        })
        .select()
        .single();

      if (error) throw error;

      // Navigate with query params for difficulty and language
      const params = new URLSearchParams();
      params.set('difficulty', selectedDifficulty);
      if (selectedType === 'coding' || selectedType === 'combined') {
        params.set('language', selectedLanguage);
      }
      
      // Navigate to HR interview page for HR type, otherwise regular interview
      if (selectedType === 'hr') {
        navigate(`/interview/hr/${interview.id}?${params.toString()}`);
      } else {
        navigate(`/interview/${interview.id}?${params.toString()}`);
      }
    } catch (error) {
      console.error('Error starting interview:', error);
    } finally {
      setStarting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const showLanguageSelect = selectedType === 'coding' || selectedType === 'combined';
  const showDifficultySelect = selectedType && selectedType !== 'hr';

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
            <h1 className="text-3xl font-bold mb-2">Choose Your Interview Type</h1>
            <p className="text-muted-foreground">
              Select the type of mock interview you want to practice
            </p>
          </div>

          {skills.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-6 mb-8 border-warning/50"
            >
              <div className="flex items-center gap-4">
                <AlertCircle className="h-6 w-6 text-warning flex-shrink-0" />
                <div>
                  <p className="font-medium">No skills found</p>
                  <p className="text-sm text-muted-foreground">
                    Upload your resume first to get personalized questions based on your skills.
                  </p>
                </div>
                <Button variant="outline" className="ml-auto" onClick={() => navigate('/resume')}>
                  Upload Resume
                </Button>
              </div>
            </motion.div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {interviewTypes.map((type, index) => (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`glass-card p-6 cursor-pointer transition-all duration-300 ${type.borderColor} ${
                  selectedType === type.id ? 'border-2 ring-2 ring-primary/20' : ''
                }`}
                onClick={() => setSelectedType(type.id)}
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${type.gradient} flex items-center justify-center mb-4`}>
                  <type.icon className={`h-7 w-7 ${
                    type.id === 'coding' ? 'text-primary' : 
                    type.id === 'aptitude' ? 'text-accent' : 
                    type.id === 'hr' ? 'text-orange-500' : 'text-success'
                  }`} />
                </div>
                
                <h3 className="text-xl font-semibold mb-2">{type.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{type.description}</p>
                
                <ul className="space-y-2">
                  {type.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {selectedType === type.id && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 pt-4 border-t border-border"
                  >
                    <div className="flex items-center gap-2 text-primary">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Difficulty Selection */}
          {showDifficultySelect && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 mb-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <Gauge className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Select Difficulty Level</h3>
              </div>
              
              <RadioGroup
                value={selectedDifficulty}
                onValueChange={setSelectedDifficulty}
                className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
              >
                {difficultyLevels.map((level) => (
                  <div key={level.id} className="flex items-start space-x-3">
                    <RadioGroupItem value={level.id} id={level.id} className="mt-1" />
                    <Label htmlFor={level.id} className="cursor-pointer">
                      <span className={`font-medium ${level.color}`}>{level.label}</span>
                      <p className="text-xs text-muted-foreground mt-1">{level.description}</p>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </motion.div>
          )}

          {/* Language Selection for Coding */}
          {showLanguageSelect && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 mb-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <Code className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Select Programming Language</h3>
              </div>
              
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {programmingLanguages.map((lang) => (
                    <SelectItem key={lang.id} value={lang.id}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Questions and code editor will be configured for {programmingLanguages.find(l => l.id === selectedLanguage)?.name}
              </p>
            </motion.div>
          )}

          {skills.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-6 mb-8"
            >
              <h3 className="font-semibold mb-4">Your Skills ({skills.length})</h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill.id}
                    className={`skill-badge ${skill.proficiency_level}`}
                  >
                    {skill.skill_name}
                    <span className="text-xs opacity-70 capitalize">({skill.proficiency_level})</span>
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          <div className="flex justify-center">
            <Button
              variant="hero"
              size="xl"
              disabled={!selectedType || starting}
              onClick={startInterview}
              className="min-w-[200px]"
            >
              {starting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary-foreground" />
              ) : (
                <>
                  Start Interview
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
