import { Component, inject, OnInit, signal } from '@angular/core';
import { FinancialService } from '@ui';

@Component({
  selector: 'app-financial-overview',
  standalone: true,
  imports: [],
  template: `
    <div class="rounded-lg bg-card flex items-center justify-center text-center w-full h-full">
      <div>
        <h3>Financial</h3>
        <p>Balance: {{ balance() }}</p>
      </div>
    </div>
  `,
})
export class FinancialOverviewComponent implements OnInit {
  private financialService = inject(FinancialService);
  balance = signal('');

  async ngOnInit() {
    this.balance.set( '$12,345');
    // this.balance.set(await this.financialService.getBalance() || '$12,345');
  }
}
