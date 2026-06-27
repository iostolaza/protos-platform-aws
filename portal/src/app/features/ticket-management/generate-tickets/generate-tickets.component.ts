// src/app/features/ticket-management/generate-tickets/generate-tickets.component.ts

import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, AbstractControl, ValidationErrors } from '@angular/forms';
import { TicketService } from '@ui';
import { getCurrentUser } from 'aws-amplify/auth';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-generate-tickets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './generate-tickets.component.html',
})
export class GenerateTicketsComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  errorMessage = signal('');
  successMessage = signal('');
  private destroy$ = new Subject<void>();
  private currentUserId = '';

  constructor(private fb: FormBuilder, private ticketService: TicketService) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(4)]],
      description: ['', Validators.required],
      estimated: ['', [Validators.required, this.futureDateValidator]],
    });
  }

  futureDateValidator = (control: AbstractControl): ValidationErrors | null => {
    const date = new Date(control.value);
    const now = new Date();
    return date > now ? null : { pastDate: true };
  };

  async ngOnInit() {
    try {
      const { userId } = await getCurrentUser();
      this.currentUserId = userId;
      console.log('Current User ID:', this.currentUserId);
    } catch (err) {
      console.error('Init error:', err);
      this.errorMessage.set('Failed to initialize form');
    }
  }

  async submit() {
    if (this.form.invalid) {
      const errors = [];
      if (this.form.get('title')?.errors) errors.push('Title is required and must be at least 4 characters');
      if (this.form.get('description')?.errors) errors.push('Description is required');
      if (this.form.get('estimated')?.hasError('pastDate')) errors.push('Estimated date must be in the future');
      this.errorMessage.set(`Form invalid: ${errors.join(', ')}`);
      console.log('Form invalid, value:', this.form.value);
      return;
    }
    this.successMessage.set('');
    this.errorMessage.set('');
    try {
      const { userId } = await getCurrentUser();
      const values = this.form.value;
      const ticket = {
        title: values.title,
        description: values.description,
        estimated: values.estimated,
        requesterId: userId,
      };
      const created = await this.ticketService.createTicket(ticket);
      if (created) {
        this.form.reset();
        this.successMessage.set('Ticket created successfully');
        console.log('Ticket created successfully:', created);
      } else {
        this.errorMessage.set('Ticket creation failed - no data returned');
      }
    } catch (err) {
      console.error('Submit error:', err);
      this.errorMessage.set('Failed to create ticket: ' + (err as Error).message);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}