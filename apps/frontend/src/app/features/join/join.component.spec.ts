/**
 * Unit-Tests für JoinComponent (Story 3.1: Code validieren, 3.2: Nickname, Join).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { JoinComponent } from './join.component';
import { trpc } from '../../core/trpc.client';

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
      getTeams: { query: vi.fn().mockResolvedValue({ teams: [], teamCount: 0 }) },
      getParticipantNicknames: {
        query: vi.fn().mockResolvedValue({ nicknames: [], participantCount: 0 }),
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
    localStorage.clear();
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue(mockSession);
    vi.mocked(trpc.session.getTeams.query).mockResolvedValue({ teams: [], teamCount: 0 });
    vi.mocked(trpc.session.getParticipantNicknames.query).mockResolvedValue({
      nicknames: [],
      participantCount: 0,
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

  it('lädt Session bei gültigem 6-stelligen Code', async () => {
    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

    expect(comp.session()).toEqual(mockSession);
    expect(comp.error()).toBeNull();
    expect(comp.loading()).toBe(false);
  });

  it('fixiert "Jetzt beitreten" im unteren Aktionsbereich des Join-Clients', async () => {
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
    expect(bottomAction?.textContent).toContain('Jetzt beitreten');
    expect(submitButtons).toHaveLength(1);
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

    expect(comp.error()).toBe('Diese Session ist bereits beendet.');
    expect(comp.session()).toBeNull();
    expect(fixture.nativeElement.textContent ?? '').toContain('Zur Startseite');
    expect(fixture.nativeElement.textContent ?? '').toContain('Als Host anzeigen');
  });

  it('stellt Nickname-Liste bereit bei QUIZ mit nicknameTheme (Story 3.2)', async () => {
    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.nicknameOptions().length).toBeGreaterThanOrEqual(50);
    expect(comp.nicknameOptions()[0]).toBe('Marie Curie');
  });

  it('markiert vergebene Nicknames (isTaken)', async () => {
    vi.mocked(trpc.session.getParticipantNicknames.query).mockResolvedValue({
      nicknames: ['Marie Curie'],
      participantCount: 1,
    });
    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.isTaken('Marie Curie')).toBe(true);
    expect(comp.isTaken('Albert Einstein')).toBe(false);
  });

  it('zeigt bei Q&A ein freies Namensfeld auch ohne Quiz-Einstellungen', async () => {
    vi.mocked(trpc.session.getInfo.query).mockResolvedValue({
      id: 'sess-qa',
      code: 'ABC123',
      type: 'Q_AND_A',
      status: 'LOBBY',
      serverTime: '2026-03-24T12:00:00.000Z',
      quizName: null,
      title: 'Offene Fragen',
      participantCount: 3,
      allowCustomNicknames: true,
      anonymousMode: false,
      teamMode: false,
    });

    const { fixture, comp } = createWithCode('ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));

    expect(comp.showCustomNickname()).toBe(true);
    expect(comp.showNicknameList()).toBe(false);
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
      rejoinToken: undefined,
    });
    expect(navSpy).toHaveBeenCalledWith(['session', 'ABC123', 'vote']);
  });

  it('sendet vorhandenen Teilnehmer-Schlüssel als rejoinToken mit', async () => {
    localStorage.setItem('arsnova-participant-ABC123', participantIds.existing);

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
      rejoinToken: participantIds.existing,
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
      teamId: 'team-b',
      rejoinToken: undefined,
    });
    expect(navSpy).toHaveBeenCalledWith(['session', 'ABC123', 'vote']);
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
  });
});
