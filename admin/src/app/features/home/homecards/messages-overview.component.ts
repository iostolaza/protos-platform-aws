
// src/app/features/home/homecards/messages-overview.component.ts

import { Component, inject, OnInit, signal } from '@angular/core';
import { MessageService } from '@ui';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath } from '@ui';
import { Router } from '@angular/router';
import { getUrl } from 'aws-amplify/storage';
import { ChatItem } from '@ui';


@Component({
  selector: 'app-messages-overview',
  standalone: true,
  imports: [AngularSvgIconModule],
  template: `
    <div class="rounded-lg bg-card w-full h-full px-4 py-6 flex flex-col justify-between">
      <div>
        <h3 class="text-lg font-bold uppercase text-left text-label">Messages</h3>
        <div class="mt-6 pt-8 flex flex-col justify-between items-center flex-grow">
          <div class="bg-gray-600 p-4 rounded-full flex items-center space-x-4 w-full hover:bg-gray-700 hover:shadow-lg transition duration-300">
            <img [src]="latestChat()?.avatar || 'assets/profile/avatar-default.svg'" alt="Friend" class="w-12 h-12 rounded-full">
            <div>
              <p class="text-sm font-semibold text-white">{{ latestChat()?.name || 'Unknown' }}</p>
              <p class="text-xs text-gray-200">{{ latestChat()?.snippet || 'No messages yet' }}</p>
            </div>
          </div>
        </div>
        <div class="flex justify-center">
          <p class="text-sm text-gray-500 mt-4">{{ formatTimestamp(latestChat()?.timestamp) || 'Never' }}</p>
        </div>
      </div>

      <div class="flex justify-end mt-4">
        <button (click)="navigateToMessages()">
          <svg-icon [src]="getIconPath('arrow-right')" svgClass="h-5 w-5 text-muted-foreground"></svg-icon>
        </button>
      </div>
    </div>
  `,
})
export class MessagesOverviewComponent implements OnInit {
  private messageService = inject(MessageService);
  private router = inject(Router);

  latestChat = signal<ChatItem | null>(null);
  private imageCache = new Map<string, string>();

  getIconPath = getIconPath;

  async ngOnInit() {
    await this.messageService.loadRecentChats();
    const chats = this.messageService.getRecentChats()();
    if (chats.length > 0) {
      const latest = chats[0];
      const cachedImage = this.imageCache.get(latest.id) || (await this.fetchImageUrl(latest));
      this.imageCache.set(latest.id, cachedImage);
      this.latestChat.set({ ...latest, avatar: cachedImage });
    }
  }

  private async fetchImageUrl(chat: ChatItem): Promise<string> {
    if (chat.avatar) return chat.avatar;
    try {
      const { url } = await getUrl({ path: 'assets/profile/avatar-default.svg', options: { expiresIn: 3600 } });
      return url.toString();
    } catch (error) {
      console.error('Image URL fetch error:', error);
      return 'assets/profile/avatar-default.svg';
    }
  }

  public formatTimestamp(date?: Date): string { 
    if (!date) return 'Never';
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`;
  }

  navigateToMessages() {
    this.router.navigate(['/main-layout/messages']);
  }
}