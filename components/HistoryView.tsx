
import React from 'react';
import { Note, QuizAttempt } from '../types';
import { ICONS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface HistoryViewProps {
  notes: Note[];
  quizHistory: QuizAttempt[];
  onBack: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ notes, quizHistory, onBack }) => {
  const stats = [
    { name: 'Correct', value: quizHistory.filter(q => q.status === 'CORRECT').length },
    { name: 'Partial', value: quizHistory.filter(q => q.status === 'PARTIAL').length },
    { name: 'Incorrect', value: quizHistory.filter(q => q.status === 'INCORRECT').length },
  ];

  const COLORS = ['#22c55e', '#f97316', '#ef4444'];

  return (
    <div className="space-y-8 py-10 animate-fadeIn">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                {ICONS.Back}
            </button>
            <h1 className="text-2xl font-bold">My Academic Progress 📊</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-800 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm h-80">
                <h3 className="text-lg font-bold mb-4">Quiz Accuracy</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={stats}
                            cx="50%"
                            cy="45%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {stats.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2 text-xs font-bold">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-full"></div> Correct</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-500 rounded-full"></div> Partial</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Incorrect</span>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-center text-center">
                <span className="text-sm opacity-50 uppercase tracking-widest font-bold">Total Knowledge Points</span>
                <span className="text-6xl font-black text-accent-light my-4">
                    {notes.length * 50 + quizHistory.length * 10}
                </span>
                <p className="text-sm opacity-70">Based on notes generated and questions attempted</p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl">
                        <p className="text-2xl font-bold">{notes.length}</p>
                        <p className="text-xs opacity-50">Topics Read</p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl">
                        <p className="text-2xl font-bold">{quizHistory.length}</p>
                        <p className="text-xs opacity-50">Questions Solved</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-4">
            <h2 className="text-xl font-bold px-2">Library of Knowledge</h2>
            <div className="grid gap-4">
                {notes.length === 0 ? (
                    <div className="p-10 text-center opacity-50 border-2 border-dashed rounded-3xl">No notes generated yet.</div>
                ) : notes.map(note => (
                    <div key={note.id} className="p-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-3xl flex justify-between items-center group cursor-pointer hover:border-accent-light transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-zinc-100 dark:bg-zinc-700 rounded-2xl text-accent-light">{ICONS.Notes}</div>
                            <div>
                                <h4 className="font-bold text-lg">{note.topic}</h4>
                                <p className="text-sm opacity-60">{note.university} • {new Date(note.timestamp).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <button className="p-3 opacity-0 group-hover:opacity-100 bg-accent-light text-white rounded-xl transition-all">View Notes</button>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default HistoryView;
