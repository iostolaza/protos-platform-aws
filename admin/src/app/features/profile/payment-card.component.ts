// src/app/features/profile/payment-card.component.ts
import { Component, effect, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService } from '@ui';

@Component({
  selector: 'app-payment-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment-card.component.html',
})
export class PaymentCardComponent {
  editMode = signal(false);
  loading = signal(true);
  payments = signal<any[]>([]);
  form: FormGroup;
  editingId: string | null = null;

  constructor(private fb: FormBuilder, private userService: UserService) {
    this.form = this.fb.group({
      type: ['', Validators.required],
      name: ['', Validators.required],
    });
    this.loadPayments();
  }

  async loadPayments() {
    this.loading.set(true);
    const pm = await this.userService.getPaymentMethods();
    this.payments.set(pm);
    this.loading.set(false);
  }

  toggleEdit(addNew = false) {
    this.editMode.update(m => !m);
    if (addNew) {
      this.editingId = null;
      this.form.reset();
    }
  }

  editPayment(payment: any) {
    this.editingId = payment.id;
    this.form.patchValue(payment);
    this.editMode.set(true);
  }

  async savePayment() {
    if (this.form.valid) {
      const { type, name } = this.form.value;
      if (this.editingId) {
        await this.userService.updatePaymentMethod(this.editingId, type, name);
      } else {
        await this.userService.addPaymentMethod(type, name);
      }
      await this.loadPayments();
      this.toggleEdit();
    }
  }

  async deletePayment(id: string) {
    await this.userService.deletePaymentMethod(id);
    await this.loadPayments();
  }
}