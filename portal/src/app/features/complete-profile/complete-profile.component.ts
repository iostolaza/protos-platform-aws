import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, sanitizeText, isValidEmail } from '@ui';

function emailValidator(control: AbstractControl): ValidationErrors | null {
  const value = sanitizeText(control.value ?? '');
  if (!value) {
    return null;
  }
  return isValidEmail(value) ? null : { invalidEmail: true };
}

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './complete-profile.component.html',
})
export class CompleteProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private router = inject(Router);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(80)]],
    lastName: ['', [Validators.required, Validators.maxLength(80)]],
    phone: ['', [Validators.maxLength(32)]],
    addressLine1: ['', [Validators.maxLength(120)]],
    city: ['', [Validators.maxLength(80)]],
    state: ['', [Validators.maxLength(40)]],
    zip: ['', [Validators.maxLength(20)]],
    country: ['', [Validators.maxLength(80)]],
    emergencyName: ['', [Validators.maxLength(80)]],
    emergencyPhone: ['', [Validators.maxLength(32)]],
    emergencyEmail: ['', emailValidator],
    emergencyAddress: ['', [Validators.maxLength(200)]],
  });

  ngOnInit(): void {
    void this.prefillFromUser();
  }

  private async prefillFromUser(): Promise<void> {
    if (!this.userService.user()) {
      await this.userService.load();
    }
    const user = this.userService.user();
    if (!user) {
      return;
    }

    this.form.patchValue({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phone: user.emergencyContact?.phone ?? '',
      addressLine1: user.address?.line1 ?? '',
      city: user.address?.city ?? '',
      state: user.address?.state ?? '',
      zip: user.address?.zip ?? '',
      country: user.address?.country ?? '',
      emergencyName: user.emergencyContact?.name ?? '',
      emergencyPhone: user.emergencyContact?.phone ?? '',
      emergencyEmail: user.emergencyContact?.email ?? '',
      emergencyAddress: user.emergencyContact?.address ?? '',
    });
  }

  async onSubmit(): Promise<void> {
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const emergencyEmail = sanitizeText(raw.emergencyEmail ?? '');
    if (emergencyEmail && !isValidEmail(emergencyEmail)) {
      this.errorMessage.set('Emergency contact email is invalid.');
      return;
    }

    this.loading.set(true);
    try {
      await this.userService.updateUser({
        firstName: sanitizeText(raw.firstName ?? ''),
        lastName: sanitizeText(raw.lastName ?? ''),
        address: {
          line1: sanitizeText(raw.addressLine1 ?? ''),
          city: sanitizeText(raw.city ?? ''),
          state: sanitizeText(raw.state ?? ''),
          zip: sanitizeText(raw.zip ?? ''),
          country: sanitizeText(raw.country ?? ''),
        },
        emergencyContact: {
          name: sanitizeText(raw.emergencyName ?? ''),
          phone: sanitizeText(raw.phone ?? '') || sanitizeText(raw.emergencyPhone ?? ''),
          email: emergencyEmail || undefined,
          address: sanitizeText(raw.emergencyAddress ?? ''),
        },
        profileComplete: true,
      });
      await this.router.navigate(['/main-layout/home']);
    } catch (err) {
      console.error('Profile completion failed:', err);
      this.errorMessage.set('Failed to save your profile. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
