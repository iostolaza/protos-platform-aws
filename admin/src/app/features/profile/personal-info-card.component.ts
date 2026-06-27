
// src/app/features/profile/personal-info-card.component.ts
import { Component, effect, signal } from '@angular/core';
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
 
  constructor(private fb: FormBuilder, private userService: UserService) {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
    });
    effect(() => {
      const u = this.userService.user();
      this.user = u;
      this.form.patchValue(u || {});
      this.profileImageUrl = u?.profileImageUrl || '/assets/profile/avatar-default.svg';
    });
  }
  toggleEdit() {
    this.editMode.update(m => !m);
  }
  
  async save() {
    if (this.form.valid && this.user) {
      const updated = { ...this.user, ...this.form.getRawValue() };
      await this.userService.save(updated);
      this.toggleEdit();
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