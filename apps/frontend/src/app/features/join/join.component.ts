import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { trpc } from '../../core/trpc.client';
import type { SessionInfoDTO } from '@arsnova/shared-types';
import type { NicknameTheme } from '@arsnova/shared-types';
import { NICKNAME_LISTS } from './nickname-themes';

const PARTICIPANT_STORAGE_KEY = 'arsnova-participant';
const SESSION_POLL_MS = 3000;

/**
 * Teilnehmer-Einstieg (QR/Link). Code validieren → Lobby (Story 3.1). Nickname (3.2) → session/:code/vote.
 * Story 2.1b, 3.1, 3.2, 3.6, 7.1.
 */
@Component({
  selector: 'app-join',
  standalone: true,
  imports: [MatCard, MatCardContent, MatButton, MatIcon, RouterLink, MatFormField, MatLabel, MatInput, MatSelect, MatOption],
  templateUrl: './join.component.html',
  styleUrl: './join.component.scss',
})
export class JoinComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly code = (this.route.snapshot.paramMap.get('code') ?? '').trim().toUpperCase();

  readonly session = signal<SessionInfoDTO | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  /** Bereits vergebene Nicknames (für Ausgrauen). */
  readonly takenNicknames = signal<Set<string>>(new Set());
  readonly selectedNickname = signal<string>('');
  readonly customNickname = signal('');
  readonly joining = signal(false);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** Nur die Namensliste, die der Dozent für das Quiz vorgegeben hat (nicknameTheme aus Session/Quiz). */
  readonly nicknameOptions = computed(() => {
    const s = this.session();
    if (!s || s.type !== 'QUIZ') return [];
    const theme = (s.nicknameTheme ?? 'NOBEL_LAUREATES') as NicknameTheme;
    if (!(theme in NICKNAME_LISTS)) return [];
    return [...(NICKNAME_LISTS[theme] ?? [])];
  });

  /** Liste anzeigen nur wenn Dozent keine eigenen Nicks erlaubt und Quiz eine Namensliste (nicknameTheme) vorgegeben hat. */
  readonly showNicknameList = computed(() => {
    const s = this.session();
    if (!s || s.allowCustomNicknames === true) return false;
    return this.nicknameOptions().length > 0;
  });

  /** Eigenes Namensfeld nur wenn Dozent eigene Nicks erlaubt (Preset: eigener Name). */
  readonly showCustomNickname = computed(() => {
    const s = this.session();
    return s?.allowCustomNicknames === true;
  });

  readonly canSubmit = computed(() => {
    const sel = this.selectedNickname().trim();
    const custom = this.customNickname().trim();
    const allowCustom = this.session()?.allowCustomNicknames ?? true;
    return (sel.length > 0) || (allowCustom && custom.length > 0);
  });

  readonly effectiveNickname = computed(() => {
    const custom = this.customNickname().trim();
    if (custom.length > 0) return custom;
    return this.selectedNickname().trim();
  });

  ngOnInit(): void {
    if (this.code.length !== 6) {
      this.error.set('Ungültiger Session-Code.');
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
      if (session.status === 'FINISHED') {
        this.error.set('Diese Session ist bereits beendet.');
        this.loading.set(false);
        return;
      }
      this.session.set(session);
      if (session.anonymousMode) {
        await this.joinAnonymous(session);
        return;
      }
      await this.loadParticipants();
      this.startSessionPoll();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
        ? (err as { message: string }).message
        : 'Session nicht gefunden.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  /** Session-Info und Teilnehmer periodisch nachziehen, damit Änderungen des Dozenten (z. B. Namensliste) beim Client ankommen. */
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
      if (session.status === 'FINISHED') {
        this.session.set(session);
        this.error.set('Diese Session ist bereits beendet.');
        this.stopSessionPoll();
        return;
      }
      this.session.set(session);
      const opts = this.nicknameOptions();
      if (opts.length > 0 && this.selectedNickname().trim() && !opts.includes(this.selectedNickname().trim())) {
        this.selectedNickname.set('');
      }
      if (!session.anonymousMode) {
        await this.loadParticipants();
      }
    } catch {
      this.stopSessionPoll();
    }
  }

  private async loadParticipants(): Promise<void> {
    try {
      const payload = await trpc.session.getParticipants.query({ code: this.code });
      const set = new Set(payload.participants.map((p) => p.nickname.trim().toLowerCase()));
      this.takenNicknames.set(set);
    } catch {
      this.takenNicknames.set(new Set());
    }
  }

  isTaken(nickname: string): boolean {
    return this.takenNicknames().has(nickname.trim().toLowerCase());
  }

  private async joinAnonymous(session: SessionInfoDTO): Promise<void> {
    this.joining.set(true);
    try {
      const nickname = `Teilnehmer #${session.participantCount + 1}`;
      const result = await trpc.session.join.mutate({ code: this.code, nickname });
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`, result.participantId);
      }
      await this.router.navigate(['/session', this.code, 'vote']);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
        ? (err as { message: string }).message
        : 'Beitritt fehlgeschlagen.';
      this.error.set(msg);
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
      const result = await trpc.session.join.mutate({ code: this.code, nickname: nickname.slice(0, 30) });
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`, result.participantId);
      }
      await this.router.navigate(['/session', this.code, 'vote']);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
        ? (err as { message: string }).message
        : 'Beitritt fehlgeschlagen.';
      this.error.set(msg);
    } finally {
      this.joining.set(false);
    }
  }
}
