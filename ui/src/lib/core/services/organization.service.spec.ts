import { TestBed } from '@angular/core/testing';
import { generateClient } from 'aws-amplify/data';
import { OrganizationService } from './organization.service';
import { OrgContextService } from './org-context.service';

jest.mock('aws-amplify/data');

describe('OrganizationService', () => {
  let service: OrganizationService;
  let mockOrgListBySlug: jest.Mock;
  let mockOrgList: jest.Mock;
  let mockOrgCreate: jest.Mock;

  const orgContextMock = {
    isSuperAdmin: jest.fn().mockReturnValue(true),
    getEffectiveOrgId: jest.fn().mockReturnValue('org-1'),
  };

  const testOrg = {
    organizationId: 'org-1',
    name: 'Test Corp',
    slug: 'testcorp',
    status: 'active',
    plan: 'trial',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'admin-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrgListBySlug = jest.fn().mockResolvedValue({ data: [testOrg], errors: null });
    mockOrgList = jest.fn().mockResolvedValue({ data: [testOrg], errors: null });
    mockOrgCreate = jest.fn().mockResolvedValue({ data: testOrg, errors: null });

    (generateClient as jest.Mock).mockReturnValue({
      models: {
        Organization: {
          listOrganizationBySlug: mockOrgListBySlug,
          list: mockOrgList,
          create: mockOrgCreate,
        },
      },
    });

    TestBed.configureTestingModule({
      providers: [
        OrganizationService,
        { provide: OrgContextService, useValue: orgContextMock },
      ],
    });
    service = TestBed.inject(OrganizationService);
  });

  describe('getActiveOrganizationBySlug', () => {
    it('should return org for valid active slug', async () => {
      const result = await service.getActiveOrganizationBySlug('testcorp');
      expect(result).toEqual({
        organizationId: 'org-1', name: 'Test Corp', slug: 'testcorp', status: 'active',
      });
    });

    it('should return null for suspended org', async () => {
      mockOrgListBySlug.mockResolvedValue({ data: [{ ...testOrg, status: 'suspended' }], errors: null });
      const result = await service.getActiveOrganizationBySlug('testcorp');
      expect(result).toBeNull();
    });

    it('should return null for invalid slug format', async () => {
      const result = await service.getActiveOrganizationBySlug('<script>alert(1)</script>');
      expect(result).toBeNull();
      expect(mockOrgListBySlug).not.toHaveBeenCalled();
    });
  });

  describe('createOrganization', () => {
    it('should create org with sanitized inputs', async () => {
      mockOrgListBySlug.mockResolvedValue({ data: [], errors: null });

      await service.createOrganization({
        name: 'New Corp', slug: 'newcorp', plan: 'starter', createdBy: 'admin-1',
      });

      expect(mockOrgCreate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Corp',
        slug: 'newcorp',
        plan: 'starter',
        vertical: 'full',
        status: 'trial',
      }));
    });

    it('should throw if slug already taken', async () => {
      mockOrgListBySlug.mockResolvedValue({ data: [testOrg], errors: null });

      await expect(service.createOrganization({
        name: 'Dup', slug: 'testcorp', plan: 'free', createdBy: 'admin-1',
      })).rejects.toThrow('slug already exists');
    });

    it('should throw for non-SuperAdmin', async () => {
      orgContextMock.isSuperAdmin.mockReturnValue(false);

      await expect(service.createOrganization({
        name: 'X', slug: 'x', plan: 'free', createdBy: 'user-1',
      })).rejects.toThrow('Super Admin');
    });
  });
});
