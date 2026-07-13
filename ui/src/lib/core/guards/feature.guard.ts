import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { EntitlementsService } from '../services/entitlements.service';
import type { FeatureKey } from '@shared';

/**
 * canMatch (not canActivate) so the lazy chunk is never downloaded for
 * orgs that lack the feature. canActivate would still fetch the bundle.
 */
export function featureGuard(feature: FeatureKey): CanMatchFn {
  return () => {
    const ent = inject(EntitlementsService);
    const router = inject(Router);
    return ent.has(feature) ? true : router.createUrlTree(['/main-layout/home']);
  };
}
