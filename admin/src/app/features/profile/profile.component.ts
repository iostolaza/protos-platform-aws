/*
 * ProfileComponent: Main profile page with scrolling sections/cards.
 * Loads user data, uses child components for modularity.
 * Best practice: Standalone, signals for v20+, reactive forms in children.
 * Cite: Angular components - https://angular.dev/guide/components
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '@ui';
import { PersonalInfoCardComponent } from './personal-info-card.component';
import { AddressCardComponent } from './address-card.component';
import { ContactPrefsCardComponent } from './contact-prefs-card.component';
import { PaymentCardComponent } from './payment-card.component';
import { EmergencyContactCardComponent } from './emergency-contact-card.component';
import { VehicleCardComponent } from './vehicle-card.component';

import { ProfileTitleComponent } from './profile-title.component';


  
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, PersonalInfoCardComponent, 
            AddressCardComponent, ContactPrefsCardComponent, 
            PaymentCardComponent, EmergencyContactCardComponent, 
            VehicleCardComponent, ProfileTitleComponent ],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  loading = signal(true);
  
  private userService = inject(UserService);
  
  async ngOnInit() {
    await this.userService.load();
    this.loading.set(false);
  }
}