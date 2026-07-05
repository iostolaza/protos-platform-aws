import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FinancialService } from '@ui';
import { RoleService } from '@ui';
import { AuthService } from '@ui';
import { UserService } from '@ui';
import { ContactService } from '@ui';
import { Router } from '@angular/router';
import { Invoice, InvoiceItem } from '@ui';
import { InputContact } from '@ui';

interface DictItem {
  description: string;
  price: number;
}

@Component({
  selector: 'app-edit-invoice',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-invoice.component.html',
  providers: [DecimalPipe],
})
export class EditInvoiceComponent implements OnInit {
  @Input() invoiceId!: string;
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
  assignedBuildings: string[] = [];

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
    const currentUser = this.userService.user();
    if (currentUser) {
      this.form.patchValue({
        billFrom: `${currentUser.firstName} ${currentUser.lastName} (${currentUser.email})`,
        fromAddress: currentUser.address ? `${currentUser.address.line1}, ${currentUser.address.city}, ${currentUser.address.state}` : '',
      });
      this.isManager = await this.role.isManager$();
      this.assignedBuildings = await this.auth.getAssignedBuildings();
    }
    const contactsData = await this.contactService.getContacts();
    this.contacts.set(contactsData);

    this.financialService.getInvoice(this.invoiceId).subscribe(invoice => {
      if (invoice) {
        this.form.patchValue({
          invoiceNumber: invoice.invoiceNumber,
          orderStatus: invoice.status,
          orderDate: invoice.date,
          fromAddress: invoice.fromAddress,
          description: invoice.description,
          tenantId: invoice.billToId,
          toAddress: invoice.toAddress,
          building: invoice.building,
        });
        invoice.items?.forEach((item: InvoiceItem) => this.items.push(this.createItemGroup(item)));  // ADDED: Type
      }
    });

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

  onCancel(): void {
    this.router.navigate(['/financials']);
  }

onSave(): void {
  if (this.form.invalid) return;
  const formValue = this.form.getRawValue();
  const invoiceData: Partial<Invoice> & { items: Partial<InvoiceItem>[] } = {
    date: formValue.orderDate,
    status: 'open',  // UPDATED: Set to open on save
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
      invoiceId: this.invoiceId,
    })),
  };
  this.financialService.updateInvoice(this.invoiceId, invoiceData).subscribe({
    next: (updated) => {
      if (updated) {
        this.financialService.sendInvoice(this.invoiceId).subscribe(() => {
          this.router.navigate(['/financials']);
        });
      }
    },
    error: err => console.error('Update failed', err),
  });
}

  trackUser(_: number, contact: InputContact): string { return contact.cognitoId; }
  trackBuilding(_: number, building: string): string { return building; }
  trackItem(_: number, item: FormGroup): any { return item; }
  trackItemOption(_: number, item: { description: string }): string { return item.description; }
} 