import { EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IconPreloaderService } from '@ui';

export function provideIconPreload(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(async () => {
      const svc = inject(IconPreloaderService);
      await firstValueFrom(svc.preloadIcons());
    }),
  ]);
}
