// src/app/features/ticket-management/edit-team/edit-team.component.ts

import { Component, Input, Output, OnInit, OnDestroy, inject, signal, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormsModule, FormGroup, Validators } from '@angular/forms';  // Added Validators
import { UserService } from '@ui';
import { TeamService } from '@ui';
import type { Schema } from '@amplify-schema';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath } from '@ui';
import { Subscription } from 'rxjs';

type UserType = Schema['User']['type'];

@Component({
  selector: 'app-team-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, AngularSvgIconModule],
  templateUrl: './edit-team.component.html',
})
export class EditTeamComponent implements OnInit, OnDestroy {
  @Input() team!: any;
  @Output() update = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;
  members = signal<any[]>([]);
  users = signal<any[]>([]);
  selectedUserId = '';
  errorMessage = signal<string | null>(null);
  getIconPath = getIconPath;
  private subs: Subscription[] = [];

  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private teamService = inject(TeamService);

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
    });
  }

  ngOnInit() {
    this.form.patchValue(this.team);
    this.loadMembers();
    this.loadUsers();
    this.subs.push(
      this.teamService.observeTeamMembers(this.team.id).subscribe(() => {
        this.loadMembers();
      })
    );
  }

  async loadMembers() {
    this.members.set(await this.teamService.getTeamMembers(this.team.id));
  }

  async loadUsers() {
    this.users.set(await this.userService.getAllUsers());
  }

  async updateTeam() {
    if (this.form.invalid) {
      this.errorMessage.set('Form invalid: Name is required');
      return;
    }
    try {
      // Add selected member if any
      if (this.selectedUserId) {
        await this.teamService.addMember(this.team.id, this.selectedUserId);
        this.selectedUserId = '';
      }
      const updated = await this.teamService.updateTeam(this.team.id, this.form.value);
      this.update.emit(updated);
    } catch (error) {
      this.errorMessage.set((error as Error).message);
    }
  }

  async addMember() {
    if (!this.selectedUserId) return;
    try {
      await this.teamService.addMember(this.team.id, this.selectedUserId);
      this.selectedUserId = '';
    } catch (error) {
      this.errorMessage.set((error as Error).message);
    }
  }

  async removeMember(cognitoId: string) {
    try {
      await this.teamService.removeMember(this.team.id, cognitoId);
    } catch (error) {
      this.errorMessage.set((error as Error).message);
    }
  }

  ngOnDestroy() {
    this.subs.forEach(sub => sub.unsubscribe());
  }
}