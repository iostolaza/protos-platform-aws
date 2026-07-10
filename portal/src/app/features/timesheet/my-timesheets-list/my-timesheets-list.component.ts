import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { TimesheetService } from '@ui';
import { Timesheet } from '@ui';
import { format, parseISO } from 'date-fns';
import { Router } from '@angular/router';

@Component({
  selector: 'app-my-timesheets-list',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule],
  templateUrl: './my-timesheets-list.component.html',
})
export class MyTimesheetsListComponent implements OnInit {
  displayedColumns: string[] = ['period', 'totalHours', 'status', 'totalCost'];
  dataSource: (Timesheet & { period: string })[] = [];

  private tsService = inject(TimesheetService);
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.loadMyTimesheets();
  }

  goBack(): void {
    this.router.navigate(['/main-layout/timesheet']);
  }

  goToCalendar(): void {
    this.router.navigate(['/main-layout/timesheet/calendar']);
  }

  private async loadMyTimesheets(): Promise<void> {
    const timesheets = await this.tsService.listTimesheets(['draft', 'submitted', 'approved', 'rejected']);
    this.dataSource = timesheets
      .map((ts) => ({
        ...ts,
        period:
          ts.startDate && ts.endDate
            ? `${format(parseISO(ts.startDate), 'MMM d')} – ${format(parseISO(ts.endDate), 'd, yyyy')}`
            : 'N/A',
      }))
      .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  }
}
