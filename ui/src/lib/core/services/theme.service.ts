import { Injectable, signal, effect } from '@angular/core';

export interface Theme {
  mode: 'light' | 'dark';
  color: 'base' | 'yellow' | 'green' | 'blue' | 'orange' | 'red' | 'violet';
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  public theme = signal<Theme>({ mode: 'light', color: 'base' });
  constructor() {
    this.loadTheme(); // CHANGE: Load first to prioritize localStorage
    if (!localStorage.getItem('theme')) { // CHANGE: Only set prefers if no local
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.theme.update(t => ({ ...t, mode: prefersDark ? 'dark' : 'light' }));
    }
    effect(() => this.setConfig());
    // CHANGE: Add listener for system changes, but only apply if no local theme set
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        this.theme.update(t => ({ ...t, mode: e.matches ? 'dark' : 'light' }));
      }
    });
  }

  private loadTheme() {
    const theme = localStorage.getItem('theme');
    if (theme) this.theme.set(JSON.parse(theme));
  }

  private setConfig() {
    localStorage.setItem('theme', JSON.stringify(this.theme()));
    document.documentElement.className = this.theme().mode;
    document.documentElement.setAttribute('data-theme', this.theme().color);
  }

  public get isDark(): boolean {
    return this.theme().mode === 'dark';
  }

  toggleThemeMode() {
    this.theme.update(theme => ({ ...theme, mode: this.isDark ? 'light' : 'dark' }));
  }

  toggleThemeColor(color: string) {
    if (['base', 'yellow', 'green', 'blue', 'orange', 'red', 'violet'].includes(color)) {
      this.theme.update(theme => ({ ...theme, color: color as Theme['color'] }));
    }
  }
}