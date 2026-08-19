import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { ModerationCompassDialogComponent } from './moderation-compass-dialog.component';
import type { ModerationCompassCard } from './moderation-compass';

describe('ModerationCompassDialogComponent', () => {
  function setup(
    cards: readonly ModerationCompassCard[],
    onSourceActivate: (source: ModerationCompassCard['sources'][number]) => void = vi.fn(),
    analysisMode:
      'rule-based' | 'disabled' | 'pending' | 'uncertain' | 'failed' | 'classified' = 'rule-based',
  ) {
    const dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ModerationCompassDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: { cards: () => cards, analysisMode, onSourceActivate },
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
    expect(text).toContain('Dein Live-Überblick über Quiz, Q&A und Blitzlicht.');
    expect(text).toContain('Du entscheidest, welche Themen behandelt werden.');
    expect(text).toContain(
      'Hier erscheinen wichtige Trends und Auswertungen, sobald die Teilnehmenden aktiv werden.',
    );
    expect(text).toContain('Einschätzung aus den sichtbaren Live-Signalen.');
    expect(text).not.toContain('Die KI-Analyse ist aus.');
    expect(
      fixture.nativeElement.querySelector('.dialog-title-header__icon .moderation-compass-icon'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.moderation-compass-card')).toBeNull();
  });

  it('zeigt quellenbelegte Moderationskarten', () => {
    const { fixture } = setup([
      {
        kind: 'topics',
        nextStepReason: 'topics',
        sources: [{ kind: 'qa-term', label: 'Median · Wie berechnet man den Median?' }],
      },
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Häufige Themen');
    expect(text).toContain('Median · Wie berechnet man den Median?');
    expect(text).toContain('Nächster Schritt');
    expect(text).toContain('Fass die häufigsten Themen kurz zusammen.');
    expect(text).toContain('Einschätzung aus den sichtbaren Live-Signalen.');
    expect(fixture.nativeElement.querySelectorAll('.moderation-compass-card')).toHaveLength(1);
    expect(
      fixture.nativeElement.querySelectorAll('.moderation-compass-card__sources li'),
    ).toHaveLength(1);
  });

  it('zeigt den ruhigen Zustand wenn die Analyse aus ist', () => {
    const { fixture } = setup([], vi.fn(), 'disabled');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Die KI-Analyse ist aus. Es bleibt die regelbasierte Einschätzung.');
    expect(text).not.toContain('Einschätzung aus den sichtbaren Live-Signalen.');
  });

  it('zeigt pending zurückhaltend', () => {
    const { fixture } = setup([], vi.fn(), 'pending');
    expect(fixture.nativeElement.textContent).toContain(
      'Themenkategorien werden noch ermittelt. Es bleibt die regelbasierte Einschätzung.',
    );
  });

  it('zeigt uncertain zurückhaltend', () => {
    const { fixture } = setup([], vi.fn(), 'uncertain');
    expect(fixture.nativeElement.textContent).toContain(
      'Die KI-Kategorien sind unsicher. Es bleibt die regelbasierte Einschätzung.',
    );
  });

  it('zeigt failed zurückhaltend', () => {
    const { fixture } = setup([], vi.fn(), 'failed');
    expect(fixture.nativeElement.textContent).toContain(
      'Die KI-Analyse ist gerade nicht verfügbar. Es bleibt die regelbasierte Einschätzung.',
    );
  });

  it('zeigt Blitzlicht-Rückmeldungen mit eigenem Kartentitel', () => {
    const { fixture } = setup([
      {
        kind: 'tempo',
        title: 'Rückmeldungen',
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

  it('zeigt für Umfragen keinen Lösungshinweis', () => {
    const { fixture } = setup([
      {
        kind: 'clarification',
        nextStepReason: 'quiz-survey',
        sources: [{ kind: 'quiz-result', label: 'Häufigste Antwort: Ganz okay' }],
      },
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Fass kurz die Antwortverteilung zusammen.');
    expect(text).not.toContain('Erkläre kurz die Lösung');
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
