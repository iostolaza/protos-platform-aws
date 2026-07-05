
/* Edited settings: Add theme arrays/toggles from snippets. */

import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ThemeService } from '@ui';
import { AngularSvgIconModule } from 'angular-svg-icon';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AngularSvgIconModule],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  passwordForm: FormGroup;
  timezone = 'UTC'; // Mock
  language = 'English'; // Mock
  themeColors = [
    { name: 'base', code: '#6E6E6E' },
    { name: 'yellow', code: '#facc15' },
    { name: 'green', code: '#22c55e' },
    { name: 'blue', code: '#2490ff' },
    { name: 'orange', code: '#ea580c' },
    { name: 'red', code: '#cc0033' },
    { name: 'violet', code: '#6e56cf' },
  ];
  themeMode = ['light', 'dark'];

  private fb = inject(FormBuilder);
  themeService = inject(ThemeService);

  constructor() {
    this.passwordForm = this.fb.group({
      current: ['', Validators.required],
      new: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    }, { validators: this.passwordMatch });
  }

  passwordMatch(group: FormGroup) {
    return group.get('new')?.value === group.get('confirm')?.value ? null : { mismatch: true };
  }

  savePassword() {
    if (this.passwordForm.valid) {
      console.log('Password changed');
    }
  }

  setTimezone(event: Event) {
    this.timezone = (event.target as HTMLSelectElement).value;
  }

  setLanguage(event: Event) {
    this.language = (event.target as HTMLSelectElement).value;
  }
  
  toggleThemeMode() {
    this.themeService.toggleThemeMode();
  }

  toggleThemeColor(color: string) {
    this.themeService.toggleThemeColor(color);
  }
}

