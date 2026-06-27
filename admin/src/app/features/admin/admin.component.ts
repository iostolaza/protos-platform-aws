import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InviteUserComponent } from './invite-user/invite-user.component';
import { AdminService } from '@ui';

interface AdminUser {
  cognitoId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  groups: string[];
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, InviteUserComponent],
  templateUrl: './admin.component.html',
  styles: []
})
export class AdminComponent implements OnInit {
  private adminService = inject(AdminService);

  users = signal<AdminUser[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.loadUsers();
  }

  async loadUsers() {
    this.loading.set(true);
    try {
      const dbUsers = await this.adminService.listUsers();

      const usersWithGroups: AdminUser[] = [];
      for (const dbUser of dbUsers) {
        const groups = await this.adminService.getUserGroups(dbUser.email);

        usersWithGroups.push({
          cognitoId: dbUser.cognitoId,
          email: dbUser.email,
          firstName: dbUser.firstName ?? null,
          lastName: dbUser.lastName ?? null,
          groups,
        });
      }

      this.users.set(usersWithGroups);
    } catch (err) {
      console.error('Failed to load users:', err);
      this.users.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  editRoles(user: AdminUser) {
    alert(`Edit roles for ${user.email} – Modal coming in next step!`);
  }
}
