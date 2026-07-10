import { Injectable } from '@angular/core';
import { sanitizeText } from '../utils/validation';

/** Dev/localhost default org slug — UX hint only, not used for auth. */
const LOCALHOST_DEFAULT_SLUG: string | null = null;

@Injectable({ providedIn: 'root' })
export class SubdomainService {
  /**
   * Parse org slug from hostname (e.g. "companya" from companya.protosadmin.com).
   * On localhost, also accepts ?org=slug for development.
   * Returns null on platform root or localhost without a slug hint.
   */
  getSubdomain(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const hostname = window.location.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const params = new URLSearchParams(window.location.search);
      const orgParam = params.get('org');
      if (orgParam) {
        return sanitizeText(orgParam).toLowerCase();
      }
      return LOCALHOST_DEFAULT_SLUG;
    }

    const parts = hostname.split('.').filter(Boolean);

    // platform root (e.g. protosadmin.com) or bare host
    if (parts.length <= 2) {
      return null;
    }

    const slug = parts[0];
    if (!slug || slug === 'www') {
      return null;
    }

    return slug;
  }
}
