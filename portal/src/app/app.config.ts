import { ApplicationConfig, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { provideAngularSvgIcon } from 'angular-svg-icon';
import { Amplify } from 'aws-amplify';
import { appRoutes } from './app.routes';
import { provideIconPreload } from './app.icons';
import { provideOrgContext } from '@ui';
import outputs from '../amplify_outputs.json';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideAngularSvgIcon(),
    provideIconPreload(),
    provideAppInitializer(() => {
      try {
        Amplify.configure(outputs as Record<string, unknown>);
      } catch (e) {
        console.warn('Amplify outputs not found — backend not deployed yet', e);
      }
    }),
    provideOrgContext(),
  ],
};
