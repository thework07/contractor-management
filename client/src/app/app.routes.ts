import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/system-status/system-status').then((m) => m.SystemStatus),
  },
  { path: '**', redirectTo: '' },
];
