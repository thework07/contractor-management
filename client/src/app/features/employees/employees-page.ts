import { Component } from '@angular/core';
import { Users } from 'lucide-angular';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';
import { EmptyState } from '../../shared/ui/empty-state';
import { PageHeader } from '../../shared/ui/page-header';

@Component({
  selector: 'app-employees-page',
  imports: [Breadcrumbs, EmptyState, PageHeader],
  template: `
    <app-breadcrumbs [items]="breadcrumbs" />
    <app-page-header
      title="Employees"
      description="Your workforce directory, roles and employee records."
    />
    <app-empty-state
      [icon]="icons.Users"
      title="Your employee directory starts here"
      description="Employee management will be available in a later step. This workspace is ready for your team."
    />
  `,
})
export class EmployeesPage {
  protected readonly breadcrumbs = [{ label: 'Dashboard', route: '/' }, { label: 'Employees' }];
  protected readonly icons = { Users };
}
