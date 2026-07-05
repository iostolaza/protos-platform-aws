// src/app/features/profile/contact-prefs-card.component.ts

import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService, UserProfile } from '@ui';

@Component({
  selector: 'app-contact-prefs-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact-prefs-card.component.html',
})
export class ContactPrefsCardComponent {
  editMode = signal(false);
  form: FormGroup;
  user: UserProfile | null = null;

  private fb = inject(FormBuilder);
  private userService = inject(UserService);

  constructor() {
    this.form = this.fb.group({
      email: [false],
      push: [false],
    });
    effect(() => {
      const u = this.userService.user();
      this.user = u;
      this.form.patchValue(u?.contactPrefs || {});
    });
  }

  toggleEdit() {
    this.editMode.update(m => !m);
  }

  async save() {
    if (this.form.valid) {
      await this.userService.updateUser({ contactPrefs: this.form.value });
      this.toggleEdit();
    }
  }
}