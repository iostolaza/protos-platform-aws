
// src/app/features/auth/sign-in.component.ts
import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';
import { Router } from '@angular/router';
import { Hub } from 'aws-amplify/utils';
import { signUp } from 'aws-amplify/auth';
import {
  OrganizationService,
  SubdomainService,
  type PortalOrganization,
} from '@ui';

type SignUpFormData = { username: string; password: string };

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, AmplifyAuthenticatorModule],
  templateUrl: './sign-in.component.html',
})
export class SignInComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private authenticator = inject(AuthenticatorService);
  private subdomainService = inject(SubdomainService);
  private organizationService = inject(OrganizationService);

  isLoading = signal(true);
  orgError = signal<string | null>(null);
  portalOrg = signal<PortalOrganization | null>(null);

  services = {
    handleSignUp: async ({ username, password }: SignUpFormData) => {
      const org = this.portalOrg();
      if (!org) {
        throw new Error(this.orgError() ?? 'Invalid organization');
      }

      return signUp({
        username,
        password,
        options: {
          userAttributes: {
            email: username,
            'custom:organizationId': org.organizationId,
          },
          autoSignIn: true,
        },
      });
    },
  };

  private hubUnsubscribe: (() => void) | undefined;

  async ngOnInit() {
    this.isLoading.set(true);
    await this.resolvePortalOrganization();

    this.hubUnsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') {
        this.router.navigate(['/main-layout/home']);
      }
    });

    if ((await this.authenticator.authStatus) === 'authenticated') {
      this.router.navigate(['/main-layout/home']);
    }
    this.isLoading.set(false);
  }

  ngOnDestroy() {
    if (this.hubUnsubscribe) {
      this.hubUnsubscribe();
    }
  }

  private async resolvePortalOrganization(): Promise<void> {
    const slug = this.subdomainService.getSubdomain();
    if (!slug) {
      this.orgError.set(
        'Invalid organization. Sign up is only available from your organization portal URL (e.g. companya.example.com).'
      );
      this.portalOrg.set(null);
      return;
    }

    try {
      const org = await this.organizationService.getActiveOrganizationBySlug(slug);
      if (!org) {
        this.orgError.set(
          'Invalid organization. This portal URL is not recognized or the organization is suspended.'
        );
        this.portalOrg.set(null);
        return;
      }

      this.portalOrg.set(org);
      this.orgError.set(null);
    } catch (err) {
      console.error('Organization lookup failed:', err);
      this.orgError.set('Unable to verify organization. Please try again later.');
      this.portalOrg.set(null);
    }
  }
}
