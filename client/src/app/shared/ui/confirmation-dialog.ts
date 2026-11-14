import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

@Component({
  selector: 'app-confirmation-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">{{ data.title }}</h2>
    <mat-dialog-content class="dialog-message">{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button type="button" (click)="dialogRef.close(false)">
        {{ data.cancelLabel ?? 'Cancel' }}
      </button>
      <button
        mat-flat-button
        type="button"
        [class.dialog-destructive]="data.destructive"
        (click)="dialogRef.close(true)"
      >
        {{ data.confirmLabel ?? 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-title {
      margin: 0;
      padding: 24px 24px 10px;
      color: #202b3e;
      font-size: 17px;
      font-weight: 650;
      letter-spacing: -0.02em;
    }

    .dialog-message {
      padding: 0 24px 18px;
      color: #758094;
      font-size: 13px;
      line-height: 1.6;
    }

    .dialog-actions {
      gap: 8px;
      padding: 8px 20px 20px;
    }

    .dialog-destructive {
      background: #c84f4f !important;
      color: #fff !important;
    }
  `,
})
export class ConfirmationDialog {
  protected readonly data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<ConfirmationDialog, boolean>);
}
