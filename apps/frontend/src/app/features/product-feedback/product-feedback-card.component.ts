import {
  Component,
  LOCALE_ID,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type {
  ProductFeedbackArea,
  ProductFeedbackAreaPromptKind,
  ProductFeedbackLocale,
  ProductFeedbackPrimaryAnswer,
  ProductFeedbackRole,
  ProductFeedbackSurveyDTO,
} from '@arsnova/shared-types';
import { resolveProductFeedbackAreaPromptKind } from '@arsnova/shared-types';
import { trpc } from '../../core/trpc.client';
import {
  PRODUCT_FEEDBACK_HOST_COOLDOWN_MS,
  PRODUCT_FEEDBACK_PARTICIPANT_COOLDOWN_MS,
  detectProductFeedbackDeviceClass,
  enqueueProductFeedbackOutbox,
  isProductFeedbackInCooldown,
  markProductFeedbackCooldown,
  newIdempotencyKey,
  suppressProductFeedbackSurvey,
} from './product-feedback-storage';

type Step = 'idle' | 'primary' | 'area' | 'thanks' | 'message' | 'done' | 'hidden' | 'error';

@Component({
  selector: 'app-product-feedback-card',
  standalone: true,
  imports: [MatButton, MatIconButton, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './product-feedback-card.component.html',
  styleUrl: './product-feedback-card.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'product-feedback-card-host' },
})
export class ProductFeedbackCardComponent implements OnInit, OnDestroy {
  private readonly localeId = inject(LOCALE_ID);

  /** HOST | PARTICIPANT */
  readonly feedbackRole = input.required<ProductFeedbackRole>();
  readonly sessionCode = input.required<string>();
  readonly participantId = input<string | undefined>(undefined);
  /** Compact inline on session-end vs sheet on home */
  readonly variant = input<'inline' | 'sheet'>('inline');

  readonly dismissed = output<void>();
  readonly completed = output<void>();

  readonly step = signal<Step>('idle');
  readonly busy = signal(false);
  readonly statusMessage = signal('');
  readonly survey = signal<ProductFeedbackSurveyDTO | null>(null);
  readonly inviteToken = signal<string | null>(null);
  readonly primaryAnswer = signal<ProductFeedbackPrimaryAnswer | null>(null);
  readonly areaPromptKind = signal<ProductFeedbackAreaPromptKind>('hurdle');
  readonly followUpCapability = signal<string | null>(null);
  readonly messageDraft = signal('');
  readonly messageLen = signal(0);

  private destroyed = false;

  ngOnInit(): void {
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  async bootstrap(): Promise<void> {
    this.step.set('idle');
    this.busy.set(true);
    try {
      const claimed = await trpc.productFeedback.claimInvite.query({
        sessionCode: this.sessionCode().toUpperCase(),
        role: this.feedbackRole(),
        ...(this.feedbackRole() === 'PARTICIPANT' && this.participantId()
          ? { participantId: this.participantId() }
          : {}),
      });
      if (this.destroyed) return;
      if (!claimed.inviteToken || !claimed.survey) {
        this.step.set('hidden');
        return;
      }
      const surveyKey = claimed.survey.surveyKey;
      const cooldownMs =
        this.feedbackRole() === 'HOST'
          ? PRODUCT_FEEDBACK_HOST_COOLDOWN_MS
          : PRODUCT_FEEDBACK_PARTICIPANT_COOLDOWN_MS;
      if (isProductFeedbackInCooldown(surveyKey, cooldownMs)) {
        this.step.set('hidden');
        return;
      }
      this.inviteToken.set(claimed.inviteToken);
      this.survey.set(claimed.survey);
      this.step.set('primary');
    } catch {
      if (!this.destroyed) this.step.set('hidden');
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  primaryLabel(answer: ProductFeedbackPrimaryAnswer): string {
    switch (answer) {
      case 'EASY':
        return $localize`:@@productFeedback.answer.easy:Einfach`;
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
    }
  }

  areaLabel(area: ProductFeedbackArea): string {
    const map: Record<string, string> = {
      JOIN: $localize`:@@productFeedback.area.join:Session beitreten`,
      ORIENTATION: $localize`:@@productFeedback.area.orientation:Orientierung in der App`,
      ANSWER: $localize`:@@productFeedback.area.answer:Antwort abgeben`,
      QA_OR_QUICKFEEDBACK: $localize`:@@productFeedback.area.qaOrQf:Q&A oder Blitzlicht`,
      RESULTS: $localize`:@@productFeedback.area.results:Ergebnisse verstehen`,
      TECH: $localize`:@@productFeedback.area.tech:Technik oder Verbindung`,
      ACCESSIBILITY: $localize`:@@productFeedback.area.a11y:Barrierefreiheit`,
      OTHER: $localize`:@@productFeedback.area.other:Etwas anderes`,
      PREPARE_QUIZ: $localize`:@@productFeedback.area.prepareQuiz:Quiz vorbereiten`,
      START_SESSION: $localize`:@@productFeedback.area.startSession:Session starten`,
      INVITE: $localize`:@@productFeedback.area.invite:Teilnehmende einladen`,
      LIVE_CONTROL: $localize`:@@productFeedback.area.liveControl:Live-Session steuern`,
      PDF_EXPORT: $localize`:@@productFeedback.area.pdfExport:PDF oder Export`,
    };
    return map[area] ?? area;
  }

  primaryQuestion(): string {
    const key = this.survey()?.surveyKey;
    switch (key) {
      case 'POST_SESSION_EASE_PARTICIPANT_V1':
        return $localize`:@@productFeedback.q.ease.participant:Wie einfach war die Teilnahme mit arsnova.eu heute?`;
      case 'POST_SESSION_VALUE_PARTICIPANT_V1':
        return $localize`:@@productFeedback.q.value.participant:Hat arsnova.eu dir geholfen, dich aktiv an der Session zu beteiligen?`;
      case 'POST_SESSION_EASE_HOST_V1':
        return $localize`:@@productFeedback.q.ease.host:Wie einfach war es heute, die Session mit arsnova.eu durchzuführen?`;
      case 'POST_SESSION_VALUE_HOST_V1':
        return $localize`:@@productFeedback.q.value.host:Hat arsnova.eu dir geholfen, deine Gruppe einzubeziehen und einzuschätzen?`;
      default:
        return $localize`:@@productFeedback.q.fallback:Eine Frage zu arsnova.eu`;
    }
  }

  areaQuestion(): string {
    return this.areaPromptKind() === 'strength'
      ? $localize`:@@productFeedback.q.strength:Was hat heute besonders gut funktioniert?`
      : $localize`:@@productFeedback.q.hurdle:Wo lag die größte Hürde?`;
  }

  selectPrimary(answer: ProductFeedbackPrimaryAnswer): void {
    this.primaryAnswer.set(answer);
    this.areaPromptKind.set(resolveProductFeedbackAreaPromptKind(answer));
    this.step.set('area');
    this.statusMessage.set('');
  }

  async selectArea(area: ProductFeedbackArea): Promise<void> {
    const token = this.inviteToken();
    const primary = this.primaryAnswer();
    const survey = this.survey();
    if (!token || !primary || !survey || this.busy()) return;

    this.busy.set(true);
    this.statusMessage.set($localize`:@@productFeedback.status.sending:Wird gesendet …`);
    const idempotencyKey = newIdempotencyKey();
    const locale = this.resolveLocale();
    const payload = {
      inviteToken: token,
      primaryAnswer: primary,
      area,
      locale,
      appVersion: '0.1.0',
      deviceClass: detectProductFeedbackDeviceClass(),
      idempotencyKey,
    };

    try {
      const result = await trpc.productFeedback.submit.mutate(payload);
      if (this.destroyed) return;
      this.followUpCapability.set(result.followUpCapability);
      markProductFeedbackCooldown(survey.surveyKey);
      this.step.set('thanks');
      this.statusMessage.set(
        $localize`:@@productFeedback.status.saved:Danke! Deine Rückmeldung ist gespeichert.`,
      );
      this.completed.emit();
    } catch {
      if (this.destroyed) return;
      enqueueProductFeedbackOutbox({
        id: idempotencyKey,
        kind: 'submit',
        payload,
        createdAt: Date.now(),
      });
      markProductFeedbackCooldown(survey.surveyKey);
      this.step.set('thanks');
      this.statusMessage.set(
        $localize`:@@productFeedback.status.queued:Deine Rückmeldung ist auf diesem Gerät vorgemerkt und wird erneut gesendet, sobald arsnova.eu erreichbar ist.`,
      );
      this.completed.emit();
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  openMessage(): void {
    this.step.set('message');
    this.statusMessage.set('');
  }

  onMessageInput(value: string): void {
    const trimmed = value.slice(0, 300);
    this.messageDraft.set(trimmed);
    this.messageLen.set(trimmed.length);
  }

  async submitMessage(): Promise<void> {
    const capability = this.followUpCapability();
    const message = this.messageDraft().trim();
    if (!capability || !message || this.busy()) {
      this.finish();
      return;
    }
    this.busy.set(true);
    const idempotencyKey = newIdempotencyKey();
    try {
      await trpc.productFeedback.followUp.mutate({
        followUpCapability: capability,
        message,
        idempotencyKey,
      });
      if (this.destroyed) return;
      this.statusMessage.set(
        $localize`:@@productFeedback.status.messageSaved:Anmerkung gespeichert.`,
      );
      this.step.set('done');
    } catch {
      if (this.destroyed) return;
      enqueueProductFeedbackOutbox({
        id: idempotencyKey,
        kind: 'followUp',
        payload: { followUpCapability: capability, message, idempotencyKey },
        createdAt: Date.now(),
      });
      this.statusMessage.set(
        $localize`:@@productFeedback.status.messageQueued:Anmerkung vorgemerkt – wird bei Verbindung nachgereicht.`,
      );
      this.step.set('done');
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  finish(): void {
    this.step.set('done');
    this.dismissed.emit();
  }

  dismiss(): void {
    const survey = this.survey();
    if (survey) markProductFeedbackCooldown(survey.surveyKey);
    this.step.set('hidden');
    this.dismissed.emit();
  }

  neverAsk(): void {
    const survey = this.survey();
    if (survey) suppressProductFeedbackSurvey(survey.surveyKey);
    this.step.set('hidden');
    this.dismissed.emit();
  }

  visible(): boolean {
    const s = this.step();
    return s !== 'hidden' && s !== 'idle';
  }

  private resolveLocale(): ProductFeedbackLocale {
    const raw = String(this.localeId || 'de')
      .toLowerCase()
      .slice(0, 2);
    if (raw === 'en' || raw === 'fr' || raw === 'es' || raw === 'it') return raw;
    return 'de';
  }
}
