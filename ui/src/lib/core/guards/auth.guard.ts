// src/app/core/guards/auth.guard.ts

/*
Description: 
Functional guards for Angular routing to handle authentication.
Uses AWS Amplify to check current user session asynchronously.
authGuard protects routes, noAuthGuard prevents access to public routes if logged in.
Developer: Francisco Ostolaza  
Date Created: August 02, 2025  
Date Updated: August 02, 2025  
References: 
- Angular Docs: https://angular.dev/guide/routing/common-router-tasks#preventing-unauthorized-access
- StackOverflow: https://stackoverflow.com/questions/43557490/angular-4-canactivate-with-observable-boolean
- Amplify Auth: https://docs.amplify.aws/angular/build-a-backend/auth/accessing-credentials/
*/

// Imports
import { CanActivateFn, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { getCurrentUser } from 'aws-amplify/auth';
import { catchError, map, from, of } from 'rxjs';

// authGuard: Allow if authenticated, else redirect to sign-in
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return from(getCurrentUser()).pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/sign-in']))) 
  );
};

// noAuthGuard: Redirect to main if authenticated, else allow
export const noAuthGuard: CanActivateFn = () => {
  const router = inject(Router);
  return from(getCurrentUser()).pipe(
    map(() => router.createUrlTree(['/main-layout/home'])),
    catchError(() => of(true)) 
  );
};
