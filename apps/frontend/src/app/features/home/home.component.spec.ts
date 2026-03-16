/**
 * Unit-Tests für HomeComponent (Session-Code, Navigation, Controls, Preset-Integration).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HomeComponent } from './home.component';
import { QuizStoreService } from '../quiz/data/quiz-store.service';

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    health: {
      check: { query: vi.fn().mockResolvedValue({ status: 'ok', redis: 'ok', timestamp: new Date().toISOString(), version: '0.1.0' }) },
    },
    quickFeedback: {
      results: { query: vi.fn().mockRejectedValue(new Error('not found')) },
      create: { mutate: vi.fn().mockRejectedValue(new Error('not available')) },
    },
    session: {
      getInfo: { query: vi.fn().mockResolvedValue({ id: 'sess-1', code: 'TEST01', type: 'QUIZ', status: 'LOBBY', quizName: 'Test', title: null, participantCount: 0 }) },
    },
  },
}));

describe('HomeComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), provideHttpClient()],
    });
  });

  afterEach(() => localStorage.clear());

  function createComponent(): HomeComponent {
    const fixture = TestBed.createComponent(HomeComponent);
    return fixture.componentInstance;
  }

  describe('isValidSessionCode', () => {
    it('akzeptiert gültigen 6-stelligen alphanumerischen Code', () => {
      const comp = createComponent();
      comp.sessionCode.set('ABC123');
      expect(comp.isValidSessionCode()).toBe(true);
    });

    it('lehnt zu kurzen Code ab', () => {
      const comp = createComponent();
      comp.sessionCode.set('ABC');
      expect(comp.isValidSessionCode()).toBe(false);
    });

    it('lehnt zu langen Code ab', () => {
      const comp = createComponent();
      comp.sessionCode.set('ABCDEFG');
      expect(comp.isValidSessionCode()).toBe(false);
    });

    it('lehnt Kleinbuchstaben ab', () => {
      const comp = createComponent();
      comp.sessionCode.set('abc123');
      expect(comp.isValidSessionCode()).toBe(false);
    });

    it('lehnt Sonderzeichen ab', () => {
      const comp = createComponent();
      comp.sessionCode.set('ABC-12');
      expect(comp.isValidSessionCode()).toBe(false);
    });

    it('lehnt leeren String ab', () => {
      const comp = createComponent();
      comp.sessionCode.set('');
      expect(comp.isValidSessionCode()).toBe(false);
    });
  });

  describe('onSessionCodeInput', () => {
    it('normalisiert Eingabe zu Großbuchstaben', () => {
      const comp = createComponent();
      const event = { target: { value: 'abc123' } } as unknown as Event;
      comp.onSessionCodeInput(event);
      expect(comp.sessionCode()).toBe('ABC123');
    });

    it('entfernt ungültige Zeichen', () => {
      const comp = createComponent();
      const event = { target: { value: 'AB-C!1@2' } } as unknown as Event;
      comp.onSessionCodeInput(event);
      expect(comp.sessionCode()).toBe('ABC12');
    });

    it('kürzt auf maximal 6 Zeichen', () => {
      const comp = createComponent();
      const event = { target: { value: 'ABCDEFGH' } } as unknown as Event;
      comp.onSessionCodeInput(event);
      expect(comp.sessionCode()).toBe('ABCDEF');
    });

    it('löscht joinError bei neuer Eingabe', () => {
      const comp = createComponent();
      comp.joinError.set('Alter Fehler');
      const event = { target: { value: 'X' } } as unknown as Event;
      comp.onSessionCodeInput(event);
      expect(comp.joinError()).toBeNull();
    });
  });

  describe('joinSession', () => {
    it('setzt joinError bei ungültigem Code', async () => {
      const comp = createComponent();
      comp.sessionCode.set('AB');
      await comp.joinSession();
      expect(comp.joinError()).toBeTruthy();
    });

    it('navigiert zu /join/:code bei gültigem Code', async () => {
      const comp = createComponent();
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.sessionCode.set('TEST01');
      await comp.joinSession();

      expect(navSpy).toHaveBeenCalledWith(['join', 'TEST01']);
    });

    it('speichert Code in recentSessionCodes', async () => {
      const comp = createComponent();
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      comp.sessionCode.set('NEW001');
      await comp.joinSession();

      expect(comp.recentSessionCodes()).toContain('NEW001');
    });

    it('verhindert doppelten Join während isJoining', async () => {
      const comp = createComponent();
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.sessionCode.set('TEST01');
      comp.isJoining.set(true);
      await comp.joinSession();

      expect(navSpy).not.toHaveBeenCalled();
    });

    it('setzt joinError wenn getInfo Session nicht findet (Story 3.1)', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.getInfo.query).mockRejectedValueOnce(new Error('Session nicht gefunden.'));

      const comp = createComponent();
      comp.sessionCode.set('NOTFND');
      await comp.joinSession();

      expect(comp.joinError()).toBe('Session nicht gefunden.');
    });
  });

  describe('startQuickFeedback', () => {
    it('erstellt ein Blitzlicht und navigiert direkt zur Host-Ansicht', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.quickFeedback.create.mutate).mockResolvedValueOnce({
        feedbackId: 'qf:ABC123',
        sessionCode: 'ABC123',
      });

      const comp = createComponent();
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await comp.startQuickFeedback('TRUEFALSE_UNKNOWN');

      expect(trpc.quickFeedback.create.mutate).toHaveBeenCalledWith({
        type: 'TRUEFALSE_UNKNOWN',
        theme: comp.themePreset.theme(),
        preset: comp.themePreset.preset(),
      });
      expect(navSpy).toHaveBeenCalledWith(['feedback', 'ABC123']);
      expect(comp.quickFeedbackError()).toBeNull();
    });
  });

  describe('openSyncLink', () => {
    it('aktiviert mit kompletter Sync-URL den Raum und oeffnet die Quiz-Bibliothek', async () => {
      const comp = createComponent();
      const router = TestBed.inject(Router);
      const quizStore = TestBed.inject(QuizStoreService);
      const activateSpy = vi.spyOn(quizStore, 'activateSyncRoom');
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.syncLinkValue.set('https://click.arsnova.eu/quiz/sync/sync-room-12345678');
      await comp.openSyncLink();

      expect(activateSpy).toHaveBeenCalledWith('sync-room-12345678');
      expect(navSpy).toHaveBeenCalledWith(['quiz']);
      expect(comp.syncLinkError()).toBeNull();
    });

    it('akzeptiert auch nur die rohe Sync-ID und oeffnet die Quiz-Bibliothek', async () => {
      const comp = createComponent();
      const router = TestBed.inject(Router);
      const quizStore = TestBed.inject(QuizStoreService);
      const activateSpy = vi.spyOn(quizStore, 'activateSyncRoom');
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.syncLinkValue.set('sync-room-12345678');
      await comp.openSyncLink();

      expect(activateSpy).toHaveBeenCalledWith('sync-room-12345678');
      expect(navSpy).toHaveBeenCalledWith(['quiz']);
      expect(comp.syncLinkError()).toBeNull();
    });

    it('zeigt einen Fehler bei ungueltigem Sync-Link', async () => {
      const comp = createComponent();
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.syncLinkValue.set('https://click.arsnova.eu/quiz/test');
      await comp.openSyncLink();

      expect(navSpy).not.toHaveBeenCalled();
      expect(comp.syncLinkError()).toBe('Bitte eine gueltige Sync-ID oder einen gueltigen Sync-Link eingeben.');
    });
  });

});
