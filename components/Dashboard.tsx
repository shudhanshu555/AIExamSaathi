
import React from 'react';
import { View, AppState } from '../types';
import { ICONS } from '../constants';

interface DashboardProps {
  state: AppState;
  setView: (view: View) => void;
  onQuickAction: (action: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, setView, onQuickAction }) => {
  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="text-center py-10 bg-gradient-to-br from-accent-light/10 to-transparent rounded-3xl">
        <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
          📚 ExamSaathi
        </h1>
        <p className="text-lg opacity-80">Your Study Companion for Exam Success</p>
        <div className="mt-6 flex justify-center gap-4">
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                <span className="text-sm block opacity-60">Daily Streak</span>
                <span className="text-2xl font-bold">🔥 {state.streak} Days</span>
            </div>
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                <span className="text-sm block opacity-60">Topics Mastered</span>
                <span className="text-2xl font-bold">📝 {state.notes.length}</span>
            </div>
        </div>
      </header>

      <section>
        <div className="flex justify-between items-end mb-4 px-2">
            <h2 className="text-xl font-bold">Academic Tools</h2>
            <button 
                onClick={() => setView(View.AI_ASSISTANT)}
                className="text-sm font-bold text-accent-light hover:underline flex items-center gap-1"
            >
                Open Study Hub
            </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
          <ActionButton 
            icon={ICONS.Notes} 
            label="Notes" 
            onClick={() => setView(View.NOTES_GENERATOR)} 
            color="bg-blue-500"
          />
          <ActionButton 
            icon={ICONS.Quiz} 
            label="Quiz Mode" 
            onClick={() => setView(View.QUIZ)} 
            color="bg-green-500"
          />
          <ActionButton 
            icon={ICONS.Planner} 
            label="Study Plan" 
            onClick={() => setView(View.PLANNER)} 
            color="bg-indigo-500"
          />
          <ActionButton 
            icon={ICONS.Clock} 
            label="Focus" 
            onClick={() => setView(View.POMODORO)} 
            color="bg-rose-500"
          />
          <ActionButton 
            icon={ICONS.History} 
            label="History" 
            onClick={() => setView(View.HISTORY)} 
            color="bg-purple-500"
          />
          <ActionButton 
            icon={ICONS.Message} 
            label="Doubt Solver" 
            onClick={() => setView(View.AI_ASSISTANT)} 
            color="bg-cyan-500"
          />
        </div>
      </section>

      {state.notes.length > 0 && (
        <section>
            <h2 className="text-xl font-bold mb-4 px-2">Recently Generated</h2>
            <div className="grid gap-4">
                {state.notes.slice(-2).reverse().map(note => (
                    <div key={note.id} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex justify-between items-center cursor-pointer hover:border-accent-light transition-all" onClick={() => setView(View.HISTORY)}>
                        <div>
                            <h3 className="font-bold text-lg">{note.topic}</h3>
                            <p className="text-sm opacity-60">{note.university} • {note.year}</p>
                        </div>
                        <div className="p-2 rounded-full bg-white dark:bg-zinc-700">
                            {ICONS.Notes}
                        </div>
                    </div>
                ))}
            </div>
        </section>
      )}
    </div>
  );
};

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; color: string }> = ({ icon, label, onClick, color }) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-all group overflow-hidden relative"
  >
    <div className={`absolute top-0 right-0 w-20 h-20 opacity-5 -mr-4 -mt-4 rounded-full ${color}`}></div>
    <div className={`p-4 rounded-2xl mb-3 text-white ${color} transition-transform group-hover:scale-110`}>
      {icon}
    </div>
    <span className="font-semibold text-sm">{label}</span>
  </button>
);

export default Dashboard;
