import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MenuService } from '../../../core/services/menu.service';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath } from '../../../core/services/icon-preloader.service';
import { UserService } from '../../../core/services/user.service';
import { computed, signal } from '@angular/core';

type ProfileItem = { title: string; icon: 'user-circle' | 'cog' | 'arrow-right-on-rectangle'; route?: string; action?: 'logout' };

@Component({
  selector: 'lib-profile-menu',
  standalone: true,
  imports: [CommonModule, AngularSvgIconModule],
  templateUrl: './profile-menu.component.html',
  animations: [
    trigger('openClose', [
      state('open', style({ opacity: 1, transform: 'scaleY(1)' })),
      state('closed', style({ opacity: 0, transform: 'scaleY(0)' })),
      transition('open => closed', [animate('0.2s')]),
      transition('closed => open', [animate('0.2s')]),
    ]),
  ],
})
export class ProfileMenuComponent implements OnInit {
  private router = inject(Router);
  private menuService = inject(MenuService);
  private userService = inject(UserService);
  user = computed(() => this.userService.user());
  fullName = computed(() => {
    const u = this.user();
    return u ? `${u.firstName} ${u.lastName}`.trim() || u.username || 'User' : 'User';
  });
  getIconPath = getIconPath;
  isOpen = signal(false);
  profileMenu = signal<ProfileItem[]>([
    { title: 'Profile', icon: 'user-circle', route: '/main-layout/profile' },
    { title: 'Settings', icon: 'cog', route: '/main-layout/settings' },
    { title: 'Logout', icon: 'arrow-right-on-rectangle', action: 'logout' }
  ]);

  toggleMenu() {
    this.isOpen.update((v) => {
      console.log('Toggling to', !v);
      return !v;
    });
  }

  onMenuItemClick(item: ProfileItem) {
    if (item.route) {
      this.router.navigate([item.route]);
    } else if (item.action === 'logout') {
      this.menuService.logout();
    }
    this.isOpen.set(false);
  }

  ngOnInit() {
    if (!this.user()) {
      this.userService.load().catch(err => console.warn('Failed to load user profile:', err));
    }
  }
}
