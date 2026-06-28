import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-timesheet',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './timesheet.component.html',
  styleUrl: './timesheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Timesheet {}
