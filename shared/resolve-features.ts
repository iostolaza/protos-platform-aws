import { isFeatureKey, type FeatureKey } from './features';
import { VERTICALS, isVerticalKey, type VerticalKey } from './verticals';

export type ResolveFeaturesInput = {
  vertical?: string | null;
  plan?: string | null;
  featureOverrides?: string[] | null;
};

/**
 * Resolve the effective feature set for an organization.
 * `vertical: 'full'` grants every feature (Phase 5 default for all orgs).
 */
export function resolveFeatures(input: ResolveFeaturesInput): Set<FeatureKey> {
  const vertical: VerticalKey =
    input.vertical && isVerticalKey(input.vertical) ? input.vertical : 'full';

  const features = new Set<FeatureKey>(VERTICALS[vertical].features);

  for (const override of input.featureOverrides ?? []) {
    if (!override) continue;
    if (override.startsWith('-') && isFeatureKey(override.slice(1))) {
      features.delete(override.slice(1) as FeatureKey);
    } else if (override.startsWith('+') && isFeatureKey(override.slice(1))) {
      features.add(override.slice(1) as FeatureKey);
    } else if (isFeatureKey(override)) {
      features.add(override);
    }
  }

  // Plan-based trimming is Phase 6+; keep all resolved features for now.
  void input.plan;

  return features;
}
