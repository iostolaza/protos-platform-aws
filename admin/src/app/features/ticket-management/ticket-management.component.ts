// src/app/features/ticket-management/ticket-management.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { TicketListComponent } from './ticket-list/ticket-list.component';  
import { TeamListComponent } from './team-list/team-list.component';  
import { GenerateTicketsComponent } from './generate-tickets/generate-tickets.component'; 
import { GenerateTeamComponent } from './generate-team/generate-team.component';  
import { TicketDetailsComponent } from './ticket-details/ticket-details.component';
import { EditTicketComponent } from './edit-ticket/edit-ticket.component';
import { TeamDetailsComponent } from './team-details/team-details.component'; 
import { EditTeamComponent } from './edit-team/edit-team.component';  
import { StatusPipe } from '@ui';  
import { StatusClassPipe } from '@ui';  
import { TicketService } from '@ui';
import { TeamService } from '@ui';
import { signal, computed } from '@angular/core';
import { Subscription } from 'rxjs';
import { TicketStatus } from '@ui';  // Added import

@Component({
  selector: 'app-ticket-management',
  templateUrl: './ticket-management.component.html',
  standalone: true,
  imports: [
    CommonModule, 
    AngularSvgIconModule, 
    TicketListComponent,  
    TeamListComponent,  
    GenerateTicketsComponent, 
    GenerateTeamComponent,
    TicketDetailsComponent,
    EditTicketComponent,
    TeamDetailsComponent,
    EditTeamComponent,  
    StatusPipe,  
    StatusClassPipe,
    DatePipe  
  ],
})
export class TicketManagementComponent implements OnInit, OnDestroy {
  tickets = signal<any[]>([]);
  teams = signal<any[]>([]);  // Added for teams
  selectedTicket = signal<any | null>(null);
  editingTicket = signal<any | null>(null);
  selectedTeam = signal<any | null>(null);
  editingTeam = signal<any | null>(null);
  updatedAgo = signal<string>('a moment ago');  // Added signal
  private subs: Subscription[] = [];

  openTickets = computed(() => this.tickets().filter(t => t.status === TicketStatus.OPEN).length);
  recentTickets = computed(() => 
    this.tickets()
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
  );

  constructor(private ticketService: TicketService, private teamService: TeamService) {
    this.subs.push(
      this.ticketService.observeTickets().subscribe(() => {
        this.loadTickets();
      }),
      this.teamService.observeTeams().subscribe(() => {
        this.loadTeams();  // Added
      })
    );
  }

  async ngOnInit(): Promise<void> {
    await this.loadTickets();
    await this.loadTeams();  // Added
    this.updatedAgo.set(this.computeUpdatedAgo());
  }

  private async loadTickets(): Promise<void> {
    const { tickets } = await this.ticketService.getTickets();
    this.tickets.set(tickets);
  }

  private async loadTeams(): Promise<void> {  // Added method
    this.teams.set(await this.teamService.getTeams());
  }

  viewDetails(ticket: any) {
    this.selectedTicket.set(ticket);
  }

  startEditing(ticket: any) {
    this.editingTicket.set(ticket);
    this.selectedTicket.set(null);
  }

  onTicketUpdate(updated: any) {
    this.editingTicket.set(null);
  }

  viewTeam(team: any) {
    this.selectedTeam.set(team);
  }

  editTeam(team: any) {
    this.editingTeam.set(team);
    this.selectedTeam.set(null);
  }

  onTeamUpdate(updated: any) {
    this.editingTeam.set(null);
  }

  private computeUpdatedAgo(): string {
    const tickets = this.tickets();
    if (tickets.length === 0) return 'never';
    const maxDate = Math.max(...tickets.map(t => new Date(t.createdAt).getTime()));
    const diffMs = Date.now() - maxDate;
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'a moment ago';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  ngOnDestroy() {
    this.subs.forEach(sub => sub.unsubscribe());
  }
}