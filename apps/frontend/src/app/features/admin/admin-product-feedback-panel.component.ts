import { Component, OnInit, ViewEncapsulation, signal } from '@angular/core';
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
  ProductFeedbackRole,
  ProductFeedbackSurveyKey,
} from '@arsnova/shared-types';
import { localizeKnownServerError } from '../../core/localize-known-server-message';
import { trpc } from '../../core/trpc.client';

@Component({
  selector: 'app-admin-product-feedback-panel',
  standalone: true,
  imports: [
    FormsModule,
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
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly stats = signal<AdminProductFeedbackStatsDTO | null>(null);

  roleFilter: ProductFeedbackRole | '' = '';
  surveyKeyFilter: ProductFeedbackSurveyKey | '' = '';
  fromDate: Date | null = null;
  toDate: Date | null = null;

  readonly roleOptions: ProductFeedbackRole[] = ['HOST', 'PARTICIPANT'];
  readonly surveyKeyOptions: ProductFeedbackSurveyKey[] = [
    'POST_SESSION_EASE_PARTICIPANT_V1',
    'POST_SESSION_VALUE_PARTICIPANT_V1',
    'POST_SESSION_EASE_HOST_V1',
    'POST_SESSION_VALUE_HOST_V1',
  ];

  readonly hasActiveFilters = signal(false);

  ngOnInit(): void {
    void this.reload();
  }

  formatRate(rate: number | null | undefined): string {
    if (rate === null || rate === undefined) return '—';
    return `${Math.round(rate * 1000) / 10} %`;
  }

  formatShare(count: number, total: number): string {
    if (!total) return '0 %';
    return `${Math.round((count / total) * 1000) / 10} %`;
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
        return $localize`:@@admin.productFeedback.answer.easy:Einfach`;
      case 'MINOR_FRICTION':
        return $localize`:@@admin.productFeedback.answer.minorFriction:Mit kleinen Hürden`;
      case 'HARD':
        return $localize`:@@admin.productFeedback.answer.hard:Schwierig`;
      case 'YES':
        return $localize`:@@admin.productFeedback.answer.yes:Ja`;
      case 'PARTIAL':
        return $localize`:@@admin.productFeedback.answer.partial:Teilweise`;
      case 'NO':
        return $localize`:@@admin.productFeedback.answer.no:Nein`;
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
      default:
        return key;
    }
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
        return $localize`:@@productFeedback.area.orientation:Sich zurechtfinden`;
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
        return $localize`:@@productFeedback.area.liveControl:Live steuern`;
      case 'PDF_EXPORT':
        return $localize`:@@productFeedback.area.pdfExport:PDF oder Export`;
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
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
    return new Date(`${y}-${m}-${d}T${time}Z`).toISOString();
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
      const data = await trpc.admin.productFeedback.getStats.query(input);
      if (generation !== this.reloadGeneration) return;
      this.stats.set(data);
    } catch (e) {
      if (generation !== this.reloadGeneration) return;
      this.error.set(
        localizeKnownServerError(
          e,
          $localize`:@@admin.productFeedback.errorLoad:Die Auswertung konnte nicht geladen werden.`,
        ),
      );
    } finally {
      if (generation === this.reloadGeneration) {
        this.loading.set(false);
      }
    }
  }
}
