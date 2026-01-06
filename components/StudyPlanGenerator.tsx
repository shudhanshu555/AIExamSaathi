
import React, { useState } from 'react';
import { StudyPlan } from '../types';
import { generateStudyPlan } from '../services/geminiService';
import { ICONS } from '../constants';

interface StudyPlanGeneratorProps {
  onSave: (plan: StudyPlan) => void;
  onBack: () => void;
  onSpeak: (callback: (text: string) => void) => void;
}

const StudyPlanGenerator: React.FC<StudyPlanGeneratorProps> = ({ onSave, onBack, onSpeak }) => {
  const [goal, setGoal] = useState('');
  const [days, setDays] = useState(7);
  const [subjectInput, setSubjectInput] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<StudyPlan | null>(null);

  const addSubject = () => {
    if (subjectInput.trim()) {
      setSubjects([...subjects, subjectInput.trim()]);
      setSubjectInput('');
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subjects.length === 0) return;
    setLoading(true);
    try {
      const result = await generateStudyPlan(goal, days, subjects);
      const newPlan: StudyPlan = {
        id: Date.now().toString(),
        goal,
        daysRemaining: days,
        subjects,
        schedule: result.schedule,
      };
      setPreview(newPlan);
    } catch (err) {
      console.error(err);
      alert("Error generating study plan.");
    } finally {
      setLoading(false);
    }
  };

  if (preview) {
    return (
      <div className="space-y-6 animate-fadeIn pb-10">
        <button onClick={() => setPreview(null)} className="flex items-center gap-2 text-sm opacity-60 hover:opacity-100 mb-4">
          {ICONS.Back} Edit Details
        </button>
        
        <div className="bg-white dark:bg-zinc-800 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-700 shadow-xl">
          <header className="mb-8 border-b dark:border-zinc-700 pb-6">
            <h2 className="text-3xl font-black mb-2">📅 Your Smart Study Plan</h2>
            <p className="opacity-70 font-medium">Goal: {preview.goal} | {preview.daysRemaining} Days left</p>
          </header>

          <div className="space-y-8">
            {preview.schedule.map((item, idx) => (
              <div key={idx} className="relative pl-8 border-l-2 border-accent-light/30 pb-8 last:pb-0">
                <div className="absolute left-0 top-0 w-8 h-8 -ml-[17px] bg-accent-light text-white rounded-full flex items-center justify-center font-bold text-xs shadow-lg">
                  {item.day}
                </div>
                <h3 className="text-xl font-bold mb-4">Day {item.day}</h3>
                <div className="grid gap-3">
                  {item.tasks.map((task, tidx) => (
                    <div key={tidx} className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
                      <input type="checkbox" className="w-5 h-5 rounded-lg accent-accent-light" />
                      <span className="text-sm font-medium">{task}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex gap-4">
            <button onClick={() => onSave(preview)} className="flex-1 py-4 bg-accent-light text-white font-bold rounded-2xl hover:shadow-xl transition-all">Start This Plan</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-8 animate-fadeIn">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">{ICONS.Back}</button>
        <h1 className="text-2xl font-bold">Plan Your Success 📅</h1>
      </div>

      <form onSubmit={handleGenerate} className="bg-white dark:bg-zinc-800 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-700 space-y-6 shadow-xl">
        <div>
          <label className="block text-sm font-semibold mb-2 opacity-70">What's your primary goal?</label>
          <div className="relative">
            <input required type="text" value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Pass mid-terms, Master Calculus..." className="w-full p-4 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light" />
            <button type="button" onClick={() => onSpeak(setGoal)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light">{ICONS.Mic}</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2 opacity-70">Days Remaining</label>
            <div className="relative">
                <input type="number" min="1" max="30" value={days} onChange={e => setDays(parseInt(e.target.value))} className="w-full p-4 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light" />
                <button type="button" onClick={() => onSpeak((text) => { const n = parseInt(text.replace(/\D/g, '')); if(!isNaN(n)) setDays(n); })} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light" title="Speak Days">{ICONS.Mic}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 opacity-70">Subjects</label>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input type="text" value={subjectInput} onChange={e => setSubjectInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSubject())} placeholder="Add subject..." className="w-full p-4 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-colors" />
                    <button type="button" onClick={() => onSpeak(setSubjectInput)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light" title="Speak Subject">{ICONS.Mic}</button>
                </div>
                <button type="button" onClick={addSubject} className="px-4 bg-accent-light text-white rounded-xl">+</button>
            </div>
          </div>
        </div>

        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {subjects.map((s, i) => (
              <span key={i} className="px-3 py-1 bg-accent-light/10 text-accent-light rounded-full text-xs font-bold">
                {s} <button type="button" onClick={() => setSubjects(subjects.filter((_, idx) => idx !== i))} className="ml-1">×</button>
              </span>
            ))}
          </div>
        )}

        <button disabled={loading || subjects.length === 0} className="w-full py-5 bg-accent-light text-white font-bold rounded-2xl hover:shadow-xl transition-all disabled:opacity-50">{loading ? "Calculating Optimal Schedule..." : "Generate AI Study Plan"}</button>
      </form>
    </div>
  );
};

export default StudyPlanGenerator;
