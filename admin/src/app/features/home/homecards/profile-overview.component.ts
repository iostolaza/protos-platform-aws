import { Component, inject, OnInit, signal } from '@angular/core';
import { UserService } from '@ui';

@Component({
  selector: 'app-profile-overview',
  standalone: true,
  imports: [],
  template: `
    <div class="rounded-lg bg-card flex items-center justify-center text-center w-full h-full">
      <div>
        <h3 class="text-lg font-semibold text-foreground">Profile</h3>
        @if (user()) {
          <p class="text-body mt-1">{{ user()!.firstName }} {{ user()!.lastName }}</p>
          <p class="text-muted-foreground text-sm">{{ user()!.email }}</p>
        }
        <p class="text-muted-foreground text-xs mt-2">Last Login: {{ lastLogin() }}</p>
      </div>
    </div>
  `,
})
export class ProfileOverviewComponent implements OnInit {
  private userService = inject(UserService);
  user = this.userService.user;
  lastLogin = signal('');

  ngOnInit() {
    this.lastLogin.set(new Date().toLocaleDateString());
  }
}
