// admin/src/app/features/financials/invoice-details/invoice-details.component.ts — icons: getIconPath ✅ (Phase 1 sweep)

import { Component, Input, OnInit, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { FinancialService, RoleService, AuthService, UserService, ContactService, Invoice, InvoiceItem, InputContact, getIconPath } from '@ui';
import { Router } from '@angular/router';

interface DictItem {
  description: string;
  price: number;
}

@Component({
  selector: 'app-invoice-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DecimalPipe, AngularSvgIconModule],
  templateUrl: './invoice-details.component.html',
  providers: [DecimalPipe],
})
export class InvoiceDetailsComponent implements OnInit {
  getIconPath = getIconPath;
  @Input() invoice!: Invoice;
  @Output() closed = new EventEmitter<void>();
  @Output() edit = new EventEmitter<string>(); // Keep for parent nav if needed
  @Output() refresh = new EventEmitter<void>(); // NEW: For ledger refresh on save

  editMode = signal(false);
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
  isManager = false;
  isAdminOrManager = false;
  assignedBuildings: string[] = [];
  currentUser = signal<any>(null); // NEW: For billFrom name

  // NEW: Computed for billTo name (reactive, avoids template find)
  billToName = computed(() => {
    const contact = this.contacts().find(c => c.cognitoId === this.invoice.billToId);
    return contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown' : 'Unknown';
  });

  private fb = inject(FormBuilder);
  private financialService = inject(FinancialService);
  private role = inject(RoleService);
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private contactService = inject(ContactService);
  private router = inject(Router);

  constructor() {
    this.form = this.fb.group({
      invoiceNumber: [{ value: '', disabled: true }],
      selectedType: [''],
      orderStatus: ['pending', Validators.required],
      orderDate: ['', Validators.required],
      billFrom: [{ value: '', disabled: true }],
      fromAddress: [''],
      description: ['', Validators.required],
      tenantId: ['', Validators.required],
      toAddress: [''],
      building: [''],
      items: this.fb.array([]),
    });
    this.items = this.form.get('items') as FormArray<FormGroup>;
  }

  async ngOnInit(): Promise<void> {
    this.currentUser.set(this.userService.user()); // NEW: Set for reactivity
    if (this.currentUser()) {
      const user = this.currentUser();
      this.form.patchValue({
        billFrom: `${user.firstName} ${user.lastName} (${user.email})`,
        fromAddress: user.address ? `${user.address.line1}, ${user.address.city}, ${user.address.state}` : '',
      });
      this.isManager = await this.role.isManager$();
      this.isAdminOrManager = this.isManager || await this.role.isAdmin$();
      this.assignedBuildings = await this.auth.getAssignedBuildings();
    }
    const contactsData = await this.contactService.getContacts();
    this.contacts.set(contactsData);

    this.loadInvoiceData();
    if (!this.invoice.items) this.invoice.items = [];

    this.form.get('selectedType')?.valueChanges.subscribe(type => this.selectedType.set(type));
    this.form.get('items')?.valueChanges.subscribe(() => this.form.updateValueAndValidity());
    this.form.get('tenantId')?.valueChanges.subscribe(id => {
      const contact = this.contacts().find(c => c.cognitoId === id);
      if (contact && contact.address) {
        const addr = `${contact.address.line1 || ''}${contact.address.line1 ? ', ' : ''}${contact.address.city || ''}${contact.address.city ? ', ' : ''}${contact.address.state || ''}${contact.address.state ? ' ' + (contact.address.zip || '') : ''}`;
        this.form.patchValue({ toAddress: addr.trim() || '' });
      } else {
        this.form.patchValue({ toAddress: '' });
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

  private loadInvoiceData(): void {
    const shortDate = this.invoice.date.split('T')[0];
    console.log('Patching orderDate:', shortDate, 'Original:', this.invoice.date);

    this.form.patchValue({
      invoiceNumber: this.invoice.invoiceNumber,
      orderStatus: this.invoice.status,
      orderDate: shortDate, // FIXED: Use truncated date
      fromAddress: this.invoice.fromAddress,
      description: this.invoice.description,
      tenantId: this.invoice.billToId,
      toAddress: this.invoice.toAddress,
      building: this.invoice.building,
    });
    // FIXED: Ensure items is array before forEach
    this.items.clear();
    if (Array.isArray(this.invoice.items)) {
      this.invoice.items.forEach(item => this.items.push(this.createItemGroup(item)));
    } else {
      console.warn('Invoice items not array:', this.invoice.items);
    }
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

  toggleEdit(): void {
    if (this.editMode()) {
      this.loadInvoiceData(); // Reload on cancel
    }
    this.editMode.update(m => !m);
  }

  editInvoice(): void {
    this.toggleEdit(); // FIXED: Inline toggle instead of emit
  }

  sendInvoice(): void {
    this.financialService.sendInvoice(this.invoice.invoiceId).subscribe({
      next: (updated) => {
        console.log('Invoice sent:', updated);
        this.invoice.status = updated?.status || 'open';
      },
      error: err => console.error('Send failed:', err),
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      alert('Form invalid – check fields'); // NEW: User feedback
      return;
    }
    const formValue = this.form.getRawValue();
    const invoiceData: Partial<Invoice> & { items: Partial<InvoiceItem>[] } = {
      date: formValue.orderDate,
      status: formValue.orderStatus as 'pending' | 'open' | 'closed',
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
        invoiceItemId: crypto.randomUUID(),
        invoiceId: this.invoice.invoiceId,
      })),
    };
    console.log('Saving invoiceData:', invoiceData); // NEW: Debug log
    this.financialService.updateInvoice(this.invoice.invoiceId, invoiceData).subscribe({
      next: (updated) => {
        if (updated) {
          Object.assign(this.invoice, updated);
          this.financialService.sendInvoice(this.invoice.invoiceId).subscribe({
            next: () => {
              alert('Invoice updated successfully!'); // NEW: Feedback
              this.toggleEdit();
              this.refresh.emit(); // NEW: Trigger parent ledger refresh
              this.closed.emit();
            },
            error: err => console.error('Send after update failed:', err),
          });
        }
      },
      error: err => {
        console.error('Update failed:', err); // FIXED: Log for debug
        alert('Update failed – check console');
      },
    });
  }

  downloadPdf(): void {
    const doc = this.financialService.generatePdf(this.invoice);
    doc.save(`invoice_${this.invoice.invoiceNumber}.pdf`);
  }

  trackUser(_: number, contact: InputContact): string { return contact.cognitoId; }
  trackBuilding(_: number, building: string): string { return building; }
  trackItem(_: number, item: FormGroup): any { return item; }
  trackItemOption(_: number, item: { description: string }): string { return item.description; }
}