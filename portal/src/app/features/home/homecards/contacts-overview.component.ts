
// src/app/features/home/homecards/contacts-overview.component.ts

import { Component, inject, OnInit, signal } from '@angular/core';
import { ContactService } from '@ui';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath } from '@ui';
import { Router } from '@angular/router';
import { InputContact } from '@ui';

@Component({
  selector: 'app-contacts-overview',
  standalone: true,
  imports: [AngularSvgIconModule],
  template: `
    <div class="rounded-lg bg-card w-full h-full px-4 py-6 flex flex-col justify-between">
      <div>
        <h3 class="text-lg font-bold uppercase text-left text-label">Contacts</h3>
          
          <div class="flex space-x-4 mt-6 justify-center">

            <div class="bg-gray-600 p-4 rounded-lg aspect-square flex flex-col items-center justify-center w-26 hover:bg-gray-700 hover:shadow-lg">
              <span class="text-3xl font-bold text-white">{{ total() }}</span>
              <span class="text-sm text-gray-200">Total</span>
            </div>

            <div class="bg-gray-600 p-4 rounded-lg aspect-square flex flex-col items-center justify-center w-26 hover:bg-gray-700 hover:shadow-lg">
              <span class="text-3xl font-bold text-white">{{ online() }}</span>
              <span class="text-sm text-gray-200">Online</span>
            </div>
          </div>
        <div class="flex justify-center">
        <p class="text-sm text-gray-500 mt-4">Updated {{ updatedAgo() }}</p>
        </div>
      </div>
      <div class="flex justify-end mt-4">
        <button (click)="navigateToContacts()">
          <svg-icon [src]="getIconPath('arrow-right')" svgClass="h-5 w-5 text-muted-foreground"></svg-icon>
        </button>
      </div>
    </div>
  `,
})
export class ContactsOverviewComponent implements OnInit {
  private contactService = inject(ContactService);
  private router = inject(Router);

  total = signal(0);
  online = signal(0);
  updatedAgo = signal('a moment ago');

  getIconPath = getIconPath;

  async ngOnInit() {
    const contacts = await this.contactService.getContacts();
    this.total.set(contacts.length);
    this.online.set(contacts.filter(c => c.status === 'online').length);
    this.updatedAgo.set(this.computeUpdatedAgo(contacts));
  }

  private computeUpdatedAgo(contacts: InputContact[]): string {
    if (contacts.length === 0) return 'never';
    const maxDate = Math.max(...contacts.map(c => new Date(c.dateAdded || '0').getTime()));
    const diffMs = Date.now() - maxDate;
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'a moment ago';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  navigateToContacts() {
    this.router.navigate(['/main-layout/contacts']);
  }
}