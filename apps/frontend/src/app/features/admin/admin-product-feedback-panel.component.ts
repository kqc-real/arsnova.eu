import { DatePipe } from '@angular/common';
import { Component, LOCALE_ID, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MatCard,
  MatCardContent,
  MatCardHeader,
  MatCardSubtitle,
  MatCardTitle,
} from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect, MatOption } from '@angular/material/select';
import type {
  AdminProductFeedbackStatsDTO,
  AdminProductFeedbackStatsInput,
  AdminProductFeedbackTriageStatsDTO,
  AdminProductFeedbackDetail,
  AdminProductFeedbackListItem,
  ProductFeedbackImpact,
  ProductFeedbackKind,
  ProductFeedbackRole,
  ProductFeedbackSource,
  ProductFeedbackSurveyKey,
  ProductFeedbackTriageStatus,
} from '@arsnova/shared-types';
import { localizeKnownServerError } from '../../core/localize-known-server-message';
import { trpc } from '../../core/trpc.client';

@Component({
  selector: 'app-admin-product-feedback-panel',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    MatButton,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardSubtitle,
    MatCardTitle,
    MatDatepickerModule,
    MatFormField,
    MatLabel,
    MatSuffix,
    MatInput,
    MatProgressSpinner,
    MatSelect,
    MatOption,
  ],
  templateUrl: './admin-product-feedback-panel.component.html',
  styleUrl: './admin-product-feedback-panel.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'admin-product-feedback-panel' },
})
export class AdminProductFeedbackPanelComponent implements OnInit {
  private readonly percentFormatter = new Intl.NumberFormat(inject(LOCALE_ID), {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly stats = signal<AdminProductFeedbackStatsDTO | null>(null);
  readonly inbox = signal<AdminProductFeedbackListItem[]>([]);
  readonly nextCursor = signal<string | null>(null);
  readonly selected = signal<AdminProductFeedbackDetail | null>(null);
  readonly issueDraft = signal<{ title: string; body: string } | null>(null);
  readonly triageStats = signal<AdminProductFeedbackTriageStatsDTO | null>(null);
  readonly triageBusy = signal(false);

  roleFilter: ProductFeedbackRole | '' = '';
  surveyKeyFilter: ProductFeedbackSurveyKey | '' = '';
  fromDate: Date | null = null;
  toDate: Date | null = null;

  readonly roleOptions: ProductFeedbackRole[] = ['HOST', 'PARTICIPANT', 'GENERAL'];
  readonly surveyKeyOptions: ProductFeedbackSurveyKey[] = [
    'POST_SESSION_EASE_PARTICIPANT_V1',
    'POST_SESSION_VALUE_PARTICIPANT_V1',
    'POST_SESSION_EASE_HOST_V1',
    'POST_SESSION_VALUE_HOST_V1',
  ];

  readonly hasActiveFilters = signal(false);
  inboxSourceFilter: ProductFeedbackSource | '' = '';
  inboxRoleFilter: ProductFeedbackRole | '' = '';
  inboxKindFilter: ProductFeedbackKind | '' = '';
  inboxAreaFilter = '';
  inboxImpactFilter: ProductFeedbackImpact | '' = '';
  inboxAppVersionFilter = '';
  inboxLocaleFilter: 'de' | 'en' | 'fr' | 'es' | 'it' | '' = '';
  inboxStatusFilter: ProductFeedbackTriageStatus | '' = '';
  duplicateTargetId = '';
  issueNumber: number | null = null;
  issueUrl = '';
  resolvedInVersion = '';
  publicResolutionUrl = '';

  readonly sourceOptions: ProductFeedbackSource[] = ['POST_SESSION', 'IN_APP'];
  readonly kindOptions: ProductFeedbackKind[] = [
    'NOT_WORKING',
    'UNCLEAR',
    'MISSING_FEATURE',
    'PRAISE',
  ];
  readonly impactOptions: ProductFeedbackImpact[] = ['CONTINUED', 'RETRIED', 'BLOCKED'];
  readonly localeOptions = ['de', 'en', 'fr', 'es', 'it'] as const;
  readonly statusOptions: ProductFeedbackTriageStatus[] = [
    'NEW',
    'REVIEWED',
    'PLANNED',
    'RESOLVED',
    'DISCARDED',
  ];

  ngOnInit(): void {
    void this.reload();
  }

  formatRate(rate: number | null | undefined): string {
    if (rate === null || rate === undefined) return '—';
    return this.percentFormatter.format(rate);
  }

  formatShare(count: number, total: number): string {
    return this.percentFormatter.format(total ? count / total : 0);
  }

  barWidth(count: number, buckets: ReadonlyArray<{ count: number }>): number {
    const max = Math.max(...buckets.map((b) => b.count), 1);
    return Math.max(0, Math.min(100, (count / max) * 100));
  }

  surveyLabel(key: string): string {
    switch (key) {
      case 'POST_SESSION_EASE_PARTICIPANT_V1':
        return $localize`:@@admin.productFeedback.survey.easeParticipant:Teilnehmende · Bedienbarkeit`;
      case 'POST_SESSION_VALUE_PARTICIPANT_V1':
        return $localize`:@@admin.productFeedback.survey.valueParticipant:Teilnehmende · Nutzen`;
      case 'POST_SESSION_EASE_HOST_V1':
        return $localize`:@@admin.productFeedback.survey.easeHost:Host · Bedienbarkeit`;
      case 'POST_SESSION_VALUE_HOST_V1':
        return $localize`:@@admin.productFeedback.survey.valueHost:Host · Nutzen`;
      default:
        return key;
    }
  }

  primaryAnswerLabel(key: string): string {
    switch (key) {
      case 'EASY':
        return $localize`:@@productFeedback.answer.easy:Leicht`;
      case 'MINOR_FRICTION':
        return $localize`:@@productFeedback.answer.minorFriction:Mit kleinen Hürden`;
      case 'HARD':
        return $localize`:@@productFeedback.answer.hard:Schwierig`;
      case 'YES':
        return $localize`:@@productFeedback.answer.yes:Ja`;
      case 'PARTIAL':
        return $localize`:@@productFeedback.answer.partial:Teilweise`;
      case 'NO':
        return $localize`:@@productFeedback.answer.no:Nein`;
      default:
        return key;
    }
  }

  roleLabel(key: string): string {
    switch (key) {
      case 'HOST':
        return $localize`:@@admin.productFeedback.role.host:Host`;
      case 'PARTICIPANT':
        return $localize`:@@admin.productFeedback.role.participant:Teilnehmende`;
      case 'GENERAL':
        return $localize`:@@admin.productFeedback.role.general:Allgemein`;
      default:
        return key;
    }
  }

  sourceLabel(source: ProductFeedbackSource): string {
    return source === 'IN_APP'
      ? $localize`:@@admin.productFeedback.source.inApp:In der App`
      : $localize`:@@admin.productFeedback.source.postSession:Nach der Session`;
  }

  impactLabel(impact: ProductFeedbackImpact): string {
    const labels: Record<ProductFeedbackImpact, string> = {
      CONTINUED: $localize`:@@admin.productFeedback.impact.continued:Weiterarbeit möglich`,
      RETRIED: $localize`:@@admin.productFeedback.impact.retried:Erneuter Versuch nötig`,
      BLOCKED: $localize`:@@admin.productFeedback.impact.blocked:Aufgabe nicht abgeschlossen`,
    };
    return labels[impact];
  }

  deviceLabel(key: string): string {
    switch (key) {
      case 'PHONE':
        return $localize`:@@admin.productFeedback.device.phone:Smartphone`;
      case 'TABLET':
        return $localize`:@@admin.productFeedback.device.tablet:Tablet`;
      case 'DESKTOP':
        return $localize`:@@admin.productFeedback.device.desktop:Computer`;
      case 'UNKNOWN':
        return $localize`:@@admin.productFeedback.device.unknown:Nicht erkannt`;
      default:
        return key;
    }
  }

  contextSummary(
    routeGroup: string | null,
    deviceClass: string | null,
    browserFamily: string | null,
  ): string {
    const parts = [
      routeGroup ? this.routeGroupLabel(routeGroup) : null,
      deviceClass ? this.deviceLabel(deviceClass) : null,
      browserFamily ? this.browserFamilyLabel(browserFamily) : null,
    ].filter((part): part is string => part !== null);
    return (
      parts.join(' · ') || $localize`:@@admin.productFeedback.contextUnavailable:Nicht verfügbar`
    );
  }

  private routeGroupLabel(key: string): string {
    const labels: Record<string, string> = {
      HOME: $localize`:@@admin.productFeedback.route.home:Startseite`,
      HELP: $localize`:@@admin.productFeedback.route.help:Hilfe`,
      QUIZ_LIBRARY: $localize`:@@admin.productFeedback.route.quizLibrary:Quiz-Sammlung`,
      QUIZ_EDITOR: $localize`:@@admin.productFeedback.route.quizEditor:Quiz-Editor`,
      SESSION_JOIN: $localize`:@@admin.productFeedback.route.sessionJoin:Sessionbeitritt`,
      SESSION_VOTE: $localize`:@@admin.productFeedback.route.sessionVote:Teilnahme`,
      SESSION_HOST: $localize`:@@admin.productFeedback.route.sessionHost:Sessionsteuerung`,
      SESSION_RESULTS: $localize`:@@admin.productFeedback.route.sessionResults:Ergebnisse`,
      QA: $localize`:@@admin.productFeedback.route.qa:Q&A`,
      QUICK_FEEDBACK: $localize`:@@admin.productFeedback.route.quickFeedback:Blitzlicht`,
      OTHER: $localize`:@@admin.productFeedback.route.other:Anderer Bereich`,
    };
    return labels[key] ?? key;
  }

  private browserFamilyLabel(key: string): string {
    const labels: Record<string, string> = {
      CHROME: 'Chrome',
      FIREFOX: 'Firefox',
      SAFARI: 'Safari',
      EDGE: 'Edge',
      OTHER: $localize`:@@admin.productFeedback.browser.other:Anderer Browser`,
    };
    return labels[key] ?? key;
  }

  sizeLabel(key: string): string {
    switch (key) {
      case 'XS':
        return $localize`:@@admin.productFeedback.size.xs:bis 10 Personen`;
      case 'S':
        return $localize`:@@admin.productFeedback.size.s:11–30 Personen`;
      case 'M':
        return $localize`:@@admin.productFeedback.size.m:31–80 Personen`;
      case 'L':
        return $localize`:@@admin.productFeedback.size.l:81–200 Personen`;
      case 'XL':
        return $localize`:@@admin.productFeedback.size.xl:über 200 Personen`;
      default:
        return key;
    }
  }

  localeLabel(key: string): string {
    switch (key) {
      case 'de':
        return $localize`:@@admin.productFeedback.locale.de:Deutsch`;
      case 'en':
        return $localize`:@@admin.productFeedback.locale.en:Englisch`;
      case 'fr':
        return $localize`:@@admin.productFeedback.locale.fr:Französisch`;
      case 'es':
        return $localize`:@@admin.productFeedback.locale.es:Spanisch`;
      case 'it':
        return $localize`:@@admin.productFeedback.locale.it:Italienisch`;
      default:
        return key;
    }
  }

  areaLabel(key: string): string {
    switch (key) {
      case 'JOIN':
        return $localize`:@@productFeedback.area.join:Session beitreten`;
      case 'ORIENTATION':
        return $localize`:@@productFeedback.area.orientation:Orientierung in der App`;
      case 'ANSWER':
        return $localize`:@@productFeedback.area.answer:Antwort abgeben`;
      case 'QA_OR_QUICKFEEDBACK':
        return $localize`:@@productFeedback.area.qaOrQf:Q&A oder Blitzlicht`;
      case 'RESULTS':
        return $localize`:@@admin.productFeedback.area.results:Ergebnisse`;
      case 'TECH':
        return $localize`:@@productFeedback.area.tech:Technik oder Verbindung`;
      case 'ACCESSIBILITY':
        return $localize`:@@productFeedback.area.a11y:Barrierefreiheit`;
      case 'OTHER':
        return $localize`:@@productFeedback.area.other:Etwas anderes`;
      case 'PREPARE_QUIZ':
        return $localize`:@@productFeedback.area.prepareQuiz:Quiz vorbereiten`;
      case 'START_SESSION':
        return $localize`:@@productFeedback.area.startSession:Session starten`;
      case 'INVITE':
        return $localize`:@@productFeedback.area.invite:Teilnehmende einladen`;
      case 'LIVE_CONTROL':
        return $localize`:@@productFeedback.area.liveControl:Live-Session steuern`;
      case 'PDF_EXPORT':
        return $localize`:@@productFeedback.area.pdfExport:PDF oder Export`;
      case 'QUIZ_OR_ANSWER':
        return $localize`:@@productFeedback.inApp.area.quizAnswer:Quizfrage oder Antwort`;
      case 'QA':
        return $localize`:@@productFeedback.inApp.area.qa:Q&A`;
      case 'QUICK_FEEDBACK':
        return $localize`:@@productFeedback.inApp.area.quickFeedback:Blitzlicht`;
      case 'RESULTS_OR_SCORE':
        return $localize`:@@productFeedback.inApp.area.resultsScore:Ergebnis oder Punkte`;
      case 'DISPLAY_OR_ACCESSIBILITY':
        return $localize`:@@productFeedback.inApp.area.displayA11y:Darstellung oder Barrierefreiheit`;
      case 'TECH_OR_CONNECTION':
        return $localize`:@@productFeedback.area.tech:Technik oder Verbindung`;
      case 'QUIZ_LIBRARY_OR_EDITOR':
        return $localize`:@@productFeedback.inApp.area.quizEditor:Quiz-Sammlung oder Editor`;
      case 'SESSION_START_OR_INVITE':
        return $localize`:@@productFeedback.inApp.area.sessionStart:Sessionstart und Einladung`;
      case 'PDF_OR_EXPORT':
        return $localize`:@@productFeedback.area.pdfExport:PDF oder Export`;
      case 'HOME_OR_ORIENTATION':
        return $localize`:@@productFeedback.inApp.area.home:Start und Orientierung`;
      case 'HELP':
        return $localize`:@@productFeedback.inApp.area.help:Hilfe`;
      default:
        return key;
    }
  }

  kindLabel(key: ProductFeedbackKind | null): string {
    if (!key) return '—';
    const labels: Record<ProductFeedbackKind, string> = {
      NOT_WORKING: $localize`:@@admin.productFeedback.kind.notWorking:Funktioniert nicht`,
      UNCLEAR: $localize`:@@admin.productFeedback.kind.unclear:Unklar`,
      MISSING_FEATURE: $localize`:@@admin.productFeedback.kind.missing:Fehlende Funktion`,
      PRAISE: $localize`:@@admin.productFeedback.kind.praise:Positives Feedback`,
    };
    return labels[key];
  }

  statusLabel(key: ProductFeedbackTriageStatus): string {
    const labels: Record<ProductFeedbackTriageStatus, string> = {
      NEW: $localize`:@@admin.productFeedback.status.new:Neu`,
      REVIEWED: $localize`:@@admin.productFeedback.status.reviewed:Geprüft`,
      PLANNED: $localize`:@@admin.productFeedback.status.planned:Geplant`,
      RESOLVED: $localize`:@@admin.productFeedback.status.resolved:Behoben`,
      DISCARDED: $localize`:@@admin.productFeedback.status.discarded:Nicht weiterverfolgt`,
    };
    return labels[key];
  }

  sessionKindLabel(key: string): string {
    switch (key) {
      case 'QUIZ':
        return $localize`:@@admin.productFeedback.sessionKind.quiz:Quiz`;
      case 'QUICK_FEEDBACK':
        return $localize`:@@admin.productFeedback.sessionKind.quickFeedback:Blitzlicht`;
      case 'MIXED':
        return $localize`:@@admin.productFeedback.sessionKind.mixed:Gemischt`;
      case 'UNKNOWN':
        return $localize`:@@admin.productFeedback.sessionKind.unknown:Nicht erkannt`;
      default:
        return key;
    }
  }

  featureAreaLabel(key: string): string {
    switch (key) {
      case 'quiz':
        return $localize`:@@admin.productFeedback.feature.quiz:Quiz`;
      case 'qa':
        return $localize`:@@admin.productFeedback.feature.qa:Q&A`;
      case 'quickFeedback':
        return $localize`:@@admin.productFeedback.feature.quickFeedback:Blitzlicht`;
      default:
        return key;
    }
  }

  private reloadGeneration = 0;

  onFiltersChanged(): void {
    this.syncFilterState();
    void this.reload();
  }

  clearFilters(): void {
    this.roleFilter = '';
    this.surveyKeyFilter = '';
    this.fromDate = null;
    this.toDate = null;
    this.syncFilterState();
    void this.reload();
  }

  private syncFilterState(): void {
    this.hasActiveFilters.set(
      Boolean(this.roleFilter || this.surveyKeyFilter || this.fromDate || this.toDate),
    );
  }

  /** Kalendertag lokal → UTC-Tagesgrenze (wie zuvor bei `type="date"`). */
  private dayBoundIso(date: Date, endOfDay: boolean): string {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    ).toISOString();
  }

  async reload(): Promise<void> {
    const generation = ++this.reloadGeneration;
    this.loading.set(true);
    this.error.set(null);
    try {
      const input: AdminProductFeedbackStatsInput = {};
      if (this.roleFilter) input.role = this.roleFilter;
      if (this.surveyKeyFilter) input.surveyKey = this.surveyKeyFilter;
      if (this.fromDate) input.from = this.dayBoundIso(this.fromDate, false);
      if (this.toDate) input.to = this.dayBoundIso(this.toDate, true);
      const [data, triageStats] = await Promise.all([
        trpc.admin.productFeedback.getStats.query(input),
        trpc.admin.productFeedback.getTriageStats.query({
          ...(this.fromDate ? { from: this.dayBoundIso(this.fromDate, false) } : {}),
          ...(this.toDate ? { to: this.dayBoundIso(this.toDate, true) } : {}),
          ...(this.inboxAppVersionFilter.trim()
            ? { appVersion: this.inboxAppVersionFilter.trim() }
            : {}),
        }),
        this.loadInbox(true),
      ]);
      if (generation !== this.reloadGeneration) return;
      this.stats.set(data);
      this.triageStats.set(triageStats);
    } catch (e) {
      if (generation !== this.reloadGeneration) return;
      this.error.set(
        localizeKnownServerError(
          e,
          $localize`:@@admin.productFeedback.errorLoad:Die Auswertung konnte nicht geladen werden. Versuche es erneut.`,
        ),
      );
    } finally {
      if (generation === this.reloadGeneration) {
        this.loading.set(false);
      }
    }
  }

  async loadInbox(reset = true): Promise<void> {
    const cursor = reset ? undefined : (this.nextCursor() ?? undefined);
    const output = await trpc.admin.productFeedback.list.query({
      limit: 25,
      ...(cursor ? { cursor } : {}),
      ...(this.fromDate ? { from: this.dayBoundIso(this.fromDate, false) } : {}),
      ...(this.toDate ? { to: this.dayBoundIso(this.toDate, true) } : {}),
      ...(this.inboxSourceFilter ? { source: this.inboxSourceFilter } : {}),
      ...(this.inboxRoleFilter ? { role: this.inboxRoleFilter } : {}),
      ...(this.inboxKindFilter ? { kind: this.inboxKindFilter } : {}),
      ...(this.inboxAreaFilter.trim() ? { area: this.inboxAreaFilter.trim() as never } : {}),
      ...(this.inboxImpactFilter ? { impact: this.inboxImpactFilter } : {}),
      ...(this.inboxAppVersionFilter.trim()
        ? { appVersion: this.inboxAppVersionFilter.trim() }
        : {}),
      ...(this.inboxLocaleFilter ? { locale: this.inboxLocaleFilter } : {}),
      ...(this.inboxStatusFilter ? { status: this.inboxStatusFilter } : {}),
    });
    this.inbox.update((current) => (reset ? output.items : [...current, ...output.items]));
    this.nextCursor.set(output.nextCursor);
  }

  onInboxFiltersChanged(): void {
    this.selected.set(null);
    this.issueDraft.set(null);
    void this.loadInbox(true).catch((error) => {
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@admin.productFeedback.inboxLoadError:Die Rückmeldungen konnten nicht geladen werden. Versuche es erneut.`,
        ),
      );
    });
  }

  async selectFeedback(id: string): Promise<void> {
    this.triageBusy.set(true);
    this.issueDraft.set(null);
    try {
      const detail = await trpc.admin.productFeedback.getDetail.query({ id });
      this.selected.set(detail);
      this.resolvedInVersion = detail.resolvedInVersion ?? '';
      this.publicResolutionUrl = detail.publicResolutionUrl ?? '';
      this.issueNumber = detail.githubIssueNumber;
      this.issueUrl = detail.githubIssueUrl ?? '';
    } finally {
      this.triageBusy.set(false);
    }
  }

  async updateStatus(status: ProductFeedbackTriageStatus): Promise<void> {
    const selected = this.selected();
    if (!selected) return;
    await this.runTriage(async () => {
      await trpc.admin.productFeedback.updateTriage.mutate({
        id: selected.id,
        status,
        ...(status === 'RESOLVED'
          ? {
              resolvedInVersion: this.resolvedInVersion.trim() || null,
              publicResolutionUrl: this.publicResolutionUrl.trim() || null,
            }
          : {}),
      });
    });
  }

  async linkDuplicate(): Promise<void> {
    const selected = this.selected();
    if (!selected) return;
    await this.runTriage(() =>
      trpc.admin.productFeedback.linkDuplicate.mutate({
        id: selected.id,
        duplicateOfId: this.duplicateTargetId.trim() || null,
      }),
    );
  }

  async linkIssue(): Promise<void> {
    const selected = this.selected();
    if (!selected || !this.issueNumber || !this.issueUrl.trim()) return;
    await this.runTriage(() =>
      trpc.admin.productFeedback.linkIssue.mutate({
        id: selected.id,
        issueNumber: this.issueNumber!,
        issueUrl: this.issueUrl.trim(),
      }),
    );
  }

  async createIssueDraft(): Promise<void> {
    const selected = this.selected();
    if (!selected) return;
    this.triageBusy.set(true);
    try {
      this.issueDraft.set(
        await trpc.admin.productFeedback.createIssueDraft.mutate({ id: selected.id }),
      );
    } finally {
      this.triageBusy.set(false);
    }
  }

  async publishIssue(): Promise<void> {
    const selected = this.selected();
    if (!selected || !this.issueDraft()) return;
    await this.runTriage(async () => {
      const published = await trpc.admin.productFeedback.publishIssue.mutate({ id: selected.id });
      this.issueNumber = published.issueNumber;
      this.issueUrl = published.issueUrl;
      this.issueDraft.set(null);
    });
  }

  async clearQuarantine(): Promise<void> {
    const selected = this.selected();
    if (!selected) return;
    await this.runTriage(() =>
      trpc.admin.productFeedback.clearQuarantine.mutate({ id: selected.id }),
    );
  }

  async deleteSelected(): Promise<void> {
    const selected = this.selected();
    if (!selected) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        $localize`:@@admin.productFeedback.deleteConfirm:Möchtest du diese Rückmeldung wirklich endgültig löschen?`,
      )
    ) {
      return;
    }
    this.triageBusy.set(true);
    try {
      await trpc.admin.productFeedback.delete.mutate({ id: selected.id });
      this.selected.set(null);
      await this.loadInbox(true);
    } finally {
      this.triageBusy.set(false);
    }
  }

  private async runTriage(action: () => Promise<unknown>): Promise<void> {
    const selectedId = this.selected()?.id;
    if (!selectedId) return;
    this.triageBusy.set(true);
    this.error.set(null);
    try {
      await action();
      await this.loadInbox(true);
      await this.selectFeedback(selectedId);
    } catch (error) {
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@admin.productFeedback.triageError:Die Änderung konnte nicht gespeichert werden. Versuche es erneut.`,
        ),
      );
    } finally {
      this.triageBusy.set(false);
    }
  }
}
