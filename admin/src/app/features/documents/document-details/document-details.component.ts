// src/app/features/documents/document-details/document-details.component.ts

import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DocumentService } from '@ui';
import { signal } from '@angular/core';

@Component({
  selector: 'app-document-details',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './document-details.component.html',
})
export class DocumentDetailsComponent implements OnInit {
  @Input() document!: any;
  @Output() close = new EventEmitter<void>();
  documentUrl = signal<string>('');

  constructor(private documentService: DocumentService) {}

  ngOnInit(): void {
    this.documentService.getDocumentUrl(this.document.fileKey)
      .then((url: string) => this.documentUrl.set(url))
      .catch((error: unknown) => {
        console.error('Failed to get document URL:', error);
        this.documentUrl.set('');  // Fallback
      });
  }
}