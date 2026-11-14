import { Component } from '@angular/core';
import { CalendarCheck } from 'lucide-angular';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';
import { EmptyState } from '../../shared/ui/empty-state';
import { PageHeader } from '../../shared/ui/page-header';

@Component({
  selector: 'app-attendance-page',
  imports: [Breadcrumbs, EmptyState, PageHeader],
  template: `
    <app-breadcrumbs [items]="breadcrumbs" />
    <app-page-header
      title="Attendance & Salary"
      description="Review attendance submissions and prepare payroll with confidence."
    />
    <app-empty-state
      [icon]="icons.CalendarCheck"
      title="Attendance activity will appear here"
      description="Attendance uploads, verification and salary workflows are planned for a later step."
    />
  `,
})
export class AttendancePage {
  protected readonly breadcrumbs = [
    { label: 'Dashboard', route: '/' },
    { label: 'Attendance & Salary' },
  ];
  protected readonly icons = { CalendarCheck };
}
