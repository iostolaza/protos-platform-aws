import { Component, inject } from '@angular/core';
import { ProfileMenuComponent } from './profile-menu/profile-menu.component';
import { AppService } from '../../core/services/app.service';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath } from '../../core/services/icon-preloader.service';

@Component({
  selector: 'lib-top-menu',
  standalone: true,
  imports: [ProfileMenuComponent, AngularSvgIconModule],
  templateUrl: './top-menu.component.html'
})
export class TopMenuComponent {
  appService = inject(AppService);
  getIconPath = getIconPath;  // expose to template
}
