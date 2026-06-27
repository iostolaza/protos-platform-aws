
// src/app/features/financials/balance-ledger/balance-ledger.component.ts

import { Component, Input } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';  // ADDED: DecimalPipe
import { Transaction } from '@ui';

@Component({
  selector: 'app-balance-ledger',
  standalone: true,
  imports: [CommonModule, DecimalPipe],  // UPDATED: Add
  templateUrl: './balance-ledger.component.html',
})
export class BalanceLedgerComponent {
  @Input() transactions: Transaction[] = [];
}