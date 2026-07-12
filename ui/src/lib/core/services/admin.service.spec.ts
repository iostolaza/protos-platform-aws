import { TestBed } from '@angular/core/testing';
import { generateClient } from 'aws-amplify/data';
import { AdminService } from './admin.service';
import { OrgContextService } from './org-context.service';

jest.mock('aws-amplify/data');

describe('AdminService', () => {
  let service: AdminService;

  let mockUserList: jest.Mock;
  let mockUserGet: jest.Mock;
  let mockUserUpdate: jest.Mock;
  let mockUserListByEmail: jest.Mock;
  let mockInviteUser: jest.Mock;
  let mockListGroups: jest.Mock;
  let mockListGroupsForUser: jest.Mock;
  let mockAddToGroup: jest.Mock;
  let mockRemoveFromGroup: jest.Mock;
  let mockDisableUser: jest.Mock;
  let mockEnableUser: jest.Mock;
  let mockListUsersInGroup: jest.Mock;

  const orgContextMock = {
    getEffectiveOrgId: jest.fn().mockReturnValue('org-1'),
    mergeWithOrgFilter: jest.fn((f: Record<string, unknown>) => f),
    isSuperAdmin: jest.fn().mockReturnValue(true),
    stampOrgId: jest.fn((p: Record<string, unknown>) => ({ ...p, organizationId: 'org-1' })),
  };

  const testUser = {
    cognitoId: 'user-1',
    email: 'alice@test.com',
    firstName: 'Alice',
    lastName: 'Test',
    organizationId: 'org-1',
    role: 'Tenant',
    status: 'active',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserList = jest.fn().mockResolvedValue({ data: [testUser], errors: null });
    mockUserGet = jest.fn().mockResolvedValue({ data: testUser, errors: null });
    mockUserUpdate = jest.fn().mockResolvedValue({ data: testUser, errors: null });
    mockUserListByEmail = jest.fn().mockResolvedValue({ data: [testUser] });
    mockInviteUser = jest.fn().mockResolvedValue({
      data: { invited: true, emailSent: false, userAlreadyExisted: false },
      errors: null,
    });
    mockListGroups = jest.fn().mockResolvedValue({ data: ['user_Admin', 'user_Tenant'] });
    mockListGroupsForUser = jest.fn().mockResolvedValue({ data: ['user_Tenant'], errors: null });
    mockAddToGroup = jest.fn().mockResolvedValue({ errors: null });
    mockRemoveFromGroup = jest.fn().mockResolvedValue({ errors: null });
    mockDisableUser = jest.fn().mockResolvedValue({ errors: null });
    mockEnableUser = jest.fn().mockResolvedValue({ errors: null });
    mockListUsersInGroup = jest.fn().mockResolvedValue({ data: [] });

    (generateClient as jest.Mock).mockReturnValue({
      models: {
        User: {
          list: mockUserList,
          get: mockUserGet,
          update: mockUserUpdate,
          listUserByEmail: mockUserListByEmail,
        },
      },
      mutations: {
        adminInviteUser: mockInviteUser,
        adminAddUserToGroup: mockAddToGroup,
        adminRemoveUserFromGroup: mockRemoveFromGroup,
        adminDisableUser: mockDisableUser,
        adminEnableUser: mockEnableUser,
      },
      queries: {
        adminListGroups: mockListGroups,
        adminListGroupsForUser: mockListGroupsForUser,
        adminListUsersInGroup: mockListUsersInGroup,
      },
    });

    TestBed.configureTestingModule({
      providers: [
        AdminService,
        { provide: OrgContextService, useValue: orgContextMock },
      ],
    });
    service = TestBed.inject(AdminService);
  });

  describe('inviteUser', () => {
    it('should call adminInviteUser mutation with org context', async () => {
      const result = await service.inviteUser({
        email: 'new@test.com', firstName: 'New', lastName: 'User', role: 'Tenant',
      });

      expect(mockInviteUser).toHaveBeenCalledWith(expect.objectContaining({
        email: 'new@test.com',
        firstName: 'New',
        role: 'Tenant',
        organizationId: 'org-1',
      }));
      expect(result.invited).toBe(true);
    });
  });

  describe('listUsers', () => {
    it('should return users with org filter', async () => {
      const users = await service.listUsers();
      expect(users).toEqual([testUser]);
      expect(mockUserList).toHaveBeenCalled();
    });
  });

  describe('getUserGroups', () => {
    it('should return groups for a user', async () => {
      const groups = await service.getUserGroups('alice@test.com');
      expect(groups).toEqual(['user_Tenant']);
    });
  });

  describe('changeUserRole', () => {
    it('should remove old groups and add new group', async () => {
      mockListGroupsForUser.mockResolvedValue({ data: ['user_Tenant'], errors: null });

      await service.changeUserRole('alice@test.com', 'Manager');

      expect(mockRemoveFromGroup).toHaveBeenCalledWith({ email: 'alice@test.com', groupName: 'user_Tenant' });
      expect(mockAddToGroup).toHaveBeenCalledWith({ email: 'alice@test.com', groupName: 'user_Manager' });
      expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({ role: 'Manager' }));
    });
  });

  describe('disableUser / enableUser', () => {
    it('should call mutation and update DDB status', async () => {
      await service.disableUser('alice@test.com');
      expect(mockDisableUser).toHaveBeenCalledWith({ email: 'alice@test.com' });
      expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'disabled' }));
    });

    it('should re-enable a user', async () => {
      await service.enableUser('alice@test.com');
      expect(mockEnableUser).toHaveBeenCalledWith({ email: 'alice@test.com' });
      expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    });
  });

  describe('resolveUserRole', () => {
    it('should prefer Cognito groups over DDB role', () => {
      expect(service.resolveUserRole(['user_Manager'], 'Tenant')).toBe('Manager');
    });

    it('should fall back to DDB role when no group match', () => {
      expect(service.resolveUserRole([], 'Employee')).toBe('Employee');
    });

    it('should return Unknown when nothing matches', () => {
      expect(service.resolveUserRole([], null)).toBe('Unknown');
    });
  });
});
