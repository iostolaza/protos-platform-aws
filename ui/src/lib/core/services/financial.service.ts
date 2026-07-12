import { Injectable, inject } from '@angular/core';
import { UserService } from './user.service';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';
import { from, Observable, throwError, of, forkJoin } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { RoleService } from './role.service';
import { AuthService } from './auth.service';
import { OrgContextService } from './org-context.service';
import { Transaction, Invoice, InvoiceItem, Account, ChargeCode } from '../models/financial.model';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

@Injectable({ providedIn: 'root' })
export class FinancialService {
  private client = generateClient<Schema>();
  private taxRate = 0.0825;
  private roleService = inject(RoleService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private orgContext = inject(OrgContextService);

  // ═══════════ ACCOUNT CRUD (for timesheet charge codes) ═══════════

  // Guards against the Account model being absent from the deployed schema
  // (e.g. amplify_outputs.json not yet regenerated after a backend deploy),
  // which would otherwise surface as a cryptic "reading 'list' of undefined".
  private get accountModel() {
    const model = (this.client.models as any).Account;
    if (!model) {
      throw new Error(
        'Accounts are not available yet. The backend schema has not been deployed — redeploy Amplify and re-sync amplify_outputs.json.'
      );
    }
    return model;
  }

  private mapAccountFromSchema(data: any): Account {
    let chargeCodes: ChargeCode[] = [];
    if (data.chargeCodesJson) {
      try { chargeCodes = JSON.parse(data.chargeCodesJson); } catch { chargeCodes = []; }
    }
    return {
      id: data.id,
      accountNumber: data.accountNumber,
      name: data.name,
      organizationId: data.organizationId,
      details: data.details,
      balance: data.balance,
      startingBalance: data.startingBalance ?? 0,
      endingBalance: data.endingBalance,
      date: data.date,
      type: data.type,
      chargeCodes,
    };
  }

  private generateAccountNumber(id: string): string {
    const digits = Array.from(id).map(c => c.charCodeAt(0)).join('');
    return (digits + '0000000000000000').slice(0, 16);
  }

  async listAccounts(): Promise<Account[]> {
    const filter = this.orgContext.mergeWithOrgFilter({});
    const { data, errors } = await this.accountModel.list({
      limit: 100,
      ...(filter ? { filter } : {}),
    });
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data.map((d: any) => this.mapAccountFromSchema(d));
  }

  async getAccount(id: string): Promise<Account> {
    const { data, errors } = await this.accountModel.get({ id });
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    if (!data) throw new Error('Account not found');
    return this.mapAccountFromSchema(data);
  }

  async createAccount(account: Omit<Account, 'id' | 'accountNumber' | 'organizationId'>): Promise<Account> {
    const id = crypto.randomUUID();
    const accountNumber = this.generateAccountNumber(id);
    const input: any = this.orgContext.stampOrgId({
      id,
      accountNumber,
      name: account.name,
      details: account.details ?? null,
      balance: account.balance ?? 0,
      startingBalance: account.startingBalance ?? account.balance ?? 0,
      endingBalance: account.endingBalance ?? account.balance ?? 0,
      date: account.date ?? new Date().toISOString().split('T')[0],
      type: account.type ?? null,
      chargeCodesJson: JSON.stringify(account.chargeCodes ?? []),
    });
    const { data, errors } = await this.accountModel.create(input);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    if (!data) throw new Error('Create failed');
    return this.mapAccountFromSchema(data);
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
    const current = await this.getAccount(id);
    const input: any = {
      id,
      accountNumber: updates.accountNumber ?? current.accountNumber,
      name: updates.name ?? current.name,
      balance: updates.balance ?? current.balance,
      date: updates.date ?? current.date,
      type: updates.type ?? current.type,
      details: updates.details ?? current.details,
      startingBalance: updates.startingBalance ?? current.startingBalance,
      endingBalance: updates.endingBalance ?? current.endingBalance,
      chargeCodesJson: updates.chargeCodes
        ? JSON.stringify(updates.chargeCodes)
        : JSON.stringify(current.chargeCodes ?? []),
    };
    const { data, errors } = await this.accountModel.update(input);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    if (!data) throw new Error('Update failed');
    return this.mapAccountFromSchema(data);
  }

  async deleteAccount(id: string): Promise<void> {
    const { errors } = await this.accountModel.delete({ id });
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
  }

  async getAccountByChargeCode(chargeCode: string): Promise<Account | null> {
    const accounts = await this.listAccounts();
    return accounts.find(a => a.chargeCodes?.some(cc => cc.name === chargeCode)) || null;
  }

  async createChargeCode(account: Account): Promise<ChargeCode> {
    if (!account.accountNumber) throw new Error('Account number required');
    const short = (account.name || '').replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() || 'CC';
    const mid = account.accountNumber.slice(-3);
    const rand = Math.floor(100 + Math.random() * 900);
    const name = `${short}-${mid}-${rand}`;
    const chargeCode: ChargeCode = {
      name,
      createdBy: this.userService.user()?.cognitoId ?? 'system',
      date: new Date().toISOString(),
    };
    const updatedCodes = [...(account.chargeCodes ?? []), chargeCode];
    await this.updateAccount(account.id, {
      accountNumber: account.accountNumber,
      balance: account.balance,
      endingBalance: account.endingBalance,
      chargeCodes: updatedCodes,
    });
    return chargeCode;
  }

  async listChargeCodes(accountId: string): Promise<ChargeCode[]> {
    const account = await this.getAccount(accountId);
    return account.chargeCodes ?? [];
  }

  // Flatten every charge code across all accounts, annotated with its owning account.
  async listAllChargeCodes(): Promise<ChargeCode[]> {
    const accounts = await this.listAccounts();
    return accounts.flatMap(a =>
      (a.chargeCodes ?? []).map(cc => ({
        ...cc,
        accountId: cc.accountId ?? a.id,
        linkedAccount: cc.linkedAccount ?? a.name,
      }))
    );
  }

  // Attach an existing charge code (by name) to the given account if not already present.
  async linkChargeCode(chargeCodeName: string, accountId: string): Promise<Account> {
    const target = await this.getAccount(accountId);
    const existing = target.chargeCodes ?? [];
    if (existing.some(cc => cc.name === chargeCodeName)) return target;
    const code: ChargeCode = {
      name: chargeCodeName,
      createdBy: this.userService.user()?.cognitoId ?? 'system',
      date: new Date().toISOString(),
      accountId,
      linkedAccount: target.name,
    };
    return this.updateAccount(accountId, { chargeCodes: [...existing, code] });
  }

  async addFunds(accountId: string, amount: number, description = 'Add funds'): Promise<void> {
    const account = await this.getAccount(accountId);
    const newBalance = account.balance + amount;
    await this.updateAccount(accountId, { balance: newBalance, endingBalance: newBalance });
  }

  async subtractFunds(accountId: string, amount: number, description = 'Subtract funds'): Promise<void> {
    const account = await this.getAccount(accountId);
    const newBalance = account.balance - amount;
    await this.updateAccount(accountId, { balance: newBalance, endingBalance: newBalance });
  }

  private getLastBalance(accountId: string): Observable<number> {
    return from(this.client.models.Transaction.list({
      filter: { accountId: { eq: accountId } },
    })).pipe(
      map(res => {
        const transactions = res.data ?? [];
        if (transactions.length === 0) return 0;
        const filtered = transactions.filter(t => t.createdAt != null);
        if (filtered.length === 0) return 0;
        const sorted = filtered.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
        return sorted[0]?.balance ?? 0;
      })
    );
  }

  private accountAccessCache = new Map<string, boolean>();

  private isAdminOrManager(): boolean {
    return this.roleService.isAdmin$() || this.roleService.isManager$();
  }

  /**
   * Transaction visibility (client-side, defense-in-depth on top of org filter):
   * - Admin / Manager: all transactions in the org list result.
   * - Tenant: only transactions billed to them (accountId === cognitoId, legacy invoice
   *   ledger) or on an Account they own (ownerCognitoId — dormant until Account schema ships).
   */
  private async canViewTransaction(trans: Transaction): Promise<boolean> {
    if (this.isAdminOrManager()) return true;

    const cognitoId = this.userService.user()?.cognitoId;
    if (!cognitoId) return false;

    if (trans.accountId === cognitoId) return true;

    return this.isAccountOwnedByTenant(trans.accountId, cognitoId);
  }

  /**
   * Account ownership check for tenant transaction visibility.
   * Account.ownerCognitoId is not in the schema; tenants see only bill-to rows (accountId === cognitoId).
   */
  private async isAccountOwnedByTenant(_accountId: string, _cognitoId: string): Promise<boolean> {
    return false;
  }

  createTransaction(transData: Partial<Transaction> & { accountId: string }): Observable<Transaction> {
    const canCreate = this.roleService.isAdmin$() || this.roleService.isManager$();
    if (!canCreate) {
      return throwError(() => new Error('Unauthorized'));
    }

    return from(this.getLastBalance(transData.accountId)).pipe(
      switchMap(lastBalance => {
        const computed: Transaction = this.orgContext.stampOrgId({
          transactionId: crypto.randomUUID(),
          accountId: transData.accountId,
          type: transData.type ?? 'charge',
          date: transData.date || new Date().toISOString().split('T')[0],
          docNumber: transData.docNumber ?? undefined,
          description: transData.description ?? undefined,
          chargeAmount: transData.chargeAmount ?? 0,
          paymentAmount: transData.paymentAmount ?? 0,
          balance: (lastBalance || 0) + (transData.chargeAmount || 0) - (transData.paymentAmount || 0),
          confirmationNumber: transData.confirmationNumber ?? undefined,
          method: transData.method ?? undefined,
          status: transData.status ?? 'pending',
          category: transData.category ?? undefined,
          recurringId: transData.recurringId ?? undefined,
          reconciled: transData.reconciled ?? false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tenantId: transData.tenantId ?? undefined,
          building: transData.building ?? undefined,
        });
        return from(this.client.models.Transaction.create(computed)).pipe(
          map(res => {
            if (res.errors) throw new Error(res.errors.map(e => e.message).join(', '));
            return res.data as Transaction;
          })
        );
      }),
      catchError(err => throwError(() => new Error(`Create failed: ${err.message}`)))
    );
  }

  listTransactions(filter: { accountId?: string; startDate?: string; endDate?: string; limit?: number } = {}): Observable<Transaction[]> {
    const baseFilter = filter.accountId ? { accountId: { eq: filter.accountId } } : {};
    const conditions: any[] = [];
    if (filter.startDate) conditions.push({ date: { ge: filter.startDate } });
    if (filter.endDate) conditions.push({ date: { le: filter.endDate } });
    const mergedBase = this.orgContext.mergeWithOrgFilter(baseFilter);
    const fullFilter = conditions.length > 0
      ? { and: [mergedBase ?? {}, ...conditions] }
      : mergedBase;

    return from(this.client.models.Transaction.list({
      filter: fullFilter,
      limit: filter.limit || 100
    })).pipe(
      switchMap(res => from(Promise.all((res.data ?? []).map(async trans => {
        const canView = await this.canViewTransaction(trans as Transaction);
        return canView ? trans as Transaction : null;
      })))),
      map(filtered => filtered.filter(t => t !== null) as Transaction[])
    );
  }

  getTransaction(transactionId: string): Observable<Transaction | null> {
    return from(this.client.models.Transaction.get({ transactionId })).pipe(
      switchMap(res => from(this.canViewTransaction(res.data as Transaction)).pipe(
        map(can => can ? res.data as Transaction : null)
      ))
    );
  }

  updateTransaction(transactionId: string, updates: Partial<Transaction>): Observable<Transaction> {
    if (!this.roleService.isAdmin$()) {
      return throwError(() => new Error('Unauthorized'));
    }

    return from(this.client.models.Transaction.update({ transactionId, ...updates })).pipe(
      map(res => {
        if (res.errors) throw new Error(res.errors.map(e => e.message).join(', '));
        return res.data as Transaction;
      })
    );
  }

  deleteTransaction(transactionId: string): Observable<void> {
    if (!this.roleService.isAdmin$()) {
      return throwError(() => new Error('Unauthorized'));
    }

    return from(this.client.models.Transaction.delete({ transactionId })).pipe(
      map(() => undefined)
    );
  }

  subscribeNewTransactions(accountId: string): Observable<Transaction[]> {
    const filter = this.isAdminOrManager()
      ? (accountId ? { accountId: { eq: accountId } } : {})
      : { accountId: { eq: accountId } };

    return this.client.models.Transaction.observeQuery({ filter }).pipe(
      switchMap(snapshot => from(Promise.all(snapshot.items.map(async (trans: any) => {
        const canView = await this.canViewTransaction(trans);
        return canView ? trans as Transaction : null;
      })))),
      map(filtered => filtered.filter(t => t !== null) as Transaction[])
    );
  }

  forecastBalance(accountId: string): Observable<number> {
    return of(0);
  }

  getContacts(): Observable<Schema['User']['type'][]> {
    return from(this.authService.getUserId()).pipe(
      switchMap(userId => {
        if (!userId) throw new Error('No current user');
        return from(this.client.models.Friend.list({
          filter: { ownerCognitoId: { eq: userId } },
          selectionSet: ['friend.cognitoId', 'friend.firstName', 'friend.lastName', 'friend.email', 'friend.address.*'],
          limit: 100
        }));
      }),
      map(res => res.data.map(f => f.friend as Schema['User']['type'])),
      catchError(err => throwError(() => new Error(`Contacts fetch failed: ${err.message}`)))
    );
  }

  createInvoice(invoiceData: Partial<Invoice> & { items: Partial<InvoiceItem>[] }): Observable<Invoice> {
    const canCreate = this.roleService.isAdmin$() || this.roleService.isManager$();
    if (!canCreate) {
      return throwError(() => new Error('Unauthorized'));
    }

    return from(this.authService.getUserId()).pipe(
      switchMap(userId => {
        if (!userId) throw new Error('No current user');

        const invoiceId = crypto.randomUUID();
        const invoiceNumber = `INV-${invoiceId.slice(0, 8).toUpperCase()}`;
        const now = new Date().toISOString();

        const computedInvoice = this.orgContext.stampOrgId({
          invoiceId,
          invoiceNumber,
          billFromId: userId,
          billToId: invoiceData.billToId ?? '',
          date: invoiceData.date || new Date().toISOString().split('T')[0],
          status: 'pending' as const,
          fromAddress: invoiceData.fromAddress ?? '',
          toAddress: invoiceData.toAddress ?? '',
          description: invoiceData.description ?? '',
          subtotal: invoiceData.subtotal ?? 0,
          tax: invoiceData.tax ?? 0,
          grandTotal: invoiceData.grandTotal ?? 0,
          createdAt: now,
          updatedAt: now,
          tenantId: invoiceData.tenantId ?? undefined,
          building: invoiceData.building ?? undefined,
        });

        return from(this.client.models.Invoice.create(computedInvoice)).pipe(
          map(res => {
            if (res.errors) throw new Error(res.errors.map(e => e.message).join(', '));
            const invoice = res.data as unknown as Invoice;
            invoice.items = [];
            return invoice;
          }),
          switchMap(invoice => {
            const itemCreates = invoiceData.items.map(item => {
              const itemId = crypto.randomUUID();
              return this.client.models.InvoiceItem.create(
                this.orgContext.stampOrgId({
                  invoiceItemId: itemId,
                  invoiceId: invoice.invoiceId,
                  name: item.name ?? '',
                  unitPrice: item.unitPrice ?? 0,
                  units: item.units ?? 1,
                  total: item.total ?? 0,
                })
              );
            });
            return from(Promise.all(itemCreates)).pipe(
              map(results => {
                invoice.items = results.map(r => r.data as InvoiceItem);
                return invoice;
              })
            );
          }),
          switchMap(invoice => {
            const transData: Partial<Transaction> & { accountId: string } = {
              accountId: invoice.billToId,
              type: 'charge',
              date: invoice.date,
              docNumber: invoice.invoiceNumber,
              description: `Invoice: ${invoice.description || 'N/A'}`,
              chargeAmount: invoice.grandTotal,
              paymentAmount: 0,
              status: 'pending',
              tenantId: invoice.tenantId ?? undefined,
              building: invoice.building ?? undefined,
            };
            return this.createTransaction(transData).pipe(map(() => invoice));
          })
        );
      })
    );
  }

  getInvoice(invoiceId: string): Observable<Invoice | null> {
    return from(this.client.models.Invoice.get({ invoiceId })).pipe(
      map(res => res.data as unknown as Invoice | null),
      switchMap(invoice => {
        if (!invoice) return of(null);
        invoice.items = [];
        return from(this.client.models.InvoiceItem.list({ filter: { invoiceId: { eq: invoiceId } } })).pipe(
          map(itemsRes => {
            invoice.items = itemsRes.data as InvoiceItem[];
            return invoice;
          })
        );
      })
    );
  }

  updateInvoice(invoiceId: string, updates: Partial<Invoice> & { items: Partial<InvoiceItem>[] }): Observable<Invoice> {
    if (!this.roleService.isAdmin$()) {
      return throwError(() => new Error('Unauthorized'));
    }

    return from(this.getInvoice(invoiceId)).pipe(
      switchMap(existing => {
        if (!existing) throw new Error('Invoice not found');
        const now = new Date().toISOString();
        const computed = {
          ...existing,
          ...updates,
          updatedAt: now,
        };
        return from(this.client.models.Invoice.update(computed)).pipe(
          map(res => res.data as unknown as Invoice),
          switchMap(updated => {
            const deleteOld = existing.items?.map(item => 
              this.client.models.InvoiceItem.delete({ invoiceItemId: item.invoiceItemId })
            ) || [];
            return from(Promise.all(deleteOld)).pipe(
              switchMap(() => {
                const createNew = updates.items.map(item => {
                  const itemId = crypto.randomUUID();
                  return this.client.models.InvoiceItem.create(
                    this.orgContext.stampOrgId({
                      invoiceItemId: itemId,
                      invoiceId,
                      name: item.name ?? '',
                      unitPrice: item.unitPrice ?? 0,
                      units: item.units ?? 1,
                      total: item.total ?? 0,
                    })
                  );
                });
                return from(Promise.all(createNew)).pipe(
                  map(results => {
                    updated.items = results.map(r => r.data as InvoiceItem);
                    return updated;
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  sendInvoice(invoiceId: string): Observable<Invoice> {
    if (!this.roleService.isAdmin$()) {
      return throwError(() => new Error('Unauthorized'));
    }

    return from(this.client.models.Invoice.update({ invoiceId, status: 'open' })).pipe(
      map(res => res.data as unknown as Invoice)
    );
  }

  listInvoices(filter: { limit?: number } = {}): Observable<Invoice[]> {
    const currentUser = this.userService.user();
    if (!currentUser?.cognitoId) {
      return throwError(() => new Error('No current user'));
    }

    const isAdminOrManager = this.isAdminOrManager();
    const queryFilter = isAdminOrManager ? {} : { billToId: { eq: currentUser.cognitoId } };
    const listFilter = this.orgContext.mergeWithOrgFilter(queryFilter);

    return from(this.client.models.Invoice.list({
      filter: listFilter,
      limit: filter.limit || 100,
    })).pipe(
      map(res => res.data as unknown as Invoice[]),
      switchMap(invoices => {
        const itemFetches = invoices.map(inv => 
          from(this.client.models.InvoiceItem.list({ filter: { invoiceId: { eq: inv.invoiceId } } })).pipe(
            map(itemsRes => {
              inv.items = itemsRes.data as InvoiceItem[];
              return inv;
            })
          )
        );
        return forkJoin(itemFetches.length ? itemFetches : [of([])]).pipe(
          map(() => invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
        );
      })
    );
  }

  getCurrentBalance(accountId = ''): Observable<number> {
    if (this.isAdminOrManager()) {
      return this.listTransactions(accountId ? { accountId } : {}).pipe(
        map(trans => trans.reduce((sum, t) => sum + t.balance, 0))
      );
    }
    return this.getLastBalance(accountId);
  }

  payBalance(accountId: string, amount: number): Observable<Transaction | null> {
    return from(this.userService.getPaymentMethods()).pipe(
      switchMap(methods => {
        if (methods.length === 0) throw new Error('No payment method');
        const method = methods[0];
        return this.listTransactions({ accountId, limit: 1000 }).pipe(
          map(trans => trans.filter(t => t.status === 'pending' && t.type === 'charge').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())),
          switchMap(pending => {
            if (pending.length === 0) throw new Error('No pending charges');
            let remaining = amount;
            const updates: Observable<Transaction>[] = [];
            for (const trans of pending) {
              if (remaining <= 0) break;
              const apply = Math.min(remaining, trans.chargeAmount || 0);
              remaining -= apply;
              const newCharge = (trans.chargeAmount || 0) - apply;
              const newStatus = newCharge > 0 ? 'pending' : 'paid';
              updates.push(this.updateTransaction(trans.transactionId, { chargeAmount: newCharge, status: newStatus, balance: trans.balance - apply }));
            }
            if (remaining > 0) throw new Error('Payment exceeds pending charges');
            return forkJoin(updates).pipe(
              map(() => null),
              switchMap(() => {
                const payTrans = {
                  accountId,
                  type: 'payment' as const,
                  date: new Date().toISOString().split('T')[0],
                  description: `Payment via ${method.type} (${method.name})`,
                  paymentAmount: amount,
                  status: 'paid' as const,
                  method: `${method.type}-${method.name}`,
                  tenantId: accountId,
                };
                return this.createTransaction(payTrans);
              })
            );
          })
        );
      })
    );
  }

  getUnpaidBalance(accountId: string): Observable<number> {
    return this.listTransactions({ accountId }).pipe(
      map(trans => trans.filter(t => t.status === 'pending' && t.type === 'charge').reduce((sum, t) => sum + (t.chargeAmount || 0), 0))
    );
  }

  getPaidSummary(accountId: string, period: 'recent' | 'lastYear' = 'recent'): Observable<{ total: number; byCategory?: Record<string, number> }> {
    const startDate = period === 'lastYear' ? new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0] : undefined;
    return this.listTransactions({ accountId, startDate }).pipe(
      map(trans => {
        const payments = trans.filter(t => t.status === 'paid' && t.type === 'payment');
        const total = payments.reduce((sum, t) => sum + (t.paymentAmount || 0), 0);
        const byCategory = payments.reduce((acc, t) => {
          const cat = t.category || 'Uncategorized';
          acc[cat] = (acc[cat] || 0) + (t.paymentAmount || 0);
          return acc;
        }, {} as Record<string, number>);
        return { total, byCategory };
      })
    );
  }

  generatePdf(invoice: Invoice): jsPDF {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Invoice #${invoice.invoiceNumber}`, 20, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${invoice.date}`, 20, 30);
    doc.text(`From: ${invoice.fromAddress || ''}`, 20, 40);
    doc.text(`To: ${invoice.toAddress || ''}`, 20, 50);
    doc.text(`Description: ${invoice.description || ''}`, 20, 60);

    const tableData = invoice.items?.map(item => [item.name, item.unitPrice, item.units, item.total]) || [];
    (doc as any).autoTable({
      head: [['Name', 'Unit Price', 'Units', 'Total']],
      body: tableData,
      startY: 70,
    });

    doc.text(`Subtotal: $${invoice.subtotal}`, 140, (doc as any).lastAutoTable.finalY + 10);
    doc.text(`Tax: $${invoice.tax}`, 140, (doc as any).lastAutoTable.finalY + 20);
    doc.text(`Grand Total: $${invoice.grandTotal}`, 140, (doc as any).lastAutoTable.finalY + 30);

    return doc;
  }
}
