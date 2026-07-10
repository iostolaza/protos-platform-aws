import { Injectable, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';
import { OrgContextService } from './org-context.service';
import { INVITE_ROLES, type InviteRole } from '../utils/validation';

export const ROLE_GROUPS = ['user_Admin', 'user_Manager', 'user_Facilities', 'user_Tenant'] as const;

export const ROLE_TO_GROUP: Record<InviteRole, string> = {
  Admin: 'user_Admin',
  Manager: 'user_Manager',
  Facilities: 'user_Facilities',
  Tenant: 'user_Tenant',
};

export const GROUP_TO_ROLE: Record<string, InviteRole> = {
  user_Admin: 'Admin',
  user_Manager: 'Manager',
  user_Facilities: 'Facilities',
  user_Tenant: 'Tenant',
};

export type AdminUserRecord = Schema['User']['type'];

@Injectable({ providedIn: 'root' })
export class AdminService {
  private client = generateClient<Schema>();
  private orgContext = inject(OrgContextService);

  readonly inviteRoles = INVITE_ROLES;

  async inviteUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    role: InviteRole;
    applicationType?: 'Tenant' | 'Employee';
    rate?: number | null;
  }) {
    const organizationId = this.orgContext.getEffectiveOrgId() ?? undefined;
    const { errors } = await this.client.mutations.adminInviteUser({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      applicationType: data.applicationType ?? 'Employee',
      organizationId,
    });
    if (errors) {
      throw errors;
    }

    if (data.rate != null && !Number.isNaN(data.rate)) {
      await this.updateUserRateByEmail(data.email, data.rate);
    }
  }

  async listUsers(): Promise<AdminUserRecord[]> {
    const filter = this.orgContext.mergeWithOrgFilter({});
    const { data } = await this.client.models.User.list(filter ? { filter } : {});
    return data ?? [];
  }

  async listGroups(): Promise<string[]> {
    const { data } = await this.client.queries.adminListGroups();
    return (data ?? []).filter((g): g is string => typeof g === 'string');
  }

  async addUserToGroup(email: string, groupName: string) {
    const { errors } = await this.client.mutations.adminAddUserToGroup({ email, groupName });
    if (errors) {
      throw errors;
    }
  }

  async removeUserFromGroup(email: string, groupName: string) {
    const { errors } = await this.client.mutations.adminRemoveUserFromGroup({ email, groupName });
    if (errors) {
      throw errors;
    }
  }

  async disableUser(email: string) {
    const { errors } = await this.client.mutations.adminDisableUser({ email });
    if (errors) {
      throw errors;
    }
    await this.updateUserStatusByEmail(email, 'disabled');
  }

  async enableUser(email: string) {
    const { errors } = await this.client.mutations.adminEnableUser({ email });
    if (errors) {
      throw errors;
    }
    await this.updateUserStatusByEmail(email, 'active');
  }

  async changeUserRole(email: string, newRole: InviteRole) {
    const newGroup = ROLE_TO_GROUP[newRole];
    const currentGroups = await this.getUserGroups(email);

    for (const group of currentGroups) {
      if ((ROLE_GROUPS as readonly string[]).includes(group)) {
        await this.removeUserFromGroup(email, group);
      }
    }

    await this.addUserToGroup(email, newGroup);
    await this.updateUserRoleByEmail(email, newRole);
  }

  async getUserGroups(email: string): Promise<string[]> {
    const groups = await this.listGroups();
    const userGroups: string[] = [];

    for (const group of groups) {
      const { data } = await this.client.queries.adminListUsersInGroup({ groupName: group });
      const users = data ?? [];
      if (Array.isArray(users) && users.some((u: { email?: string }) => u?.email === email)) {
        userGroups.push(group);
      }
    }
    return userGroups;
  }

  getPrimaryRole(groups: string[]): InviteRole | null {
    for (const group of ROLE_GROUPS) {
      if (groups.includes(group)) {
        return GROUP_TO_ROLE[group];
      }
    }
    return null;
  }

  private async updateUserRateByEmail(email: string, rate: number): Promise<void> {
    const user = await this.findUserByEmail(email);
    if (!user) {
      return;
    }
    const { errors } = await this.client.models.User.update({ cognitoId: user.cognitoId, rate });
    if (errors) {
      throw errors;
    }
  }

  private async updateUserStatusByEmail(email: string, status: string): Promise<void> {
    const user = await this.findUserByEmail(email);
    if (!user) {
      return;
    }
    const { errors } = await this.client.models.User.update({ cognitoId: user.cognitoId, status });
    if (errors) {
      throw errors;
    }
  }

  private async updateUserRoleByEmail(email: string, role: InviteRole): Promise<void> {
    const user = await this.findUserByEmail(email);
    if (!user) {
      return;
    }
    const { errors } = await this.client.models.User.update({ cognitoId: user.cognitoId, role });
    if (errors) {
      throw errors;
    }
  }

  private async findUserByEmail(email: string): Promise<AdminUserRecord | null> {
    const { data } = await this.client.models.User.listUserByEmail({ email });
    return data?.[0] ?? null;
  }
}
