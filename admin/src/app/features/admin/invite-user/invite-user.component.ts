import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AdminService } from '@ui';

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

    try {
      await this.adminService.inviteUser(this.form.value as any);
      this.success = true;
      this.form.reset({
        role: 'Tenant',
        applicationType: 'Employee'
      });
    } catch (err) {
      alert('Failed to send invitation. Check console for details.');
      console.error(err);
    } finally {
      this.loading = false;
    }
  }
}
