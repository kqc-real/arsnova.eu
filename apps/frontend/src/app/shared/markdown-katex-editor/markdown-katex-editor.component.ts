import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
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
import { insertTextIntoField, setFieldText, wrapFieldSelection } from 'text-field-edit';
import { renderMarkdownWithKatex } from '../markdown-katex.util';
import {
  MarkdownImageDialogComponent,
  type MarkdownImageDialogResult,
} from './markdown-image-dialog.component';
import {
  MarkdownLinkDialogComponent,
  type MarkdownLinkDialogResult,
} from './markdown-link-dialog.component';

@Component({
  selector: 'app-markdown-katex-editor',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule, MatMenuModule],
  templateUrl: './markdown-katex-editor.component.html',
  styleUrls: ['./markdown-katex-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownKatexEditorComponent implements OnChanges {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dialog = inject(MatDialog);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  @Input({ required: true }) value = '';
  @Input() disabled = false;
  @Input() placeholder = '';
  @Input() rows = 4;
  @Input() compact = false;

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      const next = this.value ?? '';
      if (next !== this.rawValue()) {
        this.rawValue.set(next);
        this.debouncedValue.set(next);
      }
    }
  }

  onInput(value: string): void {
    this.rawValue.set(value);
    this.valueChange.emit(value);
  }

  focusField(): void {
    this.fieldRef.nativeElement.focus();
  }

  wrap(wrapStart: string, wrapEnd?: string): void {
    const field = this.fieldRef.nativeElement;
    wrapFieldSelection(field, wrapStart, wrapEnd);
    this.onInput(field.value);
  }

  insert(text: string): void {
    const field = this.fieldRef.nativeElement;
    insertTextIntoField(field, text);
    this.onInput(field.value);
  }

  applyBold(): void {
    this.wrap('**');
  }

  applyItalic(): void {
    this.wrap('_');
  }

  applyInlineCode(): void {
    this.wrap('`');
  }

  applyCodeBlock(): void {
    this.insert('\n```\\n\\n```\\n');
  }

  applyHeading(level: 2 | 3): void {
    const field = this.fieldRef.nativeElement;
    const value = field.value;
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIdx = value.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const block = value.slice(lineStart, lineEnd);
    const prefix = `${'#'.repeat(level)} `;
    const updatedBlock = block
      .split('\n')
      .map((line) => (line.trim().length === 0 ? line : line.replace(/^(#{1,6}\s+)?/, prefix)))
      .join('\n');
    const nextValue = value.slice(0, lineStart) + updatedBlock + value.slice(lineEnd);
    setFieldText(field, nextValue);
    // best effort selection: keep cursor at end of transformed region
    const nextPos = lineStart + updatedBlock.length;
    field.setSelectionRange(nextPos, nextPos);
    this.onInput(field.value);
  }

  applyBulletList(): void {
    const field = this.fieldRef.nativeElement;
    const value = field.value;
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIdx = value.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const block = value.slice(lineStart, lineEnd);
    const updatedBlock = block
      .split('\n')
      .map((line) => (line.trim().length === 0 ? line : line.startsWith('- ') ? line : `- ${line}`))
      .join('\n');
    const nextValue = value.slice(0, lineStart) + updatedBlock + value.slice(lineEnd);
    setFieldText(field, nextValue);
    const nextPos = lineStart + updatedBlock.length;
    field.setSelectionRange(nextPos, nextPos);
    this.onInput(field.value);
  }

  applyQuote(): void {
    const field = this.fieldRef.nativeElement;
    const value = field.value;
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIdx = value.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const block = value.slice(lineStart, lineEnd);
    const updatedBlock = block
      .split('\n')
      .map((line) => (line.trim().length === 0 ? line : line.startsWith('> ') ? line : `> ${line}`))
      .join('\n');
    const nextValue = value.slice(0, lineStart) + updatedBlock + value.slice(lineEnd);
    setFieldText(field, nextValue);
    const nextPos = lineStart + updatedBlock.length;
    field.setSelectionRange(nextPos, nextPos);
    this.onInput(field.value);
  }

  applyInlineMath(): void {
    this.wrap('$');
  }

  applyBlockMath(): void {
    this.insert('\n$$\\n\\n$$\\n');
  }

  openLinkDialog(event: MouseEvent): void {
    const trigger = event.currentTarget as HTMLElement | null;
    const selection = this.fieldRef.nativeElement.value.substring(
      this.fieldRef.nativeElement.selectionStart ?? 0,
      this.fieldRef.nativeElement.selectionEnd ?? 0,
    );
    const ref = this.dialog.open<
      MarkdownLinkDialogComponent,
      { text: string },
      MarkdownLinkDialogResult
    >(MarkdownLinkDialogComponent, {
      autoFocus: true,
      restoreFocus: false,
      data: { text: selection },
    });
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      this.insert(`[${result.text}](${result.url})`);
      // restore focus to triggering button (A11y requirement in story)
      trigger?.focus();
    });
  }

  openImageDialog(event: MouseEvent): void {
    const trigger = event.currentTarget as HTMLElement | null;
    const ref = this.dialog.open<
      MarkdownImageDialogComponent,
      undefined,
      MarkdownImageDialogResult
    >(MarkdownImageDialogComponent, {
      autoFocus: true,
      restoreFocus: false,
    });
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      this.insert(`![${result.alt}](${result.url})`);
      trigger?.focus();
    });
  }
}
