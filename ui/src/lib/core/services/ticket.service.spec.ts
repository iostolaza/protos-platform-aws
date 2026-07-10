import { TestBed } from '@angular/core/testing';
import { generateClient } from 'aws-amplify/data';
import { TicketService } from './ticket.service';
import { OrgContextService } from './org-context.service';
import { TicketStatus } from '../models/tickets.model';

jest.mock('aws-amplify/data');

describe('TicketService org isolation', () => {
  let service: TicketService;
  let orgContext: OrgContextService;
  let mockTicketList: jest.Mock;
  let mockTicketCreate: jest.Mock;

  const mockTicketRecord = (id: string, organizationId: string) => ({
    id,
    title: `Ticket ${id}`,
    description: 'Test description',
    estimated: '2026-07-01',
    createdAt: '2026-07-01T00:00:00.000Z',
    requesterId: 'requester-1',
    status: 'OPEN',
    organizationId,
    labels: [] as string[],
    updatedAt: '2026-07-01T00:00:00.000Z',
    assigneeId: null,
    teamId: null,
    requester: async () => ({ data: { firstName: 'Test', lastName: 'User' } }),
    assignee: async () => ({ data: null }),
    team: async () => ({ data: null }),
    comments: async () => ({ data: [] }),
  });

  beforeEach(() => {
    mockTicketList = jest.fn();
    mockTicketCreate = jest.fn();

    (generateClient as jest.Mock).mockReturnValue({
      models: {
        Ticket: {
          list: mockTicketList,
          create: mockTicketCreate,
        },
      },
    });

    TestBed.configureTestingModule({
      providers: [TicketService, OrgContextService],
    });

    service = TestBed.inject(TicketService);
    orgContext = TestBed.inject(OrgContextService);
    orgContext.clearOrg();
  });

  it('createTicket stamps organizationId from OrgContextService', async () => {
    orgContext.setActingOrgId('org-company-a');
    mockTicketCreate.mockResolvedValue({
      data: { id: 'new-ticket', organizationId: 'org-company-a' },
      errors: undefined,
    });

    await service.createTicket({
      title: 'Leak test',
      description: 'Should be org-stamped',
      estimated: '2026-07-10',
      requesterId: 'user-1',
    });

    expect(mockTicketCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-company-a',
        title: 'Leak test',
        status: TicketStatus.OPEN,
      })
    );
  });

  it('getTickets applies mergeWithOrgFilter for the active org', async () => {
    orgContext.setActingOrgId('org-company-b');
    mockTicketList.mockResolvedValue({ data: [], errors: undefined, nextToken: undefined });

    await service.getTickets();

    expect(mockTicketList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { organizationId: { eq: 'org-company-b' } },
      })
    );
  });

  it('Company B org context does NOT return Company A tickets', async () => {
    orgContext.setActingOrgId('org-company-b');
    const allTickets = [
      mockTicketRecord('ticket-a', 'org-company-a'),
      mockTicketRecord('ticket-b', 'org-company-b'),
    ];

    mockTicketList.mockImplementation(async (args: { filter?: { organizationId?: { eq?: string } } }) => {
      const orgEq = args.filter?.organizationId?.eq;
      const data = orgEq ? allTickets.filter((t) => t.organizationId === orgEq) : allTickets;
      return { data, errors: undefined, nextToken: undefined };
    });

    const { tickets } = await service.getTickets();

    expect(tickets.map((t) => t.id)).toEqual(['ticket-b']);
    expect(tickets.map((t) => t.id)).not.toContain('ticket-a');
  });
});
