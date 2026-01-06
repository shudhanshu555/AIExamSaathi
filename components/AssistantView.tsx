
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import React, { useEffect, useRef, useState } from 'react';
import { ICONS, SYSTEM_INSTRUCTION } from '../constants';

interface AssistantViewProps {
  onBack: () => void;
  onSpeak: (callback: (text: string) => void) => void;
  onSpeakText: (text: string) => Promise<number>;
  notesCount: number;
  quizCount: number;
}

// PCM Audio Utils for Microphone Input
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
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

const AssistantView: React.FC<AssistantViewProps> = ({ onBack, onSpeak, onSpeakText, notesCount, quizCount }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string; }[]>([
    { role: 'ai', text: "Namaste! I'm ExamSaathi. I'm ready to help you with your studies. Just start speaking!" }
  ]);
  const [isLive, setIsLive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusText, setStatusText] = useState<string>("MIRRORING INACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [micActivity, setMicActivity] = useState(0);

  const [currentTurnUserText, setCurrentTurnUserText] = useState('');
  const [currentTurnAiText, setCurrentTurnAiText] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContexts = useRef<{ input: AudioContext } | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const userTextBuffer = useRef('');
  const aiTextBuffer = useRef('');
  const speakTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, currentTurnUserText, currentTurnAiText]);

  // Handle automatic speaking with visual state management
  const speak = async (text: string) => {
    if (!text) return;
    setIsSpeaking(true);
    if (speakTimeoutRef.current) window.clearTimeout(speakTimeoutRef.current);
    
    const duration = await onSpeakText(text);
    
    // Duration is in seconds, set timeout to clear speaking state
    speakTimeoutRef.current = window.setTimeout(() => {
      setIsSpeaking(false);
    }, duration * 1000);
  };

  // Speak initial greeting on mount
  useEffect(() => {
    const timer = setTimeout(() => speak(messages[0].text), 1000);
    return () => {
      clearTimeout(timer);
      if (speakTimeoutRef.current) window.clearTimeout(speakTimeoutRef.current);
    };
  }, []);

  const stopLiveSession = async () => {
    setStatusText("STOPPING...");
    
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {}
      sessionPromiseRef.current = null;
    }

    if (audioContexts.current) {
      try { await audioContexts.current.input.suspend(); } catch (e) {}
    }

    setIsLive(false);
    setStatusText("MIRRORING INACTIVE");
    setMicActivity(0);
  };

  const startLiveSession = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API not supported in this browser.");
      }

      setError(null);
      setIsLive(true);
      setStatusText("INITIALIZING...");
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      
      if (!audioContexts.current) {
        audioContexts.current = {
          input: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 }),
        };
      }

      if (audioContexts.current.input.state === 'suspended') await audioContexts.current.input.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      streamRef.current = stream;
      
      setStatusText("CONNECTING...");

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO], // We use audio modality for native processing but trigger TTS on text
          systemInstruction: `${SYSTEM_INSTRUCTION}\n\nContext: Student has generated ${notesCount} notes and attempted ${quizCount} questions.`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatusText("ACTIVE");
            const source = audioContexts.current!.input.createMediaStreamSource(stream);
            const scriptProcessor = audioContexts.current!.input.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i];
              setMicActivity(Math.sqrt(sum / inputData.length));

              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContexts.current!.input.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              userTextBuffer.current += message.serverContent.inputTranscription.text;
              setCurrentTurnUserText(userTextBuffer.current);
            }

            if (message.serverContent?.outputTranscription) {
              aiTextBuffer.current += message.serverContent.outputTranscription.text;
              setCurrentTurnAiText(aiTextBuffer.current);
            }

            if (message.serverContent?.turnComplete) {
              const uText = userTextBuffer.current.trim();
              const aText = aiTextBuffer.current.trim();
              if (uText || aText) {
                setMessages(prev => [
                  ...prev, 
                  ...(uText ? [{ role: 'user' as const, text: uText }] : []),
                  ...(aText ? [{ role: 'ai' as const, text: aText }] : [])
                ]);
                
                // Automatically speak the final AI response text
                if (aText) speak(aText);
              }
              userTextBuffer.current = '';
              aiTextBuffer.current = '';
              setCurrentTurnUserText('');
              setCurrentTurnAiText('');
            }

            if (message.serverContent?.interrupted) {
              // Clear current TTS if interrupted
              if (speakTimeoutRef.current) window.clearTimeout(speakTimeoutRef.current);
              setIsSpeaking(false);
            }
          },
          onerror: (e) => {
            console.error('Gemini Live API Error:', e);
            setError("Connection issue. Please check your mic permissions and network.");
            stopLiveSession();
          },
          onclose: () => {
            setIsLive(false);
            setStatusText("MIRRORING INACTIVE");
          },
        },
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err: any) {
      console.error("Failed to start live session:", err);
      setError(err.message || "Could not start voice session.");
      setIsLive(false);
      setStatusText("MIRRORING INACTIVE");
    }
  };

  const toggleLiveMode = () => {
    if (isLive) stopLiveSession();
    else startLiveSession();
  };

  useEffect(() => {
    return () => { stopLiveSession(); };
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-4xl mx-auto animate-fadeIn px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-5">
          <button onClick={onBack} className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:scale-105 transition-transform border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
            {ICONS.Back}
          </button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tight">AI Companion</h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-700'}`}></div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${isLive ? 'text-green-600' : 'text-zinc-400'}`}>{statusText}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isSpeaking && (
            <div className="flex items-center gap-1.5 px-4 py-2 bg-cyan-100 dark:bg-cyan-900/40 rounded-full animate-fadeIn border border-cyan-200 dark:border-cyan-800">
              <div className="flex gap-0.5 items-end h-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-1 bg-cyan-600 dark:bg-cyan-400 rounded-full animate-voiceWaveMini" style={{ animationDelay: `${i * 0.1}s` }}></div>
                ))}
              </div>
              <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">Speaking</span>
            </div>
          )}
          {isLive && (
            <div className="hidden md:flex items-center gap-1 h-4 px-3 bg-zinc-100 dark:bg-zinc-800 rounded-full">
              <div className="text-[8px] font-bold text-zinc-400 uppercase mr-1">Mic Level</div>
              <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-75" 
                  style={{ width: `${Math.min(100, micActivity * 500)}%` }}
                ></div>
              </div>
            </div>
          )}
          <button 
            onClick={toggleLiveMode}
            className={`flex items-center gap-3 px-8 py-3 rounded-full font-black text-sm uppercase tracking-wider transition-all shadow-lg ${
              isLive ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-cyan-600 text-white shadow-cyan-600/20 hover:scale-105'
            }`}
          >
            {isLive ? (
              <><div className="w-2 h-2 bg-white rounded-full animate-ping"></div> Stop Session</>
            ) : (
              <>{ICONS.Mic} Start Voice Hub</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/50 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-inner p-10 space-y-8 custom-scrollbar" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
            <div className={`max-w-[85%] p-6 rounded-[2.5rem] text-lg leading-relaxed shadow-sm relative group ${
              m.role === 'user' 
                ? 'bg-cyan-600 text-white rounded-tr-none' 
                : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-tl-none border border-zinc-200 dark:border-zinc-700'
            }`}>
              {m.text}
              {m.role === 'ai' && (
                <button 
                  onClick={() => speak(m.text)}
                  className="absolute -right-12 top-2 p-3 bg-white dark:bg-zinc-800 rounded-full border dark:border-zinc-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-cyan-600 hover:text-white"
                >
                  {ICONS.Sound}
                </button>
              )}
            </div>
          </div>
        ))}
        
        {(currentTurnUserText || currentTurnAiText) && (
          <div className="space-y-6 pt-6 border-t dark:border-zinc-800 mt-6 animate-fadeIn">
            {currentTurnUserText && (
              <div className="flex justify-end opacity-50 italic">
                <div className="max-w-[70%] bg-zinc-200 dark:bg-zinc-700 p-4 rounded-3xl rounded-tr-none text-sm">
                  "{currentTurnUserText}"
                </div>
              </div>
            )}
            {currentTurnAiText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800 p-6 rounded-[2.5rem] rounded-tl-none text-lg">
                  {currentTurnAiText}
                </div>
              </div>
            )}
          </div>
        )}

        {isLive && !currentTurnUserText && !currentTurnAiText && (
           <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-4">
              <div className="flex gap-1 items-end h-8">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-1.5 bg-cyan-500 rounded-full animate-voiceWave" style={{ height: '30%', animationDelay: `${i * 0.1}s` }}></div>
                ))}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">ExamSaathi is Listening</p>
           </div>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center">
        {error && (
          <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl animate-pulse">
            <p className="text-rose-500 text-xs font-black uppercase tracking-wider">⚠️ {error}</p>
          </div>
        )}
        <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.5em]">Real-Time Linguistic Mirroring Active</p>
      </div>

      <style>{`
        @keyframes voiceWave { 0%, 100% { height: 30%; } 50% { height: 90%; } }
        @keyframes voiceWaveMini { 0%, 100% { height: 40%; } 50% { height: 100%; } }
        .animate-voiceWave { animation: voiceWave 0.8s infinite ease-in-out; }
        .animate-voiceWaveMini { animation: voiceWaveMini 0.6s infinite ease-in-out; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AssistantView;
