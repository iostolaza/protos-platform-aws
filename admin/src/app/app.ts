import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppService, ThemeService } from '@ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private appService = inject(AppService);
  private themeService = inject(ThemeService);

  ngOnInit() {
    this.appService.appTitle.set('Protos Admin');
  }
}
