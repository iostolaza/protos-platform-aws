import { FEATURES, type FeatureKey } from './features';

export const ORGANIZATION_PLANS = ['free', 'starter', 'pro', 'enterprise'] as const;
export type OrganizationPlan = (typeof ORGANIZATION_PLANS)[number];

const FREE_FEATURES = [
  FEATURES.MESSAGING,
  FEATURES.DOCUMENTS,
  FEATURES.BILLING_VIEW,
] as const;

const STARTER_FEATURES = [
  ...FREE_FEATURES,
  FEATURES.TICKETS,
  FEATURES.CONTACTS,
] as const;

const PRO_FEATURES = [
  ...STARTER_FEATURES,
  FEATURES.TICKET_TEAMS,
  FEATURES.TIMESHEETS,
  FEATURES.TIMESHEET_REVIEW,
  FEATURES.ACCOUNTS,
  FEATURES.INVOICES,
  FEATURES.EMPLOYEES,
  FEATURES.TENANTS,
] as const;

/** '*' = no ceiling; the vertical's full grant passes through. */
export const PLAN_ALLOWLIST: Record<OrganizationPlan, readonly FeatureKey[] | '*'> = {
  free: FREE_FEATURES,
  starter: STARTER_FEATURES,
  pro: PRO_FEATURES,
  enterprise: '*',
};
