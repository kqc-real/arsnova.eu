import { Component, HostListener, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

export type MarkdownImageLightboxData = {
  src: string;
  alt: string;
  title: string;
};

@Component({
  selector: 'app-markdown-image-lightbox-dialog',
  standalone: true,
  imports: [MatButton, MatDialogClose, MatIcon],
  templateUrl: './markdown-image-lightbox-dialog.component.html',
  styleUrl: './markdown-image-lightbox-dialog.component.scss',
})
export class MarkdownImageLightboxDialogComponent {
  readonly data = inject<MarkdownImageLightboxData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<MarkdownImageLightboxDialogComponent>);

  caption(): string | null {
    const title = this.data.title.trim();
    if (title) {
      return title;
    }
    const alt = this.data.alt.trim();
    return alt || null;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dialogRef.close();
  }
}
