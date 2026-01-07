
import React, { useState, useEffect, useRef } from 'react';
import { AppState, View, Theme, Note, QuizAttempt, StudyPlan } from './types';
import Dashboard from './components/Dashboard';
import NotesGenerator from './components/NotesGenerator';
import QuizRoom from './components/QuizRoom';
import HistoryView from './components/HistoryView';
import StudyPlanGenerator from './components/StudyPlanGenerator';
import PomodoroTimer from './components/PomodoroTimer';
import AssistantView from './components/AssistantView'; 
import { ICONS, SYSTEM_INSTRUCTION, TOOL_DECLARATIONS } from './constants';
import { getMotivation, chatWithAssistant, generateSpeech } from './services/geminiService';
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';

// --- PCM Audio Utils ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
// --- End Audio Utils ---

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    view: View.DASHBOARD,
    theme: Theme.LIGHT,
    notes: [],
    quizHistory: [],
    studyPlans: [],
    streak: 1,
    lastActive: Date.now()
  });

  const [motivationMsg, setMotivationMsg] = useState<string | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantMode, setAssistantMode] = useState<'CHAT' | 'VOICE'>('CHAT');
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Voice State Refs
  const audioContexts = useRef<{ input: AudioContext; output: AudioContext; tts: AudioContext } | null>(null);
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTime = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceTranscription, setVoiceTranscription] = useState<{ user: string; ai: string }>({ user: '', ai: '' });

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('examsaathi_state');
    if (saved) {
      try {
          const parsed = JSON.parse(saved);
          setState(prev => ({ ...prev, ...parsed }));
      } catch (e) {
          console.error("Failed to load state", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('examsaathi_state', JSON.stringify(state));
    if (state.theme === Theme.DARK) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state]);

  const toggleTheme = () => {
    setState(prev => ({ ...prev, theme: prev.theme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT }));
  };

  const setView = (view: View) => {
    if (view !== View.AI_ASSISTANT) {
        stopVoiceSession();
    }
    setState(prev => ({ ...prev, view }));
  }

  const handleSaveNote = (note: Note) => {
    setState(prev => ({ ...prev, notes: [...prev.notes, note], view: View.DASHBOARD }));
  };

  const handleRecordQuizResult = (attempt: QuizAttempt) => {
    setState(prev => ({ ...prev, quizHistory: [...prev.quizHistory, attempt] }));
  };

  const handleSavePlan = (plan: StudyPlan) => {
    setState(prev => ({ ...prev, studyPlans: [...prev.studyPlans, plan], view: View.DASHBOARD }));
  };

  const handleQuickAction = async (action: string) => {
    if (action === 'MOTIVATION') {
        const msg = await getMotivation('Neutral but needs a boost', `Has generated ${state.notes.length} notes and solved ${state.quizHistory.length} questions.`);
        setMotivationMsg(msg);
    } else if (action === 'OPEN_ASSISTANT') {
        setIsAssistantOpen(true);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    const userMsg = chatMsg;
    setChatMsg('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);
    try {
        const response = await chatWithAssistant(userMsg, {
            notesCount: state.notes.length,
            quizCount: state.quizHistory.length,
            plansCount: state.studyPlans.length,
            persona: "Study Companion"
        });
        setChatHistory(prev => [...prev, { role: 'ai', text: response }]);
    } catch (err) {
        setChatHistory(prev => [...prev, { role: 'ai', text: "I'm having a bit of trouble connecting." }]);
    } finally {
        setChatLoading(false);
    }
  };

  const handleSpeakText = async (text: string): Promise<number> => {
    try {
      if (!audioContexts.current?.tts) {
        audioContexts.current = {
          ...audioContexts.current!,
          tts: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })
        };
      }
      const ttsCtx = audioContexts.current.tts;
      if (ttsCtx.state === 'suspended') await ttsCtx.resume();
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        const audioBuffer = await decodeAudioData(decode(base64Audio), ttsCtx, 24000, 1);
        const source = ttsCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ttsCtx.destination);
        source.start();
        return audioBuffer.duration;
      }
    } catch (err: any) {
      console.error("TTS Error:", err);
    }
    return 0;
  };

  const handleAssistantToolCall = async (fc: any) => {
    let result = "ok";
    switch (fc.name) {
      case 'generate_notes': setView(View.NOTES_GENERATOR); break;
      case 'start_quiz': setView(View.QUIZ); break;
      case 'show_history': setView(View.HISTORY); break;
      case 'set_pomodoro': setView(View.POMODORO); break;
      case 'get_motivation': handleQuickAction('MOTIVATION'); break;
      case 'go_home': setView(View.DASHBOARD); break;
      default: result = "Unknown tool.";
    }
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then((session: any) => {
            session.sendToolResponse({
                functionResponses: { id: fc.id, name: fc.name, response: { result } }
            });
        });
    }
  };

  const startVoiceSession = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      if (!audioContexts.current?.input || !audioContexts.current?.output) {
        audioContexts.current = {
          ...audioContexts.current!,
          input: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 }),
          output: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }),
        };
      }
      if (audioContexts.current.input.state === 'suspended') await audioContexts.current.input.resume();
      if (audioContexts.current.output.state === 'suspended') await audioContexts.current.output.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: SYSTEM_INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }]
        },
        callbacks: {
          onopen: () => {
            setIsVoiceActive(true);
            const source = audioContexts.current!.input.createMediaStreamSource(stream);
            const scriptProcessor = audioContexts.current!.input.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              // CRITICAL: Solely rely on sessionPromise resolution
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session: any) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContexts.current!.input.destination);
            (window as any)._scriptProcessor = scriptProcessor;
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) handleAssistantToolCall(fc);
            }
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const outCtx = audioContexts.current!.output;
              if (outCtx.state === 'suspended') await outCtx.resume();
              nextStartTime.current = Math.max(nextStartTime.current, outCtx.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outCtx.destination);
              source.start(nextStartTime.current);
              nextStartTime.current += buffer.duration;
              sources.current.add(source);
              source.onended = () => sources.current.delete(source);
            }
            if (message.serverContent?.inputTranscription) {
              setVoiceTranscription(prev => ({ ...prev, user: message.serverContent?.inputTranscription?.text || '' }));
            }
            if (message.serverContent?.outputTranscription) {
              setVoiceTranscription(prev => ({ ...prev, ai: (prev.ai + (message.serverContent?.outputTranscription?.text || '')) }));
            }
            if (message.serverContent?.turnComplete) {
              setVoiceTranscription({ user: '', ai: '' });
            }
            if (message.serverContent?.interrupted) {
              sources.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sources.current.clear();
              nextStartTime.current = 0;
            }
          },
          onerror: (e) => stopVoiceSession(),
          onclose: () => setIsVoiceActive(false),
        },
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      setIsVoiceActive(false);
    }
  };

  const stopVoiceSession = () => {
    setIsVoiceActive(false);
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then((s: any) => { try { s.close(); } catch(e) {} });
      sessionPromiseRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if ((window as any)._scriptProcessor) {
        (window as any)._scriptProcessor.disconnect();
        (window as any)._scriptProcessor = null;
    }
    sources.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sources.current.clear();
    setVoiceTranscription({ user: '', ai: '' });
  };

  useEffect(() => {
    const isFullAssistantActive = state.view === View.AI_ASSISTANT;
    if (isAssistantOpen && assistantMode === 'VOICE' && !isFullAssistantActive) {
      startVoiceSession();
    } else {
      stopVoiceSession();
    }
    return () => stopVoiceSession();
  }, [isAssistantOpen, assistantMode, state.view]);

  const startSTT = (callback: (text: string) => void) => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.onresult = (event: any) => {
          callback(event.results[0][0].transcript);
      };
      recognition.start();
  };

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300">
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView(View.DASHBOARD)}>
                <div className="bg-accent-light p-2 rounded-xl text-white shadow-lg">
                    <span className="text-xl font-bold">ES</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight">ExamSaathi</h1>
            </div>
            <button onClick={toggleTheme} className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                {ICONS.Theme}
            </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {state.view === View.DASHBOARD && <Dashboard state={state} setView={setView} onQuickAction={handleQuickAction} />}
        {state.view === View.NOTES_GENERATOR && <NotesGenerator onBack={() => setView(View.DASHBOARD)} onSave={handleSaveNote} onSpeak={startSTT} onSpeakText={handleSpeakText} />}
        {state.view === View.QUIZ && <QuizRoom onBack={() => setView(View.DASHBOARD)} onRecordResult={handleRecordQuizResult} onSpeak={startSTT} onSpeakText={handleSpeakText} />}
        {state.view === View.HISTORY && <HistoryView notes={state.notes} quizHistory={state.quizHistory} onBack={() => setView(View.DASHBOARD)} />}
        {state.view === View.PLANNER && <StudyPlanGenerator onBack={() => setView(View.DASHBOARD)} onSave={handleSavePlan} onSpeak={startSTT} />}
        {state.view === View.POMODORO && <PomodoroTimer onBack={() => setView(View.DASHBOARD)} />}
        {state.view === View.AI_ASSISTANT && <AssistantView onBack={() => setView(View.DASHBOARD)} onSpeak={startSTT} onSpeakText={handleSpeakText} notesCount={state.notes.length} quizCount={state.quizHistory.length} />}
      </main>

      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4">
          {isAssistantOpen && (
              <div className="w-80 md:w-96 h-[600px] bg-white dark:bg-zinc-800 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-700 flex flex-col overflow-hidden animate-slideInUp">
                  <header className="p-6 bg-cyan-600 text-white flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isVoiceActive ? 'bg-green-300 animate-pulse' : 'bg-white/50'}`}></div>
                        <span className="font-bold text-lg">Companion</span>
                      </div>
                      <button onClick={() => { setIsAssistantOpen(false); stopVoiceSession(); }} className="opacity-70 hover:opacity-100 p-2">✕</button>
                  </header>

                  <div className="flex p-2 bg-zinc-100 dark:bg-zinc-900 mx-6 mt-4 rounded-2xl">
                      <button onClick={() => setAssistantMode('VOICE')} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${assistantMode === 'VOICE' ? 'bg-white dark:bg-zinc-800 shadow-md text-cyan-600' : 'opacity-40'}`}>
                        {ICONS.Mic} Speak
                      </button>
                      <button onClick={() => setAssistantMode('CHAT')} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${assistantMode === 'CHAT' ? 'bg-white dark:bg-zinc-800 shadow-md text-cyan-600' : 'opacity-40'}`}>
                        {ICONS.Message} Write
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {assistantMode === 'VOICE' ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-fadeIn">
                            <div className={`w-24 h-24 rounded-full border-4 border-cyan-500 flex items-center justify-center relative bg-white dark:bg-zinc-800 z-10 ${isVoiceActive ? 'animate-pulse shadow-[0_0_50px_rgba(6,182,212,0.3)]' : ''}`}>
                                <div className="text-cyan-500">{ICONS.Message}</div>
                            </div>
                            <div className="w-full space-y-3 px-2">
                                {voiceTranscription.user && <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border text-xs italic">"{voiceTranscription.user}"</div>}
                                {voiceTranscription.ai && <div className="p-4 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 rounded-2xl border border-cyan-500/20 text-sm font-bold leading-relaxed">{voiceTranscription.ai}</div>}
                                {!voiceTranscription.user && !voiceTranscription.ai && <p className="text-xs opacity-40 font-medium">Listening for your questions...</p>}
                            </div>
                        </div>
                      ) : (
                        <>
                          {chatHistory.map((msg, i) => (
                              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[85%] p-4 rounded-3xl text-sm ${msg.role === 'user' ? 'bg-cyan-600 text-white rounded-tr-none' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 rounded-tl-none'}`}>
                                      {msg.text}
                                  </div>
                              </div>
                          ))}
                          {chatLoading && <div className="bg-zinc-100 dark:bg-zinc-700 p-3 rounded-2xl animate-pulse text-xs">ExamSaathi is typing...</div>}
                        </>
                      )}
                  </div>

                  {assistantMode === 'CHAT' && (
                    <form onSubmit={handleSendChat} className="p-6 border-t dark:border-zinc-700">
                        <div className="flex gap-2 bg-zinc-100 dark:bg-zinc-900 p-2 rounded-2xl">
                          <button type="button" onClick={() => startSTT(setChatMsg)} className="p-2 text-zinc-400 hover:text-cyan-600">{ICONS.Mic}</button>
                          <input type="text" value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Ask anything..." className="flex-1 p-3 bg-transparent outline-none text-sm" />
                          <button className="p-3 bg-cyan-600 text-white rounded-xl shadow-lg"><svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg></button>
                        </div>
                    </form>
                  )}
              </div>
          )}
          <button onClick={() => setIsAssistantOpen(!isAssistantOpen)} className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all ${isAssistantOpen ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800' : 'bg-cyan-600 text-white'}`}>
              {isAssistantOpen ? '✕' : ICONS.Message}
          </button>
      </div>

      {motivationMsg && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white dark:bg-zinc-800 max-w-lg w-full rounded-[3rem] shadow-2xl p-10 space-y-8 animate-scaleIn">
                  <div className="text-5xl text-center">🏆</div>
                  <p className="text-2xl font-serif italic opacity-90 leading-relaxed text-center">{motivationMsg}</p>
                  <button onClick={() => setMotivationMsg(null)} className="w-full py-5 bg-accent-light text-white font-black text-lg rounded-2xl shadow-xl transition-all">CHALO PADHTE HAIN! 💪</button>
              </div>
          </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-slideInUp { animation: slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-scaleIn { animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default App;
