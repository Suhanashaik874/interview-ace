import { Brain } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold gradient-text">InterviewAI</span>
          </Link>

          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <Link to="/resume" className="hover:text-foreground transition-colors">Resume</Link>
            <Link to="/interview" className="hover:text-foreground transition-colors">Practice</Link>
          </div>

          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} InterviewAI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
