import { Injectable, signal, computed } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';
import {
  parseFeaturesClaim,
  FEATURES_CLAIM,
  VERTICAL_CLAIM,
  ALL_FEATURES,
  VERTICALS,
  isVerticalKey,
  type FeatureKey,
  type VerticalKey,
} from '@shared';

@Injectable({ providedIn: 'root' })
export class EntitlementsService {
  private readonly _features = signal<Set<FeatureKey>>(new Set());
  private readonly _vertical = signal<VerticalKey>('full');
  private readonly _resolved = signal(false);

  readonly features = this._features.asReadonly();
  readonly vertical = this._vertical.asReadonly();

  /**
   * PHASE 5 = FAIL OPEN. If the claim is missing, grant everything.
   * PHASE 6 flips this to fail closed. Do not change it yet.
   */
  private readonly failOpen = true;

  readonly effective = computed<ReadonlySet<FeatureKey>>(() => {
    if (!this._resolved() && this.failOpen) return new Set(ALL_FEATURES);
    const f = this._features();
    if (f.size === 0 && this.failOpen) return new Set(ALL_FEATURES);
    return f;
  });

  async resolve(): Promise<void> {
    try {
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload ?? {};
      this._features.set(parseFeaturesClaim(payload[FEATURES_CLAIM]));
      const v = payload[VERTICAL_CLAIM];
      this._vertical.set(typeof v === 'string' && isVerticalKey(v) ? v : 'full');
      this._resolved.set(true);
    } catch {
      this._features.set(new Set());
      this._vertical.set('full');
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
    const terminology = VERTICALS[this._vertical()].terminology as Record<string, string>;
    return terminology[key] ?? fallback;
  }

  clear(): void {
    this._features.set(new Set());
    this._vertical.set('full');
    this._resolved.set(false);
  }
}
