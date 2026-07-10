import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AdminService, formatGraphqlError } from '@ui';

@Component({
  selector: 'app-invite-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './invite-user.component.html',
  styles: []
})
export class InviteUserComponent {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminService);

  loading = false;
  success = false;
  successMessage = '';
  errorMessage = '';

  form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['Tenant', Validators.required],
    applicationType: ['Employee'],
  });

  async onSubmit() {
    if (this.form.invalid) return;

    this.loading = true;
    this.success = false;
    this.successMessage = '';
    this.errorMessage = '';

    try {
      const result = await this.adminService.inviteUser(this.form.value as any);
      this.success = true;
      if (!result.emailSent) {
        this.successMessage =
          result.warning ??
          'User created — invite email was not sent (SES not configured or recipient not verified).';
      } else if (result.warning) {
        this.successMessage = result.warning;
      }
      this.form.reset({
        role: 'Tenant',
        applicationType: 'Employee'
      });
    } catch (err) {
      this.errorMessage = formatGraphqlError(err);
      console.error(err);
    } finally {
      this.loading = false;
    }
  }
}
