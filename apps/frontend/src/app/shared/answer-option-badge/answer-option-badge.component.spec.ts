import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AnswerOptionBadgeComponent } from './answer-option-badge.component';

describe('AnswerOptionBadgeComponent', () => {
  it('zeichnet Single-Choice-Badges als einheitliches SVG-Kreis-Symbol', () => {
    const fixture = TestBed.createComponent(AnswerOptionBadgeComponent);
    fixture.componentRef.setInput('index', 2);
    fixture.componentRef.setInput('questionType', 'SINGLE_CHOICE');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const svg = host.querySelector('svg');

    expect(host.getAttribute('data-answer-shape')).toBe('circle');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('circle')).not.toBeNull();
    expect(svg?.classList.contains('answer-option-badge__icon')).toBe(true);
  });

  it('faellt bei deaktivierter Typanzeige auf die gemischte Badge-Folge zurueck', () => {
    const fixture = TestBed.createComponent(AnswerOptionBadgeComponent);
    fixture.componentRef.setInput('index', 0);
    fixture.componentRef.setInput('questionType', 'SINGLE_CHOICE');
    fixture.componentRef.setInput('showTypeIndicator', false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).getAttribute('data-answer-shape')).toBe(
      'triangle',
    );
  });

  it('zeichnet ab der siebten Antwort Kreuz und Herz statt weiterer Vielecke', () => {
    const plus = TestBed.createComponent(AnswerOptionBadgeComponent);
    plus.componentRef.setInput('index', 6);
    plus.componentRef.setInput('questionType', 'SURVEY');
    plus.detectChanges();
    const heart = TestBed.createComponent(AnswerOptionBadgeComponent);
    heart.componentRef.setInput('index', 7);
    heart.componentRef.setInput('questionType', 'SURVEY');
    heart.detectChanges();

    const plusHost = plus.nativeElement as HTMLElement;
    const heartHost = heart.nativeElement as HTMLElement;
    expect(plusHost.getAttribute('data-answer-shape')).toBe('plus');
    expect(heartHost.getAttribute('data-answer-shape')).toBe('heart');
    expect(plusHost.querySelector('path')?.getAttribute('d')).not.toBe(
      heartHost.querySelector('path')?.getAttribute('d'),
    );
  });
});
