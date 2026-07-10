import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import {
  AdminService,
  OrgContextService,
  sanitizeText,
  type InviteRole,
} from '@ui';
import { AddEmployeeDialogComponent } from './add-employee-dialog.component';

interface EmployeeRow {
  cognitoId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: InviteRole | null;
  status: string | null;
  rate: number | null | undefined;
}

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, AddEmployeeDialogComponent],
  templateUrl: './employees.component.html',
})
export class EmployeesComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private orgContext = inject(OrgContextService);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  employees = signal<EmployeeRow[]>([]);
  filteredEmployees = signal<EmployeeRow[]>([]);
  loading = signal(true);
  showAddDialog = signal(false);
  actionLoadingEmail = signal<string | null>(null);
  searchQuery = '';

  isSuperAdmin = this.orgContext.isSuperAdmin.bind(this.orgContext);
  actingOrgId = this.orgContext.actingOrganizationId;
  effectiveOrgId = computed(() => this.orgContext.getEffectiveOrgId());
  canInvite = computed(() => !!this.effectiveOrgId());

  readonly inviteRoles = this.adminService.inviteRoles;

  ngOnInit(): void {
    this.setupSearch();
    void this.loadEmployees();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupSearch(): void {
    this.searchSubject
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) => this.applyFilter(query));
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.searchSubject.next(sanitizeText(value));
  }

  async loadEmployees(): Promise<void> {
    this.loading.set(true);
    try {
      const dbUsers = await this.adminService.listUsers();
      const rows: EmployeeRow[] = [];

      for (const dbUser of dbUsers) {
        const groups = await this.adminService.getUserGroups(dbUser.email);
        rows.push({
          cognitoId: dbUser.cognitoId,
          email: dbUser.email,
          firstName: dbUser.firstName ?? null,
          lastName: dbUser.lastName ?? null,
          role: this.adminService.getPrimaryRole(groups),
          status: dbUser.status ?? 'active',
          rate: dbUser.rate,
        });
      }

      this.employees.set(rows);
      this.applyFilter(sanitizeText(this.searchQuery));
    } catch (err) {
      console.error('Failed to load employees:', err);
      this.employees.set([]);
      this.filteredEmployees.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  applyFilter(query: string): void {
    const normalized = query.toLowerCase();
    if (!normalized) {
      this.filteredEmployees.set(this.employees());
      return;
    }

    this.filteredEmployees.set(
      this.employees().filter((employee) => {
        const fullName = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim().toLowerCase();
        const email = employee.email.toLowerCase();
        const role = (employee.role ?? '').toLowerCase();
        return (
          fullName.includes(normalized) ||
          email.includes(normalized) ||
          role.includes(normalized)
        );
      })
    );
  }

  openAddDialog(): void {
    if (!this.canInvite()) {
      return;
    }
    this.showAddDialog.set(true);
  }

  closeAddDialog(): void {
    this.showAddDialog.set(false);
  }

  async onEmployeeInvited(): Promise<void> {
    await this.loadEmployees();
  }

  async onRoleChange(employee: EmployeeRow, newRole: InviteRole): Promise<void> {
    if (!newRole || employee.role === newRole) {
      return;
    }

    this.actionLoadingEmail.set(employee.email);
    try {
      await this.adminService.changeUserRole(employee.email, newRole);
      await this.loadEmployees();
    } catch (err) {
      console.error('Failed to change role:', err);
      alert(`Failed to change role for ${employee.email}`);
    } finally {
      this.actionLoadingEmail.set(null);
    }
  }

  async toggleUserStatus(employee: EmployeeRow): Promise<void> {
    this.actionLoadingEmail.set(employee.email);
    const isDisabled = employee.status === 'disabled';

    try {
      if (isDisabled) {
        await this.adminService.enableUser(employee.email);
      } else {
        await this.adminService.disableUser(employee.email);
      }
      await this.loadEmployees();
    } catch (err) {
      console.error('Failed to update user status:', err);
      alert(`Failed to ${isDisabled ? 'enable' : 'disable'} ${employee.email}`);
    } finally {
      this.actionLoadingEmail.set(null);
    }
  }

  isUserDisabled(employee: EmployeeRow): boolean {
    return employee.status === 'disabled';
  }

  isUserInvited(employee: EmployeeRow): boolean {
    return employee.status === 'invited';
  }

  displayStatus(employee: EmployeeRow): string {
    if (this.isUserDisabled(employee)) {
      return 'disabled';
    }
    return employee.status || 'active';
  }

  displayName(employee: EmployeeRow): string {
    const name = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim();
    return name || '(No name)';
  }
}
