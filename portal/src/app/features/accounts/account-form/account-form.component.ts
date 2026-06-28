import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FinancialService, Account } from '@ui';

type AccountType = NonNullable<Account['type']>;

@Component({
  selector: 'app-account-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './account-form.component.html',
})
export class AccountFormComponent implements OnInit {
  private financialService = inject(FinancialService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  accountId = signal<string | null>(null);
  isEdit = signal(false);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  accountNumber = signal<string>('');
  readonly types: AccountType[] = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

  model = {
    name: '',
    details: '',
    startingBalance: 0,
    type: '' as AccountType | '',
  };

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.accountId.set(id);
      this.isEdit.set(true);
      await this.loadAccount(id);
    }
  }

  private async loadAccount(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const account = await this.financialService.getAccount(id);
      this.accountNumber.set(account.accountNumber);
      this.model = {
        name: account.name,
        details: account.details ?? '',
        startingBalance: account.startingBalance ?? account.balance ?? 0,
        type: account.type ?? '',
      };
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load account');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (!this.model.name.trim()) {
      this.error.set('Account name is required.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      if (this.isEdit() && this.accountId()) {
        await this.financialService.updateAccount(this.accountId()!, {
          name: this.model.name.trim(),
          details: this.model.details.trim() || null,
          startingBalance: Number(this.model.startingBalance) || 0,
          type: this.model.type || null,
        });
      } else {
        const starting = Number(this.model.startingBalance) || 0;
        await this.financialService.createAccount({
          name: this.model.name.trim(),
          details: this.model.details.trim() || null,
          balance: starting,
          startingBalance: starting,
          endingBalance: starting,
          date: new Date().toISOString().split('T')[0],
          type: this.model.type || null,
          chargeCodes: [],
        });
      }
      this.router.navigate(['/main-layout/accounts/list']);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to save account');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/main-layout/accounts']);
  }
}
