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
import { formatLocaleCount } from '../../core/locale-number.util';
import {
  localizeKnownServerError,
  sessionNotFoundUiMessage,
} from '../../core/localize-known-server-message';
import { localizeCommands, localizePath } from '../../core/locale-router';
import { sessionCodeAriaLabel as i18nSessionCodeAria } from '../../core/session-code-aria';
import {
  areOriginalNicknamesExhausted,
  getGeneratedNicknameFallbackList,
  getNicknameList,
} from './nickname-themes';
import {
  findKindergartenNicknameEmoji,
  kindergartenEmojiAtIndex,
} from './kindergarten-nickname-icons';
import { recordServerTimeIso } from '../session/session-server-clock';
import { setParticipantJoinArrival } from '../../core/participant-join-arrival';
import { setConfirmedParticipantTeam } from '../../core/participant-team-confirmation';
import { ThemePresetService } from '../../core/theme-preset.service';
import {
  edgeEmojiMarkerPosition,
  extractEdgeEmoji,
  stripEdgeEmojiMarker,
} from '../../shared/emoji-shortcode.util';

const PARTICIPANT_STORAGE_KEY = 'arsnova-participant';
const NICKNAME_STORAGE_KEY = 'arsnova-nickname';
const SESSION_POLL_MS = 3000;
const SESSION_POLL_JITTER_MS = 600;
const PARTICIPANT_NICKNAME_REFRESH_MS = 12000;
const PARTICIPANT_NICKNAME_MAX_LENGTH = 30;

function toParticipantNickname(value: string): string {
  return value.trim().slice(0, PARTICIPANT_NICKNAME_MAX_LENGTH);
}

function toParticipantNicknameKey(value: string): string {
  return toParticipantNickname(value).toLowerCase();
}

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
  private readonly themePreset = inject(ThemePresetService);
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
  private pollStartTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastParticipantsRefreshAt = 0;
  private readonly onVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.stopSessionPoll();
      return;
    }
    void this.refreshSession({ forceParticipantRefresh: true });
    this.startSessionPoll(true);
  };

  sessionCodeDisplayAria(code: string): string {
    return i18nSessionCodeAria(code);
  }

  /** Ursprüngliche Namensliste, die der Host fürs Quiz vorgegeben hat (nicknameTheme aus Session/Quiz). */
  readonly originalNicknameOptions = computed(() => {
    const s = this.session();
    if (!s) return [];
    const theme = (s.nicknameTheme ?? 'HIGH_SCHOOL') as NicknameTheme;
    return [...getNicknameList(theme, this.locale)];
  });

  readonly nicknameFallbackActive = computed(() => {
    const s = this.session();
    if (!s) return false;
    const theme = (s.nicknameTheme ?? 'HIGH_SCHOOL') as NicknameTheme;
    return areOriginalNicknamesExhausted(theme, this.locale, this.takenNicknames());
  });

  /** Reserve-Pool erst dann, wenn die Ursprungsliste vollständig erschöpft ist. */
  readonly nicknameOptions = computed(() => {
    const s = this.session();
    if (!s) return [];
    const theme = (s.nicknameTheme ?? 'HIGH_SCHOOL') as NicknameTheme;
    if (!this.nicknameFallbackActive()) {
      return this.originalNicknameOptions();
    }
    return getGeneratedNicknameFallbackList(theme, this.locale, this.takenNicknames());
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

  kindergartenEmojiForOption(option: string, index: number): string {
    if (!this.isKindergartenNicknameTheme()) return '';
    return findKindergartenNicknameEmoji(option) ?? this.kindergartenEmojiForOptionIndex(index);
  }

  /** Barrierefreie Beschriftung der Option (bei Kita inkl. Emoji-Info für Screenreader). */
  nicknameOptionAriaLabel(option: string, index: number): string {
    const taken = this.isTaken(option) ? ` ${this.takenSuffix()}` : '';
    if (!this.isKindergartenNicknameTheme()) {
      return `${option}${taken}`;
    }
    const em = this.kindergartenEmojiForOption(option, index);
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
  readonly isPlayfulPreset = computed(() => this.themePreset.preset() === 'spielerisch');

  readonly selectedTeam = computed(
    () => this.teams().find((team) => team.id === this.selectedTeamId()) ?? null,
  );

  readonly hasJoinNickname = computed(() => {
    if (this.session()?.anonymousMode === true) return true;
    const allowCustom = this.session()?.allowCustomNicknames ?? true;
    return (
      toParticipantNickname(this.selectedNickname()).length > 0 ||
      (allowCustom && toParticipantNickname(this.customNickname()).length > 0)
    );
  });

  readonly hasJoinTeam = computed(
    () => !this.showTeamSelect() || this.selectedTeamId().trim().length > 0,
  );

  readonly canSubmit = computed(() => {
    return this.hasJoinNickname() && this.hasJoinTeam();
  });

  readonly joinSubmitLabel = computed(() => {
    if (this.joining()) return this.joiningLabel();
    if (!this.hasJoinNickname()) return this.chooseNicknameLabel();
    if (!this.hasJoinTeam()) return this.chooseTeamLabel();
    return this.joinNowLabel();
  });

  readonly joinSubmitHint = computed(() => {
    if (this.joining() || this.canSubmit()) return null;
    if (!this.hasJoinNickname()) return this.chooseNicknameHint();
    if (!this.hasJoinTeam()) return this.chooseTeamHint();
    return null;
  });

  readonly effectiveNickname = computed(() => {
    if (this.session()?.anonymousMode === true) {
      return toParticipantNickname(`Teilnehmende ${(this.session()?.participantCount ?? 0) + 1}`);
    }
    const custom = toParticipantNickname(this.customNickname());
    if (custom.length > 0) return custom;
    return toParticipantNickname(this.selectedNickname());
  });

  /** i18n: participant count label (singular). */
  participantSingular = () => $localize`:@@join.participantCountOne:Teilnehmende`;
  /** i18n: participant count label (plural). */
  participantPlural = () => $localize`:@@join.participantCountMany:Teilnehmende`;
  /** i18n: joining in progress. */
  joiningLabel = () => $localize`Wird beigetreten…`;
  /** i18n: join now button. */
  joinNowLabel = () => $localize`Jetzt beitreten`;
  /** i18n: choose nickname before joining. */
  chooseNicknameLabel = () => $localize`:@@join.chooseNicknameButton:Name wählen`;
  /** i18n: choose team before joining. */
  chooseTeamLabel = () => $localize`:@@join.chooseTeamButton:Team wählen`;
  /** i18n: choose nickname requirement hint. */
  chooseNicknameHint = () =>
    $localize`:@@join.chooseNicknameHint:Wähle ein Pseudonym aus der Liste.`;
  /** i18n: choose team requirement hint. */
  chooseTeamHint = () => $localize`:@@join.chooseTeamHint:Wähle noch ein Team aus.`;
  /** i18n: suffix for taken nickname. */
  takenSuffix = () => $localize`(vergeben)`;
  /** i18n: hint when generated reserve nicknames become available. */
  nicknameFallbackHint = () =>
    $localize`:@@join.nicknameFallbackHint:Die Namensliste ist vollständig vergeben. Du kannst jetzt aus weiteren Pseudonymen wählen.`;
  /** i18n: "in der Lobby" suffix. */
  inLobbyLabel = () => $localize`in der Lobby`;
  teamMembersLabel = (count: number) => {
    const formatted = formatLocaleCount(count, this.localeId);
    return count === 1 ? $localize`${formatted} Mitglied` : $localize`${formatted} Mitglieder`;
  };
  formatCount = (value: number) => formatLocaleCount(value, this.localeId);
  teamCardAriaLabel = (team: TeamDTO) =>
    $localize`${this.teamNameDisplayLabel(team.name)}, ${this.teamMembersLabel(team.memberCount)}`;
  teamNameUsesEmojiMarker = (teamName: string) => edgeEmojiMarkerPosition(teamName) !== null;
  teamNameEmojiMarker = (teamName: string) => extractEdgeEmoji(teamName);
  teamNameEmojiMarkerTrailing = (teamName: string) =>
    edgeEmojiMarkerPosition(teamName) === 'trailing';
  teamNameLabelWithoutEmojiMarker = (teamName: string) => this.teamNameDisplayLabel(teamName);
  teamInfoHeading = () =>
    this.showTeamSelect() ? $localize`Dein Team` : $localize`Team-Modus aktiv`;
  teamInfoHint = () =>
    this.showTeamSelect()
      ? $localize`:@@join.teamInfoHintManual:Wähle ein Team, bevor du beitrittst.`
      : $localize`:@@join.teamInfoHintAuto:Teams werden beim Beitritt automatisch zugeteilt. Hier siehst du, welche Teams bereitstehen.`;
  selectedTeamLabel = () => {
    const team = this.selectedTeam();
    return team ? $localize`Ausgewählt: ${this.teamNameDisplayLabel(team.name)}` : null;
  };
  playfulTeamReadyPrefix = () => $localize`:@@join.teamReadyPrefixPlayful:Perfekt!`;
  playfulTeamReadySuffix = () => $localize`:@@join.teamReadySuffixPlayful:wartet schon auf dich.`;

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (this.code.length !== 6) {
      this.errorSessionFinished.set(false);
      this.error.set($localize`Ungültiger Session-Code.`);
      this.loading.set(false);
      return;
    }
    void this.loadSession();
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.pollStartTimeout) {
      clearTimeout(this.pollStartTimeout);
      this.pollStartTimeout = null;
    }
  }

  private teamNameDisplayLabel(teamName: string): string {
    const label = stripEdgeEmojiMarker(teamName).trim();
    return label.length > 0 ? label : $localize`Team`;
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
  private startSessionPoll(immediate = false): void {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (this.pollTimer || this.pollStartTimeout) return;
    const start = () => {
      this.pollStartTimeout = null;
      if (this.pollTimer || (typeof document !== 'undefined' && document.hidden)) return;
      this.pollTimer = setInterval(() => void this.refreshSession(), SESSION_POLL_MS);
    };
    if (immediate) {
      start();
      return;
    }
    const jitterMs = Math.floor(Math.random() * SESSION_POLL_JITTER_MS);
    this.pollStartTimeout = setTimeout(start, jitterMs);
  }

  private stopSessionPoll(): void {
    if (this.pollStartTimeout) {
      clearTimeout(this.pollStartTimeout);
      this.pollStartTimeout = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async refreshSession(options?: { forceParticipantRefresh?: boolean }): Promise<void> {
    if (this.joining() || this.loading()) return;
    if (typeof document !== 'undefined' && document.hidden) return;
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
      if (
        !session.anonymousMode &&
        this.shouldRefreshParticipants(options?.forceParticipantRefresh)
      ) {
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
      const set = new Set(payload.nicknames.map((nickname) => toParticipantNicknameKey(nickname)));
      this.takenNicknames.set(set);
      this.lastParticipantsRefreshAt = Date.now();
    } catch {
      this.takenNicknames.set(new Set());
    }
  }

  private shouldRefreshParticipants(force = false): boolean {
    if (force || this.lastParticipantsRefreshAt === 0) {
      return true;
    }
    return Date.now() - this.lastParticipantsRefreshAt >= PARTICIPANT_NICKNAME_REFRESH_MS;
  }

  isTaken(nickname: string): boolean {
    return this.takenNicknames().has(toParticipantNicknameKey(nickname));
  }

  selectTeam(teamId: string): void {
    this.selectedTeamId.set(teamId);
  }

  private getStoredRejoinToken(): string | undefined {
    if (typeof localStorage === 'undefined') {
      return undefined;
    }
    return localStorage.getItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`) ?? undefined;
  }

  private persistConfirmedTeam(teamId: string | null | undefined): void {
    const team = teamId ? (this.teams().find((entry) => entry.id === teamId) ?? null) : null;
    setConfirmedParticipantTeam(
      this.code,
      team
        ? {
            id: team.id,
            name: team.name,
            color: team.color ?? null,
          }
        : null,
    );
  }

  private async joinAnonymous(session: SessionInfoDTO): Promise<void> {
    this.joining.set(true);
    try {
      const nickname = toParticipantNickname(`Teilnehmende ${session.participantCount + 1}`);
      const result = await trpc.session.join.mutate({
        code: this.code,
        nickname,
        teamId: this.selectedTeamId().trim() || undefined,
        rejoinToken: this.getStoredRejoinToken(),
      });
      recordServerTimeIso(result.serverTime);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`, result.participantId);
        localStorage.setItem(`${NICKNAME_STORAGE_KEY}-${this.code}`, nickname);
      }
      this.persistConfirmedTeam(result.teamId);
      setParticipantJoinArrival(this.code);
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
    if (!nickname) return;
    this.error.set(null);
    this.joining.set(true);
    try {
      const result = await trpc.session.join.mutate({
        code: this.code,
        nickname,
        teamId: this.selectedTeamId().trim() || undefined,
        rejoinToken: this.getStoredRejoinToken(),
      });
      recordServerTimeIso(result.serverTime);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`, result.participantId);
        localStorage.setItem(`${NICKNAME_STORAGE_KEY}-${this.code}`, nickname);
      }
      this.persistConfirmedTeam(result.teamId);
      setParticipantJoinArrival(this.code);
      await this.router.navigate(localizeCommands(['session', this.code, 'vote']));
    } catch (err: unknown) {
      this.errorSessionFinished.set(false);
      this.error.set(localizeKnownServerError(err, $localize`Beitritt fehlgeschlagen.`));
    } finally {
      this.joining.set(false);
    }
  }
}
