const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ORG_ID_REGEX = /^[a-f0-9-]{36}$/i;

/** Strip HTML tags and trim whitespace from user-supplied text. */
export function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

export function isValidEmail(input: string): boolean {
  const sanitized = sanitizeText(input);
  return EMAIL_REGEX.test(sanitized) && sanitized.length <= 320;
}

export function isValidSlug(input: string): boolean {
  const sanitized = sanitizeText(input).toLowerCase();
  return SLUG_REGEX.test(sanitized) && sanitized.length >= 2 && sanitized.length <= 64;
}

export function isValidOrgId(input: string): boolean {
  const sanitized = sanitizeText(input);
  return ORG_ID_REGEX.test(sanitized);
}

export const INVITE_ROLES = ['Admin', 'Manager', 'Facilities', 'Tenant'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export function isValidInviteRole(role: string): role is InviteRole {
  return (INVITE_ROLES as readonly string[]).includes(role);
}

/** Extract a human-readable message from Amplify GraphQL / Lambda errors. */
export function formatGraphqlError(err: unknown): string {
  if (Array.isArray(err)) {
    const messages = err
      .map((item) => {
        if (item && typeof item === 'object' && 'message' in item) {
          return String((item as { message: unknown }).message);
        }
        return String(item);
      })
      .filter(Boolean);
    if (messages.length > 0) {
      return messages.join('; ');
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }

  return String(err);
}
