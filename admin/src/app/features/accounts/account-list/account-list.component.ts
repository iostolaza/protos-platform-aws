import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FinancialService, Account } from '@ui';

@Component({
  selector: 'app-account-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './account-list.component.html',
})
export class AccountListComponent implements OnInit {
  private financialService = inject(FinancialService);
  private router = inject(Router);

  accounts = signal<Account[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadAccounts();
  }

  async loadAccounts(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.accounts.set(await this.financialService.listAccounts());
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load accounts');
    } finally {
      this.loading.set(false);
    }
  }

  editAccount(account: Account): void {
    this.router.navigate(['/main-layout/accounts/edit', account.id]);
  }

  openLedger(): void {
    this.router.navigate(['/main-layout/financials']);
  }

  async deleteAccount(account: Account): Promise<void> {
    if (!confirm(`Delete account "${account.name}"? This cannot be undone.`)) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.financialService.deleteAccount(account.id);
      await this.loadAccounts();
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to delete account');
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/main-layout/accounts']);
  }
}
