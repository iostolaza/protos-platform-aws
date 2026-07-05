// src/app/features/ticket-management/generate-team/generate-team.component.ts

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormArray, ValidationErrors, AbstractControl } from '@angular/forms';
import { TicketService } from '@ui';
import { UserService } from '@ui';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '@amplify-schema';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath } from '@ui';
import { TeamService } from '@ui';

@Component({
  selector: 'app-generate-team',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AngularSvgIconModule], 
  templateUrl: './generate-team.component.html',
})
export class GenerateTeamComponent {
  form: FormGroup;
  users = signal<any[]>([]);
  loadingUsers = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
   getIconPath = getIconPath;

  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private teamService = inject(TeamService);

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      inviteUserIds: this.fb.array([]),
    });
    this.loadUsers();
  }

  get inviteUserIds(): FormArray {
    return this.form.get('inviteUserIds') as FormArray;
  }

  addInvite() {
    this.inviteUserIds.push(this.fb.control(''));
  }

  removeInvite(index: number) {
    this.inviteUserIds.removeAt(index);
  }

  async loadUsers() {
    this.loadingUsers.set(true);
    this.users.set(await this.userService.getAllUsers());
    this.loadingUsers.set(false);
  }

  async submit() {
    if (this.form.invalid) return;
    try {
      const { name, inviteUserIds } = this.form.value;
      await this.teamService.createTeam(name, inviteUserIds);
      this.successMessage.set('Team created successfully!');
      this.form.reset();
    } catch (error) {
      this.errorMessage.set((error as Error).message);
    }
  }

}












// export class GenerateTeamComponent implements OnInit {
//   form!: FormGroup;
//   users = signal<Schema['User']['type'][]>([]);
//   errorMessage = signal('');
//   successMessage = signal('');
//   loadingUsers = signal(true);
//   getIconPath = getIconPath;

//   constructor(
//     private fb: FormBuilder,
//     private ticketService: TicketService,
//     private userService: UserService
//   ) {
//     this.form = this.fb.group({
//       name: ['', [Validators.required, Validators.minLength(4)]],
    
//       inviteUserIds: this.fb.array([], { validators: this.uniqueInvitesValidator }),
//     });
//   }

//   get inviteUserIds(): FormArray {
//     return this.form.get('inviteUserIds') as FormArray;
//   }

//   uniqueInvitesValidator = (array: AbstractControl): ValidationErrors | null => {
//     const values = (array as FormArray).controls.map(control => control.value);
//     const hasDuplicates = values.some((value, index) => value && values.indexOf(value) !== index);
//     return hasDuplicates ? { duplicateInvites: true } : null;
//   };

//   addInvite(): void {
//     this.inviteUserIds.push(this.fb.control('', Validators.required));
//     this.inviteUserIds.updateValueAndValidity();
//     console.log('Added invite, current FormArray:', this.inviteUserIds.controls);
//   }

//   removeInvite(index: number): void {
//     this.inviteUserIds.removeAt(index);
//     this.inviteUserIds.updateValueAndValidity();
//     console.log('Removed invite at index:', index);
//   }

//   async ngOnInit() {
//     this.loadingUsers.set(true);
//     try {
//       const users = await this.userService.getAllUsers();
//       this.users.set(users);
//       console.log('Users loaded:', users);
//       if (users.length === 0) {
//         this.errorMessage.set('No users available. Add users in Cognito first.');
//       }
//     } catch (err) {
//       console.error('Load users error:', err);
//       this.errorMessage.set('Failed to load users');
//     } finally {
//       this.loadingUsers.set(false);
//     }
//   }

//   async submit() {
//     if (this.form.invalid) {
//       const errors = [];
//       if (this.form.get('name')?.errors) errors.push('Name is required and must be at least 4 characters');
//       if (this.form.get('inviteUserIds')?.hasError('duplicateInvites')) errors.push('Duplicate user invites detected');
//       this.errorMessage.set(`Form invalid: ${errors.join(', ')}`);
//       console.log('Form invalid, value:', this.form.value);
//       return;
//     }
//     this.successMessage.set('');
//     this.errorMessage.set('');
//     try {
//       const { userId } = await getCurrentUser();
//       const values = this.form.value;
//       const team = {
//         name: values.name,
//         teamLeadId: userId,
//       }; // Remove description
//       const newTeam = await this.ticketService.createTeam(team);
//       if (newTeam) {
//         await this.ticketService.addTeamMember(newTeam.id, userId);
//         if (values.inviteUserIds.length > 0) {
//           for (const inviteId of values.inviteUserIds) {
//             await this.ticketService.addTeamMember(newTeam.id, inviteId);
//           }
//         }
//         this.form.reset();
//         this.inviteUserIds.clear();
//         this.successMessage.set('Team created successfully');
//         console.log('Team created successfully:', newTeam);
//       }
//     } catch (err) {
//       console.error('Submit error:', err);
//       this.errorMessage.set('Failed to create team');
//     }
//   }
// }