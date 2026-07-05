// src/app/features/ticket-management/edit-ticket/edit-ticket.component.ts

import { Component, Input, Output, EventEmitter, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { UserService } from '@ui';
import { TicketService } from '@ui';
import { FlatTicket } from '@ui';

function validDate(control: AbstractControl): { [key: string]: boolean } | null {
  const value = control.value;
  if (!value || isNaN(new Date(value).getTime())) {
    return { invalidDate: true };
  }
  return null;
}

@Component({
  selector: 'app-edit-ticket',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './edit-ticket.component.html',
})
export class EditTicketComponent implements OnInit {
  @Input() ticket!: FlatTicket;
  @Output() update = new EventEmitter<FlatTicket>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  errorMessage = signal<string | null>(null);
  users = signal<any[]>([]);

  private fb = inject(FormBuilder);
  private ticketService = inject(TicketService);
  private userService = inject(UserService);

  async ngOnInit() {
    this.form = this.fb.group({
      title: [this.ticket.title, Validators.required],
      description: [this.ticket.description || ''],
      status: [this.ticket.status, Validators.required],
      assigneeId: [this.ticket.assigneeId || ''],
      estimated: [this.ticket.estimated ? new Date(this.ticket.estimated).toISOString().split('T')[0] : '', [Validators.required, validDate]],
    });
    await this.fetchUsers();
  }

  async fetchUsers() {
    const allUsers = await this.userService.getAllUsers();
    this.users.set(allUsers);
  }

  async updateTicket() {
    if (this.form.valid) {
      const updatedPayload = {
        id: this.ticket.id,
        title: this.form.value.title,
        description: this.form.value.description,
        status: this.form.value.status,
        assigneeId: this.form.value.assigneeId,
        estimated: this.form.value.estimated,  
      };
      console.log('Update Payload:', updatedPayload); 
      const updatedBackend = await this.ticketService.updateTicket(updatedPayload);
      if (updatedBackend) {
        const updated: FlatTicket = {
          ...this.ticket,
          ...updatedPayload,
        };
        this.update.emit(updated);
      } else {
        this.errorMessage.set('Update failed - check console for details');
      }
    } else {
      this.errorMessage.set('Form invalid - check date format');
    }
  }
}