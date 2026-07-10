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
