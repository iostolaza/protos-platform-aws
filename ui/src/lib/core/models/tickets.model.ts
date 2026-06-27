// src/app/core/models/tickets.model.ts

import { InputContact as User } from './contact';

export enum TicketStatus {
  OPEN = 'OPEN',
  QUEUED = 'QUEUED',  // Added missing from union
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETE = 'COMPLETE',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  labels?: string[];
  status: TicketStatus;  // Use enum
  estimated: Date;
  createdAt: Date;
  updatedAt?: Date;
  startDate?: Date;
  completionDate?: Date;
  requesterId: string;
  requester?: User;
  assigneeId?: string;
  assignee?: User;
  teamId?: string; 
  team?: Team;
  attachments?: string[];
  comments?: Comment[];
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  teamLeadId: string;
  teamLead?: User;
  members?: TeamMember[];
  tickets?: Ticket[];
}

export interface TeamMember {
  teamId: string;
  userId: string;
  team?: Team;
  user?: User;
}

export interface Comment {
  content: string;
  createdAt: Date;
  userId: string;
  user?: User;
  ticketId: string;
  ticket?: Ticket;
}

export interface Notification {
  content: string;
  createdAt: Date;
  type: 'team' | 'ticket' | 'viewTeam';
  nameType?: string;
  userId: string;
  user?: User;
  isRead: boolean;
}

export interface TicketComment {
  name: string;
  date: string; // Use string for ISO
  comment: string;
}

export interface FlatTicket {
  id: string;
  title: string;
  description: string;
  estimated: string;
  createdAt: string;
  requesterId: string;
  status: TicketStatus;
  assigneeId?: string | null;
  teamId?: string | null;
  labels?: (string | null)[] | null;
  updatedAt?: string | null;
  requesterName?: string;
  assigneeName?: string;
  teamName?: string;
  comments?: TicketComment[];
}

export interface FlatTeam {
  id: string;
  name: string;
  description?: string | null;
  teamLeadId: string;
  createdAt?: string;
  updatedAt?: string;
  teamLeadName?: string;
  memberCount?: number;
}