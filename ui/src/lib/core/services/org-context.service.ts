import { Injectable, signal } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';

export type OrgFilter = Record<string, unknown>;

/** Sentinel that cannot match a real organizationId — fail-closed for unassigned users. */
export const NO_ORG_SENTINEL = '__NO_ORG__';

@Injectable({ providedIn: 'root' })
export class OrgContextService {
  private readonly organizationId = signal<string | null>(null);
  private readonly actingOrgId = signal<string | null>(null);
  private readonly superAdmin = signal(false);
  private warnedNoOrg = false;

  readonly orgId = this.organizationId.asReadonly();
  readonly actingOrganizationId = this.actingOrgId.asReadonly();

  /** Read organizationId from JWT — token is the source of truth. */
  async resolveOrg(): Promise<void> {
    this.warnedNoOrg = false;
    try {
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload ?? {};
      const orgId = typeof payload['organizationId'] === 'string' ? payload['organizationId'] : null;
      this.organizationId.set(orgId || null);
      this.superAdmin.set(this.hasSuperAdminGroup(payload));
      this.warnIfNoOrgForRegularUser('resolveOrg');
    } catch {
      this.organizationId.set(null);
      this.superAdmin.set(false);
    }
  }

  clearOrg(): void {
    this.organizationId.set(null);
    this.actingOrgId.set(null);
    this.superAdmin.set(false);
    this.warnedNoOrg = false;
  }

  getOrgId(): string | null {
    return this.organizationId();
  }

  isSuperAdmin(): boolean {
    return this.superAdmin();
  }

  setActingOrgId(orgId: string | null): void {
    this.actingOrgId.set(orgId);
    this.warnedNoOrg = false;
  }

  getEffectiveOrgId(): string | null {
    return this.actingOrgId() ?? this.organizationId();
  }

  /**
   * Fail-closed org filter for list/query operations.
   * - Super Admin, no actingOrgId → null (no filter, see all orgs)
   * - Super Admin, actingOrgId set → filter by actingOrgId
   * - Regular user, org present → filter by org
   * - Regular user, no org → sentinel filter (matches nothing)
   */
  getOrgFilterClause(): OrgFilter | null {
    if (this.isSuperAdmin() && !this.actingOrgId()) {
      return null;
    }

    const orgId = this.getEffectiveOrgId();
    if (orgId) {
      return { organizationId: { eq: orgId } };
    }

    this.warnIfNoOrgForRegularUser('getOrgFilterClause');
    return { organizationId: { eq: NO_ORG_SENTINEL } };
  }

  /** Merge org filter into an existing Amplify filter without replacing it. */
  mergeWithOrgFilter<T extends OrgFilter>(existing?: T | null): T | OrgFilter | undefined {
    const orgClause = this.getOrgFilterClause();
    if (!orgClause) {
      return existing ?? undefined;
    }
    if (!existing || Object.keys(existing).length === 0) {
      return orgClause as T;
    }
    return { and: [existing, orgClause] };
  }

  /** Stamp value for create operations. Throws if no org context is available. */
  stampOrgId<T extends Record<string, unknown>>(payload: T): T & { organizationId: string } {
    const orgId = this.getEffectiveOrgId();
    if (!orgId) {
      throw new Error('organizationId is required to create records but none is set in context');
    }
    return { ...payload, organizationId: orgId };
  }

  private warnIfNoOrgForRegularUser(source: string): void {
    if (this.isSuperAdmin() || this.getEffectiveOrgId() || this.warnedNoOrg) {
      return;
    }
    this.warnedNoOrg = true;
    console.warn(
      `[OrgContextService] Non-super-admin user has no organizationId in token (${source}). ` +
        'Queries are fail-closed — results will be empty until org is assigned.'
    );
  }

  private hasSuperAdminGroup(payload: Record<string, unknown>): boolean {
    const cognitoGroups = payload['cognito:groups'];
    if (Array.isArray(cognitoGroups) && cognitoGroups.includes('platform_SuperAdmin')) {
      return true;
    }
    const groupsClaim = payload['groups'];
    if (typeof groupsClaim === 'string') {
      return groupsClaim.split(',').includes('platform_SuperAdmin');
    }
    return false;
  }
}
