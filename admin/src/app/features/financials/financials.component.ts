
// src/app/features/financials/financials.component.ts

import { Component, DestroyRef, effect, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FinancialService } from '@ui';
import { RoleService } from '@ui';
import { AuthService } from '@ui';
import { Transaction } from '@ui';
import { Invoice } from '@ui';
import { FinancialTitleCardComponent } from './title-card/title-card.component';
import { CreateInvoiceComponent } from './create-invoice/create-invoice.component';
import { InvoiceLedgerComponent } from './invoice-ledger/invoice-ledger.component';
import { BalanceCardComponent } from './balance-card/balance-card.component';
import { BalanceLedgerComponent } from './balance-ledger/balance-ledger.component';
import { InvoiceDetailsComponent } from './invoice-details/invoice-details.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-financials',
  standalone: true,
  imports: [CommonModule, FinancialTitleCardComponent, CreateInvoiceComponent, InvoiceLedgerComponent, BalanceCardComponent, BalanceLedgerComponent, InvoiceDetailsComponent],
  templateUrl: './financials.component.html',
})
export class FinancialsComponent implements OnInit {
  financialService = inject(FinancialService);
  roleService = inject(RoleService);
  authService = inject(AuthService);
  destroyRef = inject(DestroyRef);
  transactions = signal<Transaction[]>([]);
  canCreate = signal(false);
  isManager = signal(false);
  assignedBuildings = signal<string[]>([]);
  accountId = signal<string>('');
  invoices = signal<Invoice[]>([]);
  currentBalance = signal<number>(0);
  selectedInvoice = signal<Invoice | null>(null);
  private router = inject(Router);

  constructor() {
    console.log('FinancialsComponent constructor called');
    effect(() => {
      console.log('Effect started');
      this.loadInitialData();
    });
  }
 
  private async loadInitialData() {
    console.log('loadInitialData started');
    try {
      this.canCreate.set(this.roleService.isAdmin$() || this.roleService.isManager$());
      console.log('canCreate set to', this.roleService.isAdmin$() || this.roleService.isManager$());
      this.isManager.set(this.roleService.isManager$());
      console.log('isManager set to', this.roleService.isManager$());
      this.assignedBuildings.set(await this.authService.getAssignedBuildings());
      console.log('assignedBuildings set to', this.assignedBuildings());
      const id = await this.authService.getUserId();
      const adminOrManager = this.roleService.isAdmin$() || this.roleService.isManager$();
      this.accountId.set(id || '');
      console.log('accountId set to', id);
      if (id || adminOrManager) {
        const ledgerAccountKey = adminOrManager ? '' : (id ?? '');
        console.log('Loading balance transactions for accountId:', ledgerAccountKey || '(org-wide)');
        this.financialService.subscribeNewTransactions(ledgerAccountKey).pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe(trans => {
          this.transactions.set(trans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        });
        this.financialService.getCurrentBalance(adminOrManager ? '' : (id ?? '')).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(bal => this.currentBalance.set(bal));
        console.log('Loading invoices for ledger refresh...');
        this.financialService.listInvoices().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(invs => {
          this.invoices.set(invs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        });
      }
    } catch (err) {
      console.error('Error in loadInitialData:', err);
    }
  }

  ngOnInit() {
    console.log('ngOnInit called, accountId:', this.accountId());
  }

  loadTransactions() {
    const adminOrManager = this.roleService.isAdmin$() || this.roleService.isManager$();
    const id = this.accountId();
    if (!id && !adminOrManager) return;
    const ledgerAccountKey = adminOrManager ? undefined : id;
    this.financialService.listTransactions(ledgerAccountKey ? { accountId: ledgerAccountKey } : {}).subscribe(trans => {
      console.log('Loaded transactions:', trans);
      this.transactions.set(trans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
  }

onInvoiceCreated(invoice: Invoice) {
  console.log('onInvoiceCreated:', invoice);
  if (this.accountId()) {
    this.financialService.listInvoices().subscribe(invs => {
      this.invoices.set(invs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
    this.loadTransactions();  // ADDED: Sync ledger
  }
}

  onRefresh() {
  if (this.accountId()) {
    this.financialService.listInvoices().subscribe(invs => {
      this.invoices.set(invs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
  }
}

  onPay(amount: number) {
    if (this.accountId()) {
      this.financialService.payBalance(this.accountId(), amount).subscribe(() => {
        this.financialService.getCurrentBalance(this.accountId()!).subscribe(bal => this.currentBalance.set(bal));
        this.loadTransactions();
      });
    }
  }

  editInvoice(id: string) {
    this.router.navigate(['/financials/edit', id]);
    this.selectedInvoice.set(null);
  }
}