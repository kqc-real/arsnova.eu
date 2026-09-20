/**
 * Unit-Tests für HomeComponent (Session-Code, Navigation, Controls, Preset-Integration).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { HomeComponent } from './home.component';
import { QuizStoreService } from '../quiz/data/quiz-store.service';
import { clearHostToken, setHostToken } from '../../core/host-session-token';
import { MotdHeaderStateService } from '../../core/motd-header-state.service';
import {
  getHostBrowserCapability,
  storeHostBrowserCapability,
  storeHostRecoveryCandidate,
} from '../../core/host-recovery-access';

const { setFeedbackHostTokenMock } = vi.hoisted(() => ({
  setFeedbackHostTokenMock: vi.fn(),
}));

vi.mock('../../core/feedback-host-token', () => ({
  setFeedbackHostToken: setFeedbackHostTokenMock,
}));

vi.mock('../../core/trpc.client', () => ({
  setHostToken: vi.fn(),
  setPendingHostSessionCode: vi.fn(),
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
      getHeaderState: {
        query: vi.fn().mockResolvedValue({
          hasActiveOverlay: false,
          activeOverlay: null,
          hasArchiveEntries: false,
          archiveCount: 0,
          archiveMaxCursor: null,
          archiveMaxEndsAtIso: null,
          archiveUnreadCount: 0,
        }),
      },
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
      issueHostAccessToken: {
        mutate: vi.fn().mockResolvedValue({ hostToken: 'issued-host-token' }),
      },
      closeQaChannel: {
        mutate: vi.fn().mockResolvedValue({ qa: { enabled: true, open: false, state: 'CLOSED' } }),
      },
      end: {
        mutate: vi.fn().mockResolvedValue({ status: 'FINISHED' }),
      },
    },
  },
}));

const activeFixtures: Array<ReturnType<typeof TestBed.createComponent<HomeComponent>>> = [];
const matDialogMock = {
  open: vi.fn(
    (
      _component: unknown,
      config?: {
        data?: {
          identityMode: 'PRESET_PSEUDONYM';
          nicknameTheme: 'KINDERGARTEN' | 'HIGH_SCHOOL';
        };
      },
    ) => ({
      afterClosed: () => of(config?.data),
    }),
  ),
};

function createHomeFixture() {
  const fixture = TestBed.createComponent(HomeComponent);
  activeFixtures.push(fixture);
  return fixture;
}

function seedHostCapability(): void {
  storeHostBrowserCapability('ABC123', 'browser-capability-abcdefghijklmnopqrstuvwxyz');
}

function hostSessionGetInfo(
  code: string,
  qaOpen: boolean,
  options?: { qaClosesAt?: string; postProcessingEndsAt?: string; qaQuestionCount?: number },
) {
  const closesAt =
    options?.qaClosesAt ?? (qaOpen ? '2026-09-20T06:07:00.000Z' : '2026-09-18T12:22:30.000Z');
  return {
    id: `sess-${code}`,
    code,
    type: 'QUIZ' as const,
    status: qaOpen ? ('LOBBY' as const) : ('FINISHED' as const),
    serverTime: '2026-09-19T12:00:00.000Z',
    quizName: 'Live',
    title: null,
    participantCount: 1,
    qaQuestionCount: options?.qaQuestionCount ?? 0,
    expiresAt: closesAt,
    qaClosesAt: closesAt,
    qaEnabled: true,
    qaOpen,
    postProcessingEndsAt: options?.postProcessingEndsAt ?? '2026-10-04T06:07:00.000Z',
    timeZone: 'Europe/Berlin',
    channels: qaOpen
      ? {
          qa: {
            enabled: true,
            open: true,
            state: 'OPEN' as const,
            closesAt,
          },
        }
      : undefined,
  };
}

function restoreDefaultSessionGetInfo(query: {
  mockResolvedValue: (value: unknown) => unknown;
}): void {
  query.mockResolvedValue({
    id: 'sess-1',
    code: 'TEST01',
    type: 'QUIZ',
    status: 'LOBBY',
    serverTime: new Date().toISOString(),
    quizName: 'Test',
    title: null,
    participantCount: 0,
  });
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
    vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'));
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: MatDialog, useValue: matDialogMock },
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
    matDialogMock.open.mockClear();
    matDialogMock.open.mockImplementation((_component, config) => ({
      afterClosed: () => of(config?.data),
    }));
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
    clearHostToken('TEST01');
    clearHostToken('PART01');
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
      expect(button.textContent).toContain('Los geht’s');
    });

    it('stellt Rollen und Aufgaben als hierarchische Überschriften bereit', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      const hero = fixture.nativeElement.querySelector('h1.home-hero') as HTMLHeadingElement;
      const levelTwoTitles = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLHeadingElement>('h2'),
      ).map((heading) => heading.textContent?.replace(/\s+/g, ' ').trim());
      const taskTitles = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLHeadingElement>('h3.home-card__title'),
      ).map((heading) => heading.textContent?.replace(/\s+/g, ' ').trim());

      expect(hero).not.toBeNull();
      expect(hero.textContent).toMatch(/Quiz/);
      expect(hero.querySelector('.home-hero-divider')).not.toBeNull();
      expect(levelTwoTitles).toEqual(
        expect.arrayContaining(['An einer Session teilnehmen', 'Was möchtest du tun?']),
      );
      expect(taskTitles).toEqual(['Session starten', 'Mit einem Klick', 'Quiz erstellen']);
      expect(fixture.nativeElement.querySelectorAll('.home-card__eyebrow')).toHaveLength(4);
      expect(fixture.nativeElement.querySelector('.home-card__icon-wrap')).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-card mat-card-subtitle')).toBeNull();
    });

    it('blendet den Hero-Divider per CSS nur ab 600px ein', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');

      expect(scss).toMatch(/\.home-hero-divider\s*\{[^}]*display:\s*none/);
      expect(scss).toMatch(
        /@media \(min-width:\s*600px\)\s*\{[\s\S]*?\.home-hero-divider,[\s\S]*?display:\s*inline/,
      );
    });
  });

  describe('Layout und Presets', () => {
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

    it('zeigt den Teilnahme-Einstieg mit Rollenlabel und ohne Logo-Wiederholung', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      const joinCard = fixture.nativeElement.querySelector(
        '#participant-entry',
      ) as HTMLElement | null;
      expect(joinCard).not.toBeNull();
      expect(joinCard?.querySelector('.home-card__brand-repeat')).toBeNull();
      expect(joinCard?.querySelector('.home-card__eyebrow')?.textContent?.trim()).toBe(
        'Für Teilnehmende',
      );
      expect(joinCard?.querySelector('.home-card__title')?.textContent?.trim()).toBe(
        'An einer Session teilnehmen',
      );
      expect(joinCard?.textContent).not.toContain('Dabei sein');
      expect(joinCard?.textContent).not.toContain('Session-Code');
      expect(joinCard?.querySelector('.home-code-under-label')).toBeNull();
      expect(
        joinCard?.querySelector('.home-code-segments__input')?.getAttribute('aria-label'),
      ).toBe('Session-Code, 6 Zeichen');
      expect(joinCard?.textContent).toContain('Los geht’s');
      expect(joinCard?.textContent).not.toContain('Host-Zugang wiederherstellen');
      expect(joinCard?.querySelector('a[href*="host-recovery"]')).toBeNull();
      const hostIntro = fixture.nativeElement.querySelector(
        '.home-host-intro',
      ) as HTMLElement | null;
      expect(
        fixture.nativeElement.querySelector('[data-testid="home-host-recovery-link"]'),
      ).toBeNull();
      expect(fixture.nativeElement.querySelector('a[href*="host-recovery"]')).toBeNull();
      expect(hostIntro?.textContent).not.toContain('Zugang als Host');
      expect(fixture.nativeElement.querySelector('[data-testid="home-host-recovery"]')).toBeNull();

      fixture.componentInstance.themePreset.setPreset('serious');
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('#participant-entry .home-card__brand-repeat'),
      ).toBeNull();
      expect(
        fixture.nativeElement
          .querySelector('#participant-entry .home-card__title')
          ?.textContent?.trim(),
      ).toBe('An einer Session teilnehmen');
    });

    it('hält den Host-Recovery-Einstieg als erste CTA-Reihe über den Live-Buttons', async () => {
      const { trpc } = await import('../../core/trpc.client');
      seedHostCapability();
      vi.mocked(trpc.session.getInfo.query).mockResolvedValue(hostSessionGetInfo('ABC123', true));
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          fixture.nativeElement.querySelector(
            '.home-host-session-cta-row [data-testid="home-host-recovery"]',
          ) !== null,
        { timeout: 1000, interval: 10 },
      );

      const recoveryAction = fixture.nativeElement.querySelector(
        '.home-host-session-cta-row [data-testid="home-host-recovery"]',
      ) as HTMLElement | null;
      expect(recoveryAction?.tagName).toBe('A');
      expect(recoveryAction?.getAttribute('role')).not.toBe('listitem');
      expect(
        recoveryAction?.closest('ul.home-host-session-cta-row')?.getAttribute('aria-label'),
      ).toBe('Deine Q&A-Sessions');
      expect(recoveryAction?.getAttribute('href') ?? '').toContain('session/ABC123/host');
      expect(recoveryAction?.getAttribute('href') ?? '').toContain('tab=qa');
      expect(recoveryAction?.getAttribute('href') ?? '').not.toContain('host-recovery');
      expect(recoveryAction?.querySelector('.home-choice-button__label')?.textContent?.trim()).toBe(
        'Q&A-Session ABC123',
      );
      expect(
        fixture.nativeElement.querySelector('[data-testid="home-host-recovery-link"]'),
      ).toBeNull();
      expect(
        recoveryAction?.querySelector('.home-choice-button__description')?.textContent?.trim(),
      ).toContain('Zugang bis');

      const liveGrid = fixture.nativeElement.querySelector('.home-live-grid') as HTMLElement | null;
      expect(liveGrid?.classList.contains('home-live-grid--with-recovery')).toBe(false);
      expect(liveGrid?.querySelector('[data-testid="home-host-recovery"]')).toBeNull();

      const hostCtas = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.home-host-session-cta-row .home-choice-button',
        ),
      );
      expect(hostCtas).toHaveLength(1);

      const liveButtons = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>('.home-live-grid .home-choice-button'),
      );
      expect(liveButtons).toHaveLength(3);
      expect(liveButtons.every((button) => button.classList.contains('home-cta--secondary'))).toBe(
        true,
      );
      expect(
        liveButtons.map((button) =>
          button.querySelector('.home-choice-button__label')?.textContent?.trim(),
        ),
      ).toEqual(['Quiz', 'Neue Q&A-Session', 'Blitzlicht']);
      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('zeigt die Zugangsfrist in der zweiten CTA-Zeile und die Offen-Frist in der dritten', async () => {
      const { trpc } = await import('../../core/trpc.client');
      seedHostCapability();
      vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
        id: 'sess-abc',
        code: 'ABC123',
        type: 'QUIZ',
        status: 'ACTIVE',
        serverTime: '2026-09-18T12:00:00.000Z',
        quizName: 'Live',
        title: null,
        participantCount: 2,
        qaQuestionCount: 5,
        expiresAt: '2026-09-20T06:07:00.000Z',
        qaClosesAt: '2026-09-20T06:07:00.000Z',
        qaEnabled: true,
        qaOpen: true,
        postProcessingEndsAt: '2026-10-04T06:07:00.000Z',
        timeZone: 'Europe/Berlin',
        channels: {
          qa: {
            enabled: true,
            open: true,
            state: 'OPEN',
            closesAt: '2026-09-20T06:07:00.000Z',
          },
        },
      });
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          Array.from(
            fixture.nativeElement.querySelectorAll<HTMLElement>(
              '.home-host-session-cta-row [data-testid="home-host-recovery"] .home-choice-button__description',
            ),
          ).some((line) => line.textContent?.trim().startsWith('Offen bis ')) === true,
        { timeout: 1000, interval: 10 },
      );

      const descriptions = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.home-host-session-cta-row [data-testid="home-host-recovery"] .home-choice-button__description',
        ),
      ).map((line) => line.textContent?.trim());
      expect(descriptions[0]).toMatch(/^Zugang bis /);
      expect(descriptions[0]).toContain('2026');
      expect(descriptions[1]).toMatch(/^Offen bis /);
      expect(descriptions[1]).toContain('2026');
      expect(descriptions[2]).toBe('5 Fragen');
      expect(
        fixture.nativeElement
          .querySelector('.home-host-session-cta-row [data-testid="home-host-recovery"]')
          ?.classList.contains('mat-mdc-unelevated-button'),
      ).toBe(true);
      expect(trpc.session.getInfo.query).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ABC123' }),
      );
    });

    it('zeigt Forum geschlossen, wenn die Q&A-Frist vorbei ist', async () => {
      const { trpc } = await import('../../core/trpc.client');
      seedHostCapability();
      vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
        id: 'sess-abc',
        code: 'ABC123',
        type: 'QUIZ',
        status: 'FINISHED',
        serverTime: '2026-09-19T12:00:00.000Z',
        quizName: 'Live',
        title: null,
        participantCount: 2,
        qaQuestionCount: 1,
        expiresAt: '2026-09-18T12:22:30.000Z',
        qaClosesAt: '2026-09-18T12:22:30.000Z',
        qaEnabled: true,
        qaOpen: true,
        postProcessingEndsAt: '2026-10-01T12:25:00.000Z',
        timeZone: 'Europe/Berlin',
      });
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          Array.from(
            fixture.nativeElement.querySelectorAll<HTMLElement>(
              '.home-host-session-cta-row [data-testid="home-host-recovery"] .home-choice-button__description',
            ),
          ).some((line) => line.textContent?.trim() === 'Forum geschlossen') === true,
        { timeout: 1000, interval: 10 },
      );

      const descriptions = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.home-host-session-cta-row [data-testid="home-host-recovery"] .home-choice-button__description',
        ),
      ).map((line) => line.textContent?.trim());
      expect(descriptions[0]).toMatch(/^Zugang bis /);
      expect(descriptions[1]).toBe('Forum geschlossen');
      expect(descriptions[2]).toBe('1 Frage');
      expect(
        fixture.nativeElement
          .querySelector('.home-host-session-cta-row [data-testid="home-host-recovery"]')
          ?.classList.contains('mat-mdc-outlined-button'),
      ).toBe(true);

      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('hält den CTA offen, wenn die Geräteuhr voraus ist, die Serverzeit aber noch vor den Fristen liegt', async () => {
      const { trpc } = await import('../../core/trpc.client');
      seedHostCapability();
      vi.setSystemTime(new Date('2026-10-05T00:00:00.000Z'));
      vi.mocked(trpc.session.getInfo.query).mockResolvedValue(
        hostSessionGetInfo('ABC123', true, {
          qaClosesAt: '2026-09-20T06:07:00.000Z',
          postProcessingEndsAt: '2026-10-04T06:07:00.000Z',
        }),
      );
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          fixture.nativeElement.querySelector(
            '.home-host-session-cta-row [data-session-code="ABC123"].mat-mdc-unelevated-button',
          ) !== null,
        { timeout: 1000, interval: 10 },
      );

      expect(
        fixture.nativeElement.querySelectorAll(
          '.home-host-session-cta-row [data-testid="home-host-recovery"]',
        ),
      ).toHaveLength(1);

      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('entfernt den CTA, wenn die Serverzeit die Zugangsfrist überschritten hat', async () => {
      const { trpc } = await import('../../core/trpc.client');
      seedHostCapability();
      vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
        ...hostSessionGetInfo('ABC123', true, {
          postProcessingEndsAt: '2026-10-04T06:07:00.000Z',
        }),
        serverTime: '2026-10-05T00:00:00.000Z',
      });
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          fixture.nativeElement.querySelector('.home-host-session-cta-row') === null &&
          vi.mocked(trpc.session.getInfo.query).mock.calls.length > 0,
        { timeout: 1000, interval: 10 },
      );

      expect(
        fixture.nativeElement.querySelector(
          '.home-host-session-cta-row [data-testid="home-host-recovery"]',
        ),
      ).toBeNull();

      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('füllt die zuletzt gehostete Session nur bei offenem Forum, sonst die nächste offene', async () => {
      const { trpc } = await import('../../core/trpc.client');
      storeHostBrowserCapability('AAA111', 'older-browser-capability-abcdefghijklmnopqrstuvwxyz');
      storeHostBrowserCapability('BBB222', 'newer-browser-capability-abcdefghijklmnopqrstuvwxyz');
      vi.mocked(trpc.session.getInfo.query).mockImplementation(async (input: { code: string }) =>
        hostSessionGetInfo(input.code, input.code === 'AAA111'),
      );
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          fixture.nativeElement.querySelector(
            '.home-host-session-cta-row [data-session-code="AAA111"].mat-mdc-unelevated-button',
          ) !== null,
        { timeout: 1000, interval: 10 },
      );

      const recoveryActions = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.home-host-session-cta-row [data-testid="home-host-recovery"]',
        ),
      );
      expect(recoveryActions.map((action) => action.getAttribute('data-session-code'))).toEqual([
        'AAA111',
        'BBB222',
      ]);
      expect(recoveryActions[0]?.classList.contains('mat-mdc-unelevated-button')).toBe(true);
      expect(recoveryActions[1]?.classList.contains('mat-mdc-outlined-button')).toBe(true);

      vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
        id: 'sess-1',
        code: 'TEST01',
        type: 'QUIZ',
        status: 'LOBBY',
        serverTime: new Date().toISOString(),
        quizName: 'Test',
        title: null,
        participantCount: 0,
      });
    });

    it('füllt die zuletzt gehostete Session, wenn deren Forum noch offen ist', async () => {
      const { trpc } = await import('../../core/trpc.client');
      storeHostBrowserCapability('AAA111', 'older-browser-capability-abcdefghijklmnopqrstuvwxyz');
      storeHostBrowserCapability('BBB222', 'newer-browser-capability-abcdefghijklmnopqrstuvwxyz');
      vi.mocked(trpc.session.getInfo.query).mockImplementation(async (input: { code: string }) =>
        hostSessionGetInfo(input.code, true),
      );
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          fixture.nativeElement.querySelector(
            '.home-host-session-cta-row [data-session-code="BBB222"].mat-mdc-unelevated-button',
          ) !== null,
        { timeout: 1000, interval: 10 },
      );

      const recoveryActions = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.home-host-session-cta-row [data-testid="home-host-recovery"]',
        ),
      );
      expect(recoveryActions[0]?.getAttribute('data-session-code')).toBe('BBB222');
      expect(recoveryActions[0]?.classList.contains('mat-mdc-unelevated-button')).toBe(true);
      expect(recoveryActions[1]?.classList.contains('mat-mdc-outlined-button')).toBe(true);

      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('ordnet offene Foren vor geschlossenen und früher schließende zuerst', async () => {
      const { trpc } = await import('../../core/trpc.client');
      storeHostBrowserCapability('ZZZ999', 'later-browser-capability-abcdefghijklmnopqrstuvwxyz');
      storeHostBrowserCapability('MMM555', 'mid-browser-capability-abcdefghijklmnopqrstuvwxyz');
      storeHostBrowserCapability('AAA111', 'closed-browser-capability-abcdefghijklmnopqrstuvwxyz');
      localStorage.removeItem('arsnova-last-hosted-session');
      vi.mocked(trpc.session.getInfo.query).mockImplementation(async (input: { code: string }) => {
        if (input.code === 'AAA111') {
          return hostSessionGetInfo(input.code, false, {
            postProcessingEndsAt: '2026-10-01T12:00:00.000Z',
          });
        }
        if (input.code === 'ZZZ999') {
          return hostSessionGetInfo(input.code, true, {
            qaClosesAt: '2026-09-20T10:00:00.000Z',
          });
        }
        return hostSessionGetInfo(input.code, true, {
          qaClosesAt: '2026-09-19T18:00:00.000Z',
        });
      });
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          fixture.nativeElement.querySelector(
            '.home-host-session-cta-row [data-session-code="MMM555"].mat-mdc-unelevated-button',
          ) !== null,
        { timeout: 1000, interval: 10 },
      );

      expect(
        Array.from(
          fixture.nativeElement.querySelectorAll<HTMLElement>(
            '.home-host-session-cta-row [data-testid="home-host-recovery"]',
          ),
        ).map((action) => action.getAttribute('data-session-code')),
      ).toEqual(['MMM555', 'ZZZ999', 'AAA111']);

      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('behält ein späteres offenes Forum in der Achterreihe', async () => {
      const { trpc } = await import('../../core/trpc.client');
      const closedCodes = [
        'AAA111',
        'BBB222',
        'CCC333',
        'DDD444',
        'EEE555',
        'FFF666',
        'GGG777',
        'HHH888',
      ];
      for (const code of closedCodes) {
        storeHostBrowserCapability(code, `${code}-browser-capability-abcdefghijklmnopqrstuvwxyz`);
      }
      storeHostBrowserCapability('ZZZ999', 'open-browser-capability-abcdefghijklmnopqrstuvwxyz');
      localStorage.removeItem('arsnova-last-hosted-session');
      vi.mocked(trpc.session.getInfo.query).mockImplementation(async (input: { code: string }) =>
        hostSessionGetInfo(input.code, input.code === 'ZZZ999'),
      );
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          fixture.nativeElement.querySelector(
            '.home-host-session-cta-row [data-session-code="ZZZ999"]',
          ) !== null,
        { timeout: 1000, interval: 10 },
      );

      const codes = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.home-host-session-cta-row [data-testid="home-host-recovery"]',
        ),
      ).map((action) => action.getAttribute('data-session-code'));
      expect(codes).toHaveLength(8);
      expect(codes[0]).toBe('ZZZ999');
      expect(codes).not.toContain('HHH888');

      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('zeigt mit Wiederherstellungskandidat keinen Host-CTA auf der Live-Karte', () => {
      storeHostRecoveryCandidate('XYZ789', 'candidate-capability-abcdefghijklmnopqrstuvwxyz');
      const fixture = createHomeFixture();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="home-host-recovery"]')).toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="home-host-recovery-link"]'),
      ).toBeNull();
      expect(fixture.nativeElement.querySelector('a[href*="host-recovery"]')).toBeNull();
    });

    it('reiht mehrere gespeicherte Host-Sessions, zuletzt gehostete zuerst', async () => {
      const { trpc } = await import('../../core/trpc.client');
      storeHostBrowserCapability('AAA111', 'older-browser-capability-abcdefghijklmnopqrstuvwxyz');
      storeHostBrowserCapability('BBB222', 'newer-browser-capability-abcdefghijklmnopqrstuvwxyz');
      vi.mocked(trpc.session.getInfo.query).mockImplementation(async (input: { code: string }) =>
        hostSessionGetInfo(input.code, true),
      );
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          fixture.nativeElement.querySelectorAll(
            '.home-host-session-cta-row [data-testid="home-host-recovery"]',
          ).length === 2,
        { timeout: 1000, interval: 10 },
      );

      const recoveryActions = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.home-host-session-cta-row [data-testid="home-host-recovery"]',
        ),
      );
      expect(recoveryActions).toHaveLength(2);
      expect(recoveryActions[0]?.getAttribute('data-session-code')).toBe('BBB222');
      expect(recoveryActions[1]?.getAttribute('data-session-code')).toBe('AAA111');
      expect(recoveryActions[0]?.getAttribute('href') ?? '').toContain('session/BBB222/host');
      expect(recoveryActions[0]?.getAttribute('href') ?? '').toContain('tab=qa');
      expect(
        recoveryActions[0]?.querySelector('.home-choice-button__label')?.textContent?.trim(),
      ).toBe('Q&A-Session BBB222');
      expect(
        fixture.nativeElement.querySelector('[data-testid="home-host-recovery-link"]'),
      ).toBeNull();
      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('zeigt alle gespeicherten Host-Sessions auch ohne last-hosted-Zeiger', async () => {
      const { trpc } = await import('../../core/trpc.client');
      storeHostBrowserCapability('AAA111', 'older-browser-capability-abcdefghijklmnopqrstuvwxyz');
      storeHostBrowserCapability('BBB222', 'newer-browser-capability-abcdefghijklmnopqrstuvwxyz');
      localStorage.removeItem('arsnova-last-hosted-session');
      vi.mocked(trpc.session.getInfo.query).mockImplementation(async (input: { code: string }) =>
        hostSessionGetInfo(input.code, true),
      );
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          fixture.nativeElement.querySelectorAll(
            '.home-host-session-cta-row [data-testid="home-host-recovery"]',
          ).length === 2,
        { timeout: 1000, interval: 10 },
      );

      const recoveryActions = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.home-host-session-cta-row [data-testid="home-host-recovery"]',
        ),
      );
      expect(recoveryActions.map((action) => action.getAttribute('data-session-code'))).toEqual([
        'AAA111',
        'BBB222',
      ]);
      expect(
        fixture.nativeElement.querySelector('[data-testid="home-host-recovery-link"]'),
      ).toBeNull();
      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('zeigt keinen Host-CTA für Quiz oder Blitzlicht ohne eingerichtetes Q&A', async () => {
      const { trpc } = await import('../../core/trpc.client');
      storeHostBrowserCapability('QUIZ01', 'quiz-browser-capability-abcdefghijklmnopqrstuvwxyz');
      vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
        id: 'sess-quiz',
        code: 'QUIZ01',
        type: 'QUIZ',
        status: 'FINISHED',
        serverTime: '2026-09-19T12:00:00.000Z',
        quizName: 'Live',
        title: null,
        participantCount: 3,
        qaEnabled: false,
        qaOpen: false,
        qaClosesAt: null,
        expiresAt: '2026-09-20T12:00:00.000Z',
        channels: {
          quiz: { enabled: true },
          qa: { enabled: false, open: false, state: 'DISABLED' as const },
          quickFeedback: { enabled: false, open: false },
        },
      });
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.home-host-session-cta-row')).toBeNull();
      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('bietet neben jedem Host-CTA eine Lösch-Aktion mit Sessionende als Hauptoption', async () => {
      const { trpc } = await import('../../core/trpc.client');
      seedHostCapability();
      vi.mocked(trpc.session.getInfo.query).mockResolvedValue(
        hostSessionGetInfo('ABC123', true, { qaQuestionCount: 4 }),
      );
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () =>
          fixture.nativeElement.querySelector(
            '[data-testid="home-host-session-remove"][data-session-code="ABC123"]',
          ) !== null,
        { timeout: 1000, interval: 10 },
      );

      const remove = fixture.nativeElement.querySelector(
        '[data-testid="home-host-session-remove"][data-session-code="ABC123"]',
      ) as HTMLButtonElement;
      expect(remove.getAttribute('aria-label')).toBe('Q&A-Session ABC123 löschen');
      expect(remove.querySelector('mat-icon')?.textContent?.trim()).toBe('delete_outline');

      const item = fixture.componentInstance.hostSessionCtas()[0];
      expect(item?.code).toBe('ABC123');
      matDialogMock.open.mockImplementationOnce(() => ({
        afterClosed: () => of(true),
      }));
      await fixture.componentInstance.removeHostSessionCta(item);

      expect(matDialogMock.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Q&A-Session ABC123 löschen?',
            confirmLabel: 'Session löschen',
            alternateLabel: 'Nur Schnellzugang entfernen',
            cancelLabel: 'Abbrechen',
            note: expect.stringContaining('Wiederherstellungskarte'),
            consequences: expect.arrayContaining([
              expect.stringContaining('Offen bis'),
              '4 Fragen',
              expect.stringContaining('Zugang bis'),
            ]),
          }),
        }),
      );
      expect(trpc.session.issueHostAccessToken.mutate).toHaveBeenCalledWith({
        code: 'ABC123',
        browserCapability: 'browser-capability-abcdefghijklmnopqrstuvwxyz',
      });
      expect(trpc.session.closeQaChannel.mutate).toHaveBeenCalledWith({ code: 'ABC123' });
      expect(trpc.session.end.mutate).toHaveBeenCalledWith({ code: 'ABC123' });
      expect(getHostBrowserCapability('ABC123')).toBeNull();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.home-host-session-cta-row')).toBeNull();
      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('entfernt optional nur den lokalen Host-CTA ohne session.end', async () => {
      const { trpc } = await import('../../core/trpc.client');
      seedHostCapability();
      vi.mocked(trpc.session.getInfo.query).mockResolvedValue(
        hostSessionGetInfo('ABC123', true, { qaQuestionCount: 4 }),
      );
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await vi.waitUntil(
        () => fixture.componentInstance.hostSessionCtas().some((entry) => entry.code === 'ABC123'),
        { timeout: 1000, interval: 10 },
      );

      matDialogMock.open.mockImplementationOnce(() => ({
        afterClosed: () => of('alternate'),
      }));
      await fixture.componentInstance.removeHostSessionCta(
        fixture.componentInstance.hostSessionCtas()[0],
      );

      expect(trpc.session.end.mutate).not.toHaveBeenCalled();
      expect(getHostBrowserCapability('ABC123')).toBeNull();
      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('stellt den Host-CTA nach Session-Löschen nicht durch eine veraltete Infosuche wieder her', async () => {
      const { trpc } = await import('../../core/trpc.client');
      seedHostCapability();
      let releaseInfo!: (value: ReturnType<typeof hostSessionGetInfo>) => void;
      const pendingInfo = new Promise<ReturnType<typeof hostSessionGetInfo>>((resolve) => {
        releaseInfo = resolve;
      });
      let infoCalls = 0;
      vi.mocked(trpc.session.getInfo.query).mockImplementation(() => {
        infoCalls += 1;
        if (infoCalls === 1) {
          return pendingInfo;
        }
        return Promise.resolve(hostSessionGetInfo('ABC123', true, { qaQuestionCount: 0 }));
      });
      const fixture = createHomeFixture();
      fixture.detectChanges();
      await Promise.resolve();

      matDialogMock.open.mockImplementationOnce(() => ({
        afterClosed: () => of(true),
      }));
      await fixture.componentInstance.removeHostSessionCta({
        code: 'ABC123',
        deadlineLabel: '5.10.2026, 11:29',
        openUntilLabel: '21.9.2026, 12:29',
        questionCount: 0,
        qaOpen: true,
        openUntilMs: Date.parse('2026-09-21T10:29:00.000Z'),
        accessUntilMs: Date.parse('2026-10-05T09:29:00.000Z'),
        primary: true,
      });

      releaseInfo(hostSessionGetInfo('ABC123', true, { qaQuestionCount: 0 }));
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();

      expect(getHostBrowserCapability('ABC123')).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-host-session-cta-row')).toBeNull();
      restoreDefaultSessionGetInfo(vi.mocked(trpc.session.getInfo.query));
    });

    it('überlässt den Preset-Wechsel der globalen Toolbar', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.home-hero-preset-mobile')).toBeNull();
      expect(fixture.nativeElement.querySelector('.home-hero-preset-toggle')).toBeNull();
    });

    it('hält den mobilen Hero kompakt und die Titeltypografie lesbar', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');

      expect(scss).toMatch(
        /@media \(max-width:\s*599px\)\s*\{[\s\S]*?\.home-hero\s*\{[^}]*font:\s*var\(--mat-sys-title-large\)/,
      );
      expect(scss).not.toContain('.home-hero-preset-toggle');
    });

    it('hält den Teilnahme-CTA auf Desktop und im Smartphone-Landscape kompakt', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');
      const responsiveJoin = scss.slice(
        scss.indexOf('@media (min-width: 600px) {\n  .home-join-row'),
        scss.indexOf('.home-recent-panel'),
      );

      expect(responsiveJoin).toMatch(
        /\.home-join-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/,
      );
      expect(responsiveJoin).toMatch(
        /\.home-cta--join\s*\{[^}]*width:\s*auto[^}]*min-width:\s*8rem[^}]*min-height:\s*2\.75rem/,
      );
      expect(responsiveJoin).not.toContain('min-height: 100%');
    });

    it('trennt Teilnahme und Veranstalten mit einer zurückhaltenden, luftig gesetzten Linie', async () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.home-role-divider')).not.toBeNull();

      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');
      const dividerRule = scss.slice(
        scss.indexOf('.home-role-divider {'),
        scss.indexOf('.home-host-intro {'),
      );

      expect(dividerRule).toMatch(/margin:\s*0\.5rem auto/);
      expect(dividerRule).toMatch(/width:\s*min\(72%,\s*26rem\)/);
      expect(dividerRule).toMatch(
        /border-block-start:\s*1px solid[\s\S]*?color-mix\(in srgb,\s*var\(--mat-sys-outline\) 70%,\s*var\(--mat-sys-primary\)\)/,
      );
    });

    it('behält auf Mobile und Tablet die Lesespalte und nutzt breite Desktops dreispaltig', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');
      const layout = scss.slice(0, scss.indexOf(':host-context(html.preset-playful)'));
      const desktopLayoutStart = layout.indexOf('@media (min-width: 1200px)');
      const compactLayout = layout.slice(0, desktopLayoutStart);
      const desktopLayout = layout.slice(desktopLayoutStart);

      expect(desktopLayoutStart).toBeGreaterThan(-1);
      expect(compactLayout).toMatch(
        /:host\.route-home \.l-page:first-child\s*\{[^}]*max-width:\s*40rem/,
      );
      expect(layout).toMatch(/\.home-main\s*\{[^}]*flex-direction:\s*column/);
      expect(compactLayout).toMatch(
        /\.home-host-stack\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
      );
      expect(desktopLayout).toMatch(
        /:host\.route-home \.l-page:first-child\s*\{[^}]*max-width:\s*var\(--app-toolbar-max-width\)[^}]*padding-inline:\s*0/,
      );
      expect(desktopLayout).toMatch(
        /\.home-host-stack\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)[^}]*align-items:\s*stretch/,
      );
      expect(desktopLayout).toMatch(
        /\.home-card#participant-entry\s*\{[^}]*max-width:\s*36rem[^}]*margin-inline:\s*auto/,
      );
      expect(desktopLayout).toMatch(
        /\.home-host-intro__description\s*\{[^}]*font:\s*var\(--mat-sys-body-medium\)[^}]*line-height:\s*1\.5/,
      );
      expect(layout).not.toMatch(
        /\.home-main\s*\{[^}]*grid-template-columns:\s*repeat|\.home-main\s*\{[^}]*grid-template-columns:\s*minmax/,
      );
    });

    it('ordnet Kartenaktionen passend zur verfügbaren Kartenbreite an', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');
      const desktopLayout = scss.slice(
        scss.indexOf('@media (min-width: 1200px)'),
        scss.indexOf('.home-cta--ready'),
      );

      expect(scss).toMatch(
        /\.home-card__actions--stack\s*\{[^}]*flex-direction:\s*column[^}]*justify-content:\s*center/,
      );
      expect(scss).toMatch(
        /\.home-live-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*column-gap:\s*0\.75rem[^}]*row-gap:\s*1rem/,
      );
      expect(scss).toMatch(
        /@media \(min-width:\s*600px\)\s*\{[\s\S]*?\.home-live-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)[^}]*row-gap:\s*0\.75rem/,
      );
      expect(scss).toMatch(
        /@media \(min-width:\s*600px\)\s*\{[\s\S]*?\.home-host-session-cta-row\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
      );
      expect(scss).toMatch(
        /\.home-card__cta-stack\s*\{[^}]*flex-direction:\s*column[^}]*gap:\s*1rem/,
      );
      expect(scss).toMatch(
        /\.home-prepare-secondary-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*column-gap:\s*0\.75rem[^}]*row-gap:\s*1rem/,
      );
      expect(scss).toMatch(
        /\.home-feedback-chip-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
      );
      expect(scss).toMatch(
        /@media \(min-width:\s*480px\)\s*\{[^}]*\.home-prepare-secondary-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
      );
      expect(desktopLayout).toMatch(
        /\.home-host-session-cta-row,\s*\.home-live-grid,\s*\.home-prepare-secondary-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*row-gap:\s*1rem/,
      );
      expect(desktopLayout).toMatch(
        /\.home-sync-entry__form\s*\{[^}]*flex-direction:\s*column[^}]*align-items:\s*stretch/,
      );
      expect(desktopLayout).toMatch(
        /\.home-join-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*25rem\) auto[^}]*justify-content:\s*start/,
      );
      expect(desktopLayout).toMatch(
        /\.home-card--feedback \.home-card__content\s*\{[^}]*flex:\s*1 1 auto[^}]*justify-content:\s*center[^}]*padding-block:\s*0\.75rem 1\.25rem/,
      );
      expect(desktopLayout).toMatch(
        /\.home-card--live,\s*\.home-card--feedback,\s*\.home-card--create\s*\{[^}]*flex-direction:\s*column[^}]*height:\s*100%/,
      );
      expect(desktopLayout).toMatch(
        /\.home-card--live \.home-card__actions,\s*\.home-card--create \.home-card__actions\s*\{[^}]*flex:\s*1 1 auto[^}]*justify-content:\s*center[^}]*align-content:\s*center/,
      );
      expect(desktopLayout).toMatch(
        /\.home-card \.home-card__content,\s*\.home-card \.home-card__actions\s*\{[^}]*padding-bottom:\s*1\.25rem/,
      );
      expect(desktopLayout).toMatch(/\.home-feedback-chip-grid\s*\{[^}]*gap:\s*1rem/);
      expect(desktopLayout).toMatch(
        /\.home-feedback-chip\s*\{[^}]*min-height:\s*4\.25rem[^}]*padding:\s*0\.65rem 0\.5rem/,
      );
      expect(scss).toMatch(/\.home-feedback-chip__label--wide-compact\s*\{[^}]*display:\s*none/);
      expect(desktopLayout).toMatch(
        /\.home-feedback-chip__label--wide-full\s*\{[^}]*display:\s*none/,
      );
      expect(desktopLayout).toMatch(
        /\.home-feedback-chip__label--wide-compact\s*\{[^}]*display:\s*block/,
      );
    });

    it('rendert die reduzierte Blitzlicht-Auswahl und zweizeilige Host-Aktionen', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();

      const liveGrid = fixture.nativeElement.querySelector('.home-live-grid') as HTMLElement | null;
      expect(liveGrid?.classList.contains('home-live-grid--with-recovery')).toBe(false);

      const liveButtons = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>('.home-live-grid .home-choice-button'),
      );
      expect(liveButtons).toHaveLength(3);
      expect(liveButtons.every((button) => button.classList.contains('home-cta'))).toBe(true);
      expect(
        liveButtons.map((button) =>
          button.querySelector('.home-choice-button__label')?.textContent?.trim(),
        ),
      ).toEqual(['Quiz', 'Q&A-Session', 'Blitzlicht']);
      expect(
        liveButtons.map((button) =>
          button.querySelector('.home-choice-button__description')?.textContent?.trim(),
        ),
      ).toEqual(['Wissen abfragen', 'Fragen & Wortwolke', 'Sofort-Feedback']);
      for (const button of liveButtons) {
        expect(button.querySelector('.home-choice-button__label')).not.toBeNull();
        expect(button.querySelector('.home-choice-button__description')).not.toBeNull();
      }
      expect(fixture.nativeElement.querySelector('.home-card__description')).toBeNull();

      const quickFeedbackButtons = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.home-feedback-chip-grid .home-feedback-chip',
        ),
      );
      expect(quickFeedbackButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
        'Tempo',
        'Stimmungsbild',
        'Ja · Nein · Vielleicht',
        'Sterne',
      ]);
      const compactMaybeLabel = fixture.nativeElement.querySelector<HTMLElement>(
        '.home-feedback-chip__label--wide-compact',
      );
      expect(compactMaybeLabel?.textContent?.trim()).toBe('Ja · Nein · ?');
      expect(compactMaybeLabel?.getAttribute('aria-hidden')).toBe('true');

      const prepareButtons = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.home-card--create .home-choice-button',
        ),
      );
      expect(prepareButtons).toHaveLength(2);
      for (const button of prepareButtons) {
        expect(button.querySelector('.home-choice-button__label')).not.toBeNull();
        expect(button.querySelector('.home-choice-button__description')).not.toBeNull();
      }
    });

    it('trennt den englischen Hero-Begriff vom Namen des Blitzlicht-Features', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const templatePath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.html');
      const template = readFileSync(templatePath, 'utf8');

      expect(template.match(/@@homeHero\.channelBlitzlicht/g)).toHaveLength(1);
      expect(template.match(/@@homeLiveCard\.quickFeedbackLabel/g)).toHaveLength(1);
    });

    it('hält Buttontexte bei mindestens M3 Body-Small und reduziert ihren Kontrast nicht', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');
      const descriptionRule = scss
        .slice(scss.indexOf('.home-choice-button__description {'))
        .split('}')[0];
      const playfulLibraryRule = scss
        .slice(scss.indexOf('.home-library-button.mat-mdc-outlined-button {'))
        .split('}')[0];

      expect(scss).toMatch(
        /\.home-choice-button__label\s*\{[^}]*font:\s*var\(--mat-sys-label-large\)/,
      );
      expect(descriptionRule).toMatch(/font:\s*var\(--mat-sys-body-small\)/);
      expect(descriptionRule).toMatch(/color:\s*inherit/);
      expect(descriptionRule).not.toMatch(/opacity|color-mix/);
      expect(scss).toMatch(/\.home-choice-button\s*\{[^}]*min-height:\s*3\.75rem/);
      expect(scss).toMatch(
        /\.home-host-session-cta-row__item > \.home-choice-button\s*\{[\s\S]*?--mdc-filled-button-container-shape:\s*var\(--mat-sys-corner-medium\)/,
      );
      expect(scss).toMatch(/\.home-feedback-chip\s*\{[^}]*min-height:\s*4rem/);
      expect(scss).not.toContain('var(--mat-sys-label-small)');
      expect(playfulLibraryRule).toMatch(/color:\s*var\(--mat-sys-on-surface\)/);
      expect(playfulLibraryRule).toMatch(/border-color:\s*var\(--mat-sys-on-surface-variant\)/);
    });

    it('behält für Spielerisch die vorhandenen tokenbasierten Magenta-/Violett-Flächen', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');
      const playful = scss.slice(scss.indexOf(':host-context(html.preset-playful)'));

      expect(playful).toMatch(
        /\.home-card--stage-main#participant-entry\s*\{[\s\S]*?var\(--mat-sys-primary-container\)[\s\S]*?var\(--mat-sys-tertiary\)/,
      );
      expect(playful).toMatch(
        /\.home-card\.home-card--stage-side\s*\{[\s\S]*?var\(--mat-sys-primary-container\)[\s\S]*?var\(--mat-sys-tertiary\)/,
      );
      expect(playful).toMatch(
        /\.home-card\.home-card--create\.home-card--stage-side\s*\{[\s\S]*?var\(--mat-sys-tertiary-container\)/,
      );
      expect(scss).toMatch(
        /:host-context\(html:not\(\.preset-playful\)\) \.home-card#participant-entry\s*\{[^}]*border-top:\s*3px solid var\(--mat-sys-primary\)/,
      );
    });

    it('hält Session-Code-Zellen in beiden Presets quadratisch und volle Breite', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');
      const playful = scss.slice(scss.indexOf(':host-context(html.preset-playful)'));
      const shared = scss.slice(0, scss.indexOf(':host-context(html.preset-playful)'));
      const sharedSegment = shared.slice(shared.indexOf('.home-code-segment {'));
      const sharedSegmentRule = sharedSegment.slice(0, sharedSegment.indexOf('}'));

      expect(sharedSegmentRule).toMatch(/flex:\s*1 1 0/);
      expect(sharedSegmentRule).toMatch(/aspect-ratio:\s*1/);
      expect(sharedSegmentRule).toMatch(/border-radius:\s*var\(--mat-sys-corner-medium\)/);
      expect(shared).toMatch(/\.home-code-entry\s*\{[^}]*max-width:\s*20\.5rem/);
      expect(sharedSegmentRule).not.toMatch(/height:\s*3(\.5)?rem/);
      expect(playful).not.toMatch(/\.home-code-segment\s*\{[^}]*max-width:\s*2\.5rem/);
      expect(playful).not.toMatch(/\.home-code-segment\s*\{[^}]*width:\s*3rem/);
      expect(scss).not.toContain('home-spotlight-panel');
      expect(sharedSegmentRule).toMatch(/border:\s*2px solid var\(--mat-sys-outline\)/);
      expect(playful).not.toMatch(/\.home-code-segment\s*\{[^}]*border-color:\s*color-mix/);
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

    it('behält Recent-Codes nach Quiz-FINISHED, solange Q&A joinbar ist', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.quickFeedback.isActiveForReconnect.query).mockResolvedValueOnce({
        active: false,
        sessionStatus: 'FINISHED',
        sessionType: 'QUIZ',
        qaJoinable: true,
      });
      const kept = { code: 'QAOPEN', usedAt: Date.now() };
      const comp = createHomeComponent();
      comp.recentSessionCodes.set([kept]);

      await (
        comp as unknown as {
          validateRecentSessions: () => Promise<void>;
        }
      ).validateRecentSessions();

      expect(comp.recentSessionCodes()).toEqual([kept]);
    });

    it('entfernt Recent-Codes nach Quiz-FINISHED, wenn Q&A nicht mehr joinbar ist', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.quickFeedback.isActiveForReconnect.query).mockResolvedValueOnce({
        active: false,
        sessionStatus: 'FINISHED',
        sessionType: 'QUIZ',
        qaJoinable: false,
      });
      const comp = createHomeComponent();
      comp.recentSessionCodes.set([{ code: 'QADONE', usedAt: Date.now() }]);

      await (
        comp as unknown as {
          validateRecentSessions: () => Promise<void>;
        }
      ).validateRecentSessions();

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
    it('legt über Q&A immer eine neue Host-Session an, auch mit vorhandenem Host-Token', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-qa-forced',
        code: 'QA9999',
        hostToken: 'qa-forced-token',
      });
      vi.mocked(trpc.session.getInfoForReconnect.query).mockClear();
      setHostToken('TEST01', 'host-token-test01');
      const comp = createHomeComponent();
      comp.sessionCode.set('TEST01');
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      await comp.openHeroHostTab('qa');

      expect(trpc.session.create.mutate).toHaveBeenCalled();
      expect(trpc.session.getInfoForReconnect.query).not.toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith('/session/QA9999/host?tab=qa&qaSetup=1');
      clearHostToken('TEST01');
    });

    it('prüft vorhandene oder kürzlich verwendete Codes über den Reconnect-Pfad', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.getInfo.query).mockClear();
      vi.mocked(trpc.session.getInfoForReconnect.query).mockClear();
      setHostToken('TEST01', 'host-token-test01');
      const comp = createHomeComponent();
      comp.sessionCode.set('TEST01');
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      await comp.openHeroHostTab('quickFeedback');

      expect(trpc.session.getInfoForReconnect.query).toHaveBeenCalledWith({
        code: 'TEST01',
        anonymousClientId: expect.any(String),
      });
      expect(trpc.session.create.mutate).not.toHaveBeenCalled();
      clearHostToken('TEST01');
    });

    it('legt ein neues Blitzlicht an, wenn die letzte Host-Session ohne Q&A beendet ist', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-qf-new',
        code: 'QF0002',
        hostToken: 'qf-new-token',
      });
      vi.mocked(trpc.session.getInfoForReconnect.query).mockResolvedValueOnce({
        id: 'sess-finished',
        code: 'TEST01',
        type: 'QUIZ',
        status: 'FINISHED',
        serverTime: '2026-09-19T12:00:00.000Z',
        quizName: 'Live',
        title: null,
        participantCount: 2,
        qaEnabled: false,
        qaOpen: false,
        qaClosesAt: null,
        channels: {
          quiz: { enabled: true },
          qa: { enabled: false, open: false, state: 'DISABLED' as const },
          quickFeedback: { enabled: false, open: false },
        },
      });
      setHostToken('TEST01', 'host-token-test01');
      const comp = createHomeComponent();
      comp.sessionCode.set('TEST01');
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      await comp.openHeroHostTab('quickFeedback');

      expect(trpc.session.create.mutate).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith('/session/QF0002/host?tab=quickFeedback');
      clearHostToken('TEST01');
    });

    it('startet eine neue Host-Session wenn nur ein Teilnehmer-Code ohne Host-Token bekannt ist', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-qa-new',
        code: 'QA0001',
        hostToken: 'qa-new-token',
      });
      const comp = createHomeComponent();
      comp.sessionCode.set('PART01');
      comp.recentSessionCodes.set([{ code: 'PART01', usedAt: Date.now() }]);
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      await comp.openHeroHostTab('qa');

      expect(trpc.session.create.mutate).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith('/session/QA0001/host?tab=qa&qaSetup=1');
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

      expect(matDialogMock.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ setupStep: 1, setupStepCount: 2 }),
        }),
      );
      expect(trpc.session.create.mutate).toHaveBeenCalledWith({
        type: 'QUIZ',
        qaEnabled: true,
        qaTitle: 'Fragen & Antworten',
        nicknameTheme: 'KINDERGARTEN',
        allowCustomNicknames: false,
        anonymousMode: false,
        teamMode: false,
        teamCount: null,
        teamAssignment: 'AUTO',
        teamNames: [],
        timeZone: expect.any(String),
      });
      expect(navigateSpy).toHaveBeenCalledWith('/session/QA1234/host?tab=qa&qaSetup=1');
      expect(comp.joinError()).toBeNull();
    });

    it('sperrt die Live-Aktionen während eine Host-Session angelegt wird', async () => {
      const { trpc } = await import('../../core/trpc.client');
      let resolveCreate!: (value: { id: string; code: string; hostToken: string }) => void;
      vi.mocked(trpc.session.create.mutate).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          }),
      );
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const comp = createHomeComponent();

      const firstStart = comp.openHeroHostTab('qa');
      await vi.waitUntil(() => vi.mocked(trpc.session.create.mutate).mock.calls.length === 1);

      expect(comp.hostSessionStarting()).toBe('qa');
      await comp.openHeroHostTab('quickFeedback');
      expect(trpc.session.create.mutate).toHaveBeenCalledTimes(1);

      resolveCreate({ id: 'sess-pending', code: 'QAWAIT', hostToken: 'pending-token' });
      await firstStart;

      expect(comp.hostSessionStarting()).toBeNull();
    });

    it('zeigt beim gedrosselten Q&A-Schnellstart die konkrete Wartezeit', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockRejectedValueOnce({
        message: 'Zu viele Session-Erstellungen. Bitte später erneut versuchen.',
        data: { retryAfterSeconds: 23 },
      });

      const comp = createHomeComponent();

      await comp.openHeroHostTab('qa');

      expect(comp.hostSessionError()).toBe(
        'Zu viele Session-Erstellungen. Bitte später erneut versuchen.\n' +
          'Bitte in 23 Sekunden erneut versuchen.',
      );
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
        qaTitle: 'Fragen & Antworten',
        nicknameTheme: 'HIGH_SCHOOL',
        allowCustomNicknames: false,
        anonymousMode: false,
        teamMode: false,
        teamCount: null,
        teamAssignment: 'AUTO',
        teamNames: [],
        timeZone: expect.any(String),
      });
      expect(navigateSpy).toHaveBeenCalledWith('/session/QA5678/host?tab=qa&qaSetup=1');
      expect(comp.joinError()).toBeNull();
    });

    it('übernimmt den gewählten Anonymmodus in den direkten Q&A-Start', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-anonymous',
        code: 'QAANON',
        hostToken: 'qa-anonymous-token',
      });
      matDialogMock.open.mockReturnValueOnce({
        afterClosed: () =>
          of({
            identityMode: 'ANONYMOUS',
            nicknameTheme: 'MIDDLE_SCHOOL',
          }),
      } as ReturnType<(typeof matDialogMock)['open']>);
      const comp = createHomeComponent();
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      await comp.openHeroHostTab('qa');

      expect(trpc.session.create.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          qaEnabled: true,
          nicknameTheme: 'MIDDLE_SCHOOL',
          allowCustomNicknames: false,
          anonymousMode: true,
        }),
      );
    });

    it('übernimmt selbst gewählte Nicknames in den direkten Q&A-Start', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-custom',
        code: 'QACSTM',
        hostToken: 'qa-custom-token',
      });
      matDialogMock.open.mockReturnValueOnce({
        afterClosed: () =>
          of({
            identityMode: 'CUSTOM_NICKNAME',
            nicknameTheme: 'HIGH_SCHOOL',
          }),
      } as ReturnType<(typeof matDialogMock)['open']>);
      const comp = createHomeComponent();
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      await comp.openHeroHostTab('qa');

      expect(trpc.session.create.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          qaEnabled: true,
          nicknameTheme: 'HIGH_SCHOOL',
          allowCustomNicknames: true,
          anonymousMode: false,
        }),
      );
    });

    it('legt nach Abbruch der Teilnahmeauswahl keine Q&A-Session an', async () => {
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockClear();
      matDialogMock.open.mockReturnValueOnce({
        afterClosed: () => of(undefined),
      } as ReturnType<(typeof matDialogMock)['open']>);
      const comp = createHomeComponent();
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      await comp.openHeroHostTab('qa');

      expect(trpc.session.create.mutate).not.toHaveBeenCalled();
      expect(navigateSpy).not.toHaveBeenCalled();
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
        timeZone: expect.any(String),
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
        timeZone: expect.any(String),
      });
      expect(navigateSpy).toHaveBeenCalledWith('/session/QF5678/host?tab=quickFeedback');
      expect(comp.joinError()).toBeNull();
    });
  });

  describe('PWA-Homescreen-Shortcuts', () => {
    it('öffnet Q&A aus ?host=qa über denselben Host-Flow wie der Hero-Chip', async () => {
      setRouteQueryParams({ host: 'qa', homescreen: '1' });
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-qa-shortcut',
        code: 'QA9999',
        hostToken: 'qa-shortcut-token',
      });
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      const fixture = createHomeFixture();
      fixture.detectChanges();
      vi.runOnlyPendingTimers();
      await vi.waitUntil(() => navigateSpy.mock.calls.length === 1, {
        timeout: 1000,
        interval: 10,
      });

      expect(trpc.session.create.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ qaEnabled: true }),
      );
      expect(navigateSpy).toHaveBeenCalledWith('/session/QA9999/host?tab=qa&qaSetup=1');
    });

    it('erstellt bei PWA-Shortcut eine neue Session trotz bekanntem Teilnehmer-Code ohne Host-Token', async () => {
      localStorage.setItem(
        'home-recent-sessions',
        JSON.stringify([{ code: 'PART01', usedAt: Date.now() }]),
      );
      setRouteQueryParams({ host: 'qa', homescreen: '1' });
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-qa-shortcut-part',
        code: 'QA8888',
        hostToken: 'qa-shortcut-part-token',
      });
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      const fixture = createHomeFixture();
      fixture.detectChanges();
      vi.runOnlyPendingTimers();
      await vi.waitUntil(() => navigateSpy.mock.calls.length === 1, {
        timeout: 1000,
        interval: 10,
      });

      expect(trpc.session.create.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ qaEnabled: true }),
      );
      expect(navigateSpy).toHaveBeenCalledWith('/session/QA8888/host?tab=qa&qaSetup=1');
      expect(navigateSpy).not.toHaveBeenCalledWith(expect.stringContaining('PART01'));
    });

    it('startet Blitzlicht aus ?host=quickFeedback über denselben Host-Flow wie der Hero-Chip', async () => {
      setRouteQueryParams({ host: 'quickFeedback', homescreen: '1' });
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.session.create.mutate).mockResolvedValueOnce({
        id: 'sess-qf-shortcut',
        code: 'QF9999',
        hostToken: 'qf-shortcut-token',
      });
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      const fixture = createHomeFixture();
      fixture.detectChanges();
      vi.runOnlyPendingTimers();
      await vi.waitUntil(() => navigateSpy.mock.calls.length === 1, {
        timeout: 1000,
        interval: 10,
      });

      expect(trpc.session.create.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ quickFeedbackEnabled: true }),
      );
      expect(navigateSpy).toHaveBeenCalledWith('/session/QF9999/host?tab=quickFeedback');
    });

    it('startet keine Session bei unbekanntem host-Query', async () => {
      setRouteQueryParams({ host: 'quiz' });
      const { trpc } = await import('../../core/trpc.client');
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      const fixture = createHomeFixture();
      fixture.detectChanges();
      vi.runOnlyPendingTimers();

      expect(trpc.session.create.mutate).not.toHaveBeenCalled();
      expect(navigateSpy).not.toHaveBeenCalled();
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
      expect(fixture.nativeElement.textContent ?? '').not.toContain('Als Host anzeigen');
      expect(fixture.nativeElement.querySelector('.home-error-link')).toBeNull();
      expect(vi.mocked(trpc.motd.getCurrent.query)).not.toHaveBeenCalled();
    });

    it('leitet nach Quiz-FINISHED ins Q&A-Onboarding, solange der Kanal offen ist', async () => {
      setRouteQueryParams({ join: 'abc123' });
      const { trpc } = await import('../../core/trpc.client');
      vi.mocked(trpc.quickFeedback.isActive.query).mockResolvedValueOnce({
        active: false,
        sessionStatus: 'FINISHED',
        sessionType: 'QUIZ',
        qaJoinable: true,
      });
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
      expect(fixture.componentInstance.joinError()).toBeNull();
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

      const motdHeader = TestBed.inject(MotdHeaderStateService);
      motdHeader.hasActiveOverlay.set(true);
      expect(motdHeader.motdToolbarAttention()).toBe(true);

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
      expect(motdHeader.motdToolbarAttention()).toBe(false);
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

    it('öffnet in einer neuen Sitzung die aktuelle ungelesene MOTD, auch wenn eine andere bereits dismissed ist', async () => {
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

      expect(comp.motd()?.id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
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
      expect(btn?.getAttribute('aria-label')).toBe('Geteilte Sammlung nutzen');
      expect(header.lastElementChild).toBe(btn);
      expect(fixture.nativeElement.querySelector('.home-card__tertiary-link')).toBeNull();

      btn?.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.syncLinkVisible()).toBe(true);
      expect(fixture.nativeElement.querySelector('#home-sync-entry')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.home-sync-backdrop')).not.toBeNull();
      expect(
        fixture.nativeElement
          .querySelector('.home-card--create')
          ?.classList.contains('home-card--sync-open'),
      ).toBe(true);
      expect(fixture.nativeElement.querySelector('.home-hero-band')?.hasAttribute('inert')).toBe(
        true,
      );
      expect(fixture.nativeElement.querySelector('#participant-entry')?.hasAttribute('inert')).toBe(
        true,
      );
      expect(
        fixture.nativeElement.querySelector('#host-quick-feedback')?.hasAttribute('inert'),
      ).toBe(true);
      expect(
        fixture.nativeElement.querySelector('.home-card__cta-stack')?.hasAttribute('inert'),
      ).toBe(true);
      expect(fixture.nativeElement.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);
    });

    it('legt die offene Sync-Karte im Preset Spielerisch ueber den Backdrop', async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'home.component.scss');
      const scss = readFileSync(scssPath, 'utf8');
      const playful = scss.slice(scss.indexOf(':host-context(html.preset-playful)'));

      expect(scss).toMatch(/\.home-sync-backdrop\s*\{[^}]*z-index:\s*1080/);
      expect(scss).toMatch(/\.home-card\.home-card--sync-open\s*\{[^}]*z-index:\s*1081/);
      expect(playful).toMatch(
        /\.home-card\.home-card--stage-side\.home-card--sync-open\s*\{[^}]*z-index:\s*1081/,
      );
    });

    it('schliesst das Sync-Panel per Backdrop und legt den Fokus auf das Icon zurueck', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector(
        '.home-card--create .home-card__sync-btn',
      ) as HTMLButtonElement;

      btn.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.syncLinkVisible()).toBe(true);

      const backdrop = fixture.nativeElement.querySelector(
        '.home-sync-backdrop',
      ) as HTMLButtonElement;
      backdrop.click();
      fixture.detectChanges();
      vi.advanceTimersByTime(0);

      expect(fixture.componentInstance.syncLinkVisible()).toBe(false);
      expect(fixture.nativeElement.querySelector('#home-sync-entry')).toBeNull();
      expect(document.activeElement).toBe(btn);
    });

    it('schliesst das Sync-Panel per Escape', () => {
      const fixture = createHomeFixture();
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      comp.toggleSyncLinkEntry();
      fixture.detectChanges();
      expect(comp.syncLinkVisible()).toBe(true);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(comp.syncLinkVisible()).toBe(false);
    });

    it('bietet auf der Startseite nur das Nutzen einer geteilten Sammlung', () => {
      const fixture = createHomeFixture();
      const comp = fixture.componentInstance;

      comp.toggleSyncLinkEntry();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Füge den Link ein, den du von einem anderen Gerät bekommen hast');
      expect(text).toContain('Sammlung nutzen');
      expect(text).not.toContain('Sync-Link anzeigen');
      expect(text).not.toContain('Sammlung teilen');
      expect(fixture.nativeElement.querySelector('.home-sync-entry__share-link')).toBeNull();
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

    it('lehnt den eigenen Sync-Link der aktuellen Sammlung ab', async () => {
      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const quizStore = TestBed.inject(QuizStoreService);
      const activateSpy = vi.spyOn(quizStore, 'activateSyncRoom').mockImplementation(() => {});
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const ownId = quizStore.syncRoomId();

      comp.syncLinkValue.set(`https://arsnova.eu/quiz/sync/${ownId}`);
      await comp.openSyncLink();

      expect(activateSpy).not.toHaveBeenCalled();
      expect(navSpy).not.toHaveBeenCalled();
      expect(comp.syncLinkError()).toBe(
        'Das ist dein eigener Sync-Link. Hier fügst du den Link einer anderen Sammlung ein.',
      );
    });

    it('laesst denselben Raum mit rotiertem Share-Token zu', async () => {
      const comp = createHomeComponent();
      const router = TestBed.inject(Router);
      const quizStore = TestBed.inject(QuizStoreService);
      const activateSpy = vi.spyOn(quizStore, 'activateSyncRoom').mockImplementation(() => {});
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const ownId = quizStore.syncRoomId();
      const currentToken = `v1.${ownId}.1.${'a'.repeat(43)}`;
      const rotatedToken = `v1.${ownId}.2.${'b'.repeat(43)}`;
      quizStore.syncShareToken.set(currentToken);

      comp.syncLinkValue.set(`https://arsnova.eu/quiz/sync/${ownId}#s=${rotatedToken}`);
      await comp.openSyncLink();

      expect(activateSpy).toHaveBeenCalledWith(ownId, {
        markShared: true,
        shareToken: rotatedToken,
      });
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
      expect(hint?.textContent).toContain('Du nutzt die Sammlung von');
      expect(hint?.textContent).toContain('Chrome auf Mac');
    });

    it('zeigt die Origin der geteilten Sammlung, nicht den verbundenen Peer', () => {
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
      expect(hint?.textContent).toContain('Firefox auf Mac');
      expect(hint?.textContent).not.toContain('Chrome auf Mac');
    });

    it('zeigt auf dem Origin-Geraet keinen Nutzen-Hinweis, auch wenn Peers verbunden sind', () => {
      const quizStore = TestBed.inject(QuizStoreService);
      quizStore.librarySharingMode.set('shared');
      quizStore.originDeviceLabel.set(quizStore.currentDeviceLabel());
      quizStore.originBrowserLabel.set(quizStore.currentBrowserLabel());
      quizStore.syncPeerInfos.set([
        {
          deviceId: 'peer-device',
          deviceLabel: 'iPhone',
          browserLabel: 'Safari',
        },
      ]);

      const fixture = createHomeFixture();
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector(
        '.home-host-sharing-hint',
      ) as HTMLElement | null;
      expect(hint).toBeNull();
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

    it('zeigt ohne eigenes Quiz Erstellen tonal und die Sammlung outlined', () => {
      const fixture = createHomeFixture();
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector('.home-card--create') as HTMLElement;

      expect(card.querySelectorAll('.mat-mdc-unelevated-button')).toHaveLength(0);
      expect(fixture.nativeElement.textContent).not.toContain('Letztes Quiz starten');

      const create = Array.from(card.querySelectorAll('.home-cta')).find((el) =>
        el.textContent?.includes('Neues Quiz erstellen'),
      ) as HTMLAnchorElement;
      const library = Array.from(card.querySelectorAll('.home-cta')).find((el) =>
        el.textContent?.includes('Quiz-Sammlung öffnen'),
      ) as HTMLAnchorElement;

      expect(create.classList.contains('mat-tonal-button')).toBe(true);
      expect(library.classList.contains('home-library-button')).toBe(true);
      expect(library.classList.contains('mat-mdc-outlined-button')).toBe(true);
      expect(library.classList.contains('mat-tonal-button')).toBe(false);
    });

    it('zeigt mit eigenem Quiz nur Starten gefuellt, Erstellen tonal und Sammlung outlined', () => {
      const quizStore = TestBed.inject(QuizStoreService);
      quizStore.createQuiz({ name: 'Live-Quiz', description: '' });

      const fixture = createHomeFixture();
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector('.home-card--create') as HTMLElement;

      const filled = card.querySelectorAll('.mat-mdc-unelevated-button');
      expect(filled).toHaveLength(1);
      expect(filled[0]?.textContent).toContain('Letztes Quiz starten');
      expect(card.textContent).toContain('Neues Quiz erstellen');

      const create = Array.from(card.querySelectorAll('.home-cta')).find((el) =>
        el.textContent?.includes('Neues Quiz erstellen'),
      ) as HTMLAnchorElement | undefined;
      const library = Array.from(card.querySelectorAll('.home-cta')).find((el) =>
        el.textContent?.includes('Quiz-Sammlung öffnen'),
      ) as HTMLAnchorElement | undefined;
      expect(create?.classList.contains('home-cta--secondary')).toBe(true);
      expect(create?.classList.contains('mat-mdc-unelevated-button')).toBe(false);
      expect(create?.classList.contains('mat-tonal-button')).toBe(true);
      expect(library?.classList.contains('home-library-button')).toBe(true);
      expect(library?.classList.contains('mat-mdc-outlined-button')).toBe(true);
      expect(library?.classList.contains('mat-tonal-button')).toBe(false);
    });
  });
});
