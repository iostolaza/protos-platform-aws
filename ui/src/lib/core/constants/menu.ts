import { MenuItem } from '../models/menu.model';

export const adminMenu: MenuItem[] = [
  {
    group: 'Main',
    separator: true,
    items: [
      { label: 'Home', icon: 'home', route: '/main-layout/home' },
      { label: 'Profile', icon: 'user-circle', route: '/main-layout/profile' },
      {
        label: 'Messages', icon: 'inbox-stack', route: null,
        children: [
          { label: 'Incoming', route: '/main-layout/messages/incoming' },
          { label: 'Outgoing', route: '/main-layout/messages/outgoing' },
        ],
      },
      {
        label: 'Contacts', icon: 'users', route: null,
        children: [
          { label: 'Online', route: '/main-layout/contacts/online' },
          { label: 'New', route: '/main-layout/contacts/new' },
          { label: 'Favorites', route: '/main-layout/contacts/favorites' },
        ],
      },
    ],
  },
  {
    group: 'Productivity',
    separator: true,
    items: [
      {
        label: 'Tickets', icon: 'ticket', route: null,
        children: [
          { label: 'Tickets', route: '/main-layout/ticket-management/tickets' },
          { label: 'Teams', route: '/main-layout/ticket-management/teams' },
          { label: 'Create Ticket', route: '/main-layout/ticket-management/create-ticket' },
          { label: 'Create Team', route: '/main-layout/ticket-management/create-team' },
        ],
      },
      { label: 'Documents', icon: 'document-text', route: '/main-layout/documents' },
      {
        label: 'Timesheet', icon: 'clock', route: null,
        children: [
          { label: 'Overview', route: '/main-layout/timesheet' },
          { label: 'Calendar', route: '/main-layout/timesheet/calendar' },
          { label: 'Review', route: '/main-layout/timesheet/review' },
        ],
      },
    ],
  },
  {
    group: 'Accounts & Finance',
    separator: true,
    items: [
      { label: 'Manage Accounts', icon: 'banknotes', route: '/main-layout/accounts' },
      { label: 'Account List', icon: 'table-cells', route: '/main-layout/accounts/list' },
      { label: 'Financials', icon: 'chart-bar-square', route: '/main-layout/financials' },
    ],
  },
  {
    group: 'Account',
    separator: false,
    items: [
      { label: 'Settings', icon: 'cog', route: '/main-layout/settings' },
      { label: 'Logout', icon: 'arrow-right-on-rectangle', route: '/logout' },
    ],
  },
];

export const portalMenu: MenuItem[] = [
  {
    group: 'Main',
    separator: true,
    items: [
      { label: 'Home', icon: 'home', route: '/main-layout/home' },
      { label: 'Profile', icon: 'user-circle', route: '/main-layout/profile' },
      {
        label: 'Messages', icon: 'inbox-stack', route: null,
        children: [
          { label: 'Incoming', route: '/main-layout/messages/incoming' },
          { label: 'Outgoing', route: '/main-layout/messages/outgoing' },
        ],
      },
      { label: 'Contacts', icon: 'users', route: '/main-layout/contacts' },
    ],
  },
  {
    group: 'Productivity',
    separator: true,
    items: [
      { label: 'Tickets', icon: 'ticket', route: '/main-layout/ticket-management/tickets' },
      { label: 'Documents', icon: 'document-text', route: '/main-layout/documents' },
      {
        label: 'Timesheet', icon: 'clock', route: null,
        children: [
          { label: 'Overview', route: '/main-layout/timesheet' },
          { label: 'Calendar', route: '/main-layout/timesheet/calendar' },
          { label: 'My Timesheets', route: '/main-layout/timesheet/list' },
        ],
      },
    ],
  },
  {
    group: 'Accounts & Finance',
    separator: true,
    items: [
      { label: 'Manage Accounts', icon: 'banknotes', route: '/main-layout/accounts' },
      { label: 'Account List', icon: 'table-cells', route: '/main-layout/accounts/list' },
      { label: 'Financials', icon: 'chart-bar-square', route: '/main-layout/financials' },
    ],
  },
  {
    group: 'Account',
    separator: false,
    items: [
      { label: 'Settings', icon: 'cog', route: '/main-layout/settings' },
      { label: 'Logout', icon: 'arrow-right-on-rectangle', route: '/logout' },
    ],
  },
];

// Backward compatibility — MenuService reads Menu.pages.
export class Menu {
  public static pages: MenuItem[] = adminMenu;
}
