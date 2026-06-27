
// src/app/core/pipes/status-class.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';
import { TicketStatus } from '../models/tickets.model';  // Import enum

@Pipe({
  name: 'statusClass',
  standalone: true,
})
export class StatusClassPipe implements PipeTransform {
  transform(value: TicketStatus | string): string {
    switch ((value as string).toUpperCase()) {
      case TicketStatus.OPEN:
        return 'bg-red-700 text-white';
      case TicketStatus.QUEUED:  
        return 'bg-red-500 text-white';
      case TicketStatus.IN_PROGRESS:
      case TicketStatus.REOPENED:
        return 'bg-orange-500 text-white';
      case TicketStatus.COMPLETE:
      case TicketStatus.CLOSED:
        return 'bg-green-700 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  }
}