import { Message, GroundingMetadata } from '../types';

export async function streamXaiResponse(
  messages: Message[],
  model: string,
  onChunk: (text: string, metadata?: GroundingMetadata) => void,
  systemInstruction?: string
): Promise<{ text: string; metadata?: GroundingMetadata }> {
  const response = await fetch('/api/chat/xai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      model,
      systemInstruction,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to connect to xAI');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  if (!reader) {
    throw new Error('Response body is null');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('data: ')) {
        const data = trimmedLine.slice(6);
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          fullText += parsed.content;
          onChunk(fullText);
        } catch (e) {
          console.error('Error parsing SSE chunk:', e, 'Line:', line);
        }
      }
    }
  }

  return { text: fullText };
}
