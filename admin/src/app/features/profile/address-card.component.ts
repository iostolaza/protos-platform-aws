// src/app/features/profile/address-card.component.ts

import { Component, effect, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService, UserProfile } from '@ui';

@Component({
  selector: 'app-address-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './address-card.component.html',
})
export class AddressCardComponent {
  editMode = signal(false);
  form: FormGroup;
  user: UserProfile | null = null;

  constructor(private fb: FormBuilder, private userService: UserService) {
    this.form = this.fb.group({
      line1: [''],
      city: [''],
      state: [''],
      zip: [''],
      country: [''],
    });
    effect(() => {
      const u = this.userService.user();
      this.user = u;
      this.form.patchValue(u?.address || {});
    });
  }

  toggleEdit() {
    this.editMode.update(m => !m);
  }

  async save() {
    if (this.form.valid) {
      await this.userService.updateUser({ address: this.form.value });
      this.toggleEdit();
    }
  }
}