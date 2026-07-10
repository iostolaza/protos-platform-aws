// file: src/app/timesheet/review-list/review-list.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TimesheetService } from '@ui';
import { AuthService } from '@ui';
import { ReviewComponent } from '../review-form/review-form.component';
import { Timesheet } from '@ui';
import { format, parseISO } from 'date-fns';
import { Router } from '@angular/router';

@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule, MatDialogModule, MatSnackBarModule],
  templateUrl: './review-list.component.html',
})
export class ReviewListComponent implements OnInit {
  displayedColumns: string[] = ['id', 'userName', 'period', 'totalHours', 'status', 'ledger', 'actions'];
  dataSource: (Timesheet & { userName: string; period: string })[] = [];
  retryingId: string | null = null;

  private tsService = inject(TimesheetService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.loadTimesheets();
  }

  openReview(id: string): void {
    const dialogRef = this.dialog.open(ReviewComponent, {
      data: { id },
      width: '1000px',
      height: '1000px',
      maxWidth: '100vw',
      maxHeight: '90vw',
    });

    dialogRef.afterClosed().subscribe(async (result: any) => {
      if (result) {
        if (result.approved) {
          await this.tsService.approveTimesheet(id);
        } else {
          await this.tsService.rejectTimesheet(id, result.rejectionReason || '');
        }
        await this.loadTimesheets();
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/main-layout/timesheet']);
  }

  async retryLedgerPosting(id: string): Promise<void> {
    this.retryingId = id;
    try {
      const result = await this.tsService.retryTimesheetLedgerPosting(id);
      if (result.posted) {
        this.snackBar.open('Ledger posting succeeded.', 'OK', { duration: 4000 });
      } else {
        this.snackBar.open(result.errors.join('; ') || 'Ledger posting still failed.', 'Dismiss', { duration: 6000 });
      }
      await this.loadTimesheets();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ledger retry failed';
      this.snackBar.open(message, 'Dismiss', { duration: 6000 });
    } finally {
      this.retryingId = null;
    }
  }

  private async loadTimesheets(): Promise<void> {
    const timesheets = await this.tsService.listTimesheets(['submitted', 'approved']);

    const enriched = await Promise.all(
      timesheets.map(async (ts) => {
        const user = await this.authService.getUserById(ts.userId);
        const period = ts.startDate && ts.endDate
          ? `${format(parseISO(ts.startDate), 'MMM d')} – ${format(parseISO(ts.endDate), 'd, yyyy')}`
          : 'N/A';

        return {
          ...ts,
          userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Unknown',
          period,
        };
      })
    );

    this.dataSource = enriched;
  }
}