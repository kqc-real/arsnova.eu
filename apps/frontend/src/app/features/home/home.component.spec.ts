/**
 * Unit-Tests für HomeComponent (Session-Code, Navigation, Controls, Preset-Integration).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HomeComponent } from './home.component';
import { QuizStoreService } from '../quiz/data/quiz-store.service';

const { setFeedbackHostTokenMock } = vi.hoisted(() => ({
  setFeedbackHostTokenMock: vi.fn(),
}));

vi.mock('../../core/feedback-host-token', () => ({
  setFeedbackHostToken: setFeedbackHostTokenMock,
}));

vi.mock('../../core/trpc.client', () => ({
  setHostToken: vi.fn(),
  trpc: {
    health: {
      check: {
        query: vi.fn().mockResolvedValue({
          status: 'ok',
          redis: 'ok',
          timestamp: new Date().toISOString(),
          version: '0.1.0',
        }),
      },
    },
    quickFeedback: {
      isActive: { query: vi.fn().mockResolvedValue({ active: false }) },
      isActiveForReconnect: { query: vi.fn().mockResolvedValue({ active: false }) },
      results: { query: vi.fn().mockRejectedValue(new Error('not found')) },
      create: { mutate: vi.fn().mockRejectedValue(new Error('not available')) },
    },
    motd: {
      getCurrent: { query: vi.fn().mockResolvedValue({ motd: null }) },
      recordInteraction: { mutate: vi.fn().mockResolvedValue({ ok: true }) },
    },
    session: {
      getInfo: {
        query: vi.fn().mockResolvedValue({
          id: 'sess-1',
          code: 'TEST01',
          type: 'QUIZ',
          status: 'LOBBY',
          serverTime: new Date().toISOString(),
          quizName: 'Test',
          title: null,
          participantCount: 0,
        }),
      },
      getInfoForReconnect: {
        query: vi.fn().mockResolvedValue({
          id: 'sess-1',
          code: 'TEST01',
          type: 'QUIZ',
          status: 'LOBBY',
          serverTime: new Date().toISOString(),
          quizName: 'Test',
          title: null,
          participantCount: 0,
        }),
      },
      create: {
        mutate: vi.fn().mockResolvedValue({
          id: 'sess-hero',
          code: 'HERO01',
          hostToken: 'host-token-hero',
        }),
      },
    },
  },
}));

const activeFixtures: Array<ReturnType<typeof TestBed.createComponent<HomeComponent>>> = [];

function createHomeFixture() {
  const fixture = TestBed.createComponent(HomeComponent);
  activeFixtures.push(fixture);
  return fixture;
}

function createHomeComponent(): HomeComponent {
  const fixture = createHomeFixture();
  return fixture.componentInstance;
}

function setRouteQueryParams(params: Record<string, string>) {
  TestBed.overrideProvider(ActivatedRoute, {
    useValue: {
      snapshot: {
        queryParamMap: convertToParamMap(params),
        data: {},
      },
    },
  });
}

function setRouteData(data: Record<string, unknown>) {
  TestBed.overrideProvider(ActivatedRoute, {
    useValue: {
      snapshot: {
        queryParamMap: convertToParamMap({}),
        data,
      },
    },
  });
}

describe('HomeComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
              data: {},
            },
          },
        },
      ],
    });
  });

  afterEach(() => {
    while (activeFixtures.length > 0) {
      activeFixtures.pop()?.destroy();
    }
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Accessibility', () => {
    it('stiehlt dem Skip-Link beim Start nicht per Autofokus die erste Tabposition', () => {
      const sentinel = document.createElement('button');
      document.body.append(sentinel);
      sentinel.focus();
      const fixture = createHomeFixture();

      fixture.detectChanges();
      vi.advanceTimersByTime(200);

      expect(document.activeElement).toBe(sentinel);
      sentinel.remove();
    });

    it('verwendet für den Session-Code nur das native Eingabefeld als Tabstopp', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      const segments = fixture.nativeElement.querySelector('.home-code-segments') as HTMLElement;
      const input = segments.querySelector('.home-code-segments__input') as HTMLInputElement;

      expect(segments.hasAttribute('tabindex')).toBe(false);
      expect(input).not.toBeNull();
    });

    it('fokussiert die Code-Eingabe nach der expliziten Aktion „Code eingeben“', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector(
        '.home-code-segments__input',
      ) as HTMLInputElement;
      const focusSpy = vi.spyOn(input, 'focus');
      const action = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button'),
      ).find((button) => button.textContent?.includes('Code eingeben'));

      action?.click();

      expect(action).toBeDefined();
      expect(document.activeElement).toBe(input);
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: false });
    });

    it('fokussiert „Code eingeben“ nach Locale-Reload', () => {
      const animationFrames: FrameRequestCallback[] = [];
      vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn((callback: FrameRequestCallback) => {
          animationFrames.push(callback);
          return animationFrames.length;
        }),
      );
      sessionStorage.setItem('arsnova-locale-reload-focus', 'home-code-enter');
      const fixture = createHomeFixture();
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector(
        '.home-hero-code-enter',
      ) as HTMLButtonElement;
      const focusSpy = vi.spyOn(button, 'focus');

      const runFrames = (): void => {
        const callbacks = animationFrames.splice(0);
        for (const cb of callbacks) cb(0);
      };
      runFrames();
      runFrames();

      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      expect(sessionStorage.getItem('arsnova-locale-reload-focus')).toBeNull();
    });

    it('fokussiert am dedizierten Join-Einstieg auf Geräten ohne groben Primärzeiger', () => {
      const sentinel = document.createElement('button');
      document.body.append(sentinel);
      sentinel.focus();
      const animationFrames: FrameRequestCallback[] = [];
      vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn((callback: FrameRequestCallback) => {
          animationFrames.push(callback);
          return animationFrames.length;
        }),
      );
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      setRouteData({ focusSessionCode: true });
      const matchMedia = vi.fn().mockReturnValue({ matches: false });
      vi.stubGlobal('matchMedia', matchMedia);
      const fixture = createHomeFixture();
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector(
        '.home-code-segments__input',
      ) as HTMLInputElement;
      const focusSpy = vi.spyOn(input, 'focus');
      const runAnimationFrame = (timestamp: number): void => {
        const callbacks = animationFrames.splice(0);
        callbacks.forEach((callback) => callback(timestamp));
      };

      runAnimationFrame(0);
      expect(document.activeElement).toBe(sentinel);
      runAnimationFrame(16);

      expect(matchMedia).toHaveBeenCalledWith('(pointer: coarse)');
      expect(document.activeElement).toBe(input);
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: false });
      sentinel.remove();
    });

    it('öffnet am dedizierten Join-Einstieg auf Mobilgeräten nicht ungefragt die Tastatur', () => {
      const sentinel = document.createElement('button');
      document.body.append(sentinel);
      sentinel.focus();
      setRouteData({ focusSessionCode: true });
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
      const fixture = createHomeFixture();

      fixture.detectChanges();
      vi.runOnlyPendingTimers();

      expect(document.activeElement).toBe(sentinel);
      sentinel.remove();
    });

    it('leitet den Accessible Name des Join-Buttons aus seinem sichtbaren Text ab', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.home-cta') as HTMLButtonElement;

      expect(button.hasAttribute('aria-label')).toBe(false);
      expect(button.textContent).toContain("Los geht's");
    });

    it('stellt Hero und Kartentitel als programmatische Überschriften bereit', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      const hero = fixture.nativeElement.querySelector('h1.home-hero') as HTMLHeadingElement;
      const cardTitles = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLHeadingElement>('h2.home-card__title'),
      ).map((heading) => heading.textContent?.replace(/\s+/g, ' ').trim());

      expect(hero).not.toBeNull();
      expect(hero.textContent).toMatch(/Quiz/);
      expect(cardTitles).toEqual(
        expect.arrayContaining([
          'Mitmachen',
          'Live mit einem Klick',
          'Quiz vorbereiten oder starten',
        ]),
      );
    });
  });

  describe('isPlayfulPreset', () => {
    it('ist true im Standard-Preset Spielerisch', () => {
      const comp = createHomeComponent();
      expect(comp.isPlayfulPreset()).toBe(true);
    });

    it('ist false nach Umschalten auf Seriös', () => {
      const comp = createHomeComponent();
      comp.themePreset.setPreset('serious');
      expect(comp.isPlayfulPreset()).toBe(false);
    });

    it('zeigt keine dekorative Schritt-Pills oder Bühnen-Rotation unter dem Hero', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.home-step-trail')).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-step-chip')).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-stage-rotator')).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-hero-serious-tagline')).toBeNull();
      expect(
        fixture.nativeElement.querySelector('.home-hero-usp--secondary')?.textContent,
      ).toContain('Ohne Anmeldung');
      const codeEnterButtons = Array.from(fixture.nativeElement.querySelectorAll('button')).filter(
        (button) => button.textContent?.includes('Code eingeben'),
      );
      expect(codeEnterButtons).toHaveLength(1);

      fixture.componentInstance.themePreset.setPreset('serious');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.home-hero-serious-tagline')).toBeNull();
    });

    it('zeigt die Mitmachen-Karte mit einem Titel ohne Logo-Wiederholung', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      const joinCard = fixture.nativeElement.querySelector(
        '#participant-entry',
      ) as HTMLElement | null;
      expect(joinCard).not.toBeNull();
      expect(joinCard?.querySelector('.home-card__brand-repeat')).toBeNull();
      expect(joinCard?.querySelector('.home-card__title')?.textContent?.trim()).toBe('Mitmachen');
      expect(joinCard?.textContent).not.toContain('Dabei sein');
      expect(joinCard?.textContent).toContain('Session-Code');
      expect(joinCard?.textContent).toContain("Los geht's");

      fixture.componentInstance.themePreset.setPreset('serious');
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('#participant-entry .home-card__brand-repeat'),
      ).toBeNull();
      expect(
        fixture.nativeElement
          .querySelector('#participant-entry .home-card__title')
          ?.textContent?.trim(),
      ).toBe('Mitmachen');
    });

    it('wendet Hero-Preset-Wechsel per Tastatur-aktivierbarem Button an', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();
      const themePreset = fixture.componentInstance.themePreset;
      themePreset.setPreset('spielerisch', { silent: true });
      fixture.detectChanges();

      const groupEl = fixture.nativeElement.querySelector(
        '.home-hero-preset-toggle',
      ) as HTMLElement;
      expect(groupEl).toBeTruthy();
      const buttons = Array.from(
        groupEl.querySelectorAll('button.home-hero-preset-toggle__btn'),
      ) as HTMLButtonElement[];
      expect(buttons).toHaveLength(2);
      for (const button of buttons) {
        expect(button.tabIndex).toBeGreaterThanOrEqual(0);
        expect(button.getAttribute('tabindex')).not.toBe('-1');
      }

      buttons[1].focus();
      buttons[1].click();
      fixture.detectChanges();

      expect(themePreset.preset()).toBe('serious');
      expect(document.documentElement.classList.contains('preset-playful')).toBe(false);
      expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    });

    it('stilisiert Hero-Preset-Fokus direkt am Button', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');
      expect(scss).toContain('.home-hero-preset-toggle__btn');
      expect(scss).toMatch(/home-hero-preset-toggle__btn[\s\S]*?&:focus-visible\s*\{/);
      expect(scss).not.toContain('mat-button-toggle-button:focus-visible');
      expect(scss).not.toContain('mat-button-toggle:focus-within');
    });

    it('lässt die Preset-Buttons abhängig von ihrer Inhaltsbreite umbrechen', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');

      expect(scss).toMatch(/home-preset-option\s*\{[\s\S]*?white-space:\s*nowrap/);
      expect(scss).toMatch(/\.home-hero-preset-toggle\s*\{[^}]*flex-wrap:\s*wrap/);
      expect(scss).toMatch(/\.home-hero-preset-toggle__btn\s*\{[^}]*flex:\s*1 0 max-content/);
      expect(scss).not.toContain('@media (max-width: 359px)');
    });
  });

  describe('isValidSessionCode', () => {
    it('akzeptiert gültigen 6-stelligen alphanumerischen Code', () => {
      const comp = createHomeComponent();
      comp.sessionCode.set('ABC123');
      expect(comp.isValidSessionCode()).toBe(true);
    });

    it('lehnt zu kurzen Code ab', () => {
      const comp = createHomeComponent();
      comp.sessionCode.set('ABC');
      expect(comp.isValidSessionCode()).toBe(false);
    });

    it('lehnt zu langen Code ab', () => {
      const comp = createHomeComponent();
      comp.sessionCode.set('ABCDEFG');
      expect(comp.isValidSessionCode()).toBe(false);
    });

    it('lehnt Kleinbuchstaben ab', () => {
      const comp = createHomeComponent();
      comp.sessionCode.set('abc123');
      expect(comp.isValidSessionCode()).toBe(false);
    });

    it('lehnt Sonderzeichen ab', () => {
      const comp = createHomeComponent();
      comp.sessionCode.set('ABC-12');
      expect(comp.isValidSessionCode()).toBe(false);
    });

    it('lehnt leeren String ab', () => {
      const comp = createHomeComponent();
      comp.sessionCode.set('');
      expect(comp.isValidSessionCode()).toBe(false);
    });
  });

  describe('Session-Code-Segmente (Template)', () => {
    it('zeigt keinen Erfolgs-Haken bereits für einen rein formal vollständigen Code', () => {
      const fixture = createHomeFixture();
      const el = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();

      fixture.componentInstance.sessionCode.set('ABC12');
      fixture.detectChanges();
      expect(el.querySelector('.home-code-segment__check')).toBeNull();

      fixture.componentInstance.sessionCode.set('ABC123');
      fixture.detectChanges();
      expect(el.querySelector('.home-code-segment__check')).toBeNull();
    });
  });

  describe('onSessionCodeInput', () => {
    it('normalisiert Eingabe zu Großbuchstaben', () => {
      const comp = createHomeComponent();
      const event = { target: { value: 'abc123' } } as unknown as Event;
      comp.onSessionCodeInput(event);
      expect(comp.sessionCode()).toBe('ABC123');
    });

    it('entfernt ungültige Zeichen', () => {
      const comp = createHomeComponent();
      const event = { target: { value: 'AB-C!1@2' } } as unknown as Event;
      comp.onSessionCodeInput(event);
      expect(comp.sessionCode()).toBe('ABC12');
    });

    it('kürzt auf maximal 6 Zeichen', () => {
      const comp = createHomeComponent();
      const event = { target: { value: 'ABCDEFGH' } } as unknown as Event;
      comp.onSessionCodeInput(event);
      expect(comp.sessionCode()).toBe('ABCDEF');
    });

    it('löscht joinError bei neuer Eingabe', () => {
      const comp = createHomeComponent();
      comp.joinError.set('Alter Fehler');
      const event = { target: { value: 'X' } } as unknown as Event;
      comp.onSessionCodeInput(event);
      expect(comp.joinError()).toBeNull();
    });
  });

  describe('joinSession', () => {
    it('setzt joinError bei ungültigem Code', async () => {
      const comp = createHomeComponent();
      comp.sessionCode.set('AB');
      await comp.joinSession();
      expect(comp.joinError()).toBeTruthy();
    });

    it('navigiert zu /join/:code bei gültigem Code', async () => {
      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.sessionCode.set('TEST01');
      await comp.joinSession();

      expect(navSpy).toHaveBeenCalledWith(['join', 'TEST01']);
    });

    it('nutzt den kombinierten Resolver ohne zweiten Session-Lookup', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.quickFeedback.isActive.query).mockResolvedValueOnce({
        active: false,
        sessionStatus: 'LOBBY',
      });
      vi.mocked(trpc.session.getInfo.query).mockClear();

      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.sessionCode.set('TEST01');
      await comp.joinSession();

      expect(trpc.quickFeedback.isActive.query).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionCode: 'TEST01',
          anonymousClientId: expect.any(String),
        }),
      );
      expect(trpc.session.getInfo.query).not.toHaveBeenCalled();
      expect(navSpy).toHaveBeenCalledWith(['join', 'TEST01']);
    });

    it('navigiert zur Blitzlicht-Abstimmung wenn eine aktive Runde existiert', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.quickFeedback.isActive.query).mockResolvedValueOnce({ active: true });

      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.sessionCode.set('QF1234');
      await comp.joinSession();

      expect(navSpy).toHaveBeenCalledWith(['feedback', 'QF1234', 'vote']);
    });

    it('speichert Code in recentSessionCodes', async () => {
      const comp = createHomeComponent();
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      comp.sessionCode.set('NEW001');
      await comp.joinSession();

      expect(comp.recentSessionCodes().some((r) => r.code === 'NEW001')).toBe(true);
    });

    it('prüft abgelaufene Recent-Codes ausschließlich über den Reconnect-Resolver', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.quickFeedback.isActive.query).mockClear();
      vi.mocked(trpc.quickFeedback.isActiveForReconnect.query).mockRejectedValueOnce(
        new Error('Session nicht gefunden.'),
      );
      const comp = createHomeComponent();
      comp.recentSessionCodes.set([{ code: 'OLD999', usedAt: Date.now() }]);

      await (
        comp as unknown as {
          validateRecentSessions: () => Promise<void>;
        }
      ).validateRecentSessions();

      expect(trpc.quickFeedback.isActiveForReconnect.query).toHaveBeenCalledWith({
        sessionCode: 'OLD999',
        anonymousClientId: expect.any(String),
      });
      expect(trpc.quickFeedback.isActive.query).not.toHaveBeenCalled();
      expect(comp.recentSessionCodes()).toEqual([]);
    });

    it('verhindert doppelten Join während isJoining', async () => {
      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.sessionCode.set('TEST01');
      comp.isJoining.set(true);
      await comp.joinSession();

      expect(navSpy).not.toHaveBeenCalled();
    });

    it('setzt joinError wenn getInfo Session nicht findet (Story 3.1)', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.getInfo.query).mockRejectedValueOnce(
        new Error('Session nicht gefunden.'),
      );

      const comp = createHomeComponent();
      comp.sessionCode.set('NOTFND');
      await comp.joinSession();

      expect(comp.joinError()).toBe('Session nicht gefunden.');
      expect(comp.sessionCode()).toBe('NOTFND');
    });

    it('markiert nach Lookup-Fehler den bestehenden Code fuer direkte Neueingabe', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.getInfo.query).mockRejectedValueOnce(
        new Error('Session nicht gefunden.'),
      );

      const fixture = createHomeFixture();
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      const input = fixture.nativeElement.querySelector(
        '.home-code-segments__input',
      ) as HTMLInputElement;

      comp.sessionCode.set('NOTFND');
      fixture.detectChanges();

      await comp.joinSession();
      vi.runOnlyPendingTimers();
      fixture.detectChanges();

      expect(comp.joinError()).toBe('Session nicht gefunden.');
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(6);
    });
  });

  describe('startQuickFeedback', () => {
    it('erstellt ein Blitzlicht und navigiert direkt zur Host-Ansicht', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.quickFeedback.create.mutate).mockResolvedValueOnce({
        feedbackId: 'qf:ABC123',
        sessionCode: 'ABC123',
        hostToken: 'feedback-owner-token',
      });

      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await comp.startQuickFeedback('TRUEFALSE_UNKNOWN');

      expect(trpc.quickFeedback.create.mutate).toHaveBeenCalledWith({
        type: 'TRUEFALSE_UNKNOWN',
      });
      expect(setFeedbackHostTokenMock).toHaveBeenCalledWith('ABC123', 'feedback-owner-token');
      expect(navSpy).toHaveBeenCalledWith(['feedback', 'ABC123']);
      expect(comp.quickFeedbackError()).toBeNull();
    });

    it('startet Tempo als Standalone-Blitzlicht über denselben Chip wie die anderen Formate', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.quickFeedback.create.mutate).mockResolvedValueOnce({
        feedbackId: 'qf:TMP123',
        sessionCode: 'TMP123',
        hostToken: 'tempo-owner-token',
      });

      const fixture = createHomeFixture();
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const tempoChip = fixture.nativeElement.querySelector(
        '#host-quick-feedback .home-feedback-chip[aria-label="Tempo"]',
      ) as HTMLButtonElement | null;

      expect(tempoChip).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.home-feedback-tempo-spotlight')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Tempo-Blitzlicht');
      expect(fixture.nativeElement.textContent).not.toContain('Tempo starten');

      await comp.startQuickFeedback('TEMPO');

      expect(trpc.quickFeedback.create.mutate).toHaveBeenCalledWith({
        type: 'TEMPO',
      });
      expect(setFeedbackHostTokenMock).toHaveBeenCalledWith('TMP123', 'tempo-owner-token');
      expect(navSpy).toHaveBeenCalledWith(['feedback', 'TMP123']);
    });
  });

  describe('openHeroHostTab', () => {
    it('prüft vorhandene oder kürzlich verwendete Codes über den Reconnect-Pfad', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.getInfo.query).mockClear();
      vi.mocked(trpc.session.getInfoForReconnect.query).mockClear();
      const comp = createHomeComponent();
      comp.sessionCode.set('TEST01');
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      await comp.openHeroHostTab('qa');

      expect(trpc.session.getInfoForReconnect.query).toHaveBeenCalledWith({
        code: 'TEST01',
        anonymousClientId: expect.any(String),
      });
      expect(trpc.session.getInfo.query).not.toHaveBeenCalled();
    });

    it('startet ohne vorhandenen Code eine neue Q&A-Host-Session', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-qa',
        code: 'QA1234',
        hostToken: 'qa-host-token',
      });

      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      await comp.openHeroHostTab('qa');

      expect(trpc.session.create.mutate).toHaveBeenCalledWith({
        type: 'QUIZ',
        qaEnabled: true,
        nicknameTheme: 'KINDERGARTEN',
        allowCustomNicknames: false,
        anonymousMode: false,
        teamMode: false,
        teamCount: null,
        teamAssignment: 'AUTO',
        teamNames: [],
      });
      expect(navigateSpy).toHaveBeenCalledWith('/session/QA1234/host?tab=qa');
      expect(comp.joinError()).toBeNull();
    });

    it('zeigt beim gedrosselten Q&A-Schnellstart die konkrete Wartezeit', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockRejectedValueOnce({
        message: 'Zu viele Session-Erstellungen. Bitte später erneut versuchen.',
        data: { retryAfterSeconds: 23 },
      });

      const comp = createHomeComponent();

      await comp.openHeroHostTab('qa');

      expect(comp.joinError()).toBe(
        'WICHTIG: Zu viele Session-Erstellungen. Bitte später erneut versuchen.\n' +
          'Bitte in 23 Sekunden erneut versuchen.',
      );
    });

    it('startet im seriösen Preset eine neue Q&A-Host-Session mit Oberstufen-Pseudonymen', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-qa',
        code: 'QA5678',
        hostToken: 'qa-host-token-2',
      });

      const comp = createHomeComponent();
      comp.themePreset.setPreset('serious');
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      await comp.openHeroHostTab('qa');

      expect(trpc.session.create.mutate).toHaveBeenCalledWith({
        type: 'QUIZ',
        qaEnabled: true,
        nicknameTheme: 'HIGH_SCHOOL',
        allowCustomNicknames: false,
        anonymousMode: false,
        teamMode: false,
        teamCount: null,
        teamAssignment: 'AUTO',
        teamNames: [],
      });
      expect(navigateSpy).toHaveBeenCalledWith('/session/QA5678/host?tab=qa');
      expect(comp.joinError()).toBeNull();
    });

    it('startet ohne vorhandenen Code eine neue Blitzlicht-Host-Session', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-qf',
        code: 'QF1234',
        hostToken: 'qf-host-token',
      });

      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      await comp.openHeroHostTab('quickFeedback');

      expect(trpc.session.create.mutate).toHaveBeenCalledWith({
        type: 'QUIZ',
        quickFeedbackEnabled: true,
        nicknameTheme: 'KINDERGARTEN',
        allowCustomNicknames: false,
        anonymousMode: false,
        teamMode: false,
        teamCount: null,
        teamAssignment: 'AUTO',
        teamNames: [],
      });
      expect(navigateSpy).toHaveBeenCalledWith('/session/QF1234/host?tab=quickFeedback');
      expect(comp.joinError()).toBeNull();
    });

    it('startet im seriösen Preset eine neue Blitzlicht-Host-Session mit Oberstufen-Pseudonymen', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-qf',
        code: 'QF5678',
        hostToken: 'qf-host-token-2',
      });

      const comp = createHomeComponent();
      comp.themePreset.setPreset('serious');
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      await comp.openHeroHostTab('quickFeedback');

      expect(trpc.session.create.mutate).toHaveBeenCalledWith({
        type: 'QUIZ',
        quickFeedbackEnabled: true,
        nicknameTheme: 'HIGH_SCHOOL',
        allowCustomNicknames: false,
        anonymousMode: false,
        teamMode: false,
        teamCount: null,
        teamAssignment: 'AUTO',
        teamNames: [],
      });
      expect(navigateSpy).toHaveBeenCalledWith('/session/QF5678/host?tab=quickFeedback');
      expect(comp.joinError()).toBeNull();
    });
  });

  describe('MOTD overlay', () => {
    it('unterdrückt MOTD auf Mobilgeräten beim ersten Startseiten-Besuch inklusive Reload', async () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
      const { trpc } = await import('../../core/trpc.client');
      const fixture = createHomeFixture();

      await fixture.componentInstance['loadMotdOverlay']();
      await fixture.componentInstance['loadMotdOverlay']();

      expect(vi.mocked(trpc.motd.getCurrent.query)).not.toHaveBeenCalled();
      expect(fixture.componentInstance.motd()).toBeNull();
    });

    it('zeigt MOTD auf Mobilgeräten nach einem späteren Besuch', async () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
      localStorage.setItem('arsnova-motd-mobile-home-seen', '1');
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 1,
          markdown: 'Hallo',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });
      const fixture = createHomeFixture();

      await fixture.componentInstance['loadMotdOverlay']();

      expect(vi.mocked(trpc.motd.getCurrent.query)).toHaveBeenCalled();
    });

    it('unterdrückt die MOTD am dedizierten Join-Einstieg', async () => {
      setRouteData({ focusSessionCode: true });
      const { trpc } = await import('../../core/trpc.client');

      const fixture = createHomeFixture();
      fixture.detectChanges();
      vi.runOnlyPendingTimers();

      expect(vi.mocked(trpc.motd.getCurrent.query)).not.toHaveBeenCalled();
      expect(fixture.componentInstance.motd()).toBeNull();
    });

    it('überspringt MOTD und leitet bei join-Query sofort in den Onboarding-Flow um', async () => {
      setRouteQueryParams({ join: 'abc123' });
      const { trpc } = await import('../../core/trpc.client');
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      const fixture = createHomeFixture();
      fixture.detectChanges();
      vi.runOnlyPendingTimers();
      await vi.waitUntil(() => navSpy.mock.calls.length === 1, {
        timeout: 1000,
        interval: 10,
      });

      expect(navSpy).toHaveBeenCalledWith(['join', 'ABC123'], { replaceUrl: true });
      expect(vi.mocked(trpc.motd.getCurrent.query)).not.toHaveBeenCalled();
    });

    it('unterbindet bei join-Query das Onboarding für bereits beendete Sessions', async () => {
      setRouteQueryParams({ join: 'abc123' });
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.getInfo.query).mockResolvedValueOnce({
        id: 'sess-finished',
        code: 'ABC123',
        type: 'QUIZ',
        status: 'FINISHED',
        serverTime: new Date().toISOString(),
        quizName: 'Test',
        title: null,
        participantCount: 0,
      });
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      const fixture = createHomeFixture();
      fixture.detectChanges();
      vi.runOnlyPendingTimers();
      await vi.waitUntil(
        () =>
          navSpy.mock.calls.length === 1 &&
          fixture.componentInstance.joinErrorSessionFinished() === true,
        {
          timeout: 1000,
          interval: 10,
        },
      );
      fixture.detectChanges();

      expect(navSpy).toHaveBeenCalledWith([], {
        replaceUrl: true,
        queryParams: {},
        queryParamsHandling: '',
      });
      expect(fixture.componentInstance.joinErrorSessionFinished()).toBe(true);
      expect(fixture.componentInstance.joinError()).toBe('Diese Session ist bereits beendet.');
      expect(fixture.componentInstance.sessionCode()).toBe('ABC123');
      expect(vi.mocked(trpc.motd.getCurrent.query)).not.toHaveBeenCalled();
    });

    it('rendert MOTD-Bilder relativ zur aktuellen Locale-Basis und hängt die contentVersion an', async () => {
      const baseEl =
        document.querySelector('base') ?? document.head.appendChild(document.createElement('base'));
      const previousBaseHref = baseEl.getAttribute('href');
      baseEl.setAttribute('href', '/de/');

      try {
        const { trpc } = await import('../../core/trpc.client');
        vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
          motd: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            contentVersion: 7,
            markdown: '![Banner](/assets/images/AI-REVOLUTION.png)',
            endsAt: '2099-12-31T12:00:00.000Z',
          },
        });

        const fixture = createHomeFixture();
        const comp = fixture.componentInstance;

        await comp['loadMotdOverlay']();

        const safeHtml = comp.motdBodyHtml() as unknown as {
          changingThisBreaksApplicationSecurity?: string;
        } | null;
        expect(safeHtml?.changingThisBreaksApplicationSecurity).toContain(
          '/de/assets/images/AI-REVOLUTION.png?cv=7',
        );
      } finally {
        if (previousBaseHref === null) {
          baseEl.removeAttribute('href');
        } else {
          baseEl.setAttribute('href', previousBaseHref);
        }
      }
    });

    it('markiert das Puzzle-Emoji einer Feature-MOTD als dekorativ', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'c0444444-c444-4c44-8c44-c04444444444',
          contentVersion: 1,
          markdown: '### 🧩 Neu: Zuordnen. Sortieren. Kategorisieren.\n\nText.',
          endsAt: '2027-03-31T23:59:59.999Z',
        },
      });
      const fixture = createHomeFixture();

      await fixture.componentInstance['loadMotdOverlay']();

      const safeHtml = fixture.componentInstance.motdBodyHtml() as unknown as {
        changingThisBreaksApplicationSecurity?: string;
      } | null;
      expect(safeHtml?.changingThisBreaksApplicationSecurity).toContain(
        '<span aria-hidden="true">🧩</span>',
      );
    });

    it('sperrt den Hintergrund und hält den Tastaturfokus im MOTD-Dialog', () => {
      const fixture = createHomeFixture();
      fixture.componentInstance.motd.set({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        contentVersion: 7,
        markdown: 'Meldung',
        endsAt: '2099-12-31T12:00:00.000Z',
      });
      fixture.detectChanges();

      const background = fixture.nativeElement.querySelector('.home-main') as HTMLElement;
      const dialog = fixture.nativeElement.querySelector('.home-motd-sheet') as HTMLElement;

      expect(background.hasAttribute('inert')).toBe(true);
      expect(dialog).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);
    });

    it('rendert MOTD nicht solange der Fokus in der Toolbar liegt', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 7,
          markdown: 'Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const toolbar = document.createElement('app-top-toolbar');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.textContent = 'Seriös';
      toolbar.append(toggle);
      document.body.append(toolbar);
      toggle.focus();
      expect(document.activeElement).toBe(toggle);

      const fixture = createHomeFixture();
      await fixture.componentInstance['loadMotdOverlay']();
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(fixture.componentInstance.motd()).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-motd-layer')).toBeNull();
      expect(document.activeElement).toBe(toggle);

      const outside = document.createElement('button');
      outside.type = 'button';
      outside.textContent = 'Außerhalb';
      document.body.append(outside);
      outside.focus();
      fixture.detectChanges();
      // restoreFocus-Grace (50ms) vor MOTD-Open abwarten
      await vi.advanceTimersByTimeAsync(260);
      fixture.detectChanges();

      expect(fixture.componentInstance.motd()).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.home-motd-layer')).not.toBeNull();

      toolbar.remove();
      outside.remove();
    });

    it('rendert MOTD nicht solange der Fokus auf Footer-Mehr liegt', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 7,
          markdown: 'Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const footer = document.createElement('footer');
      footer.className = 'app-footer';
      const more = document.createElement('button');
      more.type = 'button';
      more.setAttribute('data-footer-focus', 'footer-more');
      more.textContent = 'Mehr';
      footer.append(more);
      document.body.append(footer);
      more.focus();
      expect(document.activeElement).toBe(more);

      const fixture = createHomeFixture();
      await fixture.componentInstance['loadMotdOverlay']();
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(fixture.componentInstance.motd()).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-motd-layer')).toBeNull();
      expect(document.activeElement).toBe(more);

      const outside = document.createElement('button');
      outside.type = 'button';
      outside.textContent = 'Außerhalb';
      document.body.append(outside);
      outside.focus();
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(260);
      fixture.detectChanges();

      expect(fixture.componentInstance.motd()).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.home-motd-layer')).not.toBeNull();

      footer.remove();
      outside.remove();
    });

    it('öffnet aufgeschobenes MOTD nicht wenn Fokus nach Overlay kurz auf body und dann Footer-Mehr zurückkehrt', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 7,
          markdown: 'Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const footer = document.createElement('footer');
      footer.className = 'app-footer';
      const more = document.createElement('button');
      more.type = 'button';
      more.setAttribute('data-footer-focus', 'footer-more');
      more.textContent = 'Mehr';
      footer.append(more);
      document.body.append(footer);
      more.focus();

      const fixture = createHomeFixture();
      await fixture.componentInstance['loadMotdOverlay']();
      expect(fixture.componentInstance.motd()).toBeNull();

      const overlay = document.createElement('div');
      overlay.className = 'cdk-overlay-pane';
      const menuItem = document.createElement('button');
      menuItem.type = 'button';
      menuItem.textContent = 'Impressum';
      overlay.append(menuItem);
      document.body.append(overlay);
      menuItem.focus();
      expect(fixture.componentInstance.motd()).toBeNull();

      // MatMenu-Escape: Fokus kurz auf body, dann restoreFocus auf Mehr.
      document.body.setAttribute('tabindex', '-1');
      document.body.focus();
      document.body.removeAttribute('tabindex');
      more.focus();
      await vi.advanceTimersByTimeAsync(260);
      fixture.detectChanges();

      expect(fixture.componentInstance.motd()).toBeNull();
      expect(document.activeElement).toBe(more);

      footer.remove();
      overlay.remove();
    });

    it('öffnet aufgeschobenes MOTD nicht bei Fokus im Sprachmenü-Overlay', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 7,
          markdown: 'Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const toolbar = document.createElement('app-top-toolbar');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.textContent = 'Seriös';
      toolbar.append(toggle);
      document.body.append(toolbar);
      toggle.focus();

      const fixture = createHomeFixture();
      await fixture.componentInstance['loadMotdOverlay']();
      fixture.detectChanges();
      expect(fixture.componentInstance.motd()).toBeNull();

      const overlay = document.createElement('div');
      overlay.className = 'cdk-overlay-pane';
      const menuItem = document.createElement('button');
      menuItem.type = 'button';
      menuItem.textContent = 'Deutsch';
      overlay.append(menuItem);
      document.body.append(overlay);
      menuItem.focus();
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();

      expect(fixture.componentInstance.motd()).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-motd-layer')).toBeNull();
      expect(document.activeElement).toBe(menuItem);

      toolbar.remove();
      overlay.remove();
    });

    it('öffnet aufgeschobenes MOTD nicht bei Fokus im News-Archiv-Dialog', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 7,
          markdown: 'Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const toolbar = document.createElement('app-top-toolbar');
      const newsBtn = document.createElement('button');
      newsBtn.type = 'button';
      newsBtn.textContent = 'News';
      toolbar.append(newsBtn);
      document.body.append(toolbar);
      newsBtn.focus();

      const fixture = createHomeFixture();
      await fixture.componentInstance['loadMotdOverlay']();
      expect(fixture.componentInstance.motd()).toBeNull();

      const overlay = document.createElement('div');
      overlay.className = 'cdk-overlay-pane mat-mdc-dialog-panel';
      const dialogClose = document.createElement('button');
      dialogClose.type = 'button';
      dialogClose.textContent = 'Schließen';
      overlay.append(dialogClose);
      document.body.append(overlay);
      dialogClose.focus();
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();

      expect(fixture.componentInstance.motd()).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-motd-layer')).toBeNull();
      expect(document.activeElement).toBe(dialogClose);

      toolbar.remove();
      overlay.remove();
    });

    it('öffnet MOTD mit Fokus-Capture wenn der Fokus nicht in der Toolbar liegt', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 7,
          markdown: 'Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const fixture = createHomeFixture();
      await fixture.componentInstance['loadMotdOverlay']();
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(fixture.componentInstance.motd()).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.home-motd-layer')).not.toBeNull();
    });

    it('zieht nach MOTD-Dismiss nicht in die Code-Eingabe wenn bereits ein anderer Fokus existiert', async () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector(
        '.home-code-segments__input',
      ) as HTMLInputElement;
      const inputFocus = vi.spyOn(input, 'focus');

      const other = document.createElement('button');
      other.type = 'button';
      other.textContent = 'Anders';
      document.body.append(other);

      fixture.componentInstance['motdFocusReturn'] = null;
      fixture.componentInstance.motd.set({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        contentVersion: 7,
        markdown: 'Meldung',
        endsAt: '2099-12-31T12:00:00.000Z',
      });
      other.focus();
      fixture.componentInstance['clearMotdOverlay']();
      fixture.detectChanges();
      await Promise.resolve();

      expect(document.activeElement).toBe(other);
      expect(inputFocus).not.toHaveBeenCalled();
      other.remove();
    });

    it('setzt nach MOTD-Dismiss per Tastatur sichtbaren Fokus auf den Primaer-CTA', async () => {
      const skip = document.createElement('a');
      skip.href = '#main';
      skip.className = 'app-skip-link';
      skip.textContent = 'Zum Inhalt springen';
      document.body.prepend(skip);

      const fixture = createHomeFixture();
      fixture.componentInstance['motdFocusReturn'] = null;
      fixture.componentInstance.motd.set({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        contentVersion: 7,
        markdown: 'Meldung',
        endsAt: '2099-12-31T12:00:00.000Z',
      });
      fixture.detectChanges();

      const primaryAction = fixture.nativeElement.querySelector(
        '.home-hero-code-enter',
      ) as HTMLButtonElement;
      const closeInMotd = fixture.nativeElement.querySelector(
        '.home-motd-sheet button',
      ) as HTMLButtonElement | null;
      expect(closeInMotd).not.toBeNull();
      closeInMotd?.focus();
      expect(document.activeElement).toBe(closeInMotd);

      fixture.componentInstance['clearMotdOverlay']('keyboard');
      fixture.detectChanges();
      await Promise.resolve();

      expect(document.activeElement).toBe(primaryAction);
      expect(document.activeElement).not.toBe(skip);
      expect(primaryAction.classList.contains('cdk-keyboard-focused')).toBe(true);
      skip.remove();
    });

    it('kehrt vom automatisch überlagerten Code-Eingabefeld zum sichtbaren Primaer-CTA zurück', async () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      const input = fixture.nativeElement.querySelector(
        '.home-code-segments__input',
      ) as HTMLInputElement;
      input.focus();
      expect(document.activeElement).toBe(input);

      comp['openMotdOverlay'](
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 7,
          markdown: 'Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
        input,
      );
      fixture.detectChanges();
      document.body.setAttribute('tabindex', '-1');
      document.body.focus();
      document.body.removeAttribute('tabindex');
      expect(document.activeElement).toBe(document.body);
      comp['clearMotdOverlay']('mouse');
      fixture.detectChanges();
      await Promise.resolve();

      const primaryAction = fixture.nativeElement.querySelector(
        '.home-hero-code-enter',
      ) as HTMLButtonElement;
      expect(document.activeElement).toBe(primaryAction);
      expect(primaryAction.classList.contains('cdk-mouse-focused')).toBe(true);
    });

    it('zeigt nach Pointer-Dismiss keinen Tastatur-Fokusrahmen', async () => {
      const fixture = createHomeFixture();
      fixture.componentInstance['motdFocusReturn'] = null;
      fixture.componentInstance.motd.set({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        contentVersion: 7,
        markdown: 'Meldung',
        endsAt: '2099-12-31T12:00:00.000Z',
      });
      fixture.detectChanges();

      const primaryAction = fixture.nativeElement.querySelector(
        '.home-hero-code-enter',
      ) as HTMLButtonElement;
      fixture.componentInstance['clearMotdOverlay']('mouse');
      fixture.detectChanges();
      await Promise.resolve();

      expect(document.activeElement).toBe(primaryAction);
      expect(primaryAction.classList.contains('cdk-keyboard-focused')).toBe(false);
      expect(primaryAction.classList.contains('cdk-mouse-focused')).toBe(true);
    });

    it('schließt per Mausklick auch wenn Desktop-Safari keinen TouchEvent-Konstruktor anbietet', async () => {
      vi.stubGlobal('TouchEvent', undefined);
      const fixture = createHomeFixture();
      const comp = fixture.componentInstance;
      comp.motd.set({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        contentVersion: 7,
        markdown: 'Meldung',
        endsAt: '2099-12-31T12:00:00.000Z',
      });
      fixture.detectChanges();

      const ackButton = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.home-motd-sheet button'),
      ).find((button) => button.textContent?.includes('Alles klar'));
      expect(ackButton).toBeDefined();

      ackButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      fixture.detectChanges();
      await Promise.resolve();

      expect(comp.motd()).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-motd-sheet')).toBeNull();
      const primaryAction = fixture.nativeElement.querySelector(
        '.home-hero-code-enter',
      ) as HTMLButtonElement;
      expect(document.activeElement).toBe(primaryAction);
      expect(primaryAction.classList.contains('cdk-mouse-focused')).toBe(true);
    });

    it('definiert für den MOTD-Tastatur-Rücksprung einen sichtbaren Fokusrahmen', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');

      expect(scss).toMatch(
        /\.home-hero-code-enter\.cdk-keyboard-focused\s*\{[^}]*outline:\s*3px solid var\(--mat-sys-secondary\)/,
      );
      expect(scss).toMatch(
        /\.home-hero-code-enter:is\(\.cdk-mouse-focused, \.cdk-touch-focused\)\s*\{[^}]*--mat-focus-indicator-display:\s*none/,
      );
    });

    it('zeigt nach einem Overlay in derselben Sitzung keine weitere MOTD automatisch', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValue({
        motd: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 7,
          markdown: 'Erste Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const comp = createHomeComponent();
      await comp['loadMotdOverlay']();
      expect(comp.motd()).not.toBeNull();
      const getCurrentCallsAfterFirst = vi.mocked(trpc.motd.getCurrent.query).mock.calls.length;

      comp.motd.set(null);
      await comp['loadMotdOverlay']();

      expect(vi.mocked(trpc.motd.getCurrent.query).mock.calls.length).toBe(
        getCurrentCallsAfterFirst,
      );
      expect(comp.motd()).toBeNull();
    });

    it('öffnet nach einem Dismiss nicht automatisch die nächste andere MOTD', async () => {
      const { trpc } = await import('../../core/trpc.client');
      const { markMotdDismissed } = await import('../../core/motd-storage');
      markMotdDismissed('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 7);
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          contentVersion: 1,
          markdown: 'Nächste Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const comp = createHomeComponent();
      await comp['loadMotdOverlay']();

      expect(comp.motd()).toBeNull();
    });

    it('öffnet eine neue Inhaltsversion derselben MOTD nach Dismiss weiterhin automatisch', async () => {
      const { trpc } = await import('../../core/trpc.client');
      const { markMotdDismissed } = await import('../../core/motd-storage');
      markMotdDismissed('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 7);
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 8,
          markdown: 'Aktualisierte Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const comp = createHomeComponent();
      await comp['loadMotdOverlay']();

      expect(comp.motd()?.contentVersion).toBe(8);
    });

    it('lädt nach dem Schließen nicht sofort die nächste MOTD nach', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 7,
          markdown: 'Erste Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const comp = createHomeComponent();

      await comp['loadMotdOverlay']();
      const getCurrentCallsBeforeDismiss = vi.mocked(trpc.motd.getCurrent.query).mock.calls.length;
      await comp.dismissMotdOverlay('DISMISS_CLOSE');

      expect(vi.mocked(trpc.motd.getCurrent.query).mock.calls.length).toBe(
        getCurrentCallsBeforeDismiss,
      );
      expect(comp.motd()).toBeNull();
    });

    it('schließt das MOTD-Overlay sofort, auch wenn recordInteraction noch hängt', async () => {
      const { trpc } = await import('../../core/trpc.client');
      let resolveRecord!: (value: { ok: boolean }) => void;
      vi.mocked(trpc.motd.recordInteraction.mutate).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRecord = resolve;
          }),
      );

      const fixture = createHomeFixture();
      const comp = fixture.componentInstance;
      comp.motd.set({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        contentVersion: 7,
        markdown: 'Meldung',
        endsAt: '2099-12-31T12:00:00.000Z',
      });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.home-motd-sheet')).not.toBeNull();

      const dismissPromise = comp.dismissMotdOverlay('DISMISS_CLOSE');
      await Promise.resolve();
      fixture.detectChanges();

      expect(comp.motd()).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-motd-sheet')).toBeNull();

      resolveRecord({ ok: true });
      await dismissPromise;
    });

    it('unterdrückt MOTD-Overlay nach Locale-Reload (Sprachwechsel)', async () => {
      const { trpc } = await import('../../core/trpc.client');
      const { markMotdOverlayReloadSuppress } = await import('../../core/motd-storage');
      markMotdOverlayReloadSuppress();
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          contentVersion: 1,
          markdown: 'Nächste Meldung nach Dismiss',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const comp = createHomeComponent();
      await comp['loadMotdOverlay']();

      expect(vi.mocked(trpc.motd.getCurrent.query)).not.toHaveBeenCalled();
      expect(comp.motd()).toBeNull();
    });

    it('unterdrückt die MOTD nach Interaktion mit der Session-Eingabe', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.motd.getCurrent.query).mockResolvedValueOnce({
        motd: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 7,
          markdown: 'Meldung',
          endsAt: '2099-12-31T12:00:00.000Z',
        },
      });

      const comp = createHomeComponent();
      comp.onSessionCodeInput({ target: { value: 'A' } } as unknown as Event);

      await comp['loadMotdOverlay']();

      expect(vi.mocked(trpc.motd.getCurrent.query)).not.toHaveBeenCalled();
      expect(comp.motd()).toBeNull();
    });
  });

  describe('openSyncLink', () => {
    it('zeigt Sync als Icon rechts im Veranstalten-Kopf statt als Text-CTA', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      const header = fixture.nativeElement.querySelector(
        '.home-card--create .home-card__header-with-action',
      ) as HTMLElement;
      const btn = header.querySelector('.home-card__sync-btn') as HTMLButtonElement | null;

      expect(btn).not.toBeNull();
      expect(btn?.getAttribute('aria-label')).toBe('Zwischen Geräten wechseln');
      expect(header.lastElementChild).toBe(btn);
      expect(fixture.nativeElement.querySelector('.home-card__tertiary-link')).toBeNull();

      btn?.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.syncLinkVisible()).toBe(true);
      expect(fixture.nativeElement.querySelector('#home-sync-entry')).not.toBeNull();
    });

    it('ordnet Teilen- und Oeffnen-Hinweis je zum passenden Widget', () => {
      const fixture = createHomeFixture();
      const comp = fixture.componentInstance;

      comp.toggleSyncLinkEntry();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Mit anderen teilen');
      expect(text).toContain('Empfangenen Sync-Link hier einfügen');
      expect(text).toContain('Sync-Link anzeigen');
    });

    it('aktiviert mit kompletter Sync-URL den Raum und oeffnet die Quiz-Sammlung', async () => {
      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const quizStore = TestBed.inject(QuizStoreService);
      const activateSpy = vi.spyOn(quizStore, 'activateSyncRoom').mockImplementation(() => {});
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.syncLinkValue.set('https://arsnova.eu/quiz/sync/sync-room-12345678');
      await comp.openSyncLink();

      expect(activateSpy).toHaveBeenCalledWith('sync-room-12345678', {
        markShared: true,
        shareToken: null,
      });
      expect(navSpy).toHaveBeenCalledWith(['quiz'], {
        queryParams: { syncImported: 1 },
      });
      expect(comp.syncLinkError()).toBeNull();
    });

    it('akzeptiert auch nur die rohe Sync-ID und oeffnet die Quiz-Sammlung', async () => {
      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const quizStore = TestBed.inject(QuizStoreService);
      const activateSpy = vi.spyOn(quizStore, 'activateSyncRoom').mockImplementation(() => {});
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.syncLinkValue.set('sync-room-12345678');
      await comp.openSyncLink();

      expect(activateSpy).toHaveBeenCalledWith('sync-room-12345678', {
        markShared: true,
        shareToken: null,
      });
      expect(navSpy).toHaveBeenCalledWith(['quiz'], {
        queryParams: { syncImported: 1 },
      });
      expect(comp.syncLinkError()).toBeNull();
    });

    it('liest Share-Tokens aus einem serverunsichtbaren URL-Fragment', async () => {
      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const quizStore = TestBed.inject(QuizStoreService);
      const activateSpy = vi.spyOn(quizStore, 'activateSyncRoom').mockImplementation(() => {});
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const roomId = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
      const token = `v1.${roomId}.2.${'a'.repeat(43)}`;

      comp.syncLinkValue.set(`https://arsnova.eu/quiz/sync/${roomId}#s=${token}`);
      await comp.openSyncLink();

      expect(activateSpy).toHaveBeenCalledWith(roomId, {
        markShared: true,
        shareToken: token,
      });
    });

    it('zeigt einen Fehler bei ungueltigem Sync-Link', async () => {
      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.syncLinkValue.set('https://arsnova.eu/quiz/test');
      await comp.openSyncLink();

      expect(navSpy).not.toHaveBeenCalled();
      expect(comp.syncLinkError()).toBe('Bitte einen gültigen Sync-Link einfügen.');
    });
  });

  describe('Host-Sharing-Hinweis', () => {
    it('zeigt ohne Verlinkung keinen Hinweis auf der Host-Karte', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('.home-host-sharing-hint');
      expect(hint).toBeNull();
    });

    it('zeigt bei verlinkter Sammlung den Hinweis mit Gerätekontext', () => {
      const quizStore = TestBed.inject(QuizStoreService);
      quizStore.librarySharingMode.set('shared');
      quizStore.originDeviceLabel.set('Mac');
      quizStore.originBrowserLabel.set('Chrome');
      quizStore.syncPeerInfos.set([
        {
          deviceId: 'peer-device-context',
          deviceLabel: 'Mac',
          browserLabel: 'Chrome',
        },
      ]);

      const fixture = createHomeFixture();
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector(
        '.home-host-sharing-hint',
      ) as HTMLElement | null;
      expect(hint).not.toBeNull();
      expect(hint?.textContent).toContain('Quizze werden mit');
      expect(hint?.textContent).toContain('Chrome auf Mac');
    });

    it('bevorzugt den verbundenen Peer statt der eigenen Origin im Hinweis', () => {
      const quizStore = TestBed.inject(QuizStoreService);
      quizStore.librarySharingMode.set('shared');
      quizStore.originDeviceLabel.set('Mac');
      quizStore.originBrowserLabel.set('Firefox');
      quizStore.syncPeerInfos.set([
        {
          deviceId: 'peer-device',
          deviceLabel: 'Mac',
          browserLabel: 'Chrome',
        },
      ]);

      const fixture = createHomeFixture();
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector(
        '.home-host-sharing-hint',
      ) as HTMLElement | null;
      expect(hint).not.toBeNull();
      expect(hint?.textContent).toContain('Chrome auf Mac');
      expect(hint?.textContent).not.toContain('Firefox auf Mac');
    });

    it('zeigt nie das eigene Gerät als Gegenstelle im Hinweis', () => {
      const quizStore = TestBed.inject(QuizStoreService);
      quizStore.librarySharingMode.set('shared');
      quizStore.originDeviceLabel.set(quizStore.currentDeviceLabel());
      quizStore.originBrowserLabel.set(quizStore.currentBrowserLabel());
      quizStore.syncPeerInfos.set([]);

      const fixture = createHomeFixture();
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector(
        '.home-host-sharing-hint',
      ) as HTMLElement | null;
      expect(hint).toBeNull();
    });

    it('löst Verknüpfung nach Bestätigung und ruft Entlinken im Store auf', () => {
      const quizStore = TestBed.inject(QuizStoreService);
      const comp = createHomeComponent();
      const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
      const unlinkSpy = vi.spyOn(quizStore, 'unlinkSharedLibrary');

      comp.unlinkSharedLibrary();

      expect(confirmSpy).toHaveBeenCalled();
      expect(unlinkSpy).toHaveBeenCalledTimes(1);
      confirmSpy.mockRestore();
    });

    it('belässt Verknüpfung bei Abbruch und ruft Entlinken nicht auf', () => {
      const quizStore = TestBed.inject(QuizStoreService);
      const comp = createHomeComponent();
      const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
      const unlinkSpy = vi.spyOn(quizStore, 'unlinkSharedLibrary');

      comp.unlinkSharedLibrary();

      expect(confirmSpy).toHaveBeenCalled();
      expect(unlinkSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  describe('latestHostedQuizId', () => {
    it('ist null, wenn noch kein eigenes Quiz vorhanden ist', () => {
      const comp = createHomeComponent();

      expect(comp.latestHostedQuizId()).toBeNull();
      expect(comp.hasHostedQuiz()).toBe(false);
    });

    it('verwendet fuer "Letztes Quiz starten" das zuletzt geaenderte Quiz', () => {
      const quizStore = TestBed.inject(QuizStoreService);
      const olderQuiz = quizStore.createQuiz({
        name: 'Aelteres Quiz',
        description: '',
      });
      const newerQuiz = quizStore.createQuiz({
        name: 'Neueres Quiz',
        description: '',
      });

      quizStore.updateQuizMetadata(olderQuiz.id, { name: 'Aelteres Quiz', description: '' });
      quizStore.updateQuizMetadata(newerQuiz.id, {
        name: 'Neueres Quiz',
        description: 'Aktualisiert',
      });

      const comp = createHomeComponent();

      expect(comp.latestHostedQuizId()).toBe(newerQuiz.id);
      expect(comp.hasHostedQuiz()).toBe(true);
    });

    it('zeigt ohne eigenes Quiz den Erstellen-CTA und die Sammlung getrennt auf der Veranstalten-Karte', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      const filled = fixture.nativeElement.querySelector(
        '.home-card--create .mat-mdc-unelevated-button',
      ) as HTMLAnchorElement | null;
      expect(filled?.textContent).toContain('Neues Quiz erstellen');

      const secondary = fixture.nativeElement.querySelector(
        '.home-card--create .home-cta--secondary',
      ) as HTMLAnchorElement | null;
      expect(secondary?.textContent).toContain('Quiz-Sammlung öffnen');
    });
  });
});
