
// src/app/core/services/contact.service.ts

import { Injectable, signal } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import { getUrl } from 'aws-amplify/storage';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '@amplify-schema';
import { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UserService } from './user.service';
import { MessageService } from './message.service';
import { InputContact } from '../models/contact';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private client = generateClient<Schema>();
  private destroy$ = new Subject<void>();
  private contacts = signal<InputContact[]>([]);

  constructor(
    private userService: UserService,
    private messageService: MessageService
  ) {}

  // Method to get authenticated user
  async getAuthenticatedUser(): Promise<Schema['User']['type'] | null> {
    try {
      const { userId } = await getCurrentUser();
      const { data, errors } = await this.client.models.User.get({ cognitoId: userId });
      if (errors) {
        throw new Error(errors.map((e: { message: string }) => e.message).join(', '));
      }
      return data;
    } catch (error) {
      console.error('Get authenticated user error:', error);
      return null;
    }
  }

  // Method calling Cognito users (via User model; searches/filters all users)
  async searchPool(query: string): Promise<{ users: Schema['User']['type'][] }> {
    try {
      const allUsers = await this.userService.getAllUsers();
      const lowerQuery = query.toLowerCase();
      const filtered = allUsers.filter(user => 
        (user.firstName?.toLowerCase().includes(lowerQuery) ?? false) ||
        (user.lastName?.toLowerCase().includes(lowerQuery) ?? false) ||
        (user.email?.toLowerCase().includes(lowerQuery) ?? false)
      );
      return { users: filtered };
    } catch (error) {
      console.error('Search Cognito users error:', error);
      return { users: [] };
    }
  }

  // Method to generate contact/friend list
  async getContacts(): Promise<InputContact[]> {
    try {
      const { userId } = await getCurrentUser();
      const { data: friends, errors } = await this.client.models.Friend.listFriendByOwnerCognitoIdAndAddedAt({
        ownerCognitoId: userId
      }, { sortDirection: 'DESC' });
      if (errors) {
        throw new Error(errors.map((e: { message: string }) => e.message).join(', '));
      }

      const contacts = await Promise.all(friends.map(async (friend: Schema['Friend']['type']) => {
        const { data: user, errors: userErrors } = await this.client.models.User.get({ cognitoId: friend.friendCognitoId });
        if (userErrors) {
          console.warn(`Get user ${friend.friendCognitoId} error:`, userErrors);
          return null;
        }
        if (!user) return null;

        let imageUrl = 'assets/profile/avatar-default.svg';
        if (user.profileImageKey) {
          try {
            const { url } = await getUrl({ path: user.profileImageKey, options: { expiresIn: 3600 } });
            imageUrl = url.toString();
          } catch (err) {
            console.error('Get image URL error:', err);
          }
        }

        return {
          cognitoId: user.cognitoId,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          username: user.username || '',
          email: user.email || '',
          profileImageKey: user.profileImageKey,
          status: user.status || 'offline', 
          dateAdded: friend.addedAt,
          imageUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          address: user.address,
          contactPrefs: user.contactPrefs,
          vehicle: user.vehicle,
          emergencyContact: user.emergencyContact,
        } as InputContact;
      }));

      const filteredContacts = contacts.filter((c: InputContact | null): c is InputContact => !!c);
      this.contacts.set(filteredContacts);
      return filteredContacts;
    } catch (error) {
      console.error('Get contacts error:', error);
      return [];
    }
  }

  // Method to add contact/friend
  async addContact(friendCognitoId: string): Promise<void> {
    try {
      const { userId } = await getCurrentUser();
      const now = new Date().toISOString();
      const { errors } = await this.client.models.Friend.create({
        ownerCognitoId: userId,
        friendCognitoId,
        addedAt: now,
      });
      if (errors) {
        throw new Error(errors.map((e: { message: string }) => e.message).join(', '));
      }
    } catch (error) {
      console.error('Add contact error:', error);
    }
  }

  // Method deleting users (from contact list only)
  async deleteContact(friendCognitoId: string): Promise<void> {
    try {
      const { userId } = await getCurrentUser();
      const { errors } = await this.client.models.Friend.delete({
        ownerCognitoId: userId,
        friendCognitoId,
      });
      if (errors) {
        throw new Error(errors.map((e: { message: string }) => e.message).join(', '));
      }
      this.contacts.update(curr => curr.filter(c => c.cognitoId !== friendCognitoId));
    } catch (error) {
      console.error('Delete contact error:', error);
    }
  }

  // Method to get or create channel for messaging (delegates to MessageService)
  async getOrCreateChannel(friendCognitoId: string): Promise<Schema['Channel']['type']> {
    return this.messageService.getOrCreateChannel(friendCognitoId);
  }

  // Observe real-time changes to contacts
  observeContacts(): Observable<{ items: Schema['Friend']['type'][], isSynced: boolean }> {
    return new Observable(observer => {
      let sub: any; // To hold subscription for cleanup
      (async () => {
        try {
          const userId = await this.getCurrentUserId();
          sub = this.client.models.Friend.observeQuery({
            filter: { ownerCognitoId: { eq: userId } }
          }).pipe(
            takeUntil(this.destroy$)
          ).subscribe({
            next: (snapshot) => observer.next(snapshot),
            error: (err) => observer.error(err),
            complete: () => observer.complete()
          });
        } catch (error) {
          observer.error(error);
          observer.complete(); // Ensure complete on early error
        }
      })();

      // Cleanup function
      return () => {
        if (sub) sub.unsubscribe();
      };
    });
  }

  private async getCurrentUserId(): Promise<string> {
    const { userId } = await getCurrentUser();
    return userId;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}