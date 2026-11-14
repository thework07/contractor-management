import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'employees',
    loadComponent: () =>
      import('./features/employees/employees-page').then((m) => m.EmployeesPage),
  },
  {
    path: 'attendance-salary',
    loadComponent: () =>
      import('./features/attendance/attendance-page').then((m) => m.AttendancePage),
  },
  {
    path: 'system-status',
    loadComponent: () =>
      import('./features/system-status/system-status').then((m) => m.SystemStatus),
  },
  { path: '**', redirectTo: '' },
];
