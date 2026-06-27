
// src/app/features/financials/balance-card/balance-card.component.ts
import { Component, EventEmitter, Input, Output, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';  // ADDED: DecimalPipe
import { FormsModule } from '@angular/forms';
import { FinancialService } from '@ui';
import { AuthService } from '@ui';

@Component({
  selector: 'app-balance-card',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],  // UPDATED: Add DecimalPipe
  templateUrl: './balance-card.component.html',
})
export class BalanceCardComponent implements OnInit {
  @Input() balance: number = 0;
  @Output() pay = new EventEmitter<number>();
  financialService = inject(FinancialService);
  auth = inject(AuthService);
  unpaid = signal(0);
  paidRecent = signal(0);
  paidLastYear = signal(0);
  payAmount = signal(0);

  async ngOnInit() {
    const id = await this.auth.getUserId();
    if (id) {
      this.financialService.getUnpaidBalance(id).subscribe(val => this.unpaid.set(val));
      this.financialService.getPaidSummary(id, 'recent').subscribe(summary => this.paidRecent.set(summary.total));
      this.financialService.getPaidSummary(id, 'lastYear').subscribe(summary => this.paidLastYear.set(summary.total));
    }
  }

  payPartial() {
    this.pay.emit(this.payAmount());
  }

  payFull() {
    this.pay.emit(this.unpaid());
  }
}