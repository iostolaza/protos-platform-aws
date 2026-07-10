const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORG_ID_REGEX = /^[a-f0-9-]{36}$/i;

export const VALID_INVITE_ROLES = ['Admin', 'Manager', 'Facilities', 'Tenant'] as const;
export type InviteRole = (typeof VALID_INVITE_ROLES)[number];

export function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

export function isValidEmail(input: string): boolean {
  const sanitized = sanitizeText(input);
  return EMAIL_REGEX.test(sanitized) && sanitized.length <= 320;
}

export function isValidOrgId(input: string): boolean {
  return ORG_ID_REGEX.test(sanitizeText(input));
}

export function isValidInviteRole(role: string): role is InviteRole {
  return (VALID_INVITE_ROLES as readonly string[]).includes(role);
}
