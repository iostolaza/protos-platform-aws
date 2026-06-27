import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '../../../core/services/layout.service';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath, IconName } from '../../../core/services/icon-preloader.service';
import { inject } from '@angular/core';

@Component({
  selector: 'lib-mobile-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, AngularSvgIconModule],
  templateUrl: './mobile-menu.component.html'
})
export class MobileMenuComponent {
  layout = inject(LayoutService);
  getIconPath = getIconPath;

  navLinks: Array<{ path: string; icon: IconName; label: string }> = [
    { path: '/main-layout/home', icon: 'chart-pie', label: 'Home' },
    { path: '/main-layout/profile', icon: 'user-circle', label: 'Profile' },
    { path: '/main-layout/settings', icon: 'cog', label: 'Settings' }
  ];
}
