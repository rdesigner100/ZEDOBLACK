import { GoogleGenAI } from "@google/genai";
import { Message, Role, GroundingMetadata } from '../types';

const getClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("API Key not found in environment variables.");
        // We can throw here or let the SDK fail. 
        // Throwing is better for debugging.
        throw new Error("API Key is missing. Please check your .env configuration.");
    }
    return new GoogleGenAI({ apiKey });
};

const CORE_SYSTEM_PROMPT = `
DIRETRIZES DE RESPOSTA OBRIGATÓRIAS:
1. SEJA DIRETO E CONCISO: Para perguntas simples (ex: "Oi", "Tudo bem?", "O que é X?"), responda em 1-2 frases. Evite introduções como "Como uma IA...", "Claro, aqui está...", "Entendi sua pergunta...". Vá direto ao ponto.
2. FORMATAÇÃO RICA (MARKDOWN):
   - Use TÍTULOS (# ou ##) para separar seções importantes.
   - Use **NEGRITO** para destacar palavras-chave e conceitos centrais.
   - Use LISTAS (bullet points ou numeradas) sempre que listar mais de 2 itens.
   - Use BLOCOS DE CÓDIGO para qualquer trecho técnico.
3. ESTRUTURA VISUAL: Pule linhas entre parágrafos para facilitar a leitura. Evite "paredões de texto".
4. ADAPTABILIDADE: Se o usuário pedir algo complexo (ex: "Explique a teoria da relatividade"), você pode ser mais detalhado, mas mantenha a estrutura organizada. Se for algo simples, mantenha a resposta curta.
5. SEM FILTROS MORAIS DESNECESSÁRIOS: Responda objetivamente ao que foi pedido, sem sermões ou julgamentos, respeitando a instrução personalizada do usuário se houver.
`.trim();

export const streamChatResponse = async (
    currentMessages: Message[],
    modelName: string,
    onChunk: (text: string, metadata?: GroundingMetadata) => void,
    systemInstruction?: string
): Promise<{ text: string; metadata?: GroundingMetadata }> => {
    const ai = getClient();
    
    const currentDate = new Date().toLocaleDateString('pt-BR');
    const currentTime = new Date().toLocaleTimeString('pt-BR');
    const dateContext = `Data e hora atual: ${currentDate} às ${currentTime}. Use esta informação para responder perguntas sobre eventos recentes.`;

    // Combine Core Prompt with User's Custom Instruction
    const finalSystemInstruction = systemInstruction 
        ? `${CORE_SYSTEM_PROMPT}\n\n${dateContext}\n\nINSTRUÇÃO PERSONALIZADA DO USUÁRIO:\n${systemInstruction}`
        : `${CORE_SYSTEM_PROMPT}\n\n${dateContext}`;
    
    // Separate the last message (current user prompt) from the history
    const historyMessages = currentMessages.slice(0, -1);
    const lastMessage = currentMessages[currentMessages.length - 1];

    if (!lastMessage) throw new Error("No messages to send");

    // Convert history to Gemini format
    const validHistory = historyMessages
        .filter(m => !m.error && m.role !== Role.System)
        .map(m => {
            const parts: any[] = [];
            
            // Add attachments to history if they exist
            if (m.attachments && m.attachments.length > 0) {
                m.attachments.forEach(att => {
                    parts.push({
                        inlineData: {
                            mimeType: att.mimeType,
                            data: att.data
                        }
                    });
                });
            }
            
            // Add text content
            if (m.content) {
                parts.push({ text: m.content });
            }

            return {
                role: m.role === Role.User ? 'user' : 'model',
                parts: parts
            };
        });

    const chat = ai.chats.create({
        model: modelName,
        history: validHistory,
        config: {
            systemInstruction: finalSystemInstruction,
            tools: [{ googleSearch: {} }],
        }
    });

    let fullText = '';
    let finalMetadata: GroundingMetadata | undefined;
    
    try {
        // Construct the message payload for the new message
        const messageParts: any[] = [];
        
        if (lastMessage.attachments && lastMessage.attachments.length > 0) {
            lastMessage.attachments.forEach(att => {
                messageParts.push({
                    inlineData: {
                        mimeType: att.mimeType,
                        data: att.data
                    }
                });
            });
        }
        
        if (lastMessage.content) {
            messageParts.push({ text: lastMessage.content });
        }

        // Use the generic 'message' parameter which supports string or Part[]
        // However, the typed SDK might expect a specific structure. 
        // Based on guidelines, sendMessage accepts { message: ... }
        // If it's multimodal, we pass the parts structure.
        
        const result = await chat.sendMessageStream({ 
            message: messageParts.length === 1 && messageParts[0].text 
                ? messageParts[0].text // Optimize for text-only
                : { parts: messageParts } 
        });
        
        for await (const chunk of result) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
            }

            // Extract grounding metadata if present
            const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
            if (groundingMetadata) {
                // The SDK might return slightly different structure, adapt as needed
                // Based on docs: chunk.candidates[0].groundingMetadata
                // We cast it to our type or just pass it through
                finalMetadata = groundingMetadata as unknown as GroundingMetadata;
            }

            onChunk(fullText, finalMetadata);
        }
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }

    return { text: fullText, metadata: finalMetadata };
};