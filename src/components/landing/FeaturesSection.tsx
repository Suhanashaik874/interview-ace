import { motion } from 'framer-motion';
import { 
  FileText, 
  Cpu, 
  Code2, 
  BarChart3, 
  MessageSquare, 
  Zap,
  Shield,
  Clock
} from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Smart Resume Parsing',
    description: 'Upload PDF or DOC files. Our AI extracts technical skills and experience automatically.',
  },
  {
    icon: Cpu,
    title: 'AI Question Generation',
    description: 'Dynamic, scenario-based questions generated fresh for each session—no static question banks.',
  },
  {
    icon: Code2,
    title: 'Interactive Code Editor',
    description: 'Write and execute code in multiple languages with real-time output and error detection.',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    description: 'Track your progress with detailed dashboards showing skill improvements over time.',
  },
  {
    icon: MessageSquare,
    title: 'AI Feedback & Suggestions',
    description: 'Get personalized explanations and optimal solution approaches for every question.',
  },
  {
    icon: Zap,
    title: 'Multiple Test Types',
    description: 'Practice coding interviews, aptitude tests, logical reasoning, and verbal ability.',
  },
  {
    icon: Shield,
    title: 'Difficulty Mapping',
    description: 'Questions automatically match your skill level—beginner, intermediate, or advanced.',
  },
  {
    icon: Clock,
    title: 'Timed Practice',
    description: 'Simulate real interview conditions with timed sessions and pressure testing.',
  },
];

export function FeaturesSection() {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Everything You Need to <span className="gradient-text">Ace</span> Your Interview
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A complete interview preparation platform powered by cutting-edge AI technology
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="glass-card p-6 group hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-accent/30 transition-all">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
