import { Injectable, inject } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';
import { UserService, UserProfile } from './user.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private client = generateClient<Schema>();
  private userService = inject(UserService);

  // Synchronous snapshot of the currently loaded user profile (or null).
  getCurrentUserSync(): UserProfile | null {
    return this.userService.user();
  }

  async getCustomClaims(): Promise<Record<string, any>> {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      return session.tokens?.idToken?.payload as Record<string, any> || {};
    } catch {
      return {};
    }
  }

  async getAssignedBuildings(): Promise<string[]> {
    const claims = await this.getCustomClaims();
    return claims['custom:assigned_buildings'] ? JSON.parse(claims['custom:assigned_buildings']) : [];
  }

  async getUserId(): Promise<string | null> {
    const claims = await this.getCustomClaims();
    return claims['sub'] || null;
  }

  // Alias used by ported timesheet logic — returns the Cognito sub.
  async getCurrentUserId(): Promise<string | null> {
    return this.getUserId();
  }

  async isAdminOrManager(): Promise<boolean> {
    const claims = await this.getCustomClaims();
    const groups = (claims['cognito:groups'] as string[]) || [];
    return groups.includes('user_Admin') || groups.includes('user_Manager');
  }

  async getUserById(cognitoId: string): Promise<Schema['User']['type'] | null> {
    try {
      const { data } = await this.client.models.User.get({ cognitoId });
      return data ?? null;
    } catch {
      return null;
    }
  }
}
