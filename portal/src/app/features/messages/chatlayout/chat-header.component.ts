import { Component, input } from '@angular/core';
import { AngularSvgIconModule } from 'angular-svg-icon';  // Added import
import { getIconPath } from '@ui'; 

@Component({
  selector: 'app-chat-header',
  standalone: true,
  imports: [AngularSvgIconModule],  // Added to imports
  templateUrl: './chat-header.component.html',
})
export class ChatHeaderComponent {
  recipient = input<string>('');
  avatar = input<string>('');
  getIconPath = getIconPath;  
}