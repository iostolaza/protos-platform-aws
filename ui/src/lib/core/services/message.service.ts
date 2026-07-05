// src/app/core/services/message.service.ts

import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import { getUrl, uploadData } from 'aws-amplify/storage';
import type { Schema } from '@amplify-schema';
import { getCurrentUser } from 'aws-amplify/auth';
import { Observable, Subject, from, of } from 'rxjs';
import { takeUntil, switchMap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { UserService } from './user.service';
import { ChatItem, Message } from '../models/message.model';

@Injectable({ providedIn: 'root' })
export class MessageService implements OnDestroy {
  private client = generateClient<Schema>();
  private destroy$ = new Subject<void>();
  private recentChats = signal<ChatItem[]>([]);
  private messages = signal<Message[]>([]);
  private channelMembersCache = new Map<string, string[]>();

  private userService = inject(UserService);

  async getCurrentUserId(): Promise<string> {
    const { userId } = await getCurrentUser();
    return userId;
  }

  async loadRecentChats(): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      const { data: userChannels } = await this.client.models.UserChannel.list({
        filter: { userCognitoId: { eq: userId } },
      });

      // Direct fetch friends to break cycle
      const { data: friends } = await this.client.models.Friend.list({
        filter: { ownerCognitoId: { eq: userId } },
      });
      const friendIds = new Set(friends.map((f: Schema['Friend']['type']) => f.friendCognitoId));

      const chats: (ChatItem | null)[] = await Promise.all(
        userChannels.map(async (uc: Schema['UserChannel']['type']) => {
          const channelResponse = await uc.channel();
          if (channelResponse.errors || !channelResponse.data) return null;
          const channel = channelResponse.data;
          if (channel.type !== 'direct') return null;

          const channelId = uc.channelId;
          const members = await this.getChannelMembers(channelId);
          const otherUserId = members.find((id) => id !== userId);
          if (!otherUserId || !friendIds.has(otherUserId)) return null;

          const { data: otherUser } = await this.client.models.User.get({ cognitoId: otherUserId });
          const name =
            `${otherUser?.firstName || ''} ${otherUser?.lastName || ''}`.trim() ||
            otherUser?.email ||
            'Unknown';

          const avatar = otherUser?.profileImageKey
            ? (await getUrl({ path: otherUser.profileImageKey })).url.toString()
            : 'assets/profile/avatar-default.svg';

          const { data: lastMessages } = await this.client.models.Message.list({
            filter: { channelId: { eq: channelId } },
            limit: 50,
          });
          const sorted = [...lastMessages].sort(
            (a: Schema['Message']['type'], b: Schema['Message']['type']) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          const lastMsg = sorted[0];

          return {
            id: channelId,
            name,
            snippet: lastMsg?.content || undefined,
            avatar,
            timestamp: lastMsg?.timestamp ? new Date(lastMsg.timestamp) : undefined,
            otherUserId,
          };
        })
      );

      const filteredChats = chats.filter((c): c is ChatItem => c !== null);
      filteredChats.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
      this.recentChats.set(filteredChats);
    } catch (error) {
      console.error('Load recent chats error:', error);
    }
  }

  getRecentChats() {
    return this.recentChats;
  }

  async getOrCreateChannel(otherUserId: string): Promise<Schema['Channel']['type']> {
    const me = await this.getCurrentUserId();
    const ids = [me, otherUserId].sort();
    const directKey = `${ids[0]}_${ids[1]}`;
    const { data: channels } = await this.client.models.Channel.list({
      filter: { directKey: { eq: directKey } },
    });
    let channel = channels[0];
    if (!channel) {
      const now = new Date().toISOString();
      const { data: newChannel, errors } = await this.client.models.Channel.create({
        creatorCognitoId: me,
        type: 'direct',
        directKey,
        name: `Chat with ${otherUserId}`,
        createdAt: now,
        updatedAt: now,
      });
      if (errors) throw new Error(errors.map((e: { message: string }) => e.message).join(', '));
      if (!newChannel) throw new Error('Channel creation failed');
      channel = newChannel;
      await Promise.all([
        this.client.models.UserChannel.create({ userCognitoId: me, channelId: channel.id, createdAt: now, updatedAt: now }),
        this.client.models.UserChannel.create({ userCognitoId: otherUserId, channelId: channel.id, createdAt: now, updatedAt: now }),
      ]);
      await this.loadRecentChats();
    }
    return channel;
  }

  async loadMessages(channelId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      const members = await this.getChannelMembers(channelId);
      const otherId = members.find((id) => id !== userId) || '';

      const { data: msgs } = await this.client.models.Message.list({
        filter: { channelId: { eq: channelId } },
        limit: 100,
      });
      const sorted = [...msgs].sort(
        (a: Schema['Message']['type'], b: Schema['Message']['type']) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const unread = sorted.filter(
        (msg: Schema['Message']['type']) => !msg.readBy?.includes(userId) && msg.senderCognitoId !== userId
      );
      await Promise.all(
        unread.map((msg: Schema['Message']['type']) =>
          this.client.models.Message.update({
            id: msg.id,
            readBy: [...(msg.readBy || []), userId],
            updatedAt: new Date().toISOString(),
          })
        )
      );

      const mapped: Message[] = await Promise.all(
        sorted.map(async (msg: Schema['Message']['type']) => {
          const senderUser = await this.getUserProfile(msg.senderCognitoId);
          return {
            id: msg.id,
            text: msg.content || '',
            sender: senderUser.name,
            senderAvatar: senderUser.avatar,
            isSelf: msg.senderCognitoId === userId,
            timestamp: new Date(msg.timestamp),
            read: msg.readBy?.includes(otherId) || false,
            attachment: msg.attachment,
          };
        })
      );

      this.messages.set(mapped);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  }

  getMessages() {
    return this.messages;
  }

  async sendMessage(channelId: string, text: string, attachment?: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      const now = new Date().toISOString();
      await this.client.models.Message.create({
        channelId,
        senderCognitoId: userId,
        content: text,
        timestamp: now,
        attachment,
        readBy: [userId],
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      console.error('Send message error:', error);
    }
  }

  async uploadAttachment(file: File): Promise<string> {
    const key = `attachments/${uuidv4()}-${file.name}`;
    await uploadData({ path: key, data: file });
    return key;
  }

  async deleteChat(channelId: string): Promise<void> {
    const { data: msgs } = await this.client.models.Message.list({
      filter: { channelId: { eq: channelId } },
    });
    await Promise.all(msgs.map((msg: Schema['Message']['type']) => this.client.models.Message.delete({ id: msg.id })));
    await this.client.models.Channel.delete({ id: channelId });
  }

  subscribeMessages(channelId: string | null): Observable<any> {
    return from(
      this.client.models.Message.observeQuery(
        channelId ? { filter: { channelId: { eq: channelId } } } : {}
      )
    ).pipe(
      switchMap((snapshot) => of(snapshot)),
      takeUntil(this.destroy$),
      catchError((err: any) => {
        console.error('Subscribe messages error:', err);
        return of(null);
      })
    );
  }

  private async getChannelMembers(channelId: string): Promise<string[]> {
    if (this.channelMembersCache.has(channelId)) return this.channelMembersCache.get(channelId)!;
    const { data: userChannels } = await this.client.models.UserChannel.list({
      filter: { channelId: { eq: channelId } },
    });
    const members = userChannels.map((uc: Schema['UserChannel']['type']) => uc.userCognitoId);
    this.channelMembersCache.set(channelId, members);
    return members;
  }

  public async getUserProfile(userId: string): Promise<{ name: string; avatar: string }> { // Made public
    const allUsers = await this.userService.getAllUsers();
    const user = allUsers.find((u: Schema['User']['type']) => u.cognitoId === userId);
    const name =
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
      user?.email ||
      'Unknown';
    const avatar = user?.profileImageKey
      ? (await getUrl({ path: user.profileImageKey })).url.toString()
      : 'assets/profile/avatar-default.svg';
    return { name, avatar };
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}