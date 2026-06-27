import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppService {
  appTitle = signal<string>('Protos'); // Default
}
