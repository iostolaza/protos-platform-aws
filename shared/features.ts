/** Canonical feature keys stamped in the JWT `features` claim. */
export const FEATURES = {
  MESSAGING: 'messaging',
  CONTACTS: 'contacts',
  TICKETS: 'tickets',
  TICKET_TEAMS: 'ticket.teams',
  DOCUMENTS: 'documents',
  TIMESHEETS: 'timesheets',
  TIMESHEET_REVIEW: 'timesheet.review',
  ACCOUNTS: 'financial.accounts',
  INVOICES: 'invoices',
  EMPLOYEES: 'employees',
  TENANTS: 'tenants',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

const FEATURE_KEY_SET = new Set<string>(Object.values(FEATURES));

export function isFeatureKey(value: string): value is FeatureKey {
  return FEATURE_KEY_SET.has(value);
}

export const ALL_FEATURES: readonly FeatureKey[] = Object.values(FEATURES);

export const FEATURES_CLAIM = 'features';
export const VERTICAL_CLAIM = 'vertical';
export const PLAN_CLAIM = 'plan';

export function serializeFeaturesClaim(features: Iterable<FeatureKey>): string {
  return [...features].join(',');
}

export function parseFeaturesClaim(claim: unknown): Set<FeatureKey> {
  if (typeof claim !== 'string' || !claim.trim()) {
    return new Set();
  }
  const keys = claim
    .split(',')
    .map((s) => s.trim())
    .filter(isFeatureKey);
  return new Set(keys);
}
