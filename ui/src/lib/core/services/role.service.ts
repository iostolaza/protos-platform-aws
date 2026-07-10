import { Injectable, signal, computed } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private groups = signal<string[]>([]);

  public isAdmin$ = computed(() => this.groups().includes('user_Admin'));
  public isManager$ = computed(() => this.groups().includes('user_Manager'));
  public isTenant$ = computed(() => this.groups().includes('user_Tenant'));
  public isFacilities$ = computed(() => this.groups().includes('user_Facilities'));

  async refreshGroups(): Promise<void> {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      const groups = (session.tokens?.idToken?.payload['cognito:groups'] as string[]) || [];
      this.groups.set(groups);
    } catch (err) {
      console.error('Failed to refresh groups', err);
      this.groups.set([]);
    }
  }

  getGroups(): string[] {
    return this.groups();
  }

  hasGroup(group: string): boolean {
    return this.groups().includes(group);
  }

  clearGroups(): void {
    this.groups.set([]);
  }
}
