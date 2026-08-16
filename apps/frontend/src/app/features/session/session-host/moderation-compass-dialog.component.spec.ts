import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { ModerationCompassDialogComponent } from './moderation-compass-dialog.component';
import type { ModerationCompassCard } from './moderation-compass';

describe('ModerationCompassDialogComponent', () => {
  function setup(
    cards: readonly ModerationCompassCard[],
    onSourceActivate: (source: ModerationCompassCard['sources'][number]) => void = vi.fn(),
  ) {
    const dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ModerationCompassDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: { cards: () => cards, onSourceActivate },
        },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    const fixture = TestBed.createComponent(ModerationCompassDialogComponent);
    fixture.detectChanges();
    return { fixture, dialogRef, onSourceActivate };
  }

  it('zeigt den Leerzustand ohne Signale', () => {
    const { fixture } = setup([]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Moderationskompass');
    expect(text).toContain('Sobald Fragen, Ergebnisse oder Blitzlicht da sind');
    expect(
      fixture.nativeElement.querySelector('.dialog-title-header__icon .moderation-compass-icon'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.moderation-compass-card')).toBeNull();
  });

  it('zeigt quellenbelegte Moderationskarten', () => {
    const { fixture } = setup([
      {
        kind: 'topics',
        sources: [{ kind: 'qa-term', label: 'Median · Wie berechnet man den Median?' }],
      },
      {
        kind: 'nextStep',
        nextStepReason: 'topics',
        sources: [{ kind: 'qa-term', label: 'Median · Wie berechnet man den Median?' }],
      },
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Häufige Themen');
    expect(text).toContain('Median · Wie berechnet man den Median?');
    expect(text).toContain('Nächster Schritt');
    expect(text).toContain('Fass die häufigsten Themen kurz zusammen.');
    expect(text).toContain(
      'Nur aus den Signalen dieser Session. Es ändert sich nichts von selbst.',
    );
  });

  it('zeigt Blitzlicht-Rückmeldungen mit eigenem Kartentitel', () => {
    const { fixture } = setup([
      {
        kind: 'tempo',
        title: 'Rückmeldungen',
        sources: [{ kind: 'tempo', label: 'Die Rückmeldungen sind geteilt.' }],
      },
      {
        kind: 'nextStep',
        nextStepReason: 'feedback',
        sources: [{ kind: 'tempo', label: 'Die Rückmeldungen sind geteilt.' }],
      },
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Rückmeldungen');
    expect(text).toContain('Sieh dir das Blitzlicht kurz an.');
    expect(
      fixture.nativeElement.querySelector('.moderation-compass-card__icon')?.textContent,
    ).toContain('thumbs_up_down');
  });

  it('macht Quellen klickbar und schließt den Dialog', () => {
    const source = {
      kind: 'qa-question' as const,
      label: 'Kommt Kapitel 4 in der Klausur vor?',
      target: { channel: 'qa' as const, questionId: '11111111-1111-4111-8111-111111111111' },
    };
    const { fixture, dialogRef, onSourceActivate } = setup([
      {
        kind: 'clarification',
        tone: 'caution',
        sources: [source],
      },
    ]);

    const button = fixture.nativeElement.querySelector(
      '.moderation-compass-card__source-button',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-tone="caution"]')).not.toBeNull();
    button?.click();

    expect(onSourceActivate).toHaveBeenCalledWith(source);
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });
});
