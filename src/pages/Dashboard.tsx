import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Code, 
  Brain, 
  TrendingUp, 
  Clock, 
  Target,
  ChevronRight,
  Zap,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number;
  skillsExtracted: number;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalInterviews: 0,
    completedInterviews: 0,
    averageScore: 0,
    skillsExtracted: 0,
  });
  const [recentInterviews, setRecentInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch interviews
      const { data: interviews } = await supabase
        .from('interviews')
        .select('*')
        .eq('user_id', user?.id)
        .order('started_at', { ascending: false })
        .limit(5);

      // Fetch skills count
      const { count: skillsCount } = await supabase
        .from('extracted_skills')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      const completedInterviews = interviews?.filter(i => i.status === 'completed') || [];
      const totalScore = completedInterviews.reduce((sum, i) => sum + (i.total_score || 0), 0);
      const maxScore = completedInterviews.reduce((sum, i) => sum + (i.max_score || 0), 0);

      setStats({
        totalInterviews: interviews?.length || 0,
        completedInterviews: completedInterviews.length,
        averageScore: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
        skillsExtracted: skillsCount || 0,
      });

      setRecentInterviews(interviews || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReadinessStatus = () => {
    if (stats.completedInterviews === 0) return { label: 'Not Started', color: 'text-muted-foreground' };
    if (stats.averageScore >= 80) return { label: 'Interview Ready', color: 'text-success' };
    if (stats.averageScore >= 60) return { label: 'Partially Ready', color: 'text-warning' };
    return { label: 'Needs Practice', color: 'text-destructive' };
  };

  const readiness = getReadinessStatus();

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
              <p className="text-muted-foreground">Track your interview preparation progress</p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-3">
              <Button variant="outline" onClick={() => navigate('/resume')}>
                <FileText className="h-4 w-4 mr-2" />
                Upload Resume
              </Button>
              <Button variant="hero" onClick={() => navigate('/interview/select')}>
                <Zap className="h-4 w-4 mr-2" />
                Start Interview
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <span className="text-2xl font-bold">{stats.skillsExtracted}</span>
              </div>
              <p className="text-sm text-muted-foreground">Skills Extracted</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Code className="h-5 w-5 text-accent" />
                </div>
                <span className="text-2xl font-bold">{stats.totalInterviews}</span>
              </div>
              <p className="text-sm text-muted-foreground">Practice Sessions</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <span className="text-2xl font-bold">{stats.averageScore}%</span>
              </div>
              <p className="text-sm text-muted-foreground">Average Score</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-warning" />
                </div>
                <span className={`text-lg font-bold ${readiness.color}`}>{readiness.label}</span>
              </div>
              <p className="text-sm text-muted-foreground">Interview Readiness</p>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-card p-6 hover:border-primary/30 transition-all cursor-pointer group"
              onClick={() => navigate('/interview/select?type=coding')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/20 flex items-center justify-center">
                    <Code className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Coding Interview</h3>
                    <p className="text-sm text-muted-foreground">Practice technical coding challenges</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="glass-card p-6 hover:border-accent/30 transition-all cursor-pointer group"
              onClick={() => navigate('/interview/select?type=aptitude')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center">
                    <Brain className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Aptitude Test</h3>
                    <p className="text-sm text-muted-foreground">Logical reasoning & verbal ability</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="glass-card p-6 hover:border-success/30 transition-all cursor-pointer group"
              onClick={() => navigate('/interview/select?type=combined')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success/20 to-green-500/20 flex items-center justify-center">
                    <Award className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Combined Interview</h3>
                    <p className="text-sm text-muted-foreground">Full mock interview experience</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-success transition-colors" />
              </div>
            </motion.div>
          </div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="glass-card p-6"
          >
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            {recentInterviews.length > 0 ? (
              <div className="space-y-4">
                {recentInterviews.map((interview) => (
                  <div
                    key={interview.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/interview/results/${interview.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        interview.interview_type === 'coding' 
                          ? 'bg-primary/10' 
                          : interview.interview_type === 'aptitude' 
                          ? 'bg-accent/10' 
                          : 'bg-success/10'
                      }`}>
                        {interview.interview_type === 'coding' ? (
                          <Code className="h-5 w-5 text-primary" />
                        ) : interview.interview_type === 'aptitude' ? (
                          <Brain className="h-5 w-5 text-accent" />
                        ) : (
                          <Award className="h-5 w-5 text-success" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{interview.interview_type} Interview</p>
                        <p className="text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(interview.started_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        interview.status === 'completed' ? 'text-success' : 'text-warning'
                      }`}>
                        {interview.status === 'completed' 
                          ? `${interview.max_score > 0 ? Math.round((interview.total_score / interview.max_score) * 100) : 0}%` 
                          : 'In Progress'}
                      </p>
                      <p className="text-sm text-muted-foreground capitalize">{interview.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No interviews yet. Start your first practice session!</p>
                <Button variant="hero" onClick={() => navigate('/interview/select')}>
                  Start Practice
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
