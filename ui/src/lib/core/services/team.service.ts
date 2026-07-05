// src/app/core/services/team.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';
import { getCurrentUser } from 'aws-amplify/auth';
import { UserService } from './user.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  private client = generateClient<Schema>();
  public teams = signal<Schema['Team']['type'][]>([]);
  public members = signal<Schema['User']['type'][]>([]);

  private userService = inject(UserService);

  async createTeam(name: string, inviteUserIds: string[]): Promise<Schema['Team']['type']> {
    try {
      const { userId } = await getCurrentUser();
      const leadUser = this.userService.user();
      const teamLeadName = `${leadUser?.firstName || ''} ${leadUser?.lastName || ''}`.trim() || 'Unknown';
      const now = new Date().toISOString();

      const { data: team, errors } = await this.client.models.Team.create({
        name,
        description: '',
        teamLeadCognitoId: userId,
        teamLeadName,
        memberCount: inviteUserIds.length,
        createdAt: now,
        updatedAt: now,
      });
      if (errors) throw new Error(errors.map(e => e.message).join(', '));
      if (!team) throw new Error('Created team is null');

      for (const userId of inviteUserIds) {
        const { errors: memberErrors } = await this.client.models.TeamMember.create({
          teamId: team.id,
          userCognitoId: userId,
          createdAt: now,
          updatedAt: now,
        });
        if (memberErrors) throw new Error(memberErrors.map(e => e.message).join(', '));
      }
      this.teams.update(t => [...t, team]);
      return team;
    } catch (error) {
      console.error('Create team error:', error);
      throw error;
    }
  }

  async getTeams(): Promise<Schema['Team']['type'][]> {
    try {
      const { data, errors } = await this.client.models.Team.list();
      if (errors) throw new Error(errors.map(e => e.message).join(', '));
      this.teams.set(data);
      return data;
    } catch (error) {
      console.error('Get teams error:', error);
      return [];
    }
  }

  async getTeam(id: string): Promise<Schema['Team']['type'] | null> {
    try {
      const { data, errors } = await this.client.models.Team.get({ id });
      if (errors) throw new Error(errors.map(e => e.message).join(', '));
      return data;
    } catch (error) {
      console.error('Get team error:', error);
      return null;
    }
  }

  async updateTeam(id: string, updates: Partial<Omit<Schema['Team']['type'], 'id' | 'createdAt'>>): Promise<Schema['Team']['type']> {
    try {
      const { data, errors } = await this.client.models.Team.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      if (errors) throw new Error(errors.map(e => e.message).join(', '));
      if (!data) throw new Error('Updated team is null');
      this.teams.update(t => t.map(team => team.id === id ? data : team));
      return data;
    } catch (error) {
      console.error('Update team error:', error);
      throw error;
    }
  }

  async deleteTeam(id: string): Promise<void> {
    try {
      const { data: members, errors: memErrors } = await this.client.models.TeamMember.list({ filter: { teamId: { eq: id } } });
      if (memErrors) throw new Error(memErrors.map(e => e.message).join(', '));
      for (const member of members) {
        const { errors: delErrors } = await this.client.models.TeamMember.delete({ id: member.id });
        if (delErrors) throw new Error(delErrors.map(e => e.message).join(', '));
      }
      const { errors } = await this.client.models.Team.delete({ id });
      if (errors) throw new Error(errors.map(e => e.message).join(', '));
      this.teams.update(t => t.filter(team => team.id !== id));
    } catch (error) {
      console.error('Delete team error:', error);
      throw error;
    }
  }

  async getTeamMembers(teamId: string): Promise<Schema['User']['type'][]> {
    try {
      const { data: members, errors } = await this.client.models.TeamMember.list({ filter: { teamId: { eq: teamId } } });
      if (errors) throw new Error(errors.map(e => e.message).join(', '));
      const users = await Promise.all(members.map(async m => {
        const { data: user, errors: userErrors } = await this.client.models.User.get({ cognitoId: m.userCognitoId });
        if (userErrors) throw new Error(userErrors.map(e => e.message).join(', '));
        return user;
      }));
      const nonNullUsers = users.filter((u): u is NonNullable<typeof u> => u !== null);
      this.members.set(nonNullUsers);
      return nonNullUsers;
    } catch (error) {
      console.error('Get members error:', error);
      return [];
    }
  }

  async addMember(teamId: string, userCognitoId: string): Promise<void> {
    try {
      console.log('Adding member:', { teamId, userCognitoId });  // Added log
      const now = new Date().toISOString();
      const { data: newMember, errors } = await this.client.models.TeamMember.create({
        teamId,
        userCognitoId,
        createdAt: now,
        updatedAt: now,
      });
      if (errors) throw new Error(errors.map(e => e.message).join(', '));
      console.log('Member added:', newMember);  // Added log
      const team = await this.getTeam(teamId);
      if (team) {
        await this.updateTeam(teamId, { memberCount: (team.memberCount || 0) + 1 });
      }
      await this.getTeamMembers(teamId);
    } catch (error) {
      console.error('Add member error:', error);
      throw error;
    }
  }

  async removeMember(teamId: string, userCognitoId: string): Promise<void> {
    try {
      console.log('Removing member:', { teamId, userCognitoId });  // Added log
      const { data: member, errors: findErrors } = await this.client.models.TeamMember.list({ filter: { teamId: { eq: teamId }, userCognitoId: { eq: userCognitoId } } });
      if (findErrors) throw new Error(findErrors.map(e => e.message).join(', '));
      if (member[0]) {
        const { data: deleted, errors: delErrors } = await this.client.models.TeamMember.delete({ id: member[0].id });
        if (delErrors) throw new Error(delErrors.map(e => e.message).join(', '));
        console.log('Member removed:', deleted);  // Added log
        const team = await this.getTeam(teamId);
        if (team) {
          await this.updateTeam(teamId, { memberCount: Math.max(0, (team.memberCount || 0) - 1) });
        }
        await this.getTeamMembers(teamId);
      } else {
        console.log('No member found to remove');
      }
    } catch (error) {
      console.error('Remove member error:', error);
      throw error;
    }
  }

  // Real-time observations
  observeTeams(): Observable<{ items: Schema['Team']['type'][] }> {
    return new Observable(observer => {
      const sub = this.client.models.Team.observeQuery().subscribe({
        next: (snapshot) => {
          this.teams.set(snapshot.items);
          observer.next(snapshot);
        },
        error: (err) => observer.error(err),
      });
      return () => sub.unsubscribe();
    });
  }

  observeTeamMembers(teamId: string): Observable<{ items: Schema['TeamMember']['type'][] }> {
    return new Observable(observer => {
      const sub = this.client.models.TeamMember.observeQuery({ filter: { teamId: { eq: teamId } } }).subscribe({
        next: async (snapshot) => {
          const users = await Promise.all(snapshot.items.map(async m => {
            const { data: user } = await this.client.models.User.get({ cognitoId: m.userCognitoId });
            return user;
          }));
          const nonNullUsers = users.filter((u): u is NonNullable<typeof u> => u !== null);
          this.members.set(nonNullUsers);
          observer.next(snapshot);
        },
        error: (err) => observer.error(err),
      });
      return () => sub.unsubscribe();
    });
  }
}