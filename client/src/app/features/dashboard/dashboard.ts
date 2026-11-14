import { Component } from '@angular/core';
import {
  CalendarCheck,
  CircleCheck,
  Clock3,
  FileCheck2,
  IndianRupee,
  LucideAngularModule,
  Upload,
  Users,
  UserRoundCheck,
} from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';
import { DataTable, type DataTableColumn } from '../../shared/ui/data-table';
import { EmptyState } from '../../shared/ui/empty-state';
import { PageHeader } from '../../shared/ui/page-header';
import { SummaryCard, type SummaryTone } from '../../shared/ui/summary-card';
import type { DashboardMockData } from '../../../environments/environment.model';

type DashboardStatId = NonNullable<DashboardMockData['stats']>[number]['id'];

@Component({
  selector: 'app-dashboard',
  imports: [LucideAngularModule, Breadcrumbs, DataTable, EmptyState, PageHeader, SummaryCard],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  protected readonly data = environment.dashboardMockData;
  protected readonly breadcrumbs = [{ label: 'Dashboard' }];
  protected readonly icons = {
    CalendarCheck,
    CircleCheck,
    Clock3,
    FileCheck2,
    IndianRupee,
    Upload,
    Users,
    UserRoundCheck,
  };
  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'action', label: 'ACTIVITY' },
    { key: 'details', label: 'DETAILS' },
    { key: 'time', label: 'TIME' },
    { key: 'status', label: 'STATUS', type: 'status' },
  ];
  private readonly statIcons: Record<DashboardStatId, typeof Users> = {
    employees: Users,
    active: UserRoundCheck,
    uploads: Upload,
    pending: Clock3,
    approved: FileCheck2,
    salary: IndianRupee,
  };
  private readonly statTones: Record<DashboardStatId, SummaryTone> = {
    employees: 'blue',
    active: 'green',
    uploads: 'violet',
    pending: 'amber',
    approved: 'teal',
    salary: 'rose',
  };

  protected iconFor(id: DashboardStatId): typeof Users {
    return this.statIcons[id];
  }

  protected toneFor(id: DashboardStatId): SummaryTone {
    return this.statTones[id];
  }
}
