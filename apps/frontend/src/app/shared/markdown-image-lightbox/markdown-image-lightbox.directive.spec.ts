import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownImageLightboxDirective } from './markdown-image-lightbox.directive';

@Component({
  standalone: true,
  imports: [MarkdownImageLightboxDirective],
  template: `
    <div appMarkdownImageLightbox>
      <div data-markdown-code-block="true">
        <button
          type="button"
          data-markdown-code-copy="true"
          title="Code kopieren"
          aria-label="Code kopieren"
        >
          Code kopieren
        </button>
        <pre><code class="hljs language-javascript">console.log('hi')</code></pre>
      </div>
      <img src="https://example.org/test.png" data-markdown-image-lightbox="true" alt="Demo" />
    </div>
  `,
})
class TestHostComponent {}

describe('MarkdownImageLightboxDirective', () => {
  it('kopiert Markdown-Codeblöcke per Button in die Zwischenablage', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const snackBarOpen = vi.fn();

    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: MatDialog,
          useValue: { open: vi.fn() },
        },
        {
          provide: MatSnackBar,
          useValue: { open: snackBarOpen },
        },
      ],
    });

    const fixture = TestBed.createComponent(TestHostComponent);
    const windowRef = fixture.nativeElement.ownerDocument.defaultView as Window;
    Object.defineProperty(windowRef.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button[data-markdown-code-copy="true"]',
    ) as HTMLButtonElement;
    button.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("console.log('hi')");
    expect(button.textContent?.trim()).toBe('Kopiert');
    expect(snackBarOpen).toHaveBeenCalledWith('Code wurde in die Zwischenablage kopiert.', '', {
      duration: 2500,
    });
  });

  it('markiert Bilder erst als loading und nach dem Laden als ready', () => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: MatDialog,
          useValue: { open: vi.fn() },
        },
        {
          provide: MatSnackBar,
          useValue: { open: vi.fn() },
        },
      ],
    });

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector(
      'img[data-markdown-image-lightbox="true"]',
    ) as HTMLImageElement;
    const directive = fixture.debugElement.children[0]!.injector.get(
      MarkdownImageLightboxDirective,
    ) as unknown as {
      syncImageState: (image: HTMLImageElement) => void;
    };

    Object.defineProperty(image, 'complete', {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(image, 'naturalWidth', {
      configurable: true,
      get: () => 0,
    });

    directive.syncImageState(image);
    expect(image.dataset.markdownImageState).toBe('loading');

    Object.defineProperty(image, 'complete', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(image, 'naturalWidth', {
      configurable: true,
      get: () => 640,
    });

    image.dispatchEvent(new Event('load'));
    expect(image.dataset.markdownImageState).toBe('ready');
  });
});
