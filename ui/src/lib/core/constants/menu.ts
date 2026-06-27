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
        label: 'Ticket Management', icon: 'ticket', route: null,
        children: [
          { label: 'Tickets', route: '/main-layout/ticket-management/tickets' },
          { label: 'Teams', route: '/main-layout/ticket-management/teams' },
          { label: 'Create Ticket', route: '/main-layout/ticket-management/create-ticket' },
          { label: 'Create Team', route: '/main-layout/ticket-management/create-team' },
        ],
      },
      { label: 'Documents', icon: 'document-text', route: '/main-layout/documents' },
      { label: 'Financial', icon: 'chart-bar-square', route: '/main-layout/financials' },
      { label: 'Analytics', icon: 'chart-bar', route: '/main-layout/analytics' },
      {
        label: 'Timesheet', icon: 'clock', route: null,
        children: [
          { label: 'Submitted', route: '/main-layout/timesheet/submitted' },
          { label: 'Pending', route: '/main-layout/timesheet/pending' },
          { label: 'Approved', route: '/main-layout/timesheet/approved' },
        ],
      },
      {
        label: 'Schedule', icon: 'calendar-date-range', route: null,
        children: [
          { label: 'Calendar', route: '/main-layout/schedule/calendar' },
        ],
      },
    ],
  },
  {
    group: 'Administration',
    separator: true,
    items: [
      { label: 'Admin Dashboard', icon: 'shield-check', route: '/main-layout/admin' },
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
      { label: 'My Tickets', icon: 'ticket', route: '/main-layout/ticket-management/tickets' },
      { label: 'My Documents', icon: 'document-text', route: '/main-layout/documents' },
      { label: 'My Financials', icon: 'chart-bar-square', route: '/main-layout/financials' },
      {
        label: 'Timesheet', icon: 'clock', route: null,
        children: [
          { label: 'Calendar', route: '/main-layout/timesheet/calendar' },
          { label: 'My Timesheets', route: '/main-layout/timesheet/list' },
        ],
      },
      {
        label: 'Schedule', icon: 'calendar-date-range', route: null,
        children: [
          { label: 'Calendar', route: '/main-layout/schedule/calendar' },
        ],
      },
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
