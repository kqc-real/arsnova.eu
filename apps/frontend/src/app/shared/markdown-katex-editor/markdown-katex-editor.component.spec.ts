import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownKatexEditorComponent } from './markdown-katex-editor.component';

describe('MarkdownKatexEditorComponent', () => {
  function stubMatchMedia(matches = false) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches,
        media: '(max-width: 599px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  }

  function setup(options?: { mobile?: boolean; rows?: number; compact?: boolean }) {
    stubMatchMedia(options?.mobile ?? false);
    const matDialogMock = {
      open: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [MarkdownKatexEditorComponent],
      providers: [{ provide: MatDialog, useValue: matDialogMock }],
    });
    const fixture = TestBed.createComponent(MarkdownKatexEditorComponent);
    fixture.componentInstance.value = '';
    fixture.componentInstance.rows = options?.rows ?? fixture.componentInstance.rows;
    fixture.componentInstance.compact = options?.compact ?? fixture.componentInstance.compact;
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      textarea: fixture.componentInstance.fieldRef.nativeElement,
      previewBody: fixture.nativeElement.querySelector('.mk-editor__preview-body') as HTMLElement,
    };
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('zeigt KaTeX-Fehler direkt in der Vorschau des Editors an', () => {
    vi.useFakeTimers();
    const { fixture, component } = setup();

    component.onInput(String.raw`Formel: $\frac{1}{2$`);
    vi.advanceTimersByTime(250);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Formelfehler:');
    expect(text).toContain('KaTeX-Fehler');
  });

  it('klappt die Mobile-Vorschau ohne Markdown- oder KaTeX-Syntax zu', () => {
    const { fixture } = setup({ mobile: true });

    const preview = fixture.nativeElement.querySelector('.mk-editor__preview') as HTMLElement;
    const toggle = fixture.nativeElement.querySelector(
      '.mk-editor__preview-toggle',
    ) as HTMLButtonElement;

    expect(preview.className).toContain('mk-editor__preview--collapsed');
    expect(toggle.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.mk-editor__preview-body')).toBeNull();
  });

  it('vergrößert auf Smartphones die sichtbaren Zeilen im normalen Editor', () => {
    const { textarea } = setup({ mobile: true, rows: 4 });

    expect(textarea.rows).toBe(8);
  });

  it('lässt kompakte Editoren auf Smartphones unverändert klein', () => {
    const { fixture, component, textarea } = setup({ mobile: true });

    component.compact = true;
    component.rows = 2;
    component.ngOnChanges({
      compact: new SimpleChange(false, true, false),
      rows: new SimpleChange(4, 2, false),
    });
    fixture.detectChanges();

    expect(textarea.rows).toBe(2);
  });

  it('öffnet die Mobile-Vorschau automatisch bei Markdown oder KaTeX', () => {
    const { fixture, component } = setup({ mobile: true });

    component.onInput('Nur Text');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mk-editor__preview-body')).toBeNull();

    component.onInput(String.raw`Formel: $x^2$`);
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector('.mk-editor__preview') as HTMLElement;
    const toggle = fixture.nativeElement.querySelector(
      '.mk-editor__preview-toggle',
    ) as HTMLButtonElement;

    expect(preview.className).not.toContain('mk-editor__preview--collapsed');
    expect(toggle.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.mk-editor__preview-body')).not.toBeNull();
  });

  it('erkennt einfache Inline-KaTeX-Variablen wie $f$ für die Mobile-Vorschau', () => {
    const { fixture, component } = setup({ mobile: true });

    component.onInput('Formel: $f$');
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector('.mk-editor__preview') as HTMLElement;
    const toggle = fixture.nativeElement.querySelector(
      '.mk-editor__preview-toggle',
    ) as HTMLButtonElement;

    expect(preview.className).not.toContain('mk-editor__preview--collapsed');
    expect(toggle.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.mk-editor__preview-body')).not.toBeNull();
  });

  it('rückt Listen mit Tab ein und mit Shift+Tab wieder aus', () => {
    const { component, textarea } = setup();

    textarea.value = '- eins\n- zwei';
    textarea.setSelectionRange(0, textarea.value.length);

    component.onFieldKeydown(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(textarea.value).toBe('  - eins\n  - zwei');

    component.onFieldKeydown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(textarea.value).toBe('- eins\n- zwei');
  });

  it('synchronisiert die Vorschau auf die relative Scroll-Position des Quelltexts', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { component, textarea, previewBody } = setup();

    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(textarea, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(previewBody, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(previewBody, 'clientHeight', { configurable: true, value: 200 });

    textarea.scrollTop = 450;
    component.onSourceScroll();

    expect(previewBody.scrollTop).toBe(900);
  });

  it('markiert Toolbar-Buttons aktiv, wenn der Cursor in passendem Markdown steht', () => {
    const { fixture, component, textarea } = setup();

    textarea.value = '**aktiv**';
    textarea.setSelectionRange(4, 4);
    component.onInput(textarea.value);
    component.onFieldSelectionChange();
    fixture.detectChanges();

    const boldButton = fixture.nativeElement.querySelector(
      'button[aria-label="Fett"]',
    ) as HTMLButtonElement;
    expect(boldButton.className).toContain('mk-editor__tool--active');
    expect(boldButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('zeigt eine nicht-destruktive Kurzhilfe mit Shortcuts an', () => {
    const { fixture, component } = setup();

    component.toggleHelp();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Markdown-Kurzhilfe');
    expect(text).toContain('Ctrl/Cmd');
    expect(text).toContain('Ein-/Ausrücken');
    expect(text).toContain('https://example.org');
  });
});
