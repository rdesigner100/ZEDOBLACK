import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Role, AppSettings, Attachment } from '../types';
import { createConversation, addMessage, getMessages, deleteMessage } from '../services/db';
import { streamXaiResponse } from '../services/xaiService';

export function useChat(settings: AppSettings) {
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load messages when conversation ID changes
  useEffect(() => {
    if (currentConvId) {
      getMessages(currentConvId).then(setMessages);
    } else {
      setMessages([]);
    }
  }, [currentConvId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  const handleNewChat = useCallback(async () => {
    const id = await createConversation();
    setCurrentConvId(id);
    setMessages([]);
    return id;
  }, []);

  const handleSend = async (text: string, attachments: Attachment[] = []) => {
    let convId = currentConvId;
    if (!convId) {
      const title = text ? (text.slice(0, 30) + '...') : 'Nova Conversa';
      convId = await createConversation(title);
      setCurrentConvId(convId);
    }

    const userMsgId = await addMessage(convId, Role.User, text, attachments);
    const userMsg: Message = { 
        id: userMsgId, 
        role: Role.User, 
        content: text, 
        timestamp: Date.now(),
        attachments
    };
    
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    const botMsgId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: botMsgId, role: Role.Model, content: '', timestamp: Date.now(), isStreaming: true }]);

    try {
      const { text: finalContent, metadata: finalMetadata } = await streamXaiResponse(
        updatedMessages,
        settings.model,
        (chunk, metadata) => {
          setMessages(prev => prev.map(m => 
            m.id === botMsgId ? { ...m, content: chunk, groundingMetadata: metadata } : m
          ));
        },
        settings.systemInstruction
      );

      // We don't need to wait for state update to get final content anymore as it is returned
      
      await addMessage(convId, Role.Model, finalContent, undefined, finalMetadata);
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false, content: finalContent, groundingMetadata: finalMetadata } : m));

    } catch (error) {
      console.error("Chat Error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      setMessages(prev => prev.map(m => 
        m.id === botMsgId ? { 
            ...m, 
            isStreaming: false, 
            error: true, 
            content: `Erro ao gerar resposta: ${errorMessage}. Verifique sua conexão e a chave de API.` 
        } : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async (msgId: string) => {
    if (isLoading) return;
    
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;
    
    if (messages[msgIndex].role !== Role.Model) return;

    const newHistory = messages.slice(0, msgIndex);
    
    if (newHistory.length === 0 || newHistory[newHistory.length - 1].role !== Role.User) {
        console.error("Cannot regenerate: No user message found before this AI response.");
        return;
    }

    const messagesToDelete = messages.slice(msgIndex);
    for (const msg of messagesToDelete) {
        await deleteMessage(msg.id);
    }

    setMessages(newHistory);
    setIsLoading(true);

    const convId = currentConvId!; 
    
    const botMsgId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: botMsgId, role: Role.Model, content: '', timestamp: Date.now(), isStreaming: true }]);

    try {
      const { text: finalContent, metadata: finalMetadata } = await streamXaiResponse(
        newHistory,
        settings.model,
        (chunk, metadata) => {
          setMessages(prev => prev.map(m => 
            m.id === botMsgId ? { ...m, content: chunk, groundingMetadata: metadata } : m
          ));
        },
        settings.systemInstruction
      );

      // We don't need to wait for state update to get final content anymore as it is returned
      
      await addMessage(convId, Role.Model, finalContent, undefined, finalMetadata);
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false, content: finalContent, groundingMetadata: finalMetadata } : m));

    } catch (error) {
      console.error("Chat Error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      setMessages(prev => prev.map(m => 
        m.id === botMsgId ? { 
            ...m, 
            isStreaming: false, 
            error: true, 
            content: `Erro ao gerar resposta: ${errorMessage}. Verifique sua conexão e a chave de API.` 
        } : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    currentConvId,
    setCurrentConvId,
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    handleNewChat,
    handleSend,
    handleRegenerate,
    bottomRef
  };
}
