import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FinancialService, Account, ChargeCode } from '@ui';

@Component({
  selector: 'app-accounts-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './accounts-dashboard.component.html',
})
export class AccountsDashboardComponent implements OnInit {
  private router = inject(Router);
  private financialService = inject(FinancialService);

  accounts = signal<Account[]>([]);
  chargeCodes = signal<ChargeCode[]>([]);
  selectedAccountId = '';
  selectedChargeCode = '';
  loading = signal(false);
  error = signal<string | null>(null);

  totalBalance = computed(() => this.accounts().reduce((sum, a) => sum + (a.balance ?? 0), 0));

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const accounts = await this.financialService.listAccounts();
      this.accounts.set(accounts);
      this.chargeCodes.set(await this.financialService.listAllChargeCodes());
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load accounts');
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/main-layout/home']);
  }

  createAccount(): void {
    this.router.navigate(['/main-layout/accounts/new']);
  }

  editSelectedAccount(): void {
    if (!this.selectedAccountId) return;
    this.router.navigate(['/main-layout/accounts/edit', this.selectedAccountId]);
  }

  async linkChargeCodeToAccount(): Promise<void> {
    if (!this.selectedChargeCode || !this.selectedAccountId) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.financialService.linkChargeCode(this.selectedChargeCode, this.selectedAccountId);
      this.selectedChargeCode = '';
      await this.loadData();
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to link charge code');
    } finally {
      this.loading.set(false);
    }
  }

  viewAccounts(): void {
    this.router.navigate(['/main-layout/accounts/list']);
  }
}
