import { Component, OnInit, signal } from '@angular/core';
// Assuming no specific service, hardcoding or add logic as needed

@Component({
  selector: 'app-activity-overview',
  standalone: true,
  imports: [],
  template: `
    <div class="rounded-lg bg-card flex items-center justify-center text-center w-full h-full">
      <div>
        <h3>Activity Overview</h3>
        <p>Recent: {{ recent() }}</p>
      </div>
    </div>
  `,
})
export class ActivityOverviewComponent implements OnInit {
  recent = signal(0);

  ngOnInit() {
    this.recent.set(20);
  }
}
