/** Canonical feature keys used for org entitlements and route gating. */
export const FEATURES = {
  MESSAGING: 'messaging',
  CONTACTS: 'contacts',
  TICKETS: 'tickets',
  TICKET_TEAMS: 'ticket.teams',
  DOCUMENTS: 'documents',
  TIMESHEETS: 'timesheets',
  TIMESHEET_REVIEW: 'timesheet.review',
  ACCOUNTS: 'financial.accounts',
  BILLING_VIEW: 'financial.billing_view',
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
