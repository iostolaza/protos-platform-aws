import { Component, inject, OnInit, signal } from '@angular/core';
import { UserService } from '@ui';

@Component({
  selector: 'app-profile-overview',
  standalone: true,
  imports: [],
  template: `
    <div class="rounded-lg bg-card flex items-center justify-center text-center w-full h-full">
      <div>
        <h3>Profile</h3>
        <p>Last Login: {{ lastLogin() }}</p>
      </div>
    </div>
  `,
})
export class ProfileOverviewComponent implements OnInit {
  private userService = inject(UserService);
  lastLogin = signal('');

  ngOnInit() {
    this.lastLogin.set(new Date().toLocaleDateString()); 
  }
}
