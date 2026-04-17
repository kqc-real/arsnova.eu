import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export interface MarkdownLinkDialogResult {
  text: string;
  url: string;
}

@Component({
  selector: 'app-markdown-link-dialog',
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
  templateUrl: './markdown-link-dialog.component.html',
  styleUrls: ['../styles/dialog-title-header.scss'],
})
export class MarkdownLinkDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<MarkdownLinkDialogComponent, MarkdownLinkDialogResult>,
  );
  readonly data = inject<{ text: string }>(MAT_DIALOG_DATA);

  readonly form = new FormGroup({
    text: new FormControl(this.data.text ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
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
      text: this.form.controls.text.value.trim(),
      url: this.form.controls.url.value.trim(),
    });
  }
}
