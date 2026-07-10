import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { getCurrentUser } from 'aws-amplify/auth';
import {
  OrganizationService,
  OrgContextService,
  type OrganizationPlan,
  type OrganizationRecord,
  isValidEmail,
  isValidSlug,
  sanitizeText,
} from '@ui';

function slugValidator(control: AbstractControl): ValidationErrors | null {
  const value = sanitizeText(control.value ?? '').toLowerCase();
  if (!value) {
    return null;
  }
  return isValidSlug(value) ? null : { invalidSlug: true };
}

function emailValidator(control: AbstractControl): ValidationErrors | null {
  const value = sanitizeText(control.value ?? '');
  if (!value) {
    return null;
  }
  return isValidEmail(value) ? null : { invalidEmail: true };
}

@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './organizations.component.html',
})
export class OrganizationsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private organizationService = inject(OrganizationService);
  private orgContext = inject(OrgContextService);

  organizations = signal<OrganizationRecord[]>([]);
  loading = signal(true);
  submitting = signal(false);
  formError = signal<string | null>(null);
  formSuccess = signal(false);
  actingOrgId = this.orgContext.actingOrganizationId;

  readonly plans: OrganizationPlan[] = ['free', 'starter', 'pro', 'enterprise'];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    slug: ['', [Validators.required, slugValidator]],
    plan: ['starter' as OrganizationPlan, Validators.required],
    primaryContactEmail: ['', emailValidator],
  });

  ngOnInit(): void {
    void this.loadOrganizations();
  }

  async loadOrganizations(): Promise<void> {
    this.loading.set(true);
    try {
      const orgs = await this.organizationService.listOrganizations();
      this.organizations.set(
        [...orgs].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      );
    } catch (err) {
      console.error('Failed to load organizations:', err);
      this.organizations.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    this.formError.set(null);
    this.formSuccess.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const name = sanitizeText(raw.name ?? '');
    const slug = sanitizeText(raw.slug ?? '').toLowerCase();
    const plan = raw.plan ?? 'starter';
    const primaryContactEmail = sanitizeText(raw.primaryContactEmail ?? '');

    if (!name || !isValidSlug(slug)) {
      this.formError.set('Please fix validation errors before submitting.');
      return;
    }

    if (primaryContactEmail && !isValidEmail(primaryContactEmail)) {
      this.formError.set('Primary contact email is invalid.');
      return;
    }

    this.submitting.set(true);
    try {
      const available = await this.organizationService.isSlugAvailable(slug);
      if (!available) {
        this.formError.set('This slug is already taken. Choose a different slug.');
        return;
      }

      const currentUser = await getCurrentUser();
      await this.organizationService.createOrganization({
        name,
        slug,
        plan,
        primaryContactEmail: primaryContactEmail || undefined,
        createdBy: currentUser.userId,
      });

      this.formSuccess.set(true);
      this.form.reset({ plan: 'starter', name: '', slug: '', primaryContactEmail: '' });
      await this.loadOrganizations();
    } catch (err) {
      console.error('Failed to create organization:', err);
      this.formError.set(
        err instanceof Error ? err.message : 'Failed to create organization.'
      );
    } finally {
      this.submitting.set(false);
    }
  }

  switchToOrg(org: OrganizationRecord): void {
    this.orgContext.setActingOrgId(org.organizationId);
  }

  clearActingOrg(): void {
    this.orgContext.setActingOrgId(null);
  }

  isActingOrg(org: OrganizationRecord): boolean {
    return this.actingOrgId() === org.organizationId;
  }
}
