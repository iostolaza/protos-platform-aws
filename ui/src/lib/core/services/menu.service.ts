import { Injectable, OnDestroy, signal, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Menu } from '../constants/menu';
import { MenuItem, SubMenuItem } from '../models/menu.model';
import { AuthService } from './auth.service';
import { EntitlementsService } from './entitlements.service';
import { RoleService } from './role.service';

@Injectable({
  providedIn: 'root',
})
export class MenuService implements OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private entitlements = inject(EntitlementsService);
  private roleService = inject(RoleService);

  private _showSidebar = signal(true);
  private _showMobileMenu = signal(false);
  private _pagesMenu = signal<MenuItem[]>([]);
  private _currentUrl = signal<string>(this.router.url);
  private _expandedKeys = signal<Set<string>>(new Set());
  private _subscription = new Subscription();

  constructor() {
    this._pagesMenu.set(Menu.pages);
    const sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this._currentUrl.set(event.urlAfterRedirects);
      }
    });
    this._subscription.add(sub);
  }

  get showSideBar() { return this._showSidebar(); }
  set showSideBar(value: boolean) {
    this._showSidebar.set(value);
    if (!value) this.collapseAll();
  }

  get showMobileMenu() { return this._showMobileMenu(); }
  set showMobileMenu(value: boolean) { this._showMobileMenu.set(value); }

  readonly pagesMenu = computed<MenuItem[]>(() => {
    this._currentUrl();
    this.entitlements.effective();
    this.roleService.groupList();
    const expandedKeys = this._expandedKeys();

    return this._pagesMenu()
      .filter((group) => this.visible(group))
      .map((group) => {
        const items = group.items
          .filter((item) => this.visible(item))
          .map((item) => this.mapSubMenuItem(item, expandedKeys))
          .filter((item) => item.route !== null || (item.children?.length ?? 0) > 0);

        const active = items.some((item) => item.active || item.children?.some((c) => c.active));
        return { ...group, items, active };
      })
      .filter((group) => group.items.length > 0);
  });

  public setMenu(menu: MenuItem[]) {
    this._pagesMenu.set(menu);
  }

  public toggleSidebar() {
    this._showSidebar.set(!this._showSidebar());
  }

  public toggleMenu(menu: SubMenuItem) {
    this.showSideBar = true;
    const keys = new Set(this._expandedKeys());
    if (keys.has(menu.label)) {
      keys.delete(menu.label);
    } else {
      keys.clear();
      keys.add(menu.label);
    }
    this._expandedKeys.set(keys);
  }

  public toggleSubMenu(submenu: SubMenuItem) {
    const keys = new Set(this._expandedKeys());
    if (keys.has(submenu.label)) {
      keys.delete(submenu.label);
    } else {
      keys.add(submenu.label);
    }
    this._expandedKeys.set(keys);
  }

  private visible(item: SubMenuItem | MenuItem): boolean {
    const featureOk = !item.feature || this.entitlements.has(item.feature);
    const groupOk = !item.groups || item.groups.some((g) => this.roleService.hasGroup(g));
    return featureOk && groupOk;
  }

  private mapSubMenuItem(item: SubMenuItem, expandedKeys: Set<string>): SubMenuItem {
    const active = this.isActive(item.route);
    const expanded = active || expandedKeys.has(item.label);
    const children = item.children
      ?.filter((child) => this.visible(child))
      .map((child) => ({
        ...child,
        active: this.isActive(child.route),
      }));

    return { ...item, active, expanded, children };
  }

  private collapseAll() {
    this._expandedKeys.set(new Set());
  }

  public isActive(instruction: string | null | undefined): boolean {
    if (!instruction) return false;
    return this.router.isActive(this.router.createUrlTree([instruction]), {
      paths: 'subset',
      queryParams: 'subset',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  }

  public async logout(): Promise<void> {
    this.showMobileMenu = false;
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
    await this.router.navigateByUrl('/sign-in');
  }

  ngOnDestroy(): void {
    this._subscription.unsubscribe();
  }
}
