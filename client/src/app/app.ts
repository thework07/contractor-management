import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [MatToolbarModule, RouterOutlet],
  template: `
    <mat-toolbar>Contractor Management</mat-toolbar>
    <main>
      <router-outlet />
    </main>
  `,
})
export class App {}
