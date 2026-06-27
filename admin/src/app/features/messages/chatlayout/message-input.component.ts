import { Component, Output, EventEmitter, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath } from '@ui';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [FormsModule, AngularSvgIconModule],
  templateUrl: './message-input.component.html',
})
export class MessageInputComponent {
  newMessage = '';
  file: File | null = null;
  disabled = input<boolean>(false);
  @Output() send = new EventEmitter<string>();
  @Output() sendWithFile = new EventEmitter<{text: string, file: File}>();
  getIconPath = getIconPath;

  onSend() {
    if (this.disabled()) return;
    if (this.file) {
      this.sendWithFile.emit({text: this.newMessage, file: this.file});
    } else if (this.newMessage.trim()) {
      this.send.emit(this.newMessage);
    }
    this.newMessage = '';
    this.file = null;
  }
  onFileChange(event: Event) {
    if (this.disabled()) return;
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.file = target.files[0];
    }
  }
}