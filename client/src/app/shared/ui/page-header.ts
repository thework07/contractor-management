import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `
    <div class="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-[26px] font-semibold tracking-[-0.045em] text-slate-900">
          {{ title() }}
        </h1>
        @if (description()) {
          <p class="mb-0 mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            {{ description() }}
          </p>
        }
      </div>
      <div class="flex items-center gap-2">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly description = input('');
}
