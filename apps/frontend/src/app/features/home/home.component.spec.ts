/**
 * Unit-Tests für HomeComponent (Session-Code, Navigation, Controls, Preset-Integration).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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
    },
  },
}));

function createHomeComponent(): HomeComponent {
  const fixture = TestBed.createComponent(HomeComponent);
  return fixture.componentInstance;
}

describe('HomeComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), provideHttpClient()],
    });
  });

  afterEach(() => localStorage.clear());

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
    it('zeigt grünen Haken nur bei gültigem 6-stelligem Code', () => {
      const fixture = TestBed.createComponent(HomeComponent);
      const el = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();

      fixture.componentInstance.sessionCode.set('ABC12');
      fixture.detectChanges();
      expect(el.querySelector('.home-code-segment__check')).toBeNull();

      fixture.componentInstance.sessionCode.set('ABC123');
      fixture.detectChanges();
      expect(el.querySelector('.home-code-segment__check')).not.toBeNull();
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
      expect(comp.sessionCode()).toBe('');
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
        theme: comp.themePreset.theme(),
        preset: comp.themePreset.preset(),
      });
      expect(setFeedbackHostTokenMock).toHaveBeenCalledWith('ABC123', 'feedback-owner-token');
      expect(navSpy).toHaveBeenCalledWith(['feedback', 'ABC123']);
      expect(comp.quickFeedbackError()).toBeNull();
    });
  });

  describe('MOTD overlay', () => {
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

        const fixture = TestBed.createComponent(HomeComponent);
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
  });

  describe('openSyncLink', () => {
    it('ordnet Teilen- und Oeffnen-Hinweis je zum passenden Widget', () => {
      const fixture = TestBed.createComponent(HomeComponent);
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
      const activateSpy = vi.spyOn(quizStore, 'activateSyncRoom');
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
      const activateSpy = vi.spyOn(quizStore, 'activateSyncRoom');
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

    it('zeigt ohne eigenes Quiz (nur Demo) keinen gefuellten Primaer-CTA auf der Veranstalten-Karte', () => {
      const fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();

      const filled = fixture.nativeElement.querySelector(
        '.home-card--create .mat-mdc-unelevated-button',
      );
      expect(filled).toBeNull();

      const secondary = fixture.nativeElement.querySelector(
        '.home-card--create .home-cta--secondary',
      ) as HTMLAnchorElement | null;
      expect(secondary?.textContent).toContain('Deine Quiz-Sammlung');
    });
  });
});
