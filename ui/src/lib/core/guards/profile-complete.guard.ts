import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { UserService } from '../services/user.service';
import { RoleService } from '../services/role.service';

/** Roles that skip portal profile completion (admin invite / staff paths). */
const PROFILE_COMPLETE_EXEMPT_GROUPS = [
  'platform_SuperAdmin',
  'user_Admin',
  'user_Manager',
  'user_Facilities',
  'user_Employee',
] as const;

/**
 * Portal-only guard: tenants with profileComplete === false must finish onboarding.
 * Staff/admin roles and non-tenant groups are not redirected.
 */
export const profileCompleteGuard: CanActivateFn = async () => {
  const userService = inject(UserService);
  const roleService = inject(RoleService);
  const router = inject(Router);

  await roleService.refreshGroups();
  const groups = roleService.getGroups();

  if (groups.some((g) => (PROFILE_COMPLETE_EXEMPT_GROUPS as readonly string[]).includes(g))) {
    return true;
  }

  if (groups.length > 0 && !groups.includes('user_Tenant')) {
    return true;
  }

  if (!userService.user()) {
    await userService.load();
  }

  const user = userService.user();
  if (user?.profileComplete === true) {
    return true;
  }

  return router.createUrlTree(['/complete-profile']);
};
