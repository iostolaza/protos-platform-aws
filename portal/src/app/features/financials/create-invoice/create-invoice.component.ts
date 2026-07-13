// portal/src/app/features/financials/create-invoice/create-invoice.component.ts — icons: getIconPath ✅ (Phase 1 sweep)
// src/app/features/financials/create-invoice/create-invoice.component.ts
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { FinancialService, AuthService, UserService, ContactService, Invoice, InvoiceItem, InputContact, getIconPath } from '@ui';
import { Router } from '@angular/router';

interface DictItem {
  description: string;
  price: number;
}

@Component({
  selector: 'app-create-invoice',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AngularSvgIconModule],
  templateUrl: './create-invoice.component.html',
  providers: [DecimalPipe],
})
export class CreateInvoiceComponent implements OnInit {
  getIconPath = getIconPath;
  @Input() accountId = '';
  @Input() isManager = false;
  @Input() assignedBuildings: string[] = [];
  @Output() created = new EventEmitter<Invoice>();

  form: FormGroup;
  items: FormArray<FormGroup>;
  orderStatuses = ['pending', 'open', 'closed'];
  contacts = signal<InputContact[]>([]);
  selectedType = signal('');
  vatRate = 0.0825;
  itemsDict: Record<string, DictItem[]> = {
    wedding: [{ description: 'Venue Rental', price: 5000 }, { description: 'Catering', price: 2000 }],
    real_estate: [{ description: 'Property Inspection', price: 500 }, { description: 'Closing Fees', price: 1000 }],
  };

  private fb = inject(FormBuilder);
  private financialService = inject(FinancialService);
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private contactService = inject(ContactService);
  private router = inject(Router);

  constructor() {
    this.form = this.fb.group({
      invoiceNumber: [{ value: '', disabled: true }],
      selectedType: [''],
      orderStatus: ['pending', Validators.required],
      orderDate: [new Date().toISOString().split('T')[0], Validators.required],
      billFrom: [{ value: '', disabled: true }],
      fromAddress: [''],
      description: ['', Validators.required],
      tenantId: ['', Validators.required],
      toAddress: [''],
      building: [''],
      items: this.fb.array([this.createItemGroup()]),
    });
    this.items = this.form.get('items') as FormArray<FormGroup>;
  }

  async ngOnInit(): Promise<void> {
    const currentUser = this.userService.user();
    if (currentUser) {
      this.form.patchValue({
        billFrom: `${currentUser.firstName} ${currentUser.lastName} (${currentUser.email})`,
        fromAddress: currentUser.address ? `${currentUser.address.line1}, ${currentUser.address.city}, ${currentUser.address.state}` : '',
      });
    }

    const contactsData = await this.contactService.getContacts();
    this.contacts.set(contactsData);
    
    this.form.get('selectedType')?.valueChanges.subscribe(type => this.selectedType.set(type));
    this.form.get('items')?.valueChanges.subscribe(() => this.form.updateValueAndValidity());
    this.form.get('tenantId')?.valueChanges.subscribe(id => {
      const contact = this.contacts().find(c => c.cognitoId === id);
      if (contact && contact.address) {
        const addr = `${contact.address.line1 || ''}${contact.address.line1 ? ', ' : ''}${contact.address.city || ''}${contact.address.city ? ', ' : ''}${contact.address.state || ''}${contact.address.state ? ' ' + (contact.address.zip || '') : ''}`;
        this.form.patchValue({ toAddress: addr.trim() || '' });
      } else {
        this.form.patchValue({ toAddress: '' });  // Clear if no address (manual entry)
      }
    });
    this.items.valueChanges.subscribe(() => {
          this.items.controls.forEach((item, i) => {
            const val = item.value;
            const total = (val.unitPrice || 0) * (val.units || 0); 
            item.patchValue({ total }, { emitEvent: false });
          });
          this.form.updateValueAndValidity();
        });
  }

  createItemGroup(item?: Partial<InvoiceItem>): FormGroup {
    return this.fb.group({
      name: [item?.name || '', Validators.required],
      unitPrice: [item?.unitPrice || 0, [Validators.required, Validators.min(0)]],
      units: [item?.units || 1, [Validators.required, Validators.min(1)]],
      total: [{ value: 0, disabled: true }],
    });
  }

  onTypeChange(): void {
    // Existing logic if needed
  }

  filteredItems(): DictItem[] {
    const type = this.selectedType();
    if (type in this.itemsDict) {
      return this.itemsDict[type];
    }
    return [];
  }

  onAddItemChange(description: string): void {
    if (!description) return;
    const selected = this.filteredItems().find((item: DictItem) => item.description === description);
    if (selected) {
      this.items.push(this.createItemGroup({ name: selected.description, unitPrice: selected.price, units: 1 }));
    }
  }

  removeItem(index: number): void {
    if (this.items.length > 1) this.items.removeAt(index);
  }

  itemProductTotal(item: any): number {
    return (item.unitPrice || 0) * (item.units || 0);
  }

subtotal(): number {
    return this.items.controls.reduce((sum, item) => {
      const val = item.value;
      const itemTotal = this.itemProductTotal(val);
      // Optional: Patch for UI display (if needed; disabled total updates visually)
      item.patchValue({ total: itemTotal }, { emitEvent: false });
      return sum + itemTotal;
    }, 0);
  }

  vat(): number {
    return this.subtotal() * this.vatRate;
  }

  grandTotal(): number {
    return this.subtotal() + this.vat();
  }

  private resetForm(): void {
    this.form.reset({
      selectedType: '',
      orderStatus: 'pending',
      orderDate: new Date().toISOString().split('T')[0],
      billFrom: this.form.get('billFrom')?.value,  
      fromAddress: this.form.get('fromAddress')?.value,
      description: '',
      tenantId: '',
      toAddress: '',
      building: '',
    });
    this.items.clear();
    this.items.push(this.createItemGroup());  // Add one empty item
    this.selectedType.set('');
  }

  onCancel(): void {
    this.resetForm();  // FIXED: Reset form
  }

onSave(): void {
  if (this.form.invalid) return;
  const formValue = this.form.getRawValue();
  const invoiceData: Partial<Invoice> & { items: Partial<InvoiceItem>[] } = {
    date: formValue.orderDate,
    status: formValue.orderStatus,
    billToId: formValue.tenantId,
    fromAddress: formValue.fromAddress,
    toAddress: formValue.toAddress,
    description: formValue.description,
    building: formValue.building,
    subtotal: this.subtotal(),
    tax: this.vat(),
    grandTotal: this.grandTotal(),
    items: this.items.value.map((item: any) => ({
      name: item.name,
      unitPrice: item.unitPrice,
      units: item.units,
      total: this.itemProductTotal(item),
      invoiceItemId: crypto.randomUUID(),  // Keep, service ignores if needed
      // REMOVED: invoiceId: '',  // FIXED: Let service set
    })),
  };
  console.log('Invoice data before service:', invoiceData);  // ADDED: Log for debug
  this.financialService.createInvoice(invoiceData).subscribe({
    next: (invoice) => {
      if (invoice) this.created.emit(invoice);
      this.resetForm();
    },
    error: err => console.error('Save failed', err),
  });
}

  trackUser(_: number, contact: InputContact): string { return contact.cognitoId; }
  trackBuilding(_: number, building: string): string { return building; }
  trackItem(_: number, item: FormGroup): any { return item; }
  trackItemOption(_: number, item: { description: string }): string { return item.description; }
}