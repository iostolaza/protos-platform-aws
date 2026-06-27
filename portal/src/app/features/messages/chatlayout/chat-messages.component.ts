
// src/app/features/messages/chatlayout/chat-messages.component.ts

import { Component, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

interface Message {
  id: string; 
  text: string;
  sender: string;
  senderAvatar?: string;
  isSelf?: boolean;
  timestamp?: Date;
  read?: boolean;
}

@Component({
  selector: 'app-chat-messages',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './chat-messages.component.html',
})
export class ChatMessagesComponent {
  messages = input<Message[]>([]);
  trackById(index: number, msg: Message): string {
    return msg.id;  
  }
}