import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { UpdateBannerSuppressionService } from '../../core/update-banner-suppression.service';

export interface MarkdownImageDialogResult {
  alt: string;
  url: string;
}

@Component({
  selector: 'app-markdown-image-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './markdown-image-dialog.component.html',
  styleUrls: ['../styles/dialog-title-header.scss', './markdown-image-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class MarkdownImageDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<MarkdownImageDialogComponent, MarkdownImageDialogResult>,
  );

  // Placeholder for future defaults (e.g. from selection); kept typed for MatDialog.
  readonly _data = inject<undefined>(MAT_DIALOG_DATA, { optional: true });

  readonly form = new FormGroup({
    alt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^https:\/\/\S+$/i)],
    }),
  });

  private readonly updateBannerSuppression = inject(UpdateBannerSuppressionService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const sync = (): void => {
      const alt = this.form.controls.alt.value.trim();
      const url = this.form.controls.url.value.trim();
      this.updateBannerSuppression.set('markdown-image-draft', alt.length > 0 || url.length > 0);
    };
    sync();
    const subscription = this.form.events.subscribe(sync);
    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      this.updateBannerSuppression.set('markdown-image-draft', false);
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  insert(): void {
    if (this.form.invalid) return;
    this.dialogRef.close({
      alt: this.form.controls.alt.value.trim(),
      url: this.form.controls.url.value.trim(),
    });
  }
}
