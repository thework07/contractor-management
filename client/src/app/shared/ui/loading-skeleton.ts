import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-loading-skeleton',
  template: `
    <div class="skeleton-list" aria-label="Loading content" aria-busy="true">
      @for (row of rows(); track row) {
        <div class="skeleton-row">
          <span class="skeleton-block skeleton-avatar"></span>
          <span class="skeleton-copy">
            <span class="skeleton-block skeleton-title"></span>
            <span class="skeleton-block skeleton-subtitle"></span>
          </span>
          <span class="skeleton-block skeleton-meta"></span>
        </div>
      }
    </div>
  `,
  styles: `
    .skeleton-list {
      overflow: hidden;
      border: 1px solid #e8ebf0;
      border-radius: 12px;
      background: #fff;
      padding: 4px 18px;
    }

    .skeleton-row {
      display: flex;
      min-height: 68px;
      align-items: center;
      gap: 13px;
      border-bottom: 1px solid #f0f2f5;
    }

    .skeleton-row:last-child {
      border-bottom: 0;
    }

    .skeleton-copy {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 8px;
    }

    .skeleton-block {
      display: block;
      border-radius: 5px;
      background: linear-gradient(90deg, #f1f3f6 25%, #f8f9fb 50%, #f1f3f6 75%);
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.4s ease-in-out infinite;
    }

    .skeleton-avatar {
      width: 34px;
      height: 34px;
      border-radius: 9px;
    }

    .skeleton-title {
      width: min(45%, 220px);
      height: 10px;
    }

    .skeleton-subtitle {
      width: min(30%, 150px);
      height: 8px;
    }

    .skeleton-meta {
      width: 58px;
      height: 9px;
    }

    @keyframes skeleton-shimmer {
      to {
        background-position: -200% 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton-block {
        animation: none;
      }
    }
  `,
})
export class LoadingSkeleton {
  readonly count = input(4);
  protected readonly rows = computed(() => Array.from({ length: this.count() }, (_, index) => index));
}
