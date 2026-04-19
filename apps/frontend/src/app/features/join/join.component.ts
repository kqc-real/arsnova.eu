import { Component, OnInit, OnDestroy, inject, LOCALE_ID, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect, MatSelectTrigger } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { trpc } from '../../core/trpc.client';
import type { SessionInfoDTO, TeamDTO } from '@arsnova/shared-types';
import type { NicknameTheme } from '@arsnova/shared-types';
import { getEffectiveLocale, localeIdToSupported } from '../../core/locale-from-path';
import {
  localizeKnownServerError,
  sessionNotFoundUiMessage,
} from '../../core/localize-known-server-message';
import { localizeCommands, localizePath } from '../../core/locale-router';
import { sessionCodeAriaLabel as i18nSessionCodeAria } from '../../core/session-code-aria';
import { getNicknameList } from './nickname-themes';
import {
  findKindergartenNicknameEmoji,
  kindergartenEmojiAtIndex,
} from './kindergarten-nickname-icons';
import { recordServerTimeIso } from '../session/session-server-clock';

const PARTICIPANT_STORAGE_KEY = 'arsnova-participant';
const NICKNAME_STORAGE_KEY = 'arsnova-nickname';
const SESSION_POLL_MS = 3000;

/**
 * Teilnehmer-Einstieg (QR/Link). Code validieren → Lobby (Story 3.1). Nickname (3.2) → session/:code/vote.
 * Story 2.1b, 3.1, 3.2, 3.6, 7.1.
 */
@Component({
  selector: 'app-join',
  standalone: true,
  imports: [
    MatCard,
    MatCardContent,
    MatButton,
    MatIcon,
    RouterLink,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatSelectTrigger,
    MatOption,
  ],
  templateUrl: './join.component.html',
  styleUrls: ['../../shared/styles/dialog-title-header.scss', './join.component.scss'],
})
export class JoinComponent implements OnInit, OnDestroy {
  readonly localizedCommands = localizeCommands;
  readonly localizedPath = localizePath;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly localeId = inject(LOCALE_ID);
  readonly code = (this.route.snapshot.paramMap.get('code') ?? '').trim().toUpperCase();
  private readonly locale = getEffectiveLocale(localeIdToSupported(this.localeId));

  readonly session = signal<SessionInfoDTO | null>(null);
  readonly error = signal<string | null>(null);
  readonly errorSessionFinished = signal(false);
  readonly loading = signal(true);
  /** Bereits vergebene Nicknames (für Ausgrauen). */
  readonly takenNicknames = signal<Set<string>>(new Set());
  readonly teams = signal<TeamDTO[]>([]);
  readonly selectedNickname = signal<string>('');
  readonly selectedTeamId = signal('');
  readonly customNickname = signal('');
  readonly joining = signal(false);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  sessionCodeDisplayAria(code: string): string {
    return i18nSessionCodeAria(code);
  }

  /** Nur die Namensliste, die der Host fürs Quiz vorgegeben hat (nicknameTheme aus Session/Quiz). */
  readonly nicknameOptions = computed(() => {
    const s = this.session();
    if (!s) return [];
    const theme = (s.nicknameTheme ?? 'HIGH_SCHOOL') as NicknameTheme;
    return [...getNicknameList(theme, this.locale)];
  });

  /** Liste anzeigen nur wenn der Host keine eigenen Nicks erlaubt und Quiz eine Namensliste (nicknameTheme) vorgegeben hat. */
  readonly showNicknameList = computed(() => {
    const s = this.session();
    if (!s || s.allowCustomNicknames === true) return false;
    return this.nicknameOptions().length > 0;
  });

  /** Kindergarten-Liste: große Tier-Emoji in Auswahl und (nach Join) in der Lobby. */
  readonly isKindergartenNicknameTheme = computed(() => {
    const s = this.session();
    return (s?.nicknameTheme ?? 'HIGH_SCHOOL') === 'KINDERGARTEN';
  });

  readonly kindergartenEmojiForSelected = computed((): string | null => {
    if (!this.isKindergartenNicknameTheme()) return null;
    const nick = this.selectedNickname().trim();
    return nick ? findKindergartenNicknameEmoji(nick) : null;
  });

  readonly nicknameSelectPanelClass = computed((): string[] =>
    this.isKindergartenNicknameTheme() ? ['join-nickname-select-panel'] : [],
  );

  kindergartenEmojiForOptionIndex(index: number): string {
    if (!this.isKindergartenNicknameTheme()) return '';
    return kindergartenEmojiAtIndex(index) ?? '';
  }

  /** Barrierefreie Beschriftung der Option (bei Kita inkl. Emoji-Info für Screenreader). */
  nicknameOptionAriaLabel(option: string, index: number): string {
    const taken = this.isTaken(option) ? ` ${this.takenSuffix()}` : '';
    if (!this.isKindergartenNicknameTheme()) {
      return `${option}${taken}`;
    }
    const em = kindergartenEmojiAtIndex(index) ?? '';
    const prefix = em ? `${em} ` : '';
    return `${prefix}${option}${taken}`;
  }

  /** Eigenes Namensfeld nur wenn der Host eigene Nicks erlaubt (Preset: eigener Name). */
  readonly showCustomNickname = computed(() => {
    return this.session()?.allowCustomNicknames === true;
  });

  readonly showTeamSelect = computed(() => {
    const s = this.session();
    return s?.teamMode === true && s.teamAssignment === 'MANUAL';
  });

  readonly showTeamInfo = computed(() => this.session()?.teamMode === true);
  readonly isPlayfulPreset = computed(() => this.session()?.preset === 'PLAYFUL');

  readonly selectedTeam = computed(
    () => this.teams().find((team) => team.id === this.selectedTeamId()) ?? null,
  );
  readonly autoPreviewTeam = computed(() => {
    if (!this.showTeamInfo() || this.showTeamSelect()) {
      return null;
    }
    const list = [...this.teams()].sort((a, b) => a.name.localeCompare(b.name, this.locale));
    if (list.length === 0) return null;
    const participantIndex = this.session()?.participantCount ?? 0;
    const teamIndex = participantIndex % list.length;
    return list[teamIndex] ?? null;
  });
  readonly visibleTeamChoice = computed(() =>
    this.showTeamSelect() ? this.selectedTeam() : this.autoPreviewTeam(),
  );

  readonly canSubmit = computed(() => {
    const sel = this.selectedNickname().trim();
    const custom = this.customNickname().trim();
    const allowCustom = this.session()?.allowCustomNicknames ?? true;
    const hasName =
      this.session()?.anonymousMode === true ||
      sel.length > 0 ||
      (allowCustom && custom.length > 0);
    const hasTeam = !this.showTeamSelect() || this.selectedTeamId().trim().length > 0;
    return hasName && hasTeam;
  });

  readonly effectiveNickname = computed(() => {
    if (this.session()?.anonymousMode === true) {
      return `Teilnehmende #${(this.session()?.participantCount ?? 0) + 1}`;
    }
    const custom = this.customNickname().trim();
    if (custom.length > 0) return custom;
    return this.selectedNickname().trim();
  });

  /** i18n: participant count label (singular). */
  participantSingular = () => $localize`:@@join.participantCountOne:Teilnehmende`;
  /** i18n: participant count label (plural). */
  participantPlural = () => $localize`:@@join.participantCountMany:Teilnehmende`;
  /** i18n: joining in progress. */
  joiningLabel = () => $localize`Wird beigetreten…`;
  /** i18n: join now button. */
  joinNowLabel = () => $localize`Jetzt beitreten`;
  /** i18n: suffix for taken nickname. */
  takenSuffix = () => $localize`(vergeben)`;
  /** i18n: "in der Lobby" suffix. */
  inLobbyLabel = () => $localize`in der Lobby`;
  teamMembersLabel = (count: number) =>
    count === 1 ? $localize`${count} Mitglied` : $localize`${count} Mitglieder`;
  teamCardAriaLabel = (team: TeamDTO) =>
    $localize`${team.name}, ${this.teamMembersLabel(team.memberCount)}`;
  teamInfoHeading = () =>
    this.showTeamSelect() ? $localize`Dein Team` : $localize`Team-Modus aktiv`;
  teamInfoHint = () =>
    this.showTeamSelect()
      ? $localize`Wähle ein Team, bevor du beitrittst.`
      : $localize`Teams werden automatisch verteilt. Du siehst hier schon, welche Teams bereitstehen.`;
  selectedTeamLabel = () => {
    const team = this.showTeamSelect() ? this.selectedTeam() : null;
    return team ? $localize`Ausgewählt: ${team.name}` : null;
  };
  playfulTeamReadyLabel = () => {
    const team = this.visibleTeamChoice();
    return team ? $localize`Perfekt! ${team.name} wartet schon auf dich.` : null;
  };

  ngOnInit(): void {
    if (this.code.length !== 6) {
      this.errorSessionFinished.set(false);
      this.error.set($localize`Ungültiger Session-Code.`);
      this.loading.set(false);
      return;
    }
    void this.loadSession();
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async loadSession(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const session = await trpc.session.getInfo.query({ code: this.code });
      recordServerTimeIso(session.serverTime);
      if (session.status === 'FINISHED') {
        this.errorSessionFinished.set(true);
        this.error.set($localize`Diese Session ist bereits beendet.`);
        this.loading.set(false);
        return;
      }
      this.session.set(session);
      await this.loadTeams();
      if (session.anonymousMode && !this.showTeamSelect()) {
        await this.joinAnonymous(session);
        return;
      }
      await this.loadParticipants();
      this.startSessionPoll();
    } catch (err: unknown) {
      this.errorSessionFinished.set(false);
      this.error.set(localizeKnownServerError(err, sessionNotFoundUiMessage()));
    } finally {
      this.loading.set(false);
    }
  }

  /** Session-Info und Teilnehmer periodisch nachziehen, damit Änderungen des Hosts (z. B. Namensliste) beim Client ankommen. */
  private startSessionPoll(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => void this.refreshSession(), SESSION_POLL_MS);
  }

  private stopSessionPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async refreshSession(): Promise<void> {
    if (this.joining() || this.loading()) return;
    try {
      const session = await trpc.session.getInfo.query({ code: this.code });
      recordServerTimeIso(session.serverTime);
      if (session.status === 'FINISHED') {
        this.session.set(session);
        this.errorSessionFinished.set(true);
        this.error.set($localize`Diese Session ist bereits beendet.`);
        this.stopSessionPoll();
        return;
      }
      this.session.set(session);
      await this.loadTeams();
      const opts = this.nicknameOptions();
      if (
        opts.length > 0 &&
        this.selectedNickname().trim() &&
        !opts.includes(this.selectedNickname().trim())
      ) {
        this.selectedNickname.set('');
      }
      const teamIds = new Set(this.teams().map((team) => team.id));
      if (this.selectedTeamId().trim() && !teamIds.has(this.selectedTeamId().trim())) {
        this.selectedTeamId.set('');
      }
      if (!session.anonymousMode) {
        await this.loadParticipants();
      }
    } catch {
      this.stopSessionPoll();
    }
  }

  private async loadTeams(): Promise<void> {
    const s = this.session();
    if (!s?.teamMode) {
      this.teams.set([]);
      this.selectedTeamId.set('');
      return;
    }
    try {
      const payload = await trpc.session.getTeams.query({ code: this.code });
      this.teams.set(payload.teams);
    } catch {
      this.teams.set([]);
    }
  }

  private async loadParticipants(): Promise<void> {
    try {
      const payload = await trpc.session.getParticipantNicknames.query({ code: this.code });
      const set = new Set(payload.nicknames.map((nickname) => nickname.trim().toLowerCase()));
      this.takenNicknames.set(set);
    } catch {
      this.takenNicknames.set(new Set());
    }
  }

  isTaken(nickname: string): boolean {
    return this.takenNicknames().has(nickname.trim().toLowerCase());
  }

  selectTeam(teamId: string): void {
    this.selectedTeamId.set(teamId);
  }

  private async joinAnonymous(session: SessionInfoDTO): Promise<void> {
    this.joining.set(true);
    try {
      const nickname = `Teilnehmende #${session.participantCount + 1}`;
      const result = await trpc.session.join.mutate({
        code: this.code,
        nickname,
        teamId: this.selectedTeamId().trim() || undefined,
      });
      recordServerTimeIso(result.serverTime);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`, result.participantId);
        localStorage.setItem(`${NICKNAME_STORAGE_KEY}-${this.code}`, nickname);
      }
      await this.router.navigate(localizeCommands(['session', this.code, 'vote']));
    } catch (err: unknown) {
      this.errorSessionFinished.set(false);
      this.error.set(localizeKnownServerError(err, $localize`Beitritt fehlgeschlagen.`));
    } finally {
      this.joining.set(false);
      this.loading.set(false);
    }
  }

  async submitJoin(): Promise<void> {
    if (this.joining() || !this.canSubmit()) return;
    const nickname = this.effectiveNickname();
    if (!nickname || nickname.length > 30) return;
    this.error.set(null);
    this.joining.set(true);
    try {
      const result = await trpc.session.join.mutate({
        code: this.code,
        nickname: nickname.slice(0, 30),
        teamId: this.selectedTeamId().trim() || undefined,
      });
      recordServerTimeIso(result.serverTime);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`, result.participantId);
        localStorage.setItem(`${NICKNAME_STORAGE_KEY}-${this.code}`, nickname.slice(0, 30));
      }
      await this.router.navigate(localizeCommands(['session', this.code, 'vote']));
    } catch (err: unknown) {
      this.errorSessionFinished.set(false);
      this.error.set(localizeKnownServerError(err, $localize`Beitritt fehlgeschlagen.`));
    } finally {
      this.joining.set(false);
    }
  }
}
