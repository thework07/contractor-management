import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight, LucideAngularModule } from 'lucide-angular';

export interface BreadcrumbItem {
  label: string;
  route?: string;
}

@Component({
  selector: 'app-breadcrumbs',
  imports: [LucideAngularModule, RouterLink],
  template: `
    <nav class="mb-5 flex items-center gap-2 text-xs text-slate-400" aria-label="Breadcrumb">
      @for (item of items(); track $index; let last = $last) {
        @if (last || !item.route) {
          <span [class]="last ? 'font-medium text-slate-600' : ''">{{ item.label }}</span>
        } @else {
          <a class="transition-colors hover:text-slate-700" [routerLink]="item.route">
            {{ item.label }}
          </a>
        }
        @if (!last) {
          <lucide-angular [img]="icons.ChevronRight" [size]="13" />
        }
      }
    </nav>
  `,
})
export class Breadcrumbs {
  readonly items = input.required<readonly BreadcrumbItem[]>();
  protected readonly icons = { ChevronRight };
}
