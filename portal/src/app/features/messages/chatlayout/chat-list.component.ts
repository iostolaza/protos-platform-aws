// src/app/features/messages/chatlayout/chat-list.component.ts
import { Component, input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath } from '@ui';

interface ChatItem { id: string; name: string; snippet?: string; avatar?: string; timestamp?: Date; }

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule, AngularSvgIconModule], 
  templateUrl: './chat-list.component.html',
})
export class ChatListComponent {
  chats = input<ChatItem[]>([]);
  @Output() chatSelected = new EventEmitter<ChatItem>();
  @Output() chatDeleted = new EventEmitter<string>();
  getIconPath = getIconPath;
}