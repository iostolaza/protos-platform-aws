
// src/app/features/profile/personal-info-card.component.ts
import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService, UserProfile } from '@ui';

@Component({
  selector: 'app-personal-info-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './personal-info-card.component.html',
})
export class PersonalInfoCardComponent {
  editMode = signal(false);
  form: FormGroup;
  user: UserProfile | null = null;
  profileImageUrl: string | null = null;

  private fb = inject(FormBuilder);
  private userService = inject(UserService);

  constructor() {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      username: [''],
    });
    effect(() => {
      const u = this.userService.user();
      this.user = u;
      this.form.patchValue({
        firstName: u?.firstName ?? '',
        lastName: u?.lastName ?? '',
        username: u?.username ?? '',
      });
      this.profileImageUrl = u?.profileImageUrl || '/assets/profile/avatar-default.svg';
    });
  }

  toggleEdit() {
    this.editMode.update((m) => !m);
  }

  async save() {
    if (!this.form.valid || !this.user) return;
    try {
      await this.userService.save(this.form.getRawValue());
      this.toggleEdit();
    } catch (err) {
      console.error('Profile save failed:', err);
    }
  }

  async uploadImage(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file && this.user) {
      const key = await this.userService.uploadProfileImage(file);
      if (key) {
        const updated = { ...this.user, profileImageKey: key };
        await this.userService.save(updated);
      }
    }
  }
}
