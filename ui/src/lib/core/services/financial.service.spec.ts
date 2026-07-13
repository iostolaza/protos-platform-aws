import { TestBed } from '@angular/core/testing';
import { generateClient } from 'aws-amplify/data';
import { firstValueFrom, of } from 'rxjs';
import { FinancialService } from './financial.service';
import { OrgContextService, NO_ORG_SENTINEL } from './org-context.service';
import { RoleService } from './role.service';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { Transaction } from '../models/financial.model';

jest.mock('aws-amplify/data');
jest.mock('aws-amplify/auth', () => ({
  fetchAuthSession: jest.fn().mockRejectedValue(new Error('no session')),
  getCurrentUser: jest.fn().mockRejectedValue(new Error('no user')),
}));
jest.mock('aws-amplify/utils', () => ({
  Hub: { listen: jest.fn() },
}));
jest.mock('aws-amplify/storage', () => ({
  uploadData: jest.fn(),
  getUrl: jest.fn(),
}));
jest.mock('jspdf');
jest.mock('jspdf-autotable');

describe('FinancialService org isolation and visibility', () => {
  let service: FinancialService;
  let orgContext: OrgContextService;
  let roleService: RoleService;
  let userService: UserService;

  let mockAccountCreate: jest.Mock;
  let mockAccountList: jest.Mock;
  let mockTransactionCreate: jest.Mock;
  let mockTransactionList: jest.Mock;
  let mockAccountGet: jest.Mock;

  const baseTransaction = (overrides: Partial<Transaction>): Transaction => ({
    transactionId: 'tx-1',
    accountId: 'acct-1',
    organizationId: 'org-a',
    type: 'charge',
    date: '2026-07-01',
    chargeAmount: 100,
    paymentAmount: 0,
    balance: 100,
    status: 'pending',
    reconciled: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  });

  const setRoleGroups = (groups: string[]) => {
    (roleService as unknown as { groups: { set: (g: string[]) => void } }).groups.set(groups);
  };

  const canView = (trans: Transaction) =>
    (
      service as unknown as { canViewTransaction(t: Transaction): Promise<boolean> }
    ).canViewTransaction(trans);

  beforeEach(() => {
    mockAccountCreate = jest.fn();
    mockAccountList = jest.fn();
    mockAccountGet = jest.fn();
    mockTransactionCreate = jest.fn();
    mockTransactionList = jest.fn();
    mockInvoiceCreate = jest.fn();

    (generateClient as jest.Mock).mockReturnValue({
      models: {
        Account: {
          create: mockAccountCreate,
          list: mockAccountList,
          get: mockAccountGet,
        },
        Transaction: {
          create: mockTransactionCreate,
          list: mockTransactionList,
          get: jest.fn(),
        },
        Invoice: {
          create: mockInvoiceCreate,
        },
        InvoiceItem: {
          create: jest.fn().mockResolvedValue({ data: {}, errors: undefined }),
        },
        Friend: {
          list: jest.fn(),
        },
      },
    });

    TestBed.configureTestingModule({
      providers: [
        FinancialService,
        OrgContextService,
        RoleService,
        UserService,
        { provide: AuthService, useValue: { getUserId: jest.fn().mockResolvedValue('manager-1') } },
      ],
    });

    service = TestBed.inject(FinancialService);
    orgContext = TestBed.inject(OrgContextService);
    roleService = TestBed.inject(RoleService);
    userService = TestBed.inject(UserService);
    orgContext.clearOrg();
    setRoleGroups([]);
    userService.user.set(null);

    mockTransactionList.mockResolvedValue({ data: [], errors: undefined });
  });

  it('createAccount stamps organizationId from OrgContextService', async () => {
    orgContext.setActingOrgId('org-fin-a');
    mockAccountCreate.mockResolvedValue({
      data: {
        id: 'acct-new',
        accountNumber: '1234567890123456',
        name: 'Ops',
        balance: 0,
        date: '2026-07-01',
        chargeCodesJson: '[]',
        organizationId: 'org-fin-a',
      },
      errors: undefined,
    });

    await service.createAccount({
      name: 'Ops',
      details: null,
      balance: 0,
      startingBalance: 0,
      endingBalance: 0,
      date: '2026-07-01',
      type: 'Expense',
      chargeCodes: [],
    });

    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-fin-a', name: 'Ops' })
    );
  });

  it('createTransaction stamps organizationId from OrgContextService', async () => {
    orgContext.setActingOrgId('org-fin-a');
    setRoleGroups(['user_Admin']);
    mockTransactionCreate.mockResolvedValue({
      data: baseTransaction({ organizationId: 'org-fin-a', transactionId: 'tx-new' }),
      errors: undefined,
    });

    await firstValueFrom(
      service.createTransaction({
        accountId: 'acct-1',
        type: 'charge',
        chargeAmount: 50,
      })
    );

    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-fin-a', accountId: 'acct-1' })
    );
  });

  it('createInvoice stamps organizationId on the invoice record', async () => {
    orgContext.setActingOrgId('org-fin-a');
    setRoleGroups(['user_Admin']);
    mockInvoiceCreate.mockResolvedValue({
      data: {
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-INV1',
        organizationId: 'org-fin-a',
        billFromId: 'manager-1',
        billToId: 'tenant-1',
        date: '2026-07-01',
        status: 'pending',
        subtotal: 10,
        tax: 0,
        grandTotal: 10,
      },
      errors: undefined,
    });
    mockTransactionCreate.mockResolvedValue({
      data: baseTransaction({ transactionId: 'tx-inv' }),
      errors: undefined,
    });

    await firstValueFrom(
      service.createInvoice({
        billToId: 'tenant-1',
        items: [{ name: 'Labor', unitPrice: 10, units: 1, total: 10 }],
        subtotal: 10,
        tax: 0,
        grandTotal: 10,
      })
    );

    expect(mockInvoiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-fin-a', billToId: 'tenant-1' })
    );
  });

  it('listAccounts applies mergeWithOrgFilter', async () => {
    orgContext.setActingOrgId('org-fin-b');
    mockAccountList.mockResolvedValue({ data: [], errors: undefined });

    await service.listAccounts();

    expect(mockAccountList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { organizationId: { eq: 'org-fin-b' } },
      })
    );
  });

  it('listTransactions applies mergeWithOrgFilter', async () => {
    orgContext.setActingOrgId('org-fin-b');
    setRoleGroups(['user_Admin']);
    mockTransactionList.mockResolvedValue({ data: [], errors: undefined });

    await firstValueFrom(service.listTransactions({}));

    expect(mockTransactionList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { organizationId: { eq: 'org-fin-b' } },
      })
    );
  });

  it('canViewTransaction allows Admin/Manager to see all in-org transactions', async () => {
    setRoleGroups(['user_Manager']);
    const laborCharge = baseTransaction({
      transactionId: 'tx-labor',
      accountId: 'company-account-uuid',
      category: 'timesheet-labor',
    });

    await expect(canView(laborCharge)).resolves.toBe(true);
  });

  it('canViewTransaction allows Tenant only bill-to transactions, not company charge-code accounts', async () => {
    setRoleGroups(['user_Tenant']);
    userService.user.set({ cognitoId: 'tenant-sub-1' } as never);

    const billToCharge = baseTransaction({
      transactionId: 'tx-billto',
      accountId: 'tenant-sub-1',
      category: 'invoice',
    });
    const laborCharge = baseTransaction({
      transactionId: 'tx-labor',
      accountId: 'company-account-uuid',
      category: 'timesheet-labor',
    });

    mockAccountGet.mockResolvedValue({
      data: {
        id: 'company-account-uuid',
        accountNumber: '9999999999999999',
        name: 'Charge pool',
        balance: 0,
        date: '2026-07-01',
        chargeCodesJson: '[]',
      },
      errors: undefined,
    });

    await expect(canView(billToCharge)).resolves.toBe(true);
    await expect(canView(laborCharge)).resolves.toBe(false);
  });

  it('listTransactions fail-closed: user with no org gets empty results via NO_ORG sentinel', async () => {
    setRoleGroups(['user_Tenant']);
    userService.user.set({ cognitoId: 'tenant-no-org' } as never);
    orgContext.clearOrg();

    mockTransactionList.mockImplementation(async (args: { filter?: { organizationId?: { eq?: string } } }) => {
      if (args.filter?.organizationId?.eq === NO_ORG_SENTINEL) {
        return { data: [] };
      }
      return {
        data: [baseTransaction({ transactionId: 'should-not-leak', accountId: 'tenant-no-org' })],
      };
    });

    const visible = await firstValueFrom(service.listTransactions({}));

    expect(visible).toEqual([]);
    expect(mockTransactionList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { organizationId: { eq: NO_ORG_SENTINEL } },
      })
    );
  });
});
