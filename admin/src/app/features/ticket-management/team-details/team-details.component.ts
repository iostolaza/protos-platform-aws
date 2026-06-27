// src/app/features/ticket-management/team-details/team-details.component.ts

import { Component, Input, Output, OnInit, signal, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TicketService } from '@ui';
import type { Schema } from '@amplify-schema';
import { FlatTeam } from '@ui';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath } from '@ui';
import { TeamService } from '@ui';

type UserType = Schema['User']['type'];



@Component({
  selector: 'app-team-details',
  standalone: true,
  imports: [CommonModule, DatePipe, AngularSvgIconModule],
  templateUrl: './team-details.component.html',
})
export class TeamDetailsComponent {
  @Input() team!: any;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<any>();

  members = signal<any[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  getIconPath = getIconPath;

  constructor(private teamService: TeamService) {}

  ngOnInit() {
    this.loadMembers();
  }

  async loadMembers() {
    this.loading.set(true);
    try {
      this.members.set(await this.teamService.getTeamMembers(this.team.id));
    } catch (error) {
      this.error.set((error as Error).message);
    }
    this.loading.set(false);
  }

  deleteTeam(id: string) {
    if (confirm('Are you sure?')) {
      this.teamService.deleteTeam(id);
      this.close.emit();
    }
  }
}





















// @Component({
//   selector: 'app-team-details',
//   standalone: true,
//   imports: [CommonModule, DatePipe,  AngularSvgIconModule],
//   templateUrl: './team-details.component.html',
// })
// export class TeamDetailsComponent implements OnInit {
//   @Input() team!: FlatTeam;
//   @Output() close = new EventEmitter<void>();
//   @Output() edit = new EventEmitter<FlatTeam>();  

//   members = signal<UserType[]>([]);
//   loading = signal(true);
//   error = signal<string | null>(null);
//   getIconPath = getIconPath;

//   constructor(private ticketService: TicketService) {}

//   async ngOnInit() {
//     try {
//       this.loading.set(true);
//       const members = await this.ticketService.getTeamMembers(this.team.id);
//       this.members.set(members || []);
//     } catch (err) {
//       this.error.set((err as Error).message || 'Failed to load members');
//     } finally {
//       this.loading.set(false);
//     }
//   }

//   async deleteTeam(id: string) {
//     if (confirm('Delete team? This is permanent.')) {
//       try {
//         await this.ticketService.deleteTeam(id);
//         this.close.emit();
//       } catch (err) {
//         this.error.set((err as Error).message || 'Failed to delete team');
//       }
//     }
//   }
// }