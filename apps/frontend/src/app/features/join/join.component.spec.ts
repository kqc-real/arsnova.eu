/**
 * Unit-Tests für JoinComponent (Story 3.1: Code validieren, 3.2: Nickname, Join).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { JoinComponent } from './join.component';
import { trpc } from '../../core/trpc.client';
import { consumeParticipantJoinArrival } from '../../core/participant-join-arrival';
import { peekConfirmedParticipantTeam } from '../../core/participant-team-confirmation';
import { NICKNAME_LISTS } from './nickname-themes';
import { resetAnonymousClientIdForTests } from '../../core/anonymous-client-id';
import { storeParticipantCapability } from '../../core/participant-session-access';

const ANONYMOUS_CLIENT_ID = '33333333-3333-4333-8333-333333333333';

const mockSession = {
  id: 'sess-1',
  code: 'ABC123',
  type: 'QUIZ' as const,
  status: 'LOBBY' as const,
  serverTime: '2026-03-24T12:00:00.000Z',
  quizName: 'Test-Quiz',
  title: null as string | null,
  participantCount: 5,
  nicknameTheme: 'NOBEL_LAUREATES' as const,
  allowCustomNicknames: true,
};

const { participantIds } = vi.hoisted(() => ({
  participantIds: {
    current: '11111111-1111-4111-8111-111111111111',
    existing: '22222222-2222-4222-8222-222222222222',
  },
}));

vi.mock('../../core/trpc.client', () => ({
  refreshTrpcWsBinding: vi.fn(),
  trpc: {
    session: {
      getInfo: {
        query: vi.fn().mockResolvedValue({
          id: 'sess-1',
          code: 'ABC123',
          type: 'QUIZ',
          status: 'LOBBY',
          quizName: 'Test-Quiz',
          title: null,
          participantCount: 5,
          nicknameTheme: 'NOBEL_LAUREATES',
          allowCustomNicknames: true,
        }),
      },
      getInfoForReconnect: {
        query: vi.fn().mockResolvedValue({
          id: 'sess-1',
          code: 'ABC123',
          type: 'QUIZ',
          status: 'LOBBY',
          quizName: 'Test-Quiz',
          title: null,
          participantCount: 5,
          nicknameTheme: 'NOBEL_LAUREATES',
          allowCustomNicknames: true,
        }),
      },
      getTeams: { query: vi.fn().mockResolvedValue({ teams: [], teamCount: 0 }) },
      getParticipantNicknames: {
        query: vi.fn().mockResolvedValue({ nicknames: [], participantCount: 0 }),
      },
      checkParticipantNickname: {
        query: vi.fn().mockResolvedValue({ available: true }),
      },
      join: {
        mutate: vi.fn().mockResolvedValue({
          id: 'sess-1',
          code: 'ABC123',
          type: 'QUIZ',
          status: 'LOBBY',
          serverTime: '2026-03-24T12:00:00.000Z',
          quizName: 'Test-Quiz',
          title: null,
          participantCount: 6,
          participantId: participantIds.current,
          rejoinToken: participantIds.current,
        }),
      },
    },
  },
}));

describe('JoinComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('arsnova-anonymous-client-id', ANONYMOUS_CLIENT_ID);
    resetAnonymousClientIdForTests();
    sessionStorage.clear();
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue(mockSession);
    vi.mocked(trpc.session.getTeams.query).mockResolvedValue({ teams: [], teamCount: 0 });
    vi.mocked(trpc.session.getParticipantNicknames.query).mockResolvedValue({
      nicknames: [],
      participantCount: 0,
    });
    vi.mocked(trpc.session.checkParticipantNickname.query).mockResolvedValue({
      available: true,
    });
    vi.mocked(trpc.session.join.mutate).mockResolvedValue({
      ...mockSession,
      participantId: participantIds.current,
      rejoinToken: participantIds.current,
    });
    TestBed.configureTestingModule({
      imports: [JoinComponent],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => (key === 'code' ? 'ABC123' : null) } },
          },
        },
      ],
    });
  });

  function createWithCode(code: string): {
    fixture: ReturnType<typeof TestBed.createComponent<JoinComponent>>;
    comp: JoinComponent;
  } {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: { paramMap: { get: (key: string) => (key === 'code' ? code : null) } },
      },
    });
    const fixture = TestBed.createComponent(JoinComponent);
    const comp = fixture.componentInstance;
    return { fixture, comp };
  }

  function setTakenNicknames(comp: JoinComponent, nicknames: readonly string[]): void {
    comp.takenNicknames.set(
      new Set(nicknames.map((nickname) => nickname.trim().slice(0, 30).toLowerCase())),
    );
  }

  it('lädt Session bei gültigem 6-stelligen Code', async () => {
    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(comp.session()).toEqual(mockSession);
    expect(comp.error()).toBeNull();
    expect(comp.loading()).toBe(false);
    expect(comp.anonymousNickname(6)).toBe('Teilnehmende 6');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Dein Name');
    expect(trpc.session.getParticipantNicknames.query).not.toHaveBeenCalled();
  });

  it('zeigt vor dem Beitritt das geplante Sessionende nur in Q&A-Sessions', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      type: 'Q_AND_A',
      quizName: null,
      title: 'Offene Fragen',
      expiresAt: '2026-09-15T10:00:00.000Z',
      timeZone: 'Europe/Berlin',
      postProcessingEndsAt: '2026-09-29T10:00:00.000Z',
      purgeEligibleAt: '2026-09-29T10:00:00.000Z',
    });
    const { fixture } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const retention = (fixture.nativeElement as HTMLElement).querySelector('.join-card__retention');
    expect(retention?.getAttribute('role')).toBe('note');
    expect(retention?.textContent).toContain('Geplantes Sessionende');
    expect(retention?.textContent).not.toContain('Sessiondaten frühestens löschbar');
    expect(retention?.textContent).not.toContain('kein zusätzlicher Teilnehmerzugriff');
  });

  it('blendet das geplante Sessionende beim Beitritt zu Quiz und Blitzlicht aus', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      type: 'QUIZ',
      expiresAt: '2026-09-15T10:00:00.000Z',
      timeZone: 'Europe/Berlin',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    const { fixture } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.join-card__retention'),
    ).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Geplantes Sessionende',
    );
  });

  it('fixiert den Beitrittsbutton im unteren Aktionsbereich des Join-Clients', async () => {
    const { fixture } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const bottomAction = host.querySelector('.join-page__bottom-action') as HTMLElement | null;
    const submitButtons = host.querySelectorAll('.join-card__submit');

    expect(host.querySelector('.join-page')?.className).toContain('join-page--with-bottom-action');
    expect(bottomAction).not.toBeNull();
    expect(bottomAction?.textContent).toContain('Name wählen');
    expect(submitButtons).toHaveLength(1);
  });

  it('mischt Join-Hinweisflächen mit Surface statt Weiß', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const styles = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'join.component.scss'),
      'utf8',
    );

    expect(styles).toMatch(/&__info \{[\s\S]*primary-container\) 78%, var\(--mat-sys-surface\)/);
    expect(styles).toMatch(
      /&__team-playful \{[\s\S]*tertiary-container\) 78%, var\(--mat-sys-surface\)/,
    );
    expect(styles).not.toMatch(/primary-container\) 78%, white/);
    expect(styles).not.toMatch(/tertiary-container\) 78%, white/);
  });

  it('zeigt Fehler bei ungültigem Code (zu kurz)', async () => {
    const { fixture, comp } = createWithCode('AB');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.error()).toBe('Ungültiger Session-Code.');
    expect(comp.session()).toBeNull();
    expect(comp.loading()).toBe(false);
  });

  it('zeigt Fehlermeldung wenn getInfo fehlschlägt', async () => {
    vi.mocked(trpc.session.getInfo.query).mockRejectedValueOnce(
      new Error('Session nicht gefunden.'),
    );

    const { fixture, comp } = createWithCode('XYZ999'); // 6 Zeichen, damit getInfo aufgerufen wird
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.error()).toBe('Session nicht gefunden.');
    expect(comp.session()).toBeNull();
    expect(fixture.nativeElement.textContent ?? '').toContain('Zur Startseite');
  });

  it('zeigt Fehler wenn Session FINISHED', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      status: 'FINISHED' as const,
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.error()).toBe('Diese Session wurde gelöscht.');
    expect(comp.session()).toBeNull();
    expect(fixture.nativeElement.textContent ?? '').toContain('Zur Startseite');
    expect(fixture.nativeElement.textContent ?? '').not.toContain('Als Host anzeigen');
    expect(fixture.nativeElement.querySelector('.join-card__host-link')).toBeNull();
  });

  it('lässt den Join nach Quiz-FINISHED zu, solange Q&A offen ist', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      status: 'FINISHED' as const,
      channels: {
        quiz: { enabled: true },
        qa: {
          enabled: true,
          open: true,
          title: 'Fragen',
          moderationMode: true,
          state: 'OPEN',
          closesAt: '2026-09-20T08:00:00.000Z',
        },
        quickFeedback: { enabled: false, open: false },
      },
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.error()).toBeNull();
    expect(comp.errorSessionFinished()).toBe(false);
    expect(comp.session()?.code).toBe('ABC123');
  });

  it('blockiert den Join nach globalem Session-Ende trotz noch offener Q&A-Frist', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      status: 'FINISHED' as const,
      endedAt: '2026-09-21T05:22:54.470Z',
      expiresAt: '2026-09-21T14:47:57.810Z',
      qaClosesAt: '2026-09-21T14:47:57.810Z',
      channels: {
        quiz: { enabled: true },
        qa: {
          enabled: true,
          open: false,
          title: 'Fragen',
          moderationMode: true,
          state: 'MANUALLY_CLOSED',
          closesAt: '2026-09-21T14:47:57.810Z',
        },
        quickFeedback: { enabled: true, open: false },
      },
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.error()).toBe('Diese Session wurde gelöscht.');
    expect(comp.errorSessionFinished()).toBe(true);
    expect(comp.session()).toBeNull();
    expect(fixture.nativeElement.textContent ?? '').not.toContain('Jetzt beitreten');
  });

  it('stellt Nickname-Liste bereit bei QUIZ mit nicknameTheme (Story 3.2)', async () => {
    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.nicknameOptions().length).toBeGreaterThanOrEqual(50);
    expect(comp.nicknameOptions()[0]).toBe('Marie Curie');
  });

  it('aktiviert den generativen Reserve-Pool erst nach Erschoepfung der Ursprungsliste', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      allowCustomNicknames: false,
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.nicknameFallbackActive()).toBe(false);
    expect(comp.nicknameOptions()[0]).toBe('Marie Curie');
    expect(comp.nicknameOptions()).not.toContain('Marie Curie 2');
  });

  it('wechselt erst nach voller Erschoepfung auf generierte Reserve-Namen', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      allowCustomNicknames: false,
    });
    const { fixture, comp } = createWithCode('ABC123');
    setTakenNicknames(comp, NICKNAME_LISTS.NOBEL_LAUREATES);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.nicknameFallbackActive()).toBe(true);
    expect(comp.nicknameOptions()[0]).toBe('Marie Curie 2');
    expect(comp.nicknameOptions()).not.toContain('Marie Curie');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Die Namensliste ist vollständig vergeben. Du kannst jetzt aus weiteren Pseudonymen wählen.',
    );
  });

  it('ueberspringt bereits vergebene Reserve-Namen', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      allowCustomNicknames: false,
    });
    const { fixture, comp } = createWithCode('ABC123');
    setTakenNicknames(comp, [...NICKNAME_LISTS.NOBEL_LAUREATES, 'Marie Curie 2']);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.nicknameFallbackActive()).toBe(true);
    expect(comp.nicknameOptions()[0]).toBe('Albert Einstein 2');
    expect(comp.nicknameOptions()).not.toContain('Marie Curie 2');
  });

  it('markiert vergebene Nicknames (isTaken)', async () => {
    const { fixture, comp } = createWithCode('ABC123');
    setTakenNicknames(comp, ['Marie Curie']);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.isTaken('Marie Curie')).toBe(true);
    expect(comp.isTaken('Albert Einstein')).toBe(false);
  });

  it('markiert lange Pseudonyme als vergeben, wenn das Backend den gekuerzten Namen meldet', async () => {
    const longNickname = NICKNAME_LISTS.PRIMARY_SCHOOL.find((name) => name.length > 30)!;
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      nicknameTheme: 'PRIMARY_SCHOOL',
      allowCustomNicknames: false,
    });
    const { fixture, comp } = createWithCode('ABC123');
    setTakenNicknames(comp, [longNickname]);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.isTaken(longNickname)).toBe(true);
  });

  it('zeigt bei Q&A standardmäßig die Kita-Pseudonymliste auch ohne Quiz-Einstellungen', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      id: 'sess-qa',
      code: 'ABC123',
      type: 'Q_AND_A',
      status: 'LOBBY',
      serverTime: '2026-03-24T12:00:00.000Z',
      quizName: null,
      title: 'Offene Fragen',
      participantCount: 3,
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: false,
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.showCustomNickname()).toBe(false);
    expect(comp.showNicknameList()).toBe(true);
    expect(comp.nicknameOptions()[0]).toBe(NICKNAME_LISTS.KINDERGARTEN[0]);
    expect(comp.canSubmit()).toBe(false);
  });

  it('erzwingt auch in quizlosen Sessions die Pseudonymauswahl aus dem Onboarding-Profil', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      id: 'sess-qa',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      serverTime: '2026-03-24T12:00:00.000Z',
      quizName: null,
      title: 'Offene Fragen',
      participantCount: 3,
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: false,
      channels: {
        quiz: { enabled: false },
        qa: { enabled: true, open: true, title: 'Offene Fragen', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.showCustomNickname()).toBe(false);
    expect(comp.showNicknameList()).toBe(true);
    expect(comp.nicknameOptions().length).toBeGreaterThan(0);
  });

  it('tritt einer quizlosen Q&A-Session im Anonymmodus ohne Namensformular direkt bei', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      quizName: null,
      anonymousMode: true,
      allowCustomNicknames: false,
      channels: {
        quiz: { enabled: false },
        qa: { enabled: true, open: true, title: 'Offene Fragen', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    const { fixture } = createWithCode('ABC123');
    const router = fixture.debugElement.injector.get(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(trpc.session.join.mutate).toHaveBeenCalledWith({
      code: 'ABC123',
      nickname: 'Teilnehmende 6',
      anonymousClientId: ANONYMOUS_CLIENT_ID,
      rejoinToken: undefined,
      joinIdempotencyKey: expect.any(String),
      productFeedbackClaimToken: undefined,
      teamId: undefined,
    });
    expect(navSpy).toHaveBeenCalledWith(['session', 'ABC123', 'vote'], {
      queryParams: { tab: 'quiz' },
    });
  });

  it('liefert im Kita-Modus Emoji und Namen fuer den Select-Trigger', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    comp.selectedNickname.set('Roter Drache');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.selectedNickname()).toBe('Roter Drache');
    expect(comp.kindergartenEmojiForSelected()).toBe('🐉');
  });

  it('behaelt im Kita-Reserve-Pool das passende Tier-Emoji', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
    });
    const { fixture, comp } = createWithCode('ABC123');
    setTakenNicknames(comp, NICKNAME_LISTS.KINDERGARTEN);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    comp.selectedNickname.set('Roter Drache 2');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.nicknameFallbackActive()).toBe(true);
    expect(comp.kindergartenEmojiForSelected()).toBe('🐉');
    expect(comp.kindergartenEmojiForOption('Roter Drache 2', 0)).toBe('🐉');
  });

  it('ruft join mit Code und Nickname auf und navigiert zu vote (Story 3.2)', async () => {
    const { fixture, comp } = createWithCode('ABC123');
    const router = fixture.debugElement.injector.get(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    comp.selectedNickname.set('Ada Yonath');
    comp.submitJoin();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

    expect(trpc.session.join.mutate).toHaveBeenCalledWith({
      code: 'ABC123',
      nickname: 'Ada Yonath',
      anonymousClientId: ANONYMOUS_CLIENT_ID,
      rejoinToken: undefined,
      joinIdempotencyKey: expect.any(String),
      productFeedbackClaimToken: undefined,
      teamId: undefined,
    });
    expect(consumeParticipantJoinArrival('ABC123')).toBe(true);
    expect(navSpy).toHaveBeenCalledWith(['session', 'ABC123', 'vote'], {
      queryParams: { tab: 'quiz' },
    });
  });

  it('behaelt die Lobby bei Nickname-Konflikt und zeigt den Fehler inline', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      allowCustomNicknames: false,
    });
    vi.mocked(trpc.session.join.mutate).mockRejectedValueOnce({
      message: 'Dieser Nickname ist in dieser Session bereits vergeben.',
      data: { code: 'CONFLICT' },
    });
    vi.mocked(trpc.session.checkParticipantNickname.query).mockResolvedValue({
      available: false,
    });

    const { fixture, comp } = createWithCode('ABC123');
    const router = fixture.debugElement.injector.get(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    comp.selectedNickname.set('Ada Yonath');
    await comp.submitJoin();
    fixture.detectChanges();

    expect(navSpy).not.toHaveBeenCalled();
    expect(comp.error()).toBeNull();
    expect(comp.session()?.code).toBe('ABC123');
    expect(comp.joinError()).toContain('bereits vergeben');
    expect(comp.isTaken('Ada Yonath')).toBe(true);
    expect(comp.selectedNickname()).toBe('');
    expect(trpc.session.checkParticipantNickname.query).toHaveBeenCalledWith({
      code: 'ABC123',
      nickname: 'Ada Yonath',
    });
  });

  it('laesst lange Pseudonyme aus der Liste beitreten und sendet den Backend-kompatiblen Namen', async () => {
    const longNickname = NICKNAME_LISTS.PRIMARY_SCHOOL.find((name) => name.length > 30)!;
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      nicknameTheme: 'PRIMARY_SCHOOL',
      allowCustomNicknames: false,
    });

    const { fixture, comp } = createWithCode('ABC123');
    const router = fixture.debugElement.injector.get(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    comp.selectedNickname.set(longNickname);
    expect(comp.canSubmit()).toBe(true);
    fixture.detectChanges();
    const submit = fixture.nativeElement.querySelector(
      '.join-card__submit',
    ) as HTMLButtonElement | null;
    expect(submit?.classList.contains('join-card__submit--armed')).toBe(true);
    expect(submit?.classList.contains('mat-mdc-outlined-button')).toBe(false);
    await comp.submitJoin();
    await fixture.whenStable();

    expect(trpc.session.join.mutate).toHaveBeenCalledWith({
      code: 'ABC123',
      nickname: longNickname.slice(0, 30),
      anonymousClientId: ANONYMOUS_CLIENT_ID,
      rejoinToken: undefined,
      joinIdempotencyKey: expect.any(String),
      productFeedbackClaimToken: undefined,
      teamId: undefined,
    });
    expect(navSpy).toHaveBeenCalledWith(['session', 'ABC123', 'vote'], {
      queryParams: { tab: 'quiz' },
    });
  });

  it('sendet vorhandenen Teilnehmer-Schlüssel als rejoinToken mit', async () => {
    storeParticipantCapability('ABC123', participantIds.existing);
    localStorage.setItem('arsnova-nickname-ABC123', 'Ada Yonath');

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    comp.selectedNickname.set('Ada Yonath');
    await comp.submitJoin();
    await fixture.whenStable();

    expect(trpc.session.join.mutate).toHaveBeenCalledWith({
      code: 'ABC123',
      nickname: 'Ada Yonath',
      anonymousClientId: ANONYMOUS_CLIENT_ID,
      rejoinToken: participantIds.existing,
      joinIdempotencyKey: expect.any(String),
      productFeedbackClaimToken: undefined,
      teamId: undefined,
    });
  });

  it('sendet rejoinToken nicht, wenn ein anderes Pseudonym gewählt wird', async () => {
    storeParticipantCapability('ABC123', participantIds.existing);
    localStorage.setItem('arsnova-nickname-ABC123', 'Grüner Frosch 2');

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    comp.selectedNickname.set('Lila Delfin');
    await comp.submitJoin();
    await fixture.whenStable();

    expect(trpc.session.join.mutate).toHaveBeenCalledWith({
      code: 'ABC123',
      nickname: 'Lila Delfin',
      anonymousClientId: ANONYMOUS_CLIENT_ID,
      rejoinToken: undefined,
      joinIdempotencyKey: expect.any(String),
      productFeedbackClaimToken: undefined,
      teamId: undefined,
    });
  });

  it('zeigt Teamauswahl bei manuellem Teammodus', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      teamMode: true,
      teamAssignment: 'MANUAL',
    });
    vi.mocked(trpc.session.getTeams.query).mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: 'Team A', color: '#1E88E5', memberCount: 1 },
        { id: 'team-b', name: 'Team B', color: '#43A047', memberCount: 2 },
      ],
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.showTeamSelect()).toBe(true);
    expect(comp.teams()).toHaveLength(2);
  });

  it('sendet teamId beim Join im manuellen Teammodus', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      teamMode: true,
      teamAssignment: 'MANUAL',
    });
    vi.mocked(trpc.session.getTeams.query).mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: 'Team A', color: '#1E88E5', memberCount: 1 },
        { id: 'team-b', name: 'Team B', color: '#43A047', memberCount: 2 },
      ],
    });

    const { fixture, comp } = createWithCode('ABC123');
    const router = fixture.debugElement.injector.get(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    comp.customNickname.set('Ada');
    comp.selectedTeamId.set('team-b');
    await comp.submitJoin();
    await fixture.whenStable();

    expect(trpc.session.join.mutate).toHaveBeenCalledWith({
      code: 'ABC123',
      nickname: 'Ada',
      anonymousClientId: ANONYMOUS_CLIENT_ID,
      teamId: 'team-b',
      rejoinToken: undefined,
      joinIdempotencyKey: expect.any(String),
      productFeedbackClaimToken: undefined,
    });
    expect(navSpy).toHaveBeenCalledWith(['session', 'ABC123', 'vote'], {
      queryParams: { tab: 'quiz' },
    });
  });

  it('zeigt im manuellen Teammodus nach Pseudonymauswahl die fehlende Teamwahl im Submitbereich', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      allowCustomNicknames: false,
      teamMode: true,
      teamAssignment: 'MANUAL',
    });
    vi.mocked(trpc.session.getTeams.query).mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: 'Team A', color: '#1E88E5', memberCount: 0 },
        { id: 'team-b', name: 'Team B', color: '#43A047', memberCount: 0 },
      ],
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    comp.selectedNickname.set('Kant');
    fixture.detectChanges();

    const bottomAction = fixture.nativeElement.querySelector(
      '.join-page__bottom-action',
    ) as HTMLElement | null;
    const submit = bottomAction?.querySelector('.join-card__submit') as HTMLButtonElement | null;

    expect(comp.canSubmit()).toBe(false);
    expect(submit?.disabled).toBe(true);
    expect(bottomAction?.textContent).toContain('Team wählen');
    expect(bottomAction?.textContent).toContain('Wähle noch ein Team aus.');

    comp.selectedTeamId.set('team-a');
    fixture.detectChanges();

    expect(comp.canSubmit()).toBe(true);
    expect(submit?.disabled).toBe(false);
    expect(bottomAction?.textContent).toContain('Jetzt beitreten');
  });

  it('zeigt Teamvorschau auch bei automatischer Zuweisung', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      teamMode: true,
      teamAssignment: 'AUTO',
    });
    vi.mocked(trpc.session.getTeams.query).mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 1 },
        { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 2 },
      ],
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.showTeamInfo()).toBe(true);
    expect(comp.showTeamSelect()).toBe(false);
    expect(comp.teams().map((team) => team.name)).toEqual(['Rot', 'Blau']);
    expect(comp.selectedTeam()).toBeNull();
  });

  it('speichert nach bestaetigter Teamwahl das Team fuer den Vote-Header', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      teamMode: true,
      teamAssignment: 'MANUAL',
    });
    vi.mocked(trpc.session.getTeams.query).mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: ':apple:', color: '#1E88E5', memberCount: 1 },
        { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 2 },
      ],
    });
    vi.mocked(trpc.session.join.mutate).mockResolvedValue({
      ...mockSession,
      participantId: participantIds.current,
      rejoinToken: participantIds.current,
      teamId: 'team-a',
      teamName: ':apple:',
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    comp.customNickname.set('Ada');
    comp.selectedTeamId.set('team-a');
    await comp.submitJoin();

    expect(peekConfirmedParticipantTeam('ABC123')).toEqual({
      id: 'team-a',
      name: ':apple:',
      color: '#1E88E5',
    });
  });

  it('zeigt bei Teamnamen mit fuehrendem Emoji keinen Farbpunk und rendert das Emoji separat', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      teamMode: true,
      teamAssignment: 'MANUAL',
    });
    vi.mocked(trpc.session.getTeams.query).mockResolvedValue({
      teamCount: 1,
      teams: [{ id: 'team-a', name: '🍎 Rot', color: '#1E88E5', memberCount: 1 }],
    });

    const { fixture } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.join-card__team-card') as HTMLElement;
    expect(card.textContent ?? '').toContain('Rot');
    expect(card.querySelector('.join-card__team-card-dot')).toBeNull();
    expect(card.querySelector('.join-card__team-card-emoji')?.textContent).toBe('🍎');
  });

  it('zeigt bei emoji-only Teamnamen einen generischen Team-Text neben dem Emoji', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      teamMode: true,
      teamAssignment: 'MANUAL',
    });
    vi.mocked(trpc.session.getTeams.query).mockResolvedValue({
      teamCount: 1,
      teams: [{ id: 'team-a', name: ':apple:', color: '#1E88E5', memberCount: 1 }],
    });

    const { fixture } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.join-card__team-card') as HTMLElement;
    expect(card.textContent ?? '').toContain('Team');
    expect(card.querySelector('.join-card__team-card-dot')).toBeNull();
    expect(card.querySelector('.join-card__team-card-emoji')?.textContent).toBe('🍎');
  });

  it('zeigt bei Teamnamen mit nachgestelltem Emoji keinen Farbpunk und haelt die Reihenfolge Text dann Emoji', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      ...mockSession,
      teamMode: true,
      teamAssignment: 'MANUAL',
    });
    vi.mocked(trpc.session.getTeams.query).mockResolvedValue({
      teamCount: 1,
      teams: [{ id: 'team-a', name: 'Team :apple:', color: '#1E88E5', memberCount: 1 }],
    });

    const { fixture } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.join-card__team-card') as HTMLElement;
    const name = card.querySelector('.join-card__team-card-name') as HTMLElement | null;
    expect(name?.textContent ?? '').toContain('Team');
    expect(card.querySelector('.join-card__team-card-dot')).toBeNull();
    expect(card.querySelector('.join-card__team-card-emoji')?.textContent).toBe('🍎');
  });
});
