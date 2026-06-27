
// src/app/core/pipes/status.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';
import { TicketStatus } from '../models/tickets.model';  

@Pipe({
  name: 'status',
  standalone: true,
})
export class StatusPipe implements PipeTransform {
  transform(value: TicketStatus | string): string {
    const map: { [key in TicketStatus]: string } = {  
      [TicketStatus.OPEN]: 'Open',
      [TicketStatus.QUEUED]: 'Queued',  // Added
      [TicketStatus.IN_PROGRESS]: 'In Progress',
      [TicketStatus.COMPLETE]: 'Complete',
      [TicketStatus.CLOSED]: 'Closed',
      [TicketStatus.REOPENED]: 'Reopened',
    };
    return map[value as TicketStatus] || value;  
  }
}