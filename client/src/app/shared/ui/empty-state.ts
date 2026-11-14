import { Component, input } from '@angular/core';
import { LucideAngularModule, Users } from 'lucide-angular';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-empty-state',
  imports: [LucideAngularModule, MatButtonModule],
  template: `
    <div class="empty-state">
      <span class="empty-icon">
        <lucide-angular [img]="icon()" [size]="21" [strokeWidth]="1.8" />
      </span>
      <h2>{{ title() }}</h2>
      <p>{{ description() }}</p>
      @if (actionLabel()) {
        <button mat-stroked-button type="button" disabled>
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      min-height: 285px;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 1px dashed #dfe4ec;
      border-radius: 12px;
      background: #fff;
      padding: 28px;
      text-align: center;
    }

    .empty-icon {
      display: grid;
      width: 48px;
      height: 48px;
      place-items: center;
      border: 1px solid #e9edf4;
      border-radius: 14px;
      background: #f7f8fb;
      color: #78869c;
    }

    h2 {
      margin: 15px 0 6px;
      color: #303b4f;
      font-size: 14px;
      font-weight: 650;
    }

    p {
      max-width: 365px;
      margin: 0 0 17px;
      color: #8a94a4;
      font-size: 12px;
      line-height: 1.65;
    }
  `,
})
export class EmptyState {
  readonly icon = input<typeof Users>(Users);
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly actionLabel = input('');
}
