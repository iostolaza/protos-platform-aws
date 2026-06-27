// src/app/features/profile/vehicle-card.component.ts

import { Component, effect, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService, UserProfile } from '@ui';

@Component({
  selector: 'app-vehicle-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vehicle-card.component.html',
})
export class VehicleCardComponent {
  editMode = signal(false);
  form: FormGroup;
  user: UserProfile | null = null;

  constructor(private fb: FormBuilder, private userService: UserService) {
    this.form = this.fb.group({
      make: [''],
      model: [''],
      color: [''],
      license: [''],
      year: [null, Validators.pattern(/^\d{4}$/)],
    });
    effect(() => {
      const u = this.userService.user();
      this.user = u;
      this.form.patchValue(u?.vehicle || {});
    });
  }

  toggleEdit() {
    this.editMode.update(m => !m);
  }

  async save() {
    if (this.form.valid) {
      await this.userService.updateUser({ vehicle: this.form.value });
      this.toggleEdit();
    }
  }
}