
// file: src/app/timesheet/calendar-view/charge-code-search-dialog.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, startWith, map } from 'rxjs';

export interface ChargeCode {
  name: string;
  createdBy: string;
  date: string;
}

@Component({
  selector: 'app-charge-code-search-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatAutocompleteModule, MatInputModule, ReactiveFormsModule],
  templateUrl: './charge-code-search.component.html',
})
export class ChargeCodeSearchDialogComponent implements OnInit {
  searchControl = new FormControl('');
  filteredCodes: Observable<ChargeCode[]>;
  selectedCode: ChargeCode | '' = '';

  dialogRef = inject(MatDialogRef<ChargeCodeSearchDialogComponent>);
  data = inject<{ chargeCodes: ChargeCode[] }>(MAT_DIALOG_DATA);

  constructor() {
    this.filteredCodes = this.searchControl.valueChanges.pipe(
      startWith(''),
      map(value => this.filterCodes(value || ''))
    );
  }

  ngOnInit() {
    this.searchControl.setValue('');
  }

  private filterCodes(value: string): ChargeCode[] {
    const filterValue = (typeof value === 'string' ? value.toLowerCase() : '');
    return this.data.chargeCodes.filter(code => code.name.toLowerCase().includes(filterValue));
  }

  displayFn(code: ChargeCode | ''): string {
    return code ? code.name : '';
  }

  onSelect(code: ChargeCode | '') {
    this.selectedCode = code;
  }

  onConfirm() {
    if (this.selectedCode) {
      this.dialogRef.close(this.selectedCode);
    }
  }

  onCancel() {
    this.dialogRef.close();
  }
}
