import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
} from '@angular/core';
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
export class MarkdownImageLightboxDirective implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly dialog = inject(MatDialog);
  private readonly managedImages = new WeakSet<HTMLImageElement>();
  private observer: MutationObserver | null = null;

  ngAfterViewInit(): void {
    this.syncMarkdownImages();
    if (typeof MutationObserver === 'undefined') {
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLImageElement) {
          this.syncImageState(mutation.target);
          continue;
        }
        if (mutation.addedNodes.length > 0) {
          this.syncMarkdownImages();
          return;
        }
      }
    });

    this.observer.observe(this.elementRef.nativeElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

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
      enterAnimationDuration: 180,
      exitAnimationDuration: 140,
      width: '100vw',
      maxWidth: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      panelClass: 'markdown-image-lightbox-dialog-panel',
      backdropClass: 'markdown-image-lightbox-dialog-backdrop',
    });
  }

  private syncMarkdownImages(): void {
    const images = this.elementRef.nativeElement.querySelectorAll(
      'img[data-markdown-image-lightbox="true"]',
    ) as NodeListOf<HTMLImageElement>;
    for (const image of Array.from(images)) {
      this.syncImageState(image);
    }
  }

  private syncImageState(image: HTMLImageElement): void {
    if (!this.managedImages.has(image)) {
      image.addEventListener('load', this.onImageLoad);
      image.addEventListener('error', this.onImageError);
      this.managedImages.add(image);
    }

    if (image.complete) {
      image.dataset.markdownImageState = image.naturalWidth > 0 ? 'ready' : 'error';
      return;
    }

    image.dataset.markdownImageState = 'loading';
  }

  private readonly onImageLoad = (event: Event): void => {
    if (!(event.target instanceof HTMLImageElement)) {
      return;
    }
    event.target.dataset.markdownImageState = 'ready';
  };

  private readonly onImageError = (event: Event): void => {
    if (!(event.target instanceof HTMLImageElement)) {
      return;
    }
    event.target.dataset.markdownImageState = 'error';
  };
}
