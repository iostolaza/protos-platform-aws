// src/app/features/messages/messages.component.ts

import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from '@ui';
import { UserService } from '@ui';
import { getUrl } from 'aws-amplify/storage';
import type { Schema } from '@amplify-schema';
import { UserProfileComponent } from './chatlayout/user-profile.component';
import { ChatSearchComponent } from './chatlayout/chat-search.component';
import { ChatListComponent } from './chatlayout/chat-list.component';
import { ChatHeaderComponent } from './chatlayout/chat-header.component';
import { ChatMessagesComponent } from './chatlayout/chat-messages.component';
import { MessageInputComponent } from './chatlayout/message-input.component';
import { ActivatedRoute } from '@angular/router';
import { ChatItem, Message, Conversation } from '@ui';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UserProfileComponent,
    ChatSearchComponent,
    ChatListComponent,
    ChatHeaderComponent,
    ChatMessagesComponent,
    MessageInputComponent,
  ],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagesComponent implements OnInit, OnDestroy {
  private messageService = inject(MessageService);
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);

  conversations = signal<Conversation[]>([]);
  filteredConversations = computed(() =>
    this.conversations().filter(
      (conv: Conversation) =>
        conv.otherUser.name.toLowerCase().includes(this.searchQuery().toLowerCase()) ||
        (conv.lastMessage?.content || '').toLowerCase().includes(this.searchQuery().toLowerCase())
    )
  );
  filteredChats = computed(() =>
    this.filteredConversations().map(
      (conv: Conversation) =>
        ({
          id: conv.channel.id,
          name: conv.otherUser.name,
          snippet: conv.lastMessage?.content || undefined,
          avatar: conv.otherUser.avatar,
          timestamp: conv.lastMessage?.timestamp ? new Date(conv.lastMessage.timestamp) : undefined,
        } as ChatItem)
    )
  );
  messages = signal<Message[]>([]);
  selectedConversation = signal<Conversation | null>(null);
  searchQuery = signal<string>('');
  loadingMessages = signal<boolean>(false);
  newMessage = signal<string>('');
  file = signal<File | null>(null);
  currentUserId = '';
  private destroy$ = new Subject<void>();
  private chatSub: Subscription | null = null;
  private messageCache = new Map<string, Message[]>();
  subscriptions: Subscription[] = [];

  async ngOnInit() {
    try {
      this.currentUserId = await this.messageService.getCurrentUserId();
      await this.messageService.loadRecentChats();

      this.conversations.set(
        this.messageService.getRecentChats()().map(
          (chat: ChatItem) =>
            ({
              channel: { id: chat.id },
              otherUser: {
                id: chat.otherUserId || '',
                name: chat.name,
                avatar: chat.avatar,
                email: '',
              },
              lastMessage: {
                content: chat.snippet || '',
                timestamp: chat.timestamp?.toISOString() || '',
              } as Schema['Message']['type'],
            } as Conversation)
        )
      );

      const channelId = this.route.snapshot.paramMap.get('channelId') || '';
      if (channelId) {
        const chat = this.messageService.getRecentChats()().find((c) => c.id === channelId);
        if (chat) {
          await this.selectConversation(chat);
        } else {
          console.error('Channel not found:', channelId);
        }
      }

      // Global sub for recent updates
      this.subscriptions.push(
        this.messageService.subscribeMessages(null).subscribe((snapshot) => {
          if (snapshot) {
            const newMsg = snapshot.items[snapshot.items.length - 1]; // Latest from snapshot
            if (newMsg) {
              this.updateConversationsOnNewMessage(newMsg);
              if (this.selectedConversation()?.channel.id === newMsg.channelId) {
                this.appendMessage(newMsg); // Append instead of reload
              }
            }
          }
        })
      );
    } catch (error) {
      console.error('Init error:', error);
    }
  }

  onSearch(value: string) {
    this.searchQuery.set(value);
  }

  async selectConversation(chat: ChatItem) {
    const conv = this.conversations().find((c: Conversation) => c.channel.id === chat.id);
    if (conv) {
      if (this.chatSub) {
        this.chatSub.unsubscribe();
        this.chatSub = null;
      }
      this.selectedConversation.set(conv);
      this.loadingMessages.set(true);
      try {
        const channelId = conv.channel.id;
        if (this.messageCache.has(channelId) ) {
          this.messages.set(this.messageCache.get(channelId)!);
        } else {
          await this.messageService.loadMessages(channelId);
          const loadedMessages = this.messageService.getMessages()();
          this.messages.set(loadedMessages);
          this.messageCache.set(channelId, loadedMessages);
        }
        // Channel sub for real-time append
        this.chatSub = this.messageService.subscribeMessages(channelId).pipe(takeUntil(this.destroy$)).subscribe((snapshot) => {
          if (snapshot) {
            const newMsg = snapshot.items[snapshot.items.length - 1]; // Latest
            if (newMsg) {
              this.appendMessage(newMsg);
            }
          }
        });
      } catch (error) {
        console.error('Load messages error:', error);
      } finally {
        this.loadingMessages.set(false);
      }
    }
  }

  async send(text: string) {
    this.newMessage.set(text);
    if (this.newMessage().trim() && this.selectedConversation()?.channel.id) {
      await this.messageService.sendMessage(this.selectedConversation()!.channel.id, this.newMessage());
      this.newMessage.set('');
      // Subscription will append
    }
  }

  async sendWithFile(data: { text: string; file: File }) {
    this.newMessage.set(data.text);
    this.file.set(data.file);
    if (this.file() && this.selectedConversation()?.channel.id) {
      const attachment = await this.messageService.uploadAttachment(this.file()!);
      await this.messageService.sendMessage(this.selectedConversation()!.channel.id, this.newMessage(), attachment);
      this.newMessage.set('');
      this.file.set(null);
      // Subscription will append
    }
  }

  async getAttachmentUrl(path: string): Promise<string> {
    try {
      const { url } = await getUrl({ path, options: { expiresIn: 3600 } });
      return url.toString();
    } catch (error) {
      console.error('Get attachment URL error:', error);
      return '';
    }
  }

  isImage(path: string): boolean {
    return /\.(jpg|jpeg|png|gif)$/i.test(path);
  }

  getFileName(path: string): string {
    return path.split('/').pop() || 'file';
  }

  trackByTimestamp(index: number, msg: Message): Date | undefined {
    return msg.timestamp;
  }

  updateConversationsOnNewMessage(newMsg: Schema['Message']['type']) {
    const conv = this.conversations().find((c: Conversation) => c.channel.id === newMsg.channelId);
    if (conv) {
      const updated = { ...conv, lastMessage: newMsg };
      this.conversations.update((convs: Conversation[]) =>
        convs
          .map((c: Conversation) => (c.channel.id === newMsg.channelId ? updated : c))
          .sort(
            (a: Conversation, b: Conversation) =>
              new Date(b.lastMessage?.timestamp || '0').getTime() -
              new Date(a.lastMessage?.timestamp || '0').getTime()
          )
      );
    }
  }

  async deleteConversation(channelId: string) {
    if (confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      await this.messageService.deleteChat(channelId);
      this.conversations.update((convs: Conversation[]) => convs.filter((c: Conversation) => c.channel.id !== channelId));
      this.messageCache.delete(channelId);
      if (this.selectedConversation()?.channel.id === channelId) {
        this.selectedConversation.set(null);
        this.messages.set([]);
      }
    }
  }

  // Helper to append new message from subscription
  private async appendMessage(newMsg: Schema['Message']['type']) {
    const userId = await this.messageService.getCurrentUserId();
    const senderUser = await this.messageService.getUserProfile(newMsg.senderCognitoId);
    const mappedMsg: Message = {
      id: newMsg.id,
      text: newMsg.content || '',
      sender: senderUser.name,
      senderAvatar: senderUser.avatar,
      isSelf: newMsg.senderCognitoId === userId,
      timestamp: new Date(newMsg.timestamp),
      read: newMsg.readBy?.includes(userId) || false,
      attachment: newMsg.attachment,
    };
    // Check if id already exists to avoid duplicates
    this.messages.update((msgs) => {
      if (msgs.some((m) => m.id === mappedMsg.id)) return msgs;
      return [...msgs, mappedMsg].sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0));
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    if (this.chatSub) this.chatSub.unsubscribe();
  }
}