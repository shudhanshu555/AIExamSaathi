
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import React, { useEffect, useRef, useState } from 'react';
import { ICONS, SYSTEM_INSTRUCTION, TOOL_DECLARATIONS } from '../constants';

interface AssistantViewProps {
  onBack: () => void;
  onSpeak: (callback: (text: string) => void) => void;
  onSpeakText: (text: string) => Promise<number>;
  notesCount: number;
  quizCount: number;
}

// PCM Audio Utils
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
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

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
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
  const [isThinking, setIsThinking] = useState(false);
  const [statusText, setStatusText] = useState<string>("MIRRORING INACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [micActivity, setMicActivity] = useState(0);

  const [currentTurnUserText, setCurrentTurnUserText] = useState('');
  const [currentTurnAiText, setCurrentTurnAiText] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContexts = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTime = useRef<number>(0);
  
  const userTextBuffer = useRef('');
  const aiTextBuffer = useRef('');

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, currentTurnUserText, currentTurnAiText]);

  const handleAssistantToolCall = async (fc: any) => {
    let result = "ok";
    // In this view, we primarily provide feedback to the session and let App.tsx handle navigation if possible,
    // or trigger it directly via window.location / shared state.
    // For now, we perform local simulation of the navigation.
    console.debug("AssistantView Tool Call:", fc.name);
    
    // We send back a response to keep the session alive and updated
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then((session: any) => {
            session.sendToolResponse({
                functionResponses: { id: fc.id, name: fc.name, response: { result } }
            });
        });
    }
  };

  const stopLiveSession = async () => {
    setStatusText("STOPPING...");
    
    sources.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sources.current.clear();
    nextStartTime.current = 0;

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

    setIsLive(false);
    setIsSpeaking(false);
    setIsThinking(false);
    setStatusText("MIRRORING INACTIVE");
    setMicActivity(0);
  };

  const handleManualBack = async () => {
    await stopLiveSession();
    onBack();
  };

  const startLiveSession = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API not supported.");
      }

      setError(null);
      setIsLive(true);
      setStatusText("INITIALIZING...");
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      
      if (!audioContexts.current) {
        audioContexts.current = {
          input: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 }),
          output: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }),
        };
      }

      if (audioContexts.current.input.state === 'suspended') await audioContexts.current.input.resume();
      if (audioContexts.current.output.state === 'suspended') await audioContexts.current.output.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      streamRef.current = stream;
      
      setStatusText("CONNECTING...");

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION + `\n\nStudent Statistics: ${notesCount} notes, ${quizCount} quizes.`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        },
        callbacks: {
          onopen: () => {
            setStatusText("ACTIVE");
            const source = audioContexts.current!.input.createMediaStreamSource(stream);
            const scriptProcessor = audioContexts.current!.input.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (e) => {
              // CRITICAL: Solely rely on sessionPromise resolution, no state checks
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
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) handleAssistantToolCall(fc);
            }

            // Audio Playback
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              setIsThinking(false);
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
              source.onended = () => {
                sources.current.delete(source);
                if (sources.current.size === 0) setIsSpeaking(false);
              };
            }

            if (message.serverContent?.inputTranscription) {
              userTextBuffer.current += message.serverContent.inputTranscription.text;
              setCurrentTurnUserText(userTextBuffer.current);
              setIsThinking(true); 
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
              }
              userTextBuffer.current = '';
              aiTextBuffer.current = '';
              setCurrentTurnUserText('');
              setCurrentTurnAiText('');
              setIsThinking(false);
            }

            if (message.serverContent?.interrupted) {
              sources.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sources.current.clear();
              nextStartTime.current = 0;
              setIsSpeaking(false);
              setIsThinking(false);
            }
          },
          onerror: (e) => {
            console.error('Gemini Live API Error:', e);
            setError("Connection issue detected.");
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
      setError("Could not access microphone.");
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
          <button onClick={handleManualBack} className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:scale-105 transition-transform border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
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
          {(isSpeaking || isThinking) && (
            <div className={`flex items-center gap-1.5 px-4 py-2 ${isThinking ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800' : 'bg-cyan-100 dark:bg-cyan-900/40 border-cyan-200 dark:border-cyan-800'} rounded-full animate-fadeIn border`}>
              <div className="flex gap-0.5 items-end h-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`w-1 ${isThinking ? 'bg-amber-600 dark:bg-amber-400 animate-pulse' : 'bg-cyan-600 dark:bg-cyan-400 animate-voiceWaveMini'} rounded-full`} style={{ animationDelay: `${i * 0.1}s` }}></div>
                ))}
              </div>
              <span className={`text-[10px] font-bold ${isThinking ? 'text-amber-600 dark:text-amber-400' : 'text-cyan-600 dark:text-cyan-400'} uppercase tracking-widest`}>
                {isThinking ? 'Thinking' : 'Speaking'}
              </span>
            </div>
          )}
          {isLive && (
            <div className="hidden md:flex items-center gap-1 h-4 px-3 bg-zinc-100 dark:bg-zinc-800 rounded-full">
              <div className="text-[8px] font-bold text-zinc-400 uppercase mr-1">Mic</div>
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
            {isLive ? "Stop Session" : "Start Voice Hub"}
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

        {isLive && !currentTurnUserText && !currentTurnAiText && !isSpeaking && (
           <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-4">
              <div className="flex gap-1 items-end h-8">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-1.5 bg-cyan-500 rounded-full animate-voiceWave" style={{ height: '30%', animationDelay: `${i * 0.1}s` }}></div>
                ))}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Listening...</p>
           </div>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center">
        {error && (
          <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl animate-pulse">
            <p className="text-rose-500 text-xs font-black uppercase tracking-wider">⚠️ {error}</p>
          </div>
        )}
        <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.5em]">Linguistic Mirroring Active</p>
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
