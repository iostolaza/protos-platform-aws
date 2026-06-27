import { Injectable, signal } from '@angular/core';
import { uploadData } from 'aws-amplify/storage';
import { from, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StorageService {
  uploadProgress = signal<number>(0);

  uploadFile(file: File, userId: string): Observable<string> {
    const path = `private/${userId}/${file.name}`;
    return from(
      uploadData({
        path,
        data: file,
        options: {
          onProgress: ({ transferredBytes, totalBytes }) => {
            if (totalBytes) {
              this.uploadProgress.set((transferredBytes / totalBytes) * 100);
            }
          }
        }
      }).result.then(res => res.path)
    );
  }
}
