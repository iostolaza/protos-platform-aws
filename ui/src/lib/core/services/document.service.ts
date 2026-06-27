// src/app/core/services/document.service.ts (Full edited script)

import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import { Schema } from '@amplify-schema';
import { uploadData, getUrl, remove } from 'aws-amplify/storage';  // Removed invalid type StorageGetUrlInput (Gen2 uses inline object)
import { fetchAuthSession } from 'aws-amplify/auth';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface Category {
  value: string;
  label: string;
}

export interface FilterOptions {
  category?: string;
  dateFrom?: string;  // yyyy-mm-dd
  dateTo?: string;    // yyyy-mm-dd
  searchTerm?: string;  // For fileName or description
}

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private readonly client = generateClient<Schema>();
  private readonly categories: ReadonlyArray<Category> = [
    { value: 'Audit', label: 'Audit' },
    { value: 'Budget', label: 'Budget' },
    { value: 'FinancialReports', label: 'Financial Reports' },
    { value: 'Forms', label: 'Forms' },
    { value: 'Insurance', label: 'Insurance' },
    { value: 'Certificates', label: 'Certificates' },
    { value: 'Policies', label: 'Policies' },
    { value: 'Legal', label: 'Legal' },
    { value: 'Minutes', label: 'Minutes' },
    { value: 'ReserveAnalysis', label: 'Reserve Analysis' },
    { value: 'Statement', label: 'Statement' },
    { value: 'ViolationNotice', label: 'Violation Notice' }
  ];

  constructor() {}

  getCategories(): ReadonlyArray<Category> {
    return this.categories;
  }

  async uploadDocument(file: File, category: string, description: string): Promise<Schema['Document']['type']> {
    try {
      const session = await fetchAuthSession();
      if (!session.credentials || !session.identityId) {
        throw new Error('User not authenticated or missing identityId');
      }
      const userId = session.userSub;
      const identityId = session.identityId;

      const docPath = `documents/${crypto.randomUUID()}/${file.name.replace(/\s/g, '%20')}`;
      const fullPath = `protected/${identityId}/${docPath}`;
      const uploadResult = await uploadData({
        data: file,
        path: fullPath,
        options: { contentType: file.type }
      }).result;

      const docId = crypto.randomUUID();
      const { data: doc, errors } = await this.client.models.Document.create({
        docId,
        userCognitoId: userId,
        ownerIdentityId: identityId,
        category: category as any,
        fileName: file.name,
        fileKey: `protected/${docPath}`,
        fileType: file.type,
        description,
        uploadDate: new Date().toISOString().split('T')[0],
        status: 'active',
        version: 1,
        permissions: ['Admin', 'User'],
        size: file.size,
        tags: [],
      });

      if (errors) throw new Error(errors[0].message);
      console.log('Upload success:', doc);  // Debug log
      return doc!;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  listDocuments(options: FilterOptions = {}): Observable<Schema['Document']['type'][]> {
    const documents$ = new Subject<Schema['Document']['type'][]>();
    const destroyer$ = new Subject<void>();

    const filter = this.buildFilter(options);

    const sub = this.client.models.Document.observeQuery({
      filter,
      selectionSet: [
        'docId', 'category', 'subcategory', 'fileName', 'fileKey', 'fileType', 'description',
        'effectiveDate', 'uploadDate', 'expiryDate', 'status', 'version', 'permissions',
        'tags', 'size', 'createdAt', 'updatedAt', 'tenantId', 'ownerIdentityId'  // Added
      ]
    }).pipe(
      takeUntil(destroyer$)
    ).subscribe({
      next: ({ items }) => {
        // Client-side sort by uploadDate desc
        const sorted = items.sort((a, b) =>
          new Date(b.uploadDate ?? '').getTime() - new Date(a.uploadDate ?? '').getTime()
        );
        documents$.next(sorted);
      },
      error: (err) => documents$.error(err),
      complete: () => documents$.complete()
    });

    // Cleanup
    documents$.subscribe({ complete: () => sub.unsubscribe() });

    return documents$.asObservable();
  }

  private buildFilter(options: FilterOptions): any {
    const filters: any[] = [];

    if (options.category) {
      filters.push({ category: { eq: options.category } });
    }
    if (options.dateFrom) {
      filters.push({ uploadDate: { ge: options.dateFrom } });
    }
    if (options.dateTo) {
      filters.push({ uploadDate: { le: options.dateTo } });
    }
    if (options.searchTerm) {
      filters.push({
        or: [
          { fileName: { contains: options.searchTerm } },
          { description: { contains: options.searchTerm } }
        ]
      });
    }

    return filters.length > 0 ? { and: filters } : undefined;
  }

  async getDocument(docId: string): Promise<Schema['Document']['type'] | null> {
    try {
      const { data: doc, errors } = await this.client.models.Document.get({ docId });
      if (errors) throw new Error(errors[0].message);
      return doc;
    } catch (error) {
      console.error('Get document failed:', error);
      throw error;
    }
  }

  async getDocumentUrl(fileKey: string, ownerIdentityId?: string | null): Promise<string> {
    try {
      let path = fileKey;
      if (ownerIdentityId) {
        path = path.replace('protected/', `protected/${ownerIdentityId}/`);
      }
      const { url } = await getUrl({
        path,
        options: { expiresIn: 3600 }  // 1 hour signed URL
      });
      return url.toString();
    } catch (error) {
      console.error('Get URL failed:', error);
      throw error;
    }
  }

  async updateDocument(docId: string, updates: Partial<Schema['Document']['type']>, newFile?: File): Promise<Schema['Document']['type']> {
    try {
      let fileKey = updates.fileKey;
      if (newFile) {
        // Upload new file, delete old if exists
        const oldDoc = await this.getDocument(docId);
        if (oldDoc?.fileKey) {
          await this.deleteFile(oldDoc.fileKey, oldDoc.ownerIdentityId);
        }
        const session = await fetchAuthSession();
        const identityId = session.identityId;
        const docPath = `documents/${crypto.randomUUID()}/${newFile.name.replace(/\s/g, '%20')}`;
        const fullPath = `protected/${identityId}/${docPath}`;
        const uploadResult = await uploadData({
          data: newFile,
          path: fullPath,
          options: {
            contentType: newFile.type
          }
        }).result;
        fileKey = `protected/${docPath}`;
        updates = {
          ...updates,
          ownerIdentityId: identityId,  // Update if new file
          fileName: newFile.name,
          fileType: newFile.type,
          size: newFile.size,
          uploadDate: new Date().toISOString().split('T')[0]
        };
      }

      const { data: doc, errors } = await this.client.models.Document.update({
        docId,
        ...updates,
        fileKey,  // Updated if new file
        updatedAt: new Date().toISOString()
      });

      if (errors) throw new Error(errors[0].message);
      return doc!;
    } catch (error) {
      console.error('Update failed:', error);
      throw error;
    }
  }

  async deleteDocument(docId: string, fileKey: string, ownerIdentityId?: string | null): Promise<void> {
    try {
      const { errors } = await this.client.models.Document.delete({ docId });
      if (errors) throw new Error(errors[0].message);
      await this.deleteFile(fileKey, ownerIdentityId);
    } catch (error) {
      console.error('Delete failed:', error);
      throw error;
    }
  }

  private async deleteFile(fileKey: string, ownerIdentityId?: string | null): Promise<void> {
    let path = fileKey;
    if (ownerIdentityId) {
      path = path.replace('protected/', `protected/${ownerIdentityId}/`);
    }
    await remove({ path });
  }
}