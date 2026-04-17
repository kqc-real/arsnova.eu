import { Component, LOCALE_ID, OnInit, computed, inject, signal } from '@angular/core';
import {
  MatCard,
  MatCardContent,
  MatCardHeader,
  MatCardSubtitle,
  MatCardTitle,
} from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { trpc } from '../../core/trpc.client';
import { AdminMotdPanelComponent } from './admin-motd-panel.component';
import { getAdminToken, setAdminToken } from '../../core/trpc.client';
import type {
  AdminSessionDetailDTO,
  AdminSessionSummaryDTO,
  SessionStatus,
  SessionType,
} from '@arsnova/shared-types';

type AdminSessionGroup = {
  status: SessionStatus;
  sessions: AdminSessionSummaryDTO[];
};

const ADMIN_SESSION_GROUP_ORDER: readonly SessionStatus[] = [
  'ACTIVE',
  'QUESTION_OPEN',
  'DISCUSSION',
  'RESULTS',
  'PAUSED',
  'LOBBY',
  'FINISHED',
];

/**
 * Admin-Dashboard (Epic 9). Ohne gültige Admin-Auth nur Login/Platzhalter.
 * Story 9.1, 9.2, 9.3.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatCardSubtitle,
    MatButton,
    MatProgressSpinner,
    MatFormField,
    MatLabel,
    MatInput,
    MatTabGroup,
    MatTab,
    AdminMotdPanelComponent,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private readonly locale = inject(LOCALE_ID);
  readonly adminSecret = signal('');
  readonly loginLoading = signal(false);
  readonly loginError = signal<string | null>(null);
  readonly authenticated = signal(false);

  readonly listLoading = signal(false);
  readonly listError = signal<string | null>(null);
  readonly sessions = signal<AdminSessionSummaryDTO[]>([]);
  readonly sessionTotal = signal(0);

  readonly lookupCode = signal('');
  readonly lookupLoading = signal(false);
  readonly lookupError = signal<string | null>(null);

  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly selectedDetail = signal<AdminSessionDetailDTO | null>(null);
  readonly holdLoading = signal(false);
  readonly holdError = signal<string | null>(null);
  readonly holdInfo = signal<string | null>(null);
  readonly deleteLoading = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly deleteInfo = signal<string | null>(null);
  readonly deleteReason = signal('');
  readonly deleteConfirmCode = signal('');
  readonly deleteAllLoading = signal(false);
  readonly deleteAllError = signal<string | null>(null);
  readonly deleteAllInfo = signal<string | null>(null);
  readonly deleteAllReason = signal('');
  readonly deleteAllConfirmText = signal('');
  readonly resetRecordLoading = signal(false);
  readonly resetRecordError = signal<string | null>(null);
  readonly resetRecordInfo = signal<string | null>(null);
  readonly resetRecordConfirmText = signal('');
  readonly exportLoading = signal(false);
  readonly exportError = signal<string | null>(null);
  readonly exportInfo = signal<string | null>(null);

  readonly hasSessions = computed(() => this.sessions().length > 0);
  readonly hasAnySessions = computed(() => this.sessionTotal() > 0);
  readonly groupedSessions = computed<AdminSessionGroup[]>(() => {
    const sessions = [...this.sessions()].sort((left, right) =>
      this.compareByLastActivityDesc(left, right),
    );
    return ADMIN_SESSION_GROUP_ORDER.map((status) => ({
      status,
      sessions: sessions.filter((session) => session.status === status),
    })).filter((group) => group.sessions.length > 0);
  });
  readonly deleteAllRequiredPhrase = 'ALLE SESSIONS LOESCHEN';
  readonly resetRecordRequiredPhrase = 'REKORD RESETZEN';

  async ngOnInit(): Promise<void> {
    if (!getAdminToken()) {
      return;
    }
    await this.verifyAdminSession();
  }

  updateAdminSecret(value: string): void {
    this.adminSecret.set(value);
  }

  updateLookupCode(value: string): void {
    const normalized = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    this.lookupCode.set(normalized);
  }

  updateDeleteReason(value: string): void {
    this.deleteReason.set(value.slice(0, 1000));
  }

  updateDeleteConfirmCode(value: string): void {
    const normalized = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    this.deleteConfirmCode.set(normalized);
  }

  updateDeleteAllReason(value: string): void {
    this.deleteAllReason.set(value.slice(0, 1000));
  }

  updateDeleteAllConfirmText(value: string): void {
    this.deleteAllConfirmText.set(value.slice(0, 200));
  }

  updateResetRecordConfirmText(value: string): void {
    this.resetRecordConfirmText.set(value.slice(0, 200));
  }

  async login(): Promise<void> {
    if (!this.adminSecret().trim() || this.loginLoading()) {
      return;
    }
    this.loginLoading.set(true);
    this.loginError.set(null);
    try {
      const result = await trpc.admin.login.mutate({ secret: this.adminSecret().trim() });
      setAdminToken(result.token);
      this.adminSecret.set('');
      this.authenticated.set(true);
      await this.loadSessions();
    } catch (error) {
      this.loginError.set(
        this.extractErrorMessage(error, $localize`:@@admin.errorLogin:Login fehlgeschlagen.`),
      );
      setAdminToken(null);
      this.authenticated.set(false);
    } finally {
      this.loginLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    try {
      await trpc.admin.logout.mutate();
    } catch {
      // best effort
    }
    setAdminToken(null);
    this.authenticated.set(false);
    this.sessions.set([]);
    this.sessionTotal.set(0);
    this.selectedDetail.set(null);
    this.lookupCode.set('');
    this.lookupError.set(null);
    this.holdError.set(null);
    this.holdInfo.set(null);
  }

  async lookupByCode(): Promise<void> {
    if (this.lookupCode().length !== 6 || this.lookupLoading()) {
      return;
    }
    this.lookupLoading.set(true);
    this.lookupError.set(null);
    this.detailError.set(null);
    try {
      const detail = await trpc.admin.getSessionByCode.query({ code: this.lookupCode() });
      this.selectedDetail.set(detail);
    } catch (error) {
      this.lookupError.set(
        this.extractErrorMessage(
          error,
          $localize`:@@admin.errorLookupSession:Session konnte nicht geladen werden.`,
        ),
      );
    } finally {
      this.lookupLoading.set(false);
    }
  }

  async openSessionDetail(sessionId: string): Promise<void> {
    if (this.detailLoading()) {
      return;
    }
    this.detailLoading.set(true);
    this.detailError.set(null);
    try {
      const detail = await trpc.admin.getSessionDetail.query({ sessionId });
      this.selectedDetail.set(detail);
      this.holdError.set(null);
      this.holdInfo.set(null);
      this.deleteError.set(null);
      this.deleteInfo.set(null);
      this.deleteReason.set('');
      this.deleteConfirmCode.set('');
      this.exportError.set(null);
      this.exportInfo.set(null);
    } catch (error) {
      this.detailError.set(
        this.extractErrorMessage(
          error,
          $localize`:@@admin.errorDetailSession:Session-Detail konnte nicht geladen werden.`,
        ),
      );
    } finally {
      this.detailLoading.set(false);
    }
  }

  /**
   * Legal-Hold setzen/lösen. `reason` bei Aktivierung ist ein fester Audit-String (deutsch, wie im Backend
   * vorgesehen) und wird absichtlich nicht über i18n geführt, damit Logs einheitlich bleiben.
   */
  async setLegalHold(enabled: boolean): Promise<void> {
    const detail = this.selectedDetail();
    if (!detail || this.holdLoading()) {
      return;
    }
    this.holdLoading.set(true);
    this.holdError.set(null);
    this.holdInfo.set(null);
    try {
      const result = await trpc.admin.setLegalHold.mutate({
        sessionId: detail.session.sessionId,
        enabled,
        reason: enabled ? 'Behördenrelevante Sicherung' : undefined,
      });
      if (enabled) {
        const untilText = this.formatDateTime(result.legalHoldUntil);
        this.holdInfo.set(
          $localize`:@@admin.legalHoldSetDone:Sperre aktiviert bis ${untilText}:untilText:.`,
        );
      } else {
        this.holdInfo.set($localize`:@@admin.legalHoldReleaseDone:Sperre wurde aufgehoben.`);
      }
      await this.openSessionDetail(detail.session.sessionId);
      await this.loadSessions();
    } catch (error) {
      this.holdError.set(
        this.extractErrorMessage(
          error,
          $localize`:@@admin.errorLegalHold:Legal Hold konnte nicht aktualisiert werden.`,
        ),
      );
    } finally {
      this.holdLoading.set(false);
    }
  }

  canDeleteSelectedSession(): boolean {
    const detail = this.selectedDetail();
    if (!detail) return false;
    return this.deleteConfirmCode() === detail.session.sessionCode;
  }

  async deleteSelectedSession(): Promise<void> {
    const detail = this.selectedDetail();
    if (!detail || this.deleteLoading() || !this.canDeleteSelectedSession()) {
      return;
    }
    this.deleteLoading.set(true);
    this.deleteError.set(null);
    this.deleteInfo.set(null);
    try {
      const result = await trpc.admin.deleteSession.mutate({
        sessionId: detail.session.sessionId,
        reason: this.deleteReason().trim() || undefined,
      });
      this.deleteInfo.set(
        $localize`:@@admin.sessionDeleted:Session ${result.sessionCode}:sessionCode: wurde endgültig gelöscht.`,
      );
      this.selectedDetail.set(null);
      this.deleteReason.set('');
      this.deleteConfirmCode.set('');
      await this.loadSessions();
    } catch (error) {
      this.deleteError.set(
        this.extractErrorMessage(
          error,
          $localize`:@@admin.errorDeleteSession:Session konnte nicht gelöscht werden.`,
        ),
      );
    } finally {
      this.deleteLoading.set(false);
    }
  }

  canDeleteAllSessions(): boolean {
    if (this.deleteAllLoading() || !this.hasAnySessions()) {
      return false;
    }
    return this.deleteAllConfirmText().trim().toUpperCase() === this.deleteAllRequiredPhrase;
  }

  async deleteAllSessions(): Promise<void> {
    if (!this.canDeleteAllSessions()) {
      return;
    }

    this.deleteAllLoading.set(true);
    this.deleteAllError.set(null);
    this.deleteAllInfo.set(null);
    try {
      const result = await trpc.admin.deleteAllSessions.mutate({
        confirmationText: this.deleteAllConfirmText(),
        expectedSessionCount: this.sessionTotal(),
        reason: this.deleteAllReason().trim() || undefined,
      });
      this.deleteAllInfo.set(
        $localize`:@@admin.deleteAllDone:${result.deletedSessionCount}:sessionCount: Sessions und ${result.deletedQuizCount}:quizCount: Quizze wurden endgültig gelöscht.`,
      );
      this.selectedDetail.set(null);
      this.lookupCode.set('');
      this.deleteReason.set('');
      this.deleteConfirmCode.set('');
      this.deleteAllReason.set('');
      this.deleteAllConfirmText.set('');
      this.exportError.set(null);
      this.exportInfo.set(null);
      await this.loadSessions();
    } catch (error) {
      this.deleteAllError.set(
        this.extractErrorMessage(
          error,
          $localize`:@@admin.errorDeleteAllSessions:Alle Sessions konnten nicht gelöscht werden.`,
        ),
      );
    } finally {
      this.deleteAllLoading.set(false);
    }
  }

  canResetRecord(): boolean {
    if (this.resetRecordLoading()) {
      return false;
    }
    return this.resetRecordConfirmText().trim().toUpperCase() === this.resetRecordRequiredPhrase;
  }

  async resetMaxParticipantsRecord(): Promise<void> {
    if (!this.canResetRecord()) {
      return;
    }

    this.resetRecordLoading.set(true);
    this.resetRecordError.set(null);
    this.resetRecordInfo.set(null);
    try {
      const result = await trpc.admin.resetMaxParticipantsRecord.mutate({
        confirmationText: this.resetRecordConfirmText(),
      });
      this.resetRecordInfo.set(
        $localize`:@@admin.resetRecordDone:Rekord zurückgesetzt: vorher ${result.previousMaxParticipantsSingleSession}:previousValue:, jetzt ${result.currentMaxParticipantsSingleSession}:currentValue:.`,
      );
      this.resetRecordConfirmText.set('');
    } catch (error) {
      this.resetRecordError.set(
        this.extractErrorMessage(
          error,
          $localize`:@@admin.errorResetRecord:Rekord-User-Zahl konnte nicht zurückgesetzt werden.`,
        ),
      );
    } finally {
      this.resetRecordLoading.set(false);
    }
  }

  /**
   * Behörden-Export. `reason` ist ein fester Schlüssel für die API/Audit-Spur (ASCII, nicht lokalisiert).
   */
  async exportForAuthorities(format: 'PDF' | 'JSON' = 'PDF'): Promise<void> {
    const detail = this.selectedDetail();
    if (!detail || this.exportLoading()) {
      return;
    }
    this.exportLoading.set(true);
    this.exportError.set(null);
    this.exportInfo.set(null);
    try {
      const result = await trpc.admin.exportForAuthorities.mutate({
        sessionId: detail.session.sessionId,
        format,
        reason: 'Behoerdenanfrage',
      });

      this.downloadBase64File(result.contentBase64, result.mimeType, result.fileName);

      this.exportInfo.set(
        $localize`:@@admin.exportDoneCompliance:Compliance-Bericht erstellt: ${result.fileName}:fileName:`,
      );
    } catch (error) {
      this.exportError.set(
        this.extractErrorMessage(
          error,
          $localize`:@@admin.errorExport:Export konnte nicht erstellt werden.`,
        ),
      );
    } finally {
      this.exportLoading.set(false);
    }
  }

  async exportSessionAsQuizImport(): Promise<void> {
    const detail = this.selectedDetail();
    if (!detail || this.exportLoading()) {
      return;
    }
    this.exportLoading.set(true);
    this.exportError.set(null);
    this.exportInfo.set(null);
    try {
      const result = await trpc.admin.exportSessionAsQuizImport.mutate({
        sessionId: detail.session.sessionId,
      });
      this.downloadBase64File(result.contentBase64, result.mimeType, result.fileName);
      this.exportInfo.set(
        $localize`:@@admin.exportDoneQuizImport:Quiz-Importdatei erstellt: ${result.fileName}:fileName:`,
      );
    } catch (error) {
      this.exportError.set(
        this.extractErrorMessage(
          error,
          $localize`:@@admin.errorExport:Export konnte nicht erstellt werden.`,
        ),
      );
    } finally {
      this.exportLoading.set(false);
    }
  }

  retentionLabel(windowValue: 'RUNNING' | 'POST_SESSION_24H' | 'PURGED'): string {
    switch (windowValue) {
      case 'RUNNING':
        return $localize`:@@admin.retentionRunning:Laufend`;
      case 'POST_SESSION_24H':
        return $localize`:@@admin.retentionPost:Nachlauf`;
      case 'PURGED':
        return $localize`:@@admin.retentionPurged:Bereinigt`;
    }
  }

  liveParticipantsIncludingHost(session: AdminSessionSummaryDTO): number | null {
    if (session.status === 'FINISHED') {
      return null;
    }
    return session.participantCount + 1;
  }

  sessionStatusLabel(status: SessionStatus): string {
    switch (status) {
      case 'LOBBY':
        return $localize`:@@admin.sessionStatusLobby:Lobby`;
      case 'QUESTION_OPEN':
        return $localize`:@@admin.sessionStatusQuestionOpen:Frage offen`;
      case 'ACTIVE':
        return $localize`:@@admin.sessionStatusActive:Aktiv`;
      case 'PAUSED':
        return $localize`:@@admin.sessionStatusPaused:Pausiert`;
      case 'RESULTS':
        return $localize`:@@admin.sessionStatusResults:Ergebnisse`;
      case 'DISCUSSION':
        return $localize`:@@admin.sessionStatusDiscussion:Diskussion`;
      case 'FINISHED':
        return $localize`:@@admin.sessionStatusFinished:Beendet`;
    }
  }

  sessionTypeLabel(type: SessionType): string {
    switch (type) {
      case 'QUIZ':
        return $localize`:@@admin.sessionTypeQuiz:Quiz`;
      case 'Q_AND_A':
        return $localize`:@@admin.sessionTypeQa:Fragerunde`;
    }
  }

  /**
   * Nur für die Admin-Vorschau: Markdown/KaTeX zu lesbarem Klartext ohne Sprache
   * (Symbole und Standard-Notation, unabhängig von der UI-Locale).
   */
  renderMarkdownText(text: string): string {
    const normalizeKatexExpression = (expression: string): string =>
      expression
        .trim()
        .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)')
        .replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)')
        .replace(/\\cdot/g, '·')
        .replace(/\\times/g, '×')
        .replace(/\\geq/g, '≥')
        .replace(/\\leq/g, '≤')
        .replace(/\\neq/g, '≠')
        .replace(/\\pm/g, '±')
        .replace(/\\approx/g, '≈')
        .replace(/\\infty/g, '∞')
        .replace(/\^\{([^{}]+)\}/g, '^($1)')
        .replace(/\^([A-Za-z0-9]+)/g, '^$1')
        .replace(/_\{([^{}]+)\}/g, '_($1)')
        .replace(/_([A-Za-z0-9]+)/g, '_$1')
        .replace(/\s+/g, ' ')
        .trim();

    return (text ?? '')
      .replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr: string) => normalizeKatexExpression(expr))
      .replace(/\$([^$\n]+?)\$/g, (_m, expr: string) => normalizeKatexExpression(expr))
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*[-+]\s+/gm, '• ')
      .replace(/^\s*\d+\.\s+/gm, '• ')
      .trim();
  }

  private async verifyAdminSession(): Promise<void> {
    try {
      await trpc.admin.whoami.query();
      this.authenticated.set(true);
      await this.loadSessions();
    } catch {
      setAdminToken(null);
      this.authenticated.set(false);
    }
  }

  private async loadSessions(): Promise<void> {
    this.listLoading.set(true);
    this.listError.set(null);
    try {
      const result = await trpc.admin.listSessions.query({ page: 1, pageSize: 25 });
      this.sessions.set(result.sessions);
      this.sessionTotal.set(result.total);
    } catch (error) {
      this.listError.set(
        this.extractErrorMessage(
          error,
          $localize`:@@admin.errorListSessions:Sessions konnten nicht geladen werden.`,
        ),
      );
    } finally {
      this.listLoading.set(false);
    }
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'message' in error) {
      const value = (error as { message?: unknown }).message;
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return fallback;
  }

  formatDateTime(iso: string | null | undefined): string {
    if (!iso) {
      return '—';
    }
    try {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) {
        return iso;
      }
      return new Intl.DateTimeFormat(this.locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return iso;
    }
  }

  private compareByLastActivityDesc(
    left: Pick<AdminSessionSummaryDTO, 'lastActivityAt' | 'startedAt' | 'sessionId'>,
    right: Pick<AdminSessionSummaryDTO, 'lastActivityAt' | 'startedAt' | 'sessionId'>,
  ): number {
    const rightActivity = Date.parse(right.lastActivityAt);
    const leftActivity = Date.parse(left.lastActivityAt);
    if (
      !Number.isNaN(rightActivity) &&
      !Number.isNaN(leftActivity) &&
      rightActivity !== leftActivity
    ) {
      return rightActivity - leftActivity;
    }

    const rightStarted = Date.parse(right.startedAt);
    const leftStarted = Date.parse(left.startedAt);
    if (!Number.isNaN(rightStarted) && !Number.isNaN(leftStarted) && rightStarted !== leftStarted) {
      return rightStarted - leftStarted;
    }

    return left.sessionId.localeCompare(right.sessionId);
  }

  private downloadBase64File(contentBase64: string, mimeType: string, fileName: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    const binary = atob(contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
