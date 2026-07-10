import { Injectable, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';
import { OrgContextService } from './org-context.service';
import { INVITE_ROLES, type InviteRole } from '../utils/validation';

export type InviteUserResult = {
  invited: boolean;
  emailSent: boolean;
  userAlreadyExisted?: boolean | null;
  warning?: string | null;
};

function parseInviteUserResult(data: unknown): InviteUserResult {
  if (data && typeof data === 'object' && 'invited' in data) {
    const result = data as InviteUserResult;
    return {
      invited: Boolean(result.invited),
      emailSent: Boolean(result.emailSent),
      userAlreadyExisted: result.userAlreadyExisted ?? false,
      warning: result.warning ?? null,
    };
  }

  if (data === true) {
    return { invited: true, emailSent: true, userAlreadyExisted: false, warning: null };
  }

  throw new Error('Invite succeeded but returned an unexpected response');
}

export const ROLE_GROUPS = ['user_Admin', 'user_Manager', 'user_Facilities', 'user_Tenant'] as const;
export const TENANT_GROUP = 'user_Tenant';
export const EMPLOYEE_GROUP = 'user_Employee';

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
  }): Promise<InviteUserResult> {
    const organizationId = this.orgContext.getEffectiveOrgId() ?? undefined;
    const { data: result, errors } = await this.client.mutations.adminInviteUser({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      applicationType: data.applicationType ?? 'Employee',
      organizationId,
    });
    if (errors?.length) {
      throw errors;
    }

    const inviteResult = parseInviteUserResult(result);

    if (data.rate != null && !Number.isNaN(data.rate)) {
      try {
        await this.updateUserRateByEmail(data.email, data.rate);
      } catch (error) {
        console.warn('Hourly rate update failed after invite (user was still created):', error);
      }
    }

    return inviteResult;
  }

  async listUsers(): Promise<AdminUserRecord[]> {
    const filter = this.orgContext.mergeWithOrgFilter({});
    const { data } = await this.client.models.User.list(filter ? { filter } : {});
    return data ?? [];
  }

  /** Org-scoped users in the user_Tenant Cognito group (portal self-signups). */
  async listTenants(): Promise<AdminUserRecord[]> {
    const users = await this.listUsers();
    const tenants: AdminUserRecord[] = [];

    for (const user of users) {
      const groups = await this.getUserGroups(user.email);
      if (groups.includes(TENANT_GROUP)) {
        tenants.push(user);
      }
    }

    return tenants;
  }

  async getUser(cognitoId: string): Promise<AdminUserRecord | null> {
    const { data, errors } = await this.client.models.User.get({ cognitoId });
    if (errors?.length) {
      throw errors;
    }
    return data ?? null;
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

  /** Promote a portal tenant to staff: user_Tenant → user_Employee + User.role Employee. */
  async promoteTenantToEmployee(email: string): Promise<void> {
    const groups = await this.getUserGroups(email);
    if (!groups.includes(TENANT_GROUP)) {
      throw new Error('User is not in the tenant group');
    }

    await this.removeUserFromGroup(email, TENANT_GROUP);
    await this.addUserToGroup(email, EMPLOYEE_GROUP);
    await this.updateUserRoleField(email, 'Employee');
  }

  isTenantGroupMember(groups: string[]): boolean {
    return groups.includes(TENANT_GROUP);
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
    await this.updateUserRoleField(email, role);
  }

  private async updateUserRoleField(
    email: string,
    role: NonNullable<AdminUserRecord['role']>
  ): Promise<void> {
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
