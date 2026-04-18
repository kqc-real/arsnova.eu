import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownImageLightboxDialogComponent } from './markdown-image-lightbox-dialog.component';

describe('MarkdownImageLightboxDialogComponent', () => {
  function setup() {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [MarkdownImageLightboxDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            src: 'https://example.org/image.png',
            alt: 'Demo',
            title: '',
          },
        },
        {
          provide: MatDialogRef,
          useValue: { close },
        },
      ],
    });

    const fixture = TestBed.createComponent(MarkdownImageLightboxDialogComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const viewport = (component as unknown as { viewportRef?: { nativeElement: HTMLElement } })
      .viewportRef?.nativeElement;

    expect(viewport).toBeTruthy();
    Object.defineProperty(viewport!, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          left: 0,
          top: 0,
          width: 1000,
          height: 1000,
          right: 1000,
          bottom: 1000,
        }) satisfies Partial<DOMRect>,
    });

    (
      component as unknown as {
        naturalWidth: number;
        naturalHeight: number;
      }
    ).naturalWidth = 1000;
    (
      component as unknown as {
        naturalWidth: number;
        naturalHeight: number;
      }
    ).naturalHeight = 500;

    return { component, close };
  }

  it('schließt bei Klick in die Leerfläche um das sichtbare Bild', () => {
    const { component, close } = setup();

    component.onViewportClick(new MouseEvent('click', { clientX: 500, clientY: 100 }));

    expect(close).toHaveBeenCalledOnce();
  });

  it('schließt nicht bei Klick auf die sichtbare Bildfläche', () => {
    const { component, close } = setup();

    component.onViewportClick(new MouseEvent('click', { clientX: 500, clientY: 500 }));

    expect(close).not.toHaveBeenCalled();
  });
});
