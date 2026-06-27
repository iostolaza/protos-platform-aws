import { Component, inject, OnInit, signal } from '@angular/core';
import { DocumentService } from '@ui';

@Component({
  selector: 'app-documents-overview',
  standalone: true,
  imports: [],
  template: `
    <div class="rounded-lg bg-card flex items-center justify-center text-center w-full h-full">
      <div>
        <h3>Documents</h3>
        <p>Recent: {{ recent() }}</p>
      </div>
    </div>
  `,
})
export class DocumentsOverviewComponent implements OnInit {
  private documentService = inject(DocumentService);
  recent = signal(0);

  async ngOnInit() {
    this.recent.set(150);
    // this.recent.set(await this.documentService.getRecentDocumentsCount() || 150);
  }
}
