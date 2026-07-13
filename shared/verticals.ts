import { ALL_FEATURES, FEATURES, type FeatureKey } from './features';

export const VERTICALS = {
  full: {
    label: 'Full Platform',
    features: ALL_FEATURES,
    terminology: {} as Record<string, string>,
  },
  hoa: {
    label: 'HOA',
    features: [
      FEATURES.MESSAGING,
      FEATURES.CONTACTS,
      FEATURES.TICKETS,
      FEATURES.DOCUMENTS,
      FEATURES.ACCOUNTS,
      FEATURES.INVOICES,
      FEATURES.TENANTS,
    ] as FeatureKey[],
    terminology: {
      tenant: 'Homeowner',
      tenants: 'Homeowners',
    },
  },
  property: {
    label: 'Property Management',
    features: [
      FEATURES.MESSAGING,
      FEATURES.CONTACTS,
      FEATURES.TICKETS,
      FEATURES.TICKET_TEAMS,
      FEATURES.DOCUMENTS,
      FEATURES.TIMESHEETS,
      FEATURES.TIMESHEET_REVIEW,
      FEATURES.ACCOUNTS,
      FEATURES.INVOICES,
      FEATURES.EMPLOYEES,
      FEATURES.TENANTS,
    ] as FeatureKey[],
    terminology: {
      tenant: 'Resident',
      tenants: 'Residents',
    },
  },
} as const;

export type VerticalKey = keyof typeof VERTICALS;

const VERTICAL_KEY_SET = new Set<string>(Object.keys(VERTICALS));

export function isVerticalKey(value: string): value is VerticalKey {
  return VERTICAL_KEY_SET.has(value);
}
