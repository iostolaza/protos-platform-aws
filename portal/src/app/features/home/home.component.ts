
// src/app/features/home/home.component.ts

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { getCurrentUser, fetchUserAttributes, signOut } from 'aws-amplify/auth';
import { UserService } from '@ui';
import { HomeOverviewComponent } from './homecards/home-overview.component';
import { MessagesOverviewComponent } from './homecards/messages-overview.component';
import { ContactsOverviewComponent } from './homecards/contacts-overview.component';
import { TicketsOverviewComponent } from './homecards/tickets-overview.component';
import { ActivityOverviewComponent } from './homecards/activity-overview.component';
import { DocumentsOverviewComponent } from './homecards/documents-overview.component';
import { FinancialOverviewComponent } from './homecards/financial-overview.component';
import { ProfileOverviewComponent } from './homecards/profile-overview.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    HomeOverviewComponent,
    MessagesOverviewComponent,
    ContactsOverviewComponent,
    TicketsOverviewComponent,
    ActivityOverviewComponent,
    DocumentsOverviewComponent,
    FinancialOverviewComponent,
    ProfileOverviewComponent
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private router = inject(Router);
  private userService = inject(UserService);

  user = this.userService.user;

  async ngOnInit() {
    try {
      await getCurrentUser();
      const attributes = await fetchUserAttributes();
      // Update user service if needed
    } catch (error) {
      console.error('Error fetching user or data:', error);
      this.router.navigate(['/auth']);
    }
  }

  async handleSignOut() {
    try {
      await signOut();
      this.router.navigate(['/auth']);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }
}


// import { Component, inject, OnInit, signal } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { Router } from '@angular/router';
// import { getCurrentUser, signOut, fetchUserAttributes } from 'aws-amplify/auth';

// @Component({
//   selector: 'app-home',
//   standalone: true,
//   imports: [CommonModule],
//   templateUrl: './home.component.html',
// })
// export class Home implements OnInit {
//   private router = inject(Router);
//   userEmail = signal<string>('');
//   profileImage = signal<string>('assets/profile/profile-female.jpg');
//   metrics = signal<{ name: string; value: string }[]>([
//     { name: 'Users', value: '1,200' },
//     { name: 'Revenue', value: '$45,000' },
//     { name: 'Orders', value: '320' },
//     { name: 'Growth', value: '15%' }
//   ]);

//   async ngOnInit() {
//     try {
//       await getCurrentUser();
//       const attributes = await fetchUserAttributes();
//       this.userEmail.set(attributes.email || 'User');
//       if (attributes.picture) this.profileImage.set(attributes.picture);
//     } catch (error) {
//       console.error('Error fetching user:', error);
//       this.router.navigate(['/auth']);
//     }
//   }

//   async handleSignOut() {
//     try {
//       await signOut();
//       this.router.navigate(['/auth']);
//     } catch (error) {
//       console.error('Sign out error:', error);
//     }
//   }
// }
