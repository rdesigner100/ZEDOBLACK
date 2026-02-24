import React, { useRef, useEffect, useState } from 'react';
import { Send, StopCircle, Mic, Plus, ArrowUp, Image as ImageIcon, FileText, X, Paperclip, AudioLines } from 'lucide-react';
import { Attachment } from '../types';

interface ChatInputProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  onStop: () => void;
  onStartVoiceMode: () => void;
  centered?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading, onStop, onStartVoiceMode, centered = false }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [text]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setShowAttachMenu(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'pt-BR'; // Default to Portuguese based on prompts
            
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setText(prev => prev + (prev ? ' ' : '') + transcript);
                setIsListening(false);
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }
    }
  }, []);

  const toggleListening = () => {
      if (isListening) {
          recognitionRef.current?.stop();
          setIsListening(false);
      } else {
          recognitionRef.current?.start();
          setIsListening(true);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isLoading) return;
    onSend(text, attachments);
    setText('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newAttachments: Attachment[] = [];
          for (let i = 0; i < e.target.files.length; i++) {
              const file = e.target.files[i];
              const base64 = await convertToBase64(file);
              const isImage = file.type.startsWith('image/');
              
              newAttachments.push({
                  id: crypto.randomUUID(),
                  type: isImage ? 'image' : 'file',
                  mimeType: file.type,
                  data: base64,
                  name: file.name
              });
          }
          setAttachments(prev => [...prev, ...newAttachments]);
          setShowAttachMenu(false);
      }
      // Reset input value to allow selecting same file again
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const convertToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
              const result = reader.result as string;
              // Remove data URL prefix (e.g., "data:image/png;base64,")
              const base64 = result.split(',')[1];
              resolve(base64);
          };
          reader.onerror = error => reject(error);
      });
  };

  const removeAttachment = (id: string) => {
      setAttachments(prev => prev.filter(att => att.id !== id));
  };

  return (
    <div className={`w-full ${centered ? '' : 'px-4 pb-6 pt-2'}`}>
      <div className={`max-w-3xl mx-auto ${centered ? '' : ''}`}>
        
        {/* Attachments Preview */}
        {attachments.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-2 px-2">
                {attachments.map(att => (
                    <div key={att.id} className="relative group bg-[#2f2f2f] border border-[#424242] rounded-xl overflow-hidden w-24 h-24 flex items-center justify-center">
                        {att.type === 'image' ? (
                            <img src={`data:${att.mimeType};base64,${att.data}`} alt="preview" className="w-full h-full object-cover opacity-80" />
                        ) : (
                            <div className="flex flex-col items-center p-2 text-center">
                                <FileText className="text-gray-400 mb-1" size={24} />
                                <span className="text-[10px] text-gray-300 truncate w-full">{att.name}</span>
                            </div>
                        )}
                        <button 
                            onClick={() => removeAttachment(att.id)}
                            className="absolute top-1 right-1 bg-black/50 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
        )}

        <div className={`relative flex items-end gap-2 bg-[#2f2f2f] rounded-[26px] p-2 pl-3 ${centered ? 'shadow-lg' : ''}`}>
          
          <div className="relative flex-shrink-0" ref={menuRef}>
              <button 
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#424242] rounded-full transition-colors mb-0.5"
                title="Anexar"
              >
                 <Plus size={20} />
              </button>
              
              {showAttachMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-60 bg-[#2f2f2f] border border-[#424242] rounded-xl shadow-xl overflow-hidden py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#424242] text-sm text-left transition-colors text-white"
                      >
                          <Paperclip size={18} />
                          <span>Adicionar fotos e arquivos</span>
                      </button>
                  </div>
              )}
          </div>

          <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
              multiple 
              accept="image/*,application/pdf,text/plain,.doc,.docx"
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte alguma coisa"
            rows={1}
            className="flex-1 min-w-0 max-h-[200px] py-2 bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-gray-100 placeholder-[#b4b4b4] leading-6"
          />
          
          <div className="flex items-center gap-1 mb-1 flex-shrink-0">
             {isLoading ? (
                <button 
                  onClick={onStop}
                  className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-full hover:opacity-80 transition-opacity"
                >
                  <StopCircle size={18} fill="currentColor" />
                </button>
             ) : (
                 <>
                   {!text.trim() && attachments.length === 0 ? (
                       /* Voice Mode Button (Waves) */
                      <button 
                        onClick={onStartVoiceMode}
                        className="p-2 bg-[#C41E3A] text-white rounded-full hover:opacity-90 transition-all duration-200 shadow-sm"
                        title="Modo de Voz Realtime"
                      >
                         <AudioLines size={20} />
                      </button>
                   ) : (
                       <button 
                        onClick={handleSend}
                        disabled={!text.trim() && attachments.length === 0}
                        className={`p-2 rounded-full transition-all duration-200 ${
                            text.trim() || attachments.length > 0
                            ? 'bg-[#C41E3A] text-white hover:opacity-90' 
                            : 'bg-[#424242] text-[#2f2f2f] cursor-default'
                        }`}
                       >
                        <ArrowUp size={20} />
                       </button>
                   )}
                 </>
             )}
          </div>
        </div>
        <div className="text-center text-xs text-[#b4b4b4] mt-2">
            A IA pode cometer erros. Considere verificar informações importantes.
        </div>
      </div>
    </div>
  );
};