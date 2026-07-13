// ui/src/lib/layouts/sidebar/sidebar.component.ts — icons: getIconPath ✅ (Phase 1 sweep)
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { MenuService } from '../../core/services/menu.service';
import { getIconPath } from '../../core/services/icon-preloader.service';
import { SidebarMenuComponent } from './sidebar-menu/sidebar-menu.component';

@Component({
  selector: 'lib-sidebar',
  standalone: true,
  imports: [NgClass, AngularSvgIconModule, SidebarMenuComponent],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  menuService = inject(MenuService);
  getIconPath = getIconPath;

  mainMenuGroups = computed(() =>
    this.menuService.pagesMenu().filter((group) => group.group !== 'Account')
  );
  accountMenuGroups = computed(() =>
    this.menuService.pagesMenu().filter((group) => group.group === 'Account')
  );

  toggleSidebar() {
    this.menuService.toggleSidebar();
  }
}
