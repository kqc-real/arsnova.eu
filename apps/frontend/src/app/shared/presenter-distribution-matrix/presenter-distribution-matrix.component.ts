import { Component, Input, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { renderMarkdownWithKatex } from '../markdown-katex.util';

export interface DistributionMatrixAxisEntry {
  id: string;
  label: string;
}

export interface DistributionMatrixCell {
  rowId: string;
  columnId: string;
  count: number;
}

@Component({
  selector: 'app-presenter-distribution-matrix',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './presenter-distribution-matrix.component.html',
  styleUrl: './presenter-distribution-matrix.component.scss',
})
export class PresenterDistributionMatrixComponent {
  private readonly sanitizer = inject(DomSanitizer);

  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input({ required: true }) rows: DistributionMatrixAxisEntry[] = [];
  @Input({ required: true }) columns: DistributionMatrixAxisEntry[] = [];
  @Input({ required: true }) cells: DistributionMatrixCell[] = [];
  @Input() totalVotes = 0;
  @Input() correctColumnByRow: Record<string, string> = {};

  count(rowId: string, columnId: string): number {
    return (
      this.cells.find((cell) => cell.rowId === rowId && cell.columnId === columnId)?.count ?? 0
    );
  }

  percent(count: number): number {
    return this.totalVotes > 0 ? Math.round((count / this.totalVotes) * 100) : 0;
  }

  isCorrectCell(rowId: string, columnId: string): boolean {
    return this.correctColumnByRow[rowId] === columnId;
  }

  renderMarkdown(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(value, { headingStartLevel: 4, escapeListMarkers: true }).html,
    );
  }
}
