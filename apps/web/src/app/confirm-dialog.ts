import { ChangeDetectionStrategy, Component } from '@angular/core';

export type ConfirmDialogData = {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
};

@Component({
  selector: 'app-confirm-dialog',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {}
