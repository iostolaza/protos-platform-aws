// src/app/features/messages/chatlayout/user-profile.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '@ui';
import { computed } from '@angular/core';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-profile.component.html',
})
export class UserProfileComponent implements OnInit {
  private userService = inject(UserService);
  user = computed(() => this.userService.user());
  truncatedEmail = computed(() => {
    const email = this.user()?.email ?? '';
    if (email.length > 20 && email.includes('@')) {
      return email.split('@')[0];  
    }
    return email;
  });

  async ngOnInit() {
    await this.userService.load(); 
  }
}