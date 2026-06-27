import { Injectable, signal, effect, Injector, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  showSideBar = signal(true);
  isDarkMode = signal(false);
  showMobileMenu = signal(false);
  private injector = inject(Injector);

  constructor() {
    if (typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDarkMode.set(prefersDark);
      
      this.initializeThemeEffect();
    }
  }

  private initializeThemeEffect() {
    effect(() => {
      const isDark = this.isDarkMode();
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, { injector: this.injector });
  }

  toggleSidebar() { this.showSideBar.update(v => !v); }
  toggleDarkMode() { this.isDarkMode.update(v => !v); }
  toggleMobileMenu() { this.showMobileMenu.update(v => !v); }
}
