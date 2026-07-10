import { Routes } from '@angular/router';
import { authGuard, noAuthGuard, adminGuard, superAdminGuard, MainLayoutComponent } from '@ui';
import { SignInComponent } from './features/auth/sign-in.component';

export const appRoutes: Routes = [
  { path: '', redirectTo: 'sign-in', pathMatch: 'full' },

  { path: 'sign-in', component: SignInComponent, canActivate: [noAuthGuard] },

  {
    path: 'main-layout',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'home', loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent) },

      {
        path: 'admin',
        redirectTo: 'employees',
        pathMatch: 'full',
      },
      {
        path: 'employees',
        loadComponent: () =>
          import('./features/employees/employees.component').then((m) => m.EmployeesComponent),
        canActivate: [adminGuard],
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./features/tenants/tenants.component').then((m) => m.TenantsComponent),
        canActivate: [adminGuard],
      },
      {
        path: 'tenants/:cognitoId',
        loadComponent: () =>
          import('./features/tenants/tenant-detail/tenant-detail.component').then(
            (m) => m.TenantDetailComponent
          ),
        canActivate: [adminGuard],
      },
      {
        path: 'organizations',
        loadComponent: () =>
          import('./features/organizations/organizations.component').then(
            (m) => m.OrganizationsComponent
          ),
        canActivate: [superAdminGuard],
      },

      { path: 'profile', loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },

      { path: 'messages', redirectTo: 'messages/incoming', pathMatch: 'full' },
      { path: 'messages/incoming', loadComponent: () => import('./features/messages/messages.component').then(m => m.MessagesComponent) },
      { path: 'messages/incoming/:channelId', loadComponent: () => import('./features/messages/messages.component').then(m => m.MessagesComponent) },
      { path: 'messages/outgoing', loadComponent: () => import('./features/messages/messages.component').then(m => m.MessagesComponent) },
      { path: 'messages/outgoing/:channelId', loadComponent: () => import('./features/messages/messages.component').then(m => m.MessagesComponent) },

      { path: 'contacts', loadComponent: () => import('./features/contacts/contacts.component').then(m => m.ContactsComponent) },
      { path: 'contacts/new', loadComponent: () => import('./features/contacts/contacts.component').then(m => m.ContactsComponent) },
      { path: 'contacts/favorites', loadComponent: () => import('./features/contacts/contacts.component').then(m => m.ContactsComponent) },
      { path: 'contacts/online', loadComponent: () => import('./features/contacts/contacts.component').then(m => m.ContactsComponent) },

      {
        path: 'ticket-management',
        loadComponent: () => import('./features/ticket-management/ticket-management.component').then(m => m.TicketManagementComponent),
        children: [
          { path: '', redirectTo: 'tickets', pathMatch: 'full' },
          { path: 'tickets', loadComponent: () => import('./features/ticket-management/ticket-list/ticket-list.component').then(m => m.TicketListComponent) },
          { path: 'teams', loadComponent: () => import('./features/ticket-management/team-list/team-list.component').then(m => m.TeamListComponent) },
          { path: 'create-ticket', loadComponent: () => import('./features/ticket-management/generate-tickets/generate-tickets.component').then(m => m.GenerateTicketsComponent) },
          { path: 'create-team', loadComponent: () => import('./features/ticket-management/generate-team/generate-team.component').then(m => m.GenerateTeamComponent) },
        ],
      },

      { path: 'documents', loadComponent: () => import('./features/documents/documents.component').then(m => m.DocumentsComponent) },

      { path: 'financials', loadComponent: () => import('./features/financials/financials.component').then(m => m.FinancialsComponent) },

      { path: 'accounts', loadComponent: () => import('./features/accounts/accounts-dashboard/accounts-dashboard.component').then(m => m.AccountsDashboardComponent) },
      { path: 'accounts/list', loadComponent: () => import('./features/accounts/account-list/account-list.component').then(m => m.AccountListComponent) },
      { path: 'accounts/new', loadComponent: () => import('./features/accounts/account-form/account-form.component').then(m => m.AccountFormComponent) },
      { path: 'accounts/edit/:id', loadComponent: () => import('./features/accounts/account-form/account-form.component').then(m => m.AccountFormComponent) },

      { path: 'timesheet', loadComponent: () => import('./features/timesheet/timesheet.component').then(m => m.Timesheet) },
      { path: 'timesheet/calendar', loadComponent: () => import('./features/timesheet/calendar-view/calendar.component').then(m => m.CalendarComponent) },
      { path: 'timesheet/review', loadComponent: () => import('./features/timesheet/review-list/review-list.component').then(m => m.ReviewListComponent) },
      { path: 'timesheet/submitted', redirectTo: 'timesheet/review', pathMatch: 'full' },
      { path: 'timesheet/pending', redirectTo: 'timesheet/review', pathMatch: 'full' },
      { path: 'timesheet/approved', redirectTo: 'timesheet/review', pathMatch: 'full' },

      { path: 'settings', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },

      { path: 'logout', loadComponent: () => import('./features/auth/sign-in.component').then(m => m.SignInComponent) },
    ],
  },

  { path: '**', redirectTo: 'sign-in' },
];
