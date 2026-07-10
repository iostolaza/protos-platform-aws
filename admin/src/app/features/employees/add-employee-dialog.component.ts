import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { AdminService, isValidEmail, sanitizeText, type InviteRole } from '@ui';

function emailValidator(control: AbstractControl): ValidationErrors | null {
  const value = sanitizeText(control.value ?? '');
  if (!value) {
    return null;
  }
  return isValidEmail(value) ? null : { invalidEmail: true };
}

@Component({
  selector: 'app-add-employee-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div class="border-b border-gray-200 px-6 py-4">
          <h2 class="text-xl font-bold text-gray-900">Add Employee</h2>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4 px-6 py-5">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="emp-firstName" class="block text-sm font-medium text-gray-700">First Name</label>
              <input
                id="emp-firstName"
                formControlName="firstName"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label for="emp-lastName" class="block text-sm font-medium text-gray-700">Last Name</label>
              <input
                id="emp-lastName"
                formControlName="lastName"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label for="emp-email" class="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="emp-email"
              type="email"
              formControlName="email"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            @if (form.controls.email.touched && form.controls.email.errors?.['invalidEmail']) {
              <p class="mt-1 text-sm text-red-600">Enter a valid email address.</p>
            }
          </div>

          <div>
            <label for="emp-role" class="block text-sm font-medium text-gray-700">Role</label>
            <select
              id="emp-role"
              formControlName="role"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              @for (role of roles; track role) {
                <option [value]="role">{{ role }}</option>
              }
            </select>
          </div>

          <div>
            <label for="emp-rate" class="block text-sm font-medium text-gray-700">Hourly Rate (optional)</label>
            <input
              id="emp-rate"
              type="number"
              min="0"
              step="0.01"
              formControlName="rate"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          @if (errorMessage()) {
            <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {{ errorMessage() }}
            </div>
          }

          <div class="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              (click)="dialogClosed.emit()"
              class="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              [disabled]="form.invalid || loading()"
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {{ loading() ? 'Inviting...' : 'Send Invitation' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class AddEmployeeDialogComponent {
  @Output() dialogClosed = new EventEmitter<void>();
  @Output() invited = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private adminService = inject(AdminService);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  roles = this.adminService.inviteRoles;

  form = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(80)]],
    lastName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, emailValidator]],
    role: ['Manager' as InviteRole, Validators.required],
    rate: [null as number | null, [Validators.min(0)]],
  });

  async onSubmit(): Promise<void> {
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const firstName = sanitizeText(raw.firstName ?? '');
    const lastName = sanitizeText(raw.lastName ?? '');
    const email = sanitizeText(raw.email ?? '');
    const role = raw.role as InviteRole;
    const rate = raw.rate != null && raw.rate !== ('' as unknown as number) ? Number(raw.rate) : null;

    if (!firstName || !lastName || !isValidEmail(email)) {
      this.errorMessage.set('Please fix validation errors before submitting.');
      return;
    }

    this.loading.set(true);
    try {
      await this.adminService.inviteUser({
        firstName,
        lastName,
        email,
        role,
        applicationType: 'Employee',
        rate,
      });
      this.invited.emit();
      this.dialogClosed.emit();
    } catch (err) {
      console.error('Invite failed:', err);
      this.errorMessage.set('Failed to send invitation. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
