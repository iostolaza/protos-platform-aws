// src/app/features/contacts/contacts.component.ts 
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContactService } from '@ui';
import { UserService } from '@ui';
import { InputContact } from '@ui';
import { getUrl } from 'aws-amplify/storage';
import { getIconPath } from '@ui';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { ContactsTableItemComponent } from './contacts-table-item/contacts-table-item.component';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import type { Schema } from '@amplify-schema';
import { Router } from '@angular/router'; 
import { getCurrentUser } from 'aws-amplify/auth'; 

type UserType = Schema['User']['type'];

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.component.html',
  styleUrl: './contacts.component.scss',
  standalone: true,
  imports: [CommonModule, FormsModule, ContactsTableItemComponent, AngularSvgIconModule],
})
export class ContactsComponent implements OnInit, OnDestroy {
  public contacts = signal<InputContact[]>([]); 
  public searchResults = signal<InputContact[]>([]); 
  public searchQuery = '';
  public updatedAgo = 'a moment ago';
  public onlineContacts = 0;
  public recentContacts: InputContact[] = [];
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  private contactsService = inject(ContactService);
  private userService = inject(UserService);
  private router = inject(Router);

  getIconPath = getIconPath;

  trackByCognitoId(index: number, item: InputContact): string { 
    return item.cognitoId;
  }

  ngOnInit(): void {
    this.userService.load();
    this.setupSearch();
    this.loadContacts();
    this.contactsService.observeContacts().pipe(takeUntil(this.destroy$)).subscribe(() => this.loadContacts());
  }

private async loadContacts(): Promise<void> {
  try {
    const contacts = await this.contactsService.getContacts();
    this.contacts.set(contacts);
    this.updateSummary();
  } catch (err) {
    console.error('Load contacts error:', err);
  }
}

  onSearchChange(query: string) {
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  public onPerformSearch(): void {
    this.performSearch();
  }

  public async performSearch(): Promise<void> {
    try {
      const { users } = await this.contactsService.searchPool(this.searchQuery);
      const { userId } = await getCurrentUser();
      const existingIds = new Set(this.contacts().map((c) => c.cognitoId));
      const filtered = users.filter((u) => u.cognitoId && !existingIds.has(u.cognitoId) && u.cognitoId !== userId);
      const extendedFiltered = await Promise.all(
        filtered.map(async (u) => {
          let imageUrl = 'assets/profile/avatar-default.svg';
          if (u.profileImageKey) {
            try {
              const { url } = await getUrl({
                path: u.profileImageKey,
                options: { expiresIn: 3600 },
              });
              imageUrl = url.toString();
            } catch (err) {
              console.error('Error getting image URL:', err);
            }
          }
          return {
            ...u,
            imageUrl,
            createdAt: u.createdAt ?? null,
          } as InputContact;
        })
      );
      this.searchResults.set(extendedFiltered);
      console.log('Search results:', this.searchResults());
    } catch (err) {
      console.error('Perform search error:', err);
    }
  }

  private setupSearch() {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.performSearch();
      });
  }

  async addContact(user: InputContact): Promise<void> {
    try {
      const { userId } = await getCurrentUser(); 
      if (user.cognitoId === userId) return; 
      await this.contactsService.addContact(user.cognitoId);
      const extendedUser = { ...user, dateAdded: new Date().toISOString() };
      this.contacts.update(curr => [...curr, extendedUser]); 
      this.searchResults.update(curr => curr.filter((u) => u.cognitoId !== user.cognitoId)); 
      this.updateSummary();
      console.log('Contact added:', user);
    } catch (err) {
      console.error('Add contact error:', err);
    }
  }

  async onDelete(id: string): Promise<void> {
    try {
      await this.contactsService.deleteContact(id);
      this.contacts.update(curr => curr.filter((c) => c.cognitoId !== id)); 
      this.updateSummary();
      console.log('Contact deleted:', id);
    } catch (err) {
      console.error('Delete contact error:', err);
    }
  }

  async onMessage(id: string): Promise<void> { 
    try {
      const channel = await this.contactsService.getOrCreateChannel(id);
      this.router.navigate(['/main-layout/messages/incoming', channel.id]); 
    } catch (err) {
      console.error('Start message error:', err);
    }
  }
  
  private updateSummary(): void {
    this.onlineContacts = this.contacts().filter((c) => c.status === 'online').length;
    this.recentContacts = this.contacts()
      .slice()
      .sort((a, b) => new Date(b.dateAdded || '').getTime() - new Date(a.dateAdded || '').getTime())
      .slice(0, 3);
    this.updatedAgo = this.computeUpdatedAgo();  
  }

  private computeUpdatedAgo(): string {
    const contacts = this.contacts();
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}