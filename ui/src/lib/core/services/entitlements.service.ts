import { Injectable, computed, inject, signal } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';
import {
  resolveFeatures,
  ALL_FEATURES,
  VERTICALS,
  isVerticalKey,
  type FeatureKey,
  type VerticalKey,
} from '@shared';
import { OrgContextService } from './org-context.service';
import { RoleService } from './role.service';

@Injectable({ providedIn: 'root' })
export class EntitlementsService {
  private client = generateClient<Schema>();
  private orgContext = inject(OrgContextService);
  private roleService = inject(RoleService);

  private readonly _features = signal<Set<FeatureKey>>(new Set());
  private readonly _vertical = signal<VerticalKey>('full');
  private readonly _resolved = signal(false);

  readonly features = this._features.asReadonly();
  readonly vertical = this._vertical.asReadonly();

  /** PHASE 5 = FAIL OPEN. Phase 6 flips this to false. Do not change it yet. */
  private readonly failOpen = true;

  readonly effective = computed<ReadonlySet<FeatureKey>>(() => {
    if (!this._resolved() && this.failOpen) return new Set(ALL_FEATURES);
    const f = this._features();
    if (f.size === 0 && this.failOpen) return new Set(ALL_FEATURES);
    return f;
  });

  async resolve(): Promise<void> {
    try {
      if (this.roleService.hasGroup('platform_SuperAdmin')) {
        this._features.set(new Set(ALL_FEATURES));
        this._vertical.set('full');
        this._resolved.set(true);
        return;
      }

      const orgId = this.orgContext.getEffectiveOrgId();
      if (!orgId) {
        this._features.set(new Set());
        this._resolved.set(false);
        return;
      }

      const { data: org, errors } = await this.client.models.Organization.get({
        organizationId: orgId,
      });
      if (errors || !org) {
        this._features.set(new Set());
        this._resolved.set(false);
        return;
      }

      this._features.set(
        resolveFeatures({
          vertical: org.vertical,
          plan: org.plan,
          featureOverrides: org.featureOverrides,
        })
      );
      this._vertical.set(
        typeof org.vertical === 'string' && isVerticalKey(org.vertical)
          ? org.vertical
          : 'full'
      );
      this._resolved.set(true);
    } catch (err) {
      console.error('[entitlements] resolve failed:', err);
      this._features.set(new Set());
      this._resolved.set(false);
    }
  }

  has(feature: FeatureKey): boolean {
    return this.effective().has(feature);
  }

  hasAny(...fs: FeatureKey[]): boolean {
    return fs.some((f) => this.effective().has(f));
  }

  term(key: string, fallback: string): string {
    const terminology = VERTICALS[this._vertical()]?.terminology as Record<string, string>;
    return terminology[key] ?? fallback;
  }

  clear(): void {
    this._features.set(new Set());
    this._vertical.set('full');
    this._resolved.set(false);
  }
}
