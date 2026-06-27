import { Component, inject } from '@angular/core';
import { UserService } from '@ui';

@Component({
  selector: 'app-home-overview',
  standalone: true,
  imports: [],
  template: `
    <div class="rounded-lg bg-card px-8 py-8 shadow-custom mb-6">
      <h2 class="text-2xl font-bold text-primary mb-4">Home Overview</h2>
      <p class="text-l text-body">Hi, {{ user()?.firstName || 'User' }}!</p>
      <p class="text-l text-body">Let's take a look at your activity overview</p>
    </div>
  `,
})
export class HomeOverviewComponent {
  private userService = inject(UserService);
  user = this.userService.user;
}
