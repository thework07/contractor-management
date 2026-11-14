import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  template: `
    <span class="status-badge" [class]="badgeClass()">
      <span class="status-dot"></span>
      {{ status() }}
    </span>
  `,
  styles: `
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid transparent;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 620;
      line-height: 1.2;
      white-space: nowrap;
    }

    .status-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
    }

    .status-success {
      border-color: #d5efdf;
      background: #f0faf4;
      color: #258351;
    }

    .status-warning {
      border-color: #f4e3bf;
      background: #fff9ed;
      color: #a8731f;
    }

    .status-danger {
      border-color: #f3d9d7;
      background: #fff4f3;
      color: #ba5751;
    }

    .status-neutral {
      border-color: #e7eaf0;
      background: #f7f8fa;
      color: #738094;
    }
  `,
})
export class StatusBadge {
  readonly status = input.required<string>();
  protected readonly badgeClass = computed(() => {
    const status = this.status().toLowerCase();
    if (['approved', 'active', 'completed', 'success'].includes(status)) return 'status-success';
    if (['review', 'pending', 'in progress'].includes(status)) return 'status-warning';
    if (['rejected', 'failed', 'inactive'].includes(status)) return 'status-danger';
    return 'status-neutral';
  });
}
