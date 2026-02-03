import { motion } from 'framer-motion';
import { Upload, Sliders, Play, Award } from 'lucide-react';

const steps = [
  {
    icon: Upload,
    step: '01',
    title: 'Upload Your Resume',
    description: 'Upload your resume in PDF or DOC format. Our AI will analyze and extract your technical skills.',
  },
  {
    icon: Sliders,
    step: '02',
    title: 'Set Skill Levels',
    description: 'Review extracted skills and set your proficiency level for each—beginner, intermediate, or advanced.',
  },
  {
    icon: Play,
    step: '03',
    title: 'Start Practice',
    description: 'Choose your interview type and begin practicing with AI-generated questions tailored to you.',
  },
  {
    icon: Award,
    step: '04',
    title: 'Get Feedback',
    description: 'Receive detailed feedback, improvement suggestions, and track your readiness for real interviews.',
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-24 relative bg-gradient-to-b from-transparent via-secondary/30 to-transparent">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            How It <span className="gradient-text-accent">Works</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Four simple steps to interview success
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                {/* Connection line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-1/2 w-full h-px bg-gradient-to-r from-primary/50 to-transparent" />
                )}
                
                <div className="relative z-10 text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center mb-4 group-hover:border-primary transition-colors">
                    <step.icon className="h-7 w-7 text-primary" />
                  </div>
                  <span className="text-xs font-mono text-primary/60 tracking-wider">{step.step}</span>
                  <h3 className="font-semibold mt-2 mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
