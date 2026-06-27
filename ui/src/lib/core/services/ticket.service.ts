
// src/app/core/services/ticket.service.ts (UPDATED)

import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';
import { Observable } from 'rxjs';
import { getCurrentUser } from 'aws-amplify/auth';
import { FlatTicket, TicketComment, TicketStatus } from '../models/tickets.model';  

type TicketType = Schema['Ticket']['type'];
// type TeamType = Schema['Team']['type'];
// type TeamMemberType = Schema['TeamMember']['type'];
type UserType = Schema['User']['type'];
type CommentType = Schema['Comment']['type'];

@Injectable({
  providedIn: 'root',
})
export class TicketService {
  private client = generateClient<Schema>();
  private teamMembersCache = new Map<string, UserType[]>();

  async getTicketById(id: string): Promise<FlatTicket | null> {
    const start = performance.now();  // Start timing

      try {
        console.log('Fetching ticket with ID:', id);
        const { data, errors } = await this.client.models.Ticket.get({ id });
        if (errors) throw new Error(`Failed to fetch ticket: ${errors.map(e => e.message).join(', ')}`);
        if (!data) {
          console.log('No ticket found for ID:', id);
          return null;
        }
        const requesterRes = await data.requester();
        const requester = requesterRes.data;
        const assigneeRes = data.assigneeId ? await data.assignee() : { data: null };
        const assignee = assigneeRes.data;
        const teamRes = data.teamId ? await data.team() : { data: null }; 
        const team = teamRes.data;
        const commentsRes = await data.comments();
        const comments = await Promise.all(commentsRes.data.map(async (c: CommentType) => {
          const userRes = await c.user();
          const user = userRes.data;
          return {
            name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Anonymous',
            date: c.createdAt,
            comment: c.content,
          };
        }));
        const ticket: FlatTicket = {
          id: data.id,
          title: data.title,
          description: data.description,
          estimated: data.estimated,
          createdAt: data.createdAt,
          requesterId: data.requesterId,
          status: data.status ? data.status as TicketStatus : TicketStatus.OPEN,  // Cast string to enum
          assigneeId: data.assigneeId,
          teamId: data.teamId,
          labels: data.labels ?? [],
          updatedAt: data.updatedAt ?? '',
          requesterName: `${requester?.firstName ?? ''} ${requester?.lastName ?? ''}`.trim(),
          assigneeName: assignee ? `${assignee.firstName ?? ''} ${assignee.lastName ?? ''}`.trim() : '',
          teamName: team?.name ?? '',
          comments: comments,
        };
        console.log('Ticket fetched:', ticket);
        console.log('Get ticket by ID time:', performance.now() - start, 'ms');
        return ticket;
      } catch (error) {
        console.error('Get ticket by ID error:', error);
        return null;
      }
    }

  async getTickets(nextToken: string | null = null): Promise<{ tickets: FlatTicket[]; nextToken: string | null }> {
      const start = performance.now();  // Start timing
      try {
        const accumulated: FlatTicket[] = [];
        let token = nextToken;
        do {
          console.log('Fetching tickets with nextToken:', token);
          const { data, nextToken: newToken, errors } = await this.client.models.Ticket.list({ nextToken: token ?? undefined });
          if (errors) throw new Error(`Failed to list tickets: ${errors.map(e => e.message).join(', ')}`);
          const extended = await Promise.all(
            data.map(async (t: TicketType) => {
              const requesterRes = await t.requester();
              const requester = requesterRes.data;
              const assigneeRes = t.assigneeId ? await t.assignee() : { data: null };
              const assignee = assigneeRes.data;
              const teamRes = t.teamId ? await t.team() : { data: null }; // Handle optional
              const team = teamRes.data;
              const commentsRes = await t.comments();
              const comments = await Promise.all(commentsRes.data.map(async (c: CommentType) => {
                const userRes = await c.user();
                const user = userRes.data;
                return {
                  name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Anonymous',
                  date: c.createdAt,
                  comment: c.content,
                };
              }));
              return {
                id: t.id,
                title: t.title,
                description: t.description,
                estimated: t.estimated,
                createdAt: t.createdAt,
                requesterId: t.requesterId,
                status: t.status ? t.status as TicketStatus : TicketStatus.OPEN, 
                assigneeId: t.assigneeId,
                teamId: t.teamId,
                labels: t.labels ?? [],
                updatedAt: t.updatedAt ?? '',
                requesterName: `${requester?.firstName ?? ''} ${requester?.lastName ?? ''}`.trim(),
                assigneeName: assignee ? `${assignee.firstName ?? ''} ${assignee.lastName ?? ''}`.trim() : '',
                teamName: team?.name ?? '',
                comments: comments,
              } as FlatTicket;
            })
          );
          accumulated.push(...extended);
          token = newToken ?? null;
        } while (token);
        console.log('All tickets fetched:', accumulated);
        console.log('Get tickets time:', performance.now() - start, 'ms');
        return { tickets: accumulated, nextToken: null };
      } catch (error) {
        console.error('Get tickets error:', error);
        return { tickets: [], nextToken: null };
      }
    }

  async createTicket(ticket: Partial<TicketType>): Promise<TicketType | null> {
      try {
        if (!ticket.title) throw new Error('Missing ticket title');
        if (!ticket.description) throw new Error('Missing ticket description');
        if (!ticket.estimated) throw new Error('Missing ticket estimated date');
        if (!ticket.requesterId) throw new Error('Missing ticket requester ID');

        const payload: Partial<TicketType> = {
          ...ticket,
          status: TicketStatus.OPEN, // Use enum
          assigneeId: undefined, // Optional
          teamId: undefined, // Optional
          labels: [], // Default empty
          createdAt: new Date().toISOString(),
        };

        const { data, errors } = await this.client.models.Ticket.create(payload as TicketType);
        if (errors) throw new Error(`Failed to create ticket: ${errors.map(e => e.message).join(', ')}`);
        console.log('Ticket created:', data);
        return data;
      } catch (error) {
        console.error('Create ticket error:', error);
        return null;
      }
    }

  async updateTicket(ticket: Partial<TicketType>): Promise<TicketType | null> {
      try {
        if (!ticket.id) throw new Error('Ticket ID required for update');
        const payload: Partial<TicketType> = {
          ...ticket,
          updatedAt: new Date().toISOString(),
        };
        const { data, errors } = await this.client.models.Ticket.update(payload as TicketType);
        if (errors) throw new Error(`Failed to update ticket: ${errors.map(e => e.message).join(', ')}`);
        console.log('Ticket updated:', data);
        return data;
      } catch (error) {
        console.error('Update ticket error:', error);
        return null;
      }
    }

  async deleteTicket(id: string): Promise<void> {
    try {
      const { errors } = await this.client.models.Ticket.delete({ id });
      if (errors) throw new Error(`Failed to delete ticket: ${errors.map(e => e.message).join(', ')}`);
      console.log('Ticket deleted:', id);
    } catch (error) {
      console.error('Delete ticket error:', error);
    }
  }

  async addComment(ticketId: string, content: string): Promise<CommentType | null> {
    try {
      const { userId } = await getCurrentUser();
      const now = new Date().toISOString();
      const { data, errors } = await this.client.models.Comment.create({
        content,
        createdAt: now,
        userCognitoId: userId,
        ticketId,
      });
      if (errors) throw new Error(`Failed to add comment: ${errors.map(e => e.message).join(', ')}`);
      console.log('Comment added:', data);
      return data;
    } catch (error) {
      console.error('Add comment error:', error);
      return null;
    }
  }

  // --- Team CRUD Operations ---
//   async getTeams(nextToken: string | null = null): Promise<{ teams: FlatTeam[]; nextToken: string | null }> {
//     try {
//       const accumulated: FlatTeam[] = [];
//       let token = nextToken;
//       do {
//         console.log('Fetching teams with nextToken:', token);
//         const { data, nextToken: newToken, errors } = await this.client.models.Team.list({ nextToken: token ?? undefined });
//         if (errors) throw new Error(`Failed to list teams: ${errors.map(e => e.message).join(', ')}`);
//         const extended = await Promise.all(
//           data.map(async (t: TeamType) => {
//             const leadRes = await t.teamLead();
//             const lead = leadRes.data;
//             const members = await this.getTeamMembers(t.id);
//             return {
//               id: t.id,
//               name: t.name,
//               description: t.description,
//               teamLeadId: t.teamLeadId,
//               createdAt: t.createdAt ?? '',
//               updatedAt: t.updatedAt ?? '',
//               teamLeadName: `${lead?.firstName ?? ''} ${lead?.lastName ?? ''}`.trim(),
//               memberCount: members.length,
//             } as FlatTeam;
//           })
//         );
//         accumulated.push(...extended);
//         token = newToken ?? null;
//       } while (token);
//       console.log('All teams fetched:', accumulated);
//       return { teams: accumulated, nextToken: null };
//     } catch (error) {
//       console.error('Get teams error:', error);
//       return { teams: [], nextToken: null };
//     }
//   }

//   async getUserTeams(userCognitoId: string): Promise<FlatTeam[]> {
//     try {
//       console.log('Fetching user teams for userCognitoId:', userCognitoId);
//       const { data: members, errors } = await this.client.models.TeamMember.listTeamMemberByUserCognitoId(
//         { userCognitoId },
//         { selectionSet: ['teamId'] }  // Select only needed field to avoid required field validation issues
//       );
//       if (errors) throw new Error(`Failed to list team members: ${errors.map(e => e.message).join(', ')}`);
//       console.log('Fetched team members count:', members?.length ?? 0);  // Added debug log
//       if (!members || members.length === 0) {
//         console.log('No team members found for userCognitoId:', userCognitoId);
//         return [];
//       }
//       const teams = await Promise.all(members.map(async (m: { teamId: string }) => {
//         try {
//           const { data: team, errors: teamErrors } = await this.client.models.Team.get({ id: m.teamId });
//           if (teamErrors) throw new Error(`Failed to fetch team: ${teamErrors.map(e => e.message).join(', ')}`);
//           if (!team) return null;
//           const { data: lead, errors: leadErrors } = await this.client.models.User.get({ cognitoId: team.teamLeadId });
//           if (leadErrors) throw new Error(`Failed to fetch lead: ${leadErrors.map(e => e.message).join(', ')}`);
//           return {
//             id: team.id,
//             name: team.name,
//             description: team.description,
//             teamLeadId: team.teamLeadId,
//             createdAt: team.createdAt ?? '',
//             updatedAt: team.updatedAt ?? '',
//             teamLeadName: `${lead?.firstName ?? ''} ${lead?.lastName ?? ''}`.trim(),
//           } as FlatTeam;
//         } catch (teamErr) {
//           console.error('Error fetching team for TeamMember:', { teamMember: m, error: (teamErr as Error).message });
//           return null;
//         }
//       }));
//       const filteredTeams = teams.filter((t): t is FlatTeam => t !== null);
//       console.log('User teams fetched:', filteredTeams);
//       return filteredTeams;
//     } catch (error) {
//       console.error('Get user teams error:', (error as Error).message);
//       return [];
//     }
//   }

// async getTeamMembers(teamId: string): Promise<UserType[]> {
//     try {
//       if (this.teamMembersCache.has(teamId)) {
//         console.log('Returning cached members for teamId:', teamId);
//         return this.teamMembersCache.get(teamId)!;
//       }
//       console.log('Fetching members for teamId:', teamId);
//       const { data: members, errors } = await this.client.queries.listTeamMembersByTeamId({
//         teamId
//       });
//       if (errors) {
//         console.error('TeamMember fetch errors:', errors);
//         throw new Error(`Failed to list team members: ${errors.map((e: { message: string }) => e.message).join(', ')}`);  
//       }
//       console.log('Fetched team members count:', members?.length ?? 0);  
//       const users = await Promise.all((members ?? []).map(async (m) => {  
//         try {
//           const { data: user, errors: userErrors } = await this.client.models.User.get({ cognitoId: m!.userCognitoId });  // CHANGE: Added non-null assertion m! to assure TS m is not null/undefined; safe as m from array map
//           if (userErrors) throw new Error(`Failed to fetch user: ${userErrors.map((e: { message: string }) => e.message).join(', ')}`);  
//           return user;
//         } catch (userErr) {
//           console.error('Error fetching user for TeamMember:', { teamMember: m, error: (userErr as Error).message });
//           return null;
//         }
//       }));
//       const filteredUsers = users.filter((u): u is NonNullable<typeof u> => u !== null);  
//       this.teamMembersCache.set(teamId, filteredUsers); // Cache the result
//       console.log('Team members fetched:', filteredUsers); 
//       return filteredUsers;
//     } catch (error) {
//       console.error('Get team members error:', (error as Error).message);
//       return [];
//     }
//   }
 
//   async createTeam(team: Partial<TeamType>): Promise<TeamType | null> {
//     try {
//       if (!team.name) throw new Error('Missing team name');
//       if (!team.teamLeadId) throw new Error('Missing team lead ID');
//       const { data, errors } = await this.client.models.Team.create({
//         ...team,
//       } as TeamType);
//       if (errors) throw new Error(`Failed to create team: ${errors.map(e => e.message).join(', ')}`);
//       console.log('Team created:', data);
//       return data;
//     } catch (error) {
//       console.error('Create team error:', error);
//       return null;
//     }
//   }

//   async updateTeam(team: Partial<TeamType>): Promise<TeamType | null> {
//     try {
//       if (!team.id) throw new Error('Team ID required for update');
//       const validUpdate = {
//         id: team.id,
//         name: team.name,
//         description: team.description,
//         updatedAt: new Date().toISOString(),
//       };
//       const { data, errors } = await this.client.models.Team.update(validUpdate as TeamType);
//       if (errors) throw new Error(`Failed to update team: ${errors.map(e => e.message).join(', ')}`);
//       console.log('Team updated:', data);
//       // Invalidate cache for this team
//       if (team.id) this.teamMembersCache.delete(team.id);
//       return data;
//     } catch (error) {
//       console.error('Update team error:', error);
//       return null;
//     }
//   }

//   async addTeamMember(teamId: string, userCognitoId: string): Promise<TeamMemberType | null> {
//       try {
//         const { userId: currentUserId } = await getCurrentUser();  // Get lead ID (caller is lead)
//         console.log('Adding team member:', { teamId, userCognitoId, owner: currentUserId });
//         const { data, errors } = await this.client.models.TeamMember.create({ 
//           teamId, 
//           userCognitoId,
//           owner: currentUserId  // Set owner to lead's Cognito ID
//         });
//         if (errors) {
//           console.error('Add team member errors:', errors);
//           throw new Error(`Failed to add team member: ${errors.map(e => e.message).join(', ')}`);
//         }
//         console.log('Team member added:', data);
//         // Invalidate cache for this team
//         this.teamMembersCache.delete(teamId);
//         return data;
//       } catch (error) {
//         console.error('Add team member error:', error);
//         return null;
//       }
//     }
  
//   async deleteTeamMember(teamId: string, userCognitoId: string): Promise<void> {
//       try {
//         console.log('Deleting team member:', { teamId, userCognitoId });
//         const { errors } = await this.client.models.TeamMember.delete({ teamId, userCognitoId });
//         if (errors) throw new Error(`Failed to delete team member: ${errors.map(e => e.message).join(', ')}`);
//         console.log('Team member deleted:', { teamId, userCognitoId });
//         // Invalidate cache for this team
//         this.teamMembersCache.delete(teamId);
//       } catch (error) {
//         console.error('Delete team member error:', error);
//       }
//     }

//   async deleteTeam(id: string): Promise<void> {
//     try {
//       console.log('Deleting team with ID:', id);
//       const { errors } = await this.client.models.Team.delete({ id });
//       if (errors) throw new Error(`Failed to delete team: ${errors.map(e => e.message).join(', ')}`);
//       console.log('Team deleted:', id);
//       // Remove from cache
//       this.teamMembersCache.delete(id);
//     } catch (error) {
//       console.error('Delete team error:', error);
//     }
//   }

  // --- Real-Time Subscriptions ---
  observeTickets(): Observable<void> {
    return new Observable(observer => {
      console.log('Subscribing to ticket updates');
      const sub = this.client.models.Ticket.observeQuery().subscribe({
        next: () => {
          console.log('Ticket update observed');
          observer.next();
        },
        error: (err) => {
          console.error('Observe tickets error:', err);
          observer.error(err);
        },
      });
      return () => {
        console.log('Unsubscribing from ticket updates');
        sub.unsubscribe();
      };
    });
  }

  observeTeams(): Observable<void> {
    return new Observable(observer => {
      console.log('Subscribing to team updates');
      const sub = this.client.models.Team.observeQuery().subscribe({
        next: () => {
          console.log('Team update observed');
          observer.next();
        },
        error: (err) => {
          console.error('Observe teams error:', err);
          observer.error(err);
        },
      });
      return () => {
        console.log('Unsubscribing from team updates');
        sub.unsubscribe();
      };
    });
  }
}