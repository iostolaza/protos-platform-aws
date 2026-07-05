// src/app/features/ticket-management/team-list/team-list.component.ts

import { Component, Output, EventEmitter, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath } from '@ui';
import { TeamService } from '@ui';
import { EditTeamComponent } from '../edit-team/edit-team.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-team-list',
  standalone: true,
  imports: [CommonModule, AngularSvgIconModule, EditTeamComponent],
  templateUrl: './team-list.component.html',
})
export class TeamListComponent implements OnDestroy {
  @Output() view = new EventEmitter<any>();
  @Output() edit = new EventEmitter<any>();
  getIconPath = getIconPath;

  teams = signal<any[]>([]);
  editingTeam = signal<any | null>(null);
  private sub?: Subscription;

  private teamService = inject(TeamService);

  constructor() {
    this.loadTeams();
    this.sub = this.teamService.observeTeams().subscribe(() => {
      this.loadTeams();
    });
  }

  async loadTeams() {
    this.teams.set(await this.teamService.getTeams());
  }

  viewTeam(team: any) {
    this.view.emit(team);
  }

  onTeamUpdate(updated: any) {
    this.loadTeams();
    this.editingTeam.set(null);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}