// src/app/features/profile/emergency-contact-card.component.ts

import { Component, effect, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService, UserProfile } from '@ui';

@Component({
  selector: 'app-emergency-contact-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './emergency-contact-card.component.html',
})
export class EmergencyContactCardComponent {
  editMode = signal(false);
  form: FormGroup;
  user: UserProfile | null = null;

  constructor(private fb: FormBuilder, private userService: UserService) {
    this.form = this.fb.group({
      name: [''],
      phone: [''],
      email: ['', Validators.email],
      address: [''],
    });
    effect(() => {
      const u = this.userService.user();
      this.user = u;
      this.form.patchValue(u?.emergencyContact || {});
    });
  }

  toggleEdit() {
    this.editMode.update(m => !m);
  }

  async save() {
    if (this.form.valid) {
      await this.userService.updateUser({ emergencyContact: this.form.value });
      this.toggleEdit();
    }
  }
}