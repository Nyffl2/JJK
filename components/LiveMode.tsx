import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, PhoneOff, Volume2, Loader2 } from 'lucide-react';
import { createPcmBlob, decodeAudioData } from '../utils/audio';
import { THANSIN_SYSTEM_INSTRUCTION, LIVE_MODEL } from '../utils/constants';

const LiveMode: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Model is speaking
  const [micActive, setMicActive] = useState(true);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  
  // Audio Contexts & Nodes
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const inputScriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null); // Use any for session because exact type is complex in prompt
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  // Initialize
  const startSession = async () => {
    setStatus('connecting');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      // Setup Output Audio
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputNodeRef.current = outputAudioContextRef.current!.createGain();
      outputNodeRef.current.connect(outputAudioContextRef.current!.destination);

      // Setup Input Audio
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // Kore is soft and suitable
          },
          systemInstruction: THANSIN_SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connected');
            setIsConnected(true);
            setStatus('connected');
            setupAudioInput(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            handleServerMessage(message);
          },
          onclose: () => {
            console.log('Gemini Live Closed');
            cleanup();
          },
          onerror: (err) => {
            console.error('Gemini Live Error', err);
            setStatus('error');
            cleanup();
          },
        },
      });

      sessionRef.current = sessionPromise;

    } catch (error) {
      console.error("Failed to start session:", error);
      setStatus('error');
    }
  };

  const setupAudioInput = (sessionPromise: Promise<any>) => {
    if (!inputAudioContextRef.current || !inputStreamRef.current) return;

    const source = inputAudioContextRef.current.createMediaStreamSource(inputStreamRef.current);
    const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
        if (!micActive) return; // Mute logic

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);
        
        sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
        });
    };

    source.connect(processor);
    processor.connect(inputAudioContextRef.current.destination);
    inputScriptProcessorRef.current = processor;
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
    const serverContent = message.serverContent;
    
    // Handle Audio Output
    if (serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
      const base64Audio = serverContent.modelTurn.parts[0].inlineData.data;
      if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
        setIsSpeaking(true);
        const ctx = outputAudioContextRef.current;
        
        // Sync timing
        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
        
        const audioBuffer = await decodeAudioData(base64Audio, ctx, 24000);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputNodeRef.current);
        
        source.addEventListener('ended', () => {
            audioSourcesRef.current.delete(source);
            if (audioSourcesRef.current.size === 0) {
                setIsSpeaking(false);
            }
        });

        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
        audioSourcesRef.current.add(source);
      }
    }

    // Handle Interruption
    if (serverContent?.interrupted) {
        console.log("Model interrupted by user");
        audioSourcesRef.current.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        setIsSpeaking(false);
    }
  };

  const cleanup = () => {
    setIsConnected(false);
    setStatus('idle');
    setIsSpeaking(false);
    
    // Stop all audio sources
    audioSourcesRef.current.forEach(s => {
        try { s.stop(); } catch(e) {}
    });
    audioSourcesRef.current.clear();

    // Close contexts
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    inputStreamRef.current?.getTracks().forEach(track => track.stop());
    inputScriptProcessorRef.current?.disconnect();

    // Reset refs
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    inputStreamRef.current = null;
    inputScriptProcessorRef.current = null;
  };

  const handleEndCall = async () => {
      if (sessionRef.current) {
          // LiveClient doesn't have a direct close method on the promise itself, 
          // usually we close via the session object if available, but the library manages connection.
          // Since we can't force close easily without the session object resolving, 
          // we rely on just cleaning up local resources which kills the stream interaction.
          // If the library exposes a close, we use it.
          // Based on prompts, session.close() is valid if we have the session object.
          try {
             const session = await sessionRef.current;
             // session.close() might not exist on the type returned by connect in all versions, 
             // but assuming per instructions it does.
             // If not, simply cleaning up local streams is often enough to 'end' the user experience.
             // The prompt says "When conversation is finished, use session.close()".
             // However, sessionRef.current is a Promise that resolves to session.
             // We need to wait for it.
             session.close(); 
          } catch (e) {
              console.warn("Could not close session gracefully", e);
          }
      }
      cleanup();
  };

  // Toggle Mic
  const toggleMic = () => {
      setMicActive(!micActive);
  };

  // Start call on mount (optional, or wait for user)
  // Let's require user action to start for better UX
  
  return (
    <div className="flex flex-col h-full items-center justify-center bg-gradient-to-b from-pink-50 to-white relative overflow-hidden">
      
      {/* Background Decor */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${isSpeaking ? 'opacity-30' : 'opacity-10'}`}>
         <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
         <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-rose-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
      </div>

      <div className="z-10 flex flex-col items-center gap-8 w-full max-w-xs">
        
        {/* Status Indicator */}
        <div className="text-pink-400 font-medium text-sm h-6">
            {status === 'connecting' && <span className="flex items-center gap-2"><Loader2 className="animate-spin w-4 h-4"/> Connecting to Thansin...</span>}
            {status === 'connected' && <span className="flex items-center gap-2 animate-pulse">● Connected</span>}
            {status === 'error' && <span className="text-red-400">Connection Failed</span>}
        </div>

        {/* Avatar / Visualizer */}
        <div className="relative">
            {/* Ripple Effect when speaking */}
            {isSpeaking && (
                <>
                    <div className="absolute inset-0 rounded-full border-4 border-pink-200 animate-ping opacity-75"></div>
                    <div className="absolute -inset-4 rounded-full border border-pink-100 animate-pulse opacity-50"></div>
                </>
            )}
            
            <div className={`w-40 h-40 rounded-full overflow-hidden border-4 shadow-2xl transition-all duration-300 ${isSpeaking ? 'border-pink-500 scale-105' : 'border-white scale-100'}`}>
                <img src="https://picsum.photos/id/64/400/400" alt="Thansin" className="w-full h-full object-cover" />
            </div>
            
            {status === 'idle' && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-[1px]">
                    <span className="text-white font-semibold">Tap Call</span>
                </div>
            )}
        </div>

        <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Thansin</h2>
            <p className="text-gray-500 text-sm mt-1">{isSpeaking ? 'Speaking...' : isConnected ? 'Listening...' : 'Ready to call'}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6 mt-4">
            {status === 'idle' || status === 'error' ? (
                <button 
                    onClick={startSession}
                    className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-200 hover:bg-green-600 transition-all hover:scale-110 active:scale-95"
                >
                    <Volume2 size={32} />
                </button>
            ) : (
                <>
                    <button 
                        onClick={toggleMic}
                        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all ${
                            micActive ? 'bg-white text-gray-700 hover:bg-gray-50' : 'bg-white text-red-500 ring-2 ring-red-100'
                        }`}
                    >
                        {micActive ? <Mic size={24} /> : <MicOff size={24} />}
                    </button>

                    <button 
                        onClick={handleEndCall}
                        className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-200 hover:bg-red-600 transition-all hover:scale-110 active:scale-95"
                    >
                        <PhoneOff size={32} />
                    </button>
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default LiveMode;