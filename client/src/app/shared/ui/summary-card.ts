import { Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { Users } from 'lucide-angular';

export type SummaryTone = 'blue' | 'green' | 'violet' | 'amber' | 'teal' | 'rose';

@Component({
  selector: 'app-summary-card',
  imports: [LucideAngularModule],
  template: `
    <article class="summary-card">
      <div class="summary-card-top">
        <span class="summary-icon" [class]="'summary-icon summary-icon--' + tone()">
          <lucide-angular [img]="icon()" [size]="18" [strokeWidth]="1.9" />
        </span>
        @if (eyebrow()) {
          <span class="summary-eyebrow">{{ eyebrow() }}</span>
        }
      </div>
      <p class="summary-label">{{ label() }}</p>
      <div class="summary-value">{{ value() }}</div>
      <div class="summary-note">{{ note() }}</div>
    </article>
  `,
  styles: `
    .summary-card {
      min-width: 0;
      border: 1px solid #e8ebf0;
      border-radius: 12px;
      background: #fff;
      padding: 18px 19px 17px;
      box-shadow: 0 1px 2px rgb(22 35 58 / 2%);
      transition:
        border-color 150ms ease,
        box-shadow 150ms ease,
        transform 150ms ease;
    }

    .summary-card:hover {
      border-color: #dce2ed;
      box-shadow: 0 5px 16px rgb(22 35 58 / 5%);
      transform: translateY(-1px);
    }

    .summary-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .summary-icon {
      display: grid;
      width: 35px;
      height: 35px;
      place-items: center;
      border-radius: 9px;
    }

    .summary-icon--blue {
      background: #edf2ff;
      color: #4262d3;
    }

    .summary-icon--green {
      background: #eaf8f1;
      color: #24986a;
    }

    .summary-icon--violet {
      background: #f2edff;
      color: #7956c8;
    }

    .summary-icon--amber {
      background: #fff6e8;
      color: #c5821c;
    }

    .summary-icon--teal {
      background: #e8f7f6;
      color: #228f8a;
    }

    .summary-icon--rose {
      background: #fff0ef;
      color: #c96965;
    }

    .summary-eyebrow {
      color: #8490a2;
      font-size: 10px;
    }

    .summary-label {
      margin: 15px 0 5px;
      color: #697488;
      font-size: 12px;
      font-weight: 520;
    }

    .summary-value {
      color: #202b3e;
      font-size: 25px;
      font-weight: 680;
      letter-spacing: -0.045em;
      line-height: 1.2;
    }

    .summary-note {
      margin-top: 7px;
      color: #929baa;
      font-size: 10px;
      line-height: 1.4;
    }
  `,
})
export class SummaryCard {
  readonly icon = input.required<typeof Users>();
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly note = input.required<string>();
  readonly tone = input<SummaryTone>('blue');
  readonly eyebrow = input('');
}
