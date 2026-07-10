import { inject, provideAppInitializer } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';
import { OrgContextService } from '../services/org-context.service';

/** Resolve org from JWT after Amplify is configured; safe when logged out. */
export function provideOrgContext() {
  return provideAppInitializer(() => {
    const orgContext = inject(OrgContextService);
    return (async () => {
      try {
        await fetchAuthSession();
        await orgContext.resolveOrg();
      } catch {
        orgContext.clearOrg();
      }
    })();
  });
}
