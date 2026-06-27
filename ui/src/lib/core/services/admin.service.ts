import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private client = generateClient<Schema>();

  async inviteUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    role: 'Admin' | 'Manager' | 'Facilities' | 'Tenant';
    applicationType?: 'Tenant' | 'Employee';
  }) {
    const { errors } = await this.client.mutations.adminInviteUser({
      ...data,
      applicationType: data.applicationType ?? 'Employee',
    });
    if (errors) throw errors;
  }

  async listUsers() {
    const { data } = await this.client.models.User.list({}); // ← Add empty input
    return data ?? [];
  }

  async listGroups(): Promise<string[]> {
    const { data } = await this.client.queries.adminListGroups();
    return (data ?? []).filter((g): g is string => typeof g === 'string');
  }

  async addUserToGroup(email: string, groupName: string) {
    await this.client.mutations.adminAddUserToGroup({ email, groupName });
  }

  async removeUserFromGroup(email: string, groupName: string) {
    await this.client.mutations.adminRemoveUserFromGroup({ email, groupName });
  }

  async getUserGroups(email: string): Promise<string[]> {
    const groups = await this.listGroups();
    const userGroups: string[] = [];

    for (const group of groups) {
      const { data } = await this.client.queries.adminListUsersInGroup({ groupName: group });
      const users = data ?? [];
      if (Array.isArray(users) && users.some((u: any) => u?.email === email)) {
        userGroups.push(group);
      }
    }
    return userGroups;
  }
}
