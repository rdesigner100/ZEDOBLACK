import Dexie, { Table } from 'dexie';
import { Conversation, Message, Role, Attachment, GroundingMetadata } from '../types';

class ChatDatabase extends Dexie {
  conversations!: Table<Conversation>;
  messages!: Table<Message & { conversationId: string }>;

  constructor() {
    super('AIChatDB');
    this.version(1).stores({
      conversations: 'id, updatedAt, pinned',
      messages: 'id, conversationId, timestamp'
    });
  }
}

export const db = new ChatDatabase();

export const createConversation = async (title: string = 'New Chat'): Promise<string> => {
  const id = crypto.randomUUID();
  await db.conversations.add({
    id,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: false,
    messageCount: 0
  });
  return id;
};

export const addMessage = async (
  conversationId: string, 
  role: Role, 
  content: string, 
  attachments?: Attachment[],
  groundingMetadata?: GroundingMetadata
): Promise<string> => {
  const id = crypto.randomUUID();
  await db.messages.add({
    id,
    conversationId,
    role,
    content,
    timestamp: Date.now(),
    attachments,
    groundingMetadata
  });
  
  await db.conversations.update(conversationId, {
    updatedAt: Date.now(),
  });
  
  return id;
};

export const getMessages = async (conversationId: string): Promise<Message[]> => {
  return await db.messages
    .where('conversationId')
    .equals(conversationId)
    .sortBy('timestamp');
};

export const deleteConversation = async (id: string) => {
  await db.transaction('rw', db.conversations, db.messages, async () => {
    await db.messages.where('conversationId').equals(id).delete();
    await db.conversations.delete(id);
  });
};

export const updateConversation = async (id: string, updates: Partial<Conversation>) => {
  await db.conversations.update(id, {
    ...updates,
    updatedAt: Date.now()
  });
};

export const deleteMessage = async (id: string) => {
  await db.messages.delete(id);
};
