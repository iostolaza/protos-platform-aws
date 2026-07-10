// file: src/app/core/services/timesheet.service.ts
import { Injectable, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@amplify-schema';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { FinancialService } from './financial.service';
import { OrgContextService } from './org-context.service';
import { Timesheet, TimesheetEntry, DailyAggregate } from '../models/timesheet.model';
import { ChargeCode } from '../models/financial.model';

export interface LedgerPostingResult {
  posted: boolean;
  transactionCount: number;
  errors: string[];
}

type TimesheetWorker = {
  rate?: number | null;
  otMultiplier?: number | null;
  firstName?: string | null;
  lastName?: string | null;
};

@Injectable({
  providedIn: 'root',
})
export class TimesheetService {
  private client = generateClient<Schema>();
  private authService = inject(AuthService);
  private financialService = inject(FinancialService);
  private orgContext = inject(OrgContextService);

  private mapTimesheetFromSchema(data: any): Timesheet {
    const assocJsonRaw = data?.associatedChargeCodesJson ?? '[]';
    const dailyAggRaw = data?.dailyAggregatesJson ?? '[]';
    let parsedAssoc: ChargeCode[] = [];
    let parsedDaily: DailyAggregate[] = [];
    try { parsedAssoc = JSON.parse(assocJsonRaw); } catch { parsedAssoc = []; }
    try { parsedDaily = JSON.parse(dailyAggRaw); } catch { parsedDaily = []; }

    return {
      id: data.id,
      status: data.status,
      totalHours: data.totalHours,
      totalCost: data.totalCost ?? 0,
      userId: data.userId,
      rejectionReason: data.rejectionReason ?? undefined,
      associatedChargeCodes: parsedAssoc,
      dailyAggregates: parsedDaily,
      grossTotal: data.grossTotal ?? 0,
      taxAmount: data.taxAmount ?? 0,
      netTotal: data.netTotal ?? 0,
      startDate: data.startDate ?? undefined,
      endDate: data.endDate ?? undefined,
      postedToLedger: data.postedToLedger ?? false,
      ledgerPostingError: data.ledgerPostingError ?? undefined,
      entries: [],
    };
  }

  async ensureDraftTimesheet(startDate: string, endDate: string): Promise<Timesheet> {  
    const sub = await this.authService.getCurrentUserId();
    if (!sub) throw new Error('User not authenticated');

    const filter = this.orgContext.mergeWithOrgFilter({
      userId: { eq: sub },
      status: { eq: 'draft' },
      startDate: { eq: startDate },
      endDate: { eq: endDate },
    });

    const { data } = await this.client.models.Timesheet.list({ filter });

    if (data && data.length > 0) {
      console.log('Found existing draft timesheet for period', data[0].id);
      return this.mapTimesheetFromSchema(data[0]);
    }

    console.log('No draft found for period, creating a new one...');
    return await this.createTimesheet({
      userId: sub,
      totalHours: 0,
      status: 'draft',
      startDate,
      endDate,
    });
  }

  async createTimesheet(ts: Omit<Timesheet, 'id' | 'entries'>): Promise<Timesheet> {
    const { data, errors } = await this.client.models.Timesheet.create(
      this.orgContext.stampOrgId({
        ...ts,
        associatedChargeCodesJson: JSON.stringify([]),
        dailyAggregatesJson: JSON.stringify([]),
      })
    );
    if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
    if (!data) throw new Error('Create failed');
    // Ensure status is draft
    if (data.status !== 'draft') throw new Error('Invalid status on create');

    if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
    return this.mapTimesheetFromSchema(data);
  }

  async updateTimesheet(ts: Partial<Timesheet> & { id: string }): Promise<Timesheet> {
    if (ts.associatedChargeCodes === undefined && ts.associatedChargeCodesJson === undefined) {
      (ts as any).associatedChargeCodesJson = JSON.stringify([]);
    }
    if (ts.dailyAggregates === undefined && ts.dailyAggregatesJson === undefined) {
      (ts as any).dailyAggregatesJson = JSON.stringify([]);
    }
    if (ts.associatedChargeCodes) {
      (ts as any).associatedChargeCodesJson = JSON.stringify(ts.associatedChargeCodes);
      delete (ts as any).associatedChargeCodes;
    }
    if (ts.dailyAggregates) {
      (ts as any).dailyAggregatesJson = JSON.stringify(ts.dailyAggregates);
      delete (ts as any).dailyAggregates;
    }

    const { data, errors } = await this.client.models.Timesheet.update(ts);
    if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
    return this.mapTimesheetFromSchema(data);
  }

  async listTimesheets(
    status?: 'draft' | 'submitted' | 'approved' | 'rejected' | ('draft' | 'submitted' | 'approved' | 'rejected')[],
    startDate?: string,
    endDate?: string
  ): Promise<Timesheet[]> {
    const sub = await this.authService.getCurrentUserId();
    const isAdminOrManager = await this.authService.isAdminOrManager();

    const filter: any = {};

    if (!isAdminOrManager) {
      filter.userId = { eq: sub! };
    } else {
      filter.userId = { attributeExists: true };
    }

    // Support both single status and array of statuses
    if (status) {
      if (Array.isArray(status)) {
        filter.or = status.map(s => ({ status: { eq: s } }));
      } else {
        filter.status = { eq: status };
      }
    }

    if (startDate) filter.startDate = { eq: startDate };
    if (endDate) filter.endDate = { eq: endDate };

    const listFilter = this.orgContext.mergeWithOrgFilter(filter);
    const { data, errors } = await this.client.models.Timesheet.list({ filter: listFilter });
    if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));

    const validData = data.filter(d => d.userId != null);
    if (validData.length < data.length) {
      console.warn(`Filtered ${data.length - validData.length} invalid timesheets with null userId`);
    }
    return validData.map(this.mapTimesheetFromSchema);
  }

  async canApprove(userId: string): Promise<boolean> {
   const user = await this.authService.getUserById(userId);
   return user?.role === 'Manager' || user?.role === 'Admin';
  }

  async getTimesheetWithEntries(id: string): Promise<Timesheet & { entries: TimesheetEntry[] }> {
    const { data: ts } = await this.client.models.Timesheet.get({ id });
    const { data: entries } = await this.client.models.TimesheetEntry.list({
      filter: { timesheetId: { eq: id } },
    });
    return {
      ...this.mapTimesheetFromSchema(ts!),
      entries: entries as TimesheetEntry[],
    };
  }


  async addEntry(entry: Omit<TimesheetEntry, 'id' | 'timesheetId'>, timesheetId: string): Promise<TimesheetEntry> {
    const { data, errors } = await this.client.models.TimesheetEntry.create(
      this.orgContext.stampOrgId({ ...entry, timesheetId })
    );
    if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
    await this.updateTotals(timesheetId);
    return data as TimesheetEntry;
  }

  async updateEntry(entry: TimesheetEntry, timesheetId: string): Promise<TimesheetEntry> {
    const { data, errors } = await this.client.models.TimesheetEntry.update(entry);
    if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
    await this.updateTotals(timesheetId);
    return data as TimesheetEntry;
  }

  async deleteEntry(id: string, timesheetId: string): Promise<void> {
    const { errors } = await this.client.models.TimesheetEntry.delete({ id });
    if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
    await this.updateTotals(timesheetId);
  }

  // --- Approval and rejection flows ---
  async approveTimesheet(id: string): Promise<Timesheet> {
    const ts = await this.getTimesheetWithEntries(id);

    // Authorization
    if (!(await this.canApprove(await this.authService.getCurrentUserId() ?? ''))) {
      throw new Error('Unauthorized to approve');
    }
    if (ts.status !== 'submitted') {
      throw new Error('Only submitted timesheets can be approved');
    }

    const user = await this.authService.getUserById(ts.userId);
    if (!user) throw new Error('User not found');

    // Validate every entry has a charge code
    for (const entry of ts.entries) {
      if (!entry.chargeCode) {
        throw new Error(`Entry ${entry.id} is missing a charge code`);
      }
    }

    // Compute labor cost (OT-aware, allocated per charge code).
    const chargeAmounts = this.computeChargeCodeAmounts(ts.entries, user);
    const totalCost = [...chargeAmounts.values()].reduce((sum, amount) => sum + amount, 0);

    // ───── Mark timesheet as approved ─────
    const { data, errors } = await this.client.models.Timesheet.update({
      id,
      status: 'approved' as const,
      totalCost,
    });

    if (errors?.length) {
      throw new Error(errors.map((e) => e.message).join(', '));
    }

    const approved = this.mapTimesheetFromSchema(data!);

    // Post to ledger after approval; failures do not roll back approval.
    const posting = await this.postTimesheetToLedger({ ...approved, entries: ts.entries }, user);
    const ledgerUpdate: Partial<Schema['Timesheet']['type']> & { id: string } = {
      id,
      postedToLedger: posting.posted,
      ledgerPostingError: posting.errors.length ? posting.errors.join('; ') : null,
    };
    const { data: withLedger, errors: ledgerErrors } = await this.client.models.Timesheet.update(ledgerUpdate);
    if (ledgerErrors?.length) {
      console.warn('Failed to persist ledger posting status', ledgerErrors);
    }

    if (posting.errors.length) {
      console.warn(`Timesheet ${id} approved but ledger posting had errors`, posting.errors);
    } else {
      console.log(`Timesheet ${id} approved – ${posting.transactionCount} transaction(s), total: ${totalCost}`);
    }

    return this.mapTimesheetFromSchema(withLedger ?? data!);
  }

  /** Retry ledger posting for an already-approved timesheet (idempotent). */
  async retryTimesheetLedgerPosting(id: string): Promise<LedgerPostingResult> {
    if (!(await this.canApprove(await this.authService.getCurrentUserId() ?? ''))) {
      throw new Error('Unauthorized to post timesheet ledger entries');
    }

    const ts = await this.getTimesheetWithEntries(id);
    if (ts.status !== 'approved') {
      throw new Error('Only approved timesheets can be posted to the ledger');
    }

    const user = await this.authService.getUserById(ts.userId);
    if (!user) throw new Error('User not found');

    const posting = await this.postTimesheetToLedger(ts, user);
    await this.client.models.Timesheet.update({
      id,
      postedToLedger: posting.posted,
      ledgerPostingError: posting.errors.length ? posting.errors.join('; ') : null,
    });
    return posting;
  }

  /**
   * Posts one charge Transaction per charge code on the timesheet.
   * Uses recurringId `timesheet:{id}:{chargeCode}` for idempotency.
   */
  async postTimesheetToLedger(
    ts: Timesheet & { entries?: TimesheetEntry[] },
    worker: TimesheetWorker
  ): Promise<LedgerPostingResult> {
    const entries = ts.entries?.length
      ? ts.entries
      : (await this.getTimesheetWithEntries(ts.id)).entries;
    const chargeAmounts = this.computeChargeCodeAmounts(entries, worker);
    const periodLabel = this.formatTimesheetPeriod(ts.startDate, ts.endDate);
    const workerName = `${worker.firstName ?? ''} ${worker.lastName ?? ''}`.trim() || ts.userId;
    const transactionDate = ts.endDate ?? new Date().toISOString().split('T')[0];

    const errors: string[] = [];
    let transactionCount = 0;

    for (const [chargeCode, amount] of chargeAmounts) {
      if (amount <= 0) continue;

      const recurringId = `timesheet:${ts.id}:${chargeCode}`;
      if (await this.hasExistingLedgerPosting(recurringId)) {
        transactionCount++;
        continue;
      }

      const account = await this.financialService.getAccountByChargeCode(chargeCode);
      if (!account) {
        errors.push(`No account linked to charge code "${chargeCode}"`);
        continue;
      }

      try {
        await firstValueFrom(
          this.financialService.createTransaction({
            accountId: account.id,
            type: 'charge',
            date: transactionDate,
            docNumber: `TS-${ts.id.slice(0, 8).toUpperCase()}-${chargeCode.replace(/[^A-Z0-9]/gi, '').slice(0, 12)}`,
            description: `Timesheet ${ts.id.slice(-6)} (${periodLabel}) – ${workerName} – ${chargeCode}`,
            chargeAmount: Math.round(amount * 100) / 100,
            paymentAmount: 0,
            status: 'pending',
            category: 'timesheet-labor',
            recurringId,
          })
        );
        transactionCount++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Charge code "${chargeCode}": ${message}`);
      }
    }

    const expectedCodes = [...chargeAmounts.entries()].filter(([, amount]) => amount > 0).length;
    const posted = errors.length === 0 && expectedCodes > 0 && transactionCount >= expectedCodes;
    return { posted, transactionCount, errors };
  }

  private formatTimesheetPeriod(startDate?: string, endDate?: string): string {
    if (startDate && endDate) return `${startDate} – ${endDate}`;
    if (startDate) return startDate;
    if (endDate) return endDate;
    return 'period n/a';
  }

  /** OT-aware labor cost per charge code (proportional daily OT allocation). */
  private computeChargeCodeAmounts(
    entries: TimesheetEntry[],
    worker: TimesheetWorker
  ): Map<string, number> {
    const rate = worker.rate ?? 0;
    const otMultiplier = worker.otMultiplier ?? 1.5;
    const byDate = new Map<string, Map<string, number>>();

    for (const entry of entries) {
      if (!entry.chargeCode?.trim()) continue;
      if (!byDate.has(entry.date)) byDate.set(entry.date, new Map());
      const codeMap = byDate.get(entry.date)!;
      codeMap.set(entry.chargeCode, (codeMap.get(entry.chargeCode) ?? 0) + entry.hours);
    }

    const amounts = new Map<string, number>();
    for (const codeMap of byDate.values()) {
      const dayTotalHours = [...codeMap.values()].reduce((sum, h) => sum + h, 0);
      const baseHours = Math.min(8, dayTotalHours);
      const otHours = Math.max(0, dayTotalHours - 8);
      const dayPay = baseHours * rate + otHours * rate * otMultiplier;

      for (const [code, hours] of codeMap) {
        const share = dayTotalHours > 0 ? (hours / dayTotalHours) * dayPay : 0;
        amounts.set(code, (amounts.get(code) ?? 0) + share);
      }
    }
    return amounts;
  }

  private async hasExistingLedgerPosting(recurringId: string): Promise<boolean> {
    const filter = this.orgContext.mergeWithOrgFilter({ recurringId: { eq: recurringId } });
    const { data } = await this.client.models.Transaction.list({ filter, limit: 1 });
    return (data?.length ?? 0) > 0;
  }

  async rejectTimesheet(id: string, reason: string): Promise<Timesheet> {
    const { data, errors } = await this.client.models.Timesheet.update({
      id,
      status: 'rejected',
      rejectionReason: reason,
    });
    console.log(`Rejected timesheet ${id}, reason: ${reason}`);

    if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
    return this.mapTimesheetFromSchema(data);
  }

  // --- Totals recalculation ---
  private async calculateAggregates(entries: TimesheetEntry[], rate: number, otMultiplier: number, taxRate: number) {
    const grouped = entries.reduce((acc, e) => {
      acc[e.date] = acc[e.date] || { hours: 0 };
      acc[e.date].hours += e.hours;
      return acc;
    }, {} as Record<string, { hours: number }>);

    const dailyAggregates: DailyAggregate[] = Object.entries(grouped).map(([date, { hours }]) => {
      const base = Math.min(8, hours);
      const ot = Math.max(0, hours - 8);
      const regPay = base * rate;
      const otPay = ot * rate * otMultiplier;
      return { date, base, ot, regPay, otPay, subtotal: regPay + otPay };
    });

    const grossTotal = dailyAggregates.reduce((sum, d) => sum + d.subtotal, 0);
    const taxAmount = grossTotal * taxRate;
    const netTotal = grossTotal - taxAmount;
    return { dailyAggregates, grossTotal, taxAmount, netTotal };
  }

  public async updateTotals(id: string): Promise<void> {
    const ts = await this.getTimesheetWithEntries(id);
    const user = await this.authService.getUserById(ts.userId);
    if (!user) throw new Error('User not found');

    const { dailyAggregates, grossTotal, taxAmount, netTotal } = await this.calculateAggregates(
      ts.entries,
      user.rate ?? 0,
      user.otMultiplier ?? 1.5,
      user.taxRate ?? 0.015
    );
    // Validate totals > 0 if entries exist
    const totalHours = ts.entries.reduce((sum, e) => sum + e.hours, 0);
    await this.client.models.Timesheet.update({
      id,
      totalHours,
      dailyAggregatesJson: JSON.stringify(dailyAggregates),
      grossTotal,
      taxAmount,
      netTotal,
    });
  }
}