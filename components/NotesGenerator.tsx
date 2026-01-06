
import React, { useState } from 'react';
import { Note } from '../types';
import { generateNotes } from '../services/geminiService';
import { ICONS } from '../constants';

interface NotesGeneratorProps {
  onSave: (note: Note) => void;
  onBack: () => void;
  onSpeak: (callback: (text: string) => void) => void;
  onSpeakText: (text: string) => void;
}

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
    const text = `Notes for ${preview.topic}. Key concepts include ${preview.content.keyConcepts.join(', ')}. Study Tip: ${preview.content.tips[0]}`;
    onSpeakText(text);
  };

  if (preview) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex justify-between items-center mb-4">
            <button onClick={() => setPreview(null)} className="flex items-center gap-2 text-sm opacity-60 hover:opacity-100">
                {ICONS.Back} Edit Prompt
            </button>
            <button onClick={handleReadAloud} className="flex items-center gap-2 text-sm text-accent-light font-bold hover:underline">
                {ICONS.Sound} Read Aloud
            </button>
        </div>
        
        <div id="notes-content" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xl overflow-hidden max-w-4xl mx-auto">
          <div className="p-12 space-y-8 min-h-[1000px]">
            <header className="border-b pb-6 mb-8 text-center border-zinc-200 dark:border-zinc-700">
                <h1 className="text-4xl font-serif font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-100 mb-2">{preview.topic}</h1>
                <p className="font-mono text-zinc-500 text-sm">{preview.university} • {preview.course} • {preview.year} Year</p>
                <div className="mt-4 text-xs font-bold text-zinc-400 uppercase tracking-widest opacity-60">EXAM SAATHI ACADEMIC NOTES • {preview.length} VERSION</div>
            </header>

            <section>
              <h2 className="text-xl font-bold flex items-center gap-2 text-green-600 dark:text-green-400 border-l-4 border-green-600 pl-3 mb-4">📌 KEY CONCEPTS</h2>
              <ul className="list-disc list-inside space-y-2 leading-relaxed">
                {preview.content.keyConcepts.map((c, i) => (
                  <li key={i} className="text-lg">{c}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold flex items-center gap-2 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 pl-3 mb-4">📐 IMPORTANT FORMULAS</h2>
              <div className="grid gap-4">
                {preview.content.formulas.map((f, i) => (
                  <div key={i} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                    <div className="font-bold text-sm text-blue-800 dark:text-blue-300 mb-1">{f.name}</div>
                    <code className="text-xl font-mono block my-2 text-center p-4 bg-white dark:bg-zinc-800 rounded shadow-sm border border-zinc-100 dark:border-zinc-700">{f.formula}</code>
                    <p className="text-sm opacity-80">{f.explanation}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-600 dark:text-zinc-400 border-l-4 border-zinc-400 pl-3 mb-4">📊 DIAGRAMS & ILLUSTRATIONS</h2>
              <div className="space-y-4">
                {preview.content.diagramDescriptions.map((d, i) => (
                  <div key={i} className="p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex flex-col items-center justify-center min-h-[150px]">
                    <span className="text-sm italic text-center opacity-70 mb-2">[Diagram: {d}]</span>
                    <p className="text-xs opacity-50 text-center max-w-sm">Use a labeled diagram here for visual clarity in your exam paper.</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold flex items-center gap-2 text-orange-600 dark:text-orange-400 border-l-4 border-orange-600 pl-3 mb-4">💡 QUICK TIPS & MEMORY AIDS</h2>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-xl border border-orange-100 dark:border-orange-800">
                <ul className="space-y-3">
                    {preview.content.tips.map((t, i) => (
                    <li key={i} className="flex gap-3">
                        <span className="text-orange-500">✨</span>
                        <span className="text-md font-medium">{t}</span>
                    </li>
                    ))}
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold flex items-center gap-2 text-purple-600 dark:text-purple-400 border-l-4 border-purple-600 pl-3 mb-4">✅ PRACTICE POINTS</h2>
              <ul className="list-decimal list-inside space-y-2 opacity-80">
                {preview.content.practicePoints.map((p, i) => (
                  <li key={i} className="text-md">{p}</li>
                ))}
              </ul>
            </section>

            <footer className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-800 text-center opacity-40 text-xs">Generated by ExamSaathi AI Companion • {new Date().toLocaleDateString()}</footer>
          </div>
        </div>

        <div className="flex justify-center gap-4 py-8">
            <button onClick={() => onSave(preview)} className="bg-accent-light text-white px-8 py-3 rounded-full font-bold hover:shadow-lg transition-all flex items-center gap-2">💾 Save to My Library</button>
            <button onClick={() => window.print()} className="bg-zinc-200 dark:bg-zinc-700 px-8 py-3 rounded-full font-bold hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all">🖨️ Print as A4 PDF</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-10 animate-fadeIn">
      <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">{ICONS.Back}</button>
          <h1 className="text-2xl font-bold">New Notes Generation</h1>
      </div>

      <form onSubmit={handleGenerate} className="bg-white dark:bg-zinc-800 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-700 space-y-6 shadow-sm">
        <div>
          <label className="block text-sm font-semibold mb-2 opacity-70">Study Topic</label>
          <div className="relative group">
              <input required type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Quantum Mechanics, Optics, Cell Biology..." className="w-full p-4 pr-14 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-colors" />
              <button type="button" onClick={() => onSpeak(setTopic)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light transition-colors" title="Speak Topic">{ICONS.Mic}</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2 opacity-70">Course/Subject</label>
            <div className="relative group">
                <input type="text" value={course} onChange={e => setCourse(e.target.value)} placeholder="e.g. Physics I" className="w-full p-4 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-colors" />
                <button type="button" onClick={() => onSpeak(setCourse)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light transition-colors" title="Speak Course">{ICONS.Mic}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 opacity-70">University/Board</label>
            <div className="relative group">
                <input type="text" value={university} onChange={e => setUniversity(e.target.value)} placeholder="e.g. MAKAUT" className="w-full p-4 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-colors" />
                <button type="button" onClick={() => onSpeak(setUniversity)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light transition-colors" title="Speak University">{ICONS.Mic}</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2 opacity-70">Year/Semester</label>
            <div className="relative group">
                <input type="text" value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 1st Year" className="w-full p-4 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-colors" />
                <button type="button" onClick={() => onSpeak(setYear)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light transition-colors" title="Speak Year">{ICONS.Mic}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 opacity-70">Note Length</label>
            <select value={length} onChange={e => setLength(e.target.value as any)} className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-colors">
              <option value="SHORT">Short (1-2 Pages)</option>
              <option value="MODERATE">Moderate (3-5 Pages)</option>
              <option value="LONG">Long (6-10 Pages)</option>
            </select>
          </div>
        </div>

        <button disabled={loading || !topic} className="w-full py-5 bg-accent-light text-white font-bold rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Preparing High Quality Notes...
            </span>
          ) : "Generate Professional Notes"}
        </button>
      </form>
    </div>
  );
};

export default NotesGenerator;
