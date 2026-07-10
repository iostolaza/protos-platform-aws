import { Injectable, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';
import { OrgContextService } from './org-context.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private client = generateClient<Schema>();
  private orgContext = inject(OrgContextService);

  async inviteUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    role: 'Admin' | 'Manager' | 'Facilities' | 'Tenant';
    applicationType?: 'Tenant' | 'Employee';
  }) {
    const organizationId = this.orgContext.getEffectiveOrgId() ?? undefined;
    const { errors } = await this.client.mutations.adminInviteUser({
      ...data,
      applicationType: data.applicationType ?? 'Employee',
      organizationId,
    });
    if (errors) throw errors;
  }

  async listUsers() {
    const filter = this.orgContext.mergeWithOrgFilter({});
    const { data } = await this.client.models.User.list(
      filter ? { filter } : {}
    );
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
