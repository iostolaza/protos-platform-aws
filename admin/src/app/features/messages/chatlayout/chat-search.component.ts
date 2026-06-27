import { Component, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-search',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-search.component.html',
})
export class ChatSearchComponent {
  @Output() searchChanged = new EventEmitter<string>();
}
