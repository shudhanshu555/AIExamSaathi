
import React, { useState, useEffect, useCallback } from 'react';
import { generateQuizQuestion, evaluateAnswer } from '../services/geminiService';
import { QuizQuestion, QuizAttempt } from '../types';
import { ICONS } from '../constants';

interface QuizRoomProps {
  onBack: () => void;
  onRecordResult: (attempt: QuizAttempt) => void;
  onSpeak: (callback: (text: string) => void) => void;
  onSpeakText: (text: string) => void;
}

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
      // If it's an MCQ, we can often evaluate locally, but let's use the same LLM service for consistency in feedback.
      const evalResult = await evaluateAnswer(currentQuestion.text, currentQuestion.correctAnswer, answerToEval);
      setEvaluation(evalResult);
      onRecordResult({
        questionId: currentQuestion.id,
        userAnswer: answerToEval,
        status: evalResult.status,
        timestamp: Date.now()
      });
      onSpeakText(`${evalResult.status}! ${evalResult.feedback}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReadQuestion = () => {
    if (currentQuestion) {
        onSpeakText(currentQuestion.text);
    }
  };

  if (!isStarted) {
    return (
      <div className="max-w-xl mx-auto py-20 animate-fadeIn">
        <h1 className="text-3xl font-bold mb-6 text-center">Ready for Revision? 🎯</h1>
        <form onSubmit={startQuiz} className="bg-white dark:bg-zinc-800 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-xl space-y-6">
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl">
            <button 
              type="button"
              onClick={() => setQuizType('MCQ')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${quizType === 'MCQ' ? 'bg-white dark:bg-zinc-800 shadow-sm text-accent-light' : 'opacity-50'}`}
            >
              Multiple Choice
            </button>
            <button 
              type="button"
              onClick={() => setQuizType('OPEN_ENDED')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${quizType === 'OPEN_ENDED' ? 'bg-white dark:bg-zinc-800 shadow-sm text-accent-light' : 'opacity-50'}`}
            >
              Classic (Type)
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 opacity-70">Study Topic</label>
            <div className="relative">
                <input required type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Thermodynamics, Indian History..." className="w-full p-4 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light" />
                <button type="button" onClick={() => onSpeak(setTopic)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent-light">{ICONS.Mic}</button>
            </div>
          </div>
          
          <button className="w-full py-4 bg-accent-light text-white font-bold rounded-2xl hover:shadow-lg transition-all">Start Revision Session</button>
          <button type="button" onClick={onBack} className="w-full py-2 text-sm opacity-50 hover:opacity-100">Go Back</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">{ICONS.Back}</button>
        <div className="flex flex-col items-center">
          <span className="bg-accent-light/10 text-accent-light px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">{quizType === 'MCQ' ? 'MCQ Challenge' : 'Open Response'}</span>
          <span className="text-sm font-bold mt-1">{topic}</span>
        </div>
        <button onClick={handleReadQuestion} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-accent-light">{ICONS.Sound}</button>
      </div>

      {loading && !currentQuestion ? (
        <div className="text-center py-20 space-y-4">
            <div className="animate-spin h-10 w-10 border-4 border-accent-light border-t-transparent rounded-full mx-auto"></div>
            <p className="font-medium animate-pulse">ExamSaathi is crafting your challenge...</p>
        </div>
      ) : currentQuestion && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-800 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-700 shadow-sm space-y-8">
            <h2 className="text-2xl font-bold leading-relaxed">{currentQuestion.text}</h2>
            
            {showHint && !evaluation && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-100 dark:border-yellow-800 flex items-start gap-3 animate-fadeIn">
                    <span className="text-xl">💡</span>
                    <div>
                        <p className="text-sm font-bold text-yellow-800 dark:text-yellow-400 uppercase tracking-tighter">Study Tip</p>
                        <p className="text-sm opacity-80">{currentQuestion.hint}</p>
                    </div>
                </div>
            )}

            {!evaluation ? (
                currentQuestion.type === 'MCQ' ? (
                  <div className="grid gap-4">
                    {currentQuestion.options?.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSubmit(undefined, option)}
                        disabled={loading}
                        className="group w-full p-5 text-left rounded-2xl border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 hover:border-accent-light hover:bg-accent-light/5 transition-all flex items-center gap-4 active:scale-[0.98] disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-600 flex items-center justify-center font-bold text-xs opacity-40 group-hover:bg-accent-light group-hover:text-white group-hover:opacity-100 transition-all">
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200">{option}</span>
                      </button>
                    ))}
                    <button 
                      type="button" 
                      onClick={() => setShowHint(true)} 
                      className="mt-4 text-xs font-bold opacity-40 hover:opacity-100 transition-all"
                    >
                      Need a hint?
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="relative">
                          <textarea value={userAnswer} onChange={e => setUserAnswer(e.target.value)} placeholder="Type or speak your answer here..." className="w-full p-4 min-h-[150px] rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-accent-light transition-all" />
                          <button type="button" onClick={() => onSpeak(setUserAnswer)} className="absolute right-4 bottom-4 p-3 bg-zinc-200 dark:bg-zinc-700 rounded-full text-accent-light hover:scale-110 transition-transform shadow-md" title="Speak Answer">{ICONS.Mic}</button>
                      </div>
                      <div className="flex gap-4">
                          <button type="button" onClick={() => setShowHint(true)} className="px-6 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-700 font-bold hover:bg-zinc-200 transition-all">Hint</button>
                          <button disabled={loading || !userAnswer} className="flex-1 py-4 bg-accent-light text-white font-bold rounded-2xl disabled:opacity-50 shadow-lg shadow-accent-light/20">{loading ? "Evaluating..." : "Submit Answer"}</button>
                      </div>
                  </form>
                )
            ) : (
                <div className={`p-8 rounded-[2rem] border animate-fadeIn ${evaluation.status === 'CORRECT' ? 'bg-green-50/50 border-green-200 text-green-900 dark:bg-green-900/10 dark:border-green-800 dark:text-green-300' : evaluation.status === 'PARTIAL' ? 'bg-orange-50/50 border-orange-200 text-orange-900 dark:bg-orange-900/10 dark:border-orange-800 dark:text-orange-300' : 'bg-red-50/50 border-red-200 text-red-900 dark:bg-red-900/10 dark:border-red-800 dark:text-red-300'}`}>
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-2xl font-black tracking-tight">{evaluation.status === 'CORRECT' ? '✨ Excellent!' : evaluation.status === 'PARTIAL' ? '⚖️ Getting There' : '🎯 Practice More'}</span>
                        <div className="flex flex-col items-end">
                          <span className="text-3xl font-black">{evaluation.score}%</span>
                          <span className="text-[10px] font-bold uppercase opacity-60">Accuracy Score</span>
                        </div>
                    </div>
                    <p className="mb-6 text-lg font-medium leading-relaxed">{evaluation.feedback}</p>
                    <div className="bg-white/80 dark:bg-zinc-800 p-6 rounded-2xl mb-8 space-y-6 border dark:border-zinc-700 shadow-sm">
                        <div>
                            <p className="text-[10px] font-black opacity-40 uppercase mb-2 tracking-widest">Model Answer</p>
                            <p className="font-bold text-zinc-800 dark:text-zinc-100">{currentQuestion.correctAnswer}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black opacity-40 uppercase mb-2 tracking-widest">Deep Explanation</p>
                            <p className="text-sm leading-relaxed opacity-80">{currentQuestion.explanation}</p>
                        </div>
                    </div>
                    <button onClick={() => loadQuestion(topic, quizType)} className="w-full py-5 bg-accent-light text-white font-black rounded-2xl hover:shadow-xl transition-all active:scale-[0.98]">Next Challenge</button>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizRoom;
