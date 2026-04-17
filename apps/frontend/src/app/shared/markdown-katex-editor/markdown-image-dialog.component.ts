import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

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
  styleUrls: ['../styles/dialog-title-header.scss'],
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
