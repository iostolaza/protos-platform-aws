import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { RoleService } from '../services/role.service';
import { Router } from '@angular/router';

export const adminGuard: CanActivateFn = async () => {
  const roleService = inject(RoleService);
  const router = inject(Router);

  await roleService.refreshGroups();
  if (!roleService.isAdmin$()) {
    return router.createUrlTree(['/main-layout/home']);
  }
  return true;
};
