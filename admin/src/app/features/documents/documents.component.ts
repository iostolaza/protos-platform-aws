// src/app/features/documents/documents.component.ts

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DocumentListComponent } from './document-list.component/document-list.component';
import { GenerateDocumentsComponent } from './generate-documents/generate-documents';
import { DocumentDetailsComponent } from './document-details/document-details.component';
import { DocumentService } from '@ui';
import { signal, computed } from '@angular/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule,
    DocumentListComponent,
    GenerateDocumentsComponent,
    DocumentDetailsComponent,
    DatePipe
  ],
  templateUrl: './documents.component.html',
})
export class DocumentsComponent implements OnInit, OnDestroy {
  documents = signal<any[]>([]);
  selectedDocument = signal<any | null>(null);
  categoryFilter = signal<string | null>(null);
  private subs: Subscription[] = [];

  recentDocuments = computed(() => 
    this.documents()
      .filter(d => !this.categoryFilter() || d.category === this.categoryFilter())
      .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
      .slice(0, 3)
  );

  categoryCounts = computed(() => {
    const counts: { [key: string]: number } = {};
    this.documents().forEach(d => counts[d.category] = (counts[d.category] || 0) + 1);
    return counts;
  });

  private documentService = inject(DocumentService);

  ngOnInit(): void {
    this.subs.push(
      this.documentService.listDocuments().subscribe(docs => this.documents.set(docs))  
    );
    this.loadDocuments();
  }

  private loadDocuments(): void {
    this.documentService.listDocuments().subscribe(docs => this.documents.set(docs));  
  }

  viewDetails(doc: any) {
    this.selectedDocument.set(doc);
  }

  applyFilter(category: string) {  
    this.categoryFilter.set(category);
  }

  ngOnDestroy() {
    this.subs.forEach(sub => sub.unsubscribe());
  }
}