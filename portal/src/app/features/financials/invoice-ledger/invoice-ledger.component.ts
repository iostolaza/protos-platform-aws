
// src/app/features/financials/invoice-ledger/invoice-ledger.component.ts

import { Component, effect, inject, input, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularSvgIconModule } from 'angular-svg-icon';  
import { getIconPath } from '@ui';  
import { Invoice } from '@ui';
import { UserService } from '@ui';

@Component({
  selector: 'app-invoice-ledger',
  standalone: true,
  imports: [CommonModule, AngularSvgIconModule], 
  templateUrl: './invoice-ledger.component.html',
})
export class InvoiceLedgerComponent {
  invoices = input<Invoice[]>([]);
  billToNames = signal(new Map<string, string>());
  @Output() view = new EventEmitter<Invoice>();
  private userService = inject(UserService);
  getIconPath = getIconPath; 
  
  constructor() {
    effect(() => {
      console.log('Ledger effect running, invoices length:', this.invoices().length);
      if (this.invoices().length > 0) {
        this.loadBillToNames();
      } else {
        console.log('Invoices empty; skipping mapping');
        this.billToNames.set(new Map());
      }
    });
  }

  private async loadBillToNames() {
    try {
      let users: any[] = await this.userService.getAllUsers();
      if (users.length === 0) {
        console.warn('Users empty; re-fetching...');
        users = await this.userService.getAllUsers();
      }
      const billToIds = [...new Set(this.invoices().map(inv => inv.billToId))]; // Dedupe for efficiency
      console.log('BillTo IDs to map:', billToIds);
      console.log('Users fetched for mapping:', users.length, 'IDs:', users.map(u => u.cognitoId));
      let matchCount = 0;
      const newMap = new Map<string, string>();
      this.invoices().forEach(inv => {
        const user = users.find(u => u.cognitoId === inv.billToId);
        const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown' : 'Unknown';
        if (user) matchCount++;
        console.log(`Mapping billToId ${inv.billToId}:`, name);
        newMap.set(inv.billToId, name);
      });
      this.billToNames.set(newMap);
      console.log(`Matched ${matchCount}/${this.invoices().length} billTo names`);
    } catch (err) {
      console.error('Error loading billTo names:', err);
      this.billToNames.set(new Map()); // Fallback
    }
  }
}