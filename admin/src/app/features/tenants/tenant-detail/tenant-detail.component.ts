import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminService, OrgContextService, type AdminUserRecord } from '@ui';

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tenant-detail.component.html',
})
export class TenantDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminService = inject(AdminService);
  private orgContext = inject(OrgContextService);

  tenant = signal<AdminUserRecord | null>(null);
  groups = signal<string[]>([]);
  loading = signal(true);
  actionLoading = signal(false);
  errorMessage = signal<string | null>(null);

  effectiveOrgId = computed(() => this.orgContext.getEffectiveOrgId());

  ngOnInit(): void {
    void this.loadTenant();
  }

  async loadTenant(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    const cognitoId = this.route.snapshot.paramMap.get('cognitoId');
    if (!cognitoId) {
      this.errorMessage.set('Tenant not found.');
      this.loading.set(false);
      return;
    }

    try {
      const user = await this.adminService.getUser(cognitoId);
      if (!user) {
        this.errorMessage.set('Tenant not found.');
        this.tenant.set(null);
        return;
      }

      const effectiveOrgId = this.effectiveOrgId();
      if (effectiveOrgId && user.organizationId && user.organizationId !== effectiveOrgId) {
        this.errorMessage.set('This tenant is outside the current organization context.');
        this.tenant.set(null);
        return;
      }

      const userGroups = await this.adminService.getUserGroups(user.email);
      if (!this.adminService.isTenantGroupMember(userGroups)) {
        this.errorMessage.set('This user is not a tenant.');
        this.tenant.set(null);
        return;
      }

      this.tenant.set(user);
      this.groups.set(userGroups);
    } catch (err) {
      console.error('Failed to load tenant:', err);
      this.errorMessage.set('Failed to load tenant profile.');
      this.tenant.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  displayName(user: AdminUserRecord): string {
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return name || '(No name)';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  isDisabled(user: AdminUserRecord): boolean {
    return user.status === 'disabled';
  }

  async toggleStatus(): Promise<void> {
    const user = this.tenant();
    if (!user) {
      return;
    }

    this.actionLoading.set(true);
    try {
      if (this.isDisabled(user)) {
        await this.adminService.enableUser(user.email);
      } else {
        await this.adminService.disableUser(user.email);
      }
      await this.loadTenant();
    } catch (err) {
      console.error('Failed to update tenant status:', err);
      alert(`Failed to update account status for ${user.email}`);
    } finally {
      this.actionLoading.set(false);
    }
  }

  async promoteToEmployee(): Promise<void> {
    const user = this.tenant();
    if (!user) {
      return;
    }

    const confirmed = confirm(
      `Promote ${user.email} from tenant to employee? They will be moved to the user_Employee group.`
    );
    if (!confirmed) {
      return;
    }

    this.actionLoading.set(true);
    try {
      await this.adminService.promoteTenantToEmployee(user.email);
      void this.router.navigate(['/main-layout/employees']);
    } catch (err) {
      console.error('Failed to promote tenant:', err);
      alert(`Failed to promote ${user.email} to employee`);
    } finally {
      this.actionLoading.set(false);
    }
  }
}
