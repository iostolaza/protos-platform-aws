import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AdminService, OrgContextService, sanitizeText, type AdminUserRecord } from '@ui';

interface TenantRow {
  cognitoId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyUnit: string;
  signupDate: string | null;
  profileComplete: boolean;
  status: string | null;
}

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tenants.component.html',
})
export class TenantsComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private orgContext = inject(OrgContextService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  tenants = signal<TenantRow[]>([]);
  filteredTenants = signal<TenantRow[]>([]);
  loading = signal(true);
  actionLoadingEmail = signal<string | null>(null);
  searchQuery = '';
  statusFilter = 'all';

  isSuperAdmin = this.orgContext.isSuperAdmin.bind(this.orgContext);
  actingOrgId = this.orgContext.actingOrganizationId;
  effectiveOrgId = computed(() => this.orgContext.getEffectiveOrgId());

  ngOnInit(): void {
    this.setupSearch();
    void this.loadTenants();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupSearch(): void {
    this.searchSubject
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.applyFilter());
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.searchSubject.next(sanitizeText(value));
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter = value;
    this.applyFilter();
  }

  async loadTenants(): Promise<void> {
    this.loading.set(true);
    try {
      const dbUsers = await this.adminService.listTenants();
      this.tenants.set(dbUsers.map((user) => this.toTenantRow(user)));
      this.applyFilter();
    } catch (err) {
      console.error('Failed to load tenants:', err);
      this.tenants.set([]);
      this.filteredTenants.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private toTenantRow(user: AdminUserRecord): TenantRow {
    const address = user.address;
    const companyUnit =
      [address?.line1, address?.city].filter(Boolean).join(', ') ||
      user.username ||
      '—';

    return {
      cognitoId: user.cognitoId,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      companyUnit,
      signupDate: user.createdAt ?? null,
      profileComplete: user.profileComplete === true,
      status: user.status ?? 'active',
    };
  }

  applyFilter(): void {
    const normalized = sanitizeText(this.searchQuery).toLowerCase();

    this.filteredTenants.set(
      this.tenants().filter((tenant) => {
        if (this.statusFilter !== 'all') {
          const accountStatus = this.isUserDisabled(tenant) ? 'disabled' : tenant.status || 'active';
          if (this.statusFilter === 'disabled' && accountStatus !== 'disabled') {
            return false;
          }
          if (this.statusFilter === 'active' && accountStatus === 'disabled') {
            return false;
          }
          if (this.statusFilter === 'complete' && !tenant.profileComplete) {
            return false;
          }
          if (this.statusFilter === 'incomplete' && tenant.profileComplete) {
            return false;
          }
          if (this.statusFilter === 'invited' && accountStatus !== 'invited') {
            return false;
          }
        }

        if (!normalized) {
          return true;
        }

        const fullName = `${tenant.firstName ?? ''} ${tenant.lastName ?? ''}`.trim().toLowerCase();
        const email = tenant.email.toLowerCase();
        const status = (tenant.status ?? 'active').toLowerCase();
        const profileLabel = tenant.profileComplete ? 'complete' : 'incomplete';

        return (
          fullName.includes(normalized) ||
          email.includes(normalized) ||
          status.includes(normalized) ||
          profileLabel.includes(normalized)
        );
      })
    );
  }

  viewTenant(tenant: TenantRow): void {
    void this.router.navigate(['/main-layout/tenants', tenant.cognitoId]);
  }

  async toggleUserStatus(tenant: TenantRow, event: Event): Promise<void> {
    event.stopPropagation();
    this.actionLoadingEmail.set(tenant.email);
    const isDisabled = this.isUserDisabled(tenant);

    try {
      if (isDisabled) {
        await this.adminService.enableUser(tenant.email);
      } else {
        await this.adminService.disableUser(tenant.email);
      }
      await this.loadTenants();
    } catch (err) {
      console.error('Failed to update tenant status:', err);
      alert(`Failed to ${isDisabled ? 'enable' : 'disable'} ${tenant.email}`);
    } finally {
      this.actionLoadingEmail.set(null);
    }
  }

  isUserDisabled(tenant: TenantRow): boolean {
    return tenant.status === 'disabled';
  }

  displayName(tenant: TenantRow): string {
    const name = `${tenant.firstName ?? ''} ${tenant.lastName ?? ''}`.trim();
    return name || '(No name)';
  }

  formatSignupDate(value: string | null): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }
}
