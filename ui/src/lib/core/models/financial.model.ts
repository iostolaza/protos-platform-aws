
// src/app/core/models/financial.model.ts

import type { Schema } from '@amplify-schema';  // ADDED: Import Schema

export interface ChargeCode {
  name: string;
  createdBy: string;
  date: string;
  linkedAccount?: string; // display name of the account this code belongs to
  accountId?: string;     // id of the account this code belongs to
}

export interface Account {
  id: string;
  accountNumber: string;
  name: string;
  details: string | null;
  balance: number;
  startingBalance: number | null;
  endingBalance: number | null;
  date: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense' | null;
  chargeCodes: ChargeCode[];
}

export interface Transaction {
  transactionId: string;
  accountId: string;
  type: 'assessment' | 'payment' | 'charge' | 'other';
  date: string; 
  docNumber?: string;
  description?: string;
  chargeAmount?: number;
  paymentAmount?: number;
  balance: number;
  confirmationNumber?: string;
  method?: string;
  status: 'paid' | 'pending' | 'overdue';
  category?: string;
  recurringId?: string;
  reconciled: boolean;
  createdAt: string;
  updatedAt: string;
  tenantId?: string;
  building?: string; 
}

export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  status: 'pending' | 'open' | 'closed';
  billFromId: string;
  billToId: string;
  fromAddress?: string;
  toAddress?: string;
  description?: string;  
  subtotal: number;
  tax: number;
  grandTotal: number;
  createdAt: string;
  updatedAt: string;
  tenantId?: string;
  building?: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  invoiceItemId: string;
  invoiceId?: string;  
  name: string;
  unitPrice: number;
  units: number;
  total: number;
}