import { TestBed } from '@angular/core/testing';
import { generateClient } from 'aws-amplify/data';
import { of, throwError } from 'rxjs';
import { TimesheetService } from './timesheet.service';
import { OrgContextService } from './org-context.service';
import { FinancialService } from './financial.service';
import { AuthService } from './auth.service';

jest.mock('aws-amplify/data');

describe('TimesheetService org isolation and ledger posting', () => {
  let service: TimesheetService;
  let orgContext: OrgContextService;

  let mockTimesheetCreate: jest.Mock;
  let mockTimesheetUpdate: jest.Mock;
  let mockTimesheetGet: jest.Mock;
  let mockTimesheetList: jest.Mock;
  let mockEntryCreate: jest.Mock;
  let mockEntryList: jest.Mock;
  let mockTransactionList: jest.Mock;

  const financialServiceMock = {
    getAccountByChargeCode: jest.fn(),
    createTransaction: jest.fn(),
  };

  const authServiceMock = {
    getCurrentUserId: jest.fn().mockResolvedValue('manager-1'),
    getUserById: jest.fn(),
    isAdminOrManager: jest.fn().mockResolvedValue(true),
  };

  const submittedTimesheet = {
    id: 'ts-100',
    status: 'submitted',
    totalHours: 8,
    userId: 'worker-1',
    organizationId: 'org-ts-a',
    associatedChargeCodesJson: '[]',
    dailyAggregatesJson: '[]',
    grossTotal: 800,
    taxAmount: 0,
    netTotal: 800,
    startDate: '2026-07-01',
    endDate: '2026-07-07',
    postedToLedger: false,
  };

  let timesheetState: typeof submittedTimesheet & { totalCost?: number; ledgerPostingError?: string | null };

  const timesheetEntries = [
    {
      id: 'entry-1',
      timesheetId: 'ts-100',
      date: '2026-07-01',
      startTime: '09:00',
      endTime: '17:00',
      hours: 8,
      description: 'Field work',
      chargeCode: 'CC-OPS-101',
      userId: 'worker-1',
      organizationId: 'org-ts-a',
    },
  ];

  beforeEach(() => {
    mockTimesheetCreate = jest.fn();
    mockTimesheetUpdate = jest.fn();
    mockTimesheetGet = jest.fn();
    mockTimesheetList = jest.fn();
    mockEntryCreate = jest.fn();
    mockEntryList = jest.fn();
    mockTransactionList = jest.fn();

    (generateClient as jest.Mock).mockReturnValue({
      models: {
        Timesheet: {
          create: mockTimesheetCreate,
          update: mockTimesheetUpdate,
          get: mockTimesheetGet,
          list: mockTimesheetList,
        },
        TimesheetEntry: {
          create: mockEntryCreate,
          list: mockEntryList,
          update: jest.fn(),
        },
        Transaction: {
          list: mockTransactionList,
        },
      },
    });

    TestBed.configureTestingModule({
      providers: [
        TimesheetService,
        OrgContextService,
        { provide: FinancialService, useValue: financialServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    });

    service = TestBed.inject(TimesheetService);
    orgContext = TestBed.inject(OrgContextService);
    orgContext.clearOrg();
    orgContext.setActingOrgId('org-ts-a');

    jest.clearAllMocks();

    authServiceMock.getUserById.mockImplementation(async (id: string) => {
      if (id === 'manager-1') return { cognitoId: 'manager-1', role: 'Manager', rate: 0 };
      if (id === 'worker-1') {
        return { cognitoId: 'worker-1', role: 'Employee', rate: 100, firstName: 'Worker', lastName: 'One' };
      }
      return null;
    });

    financialServiceMock.getAccountByChargeCode.mockResolvedValue({
      id: 'acct-charge-1',
      accountNumber: '1111111111111111',
      name: 'Ops Account',
      balance: 1000,
      date: '2026-07-01',
      chargeCodes: [{ name: 'CC-OPS-101', createdBy: 'system', date: '2026-07-01' }],
    });

    financialServiceMock.createTransaction.mockReturnValue(
      of({
        transactionId: 'tx-labor-1',
        accountId: 'acct-charge-1',
        organizationId: 'org-ts-a',
        type: 'charge',
        category: 'timesheet-labor',
      })
    );

    mockTransactionList.mockResolvedValue({ data: [] });
    mockEntryList.mockResolvedValue({ data: timesheetEntries });
    timesheetState = { ...submittedTimesheet };
    mockTimesheetGet.mockImplementation(async () => ({ data: timesheetState }));
    mockTimesheetUpdate.mockImplementation(async (payload: Record<string, unknown>) => {
      timesheetState = { ...timesheetState, ...payload } as typeof timesheetState;
      return { data: timesheetState, errors: undefined };
    });
  });

  it('createTimesheet stamps organizationId from OrgContextService', async () => {
    mockTimesheetCreate.mockResolvedValue({
      data: { ...submittedTimesheet, id: 'ts-new', status: 'draft' },
      errors: undefined,
    });

    await service.createTimesheet({
      userId: 'worker-1',
      totalHours: 0,
      status: 'draft',
      startDate: '2026-07-01',
      endDate: '2026-07-07',
    });

    expect(mockTimesheetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-ts-a',
        userId: 'worker-1',
        status: 'draft',
      })
    );
  });

  it('addEntry stamps organizationId from OrgContextService', async () => {
    mockEntryCreate.mockResolvedValue({
      data: { ...timesheetEntries[0] },
      errors: undefined,
    });
    mockTimesheetGet.mockResolvedValue({ data: { ...submittedTimesheet, status: 'draft' } });
    mockEntryList.mockResolvedValue({ data: [] });

    await service.addEntry(
      {
        date: '2026-07-02',
        startTime: '09:00',
        endTime: '13:00',
        hours: 4,
        description: 'More work',
        chargeCode: 'CC-OPS-101',
        userId: 'worker-1',
      },
      'ts-draft'
    );

    expect(mockEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-ts-a',
        chargeCode: 'CC-OPS-101',
        timesheetId: 'ts-draft',
      })
    );
  });

  it('listTimesheets applies mergeWithOrgFilter', async () => {
    mockTimesheetList.mockResolvedValue({ data: [], errors: undefined });
    authServiceMock.getCurrentUserId.mockResolvedValue('manager-1');

    await service.listTimesheets('submitted');

    expect(mockTimesheetList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({
          and: expect.arrayContaining([{ organizationId: { eq: 'org-ts-a' } }]),
        }),
      })
    );
  });

  it('approveTimesheet posts Transaction(s) with the correct organizationId', async () => {
    const result = await service.approveTimesheet('ts-100');

    expect(result.status).toBe('approved');
    expect(financialServiceMock.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-charge-1',
        category: 'timesheet-labor',
        recurringId: 'timesheet:ts-100:CC-OPS-101',
      })
    );
    expect(financialServiceMock.createTransaction).toHaveBeenCalled();
    const createPayload = financialServiceMock.createTransaction.mock.calls[0][0];
    expect(createPayload).toEqual(expect.objectContaining({ accountId: 'acct-charge-1' }));

    expect(mockTimesheetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ts-100', status: 'approved' })
    );
    expect(mockTimesheetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ts-100', postedToLedger: true })
    );
  });

  it('approveTimesheet is idempotent — existing recurringId does not double-post', async () => {
    mockTransactionList.mockResolvedValue({
      data: [{ transactionId: 'existing-tx', recurringId: 'timesheet:ts-100:CC-OPS-101' }],
    });

    await service.approveTimesheet('ts-100');

    expect(financialServiceMock.createTransaction).not.toHaveBeenCalled();
  });

  it('approveTimesheet succeeds but records ledgerPostingError when posting fails', async () => {
    financialServiceMock.getAccountByChargeCode.mockResolvedValue(null);

    const result = await service.approveTimesheet('ts-100');

    expect(result.status).toBe('approved');
    expect(result.postedToLedger).toBe(false);
    expect(result.ledgerPostingError).toContain('No account linked to charge code');
    expect(mockTimesheetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ts-100',
        status: 'approved',
      })
    );
    expect(mockTimesheetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ts-100',
        postedToLedger: false,
        ledgerPostingError: expect.stringContaining('No account linked'),
      })
    );
  });

  it('approveTimesheet still approves when createTransaction throws', async () => {
    financialServiceMock.createTransaction.mockReturnValue(
      throwError(() => new Error('Create failed: Unauthorized'))
    );

    const result = await service.approveTimesheet('ts-100');

    expect(result.status).toBe('approved');
    expect(result.postedToLedger).toBe(false);
    expect(result.ledgerPostingError).toContain('CC-OPS-101');
  });
});
