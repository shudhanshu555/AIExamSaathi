
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';

interface PomodoroTimerProps {
  onBack: () => void;
}

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ onBack }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      clearInterval(interval);
      handleSessionEnd();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const handleSessionEnd = () => {
    setIsActive(false);
    if (mode === 'FOCUS') {
      alert("Time for a break! You've done great.");
      setMode('BREAK');
      setTimeLeft(5 * 60);
    } else {
      alert("Break's over. Ready to focus again?");
      setMode('FOCUS');
      setTimeLeft(25 * 60);
    }
  };

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(mode === 'FOCUS' ? 25 * 60 : 5 * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (mode === 'FOCUS' ? 25 * 60 - timeLeft : 5 * 60 - timeLeft) / (mode === 'FOCUS' ? 25 * 60 : 5 * 60) * 100;

  return (
    <div className="max-w-xl mx-auto py-16 animate-fadeIn">
      <div className="flex items-center gap-4 mb-10">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
          {ICONS.Back}
        </button>
        <h1 className="text-2xl font-bold">Focus Mode 🧘</h1>
      </div>

      <div className="bg-white dark:bg-zinc-800 p-12 rounded-[3rem] border border-zinc-200 dark:border-zinc-700 shadow-2xl flex flex-col items-center space-y-10">
        <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl">
          <button 
            onClick={() => { setMode('FOCUS'); setTimeLeft(25*60); setIsActive(false); }}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${mode === 'FOCUS' ? 'bg-white dark:bg-zinc-800 shadow-sm' : 'opacity-40'}`}
          >
            Study Session
          </button>
          <button 
             onClick={() => { setMode('BREAK'); setTimeLeft(5*60); setIsActive(false); }}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${mode === 'BREAK' ? 'bg-white dark:bg-zinc-800 shadow-sm' : 'opacity-40'}`}
          >
            Quick Break
          </button>
        </div>

        <div className="relative w-64 h-64 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle 
                    cx="128" cy="128" r="120" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="8" 
                    className="text-zinc-100 dark:text-zinc-700"
                />
                <circle 
                    cx="128" cy="128" r="120" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="8" 
                    strokeDasharray="754"
                    strokeDashoffset={754 - (754 * progress / 100)}
                    className="text-accent-light transition-all duration-1000"
                />
            </svg>
            <span className="text-6xl font-black font-mono tracking-tighter">
                {formatTime(timeLeft)}
            </span>
        </div>

        <div className="flex gap-6 items-center">
            <button 
                onClick={resetTimer}
                className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 transition-colors"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button 
                onClick={toggleTimer}
                className="w-20 h-20 rounded-full bg-accent-light text-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
            >
                {isActive ? ICONS.Pause : ICONS.Play}
            </button>
            <button className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 transition-colors opacity-50">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
            </button>
        </div>

        <p className="text-sm font-medium opacity-50 text-center">
            {mode === 'FOCUS' ? "Stay focused. You can do this!" : "Great work. Relax for a moment."}
        </p>
      </div>
    </div>
  );
};

export default PomodoroTimer;
