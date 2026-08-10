import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { renderMarkdownWithKatex } from '../markdown-katex.util';

export interface ItemSelectionOption {
  id: string;
  text: string;
}

@Component({
  selector: 'app-item-selection-row',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule],
  templateUrl: './item-selection-row.component.html',
  styleUrl: './item-selection-row.component.scss',
})
export class ItemSelectionRowComponent {
  private readonly sanitizer = inject(DomSanitizer);

  @Input({ required: true }) itemText = '';
  @Input({ required: true }) options: ItemSelectionOption[] = [];
  @Input({ required: true }) selectedId = '';
  @Input({ required: true }) selectLabel = '';
  @Input({ required: true }) selectAriaLabel = '';
  @Input() disabled = false;
  @Output() readonly selectedIdChange = new EventEmitter<string>();

  selectedText(): string {
    return this.options.find((option) => option.id === this.selectedId)?.text ?? '';
  }

  renderMarkdown(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(value, { headingStartLevel: 4, escapeListMarkers: true }).html,
    );
  }

  confirmSelection(selectedId: string, select: MatSelect): void {
    this.selectedIdChange.emit(selectedId);

    // Run after Material's option handlers and the parent input update. This keeps the
    // single-select overlay closed on touch devices even if that update reopens the panel.
    queueMicrotask(() => select.close());
  }

  openSelectionFromField(event: MouseEvent, select: MatSelect): void {
    const target = event.target;
    if (this.disabled || (target instanceof Element && target.closest('mat-select') !== null)) {
      return;
    }
    select.open();
  }
}
