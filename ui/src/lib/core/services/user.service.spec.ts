import { TestBed } from '@angular/core/testing';
import { generateClient } from 'aws-amplify/data';
import { UserService } from './user.service';
import { RoleService } from './role.service';
import { OrgContextService } from './org-context.service';

jest.mock('aws-amplify/data');
jest.mock('aws-amplify/auth', () => ({
  fetchAuthSession: jest.fn().mockResolvedValue({ tokens: { idToken: { payload: {} } } }),
  getCurrentUser: jest.fn().mockResolvedValue({ userId: 'user-sub-1', signInDetails: { loginId: 'test@test.com' } }),
}));
jest.mock('aws-amplify/storage', () => ({
  uploadData: jest.fn(),
  getUrl: jest.fn().mockResolvedValue({ url: new URL('https://example.com/img.jpg') }),
}));
jest.mock('aws-amplify/utils', () => ({
  Hub: { listen: jest.fn() },
}));

describe('UserService', () => {
  let service: UserService;
  let mockUserGet: jest.Mock;
  let mockUserCreate: jest.Mock;
  let mockUserUpdate: jest.Mock;
  let mockUserList: jest.Mock;
  let mockUserListByEmail: jest.Mock;
  let mockUserObserveQuery: jest.Mock;
  let mockPaymentList: jest.Mock;
  let mockPaymentCreate: jest.Mock;
  let mockPaymentUpdate: jest.Mock;
  let mockPaymentDelete: jest.Mock;

  const orgContextMock = {
    resolveOrg: jest.fn(),
    clearOrg: jest.fn(),
    getEffectiveOrgId: jest.fn().mockReturnValue('org-1'),
    stampOrgId: jest.fn((payload: Record<string, unknown>) => ({ ...payload, organizationId: 'org-1' })),
    mergeWithOrgFilter: jest.fn((f: Record<string, unknown>) => f),
    isSuperAdmin: jest.fn().mockReturnValue(false),
    orgId: jest.fn().mockReturnValue('org-1'),
  };

  const roleServiceMock = {
    refreshGroups: jest.fn(),
    clearGroups: jest.fn(),
    hasGroup: jest.fn().mockReturnValue(false),
    getGroups: jest.fn().mockReturnValue([]),
  };

  const existingUser = {
    cognitoId: 'user-sub-1',
    email: 'test@test.com',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    organizationId: 'org-1',
    profileImageKey: null,
    address: null,
    vehicle: null,
    emergencyContact: null,
    contactPrefs: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    role: 'Admin',
    profileComplete: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    orgContextMock.stampOrgId.mockImplementation((payload: Record<string, unknown>) => ({
      ...payload,
      organizationId: 'org-1',
    }));
    roleServiceMock.hasGroup.mockReturnValue(false);

    mockUserGet = jest.fn().mockResolvedValue({ data: existingUser, errors: null });
    mockUserCreate = jest.fn().mockResolvedValue({ errors: null });
    mockUserUpdate = jest.fn().mockResolvedValue({ data: existingUser, errors: null });
    mockUserList = jest.fn().mockResolvedValue({ data: [existingUser], nextToken: null, errors: null });
    mockUserListByEmail = jest.fn().mockResolvedValue({ data: [existingUser] });
    mockUserObserveQuery = jest.fn().mockReturnValue({ pipe: jest.fn().mockReturnValue({ subscribe: jest.fn() }) });
    mockPaymentList = jest.fn().mockResolvedValue({ data: [], errors: null });
    mockPaymentCreate = jest.fn().mockResolvedValue({ errors: null });
    mockPaymentUpdate = jest.fn().mockResolvedValue({ errors: null });
    mockPaymentDelete = jest.fn().mockResolvedValue({ errors: null });

    (generateClient as jest.Mock).mockReturnValue({
      models: {
        User: {
          get: mockUserGet,
          create: mockUserCreate,
          update: mockUserUpdate,
          list: mockUserList,
          listUserByEmail: mockUserListByEmail,
          observeQuery: mockUserObserveQuery,
        },
        PaymentMethod: {
          listPaymentMethodByUserCognitoId: mockPaymentList,
          create: mockPaymentCreate,
          update: mockPaymentUpdate,
          delete: mockPaymentDelete,
        },
      },
    });

    TestBed.configureTestingModule({
      providers: [
        UserService,
        { provide: OrgContextService, useValue: orgContextMock },
        { provide: RoleService, useValue: roleServiceMock },
      ],
    });
    service = TestBed.inject(UserService);
  });

  describe('save()', () => {
    it('should only pass allowlisted scalar fields to updateUser', async () => {
      service.user.set(existingUser as never);

      await service.save({ firstName: 'Updated', lastName: 'Name', username: 'newuser' });

      expect(mockUserUpdate).toHaveBeenCalledTimes(1);
      const updateArg = mockUserUpdate.mock.calls[0][0];
      expect(updateArg.cognitoId).toBe('user-sub-1');
      expect(updateArg.firstName).toBe('Updated');
      expect(updateArg.lastName).toBe('Name');
      expect(updateArg.username).toBe('newuser');
      expect(updateArg.updatedAt).toBeDefined();
      expect(updateArg.teams).toBeUndefined();
      expect(updateArg.ledTeams).toBeUndefined();
      expect(updateArg.ticketsRequested).toBeUndefined();
    });

    it('should reject unknown/relationship fields from save payload', async () => {
      service.user.set(existingUser as never);

      await service.save({
        firstName: 'Updated',
        teams: [{ id: 'fake' }],
        ticketsRequested: [],
        cognitoId: 'should-be-stripped',
        createdAt: 'should-be-stripped',
      } as never);

      const updateArg = mockUserUpdate.mock.calls[0][0];
      expect(updateArg.teams).toBeUndefined();
      expect(updateArg.ticketsRequested).toBeUndefined();
      expect(updateArg.firstName).toBe('Updated');
    });
  });

  describe('updateUser()', () => {
    it('should update address custom type correctly', async () => {
      service.user.set(existingUser as never);
      const address = { line1: '123 Main', city: 'SF', state: 'CA', zip: '94102', country: 'US' };

      await service.updateUser({ address });

      const updateArg = mockUserUpdate.mock.calls[0][0];
      expect(updateArg.address).toEqual(address);
      expect(updateArg.cognitoId).toBe('user-sub-1');
    });

    it('should update vehicle custom type correctly', async () => {
      service.user.set(existingUser as never);
      const vehicle = { make: 'Toyota', model: 'Camry', color: 'Blue', license: 'ABC123', year: 2024 };

      await service.updateUser({ vehicle });

      expect(mockUserUpdate.mock.calls[0][0].vehicle).toEqual(vehicle);
    });

    it('should update emergencyContact custom type correctly', async () => {
      service.user.set(existingUser as never);
      const ec = { name: 'Jane', phone: '555-1234', email: 'jane@test.com', address: '456 Oak' };

      await service.updateUser({ emergencyContact: ec });

      expect(mockUserUpdate.mock.calls[0][0].emergencyContact).toEqual(ec);
    });

    it('should update contactPrefs custom type correctly', async () => {
      service.user.set(existingUser as never);
      const prefs = { email: true, push: false };

      await service.updateUser({ contactPrefs: prefs });

      expect(mockUserUpdate.mock.calls[0][0].contactPrefs).toEqual(prefs);
    });

    it('should not update if no user is loaded', async () => {
      service.user.set(null);
      await service.updateUser({ firstName: 'Test' });
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it('should throw on Amplify errors', async () => {
      service.user.set(existingUser as never);
      mockUserUpdate.mockResolvedValue({ data: null, errors: [{ message: 'Forbidden' }] });

      await expect(service.updateUser({ firstName: 'Test' })).rejects.toThrow('Forbidden');
    });
  });

  describe('loadCurrentUser() — SuperAdmin bootstrap', () => {
    it('should create user with PLATFORM org when SuperAdmin has no orgId', async () => {
      mockUserGet.mockResolvedValueOnce({ data: null, errors: null });
      mockUserListByEmail.mockResolvedValueOnce({ data: [] });

      orgContextMock.stampOrgId.mockImplementation(() => {
        throw new Error('organizationId is required');
      });

      roleServiceMock.hasGroup.mockImplementation((g: string) => g === 'platform_SuperAdmin');

      mockUserCreate.mockResolvedValue({ errors: null });
      mockUserGet
        .mockResolvedValueOnce({ data: null, errors: null })
        .mockResolvedValueOnce({ data: { ...existingUser, organizationId: 'PLATFORM' }, errors: null });

      await service.load();

      expect(mockUserCreate).toHaveBeenCalledTimes(1);
      const createArg = mockUserCreate.mock.calls[0][0];
      expect(createArg.organizationId).toBe('PLATFORM');
      expect(createArg.cognitoId).toBe('user-sub-1');
      expect(createArg.email).toBe('test@test.com');
    });

    it('should throw for non-SuperAdmin without orgId', async () => {
      service.user.set(null);
      mockUserGet.mockResolvedValue({ data: null, errors: null });
      mockUserListByEmail.mockResolvedValue({ data: [] });

      orgContextMock.stampOrgId.mockImplementation(() => {
        throw new Error('organizationId is required');
      });
      roleServiceMock.hasGroup.mockReturnValue(false);

      await service.load();
      expect(service.user()).toBeNull();
      expect(mockUserCreate).not.toHaveBeenCalled();
    });
  });

  describe('PaymentMethod CRUD', () => {
    it('should list payment methods for current user', async () => {
      const payments = [{ id: 'pm-1', type: 'credit', name: 'Visa' }];
      mockPaymentList.mockResolvedValue({ data: payments, errors: null });

      const result = await service.getPaymentMethods();
      expect(result).toEqual(payments);
    });

    it('should add a payment method with org stamp', async () => {
      await service.addPaymentMethod('credit', 'Amex');

      expect(mockPaymentCreate).toHaveBeenCalledTimes(1);
      const arg = mockPaymentCreate.mock.calls[0][0];
      expect(arg.type).toBe('credit');
      expect(arg.name).toBe('Amex');
      expect(arg.organizationId).toBe('org-1');
    });

    it('should update a payment method', async () => {
      await service.updatePaymentMethod('pm-1', 'debit', 'Chase');

      expect(mockPaymentUpdate).toHaveBeenCalledWith({
        id: 'pm-1', type: 'debit', name: 'Chase',
        updatedAt: expect.any(String),
      });
    });

    it('should delete a payment method', async () => {
      await service.deletePaymentMethod('pm-1');
      expect(mockPaymentDelete).toHaveBeenCalledWith({ id: 'pm-1' });
    });
  });
});
