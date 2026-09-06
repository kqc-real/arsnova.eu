import { Component, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import {
  PRODUCT_FEEDBACK_IN_APP_GENERAL_AREAS,
  PRODUCT_FEEDBACK_IN_APP_HOST_AREAS,
  PRODUCT_FEEDBACK_IN_APP_MESSAGE_MAX,
  PRODUCT_FEEDBACK_IN_APP_PARTICIPANT_AREAS,
  type ProductFeedbackImpact,
  type ProductFeedbackInAppArea,
  type ProductFeedbackKind,
} from '@arsnova/shared-types';
import { trpc } from '../../core/trpc.client';
import {
  enqueueProductFeedbackOutbox,
  loadProductFeedbackOutbox,
  newIdempotencyKey,
  removeProductFeedbackOutboxItem,
  type ProductFeedbackOutboxItem,
} from './product-feedback-storage';
import {
  ProductFeedbackLauncherService,
  type ProductFeedbackLaunchContext,
} from './product-feedback-launcher.service';

type Step = 'kind' | 'area' | 'saved' | 'detail' | 'done' | 'error';
type ResolvedLaunchContext = Required<
  Omit<ProductFeedbackLaunchContext, 'errorRequestId' | 'suggestedArea'>
> &
  Pick<ProductFeedbackLaunchContext, 'errorRequestId' | 'suggestedArea'>;

@Component({
  selector: 'app-product-feedback-in-app-dialog',
  standalone: true,
  imports: [DatePipe, MatButton, MatIconButton, MatDialogTitle, MatIcon, MatProgressSpinner],
  templateUrl: './product-feedback-in-app-dialog.component.html',
  styleUrl: './product-feedback-in-app-dialog.component.scss',
  host: { class: 'product-feedback-in-app-dialog' },
})
export class ProductFeedbackInAppDialogComponent {
  readonly data = inject<ResolvedLaunchContext>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ProductFeedbackInAppDialogComponent>);
  private readonly launcher = inject(ProductFeedbackLauncherService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly step = signal<Step>('kind');
  readonly busy = signal(false);
  readonly statusMessage = signal('');
  readonly kind = signal<ProductFeedbackKind | null>(null);
  readonly area = signal<ProductFeedbackInAppArea | null>(null);
  readonly followUpCapability = signal<string | null>(null);
  readonly message = signal('');
  readonly impact = signal<ProductFeedbackImpact | null>(null);
  readonly outbox = signal<ProductFeedbackOutboxItem[]>(loadProductFeedbackOutbox());
  readonly messageMax = PRODUCT_FEEDBACK_IN_APP_MESSAGE_MAX;
  readonly actionLabel = $localize`:@@productFeedback.inApp.action:arsnova.eu verbessern`;
  readonly completionTitle = $localize`:@@productFeedback.allDone:Vielen Dank!`;
  readonly privacyHint = $localize`:@@productFeedback.privacyHint:Bitte nenne keine Namen oder Sessioncodes und füge keine Quiz- oder Q&A-Inhalte oder andere personenbezogene Angaben ein.`;
  private pendingDetailRetry = false;

  readonly kinds: readonly ProductFeedbackKind[] = [
    'NOT_WORKING',
    'UNCLEAR',
    'MISSING_FEATURE',
    'PRAISE',
  ];
  readonly impacts: readonly ProductFeedbackImpact[] = ['CONTINUED', 'RETRIED', 'BLOCKED'];

  constructor() {
    this.focusStep();
  }

  stepNumber(): 1 | 2 {
    return this.step() === 'area' ? 2 : 1;
  }

  areas(): readonly ProductFeedbackInAppArea[] {
    const base =
      this.data.role === 'HOST'
        ? PRODUCT_FEEDBACK_IN_APP_HOST_AREAS
        : this.data.role === 'PARTICIPANT'
          ? PRODUCT_FEEDBACK_IN_APP_PARTICIPANT_AREAS
          : PRODUCT_FEEDBACK_IN_APP_GENERAL_AREAS;
    const suggested = this.data.suggestedArea ?? this.defaultSuggestedArea();
    if (!suggested || !(base as readonly string[]).includes(suggested)) return base;
    return [suggested, ...base.filter((area) => area !== suggested)];
  }

  /** Zeilen für spaltenweisen Area-Flow (linke Spalte = frühe Schritte). */
  areaRowCount(): number {
    return Math.max(1, Math.ceil(this.areas().length / 2));
  }

  selectKind(kind: ProductFeedbackKind): void {
    this.kind.set(kind);
    this.step.set('area');
    this.statusMessage.set('');
    this.focusStep();
  }

  async selectArea(area: ProductFeedbackInAppArea): Promise<void> {
    const kind = this.kind();
    if (!kind || this.busy()) return;
    this.area.set(area);
    this.pendingDetailRetry = false;
    this.busy.set(true);
    this.statusMessage.set(
      $localize`:@@productFeedback.status.sending:Rückmeldung wird gesendet …`,
    );
    const idempotencyKey = newIdempotencyKey();
    const draft = {
      idempotencyKey,
      role: this.data.role,
      kind,
      area,
      context: this.launcher.buildContext(this.data),
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new TypeError('offline');
      }
      const result = await this.launcher.submitDraft(draft);
      this.followUpCapability.set(result.followUpCapability);
      this.step.set('saved');
      this.statusMessage.set(
        $localize`:@@productFeedback.status.saved:Deine Rückmeldung ist angekommen.`,
      );
    } catch (error) {
      if (!this.isRetriable(error)) {
        this.step.set('error');
        this.statusMessage.set(
          $localize`:@@productFeedback.inApp.rejected:Deine Eingaben bleiben erhalten.`,
        );
        this.focusStep();
        return;
      }
      enqueueProductFeedbackOutbox({
        id: idempotencyKey,
        kind: 'inAppSubmit',
        payload: draft,
        createdAt: Date.now(),
      });
      this.outbox.set(loadProductFeedbackOutbox());
      this.step.set('saved');
      this.statusMessage.set(
        $localize`:@@productFeedback.status.queued:Deine Rückmeldung ist auf diesem Gerät vorgemerkt. Wir senden sie automatisch, sobald arsnova.eu wieder erreichbar ist.`,
      );
    } finally {
      this.busy.set(false);
      this.focusStep();
    }
  }

  openDetail(): void {
    if (!this.followUpCapability()) {
      this.finish();
      return;
    }
    this.step.set('detail');
    this.statusMessage.set('');
    this.focusStep();
  }

  onMessage(value: string): void {
    this.message.set(value.slice(0, PRODUCT_FEEDBACK_IN_APP_MESSAGE_MAX));
  }

  async submitDetail(): Promise<void> {
    const capability = this.followUpCapability();
    const message = this.message().trim();
    const impact = this.impact();
    if (!capability || (!message && !impact) || this.busy()) return;
    this.busy.set(true);
    const idempotencyKey = newIdempotencyKey();
    const payload = {
      followUpCapability: capability,
      idempotencyKey,
      ...(message ? { message } : {}),
      ...(impact ? { impact } : {}),
    };
    try {
      await trpc.productFeedback.followUpInApp.mutate(payload);
      this.pendingDetailRetry = false;
      this.statusMessage.set(
        $localize`:@@productFeedback.inApp.detailSaved:Deine Ergänzung ist gespeichert.`,
      );
      this.step.set('done');
    } catch (error) {
      if (!this.isRetriable(error)) {
        this.pendingDetailRetry = true;
        this.step.set('error');
        this.statusMessage.set(
          $localize`:@@productFeedback.inApp.rejected:Deine Eingaben bleiben erhalten.`,
        );
        return;
      }
      enqueueProductFeedbackOutbox({
        id: idempotencyKey,
        kind: 'inAppFollowUp',
        payload,
        createdAt: Date.now(),
      });
      this.outbox.set(loadProductFeedbackOutbox());
      this.pendingDetailRetry = false;
      this.statusMessage.set(
        $localize`:@@productFeedback.inApp.detailQueued:Deine Ergänzung ist auf diesem Gerät vorgemerkt und wird automatisch nachgesendet.`,
      );
      this.step.set('done');
    } finally {
      this.busy.set(false);
      this.focusStep();
    }
  }

  retry(): void {
    if (this.pendingDetailRetry) {
      this.pendingDetailRetry = false;
      this.step.set('detail');
      this.statusMessage.set('');
      void this.submitDetail();
      return;
    }
    const area = this.area();
    this.step.set('area');
    this.statusMessage.set('');
    if (area) void this.selectArea(area);
  }

  removeOutboxItem(id: string): void {
    removeProductFeedbackOutboxItem(id);
    this.outbox.set(loadProductFeedbackOutbox());
    this.statusMessage.set(
      $localize`:@@productFeedback.inApp.outboxDeleted:Ausstehende Rückmeldung gelöscht.`,
    );
  }

  finish(): void {
    this.dialogRef.close();
  }

  kindLabel(kind: ProductFeedbackKind): string {
    const labels: Record<ProductFeedbackKind, string> = {
      NOT_WORKING: $localize`:@@productFeedback.inApp.kind.notWorking:Etwas funktioniert nicht`,
      UNCLEAR: $localize`:@@productFeedback.inApp.kind.unclear:Etwas ist unklar`,
      MISSING_FEATURE: $localize`:@@productFeedback.inApp.kind.missing:Mir fehlt eine Funktion`,
      PRAISE: $localize`:@@productFeedback.inApp.kind.praise:Etwas gefällt mir`,
    };
    return labels[kind];
  }

  areaLabel(area: ProductFeedbackInAppArea): string {
    const labels: Record<string, string> = {
      JOIN: $localize`:@@productFeedback.area.join:Session beitreten`,
      QUIZ_OR_ANSWER: $localize`:@@productFeedback.inApp.area.quizAnswer:Quizfrage oder Antwort`,
      QA: $localize`:@@productFeedback.inApp.area.qa:Q&A`,
      QUICK_FEEDBACK: $localize`:@@productFeedback.inApp.area.quickFeedback:Blitzlicht`,
      RESULTS_OR_SCORE: $localize`:@@productFeedback.inApp.area.resultsScore:Ergebnis oder Punkte`,
      DISPLAY_OR_ACCESSIBILITY: $localize`:@@productFeedback.inApp.area.displayA11y:Darstellung oder Barrierefreiheit`,
      TECH_OR_CONNECTION: $localize`:@@productFeedback.area.tech:Technik oder Verbindung`,
      OTHER: $localize`:@@productFeedback.area.other:Etwas anderes`,
      QUIZ_LIBRARY_OR_EDITOR: $localize`:@@productFeedback.inApp.area.quizEditor:Quiz-Sammlung oder Editor`,
      SESSION_START_OR_INVITE: $localize`:@@productFeedback.inApp.area.sessionStart:Sessionstart und Einladung`,
      LIVE_CONTROL: $localize`:@@productFeedback.area.liveControl:Live-Session steuern`,
      RESULTS: $localize`:@@productFeedback.area.resultsHost:Ergebnisse auswerten`,
      PDF_OR_EXPORT: $localize`:@@productFeedback.area.pdfExport:PDF oder Export`,
      HOME_OR_ORIENTATION: $localize`:@@productFeedback.inApp.area.home:Start und Orientierung`,
      HELP: $localize`:@@productFeedback.inApp.area.help:Hilfe`,
    };
    return labels[area] ?? area;
  }

  impactLabel(impact: ProductFeedbackImpact): string {
    const labels: Record<ProductFeedbackImpact, string> = {
      CONTINUED: $localize`:@@productFeedback.inApp.impact.continued:Ich konnte weitermachen`,
      RETRIED: $localize`:@@productFeedback.inApp.impact.retried:Ich musste es erneut versuchen`,
      BLOCKED: $localize`:@@productFeedback.inApp.impact.blocked:Ich konnte die Aufgabe nicht abschließen`,
    };
    return labels[impact];
  }

  private defaultSuggestedArea(): ProductFeedbackInAppArea | undefined {
    const routeMap: Partial<Record<typeof this.data.routeGroup, ProductFeedbackInAppArea>> = {
      HOME: 'HOME_OR_ORIENTATION',
      HELP: 'HELP',
      QUIZ_LIBRARY: 'QUIZ_LIBRARY_OR_EDITOR',
      QUIZ_EDITOR: 'QUIZ_LIBRARY_OR_EDITOR',
      SESSION_JOIN: 'JOIN',
      SESSION_HOST: 'LIVE_CONTROL',
      SESSION_VOTE: 'QUIZ_OR_ANSWER',
      SESSION_RESULTS: 'RESULTS_OR_SCORE',
      QA: 'QA',
      QUICK_FEEDBACK: 'QUICK_FEEDBACK',
    };
    return routeMap[this.data.routeGroup];
  }

  private isRetriable(error: unknown): boolean {
    if (!error || typeof error !== 'object') return true;
    const candidate = error as { data?: { code?: string }; shape?: { data?: { code?: string } } };
    const code = candidate.data?.code ?? candidate.shape?.data?.code;
    return ![
      'BAD_REQUEST',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'PRECONDITION_FAILED',
    ].includes(code ?? '');
  }

  private focusStep(): void {
    afterNextRender(
      () => {
        const root = this.host.nativeElement;
        const selector =
          this.step() === 'detail'
            ? '#product-feedback-in-app-message'
            : '[data-feedback-step-focus], #product-feedback-in-app-title';
        const target = root.querySelector<HTMLElement>(selector);
        if (!target?.isConnected) return;
        if (!target.hasAttribute('tabindex') && target.tagName !== 'BUTTON') target.tabIndex = -1;
        target.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }
}
