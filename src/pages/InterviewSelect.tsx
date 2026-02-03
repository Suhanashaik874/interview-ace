import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Code, Brain, Award, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

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
];

export default function InterviewSelect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedType, setSelectedType] = useState<string | null>(searchParams.get('type'));
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
      // Create a new interview session
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

      navigate(`/interview/${interview.id}`);
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

          <div className="grid md:grid-cols-3 gap-6 mb-8">
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
                    type.id === 'aptitude' ? 'text-accent' : 'text-success'
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
