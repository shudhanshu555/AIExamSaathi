import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../types';
import { generateNotes, generateDiagram } from '../services/geminiService';
import { ICONS } from '../constants';

interface NotesGeneratorProps {
  onSave: (note: Note) => void;
  onBack: () => void;
  onSpeak: (callback: (text: string) => void) => void;
  onSpeakText: (text: string) => Promise<number>;
}

const LatexText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const renderMath = () => {
      if (ref.current && (window as any).renderMathInElement) {
        try {
          // Check for Quirks Mode and log warning if found, though the HTML fix should prevent it
          if (document.compatMode !== "CSS1Compat") {
            console.warn("KaTeX: Document is in Quirks Mode. Rendering may fail.");
          }
          
          (window as any).renderMathInElement(ref.current, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false,
            trust: true,
            strict: false
          });
        } catch (e) {
          console.warn("KaTeX renderMathInElement failed:", e);
        }
      }
    };

    renderMath();
    // Re-render after a short delay to ensure dynamic content is fully settled
    const timer = setTimeout(renderMath, 200);
    return () => clearTimeout(timer);
  }, [text]);

  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: text }} />;
};

const MathFormula: React.FC<{ formula: string }> = ({ formula }) => {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderBlock = () => {
      if (elRef.current && (window as any).katex) {
        try {
          // Normalize LaTeX: Strip markdown blocks and existing delimiters
          let cleaned = formula.trim()
            .replace(/^```(latex|math)?\n?/i, '')
            .replace(/\n?```$/i, '')
            .trim();

          // Standardize delimiters for the renderer
          if (cleaned.startsWith('$$') && cleaned.endsWith('$$')) {
            cleaned = cleaned.slice(2, -2);
          } else if (cleaned.startsWith('$') && cleaned.endsWith('$')) {
            cleaned = cleaned.slice(1, -1);
          } else if (cleaned.startsWith('\\[') && cleaned.endsWith('\\]')) {
            cleaned = cleaned.slice(2, -2);
          }
          
          (window as any).katex.render(cleaned, elRef.current, {
            throwOnError: false,
            displayMode: true,
            trust: true,
            strict: false
          });
        } catch (e) {
          console.error("KaTeX Render Error:", e);
          if (elRef.current) elRef.current.textContent = formula;
        }
      }
    };

    renderBlock();
    const timer = setTimeout(renderBlock, 150);
    return () => clearTimeout(timer);
  }, [formula]);

  return (
    <div className="my-8 py-10 px-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2.5rem] shadow-inner border border-zinc-100 dark:border-zinc-700 overflow-x-auto transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800">
      <div ref={elRef} className="text-center min-h-[3rem] flex items-center justify-center" />
    </div>
  );
};

const DiagramImage: React.FC<{ description: string }> = ({ description }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchDiagram = async () => {
      setLoading(true);
      const url = await generateDiagram(description);
      if (mounted) {
        setImageUrl(url);
        setLoading(false);
      }
    };
    fetchDiagram();
    return () => { mounted = false; };
  }, [description]);

  if (loading) {
    return (
      <div className="p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-3xl bg-zinc-50 dark:bg-zinc-800/50 flex flex-col items-center justify-center min-h-[220px] animate-pulse">
        <div className="w-8 h-8 border-4 border-accent-light border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-[10px] opacity-50 uppercase font-black tracking-widest text-center px-4">Synthesizing Schematic...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-white dark:bg-zinc-800 rounded-[2rem] border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden transition-all hover:scale-[1.01] hover:shadow-md">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={description} 
            className="w-full h-auto rounded-2xl" 
          />
        ) : (
          <div className="h-[220px] flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-2xl">
             <p className="text-xs opacity-40 italic font-medium">Visual artifact missing.</p>
          </div>
        )}
      </div>
      <p className="text-[10px] font-black text-center opacity-40 uppercase tracking-[0.2em] px-4 leading-relaxed">{description}</p>
    </div>
  );
};

const NotesGenerator: React.FC<NotesGeneratorProps> = ({ onSave, onBack, onSpeak, onSpeakText }) => {
  const [topic, setTopic] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [university, setUniversity] = useState('');
  const [length, setLength] = useState<'SHORT' | 'MODERATE' | 'LONG'>('MODERATE');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Note | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await generateNotes(topic, course, year, university, length);
      const newNote: Note = {
        id: Date.now().toString(),
        topic,
        course,
        year,
        university,
        length,
        content: result,
        timestamp: Date.now(),
      };
      setPreview(newNote);
    } catch (err) {
      console.error(err);
      alert("Error generating notes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReadAloud = () => {
    if (!preview) return;
    const text = `Opening academic summary for ${preview.topic}. Focus on the core principles and mathematical derivations presented.`;
    onSpeakText(text);
  };

  if (preview) {
    return (
      <div className="space-y-10 animate-fadeIn max-w-5xl mx-auto pb-24">
        <div className="flex justify-between items-center mb-4 px-6">
            <button onClick={() => setPreview(null)} className="flex items-center gap-2 text-[10px] font-black opacity-50 hover:opacity-100 uppercase tracking-widest transition-all">
                {ICONS.Back} Redefine Topic
            </button>
            <button onClick={handleReadAloud} className="flex items-center gap-2 text-[10px] text-accent-light font-black uppercase tracking-widest hover:underline transition-all">
                {ICONS.Sound} Audio Overview
            </button>
        </div>
        
        <div id="notes-content" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[3.5rem] shadow-2xl overflow-hidden">
          <div className="p-8 md:p-24 space-y-24">
            <header className="border-b pb-16 mb-16 text-center border-zinc-100 dark:border-zinc-800">
                <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-zinc-900 dark:text-zinc-50 mb-10 leading-[1.1]">{preview.topic}</h1>
                <div className="flex flex-wrap justify-center gap-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em]">
                   <span className="bg-zinc-50 dark:bg-zinc-800 px-7 py-3 rounded-full text-accent-light border border-zinc-100 dark:border-zinc-700">{preview.university}</span>
                   <span className="bg-zinc-50 dark:bg-zinc-800 px-7 py-3 rounded-full border border-zinc-100 dark:border-zinc-700">{preview.course}</span>
                   <span className="bg-zinc-50 dark:bg-zinc-800 px-7 py-3 rounded-full border border-zinc-100 dark:border-zinc-700">{preview.year}</span>
                </div>
            </header>

            <section className="space-y-12">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-[2rem] bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-2xl font-black shadow-sm border border-emerald-500/5">01</div>
                 <h2 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50 uppercase">Fundamental Concepts</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {preview.content.keyConcepts.map((c, i) => (
                  <div key={i} className="group p-10 bg-zinc-50/50 dark:bg-zinc-800/40 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-700 hover:border-emerald-500/30 transition-all hover:shadow-xl">
                    <div className="flex gap-6">
                      <span className="text-emerald-500 font-black mt-1.5 opacity-50">#</span>
                      <LatexText text={c} className="text-xl font-bold leading-relaxed text-zinc-800 dark:text-zinc-200" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-12">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-[2rem] bg-blue-500/10 text-blue-500 flex items-center justify-center text-2xl font-black shadow-sm border border-blue-500/5">02</div>
                 <h2 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50 uppercase">Mathematical Derivations</h2>
              </div>
              <div className="space-y-12">
                {preview.content.formulas.map((f, i) => (
                  <div key={i} className="p-12 bg-blue-50/30 dark:bg-blue-900/10 rounded-[3.5rem] border border-blue-100/50 dark:border-blue-800/20 shadow-sm transition-all hover:shadow-lg">
                    <h3 className="font-black text-[11px] text-blue-600 dark:text-blue-400 uppercase tracking-[0.5em] mb-8 flex items-center gap-4">
                       <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
                       {f.name}
                    </h3>
                    <MathFormula formula={f.formula} />
                    <div className="space-y-8 mt-10">
                      <LatexText text={f.explanation} className="text-xl opacity-80 font-semibold leading-relaxed" />
                      {f.realWorldExample && (
                        <div className="p-10 bg-white dark:bg-zinc-900/40 rounded-[2.5rem] border border-blue-200/30 dark:border-blue-700/20 flex items-start gap-8 shadow-sm group">
                          <div className="w-14 h-14 rounded-2xl bg-blue-500/5 flex items-center justify-center text-3xl transition-transform group-hover:scale-110">🌍</div>
                          <div className="space-y-2 flex-1">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">Physical Application</p>
                            <LatexText text={f.realWorldExample} className="text-lg font-bold opacity-90 leading-relaxed text-zinc-800 dark:text-zinc-200" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-12">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-[2rem] bg-purple-500/10 text-purple-500 flex items-center justify-center text-2xl font-black shadow-sm border border-purple-500/5">03</div>
                 <h2 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50 uppercase">Visual Representations</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                {preview.content.diagramDescriptions.map((d, i) => (
                  <DiagramImage key={i} description={d} />
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 pt-16">
                <section className="space-y-10">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-3xl bg-orange-500/10 text-orange-500 flex items-center justify-center text-xl font-black shadow-sm">04</div>
                        <h2 className="text-3xl font-black tracking-tighter uppercase">Exam Insights</h2>
                    </div>
                    <div className="space-y-6">
                        {preview.content.tips.map((t, i) => (
                            <div key={i} className="p-8 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/10 rounded-[2.5rem] flex gap-6 text-orange-950 dark:text-orange-100 hover:bg-orange-500/10 transition-colors shadow-sm">
                                <span className="text-2xl mt-1">✨</span>
                                <LatexText text={t} className="font-bold text-lg leading-relaxed" />
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-10">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xl font-black shadow-sm">05</div>
                        <h2 className="text-3xl font-black tracking-tighter uppercase">Practice Vectors</h2>
                    </div>
                    <div className="space-y-6">
                        {preview.content.practicePoints.map((p, i) => (
                            <div key={i} className="p-8 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 rounded-[2.5rem] flex gap-6 group hover:border-rose-500/20 transition-all hover:translate-x-1 hover:shadow-md">
                                <span className="text-rose-500 font-black text-sm mt-1.5 opacity-40">{i+1}.</span>
                                <LatexText text={p} className="text-lg font-black opacity-80 leading-relaxed" />
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <footer className="mt-24 pt-20 border-t border-zinc-100 dark:border-zinc-800 text-center opacity-30">
               <p className="text-[10px] font-black uppercase tracking-[0.6em] mb-4">ExamSaathi Neural Processing V3.2</p>
               <p className="text-[9px] font-bold tracking-[0.2em]">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • DERIVATION ID: {preview.id.substring(0,8)}</p>
            </footer>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-8 py-16 px-6">
            <button onClick={() => onSave(preview)} className="px-16 py-7 bg-accent-light text-white rounded-full font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-accent-light/30 hover:scale-105 active:scale-95 transition-all">Archive Notes</button>
            <button onClick={() => window.print()} className="px-16 py-7 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full font-black text-xs uppercase tracking-[0.3em] hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all shadow-lg">Download PDF</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10 py-16 animate-fadeIn px-6">
      <div className="flex items-center gap-6 mb-10">
          <button onClick={onBack} className="p-5 rounded-[2rem] bg-zinc-100 dark:bg-zinc-800 hover:scale-110 transition-all active:scale-90 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50">{ICONS.Back}</button>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Academic Synthesis</h1>
      </div>

      <form onSubmit={handleGenerate} className="bg-white dark:bg-zinc-800 p-12 md:p-16 rounded-[4rem] border border-zinc-200 dark:border-zinc-700 space-y-14 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-accent-light/5 rounded-bl-full -mr-20 -mt-20"></div>
        
        <div className="space-y-6">
          <label className="block text-[11px] font-black uppercase tracking-[0.5em] opacity-30 px-3">Subject Matter / Core Topic</label>
          <div className="relative group">
              <input required type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Statistical Mechanics..." className="w-full p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-all text-2xl font-black group-hover:shadow-2xl" />
              <button type="button" onClick={() => onSpeak(setTopic)} className="absolute right-8 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light transition-all active:scale-90">{ICONS.Mic}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <label className="block text-[11px] font-black uppercase tracking-[0.5em] opacity-30 px-3">Discipline / stream</label>
            <div className="relative group">
                <input type="text" value={course} onChange={e => setCourse(e.target.value)} placeholder="e.g. Theoretical Physics" className="w-full p-7 rounded-[2rem] border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-all font-bold text-lg group-hover:shadow-md" />
                <button type="button" onClick={() => onSpeak(setCourse)} className="absolute right-7 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light transition-all active:scale-90">{ICONS.Mic}</button>
            </div>
          </div>
          <div className="space-y-6">
            <label className="block text-[11px] font-black uppercase tracking-[0.5em] opacity-30 px-3">Institution / Board</label>
            <div className="relative group">
                <input type="text" value={university} onChange={e => setUniversity(e.target.value)} placeholder="e.g. Oxford / ICSE" className="w-full p-7 rounded-[2rem] border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-all font-bold text-lg group-hover:shadow-md" />
                <button type="button" onClick={() => onSpeak(setUniversity)} className="absolute right-7 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light transition-all active:scale-90">{ICONS.Mic}</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <label className="block text-[11px] font-black uppercase tracking-[0.5em] opacity-30 px-3">Academic Period</label>
            <div className="relative group">
                <input type="text" value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. Year 3 / Semester 5" className="w-full p-7 rounded-[2rem] border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-all font-bold text-lg group-hover:shadow-md" />
                <button type="button" onClick={() => onSpeak(setYear)} className="absolute right-7 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light transition-all active:scale-90">{ICONS.Mic}</button>
            </div>
          </div>
          <div className="space-y-6">
            <label className="block text-[11px] font-black uppercase tracking-[0.5em] opacity-30 px-3">Synthesis Granularity</label>
            <div className="relative">
                <select value={length} onChange={e => setLength(e.target.value as any)} className="w-full p-7 rounded-[2rem] border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-all font-bold text-lg appearance-none cursor-pointer">
                  <option value="SHORT">Essential Overview</option>
                  <option value="MODERATE">Standard Synthesis</option>
                  <option value="LONG">In-Depth Mastery</option>
                </select>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 text-xs">▼</div>
            </div>
          </div>
        </div>

        <button disabled={loading || !topic} className="group relative w-full py-9 bg-accent-light text-white font-black text-xs uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl shadow-accent-light/20 hover:-translate-y-2 transition-all disabled:opacity-50 disabled:translate-y-0 overflow-hidden active:scale-[0.98]">
          <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-700"></div>
          {loading ? (
            <span className="flex items-center justify-center gap-8">
              <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Orchestrating Knowledge Framework...
            </span>
          ) : "Synthesize Academic Record"}
        </button>
      </form>
      
      <p className="text-center text-[10px] font-black uppercase tracking-[0.6em] opacity-20 py-8 leading-relaxed px-12">Precision Optimized for Scientific Notations & High-Fidelity LaTeX Rendering Engine V3.2</p>
    </div>
  );
};

export default NotesGenerator;