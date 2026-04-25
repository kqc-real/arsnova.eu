import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
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
  private readonly snackBar = inject(MatSnackBar);
  private readonly managedImages = new WeakSet<HTMLImageElement>();
  private readonly copyResetTimers = new Map<HTMLButtonElement, number>();
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
    for (const timerId of this.copyResetTimers.values()) {
      clearTimeout(timerId);
    }
    this.copyResetTimers.clear();
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    if (!(event.target instanceof Element)) {
      return;
    }

    const copyButton = event.target.closest('button[data-markdown-code-copy="true"]');
    if (copyButton instanceof HTMLButtonElement) {
      void this.copyMarkdownCode(copyButton, event);
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

  private async copyMarkdownCode(button: HTMLButtonElement, event: MouseEvent): Promise<void> {
    if (!this.elementRef.nativeElement.contains(button)) {
      return;
    }

    const block = button.closest('[data-markdown-code-block="true"]');
    if (!(block instanceof HTMLElement)) {
      return;
    }

    const code = block.querySelector('pre > code');
    const text = code?.textContent ?? '';
    if (!text) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const clipboard = this.elementRef.nativeElement.ownerDocument.defaultView?.navigator.clipboard;
    try {
      if (!clipboard) {
        throw new Error('clipboard unavailable');
      }
      await clipboard.writeText(text);
      this.reflectCodeCopied(button);
      this.snackBar.open(
        $localize`:@@markdown.copyCodeSuccess:Code wurde in die Zwischenablage kopiert.`,
        '',
        {
          duration: 2500,
        },
      );
    } catch {
      this.snackBar.open(
        $localize`:@@markdown.copyCodeFailed:Code konnte nicht kopiert werden. Bitte manuell markieren und kopieren.`,
        '',
        {
          duration: 4000,
        },
      );
    }
  }

  private reflectCodeCopied(button: HTMLButtonElement): void {
    const idleLabel = $localize`:@@markdown.copyCode:Code kopieren`;
    const copiedLabel = $localize`:@@markdown.codeCopied:Kopiert`;
    const existingTimer = this.copyResetTimers.get(button);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    button.disabled = true;
    button.dataset.markdownCopyState = 'copied';
    button.textContent = copiedLabel;
    button.setAttribute('aria-label', copiedLabel);
    button.setAttribute('title', copiedLabel);

    const timerId = window.setTimeout(() => {
      if (button.isConnected) {
        button.disabled = false;
        button.dataset.markdownCopyState = 'idle';
        button.textContent = idleLabel;
        button.setAttribute('aria-label', idleLabel);
        button.setAttribute('title', idleLabel);
      }
      this.copyResetTimers.delete(button);
    }, 1800);
    this.copyResetTimers.set(button, timerId);
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
      this.setMarkdownImageState(image, image.naturalWidth > 0 ? 'ready' : 'error');
      return;
    }

    this.setMarkdownImageState(image, 'loading');
  }

  private readonly onImageLoad = (event: Event): void => {
    if (!(event.target instanceof HTMLImageElement)) {
      return;
    }
    this.setMarkdownImageState(event.target, 'ready');
  };

  private readonly onImageError = (event: Event): void => {
    if (!(event.target instanceof HTMLImageElement)) {
      return;
    }
    this.setMarkdownImageState(event.target, 'error');
  };

  private setMarkdownImageState(
    image: HTMLImageElement,
    state: 'loading' | 'ready' | 'error',
  ): void {
    if (image.dataset) {
      image.dataset.markdownImageState = state;
      return;
    }

    image.setAttribute('data-markdown-image-state', state);
  }
}
