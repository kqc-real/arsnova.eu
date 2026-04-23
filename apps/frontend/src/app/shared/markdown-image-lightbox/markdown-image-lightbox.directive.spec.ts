import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownImageLightboxDirective } from './markdown-image-lightbox.directive';

@Component({
  standalone: true,
  imports: [MarkdownImageLightboxDirective],
  template: `
    <div appMarkdownImageLightbox>
      <img src="https://example.org/test.png" data-markdown-image-lightbox="true" alt="Demo" />
    </div>
  `,
})
class TestHostComponent {}

describe('MarkdownImageLightboxDirective', () => {
  it('markiert Bilder erst als loading und nach dem Laden als ready', () => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: MatDialog,
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
