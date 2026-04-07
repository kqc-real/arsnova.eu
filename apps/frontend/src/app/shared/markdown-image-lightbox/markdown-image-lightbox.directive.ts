import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  MarkdownImageLightboxData,
  MarkdownImageLightboxDialogComponent,
} from './markdown-image-lightbox-dialog.component';

@Directive({
  selector: '[appMarkdownImageLightbox]',
  standalone: true,
  host: {
    class: 'markdown-lightbox-enabled',
  },
})
export class MarkdownImageLightboxDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly dialog = inject(MatDialog);

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    if (!(event.target instanceof Element)) {
      return;
    }

    const image = event.target.closest('img[data-markdown-image-lightbox="true"]');
    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(image)) {
      return;
    }

    const src = image.currentSrc || image.src || image.getAttribute('src');
    if (!src) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const data: MarkdownImageLightboxData = {
      src,
      alt: image.alt ?? '',
      title: image.title ?? '',
    };

    this.dialog.open(MarkdownImageLightboxDialogComponent, {
      data,
      autoFocus: false,
      restoreFocus: true,
      disableClose: true,
      width: '100vw',
      maxWidth: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      panelClass: 'markdown-image-lightbox-dialog-panel',
      backdropClass: 'markdown-image-lightbox-dialog-backdrop',
    });
  }
}
