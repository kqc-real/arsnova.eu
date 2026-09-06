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
  getProductFeedbackParticipantClaimToken,
  isProductFeedbackInCooldown,
  isProductFeedbackSuppressed,
  isRetriableProductFeedbackError,
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
  readonly fallbackFocusSelector = input<string | undefined>(undefined);
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
  readonly retryAvailable = signal(true);

  private destroyed = false;
  private pendingArea: ProductFeedbackArea | null = null;
  private pendingMessage = false;
  private pendingBootstrap = false;
  private focusOrigin: HTMLElement | null = null;

  ngOnInit(): void {
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  async bootstrap(): Promise<void> {
    if (!this.focusOrigin && typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) this.focusOrigin = active;
    }
    this.step.set('idle');
    this.busy.set(true);
    this.pendingBootstrap = false;
    this.retryAvailable.set(true);
    try {
      await flushProductFeedbackOutbox({
        submit: (payload) => trpc.productFeedback.submit.mutate(payload as never),
        followUp: (payload) => trpc.productFeedback.followUp.mutate(payload as never),
      });
      if (this.destroyed) return;

      const claimed = await trpc.productFeedback.claimInvite.mutate({
        sessionCode: this.sessionCode().toUpperCase(),
        role: this.feedbackRole(),
        ...(this.feedbackRole() === 'PARTICIPANT' && this.participantId()
          ? {
              participantId: this.participantId(),
              participantClaimToken: getProductFeedbackParticipantClaimToken(this.sessionCode()),
            }
          : {}),
      });
      if (this.destroyed) return;
      if (!claimed.inviteToken || !claimed.survey) {
        this.step.set('hidden');
        this.dismissed.emit();
        return;
      }
      const surveyKey = claimed.survey.surveyKey;
      const cooldownMs =
        this.feedbackRole() === 'HOST'
          ? PRODUCT_FEEDBACK_HOST_COOLDOWN_MS
          : PRODUCT_FEEDBACK_PARTICIPANT_COOLDOWN_MS;
      if (
        isProductFeedbackSuppressed(surveyKey) ||
        isProductFeedbackInCooldown(this.cooldownScope(), cooldownMs)
      ) {
        this.step.set('hidden');
        this.dismissed.emit();
        return;
      }
      this.inviteToken.set(claimed.inviteToken);
      this.survey.set(claimed.survey);
      this.step.set('primary');
      this.moveFocusForStep();
    } catch (error) {
      if (!this.destroyed) {
        this.pendingBootstrap = true;
        this.retryAvailable.set(true);
        this.step.set('error');
        this.statusMessage.set(this.errorStatus(error, 'claim'));
        this.moveFocusForStep();
      }
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

  headingText(): string {
    switch (this.step()) {
      case 'primary':
        return this.primaryQuestion();
      case 'area':
        return this.areaQuestion();
      case 'thanks':
        return $localize`:@@productFeedback.thanks:Danke! Möchtest du noch etwas ergänzen? Ein Satz genügt.`;
      case 'message':
        return $localize`:@@productFeedback.messageHeading:Anmerkung ergänzen`;
      case 'error':
        return $localize`:@@productFeedback.errorHeading:Das hat nicht geklappt`;
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
      deviceClass: detectProductFeedbackDeviceClass(),
      idempotencyKey,
    };

    try {
      const result = await trpc.productFeedback.submit.mutate(payload);
      if (this.destroyed) return;
      this.followUpCapability.set(result.followUpCapability);
      markProductFeedbackCooldown(this.cooldownScope());
      this.step.set('thanks');
      this.statusMessage.set($localize`:@@productFeedback.status.saved:Gespeichert.`);
      this.completed.emit();
      this.moveFocusForStep();
    } catch (err) {
      if (this.destroyed) return;
      if (isRetriableProductFeedbackError(err)) {
        enqueueProductFeedbackOutbox({
          id: idempotencyKey,
          kind: 'submit',
          payload,
          createdAt: Date.now(),
        });
        markProductFeedbackCooldown(this.cooldownScope());
        this.step.set('thanks');
        this.statusMessage.set(
          $localize`:@@productFeedback.status.queued:Vorgemerkt auf diesem Gerät – senden wir, sobald die Verbindung wieder da ist.`,
        );
        this.completed.emit();
        this.moveFocusForStep();
      } else {
        this.pendingArea = area;
        this.retryAvailable.set(this.isActionRetryUseful(err));
        this.step.set('error');
        this.statusMessage.set(this.errorStatus(err, 'submit'));
        this.moveFocusForStep();
      }
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  /** Freitext nur mit followUpCapability (nach erfolgreichem Submit, nicht bei Outbox-Queue). */
  canAddMessage(): boolean {
    return !!this.followUpCapability();
  }

  openMessage(): void {
    if (!this.canAddMessage()) {
      this.finish();
      return;
    }
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
      // Ohne Capability keinen stillen „Erfolg“ vortäuschen — nur schließen.
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
    } catch (err) {
      if (this.destroyed) return;
      if (isRetriableProductFeedbackError(err)) {
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
      } else {
        this.pendingMessage = true;
        this.retryAvailable.set(this.isActionRetryUseful(err));
        this.step.set('error');
        this.statusMessage.set(this.errorStatus(err, 'followUp'));
        this.moveFocusForStep();
      }
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  finish(): void {
    this.step.set('done');
    this.restoreFocus();
    this.dismissed.emit();
  }

  dismiss(): void {
    if (this.survey()) markProductFeedbackCooldown(this.cooldownScope());
    this.step.set('hidden');
    this.restoreFocus();
    this.dismissed.emit();
  }

  retryLastAction(): void {
    if (this.pendingBootstrap) {
      this.pendingBootstrap = false;
      void this.bootstrap();
      return;
    }
    if (this.pendingMessage) {
      this.pendingMessage = false;
      this.step.set('message');
      this.statusMessage.set('');
      void this.submitMessage();
      return;
    }
    if (this.pendingArea) {
      const area = this.pendingArea;
      this.pendingArea = null;
      this.step.set('area');
      this.statusMessage.set('');
      void this.selectArea(area);
      return;
    }
    this.step.set('hidden');
    this.dismissed.emit();
  }

  dismissError(): void {
    this.pendingArea = null;
    this.pendingMessage = false;
    this.step.set('hidden');
    this.restoreFocus();
    this.dismissed.emit();
  }

  neverAsk(): void {
    const survey = this.survey();
    if (survey) suppressProductFeedbackSurvey(survey.surveyKey);
    this.step.set('hidden');
    this.restoreFocus();
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
        } else if (step === 'error') {
          target = root.querySelector(
            '.product-feedback-card__actions button',
          ) as HTMLElement | null;
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
          if (!this.destroyed) {
            this.restoreFocus();
            this.dismissed.emit();
          }
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

  private cooldownScope(): string {
    return `POST_SESSION_V1:${this.feedbackRole()}`;
  }

  private errorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const value = error as {
      data?: { code?: string };
      shape?: { data?: { code?: string } };
    };
    return value.data?.code ?? value.shape?.data?.code;
  }

  private isActionRetryUseful(error: unknown): boolean {
    const code = this.errorCode(error);
    return !(
      code === 'BAD_REQUEST' ||
      code === 'UNAUTHORIZED' ||
      code === 'FORBIDDEN' ||
      code === 'NOT_FOUND' ||
      code === 'CONFLICT' ||
      code === 'PRECONDITION_FAILED'
    );
  }

  private errorStatus(error: unknown, action: 'claim' | 'submit' | 'followUp'): string {
    const code = this.errorCode(error);
    if (code === 'NOT_FOUND') {
      return action === 'followUp'
        ? $localize`:@@productFeedback.status.followUpExpired:Die Zeit für die Ergänzung ist abgelaufen. Deine Zwei-Klick-Antwort bleibt gespeichert.`
        : $localize`:@@productFeedback.status.inviteExpired:Diese Einladung ist abgelaufen.`;
    }
    if (code === 'CONFLICT') {
      return $localize`:@@productFeedback.status.alreadyUsed:Diese Einladung wurde bereits verwendet.`;
    }
    if (code === 'TOO_MANY_REQUESTS') {
      return $localize`:@@productFeedback.status.rateLimited:Gerade sind viele Rückmeldungen unterwegs. Bitte versuche es gleich noch einmal.`;
    }
    if (code === 'BAD_REQUEST' || code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
      return $localize`:@@productFeedback.status.notAllowed:Diese Rückmeldung kann nicht gesendet werden.`;
    }
    return action === 'claim'
      ? $localize`:@@productFeedback.status.claimFailed:Die Frage konnte nicht geladen werden. Bitte versuche es erneut oder schließe sie.`
      : action === 'followUp'
        ? $localize`:@@productFeedback.status.messageRejected:Die Anmerkung konnte nicht gesendet werden. Bitte versuche es erneut oder schließe sie.`
        : $localize`:@@productFeedback.status.rejected:Das hat nicht geklappt. Bitte erneut versuchen oder schließen.`;
  }

  private restoreFocus(): void {
    let target = this.focusOrigin && this.focusOrigin.isConnected ? this.focusOrigin : null;
    if (!target && typeof document !== 'undefined' && this.fallbackFocusSelector()) {
      target = document.querySelector(this.fallbackFocusSelector()!) as HTMLElement | null;
    }
    if (!target?.isConnected) return;
    target.focus({ preventScroll: true });
  }
}
