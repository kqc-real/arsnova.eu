import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { FoyerEntranceLayerComponent } from './foyer-entrance-layer.component';

describe('FoyerEntranceLayerComponent', () => {
  const motion = {
    enterDurationMs: 1800,
    presenceMs: 3600,
    settleDelayMs: 1200,
    badgeDelayMs: 0,
    badgePresenceMs: 1500,
    pulseDelayMs: 1900,
  };

  it('rendert kompakte Chips mit Emoji und Text in einer dekorativen Layer', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [FoyerEntranceLayerComponent],
    }).createComponent(FoyerEntranceLayerComponent);

    fixture.componentRef.setInput('chips', [
      {
        id: 'chip-1',
        teamId: null,
        kind: 'emoji-with-text',
        fullLabel: 'Faultier Fritzi',
        ariaLabel: 'Faultier Fritzi',
        emoji: '🦥',
        text: 'Frit…',
        sequence: 0,
        delayMs: 0,
        lane: 1,
        direction: 'left',
        ...motion,
      },
      {
        id: 'chip-2',
        teamId: null,
        kind: 'anonymous',
        fullLabel: '',
        ariaLabel: 'Teilnehmende Person',
        emoji: null,
        text: '?',
        sequence: 1,
        delayMs: 0,
        lane: 2,
        direction: 'right',
        ...motion,
      },
    ]);
    fixture.detectChanges();

    const layer = fixture.nativeElement.querySelector('.foyer-entrance-layer') as HTMLElement;
    const shells = Array.from(
      fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip-shell'),
    ) as HTMLElement[];

    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.className).toContain('foyer-entrance-layer--active');
    expect(shells).toHaveLength(2);
    expect(shells[1].className).toContain('foyer-entrance-layer__chip-shell--from-right');
    expect(shells[0].style.getPropertyValue('--foyer-z-order')).toBe('0');
    expect(shells[1].style.getPropertyValue('--foyer-z-order')).toBe('1');
    expect(shells[0].style.getPropertyValue('--foyer-delay-ms')).toBe('0ms');
    expect(shells[0].style.getPropertyValue('--foyer-overlay-inline-start')).toBe('50%');
    expect(shells[1].style.getPropertyValue('--foyer-overlay-block-start')).toBe(
      'calc(1.15rem + (var(--foyer-lane, 0) * 0.52rem))',
    );
    expect(shells[0].style.gridColumn).toBe('auto');
    expect(shells[1].style.gridRow).toBe('auto');
    expect(fixture.nativeElement.textContent ?? '').toContain('Frit…');
    expect(fixture.nativeElement.textContent ?? '').toContain('?');
    expect(
      fixture.nativeElement.querySelector('.foyer-entrance-layer__chip-emoji')?.textContent,
    ).toBe('🦥');
  });

  it('markiert Sammelchips mit einer eigenen ruhigen Summary-Klasse', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [FoyerEntranceLayerComponent],
    }).createComponent(FoyerEntranceLayerComponent);

    fixture.componentRef.setInput('chips', [
      {
        id: 'chip-summary',
        teamId: 'team-a',
        summary: true,
        kind: 'text',
        fullLabel: '+3',
        ariaLabel: '+3',
        emoji: null,
        text: '+3',
        sequence: 2,
        delayMs: 0,
        lane: 0,
        direction: 'right',
        ...motion,
      },
    ]);
    fixture.detectChanges();

    const shell = fixture.nativeElement.querySelector(
      '.foyer-entrance-layer__chip-shell',
    ) as HTMLElement | null;
    const chip = fixture.nativeElement.querySelector(
      '.foyer-entrance-layer__chip',
    ) as HTMLElement | null;

    expect(shell?.className).toContain('foyer-entrance-layer__chip-shell--summary');
    expect(chip?.className).toContain('foyer-entrance-layer__chip--summary');
    expect(chip?.textContent?.trim()).toBe('+3');
  });

  it('markiert die Layer ohne Chips nicht als aktiv', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [FoyerEntranceLayerComponent],
    }).createComponent(FoyerEntranceLayerComponent);

    fixture.componentRef.setInput('chips', []);
    fixture.detectChanges();

    const layer = fixture.nativeElement.querySelector('.foyer-entrance-layer') as HTMLElement;

    expect(layer.className).not.toContain('foyer-entrance-layer--active');
  });

  it('aktiviert die Overlay-Variante bei gesetztem Input', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [FoyerEntranceLayerComponent],
    }).createComponent(FoyerEntranceLayerComponent);

    fixture.componentRef.setInput('chips', [
      {
        id: 'chip-overlay',
        teamId: 'team-a',
        kind: 'emoji-with-text',
        fullLabel: 'Neu im Team',
        ariaLabel: 'Neu im Team',
        emoji: '✨',
        text: 'Neu',
        sequence: 0,
        delayMs: 0,
        lane: 0,
        direction: 'left',
        ...motion,
      },
    ]);
    fixture.componentRef.setInput('overlay', true);
    fixture.detectChanges();

    const layer = fixture.nativeElement.querySelector('.foyer-entrance-layer') as HTMLElement;
    const shell = fixture.nativeElement.querySelector(
      '.foyer-entrance-layer__chip-shell',
    ) as HTMLElement;

    expect(layer.className).toContain('foyer-entrance-layer--overlay');
    expect(shell.style.getPropertyValue('--foyer-overlay-inline-start')).toBe('50%');
    expect(shell.style.getPropertyValue('--foyer-overlay-block-start')).toBe('50%');
    expect(shell.style.getPropertyValue('--foyer-overlay-travel-x')).toBe(
      'calc(-1 * max(48vw, 32rem))',
    );
    expect(shell.style.getPropertyValue('--foyer-overlay-travel-y')).toBe(
      'calc(-1 * max(20vh, 10rem))',
    );
    expect(shell.style.gridColumn).toBe('2');
    expect(shell.style.gridRow).toBe('2');
  });

  it('zeigt bei overlay-emoji-only Chips ein separates Namens-Badge rechts neben dem Icon', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [FoyerEntranceLayerComponent],
    }).createComponent(FoyerEntranceLayerComponent);

    fixture.componentRef.setInput('chips', [
      {
        id: 'chip-animal',
        teamId: 'team-a',
        kind: 'emoji-only',
        fullLabel: 'Mintgrüne Eidechse',
        ariaLabel: 'Mintgrüne Eidechse',
        emoji: '🦎',
        text: '',
        sequence: 0,
        delayMs: 0,
        lane: 0,
        direction: 'left',
        ...motion,
      },
    ]);
    fixture.componentRef.setInput('overlay', true);
    fixture.detectChanges();

    const chipText = fixture.nativeElement.querySelector('.foyer-entrance-layer__chip-text');
    const badge = fixture.nativeElement.querySelector(
      '.foyer-entrance-layer__name-badge',
    ) as HTMLElement | null;

    expect(chipText).toBeNull();
    expect(badge?.textContent?.trim()).toBe('Mintgrüne Eidechse');
  });

  it('zeigt bei verkuerzten Text-Chips ebenfalls ein separates Namens-Badge', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [FoyerEntranceLayerComponent],
    }).createComponent(FoyerEntranceLayerComponent);

    fixture.componentRef.setInput('chips', [
      {
        id: 'chip-scientist',
        teamId: 'team-a',
        kind: 'text',
        fullLabel: 'Barbara McClintock',
        ariaLabel: 'Barbara McClintock',
        emoji: null,
        text: 'Barbara',
        sequence: 0,
        delayMs: 0,
        lane: 0,
        direction: 'left',
        ...motion,
      },
    ]);
    fixture.componentRef.setInput('overlay', true);
    fixture.detectChanges();

    const chipText = fixture.nativeElement.querySelector('.foyer-entrance-layer__chip-text');
    const badge = fixture.nativeElement.querySelector(
      '.foyer-entrance-layer__name-badge',
    ) as HTMLElement | null;

    expect(chipText?.textContent?.trim()).toBe('Barbara');
    expect(badge?.textContent?.trim()).toBe('Barbara McClintock');
  });

  it('spiegelt das Namens-Badge auf der rechten Teamseite nach innen', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [FoyerEntranceLayerComponent],
    }).createComponent(FoyerEntranceLayerComponent);

    fixture.componentRef.setInput('chips', [
      {
        id: 'chip-right',
        teamId: 'team-b',
        kind: 'emoji-only',
        fullLabel: 'Schwarze Katze',
        ariaLabel: 'Schwarze Katze',
        emoji: '🐈‍⬛',
        text: '',
        sequence: 1,
        delayMs: 0,
        lane: 2,
        direction: 'right',
        ...motion,
      },
    ]);
    fixture.componentRef.setInput('overlay', true);
    fixture.detectChanges();

    const shell = fixture.nativeElement.querySelector(
      '.foyer-entrance-layer__chip-shell',
    ) as HTMLElement | null;
    const content = fixture.nativeElement.querySelector(
      '.foyer-entrance-layer__content',
    ) as HTMLElement | null;
    const badge = fixture.nativeElement.querySelector(
      '.foyer-entrance-layer__name-badge',
    ) as HTMLElement | null;

    expect(shell?.style.gridColumn).toBe('2');
    expect(content?.className).toContain('foyer-entrance-layer__content--badge-before');
    expect(badge).not.toBeNull();
  });

  it('zeigt das Namens-Badge erst nach Chip-Delay plus Badge-Delay', async () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.configureTestingModule({
        imports: [FoyerEntranceLayerComponent],
      }).createComponent(FoyerEntranceLayerComponent);

      fixture.componentRef.setInput('chips', [
        {
          id: 'chip-delayed-name',
          teamId: 'team-a',
          kind: 'text',
          fullLabel: 'Barbara McClintock',
          ariaLabel: 'Barbara McClintock',
          emoji: null,
          text: 'Barbara',
          sequence: 0,
          delayMs: 5400,
          lane: 0,
          direction: 'left',
          ...motion,
          badgeDelayMs: 2140,
        },
      ]);
      fixture.componentRef.setInput('overlay', true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.foyer-entrance-layer__name-badge')).toBeNull();

      await vi.advanceTimersByTimeAsync(7539);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.foyer-entrance-layer__name-badge')).toBeNull();

      await vi.advanceTimersByTimeAsync(1);
      fixture.detectChanges();
      expect(
        fixture.nativeElement
          .querySelector('.foyer-entrance-layer__name-badge')
          ?.textContent?.trim(),
      ).toBe('Barbara McClintock');
    } finally {
      vi.useRealTimers();
    }
  });

  it('blendet Overlay-Namens-Badges nach ihrer Presence-Dauer wieder aus', async () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.configureTestingModule({
        imports: [FoyerEntranceLayerComponent],
      }).createComponent(FoyerEntranceLayerComponent);

      fixture.componentRef.setInput('chips', [
        {
          id: 'chip-temporary-badge',
          teamId: 'team-a',
          kind: 'text',
          fullLabel: 'Barbara McClintock',
          ariaLabel: 'Barbara McClintock',
          emoji: null,
          text: 'Barbara',
          sequence: 0,
          delayMs: 0,
          lane: 0,
          direction: 'left',
          ...motion,
          badgeDelayMs: 120,
          badgePresenceMs: 240,
        },
      ]);
      fixture.componentRef.setInput('overlay', true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.foyer-entrance-layer__name-badge')).toBeNull();

      await vi.advanceTimersByTimeAsync(120);
      fixture.detectChanges();
      expect(
        fixture.nativeElement
          .querySelector('.foyer-entrance-layer__name-badge')
          ?.textContent?.trim(),
      ).toBe('Barbara McClintock');

      await vi.advanceTimersByTimeAsync(240);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.foyer-entrance-layer__name-badge')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
