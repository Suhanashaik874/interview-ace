import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  X, 
  Check, 
  Loader2, 
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as mammoth from 'mammoth';

interface ExtractedSkill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
}

export default function Resume() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [skills, setSkills] = useState<ExtractedSkill[]>([]);
  const [step, setStep] = useState<'upload' | 'skills'>('upload');
  const [existingResume, setExistingResume] = useState<any>(null);
  const [existingSkills, setExistingSkills] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchExistingData();
    }
  }, [user]);

  const fetchExistingData = async () => {
    try {
      const { data: resumes } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user?.id)
        .order('uploaded_at', { ascending: false })
        .limit(1);

      if (resumes && resumes.length > 0) {
        setExistingResume(resumes[0]);
        
        const { data: skillsData } = await supabase
          .from('extracted_skills')
          .select('*')
          .eq('resume_id', resumes[0].id);
        
        if (skillsData) {
          setExistingSkills(skillsData);
          setSkills(skillsData.map(s => ({
            name: s.skill_name,
            level: s.proficiency_level as 'beginner' | 'intermediate' | 'advanced',
          })));
          setStep('skills');
        }
      }
    } catch (error) {
      console.error('Error fetching existing data:', error);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (selectedFile: File) => {
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Please upload a PDF or Word document');
      return;
    }

    setFile(selectedFile);
    setProcessing(true);

    try {
      let text = '';
      
      if (selectedFile.type === 'application/pdf') {
        text = await extractTextFromPDF(selectedFile);
      } else {
        text = await extractTextFromWord(selectedFile);
      }

      setExtractedText(text);
      await extractSkillsFromText(text, selectedFile.name);
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process the file. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    
    // Dynamic import of pdfjs-dist to avoid worker issues
    const pdfjsLib = await import('pdfjs-dist');
    
    // Use fake worker to avoid CDN issues
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    
    const pdf = await pdfjsLib.getDocument({ 
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
    
    let text = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }

    return text;
  };

  const extractTextFromWord = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const extractSkillsFromText = async (text: string, fileName: string) => {
    try {
      // Call the AI edge function to extract skills
      const { data, error } = await supabase.functions.invoke('extract-skills', {
        body: { resumeText: text },
      });

      if (error) throw error;

      const extractedSkills: ExtractedSkill[] = data.skills || [];
      setSkills(extractedSkills);

      // Save resume to database
      const { data: resumeData, error: resumeError } = await supabase
        .from('resumes')
        .insert({
          user_id: user?.id,
          file_name: fileName,
          raw_text: text,
        })
        .select()
        .single();

      if (resumeError) throw resumeError;

      // Save skills to database
      if (extractedSkills.length > 0) {
        const skillsToInsert = extractedSkills.map(skill => ({
          resume_id: resumeData.id,
          user_id: user?.id,
          skill_name: skill.name,
          proficiency_level: skill.level,
        }));

        const { error: skillsError } = await supabase
          .from('extracted_skills')
          .insert(skillsToInsert);

        if (skillsError) throw skillsError;
      }

      setExistingResume(resumeData);
      setStep('skills');
      toast.success('Resume processed successfully!');
    } catch (error) {
      console.error('Error extracting skills:', error);
      toast.error('Failed to extract skills. Please try again.');
    }
  };

  const updateSkillLevel = async (skillName: string, level: 'beginner' | 'intermediate' | 'advanced') => {
    setSkills(prev => prev.map(s => 
      s.name === skillName ? { ...s, level } : s
    ));

    if (existingResume) {
      await supabase
        .from('extracted_skills')
        .update({ proficiency_level: level })
        .eq('resume_id', existingResume.id)
        .eq('skill_name', skillName);
    }
  };

  const removeSkill = async (skillName: string) => {
    setSkills(prev => prev.filter(s => s.name !== skillName));
    
    if (existingResume) {
      await supabase
        .from('extracted_skills')
        .delete()
        .eq('resume_id', existingResume.id)
        .eq('skill_name', skillName);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Resume Analysis</h1>
            <p className="text-muted-foreground">
              Upload your resume and we'll extract your skills for personalized interviews
            </p>
          </div>

          {step === 'upload' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-8"
            >
              <div
                className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={processing}
                />

                {processing ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="text-lg font-medium">Processing your resume...</p>
                    <p className="text-sm text-muted-foreground">
                      Extracting text and analyzing skills
                    </p>
                  </div>
                ) : file ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-success/10 flex items-center justify-center">
                      <Check className="h-8 w-8 text-success" />
                    </div>
                    <p className="text-lg font-medium">{file.name}</p>
                    <Button variant="outline" onClick={() => setFile(null)}>
                      Choose Different File
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-medium mb-2">
                        Drag and drop your resume here
                      </p>
                      <p className="text-sm text-muted-foreground">
                        or click to browse • PDF, DOC, DOCX supported
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {existingResume && (
                <div className="mt-6 p-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Previous Resume</p>
                      <p className="text-sm text-muted-foreground">{existingResume.file_name}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="ml-auto"
                      onClick={() => setStep('skills')}
                    >
                      View Skills
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 'skills' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Extracted Skills</h2>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {skills.length} skills found
                  </span>
                </div>

                {skills.length > 0 ? (
                  <div className="space-y-4">
                    {skills.map((skill) => (
                      <div
                        key={skill.name}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                      >
                        <span className="font-medium">{skill.name}</span>
                        <div className="flex items-center gap-2">
                          {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                            <button
                              key={level}
                              onClick={() => updateSkillLevel(skill.name, level)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                skill.level === level
                                  ? level === 'beginner'
                                    ? 'bg-success/20 text-success border border-success/50'
                                    : level === 'intermediate'
                                    ? 'bg-warning/20 text-warning border border-warning/50'
                                    : 'bg-destructive/20 text-destructive border border-destructive/50'
                                  : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
                              }`}
                            >
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                          ))}
                          <button
                            onClick={() => removeSkill(skill.name)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-2"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No skills extracted yet. Upload a resume to get started.</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Upload New Resume
                </Button>
                <Button 
                  variant="hero" 
                  onClick={() => navigate('/interview/select')}
                  disabled={skills.length === 0}
                >
                  Continue to Interview
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
