import { Component, input } from '@angular/core';
import { StatusBadge } from './status-badge';

export interface DataTableColumn {
  key: string;
  label: string;
  type?: 'text' | 'status';
  align?: 'left' | 'right';
}

export type DataTableRow = Record<string, string>;

@Component({
  selector: 'app-data-table',
  imports: [StatusBadge],
  template: `
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            @for (column of columns(); track column.key) {
              <th [class.text-right]="column.align === 'right'">{{ column.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track $index) {
            <tr>
              @for (column of columns(); track column.key) {
                <td [class.text-right]="column.align === 'right'">
                  @if (column.type === 'status') {
                    <app-status-badge [status]="row[column.key]" />
                  } @else {
                    {{ row[column.key] }}
                  }
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td class="empty-cell" [attr.colspan]="columns().length">No activity to show yet.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .table-scroll {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      height: 41px;
      border-bottom: 1px solid #edf0f4;
      background: #fbfcfd;
      padding: 0 16px;
      color: #8a94a4;
      font-size: 10px;
      font-weight: 650;
      letter-spacing: 0.035em;
      white-space: nowrap;
    }

    td {
      height: 54px;
      border-bottom: 1px solid #f0f2f5;
      padding: 0 16px;
      color: #576378;
      font-size: 11px;
      white-space: nowrap;
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    tbody tr:hover {
      background: #fbfcfe;
    }

    .empty-cell {
      height: 80px;
      color: #8a94a4;
      text-align: center;
    }
  `,
})
export class DataTable {
  readonly columns = input.required<readonly DataTableColumn[]>();
  readonly rows = input.required<readonly DataTableRow[]>();
}
