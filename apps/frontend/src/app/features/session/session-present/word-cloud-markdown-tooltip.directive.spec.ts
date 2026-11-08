import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import {
  WordCloudMarkdownTooltipDirective,
  renderWordCloudTooltipMarkdown,
  trustWordCloudTooltipHtml,
} from './word-cloud-markdown-tooltip.directive';

describe('renderWordCloudTooltipMarkdown', () => {
  it('rendert Markdown und KaTeX statt der Rohzeichen', () => {
    const html = renderWordCloudTooltipMarkdown('**Steigung** $a^2$');
    expect(html).toContain('<strong>Steigung</strong>');
    expect(html).toContain('katex');
    expect(html).not.toContain('$a^2$');
  });
});

@Component({
  selector: 'app-tooltip-host',
  standalone: true,
  imports: [WordCloudMarkdownTooltipDirective],
  template: `<button type="button" [appWordCloudMarkdownTooltip]="blocks">Wort</button>`,
})
class TooltipHost {
  blocks: {
    kind: 'text' | 'markdown';
    text?: string;
    html?: ReturnType<typeof trustWordCloudTooltipHtml>;
  }[] = [];
}

describe('WordCloudMarkdownTooltipDirective', () => {
  it('verknüpft den fokussierten Auslöser mit dem Tooltip und öffnet ihn per Touch', () => {
    const fixture = TestBed.createComponent(TooltipHost);
    fixture.componentInstance.blocks = [
      { kind: 'text', text: 'Nennungen: 2' },
      {
        kind: 'markdown',
        html: trustWordCloudTooltipHtml(TestBed.inject(DomSanitizer), '**Steigung**'),
      },
    ];
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    button.focus();
    fixture.detectChanges();

    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const tooltip = document.getElementById(describedBy!);
    expect(tooltip?.getAttribute('role')).toBe('tooltip');
    expect(tooltip?.textContent).toContain('Nennungen: 2');
    expect(tooltip?.textContent).toContain('Steigung');

    button.blur();
    fixture.detectChanges();
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    expect(document.getElementById(describedBy!)).toBeNull();

    button.dispatchEvent(new Event('touchstart'));
    fixture.detectChanges();
    const touchId = button.getAttribute('aria-describedby');
    expect(document.getElementById(touchId!)?.getAttribute('role')).toBe('tooltip');

    button.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(button.getAttribute('aria-describedby')).toBe(touchId);
  });

  it('schließt einen Hover-Tooltip bei einem Mausklick außerhalb', () => {
    const fixture = TestBed.createComponent(TooltipHost);
    fixture.componentInstance.blocks = [{ kind: 'text', text: 'Nennungen: 2' }];
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    button.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    const tooltipId = button.getAttribute('aria-describedby');
    expect(document.getElementById(tooltipId!)).not.toBeNull();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();

    expect(button.hasAttribute('aria-describedby')).toBe(false);
    expect(document.getElementById(tooltipId!)).toBeNull();
  });
});
