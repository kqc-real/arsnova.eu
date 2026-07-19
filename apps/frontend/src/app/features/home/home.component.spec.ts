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
      const action = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button'),
      ).find((button) => button.textContent?.includes('Code eingeben'));

      action?.click();

      expect(action).toBeDefined();
      expect(document.activeElement).toBe(input);
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
      const runAnimationFrame = (timestamp: number): void => {
        const callbacks = animationFrames.splice(0);
        callbacks.forEach((callback) => callback(timestamp));
      };

      runAnimationFrame(0);
      expect(document.activeElement).toBe(sentinel);
      runAnimationFrame(16);

      expect(matchMedia).toHaveBeenCalledWith('(pointer: coarse)');
      expect(document.activeElement).toBe(input);
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

    it('zeigt die Brand-Wiederholung im Mitmachen-Panel nur im spielerischen Preset', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      const brand = fixture.nativeElement.querySelector(
        '#participant-entry .home-card__brand-repeat',
      ) as HTMLElement | null;
      expect(brand?.getAttribute('aria-hidden')).toBe('true');
      expect(brand?.textContent).toContain('arsnova.eu');
      expect(brand?.querySelector('img')?.getAttribute('src')).toBe('assets/icons/favicon.svg');

      fixture.componentInstance.themePreset.setPreset('serious');
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('#participant-entry .home-card__brand-repeat'),
      ).toBeNull();
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

    it('startet das Tempo-Spotlight als Standalone-Blitzlicht', async () => {
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

      expect(fixture.nativeElement.textContent).toContain('Tempo-Blitzlicht');
      expect(fixture.nativeElement.textContent).toContain('Tempo-Feedback');
      expect(fixture.nativeElement.textContent).not.toContain('Tempo starten');

      await comp.startQuickFeedback(comp.quickFeedbackTempoSpotlight.type);

      expect(trpc.quickFeedback.create.mutate).toHaveBeenCalledWith({
        type: 'TEMPO',
      });
      expect(setFeedbackHostTokenMock).toHaveBeenCalledWith('TMP123', 'tempo-owner-token');
      expect(navSpy).toHaveBeenCalledWith(['feedback', 'TMP123']);
    });
  });

  describe('openHeroHostTab', () => {
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

      expect(activateSpy).toHaveBeenCalledWith('sync-room-12345678', { markShared: true });
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

      expect(activateSpy).toHaveBeenCalledWith('sync-room-12345678', { markShared: true });
      expect(navSpy).toHaveBeenCalledWith(['quiz'], {
        queryParams: { syncImported: 1 },
      });
      expect(comp.syncLinkError()).toBeNull();
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
