import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { DEFAULT_STOPWORDS, aggregateWords } from './word-cloud.util';

interface CloudWord {
  word: string;
  count: number;
  size: number;
}

@Component({
  selector: 'app-word-cloud',
  standalone: true,
  imports: [MatButton, MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatIcon],
  templateUrl: './word-cloud.component.html',
  styleUrl: './word-cloud.component.scss',
})
export class WordCloudComponent {
  private readonly document = inject(DOCUMENT);

  readonly responses = input<string[]>([]);
  readonly selectedWord = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly hideStopwords = signal(true);

  readonly words = computed<CloudWord[]>(() => {
    const aggregated = aggregateWords(
      this.responses(),
      this.hideStopwords() ? DEFAULT_STOPWORDS : new Set<string>(),
    );
    const maxCount = aggregated[0]?.count ?? 1;
    return aggregated.map((entry) => ({
      ...entry,
      size: 14 + Math.round((entry.count / maxCount) * 26),
    }));
  });

  readonly filteredResponses = computed(() => {
    const selected = this.selectedWord();
    if (!selected) return this.responses();
    return this.responses().filter((response) => response.toLowerCase().includes(selected));
  });

  toggleWord(word: string): void {
    this.selectedWord.update((current) => (current === word ? null : word));
  }

  toggleStopwords(): void {
    this.hideStopwords.update((value) => !value);
    this.selectedWord.set(null);
  }

  exportCsv(): void {
    const rows = ['word,count', ...this.words().map((entry) => `${entry.word},${entry.count}`)];
    this.downloadBlob(rows.join('\n'), `wordcloud_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    this.statusMessage.set('CSV exportiert.');
  }

  async exportPng(): Promise<void> {
    const canvas = this.document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.statusMessage.set('PNG-Export nicht möglich.');
      return;
    }

    const surfaceColor = this.readCssColor('--mat-sys-surface', 'white');
    const primaryColor = this.readCssColor('--mat-sys-primary', 'black');
    ctx.fillStyle = surfaceColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let x = 48;
    let y = 96;
    for (const entry of this.words()) {
      const fontSize = entry.size;
      ctx.font = `600 ${fontSize}px system-ui`;
      const text = entry.word;
      const textWidth = ctx.measureText(text).width;
      if (x + textWidth > canvas.width - 48) {
        x = 48;
        y += 56;
      }
      if (y > canvas.height - 32) break;

      ctx.fillStyle = primaryColor;
      ctx.fillText(text, x, y);
      x += textWidth + 24;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((value) => resolve(value), 'image/png'),
    );
    if (!blob) {
      this.statusMessage.set('PNG-Export nicht möglich.');
      return;
    }

    this.downloadBlob(blob, `wordcloud_${new Date().toISOString().slice(0, 10)}.png`, 'image/png');
    this.statusMessage.set('PNG exportiert.');
  }

  private downloadBlob(data: Blob | string, filename: string, mimeType: string): void {
    const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : data;
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private readCssColor(variableName: string, fallback: string): string {
    const root = this.document.documentElement;
    const value = this.document.defaultView
      ?.getComputedStyle(root)
      .getPropertyValue(variableName)
      .trim();
    return value && value.length > 0 ? value : fallback;
  }
}
