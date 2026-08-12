import { Component, DestroyRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { renderMarkdownWithKatex } from '../markdown-katex.util';

export interface ItemSelectionOption {
  id: string;
  text: string;
}

const SELECT_CLOSE_GUARD_MS = 250;

@Component({
  selector: 'app-item-selection-row',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule],
  templateUrl: './item-selection-row.component.html',
  styleUrl: './item-selection-row.component.scss',
})
export class ItemSelectionRowComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private selectionCloseGuardActive = false;
  private selectionCloseGuardTimer: ReturnType<typeof setTimeout> | null = null;

  @Input({ required: true }) itemText = '';
  @Input({ required: true }) options: ItemSelectionOption[] = [];
  @Input({ required: true }) selectedId = '';
  @Input({ required: true }) selectLabel = '';
  @Input({ required: true }) selectAriaLabel = '';
  @Input() disabled = false;
  @Output() readonly selectedIdChange = new EventEmitter<string>();

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.selectionCloseGuardTimer) {
        clearTimeout(this.selectionCloseGuardTimer);
      }
    });
  }

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
    this.closeSelectionWithReopenGuard(select);
  }

  handleSelectionOpenedChange(opened: boolean, select: MatSelect): void {
    if (!opened) {
      this.activateSelectionCloseGuard();
    } else if (this.selectionCloseGuardActive) {
      this.closeSelectionWithReopenGuard(select);
    }
  }

  openSelectionFromField(event: MouseEvent, select: MatSelect): void {
    const target = event.target;
    if (
      this.disabled ||
      this.selectionCloseGuardActive ||
      (target instanceof Element && target.closest('mat-select') !== null)
    ) {
      return;
    }
    select.open();
  }

  private closeSelectionWithReopenGuard(select: MatSelect): void {
    this.activateSelectionCloseGuard();
    queueMicrotask(() => select.close());
  }

  private activateSelectionCloseGuard(): void {
    this.selectionCloseGuardActive = true;
    if (this.selectionCloseGuardTimer) {
      clearTimeout(this.selectionCloseGuardTimer);
    }

    // Material detaches a closing select overlay asynchronously. A second touch-generated
    // click during that window can reopen the same overlay and cancel its detach fallback.
    // Arm the guard for every close, including reselecting the current option. Material
    // closes in that case without emitting selectionChange.
    this.selectionCloseGuardTimer = setTimeout(() => {
      this.selectionCloseGuardActive = false;
      this.selectionCloseGuardTimer = null;
    }, SELECT_CLOSE_GUARD_MS);
  }
}
