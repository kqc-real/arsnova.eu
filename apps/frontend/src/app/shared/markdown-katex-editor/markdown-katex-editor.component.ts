import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  AfterViewInit,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DEFAULT_MARKDOWN_FENCE_LANGUAGE } from '../markdown-code-highlight';
import { renderMarkdownWithKatex } from '../markdown-katex.util';
import {
  MarkdownImageDialogComponent,
  type MarkdownImageDialogResult,
} from './markdown-image-dialog.component';
import {
  MarkdownLinkDialogComponent,
  type MarkdownLinkDialogResult,
} from './markdown-link-dialog.component';
import { MarkdownImageLightboxDirective } from '../markdown-image-lightbox/markdown-image-lightbox.directive';
import { MARKDOWN_SHOWCASE_EN } from './markdown-showcase-sample.en';

/** Eingefügte Fence-Blöcke; Caret auf die leere Zeile zwischen öffnendem und schließendem Fence. */
const INSERT_CODE_BLOCK = `\n\`\`\`${DEFAULT_MARKDOWN_FENCE_LANGUAGE}\n\n\`\`\`\n`;
const INSERT_BLOCK_MATH = '\n$$\n\n$$\n';
/** Zeichenoffset nach `\n` + öffnendem Fence + `\n` (Anfang der Innenzeile). */
const CARET_OFFSET_CODE_BLOCK = `\n\`\`\`${DEFAULT_MARKDOWN_FENCE_LANGUAGE}\n`.length;
const CARET_OFFSET_BLOCK_MATH = '\n$$\n'.length;

@Component({
  selector: 'app-markdown-katex-editor',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MarkdownImageLightboxDirective,
  ],
  templateUrl: './markdown-katex-editor.component.html',
  styleUrls: ['./markdown-katex-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownKatexEditorComponent implements AfterViewInit, OnChanges {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dialog = inject(MatDialog);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Sichtbare Kurzinfos (matTooltip) + aria-label – gleiche IDs wie zuvor in den Templates. */
  readonly mdToolbarLabel = {
    bold: $localize`:@@mdEditor.boldAria:Fett`,
    italic: $localize`:@@mdEditor.italicAria:Kursiv`,
    list: $localize`:@@mdEditor.bulletListAria:Liste`,
    quote: $localize`:@@mdEditor.quoteAria:Zitat`,
    inlineCode: $localize`:@@mdEditor.inlineCodeAria:Inline-Code`,
    inlineMath: $localize`:@@mdEditor.inlineMathAria:Inline-Formel`,
    link: $localize`:@@mdEditor.linkAria:Link einfügen`,
    image: $localize`:@@mdEditor.imageAria:Bild einfügen`,
    heading: $localize`:@@mdEditor.toolbarHeading2Aria:Überschrift`,
    codeBlock: $localize`:@@mdEditor.toolbarCodeBlockAria:Codeblock`,
    blockMath: $localize`:@@mdEditor.toolbarBlockMathAria:Block-Formel`,
    showcase: $localize`:@@mdEditor.showcaseAria:Vollständiges Markdown- und KaTeX-Beispiel auf Englisch laden (ersetzt den aktuellen Text)`,
    more: $localize`:@@mdEditor.moreActionsAria:Weitere Aktionen`,
  } as const;

  /** Selektion vom letzten Toolbar-Pointerdown (Capture), bevor Buttons den Fokus stehlen. */
  private toolbarSelectionStash: { start: number; end: number } | null = null;

  @Input({ required: true }) value = '';
  @Input() disabled = false;
  @Input() placeholder = '';
  @Input() rows = 4;
  @Input() compact = false;
  /** Kein Rand um Quelltext + Vorschau (Toolbar bleibt mit Umrandung). */
  @Input() framelessPanels = false;

  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('field', { static: true }) fieldRef!: ElementRef<HTMLTextAreaElement>;

  readonly rawValue = signal('');
  readonly debouncedValue = signal('');

  readonly preview = computed<SafeHtml>(() => {
    const result = renderMarkdownWithKatex(this.debouncedValue());
    return this.sanitizer.bypassSecurityTrustHtml(result.html);
  });

  constructor() {
    effect(() => {
      const next = this.rawValue();
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.debouncedValue.set(next), 250);
    });
  }

  ngAfterViewInit(): void {
    const el = this.fieldRef.nativeElement;
    const next = this.rawValue();
    if (el.value !== next) {
      el.value = next;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      const next = this.value ?? '';
      if (next !== this.rawValue()) {
        this.rawValue.set(next);
        this.debouncedValue.set(next);
        this.syncTextareaDomFromParent(next);
      }
    }
  }

  /** Ohne [value]-Binding: nur bei externem Input setzen, sonst zerstört CD die Selektion/Cursor. */
  private syncTextareaDomFromParent(next: string): void {
    queueMicrotask(() => {
      const el = this.fieldRef?.nativeElement;
      if (!el || el.value === next) return;
      el.value = next;
    });
  }

  /** Angular liefert `$event` als `Event`; bei `pointerdown` ist es faktisch `PointerEvent`. */
  onToolbarPointerDownCapture(raw: Event): void {
    const event = raw as PointerEvent;
    if (this.disabled) {
      this.toolbarSelectionStash = null;
      return;
    }
    if (event.button !== 0) return;
    const field = this.fieldRef.nativeElement;
    this.toolbarSelectionStash = {
      start: field.selectionStart ?? 0,
      end: field.selectionEnd ?? 0,
    };
    event.preventDefault();
  }

  private restoreToolbarTextareaSelection(): void {
    const field = this.fieldRef.nativeElement;
    field.focus();
    if (!this.toolbarSelectionStash) return;
    const len = field.value.length;
    let { start, end } = this.toolbarSelectionStash;
    start = Math.max(0, Math.min(start, len));
    end = Math.max(0, Math.min(end, len));
    if (end < start) {
      const t = start;
      start = end;
      end = t;
    }
    field.setSelectionRange(start, end);
    this.toolbarSelectionStash = null;
  }

  /**
   * Einfügen von Delimitern um die aktuelle Selektion (ohne text-field-edit: dort rückt
   * `withFocus` nach Toolbar-Klicks den Fokus zurück und bricht Selektion/Cursor).
   */
  private wrapFieldInPlace(field: HTMLTextAreaElement, wrap: string, wrapEnd: string): void {
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;
    const v = field.value;
    const selected = v.slice(start, end);
    const inserted = wrap + selected + wrapEnd;
    const next = v.slice(0, start) + inserted + v.slice(end);
    field.value = next;
    field.setSelectionRange(start + wrap.length, end + wrap.length);
    this.onInput(field.value);
  }

  onInput(value: string): void {
    this.rawValue.set(value);
    this.valueChange.emit(value);
  }

  /**
   * Strg/Cmd+B/I/K im Quellfeld — gleiche Aktionen wie die Toolbar (kein Fokusverlust zur Leiste).
   */
  onFieldKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;
    if (!event.ctrlKey && !event.metaKey) return;
    if (event.altKey || event.shiftKey) return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'b') {
      event.preventDefault();
      this.applyBold();
      return;
    }
    if (key === 'i') {
      event.preventDefault();
      this.applyItalic();
      return;
    }
    if (key === 'k') {
      event.preventDefault();
      this.openLinkDialog();
      return;
    }
  }

  focusField(): void {
    this.fieldRef.nativeElement.focus();
  }

  insert(text: string, caretOffsetInInsertedText?: number): void {
    this.restoreToolbarTextareaSelection();
    const field = this.fieldRef.nativeElement;
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;
    this.replaceFieldRange(field, start, end, text, caretOffsetInInsertedText);
  }

  /** Einfügen an fester Zeichen-Range (z. B. nach Dialog, ohne Toolbar-Stash). */
  private replaceFieldRange(
    field: HTMLTextAreaElement,
    rangeStart: number,
    rangeEnd: number,
    text: string,
    caretOffsetInInsertedText?: number,
  ): void {
    field.focus();
    const v = field.value;
    const len = v.length;
    const a = Math.max(0, Math.min(rangeStart, len));
    const b = Math.max(0, Math.min(rangeEnd, len));
    const next = v.slice(0, a) + text + v.slice(b);
    field.value = next;
    const caret =
      caretOffsetInInsertedText !== undefined
        ? a + Math.min(Math.max(0, caretOffsetInInsertedText), text.length)
        : a + text.length;
    field.setSelectionRange(caret, caret);
    this.onInput(field.value);
  }

  applyBold(): void {
    this.toggleInlineMarkers('**');
  }

  applyItalic(): void {
    this.toggleInlineMarkers('_');
  }

  /**
   * Inline-Markup (Fett, Kursiv, `Code`, $Formel$): gleiche Marker erneut = entfernen, sonst einwickeln.
   */
  private toggleInlineMarkers(marker: string): void {
    this.restoreToolbarTextareaSelection();
    const field = this.fieldRef.nativeElement;
    const mlen = marker.length;
    const v = field.value;
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;

    if (start === end && start >= mlen && start + mlen <= v.length) {
      const left = v.slice(start - mlen, start);
      const right = v.slice(start, start + mlen);
      if (left === marker && right === marker) {
        const next = v.slice(0, start - mlen) + v.slice(start + mlen);
        field.value = next;
        const pos = start - mlen;
        field.setSelectionRange(pos, pos);
        this.onInput(field.value);
        return;
      }
    }

    if (end > start) {
      const sel = v.slice(start, end);
      if (sel.length >= 2 * mlen && sel.startsWith(marker) && sel.endsWith(marker)) {
        const inner = sel.slice(mlen, -mlen);
        const next = v.slice(0, start) + inner + v.slice(end);
        field.value = next;
        field.setSelectionRange(start, start + inner.length);
        this.onInput(field.value);
        return;
      }
    }

    this.wrapFieldInPlace(field, marker, marker);
  }

  applyInlineCode(): void {
    this.toggleInlineMarkers('`');
  }

  applyCodeBlock(): void {
    this.restoreToolbarTextareaSelection();
    const field = this.fieldRef.nativeElement;
    const v = field.value;
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;
    if (end > start) {
      const sel = v.slice(start, end);
      const inner = this.tryStripOuterCodeFence(sel);
      if (inner !== null) {
        field.value = v.slice(0, start) + inner + v.slice(end);
        const pos = start + inner.length;
        field.setSelectionRange(pos, pos);
        this.onInput(field.value);
        return;
      }
    }
    this.insert(INSERT_CODE_BLOCK, CARET_OFFSET_CODE_BLOCK);
  }

  /** Selektion ist genau ein ```…```-Block → Inneres zurückgeben, sonst null. */
  private tryStripOuterCodeFence(text: string): string | null {
    const m = text.match(/^```(\w*)\r?\n([\s\S]*)\r?\n```$/);
    return m ? m[2] : null;
  }

  applyHeading(level: 2 | 3): void {
    this.restoreToolbarTextareaSelection();
    const field = this.fieldRef.nativeElement;
    const value = field.value;
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIdx = value.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const block = value.slice(lineStart, lineEnd);
    const prefix = `${'#'.repeat(level)} `;
    const lines = block.split('\n');
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    const allHaveThisHeading = nonEmpty.length > 0 && nonEmpty.every((l) => l.startsWith(prefix));
    const updatedBlock = allHaveThisHeading
      ? lines
          .map((line) =>
            line.trim().length === 0
              ? line
              : line.startsWith(prefix)
                ? line.slice(prefix.length)
                : line,
          )
          .join('\n')
      : lines
          .map((line) => (line.trim().length === 0 ? line : line.replace(/^(#{1,6}\s+)?/, prefix)))
          .join('\n');
    const nextValue = value.slice(0, lineStart) + updatedBlock + value.slice(lineEnd);
    field.value = nextValue;
    const nextPos = lineStart + updatedBlock.length;
    field.setSelectionRange(nextPos, nextPos);
    this.onInput(field.value);
  }

  applyBulletList(): void {
    this.restoreToolbarTextareaSelection();
    const field = this.fieldRef.nativeElement;
    const value = field.value;
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIdx = value.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    const allBulleted = nonEmpty.length > 0 && nonEmpty.every((l) => l.startsWith('- '));
    const updatedBlock = lines
      .map((line) => {
        if (line.trim().length === 0) return line;
        if (allBulleted) return line.startsWith('- ') ? line.slice(2) : line;
        return line.startsWith('- ') ? line : `- ${line}`;
      })
      .join('\n');
    const nextValue = value.slice(0, lineStart) + updatedBlock + value.slice(lineEnd);
    field.value = nextValue;
    const nextPos = lineStart + updatedBlock.length;
    field.setSelectionRange(nextPos, nextPos);
    this.onInput(field.value);
  }

  applyQuote(): void {
    this.restoreToolbarTextareaSelection();
    const field = this.fieldRef.nativeElement;
    const value = field.value;
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIdx = value.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    const allQuoted = nonEmpty.length > 0 && nonEmpty.every((l) => l.startsWith('> '));
    const updatedBlock = lines
      .map((line) => {
        if (line.trim().length === 0) return line;
        if (allQuoted) return line.startsWith('> ') ? line.slice(2) : line;
        return line.startsWith('> ') ? line : `> ${line}`;
      })
      .join('\n');
    const nextValue = value.slice(0, lineStart) + updatedBlock + value.slice(lineEnd);
    field.value = nextValue;
    const nextPos = lineStart + updatedBlock.length;
    field.setSelectionRange(nextPos, nextPos);
    this.onInput(field.value);
  }

  applyInlineMath(): void {
    this.toggleInlineMarkers('$');
  }

  applyBlockMath(): void {
    this.insert(INSERT_BLOCK_MATH, CARET_OFFSET_BLOCK_MATH);
  }

  /** Ersetzt den Quelltext durch ein englisches Vollbeispiel (unterstützte Markdown- und KaTeX-Optionen). */
  applyMarkdownShowcase(): void {
    if (this.disabled) return;
    const field = this.fieldRef.nativeElement;
    field.focus();
    const next = MARKDOWN_SHOWCASE_EN;
    field.value = next;
    field.setSelectionRange(0, 0);
    this.onInput(next);
  }

  openLinkDialog(): void {
    this.restoreToolbarTextareaSelection();
    const field = this.fieldRef.nativeElement;
    const rangeStart = field.selectionStart ?? 0;
    const rangeEnd = field.selectionEnd ?? rangeStart;
    const selection = field.value.substring(rangeStart, rangeEnd);
    const ref = this.dialog.open<
      MarkdownLinkDialogComponent,
      { text: string },
      MarkdownLinkDialogResult
    >(MarkdownLinkDialogComponent, {
      autoFocus: true,
      restoreFocus: false,
      panelClass: 'md-markdown-insert-dialog-panel',
      width: 'min(22.5rem, calc(100vw - 2rem))',
      maxWidth: '96vw',
      data: { text: selection },
    });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.replaceFieldRange(field, rangeStart, rangeEnd, `[${result.text}](${result.url})`);
        this.restoreCaretFocusAfterDialog(field);
      } else {
        queueMicrotask(() => field.focus());
      }
    });
  }

  openImageDialog(): void {
    this.restoreToolbarTextareaSelection();
    const field = this.fieldRef.nativeElement;
    const rangeStart = field.selectionStart ?? 0;
    const rangeEnd = field.selectionEnd ?? rangeStart;
    const ref = this.dialog.open<
      MarkdownImageDialogComponent,
      undefined,
      MarkdownImageDialogResult
    >(MarkdownImageDialogComponent, {
      autoFocus: true,
      restoreFocus: false,
      panelClass: 'md-markdown-insert-dialog-panel',
      width: 'min(22.5rem, calc(100vw - 2rem))',
      maxWidth: '96vw',
    });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.replaceFieldRange(field, rangeStart, rangeEnd, `![${result.alt}](${result.url})`);
        this.restoreCaretFocusAfterDialog(field);
      } else {
        queueMicrotask(() => field.focus());
      }
    });
  }

  /** Nach Dialog-Schließen: Fokus und Caret im Textarea (replaceFieldRange setzt die Position). */
  private restoreCaretFocusAfterDialog(field: HTMLTextAreaElement): void {
    queueMicrotask(() => {
      const len = field.value.length;
      const start = Math.min(field.selectionStart ?? 0, len);
      const end = Math.min(field.selectionEnd ?? start, len);
      field.focus();
      field.setSelectionRange(start, end);
    });
  }
}
