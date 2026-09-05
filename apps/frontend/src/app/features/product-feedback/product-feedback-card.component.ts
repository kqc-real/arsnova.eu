import {
  afterNextRender,
  Component,
  ElementRef,
  Injector,
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
  flushProductFeedbackOutbox,
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
  styleUrls: ['./product-feedback-card.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'product-feedback-card-host' },
})
export class ProductFeedbackCardComponent implements OnInit, OnDestroy {
  private readonly localeId = inject(LOCALE_ID);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

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
      await flushProductFeedbackOutbox({
        submit: (payload) => trpc.productFeedback.submit.mutate(payload as never),
        followUp: (payload) => trpc.productFeedback.followUp.mutate(payload as never),
      });
      if (this.destroyed) return;

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
      this.moveFocusForStep();
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
      ORIENTATION: $localize`:@@productFeedback.area.orientation:Sich zurechtfinden`,
      ANSWER: $localize`:@@productFeedback.area.answer:Antwort abgeben`,
      QA_OR_QUICKFEEDBACK: $localize`:@@productFeedback.area.qaOrQf:Q&A oder Blitzlicht`,
      RESULTS:
        this.feedbackRole() === 'HOST'
          ? $localize`:@@productFeedback.area.resultsHost:Ergebnisse auswerten`
          : $localize`:@@productFeedback.area.results:Ergebnisse verstehen`,
      TECH: $localize`:@@productFeedback.area.tech:Technik oder Verbindung`,
      ACCESSIBILITY: $localize`:@@productFeedback.area.a11y:Barrierefreiheit`,
      OTHER: $localize`:@@productFeedback.area.other:Etwas anderes`,
      PREPARE_QUIZ: $localize`:@@productFeedback.area.prepareQuiz:Quiz vorbereiten`,
      START_SESSION: $localize`:@@productFeedback.area.startSession:Session starten`,
      INVITE: $localize`:@@productFeedback.area.invite:Teilnehmende einladen`,
      LIVE_CONTROL: $localize`:@@productFeedback.area.liveControl:Live steuern`,
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
      ? $localize`:@@productFeedback.q.strength:Was hat heute am besten geklappt?`
      : $localize`:@@productFeedback.q.hurdle:Woran hat’s am meisten gehakt?`;
  }

  headingText(): string {
    switch (this.step()) {
      case 'primary':
        return this.primaryQuestion();
      case 'area':
        return this.areaQuestion();
      case 'thanks':
        return $localize`:@@productFeedback.thanks:Noch einen Satz dazu?`;
      case 'message':
        return $localize`:@@productFeedback.messageHeading:Optionaler Satz`;
      case 'done':
        return $localize`:@@productFeedback.allDone:Gespeichert.`;
      default:
        return $localize`:@@productFeedback.title:Eine Frage zu arsnova.eu`;
    }
  }

  /** Nur für aria-label — kein sichtbarer Brand-Titel (Doppelung mit Frage/Step-Heading). */
  brandAriaLabel(): string {
    return $localize`:@@productFeedback.title:Eine Frage zu arsnova.eu`;
  }

  stepNumber(): 1 | 2 {
    return this.step() === 'area' ? 2 : 1;
  }

  isPrimaryTriad(): boolean {
    const answers = this.survey()?.primaryAnswers ?? [];
    return (
      answers.length === 3 && answers.every((a) => a === 'YES' || a === 'PARTIAL' || a === 'NO')
    );
  }

  /** Zeilen für spaltenweisen Area-Flow (linke Spalte = frühe Schritte). */
  areaRowCount(): number {
    const n = this.survey()?.areas?.length ?? 0;
    return Math.max(1, Math.ceil(n / 2));
  }

  selectPrimary(answer: ProductFeedbackPrimaryAnswer): void {
    this.primaryAnswer.set(answer);
    this.areaPromptKind.set(resolveProductFeedbackAreaPromptKind(answer));
    this.step.set('area');
    this.statusMessage.set('');
    this.moveFocusForStep();
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
      this.statusMessage.set($localize`:@@productFeedback.status.saved:Gespeichert.`);
      this.completed.emit();
      this.moveFocusForStep();
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
        $localize`:@@productFeedback.status.queued:Vorgemerkt auf diesem Gerät – senden wir, sobald die Verbindung wieder da ist.`,
      );
      this.completed.emit();
      this.moveFocusForStep();
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  openMessage(): void {
    this.step.set('message');
    this.statusMessage.set('');
    this.moveFocusForStep();
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
      this.statusMessage.set($localize`:@@productFeedback.status.messageSaved:Gespeichert.`);
      this.step.set('done');
      this.moveFocusForStep();
      this.scheduleDismissAfterDone();
    } catch {
      if (this.destroyed) return;
      enqueueProductFeedbackOutbox({
        id: idempotencyKey,
        kind: 'followUp',
        payload: { followUpCapability: capability, message, idempotencyKey },
        createdAt: Date.now(),
      });
      this.statusMessage.set(
        $localize`:@@productFeedback.status.messageQueued:Notiz vorgemerkt – kommt nach, sobald die Verbindung wieder da ist.`,
      );
      this.step.set('done');
      this.moveFocusForStep();
      this.scheduleDismissAfterDone();
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  finish(): void {
    this.step.set('done');
    this.moveFocusForStep();
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

  /**
   * Nach @if-Schrittwechseln: Fokus auf erstes sinnvolles Ziel legen,
   * damit Tastatur-/SR-Nutzer nicht auf einem entfernten Button hängen bleiben.
   */
  private moveFocusForStep(): void {
    afterNextRender(
      () => {
        if (this.destroyed) return;
        const root = this.hostEl.nativeElement;
        const step = this.step();
        let target: HTMLElement | null = null;
        if (step === 'primary') {
          target =
            (root.querySelector('.product-feedback-card__close') as HTMLElement | null) ??
            (root.querySelector('#product-feedback-heading') as HTMLElement | null);
        } else if (step === 'area') {
          target = root.querySelector(
            '.product-feedback-card__choice:not([disabled])',
          ) as HTMLElement | null;
        } else if (step === 'thanks') {
          target = root.querySelector(
            '.product-feedback-card__actions button',
          ) as HTMLElement | null;
        } else if (step === 'message') {
          target = root.querySelector('#product-feedback-message') as HTMLElement | null;
        } else if (step === 'done') {
          target = root.querySelector('#product-feedback-heading') as HTMLElement | null;
        }
        if (!target) {
          target = root.querySelector('#product-feedback-heading') as HTMLElement | null;
        }
        if (!target || !target.isConnected) return;
        if (
          !target.hasAttribute('tabindex') &&
          target.tagName !== 'BUTTON' &&
          target.tagName !== 'TEXTAREA'
        ) {
          target.tabIndex = -1;
        }
        target.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  /** Kurz „done“ belassen, damit aria-live den Status noch ausgeben kann (Host-Sheet). */
  private scheduleDismissAfterDone(): void {
    afterNextRender(
      () => {
        if (this.destroyed || typeof globalThis.setTimeout !== 'function') {
          if (!this.destroyed) this.dismissed.emit();
          return;
        }
        globalThis.setTimeout(() => {
          if (!this.destroyed) this.dismissed.emit();
        }, 700);
      },
      { injector: this.injector },
    );
  }

  private resolveLocale(): ProductFeedbackLocale {
    const raw = String(this.localeId || 'de')
      .toLowerCase()
      .slice(0, 2);
    if (raw === 'en' || raw === 'fr' || raw === 'es' || raw === 'it') return raw;
    return 'de';
  }
}
