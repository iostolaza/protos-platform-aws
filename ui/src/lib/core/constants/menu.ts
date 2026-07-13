import { FEATURES } from '@shared';
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
        feature: FEATURES.MESSAGING,
        children: [
          { label: 'Incoming', route: '/main-layout/messages/incoming' },
          { label: 'Outgoing', route: '/main-layout/messages/outgoing' },
        ],
      },
      {
        label: 'Contacts', icon: 'users', route: null,
        feature: FEATURES.CONTACTS,
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
        feature: FEATURES.TICKETS,
        children: [
          { label: 'Tickets', route: '/main-layout/ticket-management/tickets' },
          { label: 'Teams', route: '/main-layout/ticket-management/teams', feature: FEATURES.TICKET_TEAMS },
          { label: 'Create Ticket', route: '/main-layout/ticket-management/create-ticket' },
          { label: 'Create Team', route: '/main-layout/ticket-management/create-team', feature: FEATURES.TICKET_TEAMS },
        ],
      },
      { label: 'Documents', icon: 'document-text', route: '/main-layout/documents', feature: FEATURES.DOCUMENTS },
      {
        label: 'Timesheet', icon: 'clock', route: null,
        feature: FEATURES.TIMESHEETS,
        children: [
          { label: 'Overview', route: '/main-layout/timesheet' },
          { label: 'Calendar', route: '/main-layout/timesheet/calendar' },
          { label: 'Review', route: '/main-layout/timesheet/review', feature: FEATURES.TIMESHEET_REVIEW },
        ],
      },
    ],
  },
  {
    group: 'Accounts & Finance',
    separator: true,
    items: [
      {
        label: 'Manage Accounts', icon: 'banknotes', route: '/main-layout/accounts',
        feature: FEATURES.ACCOUNTS, groups: ['user_Admin', 'user_Manager'],
      },
      { label: 'Account List', icon: 'table-cells', route: '/main-layout/accounts/list', feature: FEATURES.ACCOUNTS },
      { label: 'Financials', icon: 'chart-bar-square', route: '/main-layout/financials', feature: FEATURES.INVOICES },
    ],
  },
  {
    group: 'Administration',
    separator: true,
    items: [
      { label: 'Employees', icon: 'users', route: '/main-layout/employees', feature: FEATURES.EMPLOYEES, groups: ['user_Admin'] },
      { label: 'Tenants', icon: 'user-group', route: '/main-layout/tenants', feature: FEATURES.TENANTS, groups: ['user_Admin'] },
      { label: 'Organizations', icon: 'building-office-2', route: '/main-layout/organizations', groups: ['platform_SuperAdmin'] },
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
        feature: FEATURES.MESSAGING,
        children: [
          { label: 'Incoming', route: '/main-layout/messages/incoming' },
          { label: 'Outgoing', route: '/main-layout/messages/outgoing' },
        ],
      },
      { label: 'Contacts', icon: 'users', route: '/main-layout/contacts', feature: FEATURES.CONTACTS },
    ],
  },
  {
    group: 'Productivity',
    separator: true,
    items: [
      { label: 'Tickets', icon: 'ticket', route: '/main-layout/ticket-management/tickets', feature: FEATURES.TICKETS },
      { label: 'Documents', icon: 'document-text', route: '/main-layout/documents', feature: FEATURES.DOCUMENTS },
      {
        label: 'Timesheet', icon: 'clock', route: null,
        feature: FEATURES.TIMESHEETS,
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
      {
        label: 'Manage Accounts', icon: 'banknotes', route: '/main-layout/accounts',
        feature: FEATURES.ACCOUNTS, groups: ['user_Admin', 'user_Manager'],
      },
      { label: 'Account List', icon: 'table-cells', route: '/main-layout/accounts/list', feature: FEATURES.ACCOUNTS },
      { label: 'Financials', icon: 'chart-bar-square', route: '/main-layout/financials', feature: FEATURES.INVOICES },
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
