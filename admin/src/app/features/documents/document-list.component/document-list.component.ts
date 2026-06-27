// src/app/features/documents/document-list/document-list.component.ts (Full edited script)

import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { getIconPath } from '@ui';
import { DocumentService, Category } from '@ui';
import { signal, computed } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-document-list',
  standalone: true,
  imports: [CommonModule, FormsModule, AngularSvgIconModule],
  templateUrl: './document-list.component.html',
})
export class DocumentListComponent {
  @Output() filterCategory = new EventEmitter<string>();
  documents = signal<any[]>([]);
  categories = signal<Category[]>([]);
  searchTerm = signal<string>('');
  selectedCategory = signal<string>('');
  showModal = signal<boolean>(false);
  selectedDocUrl = signal<string>('');
  selectedDoc = signal<any | null>(null);
  safeUrl = computed<SafeResourceUrl>(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.selectedDocUrl()));

  getIconPath = getIconPath;

  filteredDocuments = computed(() =>
    this.documents().filter(d =>
      (!this.selectedCategory() || d.category === this.selectedCategory()) &&
      (d.fileName.toLowerCase().includes(this.searchTerm().toLowerCase()) || d.description?.toLowerCase().includes(this.searchTerm().toLowerCase()))
    )
  );

  constructor(private documentService: DocumentService, private sanitizer: DomSanitizer) {
    this.categories.set([...this.documentService.getCategories()]);
    this.documentService.listDocuments().subscribe(docs => this.documents.set(docs));
  }

  onFilterChange() {
    this.filterCategory.emit(this.selectedCategory());
  }

  async onView(doc: any) {
    try {
      const url = await this.documentService.getDocumentUrl(doc.fileKey, doc.ownerIdentityId);
      this.selectedDocUrl.set(url);
      this.selectedDoc.set(doc);
      this.showModal.set(true);
    } catch (error) {
      console.error('Failed to load document URL:', error);
    }
  }

  onDelete(id: string, fileKey: string, ownerIdentityId?: string | null) {
    this.documentService.deleteDocument(id, fileKey, ownerIdentityId)
      .then(() => {
        this.documents.update(docs => docs.filter(d => d.id !== id));
      })
      .catch((error: unknown) => {
        console.error('Delete failed:', error);
      });
  }
}