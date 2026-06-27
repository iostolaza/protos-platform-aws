// src/app/features/ticket-management/ticket-details/ticket-details.component.ts
import { Component, Input, Output, EventEmitter, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { TicketService } from '@ui';
import { getIconPath } from '@ui';
import { fetchAuthSession } from 'aws-amplify/auth';
import { TicketComment, FlatTicket } from '@ui';
import { StatusPipe } from '@ui';
import { StatusClassPipe } from '@ui';  // Added

@Component({
  selector: 'app-ticket-details',
  standalone: true,
  imports: [FormsModule, CommonModule, AngularSvgIconModule, StatusPipe, StatusClassPipe],  // Added StatusClassPipe
  templateUrl: './ticket-details.component.html',
})
export class TicketDetailsComponent {
  @Input() ticket!: FlatTicket;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<FlatTicket>();

  newNote: string = '';

  getIconPath = getIconPath;

  constructor(private ticketService: TicketService) {
    effect(() => {
      this.ticket.comments?.sort((a: TicketComment, b: TicketComment) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
  }

  editTicket() {
    this.edit.emit(this.ticket);
  }

  async deleteTicket() {
    await this.ticketService.deleteTicket(this.ticket.id);
    this.close.emit();
  }

  async addNote() {
    if (this.newNote.trim()) { 
      await this.ticketService.addComment(this.ticket.id, this.newNote);
      this.newNote = '';
      const refreshed = await this.ticketService.getTicketById(this.ticket.id);
      if (refreshed) {
        Object.assign(this.ticket, refreshed);
      }
    } else {
      console.warn('Empty note ignored');
    }
  }
}