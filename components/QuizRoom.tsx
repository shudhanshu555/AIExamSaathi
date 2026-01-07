
import React, { useState, useEffect, useRef } from 'react';
import { generateQuizQuestion, evaluateAnswer } from '../services/geminiService';
import { QuizQuestion, QuizAttempt } from '../types';
import { ICONS } from '../constants';

interface QuizRoomProps {
  onBack: () => void;
  onRecordResult: (attempt: QuizAttempt) => void;
  onSpeak: (callback: (text: string) => void) => void;
  onSpeakText: (text: string) => Promise<number>;
}

const LatexText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const renderMath = () => {
      if (ref.current && (window as any).renderMathInElement) {
        (window as any).renderMathInElement(ref.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      }
    };

    renderMath();
    const timer = setTimeout(renderMath, 100);
    return () => clearTimeout(timer);
  }, [text]);

  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: text }} />;
};

const QuizRoom: React.FC<QuizRoomProps> = ({ onBack, onRecordResult, onSpeak, onSpeakText }) => {
  const [topic, setTopic] = useState('');
  const [quizType, setQuizType] = useState<'MCQ' | 'OPEN_ENDED'>('MCQ');
  const [isStarted, setIsStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [evaluation, setEvaluation] = useState<any>(null);
  const [showHint, setShowHint] = useState(false);

  const loadQuestion = async (t: string, type: 'MCQ' | 'OPEN_ENDED') => {
    setLoading(true);
    try {
      const q = await generateQuizQuestion(t, 'MEDIUM', type);
      setCurrentQuestion({ ...q, id: Date.now().toString(), topic: t, difficulty: 'MEDIUM' });
      setEvaluation(null);
      setUserAnswer('');
      setShowHint(false);
    } catch (err) {
      console.error(err);
      alert("Error generating question. Please check your topic.");
      setIsStarted(false);
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;
    setIsStarted(true);
    await loadQuestion(topic, quizType);
  };

  const handleSubmit = async (e?: React.FormEvent, mcqSelection?: string) => {
    if (e) e.preventDefault();
    const answerToEval = mcqSelection || userAnswer;
    if (!currentQuestion || !answerToEval) return;

    setLoading(true);
    try {
      const evalResult = await evaluateAnswer(currentQuestion.text, currentQuestion.correctAnswer, answerToEval);
      setEvaluation(evalResult);
      onRecordResult({
        questionId: currentQuestion.id,
        userAnswer: answerToEval,
        status: evalResult.status,
        timestamp: Date.now()
      });
      // Filter out raw LaTeX for speech to keep it natural
      const speechFeedback = evalResult.feedback.replace(/\$[^$]+\$/g, '').replace(/\\\[.+?\\\]/g, '');
      onSpeakText(`${evalResult.status}! ${speechFeedback}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fix: Renamed handleReadQuestion to handleReadAloud to resolve the reference error on line 151
  const handleReadAloud = () => {
    if (currentQuestion) {
        const speechText = currentQuestion.text.replace(/\$[^$]+\$/g, ' formula ');
        onSpeakText(speechText);
    }
  };

  if (!isStarted) {
    return (
      <div className="max-w-xl mx-auto py-20 animate-fadeIn">
        <h1 className="text-4xl font-black mb-8 text-center tracking-tight">Revision Matrix 🎯</h1>
        <form onSubmit={startQuiz} className="bg-white dark:bg-zinc-800 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-700 shadow-2xl space-y-8">
          <div className="flex p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl">
            <button 
              type="button"
              onClick={() => setQuizType('MCQ')}
              className={`flex-1 py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${quizType === 'MCQ' ? 'bg-white dark:bg-zinc-800 shadow-md text-accent-light' : 'opacity-40 hover:opacity-100'}`}
            >
              Interactive MCQ
            </button>
            <button 
              type="button"
              onClick={() => setQuizType('OPEN_ENDED')}
              className={`flex-1 py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${quizType === 'OPEN_ENDED' ? 'bg-white dark:bg-zinc-800 shadow-md text-accent-light' : 'opacity-40 hover:opacity-100'}`}
            >
              Open Response
            </button>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-black uppercase tracking-widest opacity-40 px-1">Study Objective / Subject</label>
            <div className="relative">
                <input required type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Thermodynamics, Linear Algebra..." className="w-full p-5 pr-14 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light font-bold text-lg" />
                <button type="button" onClick={() => onSpeak(setTopic)} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light transition-transform active:scale-90">{ICONS.Mic}</button>
            </div>
          </div>
          
          <button className="w-full py-5 bg-accent-light text-white font-black text-sm uppercase tracking-widest rounded-3xl hover:shadow-[0_20px_40px_rgba(66,133,244,0.3)] transition-all active:scale-[0.98]">Deploy Quiz session</button>
          <button type="button" onClick={onBack} className="w-full py-2 text-[10px] font-black opacity-30 uppercase tracking-[0.4em] hover:opacity-60 transition-opacity">Abort Session</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8 animate-fadeIn px-4">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:scale-110 active:scale-90 transition-all">{ICONS.Back}</button>
        <div className="flex flex-col items-center">
          <span className="bg-accent-light/10 text-accent-light px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{quizType === 'MCQ' ? 'Neural MCQ Matrix' : 'Subjective Logic'}</span>
          <span className="text-sm font-black mt-2 uppercase tracking-tighter opacity-60">{topic}</span>
        </div>
        <button onClick={handleReadAloud} className="p-3 rounded-2xl bg-accent-light/5 text-accent-light hover:scale-110 transition-all active:scale-90">{ICONS.Sound}</button>
      </div>

      {loading && !currentQuestion ? (
        <div className="text-center py-24 space-y-6">
            <div className="animate-spin h-12 w-12 border-[6px] border-accent-light border-t-transparent rounded-full mx-auto"></div>
            <p className="font-black text-sm uppercase tracking-widest opacity-40 animate-pulse">Synthesisng Neural Challenge...</p>
        </div>
      ) : currentQuestion && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-800 p-8 md:p-14 rounded-[3.5rem] border border-zinc-200 dark:border-zinc-700 shadow-2xl space-y-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-24 h-1.5 bg-accent-light/20"></div>
            
            <LatexText text={currentQuestion.text} className="text-2xl md:text-3xl font-black leading-snug tracking-tight text-zinc-900 dark:text-zinc-50" />
            
            {showHint && !evaluation && (
                <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-800/30 flex items-start gap-4 animate-fadeIn">
                    <span className="text-2xl">💡</span>
                    <div>
                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Conceptual Hint</p>
                        <LatexText text={currentQuestion.hint} className="text-sm font-bold leading-relaxed opacity-80" />
                    </div>
                </div>
            )}

            {!evaluation ? (
                currentQuestion.type === 'MCQ' ? (
                  <div className="grid gap-5">
                    {currentQuestion.options?.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSubmit(undefined, option)}
                        disabled={loading}
                        className="group w-full p-6 text-left rounded-3xl border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 hover:border-accent-light hover:bg-accent-light/5 transition-all flex items-center gap-5 active:scale-[0.98] disabled:opacity-50"
                      >
                        <div className="w-10 h-10 min-w-[40px] rounded-2xl border border-zinc-200 dark:border-zinc-600 flex items-center justify-center font-black text-sm opacity-30 group-hover:bg-accent-light group-hover:text-white group-hover:opacity-100 transition-all">
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <LatexText text={option} className="font-bold text-lg text-zinc-800 dark:text-zinc-100 leading-tight" />
                      </button>
                    ))}
                    <button 
                      type="button" 
                      onClick={() => setShowHint(true)} 
                      className="mt-6 text-[10px] font-black opacity-30 hover:opacity-100 transition-all uppercase tracking-[0.3em] text-center"
                    >
                      Retrieve Context Hint
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="relative group">
                          <textarea value={userAnswer} onChange={e => setUserAnswer(e.target.value)} placeholder="Formulate your response..." className="w-full p-6 min-h-[180px] rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-all text-lg font-semibold group-hover:shadow-lg" />
                          <button type="button" onClick={() => onSpeak(setUserAnswer)} className="absolute right-5 bottom-5 p-4 bg-white dark:bg-zinc-800 rounded-2xl text-accent-light hover:scale-110 active:scale-90 transition-all shadow-xl border dark:border-zinc-700" title="Voice Input">{ICONS.Mic}</button>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4">
                          <button type="button" onClick={() => setShowHint(true)} className="px-8 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95">Hint</button>
                          <button disabled={loading || !userAnswer} className="flex-1 py-4 bg-accent-light text-white font-black text-sm uppercase tracking-widest rounded-2xl disabled:opacity-50 shadow-[0_15px_30px_rgba(66,133,244,0.2)] hover:-translate-y-1 transition-all">
                            {loading ? "Analysing Synthesis..." : "Finalise Answer"}
                          </button>
                      </div>
                  </form>
                )
            ) : (
                <div className={`p-8 md:p-12 rounded-[3.5rem] border animate-fadeIn ${evaluation.status === 'CORRECT' ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/10 dark:border-emerald-800 dark:text-emerald-300' : evaluation.status === 'PARTIAL' ? 'bg-orange-50/50 border-orange-200 text-orange-900 dark:bg-orange-900/10 dark:border-orange-800 dark:text-orange-300' : 'bg-rose-50/50 border-rose-200 text-rose-900 dark:bg-rose-900/10 dark:border-rose-800 dark:text-rose-300'}`}>
                    <div className="flex items-center justify-between mb-8 border-b border-zinc-200/20 pb-8">
                        <span className="text-3xl font-black tracking-tight uppercase italic">{evaluation.status === 'CORRECT' ? 'Mastery!' : evaluation.status === 'PARTIAL' ? 'Progressing' : 'Refinement Needed'}</span>
                        <div className="flex flex-col items-end">
                          <span className="text-5xl font-black tabular-nums">{evaluation.score}%</span>
                          <span className="text-[10px] font-black uppercase opacity-60 tracking-widest">Accuracy Vector</span>
                        </div>
                    </div>
                    
                    <LatexText text={evaluation.feedback} className="mb-10 text-xl font-bold leading-relaxed" />
                    
                    <div className="bg-white/80 dark:bg-zinc-900/60 p-8 rounded-[2.5rem] mb-10 space-y-10 border dark:border-zinc-800 shadow-sm backdrop-blur-sm">
                        <div className="space-y-3">
                            <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">Ground Truth</p>
                            <LatexText text={currentQuestion.correctAnswer} className="text-lg font-black text-zinc-900 dark:text-zinc-50" />
                        </div>
                        <div className="space-y-3 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                            <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">Conceptual Deep-Dive</p>
                            <LatexText text={currentQuestion.explanation} className="text-base leading-relaxed font-semibold opacity-70" />
                        </div>
                    </div>
                    
                    <button onClick={() => loadQuestion(topic, quizType)} className="w-full py-6 bg-accent-light text-white font-black text-sm uppercase tracking-[0.3em] rounded-3xl hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-[0.98]">Deploy Next Sequence</button>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizRoom;
