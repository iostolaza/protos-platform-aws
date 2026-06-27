import { CommonModule, NgClass, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { SubMenuItem } from '../../../core/models/menu.model';
import { MenuService } from '../../../core/services/menu.service';
import { getIconPath } from '../../../core/services/icon-preloader.service';

@Component({
  selector: 'lib-sidebar-submenu',
  standalone: true,
  imports: [
    CommonModule, NgClass, NgTemplateOutlet,
    RouterLinkActive, RouterLink, AngularSvgIconModule
  ],
  templateUrl: './sidebar-submenu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarSubmenuComponent {
  @Input() public submenu!: SubMenuItem;
  getIconPath = getIconPath;

  menuService = inject(MenuService);

  public toggleMenu(menu: SubMenuItem) {
    this.menuService.toggleSubMenu(menu);
  }
}
