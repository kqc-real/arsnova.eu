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

  function setup(options?: {
    mobile?: boolean;
    rows?: number;
    compact?: boolean;
    answerPreview?: boolean;
  }) {
    stubMatchMedia(options?.mobile ?? false);
    const matDialogMock = {
      open: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [MarkdownKatexEditorComponent],
      providers: [{ provide: MatDialog, useValue: matDialogMock }],
    });
    const fixture = TestBed.createComponent(MarkdownKatexEditorComponent);
    fixture.componentInstance.fieldId = 'markdown-editor-test-field';
    fixture.componentInstance.value = '';
    fixture.componentInstance.rows = options?.rows ?? fixture.componentInstance.rows;
    fixture.componentInstance.compact = options?.compact ?? fixture.componentInstance.compact;
    fixture.componentInstance.answerPreview =
      options?.answerPreview ?? fixture.componentInstance.answerPreview;
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

  it('bindet die vom sichtbaren Eltern-Label verwendete Feld-ID an die Textarea', () => {
    const { textarea } = setup();

    expect(textarea.id).toBe('markdown-editor-test-field');
  });

  it('setzt optionales aria-label und aria-describedby am Quellfeld', () => {
    const { fixture, textarea } = setup();
    fixture.componentRef.setInput('ariaLabel', 'Deine Frage');
    fixture.componentRef.setInput('ariaDescribedBy', 'vote-qa-closed-notice');
    fixture.detectChanges();

    expect(textarea.getAttribute('aria-label')).toBe('Deine Frage');
    expect(textarea.getAttribute('aria-describedby')).toBe('vote-qa-closed-notice');
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

  it('rendert relative Asset-Bilder in der Editor-Vorschau', () => {
    vi.useFakeTimers();
    const { fixture, component } = setup();

    component.onInput('![Demo](/assets/demo/9_konzeptfragen_panorama.svg)');
    vi.advanceTimersByTime(250);
    fixture.detectChanges();

    const previewBody = fixture.nativeElement.querySelector(
      '.mk-editor__preview-body',
    ) as HTMLElement | null;
    expect(previewBody?.innerHTML).toContain('src="/assets/demo/9_konzeptfragen_panorama.svg"');
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

  it('öffnet die Mobile-Vorschau automatisch bei bekannten Emoji-Shortcodes', () => {
    const { fixture, component } = setup({ mobile: true });

    component.onInput(':apple:');
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector('.mk-editor__preview') as HTMLElement;
    const toggle = fixture.nativeElement.querySelector(
      '.mk-editor__preview-toggle',
    ) as HTMLButtonElement;

    expect(preview.className).not.toContain('mk-editor__preview--collapsed');
    expect(toggle.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.mk-editor__preview-body')).not.toBeNull();
  });

  it('dekoriert führende Emoji-Shortcodes in Antwortvorschauen', () => {
    vi.useFakeTimers();
    const { fixture, component } = setup({ answerPreview: true });

    component.onInput(':smile: Bereit loszulegen');
    vi.advanceTimersByTime(250);
    fixture.detectChanges();

    const previewBody = fixture.nativeElement.querySelector(
      '.mk-editor__preview-body',
    ) as HTMLElement | null;
    const leadingEmoji = previewBody?.querySelector('.answer-leading-emoji');
    const textSlot = previewBody?.querySelector('.answer-leading-emoji-text');

    expect(leadingEmoji?.textContent).toContain('😄');
    expect(textSlot?.textContent).toBe('Bereit loszulegen');
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

  it('setzt bei leerem Feld einen Listen-Bullet und Zitat-Prefix', () => {
    const { component, textarea } = setup();
    textarea.value = '';
    textarea.setSelectionRange(0, 0);
    component.applyBulletList();
    expect(textarea.value).toBe('- ');
    expect(textarea.selectionStart).toBe(2);

    textarea.value = '';
    textarea.setSelectionRange(0, 0);
    component.applyQuote();
    expect(textarea.value).toBe('> ');
    expect(textarea.selectionStart).toBe(2);
  });

  it('setzt den Listen-Bullet vor vorhandenem Text und entfernt ihn wieder', () => {
    const { component, textarea } = setup();
    textarea.value = 'Punkt eins';
    textarea.setSelectionRange(0, 0);
    component.applyBulletList();
    expect(textarea.value).toBe('- Punkt eins');
    component.applyBulletList();
    expect(textarea.value).toBe('Punkt eins');
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
    const helpButton = fixture.nativeElement.querySelector(
      '.mk-editor__toolbar-help',
    ) as HTMLButtonElement | null;
    expect(helpButton).toBeTruthy();
    expect(helpButton?.closest('mat-menu')).toBeNull();
    expect(helpButton?.classList.contains('mk-editor__toolbar-help')).toBe(true);

    component.toggleHelp();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Markdown-Kurzhilfe');
    expect(text).toContain('Ctrl/Cmd');
    expect(text).toContain('Ein-/Ausrücken');
    expect(text).toContain('https://example.org');
    expect(text).toContain('*[credit] Bildnachweis*');
    expect(text).toContain('Bildnachweis direkt unter dem Bild');
  });

  it('schneidet Eingaben auf maxLength und zeigt den Zähler', () => {
    const fixture = TestBed.createComponent(MarkdownKatexEditorComponent);
    const component = fixture.componentInstance;
    component.fieldId = 'md-limit-test';
    component.value = '';
    component.maxLength = 10;
    fixture.detectChanges();
    component.onInput('abcdefghijklmnop');
    fixture.detectChanges();
    expect(component.rawValue()).toBe('abcdefghij');
    expect(fixture.nativeElement.textContent).toContain('10/10');
  });

  it('verwirft Toolbar-Wraps, die maxLength überschreiten würden', () => {
    const fixture = TestBed.createComponent(MarkdownKatexEditorComponent);
    const component = fixture.componentInstance;
    component.fieldId = 'md-limit-wrap';
    component.maxLength = 10;
    fixture.detectChanges();
    const field = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    field.value = 'abcdefghij';
    component.onInput(field.value);
    fixture.detectChanges();
    field.focus();
    field.setSelectionRange(0, 4);
    component['toolbarSelectionStash'] = { start: 0, end: 4 };
    component.applyBold();
    fixture.detectChanges();
    expect(field.value).toBe('abcdefghij');
    expect(component.rawValue()).toBe('abcdefghij');
  });

  it('setzt Cursor bei Codeblock und Block-Formel auf die leere Innenzeile', () => {
    const { component, textarea } = setup();
    textarea.value = '';
    textarea.setSelectionRange(0, 0);

    component.applyCodeBlock();
    expect(textarea.value).toMatch(/^\n```python\n\n```\n$/);
    expect(textarea.selectionStart).toBe('\n```python\n'.length);
    expect(textarea.selectionEnd).toBe(textarea.selectionStart);

    textarea.value = '';
    textarea.setSelectionRange(0, 0);
    component.applyBlockMath();
    expect(textarea.value).toBe('\n$$\n\n$$\n');
    expect(textarea.selectionStart).toBe('\n$$\n'.length);
    expect(textarea.selectionEnd).toBe(textarea.selectionStart);
  });

  it('wickelt Selektion in Block-Formel und setzt Cursor ans Ende des Inhalts', () => {
    const { component, textarea } = setup();
    textarea.value = 'x^2';
    textarea.setSelectionRange(0, 3);
    component.applyBlockMath();
    expect(textarea.value).toBe('\n$$\nx^2\n$$\n');
    expect(textarea.selectionStart).toBe('\n$$\nx^2'.length);
  });

  it('wickelt Selektion in Codeblock statt sie zu verwerfen', () => {
    const { component, textarea } = setup();
    textarea.value = 'print(1)';
    textarea.setSelectionRange(0, 8);
    component.applyCodeBlock();
    expect(textarea.value).toBe('\n```python\nprint(1)\n```\n');
    expect(textarea.selectionStart).toBe('\n```python\nprint(1)'.length);
  });

  it('entfernt einen markierten Codeblock wieder', () => {
    const { component, textarea } = setup();
    textarea.value = '```python\nprint(1)\n```';
    textarea.setSelectionRange(0, textarea.value.length);
    component.applyCodeBlock();
    expect(textarea.value).toBe('print(1)');
  });

  it('normalisiert Zeilenumbrüche vor Inline-Formel', () => {
    const { component, textarea } = setup();
    textarea.value = 'a\n+\nb';
    textarea.setSelectionRange(0, 5);
    component.applyInlineMath();
    expect(textarea.value).toBe('$a + b$');
    expect(textarea.selectionStart).toBe(1);
    expect(textarea.selectionEnd).toBe(6);
  });
});
