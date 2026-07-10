import { Injectable, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';
import { OrgContextService } from './org-context.service';
import { isValidSlug, sanitizeText } from '../utils/validation';

/** Org resolved from subdomain for portal self-signup. */
export type PortalOrganization = Pick<
  OrganizationRecord,
  'organizationId' | 'name' | 'slug' | 'status'
>;

export type OrganizationPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type OrganizationRecord = Schema['Organization']['type'];

const ACTIVE_ORG_STATUSES = new Set(['active', 'trial']);

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private client = generateClient<Schema>();
  private publicClient = generateClient<Schema>({ authMode: 'apiKey' });
  private orgContext = inject(OrgContextService);

  /**
   * Look up an active organization by slug for unauthenticated portal signup.
   * Returns null for unknown or suspended orgs.
   */
  async getActiveOrganizationBySlug(slug: string): Promise<PortalOrganization | null> {
    const normalized = sanitizeText(slug).toLowerCase();
    if (!isValidSlug(normalized)) {
      return null;
    }

    const { data, errors } = await this.publicClient.models.Organization.listOrganizationBySlug({
      slug: normalized,
    });
    if (errors?.length) {
      throw errors;
    }

    const org = data?.[0];
    if (!org?.organizationId || !org.status || !ACTIVE_ORG_STATUSES.has(org.status)) {
      return null;
    }

    return {
      organizationId: org.organizationId,
      name: org.name,
      slug: org.slug,
      status: org.status,
    };
  }

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
