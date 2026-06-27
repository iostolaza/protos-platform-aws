
// src/app/features/auth/sign-in/sign-in.component.ts
import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';  
import { Router } from '@angular/router';
import { Hub } from 'aws-amplify/utils';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, AmplifyAuthenticatorModule],
  templateUrl: './sign-in.component.html',
})
export class SignInComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private authenticator = inject(AuthenticatorService);
  isLoading = signal(true);

  private hubUnsubscribe: (() => void) | undefined;

  async ngOnInit() {
    this.isLoading.set(true);
    this.hubUnsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') {
        this.router.navigate(['/main-layout/home']);
      }
    });
  
    if (await this.authenticator.authStatus === 'authenticated') {
      this.router.navigate(['/main-layout/home']);
    }
    this.isLoading.set(false);
  }

  ngOnDestroy() {
    if (this.hubUnsubscribe) this.hubUnsubscribe();
  }
}
