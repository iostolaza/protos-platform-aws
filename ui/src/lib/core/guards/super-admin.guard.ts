import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { OrgContextService } from '../services/org-context.service';

export const superAdminGuard: CanActivateFn = async () => {
  const orgContext = inject(OrgContextService);
  const router = inject(Router);

  await orgContext.resolveOrg();
  if (!orgContext.isSuperAdmin()) {
    return router.createUrlTree(['/main-layout/home']);
  }
  return true;
};
