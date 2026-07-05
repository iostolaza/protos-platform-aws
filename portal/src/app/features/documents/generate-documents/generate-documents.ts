// src/app/features/documents/generate-documents/generate-documents.ts (Full edited script)

import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DocumentService } from '@ui';
import { signal } from '@angular/core';

@Component({
  selector: 'app-generate-documents',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './generate-documents.html',
})
export class GenerateDocumentsComponent {
  form: FormGroup;
  file: File | null = null;
  errorMessage = signal<string>('');
  successMessage = signal<string>('');
  categories: ReadonlyArray<{ value: string; label: string }> = [];  // Init empty; set in constructor

  private fb = inject(FormBuilder);
  private documentService = inject(DocumentService);

  constructor() {
    this.categories = this.documentService.getCategories();  // Set after injection

    this.form = this.fb.group({
      category: ['', Validators.required],
      description: [''],
    });
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.file = input.files[0];
  }

  submit() {
    if (!this.file || this.form.invalid) return;
    const category = this.form.value.category;
    const description = this.form.value.description || '';
    this.documentService.uploadDocument(this.file, category, description)
      .then(() => {
        this.successMessage.set('Document uploaded successfully!');
        this.errorMessage.set('');
        this.form.reset();
        this.file = null;
      })
      .catch((err: unknown) => {
        this.errorMessage.set(err instanceof Error ? err.message : 'Unknown error');
        this.successMessage.set('');
      });
  }
}