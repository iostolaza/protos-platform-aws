import type { Schema } from '@amplify-schema';

export interface ChatItem {
  id: string;
  name: string;
  snippet?: string;
  avatar?: string;
  timestamp?: Date;
  otherUserId?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: string;
  senderAvatar?: string;
  isSelf?: boolean;
  timestamp?: Date;
  read?: boolean;
  attachment?: string | null; 
}

export interface Conversation {
  channel: { id: string };
  otherUser: { id: string; name: string; avatar?: string; email: string };
  lastMessage?: Schema['Message']['type'];
}
