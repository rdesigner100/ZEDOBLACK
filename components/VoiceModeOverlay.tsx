import React, { useEffect, useState, useRef } from 'react';
import { X, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RealtimeService, RealtimeEvent } from '../services/realtimeService';

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  audioContext?: AudioContext | null;
}

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({ isOpen, onClose, audioContext }) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'error'>('connecting');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [volume, setVolume] = useState(0);
  const realtimeServiceRef = useRef<RealtimeService | null>(null);
  const responseStartedRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      const service = new RealtimeService((event: RealtimeEvent) => {
        console.log('Realtime Event:', event);
        
        if (event.type === 'input_audio_buffer.speech_started') {
            setStatus('listening');
            setTranscript('Ouvindo...');
            setAiResponse('');
            responseStartedRef.current = false;
        }
        
        if (event.type === 'input_audio_buffer.speech_stopped') {
            setStatus('speaking');
            setTranscript('Processando...');
            // Fallback: if server_vad fails to trigger response within 1.5s, commit manually
            setTimeout(() => {
                if (realtimeServiceRef.current && !responseStartedRef.current) {
                    console.log('VAD Fallback: Triggering manual commit');
                    realtimeServiceRef.current.commit();
                }
            }, 1500);
        }

        if (event.type === 'response.created') {
            responseStartedRef.current = true;
            setStatus('speaking');
        }

        if (event.type === 'conversation.item.input_audio_transcription.completed') {
            setTranscript(event.transcript || event.text || '');
        }

        if (event.type === 'conversation.item.input_audio_transcription.delta') {
            setTranscript(prev => (prev === 'Ouvindo...' || prev === 'Processando...') ? event.delta : prev + event.delta);
        }

        if (event.type === 'response.output_audio_transcript.delta') {
            setAiResponse(prev => prev + event.delta);
        }
        
        if (event.type === 'response.audio_transcription.completed') {
            // Reset for next turn if needed
        }
      });

      realtimeServiceRef.current = service;
      service.setVolumeCallback((v) => {
          setVolume(v);
          // Local silence detection fallback
          if (v > 0.01) {
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
          } else if (status === 'listening' && !silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                  if (realtimeServiceRef.current && !responseStartedRef.current) {
                      console.log('Local Silence Fallback: Triggering commit');
                      realtimeServiceRef.current.commit();
                  }
              }, 3000); // 3 seconds of local silence
          }
      });
      
      service.connect(audioContext || undefined).then(() => {
        setStatus('listening');
        service.startAudioCapture();
      }).catch(err => {
        console.error('Failed to connect to realtime service:', err);
        setStatus('error');
      });

      // Handle unexpected close
      if (service.ws) {
          service.ws.addEventListener('close', (e) => {
              if (e.code !== 1000) setStatus('error');
          });
      }
    } else {
      realtimeServiceRef.current?.disconnect();
      realtimeServiceRef.current = null;
      setStatus('connecting');
      setTranscript('');
      setAiResponse('');
    }

    return () => {
      realtimeServiceRef.current?.disconnect();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={32} />
        </button>

        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
           <img 
             src="https://central.daev.ca/wp-content/uploads/2026/01/ICON-ZDB.png" 
             alt="Logo ZDB" 
             className="w-16 h-16 object-contain"
           />
           <span className="text-sm font-light tracking-[0.4em] text-white/30 uppercase">Modo de Voz</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl gap-16 relative">
          
          {/* Animated Orb/Visualizer */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Outer Glows */}
            <motion.div 
              animate={{ 
                scale: status === 'listening' ? [1, 1.4, 1] : 1,
                opacity: status === 'listening' ? [0.2, 0.4, 0.2] : 0.1
              }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute inset-0 bg-[#C41E3A] blur-3xl rounded-full"
            />
            
            {/* Pulsing Rings */}
            {[1, 2, 3].map((i) => (
              <motion.div 
                key={i}
                animate={{ 
                  scale: status === 'listening' ? [1, 1.5 + i * 0.2, 1] : 1,
                  opacity: status === 'listening' ? [0.3, 0, 0.3] : 0
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 2, 
                  delay: i * 0.4,
                  ease: "easeOut" 
                }}
                className="absolute inset-0 border border-[#C41E3A]/30 rounded-full"
              />
            ))}

            {/* Central Orb */}
            <motion.div 
              animate={{ 
                scale: status === 'speaking' ? [1, 1.1, 1] : (1 + volume * 2),
                boxShadow: status === 'speaking' 
                  ? ['0 0 20px rgba(196,30,58,0.3)', '0 0 60px rgba(196,30,58,0.6)', '0 0 20px rgba(196,30,58,0.3)'] 
                  : `0 0 ${20 + volume * 100}px rgba(255,255,255,${0.1 + volume})`
              }}
              transition={{ repeat: status === 'speaking' ? Infinity : 0, duration: 1.5 }}
              className={`z-10 w-32 h-32 rounded-full flex items-center justify-center transition-colors duration-500 ${
                status === 'speaking' ? 'bg-[#C41E3A]' : 'bg-white'
              }`}
            >
              {status === 'speaking' ? (
                <Volume2 size={48} className="text-white" />
              ) : (
                <Mic size={48} className="text-black" />
              )}
            </motion.div>
          </div>

          <div className="text-center space-y-8 w-full">
            <div className="flex flex-col items-center gap-4">
                <motion.h2 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-light text-gray-400 tracking-tight"
                >
                  {status === 'connecting' ? 'Iniciando conexão...' : 
                   status === 'listening' ? 'Pode falar, estou ouvindo' : 
                   status === 'speaking' ? 'ZDB respondendo...' : 
                   'Ocorreu um erro na conexão'}
                </motion.h2>
            </div>

            {status === 'error' && (
                <button 
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-[#C41E3A] text-white rounded-full hover:opacity-90 transition-all"
                >
                    Tentar Novamente
                </button>
            )}
            
            <div className="min-h-[120px] px-4 flex flex-col items-center justify-center gap-6">
                <AnimatePresence mode="wait">
                  {transcript && (
                      <motion.p 
                        key="transcript"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xl text-gray-300 font-light italic max-w-lg"
                      >
                          "{transcript}"
                      </motion.p>
                  )}
                </AnimatePresence>
                
                <AnimatePresence mode="wait">
                  {aiResponse && (
                      <motion.p 
                        key="aiResponse"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-2xl text-white font-medium max-w-xl leading-relaxed"
                      >
                          {aiResponse}
                      </motion.p>
                  )}
                </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Footer removed as requested */}
      </motion.div>
    </AnimatePresence>
  );
};
