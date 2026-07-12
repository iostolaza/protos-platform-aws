//src/app/core/models/timesheet.model.ts
import { ChargeCode } from './financial.model';

export interface DailyAggregate {
  date: string;
  base: number;
  ot: number;
  regPay: number;
  otPay: number;
  subtotal: number;
}

export interface Timesheet {
  id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  organizationId: string;
  totalHours: number;
  totalCost?: number;
  userId: string;
  rejectionReason?: string;
  associatedChargeCodes?: ChargeCode[];
  associatedChargeCodesJson?: string; 
  dailyAggregates?: DailyAggregate[];
  dailyAggregatesJson?: string; 
  grossTotal?: number;
  taxAmount?: number;
  netTotal?: number;
  startDate?: string;
  endDate?: string;
  postedToLedger?: boolean;
  ledgerPostingError?: string;
}

/** Entry payload for create (org and timesheetId stamped by service). */
export type NewTimesheetEntry = Omit<TimesheetEntry, 'id' | 'organizationId' | 'timesheetId'>;

export interface TimesheetEntry {
  id: string;
  timesheetId: string;
  organizationId: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  description: string;
  chargeCode: string;
  userId: string;
}

/** Timesheet with entries loaded separately (not a schema relationship). */
export type TimesheetWithEntries = Timesheet & { entries: TimesheetEntry[] };