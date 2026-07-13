import { type FeatureKey } from './features';
import { VERTICALS, type VerticalKey } from './verticals';
import { PLAN_ALLOWLIST, type OrganizationPlan } from './plans';

export interface OrgEntitlementInput {
  vertical?: VerticalKey | string | null;
  plan?: OrganizationPlan | string | null;
  featureOverrides?: readonly (string | null)[] | null;
}

/** Pure. Never throws. Unknown vertical or plan degrades to an empty set. */
export function resolveFeatures(input: OrgEntitlementInput): Set<FeatureKey> {
  const preset = VERTICALS[input.vertical as VerticalKey];
  const base = new Set<FeatureKey>(preset?.features ?? []);

  for (const o of input.featureOverrides ?? []) {
    if (!o || o.length < 2) continue;
    const key = o.slice(1) as FeatureKey;
    if (o.startsWith('+')) base.add(key);
    else if (o.startsWith('-')) base.delete(key);
  }

  const allow = PLAN_ALLOWLIST[input.plan as OrganizationPlan];
  if (allow === undefined) return new Set();
  if (allow === '*') return base;
  return new Set([...base].filter((f) => allow.includes(f)));
}
