import { Injectable, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';
import { OrgContextService } from './org-context.service';
import { isValidSlug, sanitizeText } from '../utils/validation';

export type OrganizationPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type OrganizationRecord = Schema['Organization']['type'];

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private client = generateClient<Schema>();
  private orgContext = inject(OrgContextService);

  async listOrganizations(): Promise<OrganizationRecord[]> {
    if (!this.orgContext.isSuperAdmin()) {
      throw new Error('Only platform Super Admins can list organizations');
    }
    const { data, errors } = await this.client.models.Organization.list();
    if (errors?.length) {
      throw errors;
    }
    return data ?? [];
  }

  async isSlugAvailable(slug: string): Promise<boolean> {
    const normalized = sanitizeText(slug).toLowerCase();
    if (!isValidSlug(normalized)) {
      return false;
    }
    const { data, errors } = await this.client.models.Organization.listOrganizationBySlug({
      slug: normalized,
    });
    if (errors?.length) {
      throw errors;
    }
    return (data?.length ?? 0) === 0;
  }

  async createOrganization(input: {
    name: string;
    slug: string;
    plan: OrganizationPlan;
    primaryContactEmail?: string;
    createdBy: string;
  }): Promise<OrganizationRecord> {
    if (!this.orgContext.isSuperAdmin()) {
      throw new Error('Only platform Super Admins can create organizations');
    }

    const slug = sanitizeText(input.slug).toLowerCase();
    const available = await this.isSlugAvailable(slug);
    if (!available) {
      throw new Error('An organization with this slug already exists');
    }

    const { data, errors } = await this.client.models.Organization.create({
      organizationId: crypto.randomUUID(),
      name: sanitizeText(input.name),
      slug,
      plan: input.plan,
      status: 'trial',
      primaryContactEmail: input.primaryContactEmail
        ? sanitizeText(input.primaryContactEmail)
        : undefined,
      createdAt: new Date().toISOString(),
      createdBy: sanitizeText(input.createdBy),
    });

    if (errors?.length || !data) {
      throw errors ?? new Error('Failed to create organization');
    }
    return data;
  }
}
