export enum Role {
  User = 'user',
  Model = 'model',
  System = 'system'
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  mimeType: string;
  data: string; // base64
  name?: string;
}

export interface GroundingMetadata {
  groundingChunks: {
    web?: {
      uri: string;
      title: string;
    };
  }[];
  webSearchQueries?: string[];
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  error?: boolean;
  attachments?: Attachment[];
  groundingMetadata?: GroundingMetadata;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  messageCount: number;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  model: string;
  temperature: number;
  systemInstruction: string;
}

export type Theme = 'dark' | 'light';