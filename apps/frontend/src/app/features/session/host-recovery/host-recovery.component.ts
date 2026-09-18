import { DOCUMENT, formatDate } from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  LOCALE_ID,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { HostSupportIdSchema, OpaqueCapabilitySchema } from '@arsnova/shared-types';
import {
  clearHostRecoveryResume,
  clearPreparedHostRecoverySecrets,
  discardExpiredPreparedRecovery,
  findUnambiguousHostRecoveryResume,
  getHostRecoveryResume,
  getOrCreateRecoveryExchangeId,
  getPendingHostCredentialActivation,
  getPendingHostRecoveryCard,
  getStoredHostCapabilities,
  markHostRecoveryActivated,
  markHostRecoveryActivationUnconfirmed,
  markHostRecoveryNewCardSaved,
  persistPreparedHostRecovery,
  type HostRecoverySourceKind,
  type PreparedHostRecovery,
} from '../../../core/host-recovery-access';
import { localizeCommands, resolveLocalizedAppUrl } from '../../../core/locale-router';
import { setHostToken, trpc } from '../../../core/trpc.client';
import {
  buildHostRecoveryCardHtml,
  buildHostRecoveryCardPlainText,
} from './host-recovery-card-format';
import { classifyRecoveryRequestError } from './host-recovery-errors';

type RecoveryView =
  | 'credentials'
  | 'resume'
  | 'newCard'
  | 'success'
  | 'activationUnconfirmed'
  | 'pendingExpired'
  | 'handoffExpired';

type RecoveryCardField = 'supportId' | 'recoveryCode' | 'all';

@Component({
  selector: 'app-host-recovery',
  standalone: true,
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatCheckbox,
    MatError,
    MatFormField,
    MatHint,
    MatIcon,
    MatIconButton,
    MatInput,
    MatLabel,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './host-recovery.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './host-recovery-card-dialog.component.scss',
    './host-recovery.component.scss',
  ],
})
export class HostRecoveryComponent implements AfterViewChecked, OnDestroy {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly locale = inject(LOCALE_ID);
  private readonly headingRef = viewChild<ElementRef<HTMLElement>>('recoveryHeading');
  private readonly supportIdInput = viewChild<ElementRef<HTMLInputElement>>('supportIdInput');
  private readonly secretInput = viewChild<ElementRef<HTMLInputElement>>('secretInput');
  private destroyed = false;
  private requestSeq = 0;
  private focusToken = 0;
  private appliedFocusToken = -1;
  private pendingFieldFocus: 'supportId' | 'secret' | null = null;

  readonly recoveryUrl = resolveLocalizedAppUrl('/host-recovery');
  readonly sourceKind = signal<HostRecoverySourceKind>('RECOVERY');
  readonly supportId = signal('');
  readonly secret = signal('');
  readonly view = signal<RecoveryView>('credentials');
  readonly prepared = signal<PreparedHostRecovery | null>(null);
  readonly sessionCode = signal<string | null>(null);
  readonly newCardSaved = signal(false);
  readonly showNewCodeHint = signal(false);
  readonly supportIdError = signal<string | null>(null);
  readonly secretError = signal<string | null>(null);
  readonly bannerError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly busyKind = signal<'checking' | 'activating' | 'checkingState' | null>(null);
  readonly copiedField = signal<RecoveryCardField | null>(null);
  readonly copyFailed = signal(false);
  readonly downloadStarted = signal(false);
  readonly supportIdControl = new FormControl('', { nonNullable: true });
  readonly secretControl = new FormControl('', { nonNullable: true });

  constructor() {
    const resume = findUnambiguousHostRecoveryResume();
    if (!resume) return;
    this.supportId.set(resume.supportId);
    this.supportIdControl.setValue(resume.supportId);
    this.sourceKind.set(resume.sourceKind);
    this.sessionCode.set(resume.code);
    const pending = getPendingHostCredentialActivation(resume.supportId);
    if (pending) this.prepared.set(pending);
    this.view.set(resume.phase === 'activation_unconfirmed' ? 'activationUnconfirmed' : 'resume');
    this.requestFocus();
  }

  ngAfterViewChecked(): void {
    if (this.appliedFocusToken === this.focusToken) return;
    if (this.pendingFieldFocus === 'supportId') {
      const field = this.supportIdInput()?.nativeElement;
      if (!field) return;
      field.focus();
      this.pendingFieldFocus = null;
      this.appliedFocusToken = this.focusToken;
      return;
    }
    if (this.pendingFieldFocus === 'secret') {
      const field = this.secretInput()?.nativeElement;
      if (!field) return;
      field.focus();
      this.pendingFieldFocus = null;
      this.appliedFocusToken = this.focusToken;
      return;
    }
    const heading = this.headingRef()?.nativeElement;
    if (!heading) return;
    heading.focus();
    this.appliedFocusToken = this.focusToken;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  homeCommands() {
    return localizeCommands(['']);
  }

  imprintCommands() {
    return localizeCommands(['legal', 'imprint']);
  }

  showStepIndicator(): boolean {
    return this.view() === 'credentials' || this.view() === 'newCard' || this.view() === 'success';
  }

  stepLabel(): string {
    const step = this.view() === 'credentials' ? 1 : this.view() === 'newCard' ? 2 : 3;
    const total = 3;
    return $localize`:@@hostRecovery.stepIndicator:Schritt ${step}:step: von ${total}:total:`;
  }

  heading(): string {
    switch (this.view()) {
      case 'newCard':
        return $localize`:@@hostRecovery.newCardTitle:Neue Zugangsdaten sichern`;
      case 'success':
        return $localize`:@@hostRecovery.successTitle:Host-Zugang wiederhergestellt`;
      case 'resume':
      case 'activationUnconfirmed':
        return $localize`:@@hostRecovery.resumeTitle:Wiederherstellung fortsetzen`;
      default:
        return $localize`:@@hostRecovery.title:Host-Zugang wiederherstellen`;
    }
  }

  intro(): string {
    switch (this.view()) {
      case 'newCard':
        return this.sourceKind() === 'ADMIN_HANDOFF'
          ? $localize`:@@hostRecovery.handoffNewCardIntro:Sichere den neuen Wiederherstellungscode. Mit ihm kannst du deinen Host-Zugang später erneut wiederherstellen.`
          : $localize`:@@hostRecovery.newCardIntro:Sichere den neuen Wiederherstellungscode. Sobald du den Zugang aktivierst, ersetzt er deinen bisherigen Code.`;
      case 'success':
        return $localize`:@@hostRecovery.successIntro:Dein Host-Zugang ist jetzt in diesem Browser gespeichert.`;
      case 'resume':
        return $localize`:@@hostRecovery.resumeIntro:In diesem Browser wurde bereits eine Wiederherstellung begonnen. Setze sie fort, um den aktuellen Stand zu prüfen.`;
      case 'credentials':
        return this.sourceKind() === 'ADMIN_HANDOFF'
          ? $localize`:@@hostRecovery.handoffIntro:Gib die Session-Kennung und den Code ein, die du vom Support erhalten hast.`
          : $localize`:@@hostRecovery.intro:Gib die Session-Kennung und den Wiederherstellungscode von deiner Zugangskarte oder aus deiner Notiz ein.`;
      default:
        return '';
    }
  }

  busyMessage(): string | null {
    switch (this.busyKind()) {
      case 'checking':
        return $localize`:@@hostRecovery.checking:Zugangsdaten werden geprüft…`;
      case 'activating':
        return $localize`:@@hostRecovery.activating:Zugang wird aktiviert…`;
      case 'checkingState':
        return $localize`:@@hostRecovery.checkingState:Stand der Wiederherstellung wird geprüft…`;
      default:
        return null;
    }
  }

  deadlineLabel(): string {
    const pending = this.prepared();
    if (!pending) return '';
    const deadline = formatDate(pending.pendingExpiresAt, 'medium', this.locale);
    return $localize`:@@hostRecovery.activationDeadline:Aktivieren bis: ${deadline}:deadline:`;
  }

  onSupportIdInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toUpperCase();
    this.supportId.set(value);
    this.supportIdControl.setValue(value, { emitEvent: false });
    this.supportIdControl.setErrors(null);
    this.supportIdError.set(null);
  }

  onSecretInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.secret.set(value);
    this.secretControl.setValue(value, { emitEvent: false });
    this.secretControl.setErrors(null);
    this.secretError.set(null);
  }

  switchSource(kind: HostRecoverySourceKind): void {
    this.sourceKind.set(kind);
    this.secret.set('');
    this.secretControl.setValue('');
    this.secretControl.setErrors(null);
    this.secretError.set(null);
    this.supportIdError.set(null);
    this.supportIdControl.setErrors(null);
    this.bannerError.set(null);
    this.requestFocus();
  }

  onContinue(event: Event): void {
    event.preventDefault();
    void this.continueRecovery();
  }

  async continueRecovery(): Promise<void> {
    if (this.busy()) return;
    this.bannerError.set(null);
    const supportIdResult = HostSupportIdSchema.safeParse(this.supportId());
    const secretResult = OpaqueCapabilitySchema.safeParse(this.secret());
    this.applyFieldError(
      this.supportIdControl,
      this.supportIdError,
      supportIdResult.success
        ? null
        : $localize`:@@hostRecovery.supportIdFormatError:Gib die Session-Kennung im Format ARS-XXXX-XXXX ein.`,
    );
    this.applyFieldError(
      this.secretControl,
      this.secretError,
      secretResult.success
        ? null
        : $localize`:@@hostRecovery.secretFormatError:Kopiere den Code vollständig. Er darf nur Buchstaben (A–Z, a–z), Ziffern, Bindestriche und Unterstriche enthalten.`,
    );
    if (!supportIdResult.success || !secretResult.success) {
      this.pendingFieldFocus = !supportIdResult.success ? 'supportId' : 'secret';
      this.requestFocus();
      return;
    }

    const supportId = supportIdResult.data;
    this.supportId.set(supportId);
    this.supportIdControl.setValue(supportId, { emitEvent: false });
    const existing = getPendingHostCredentialActivation(supportId);
    if (existing) {
      this.prepared.set(existing);
      this.sessionCode.set(existing.code);
      this.openNewCard();
      return;
    }

    const resume = getHostRecoveryResume(supportId);
    if (resume && (resume.phase === 'activation_unconfirmed' || resume.phase === 'activated')) {
      await this.resumeRecovery(supportId);
      return;
    }

    const seq = this.beginBusy('checking');
    const source =
      this.sourceKind() === 'RECOVERY'
        ? ({ kind: 'RECOVERY', recoveryCode: secretResult.data } as const)
        : ({ kind: 'ADMIN_HANDOFF', handoffCapability: secretResult.data } as const);
    try {
      const exchangeId = getOrCreateRecoveryExchangeId(supportId);
      const newlyPrepared = await trpc.session.prepareHostCredentialExchange.mutate({
        supportId,
        recoveryExchangeId: exchangeId,
        source,
      });
      try {
        persistPreparedHostRecovery({
          supportId,
          sourceKind: this.sourceKind(),
          prepared: newlyPrepared,
          exchangeId,
        });
      } catch {
        if (this.destroyed || seq !== this.requestSeq) return;
        this.bannerError.set(this.publicErrorMessage('storageError'));
        this.requestFocus();
        return;
      }
      if (this.destroyed || seq !== this.requestSeq) return;
      this.prepared.set(newlyPrepared);
      this.sessionCode.set(newlyPrepared.code);
      this.secret.set('');
      this.openNewCard();
    } catch (error) {
      if (this.destroyed || seq !== this.requestSeq) return;
      this.bannerError.set(this.publicErrorMessage(classifyRecoveryRequestError(error, 'prepare')));
      this.requestFocus();
    } finally {
      this.endBusy(seq);
    }
  }

  async activateAccess(): Promise<void> {
    const prepared = this.prepared();
    if (this.busy() || !prepared || !this.newCardSaved()) return;
    this.bannerError.set(null);
    try {
      persistPreparedHostRecovery({
        supportId: prepared.recoveryCard.supportId,
        sourceKind: this.sourceKind(),
        prepared,
        exchangeId: getOrCreateRecoveryExchangeId(prepared.recoveryCard.supportId),
      });
      markHostRecoveryNewCardSaved(prepared.recoveryCard.supportId);
    } catch {
      this.bannerError.set(this.publicErrorMessage('storageError'));
      this.requestFocus();
      return;
    }

    const seq = this.beginBusy('activating');
    try {
      try {
        markHostRecoveryActivationUnconfirmed(prepared.recoveryCard.supportId);
      } catch {
        if (this.destroyed || seq !== this.requestSeq) return;
        this.bannerError.set(this.publicErrorMessage('storageError'));
        this.requestFocus();
        return;
      }
      const activated = await trpc.session.activateHostCredential.mutate({
        supportId: prepared.recoveryCard.supportId,
        browserCapability: prepared.browserCapability,
      });
      markHostRecoveryActivated(prepared.recoveryCard.supportId, prepared.browserCapability);
      setHostToken(prepared.code, activated.hostToken);
      this.sessionCode.set(prepared.code);
      this.showNewCodeHint.set(true);
      if (this.destroyed || seq !== this.requestSeq) return;
      this.view.set('success');
      this.requestFocus();
    } catch (error) {
      try {
        markHostRecoveryActivationUnconfirmed(prepared.recoveryCard.supportId);
      } catch {
        // Der Activate-Request kann bereits gegangen sein; der unbestätigte Zustand bleibt fachlich gültig.
      }
      if (this.destroyed || seq !== this.requestSeq) return;
      this.view.set('activationUnconfirmed');
      this.bannerError.set(null);
      this.requestFocus();
      void error;
    } finally {
      this.endBusy(seq);
    }
  }

  async resumeRecovery(supportId = this.supportId().trim().toUpperCase()): Promise<void> {
    if (this.busy()) return;
    this.bannerError.set(null);
    const resume = getHostRecoveryResume(supportId);
    const pending = getPendingHostCredentialActivation(supportId);
    const code = resume?.code ?? pending?.code ?? this.sessionCode();
    const seq = this.beginBusy('checkingState');
    try {
      const capabilities = code
        ? getStoredHostCapabilities(code)
        : { active: null, candidate: null };
      if (code && capabilities.candidate) {
        const candidateIssue = await this.issueHostAccess(code, capabilities.candidate);
        if (candidateIssue.status === 'issued') {
          this.finishActivatedAccess({
            supportId,
            code,
            capability: capabilities.candidate,
            hostToken: candidateIssue.hostToken,
            showNewCodeHint:
              !!resume?.newCardSavedConfirmed &&
              !!(getPendingHostRecoveryCard(code) ?? pending?.recoveryCard),
            seq,
          });
          return;
        }
        if (candidateIssue.status === 'technical') {
          if (this.destroyed || seq !== this.requestSeq) return;
          this.showTechnicalResumeError(candidateIssue.kind, resume?.phase);
          return;
        }
      }

      if (resume?.phase === 'activation_unconfirmed' && (pending || capabilities.candidate)) {
        const capability = pending?.browserCapability ?? capabilities.candidate;
        if (capability) {
          try {
            const activated = await trpc.session.activateHostCredential.mutate({
              supportId: pending?.recoveryCard.supportId ?? supportId,
              browserCapability: capability,
            });
            this.finishActivatedAccess({
              supportId,
              code: pending?.code ?? code ?? resume.code,
              capability,
              hostToken: activated.hostToken,
              showNewCodeHint: resume.newCardSavedConfirmed,
              seq,
            });
            return;
          } catch (error) {
            if (this.destroyed || seq !== this.requestSeq) return;
            const kind = classifyRecoveryRequestError(error, 'activate');
            if (kind === 'networkError' || kind === 'serverError') {
              this.showTechnicalResumeError(kind, resume.phase);
              return;
            }
            this.view.set('activationUnconfirmed');
            this.requestFocus();
            return;
          }
        }
      }

      if (pending) {
        this.prepared.set(pending);
        this.sessionCode.set(pending.code);
        if (this.destroyed || seq !== this.requestSeq) return;
        this.openNewCard();
        return;
      }

      if (code && capabilities.active && capabilities.active !== capabilities.candidate) {
        const activeIssue = await this.issueHostAccess(code, capabilities.active);
        if (activeIssue.status === 'technical') {
          if (this.destroyed || seq !== this.requestSeq) return;
          this.showTechnicalResumeError(activeIssue.kind, resume?.phase);
          return;
        }
        if (activeIssue.status === 'issued' && resume?.phase === 'activated') {
          this.finishActivatedAccess({
            supportId,
            code,
            capability: capabilities.active,
            hostToken: activeIssue.hostToken,
            showNewCodeHint: false,
            seq,
          });
          return;
        }
      }

      if (this.destroyed || seq !== this.requestSeq) return;
      if (resume?.phase === 'activation_unconfirmed') {
        this.view.set('activationUnconfirmed');
        this.requestFocus();
        return;
      }
      if (resume?.sourceKind === 'ADMIN_HANDOFF') {
        this.view.set('handoffExpired');
      } else {
        discardExpiredPreparedRecovery(supportId);
        this.view.set('pendingExpired');
      }
      this.requestFocus();
    } finally {
      this.endBusy(seq);
    }
  }

  async goToSession(): Promise<void> {
    const code = this.sessionCode();
    if (!code || this.busy()) return;
    this.bannerError.set(null);
    try {
      const ok = await this.router.navigate(localizeCommands(['session', code, 'host']));
      if (!ok) {
        this.bannerError.set(
          $localize`:@@hostRecovery.navigationError:Der Zugang ist wiederhergestellt. Die Session konnte noch nicht geöffnet werden. Versuche es erneut.`,
        );
      }
    } catch {
      this.bannerError.set(
        $localize`:@@hostRecovery.navigationError:Der Zugang ist wiederhergestellt. Die Session konnte noch nicht geöffnet werden. Versuche es erneut.`,
      );
    }
  }

  continueLater(): void {
    void this.router.navigate(this.homeCommands());
  }

  restartRecovery(): void {
    const supportId = this.supportId().trim().toUpperCase();
    if (supportId) {
      const resume = getHostRecoveryResume(supportId);
      if (resume?.phase !== 'activation_unconfirmed' && resume?.phase !== 'activated') {
        discardExpiredPreparedRecovery(supportId);
        clearPreparedHostRecoverySecrets(supportId);
        clearHostRecoveryResume(supportId);
      }
    }
    this.resetCredentialForm({ keepSupportId: true });
    this.view.set('credentials');
    this.requestFocus();
  }

  startOtherSession(): void {
    this.resetCredentialForm({ keepSupportId: false });
    this.view.set('credentials');
    this.requestFocus();
  }

  async copy(field: Exclude<RecoveryCardField, 'all'>): Promise<void> {
    const prepared = this.prepared();
    if (!prepared) return;
    const value =
      field === 'supportId' ? prepared.recoveryCard.supportId : prepared.recoveryCard.recoveryCode;
    await this.writeClipboard(value, field);
  }

  async copyAll(): Promise<void> {
    const prepared = this.prepared();
    if (!prepared) return;
    await this.writeClipboard(this.buildPlainText(prepared), 'all');
  }

  download(): void {
    const prepared = this.prepared();
    if (!prepared) return;
    const content = this.buildDownloadHtml(prepared);
    const url = URL.createObjectURL(new Blob([content], { type: 'text/html;charset=utf-8' }));
    const anchor = this.document.createElement('a');
    const safeId = prepared.recoveryCard.supportId.replace(/[^A-Za-z0-9-]/g, '');
    anchor.href = url;
    anchor.download = `arsnova-host-notfallkarte-${safeId}.html`;
    this.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    this.downloadStarted.set(true);
    this.copyFailed.set(false);
  }

  private openNewCard(): void {
    this.newCardSaved.set(false);
    this.copiedField.set(null);
    this.copyFailed.set(false);
    this.downloadStarted.set(false);
    this.view.set('newCard');
    this.requestFocus();
  }

  private applyFieldError(
    control: FormControl<string>,
    errorSignal: ReturnType<typeof signal<string | null>>,
    message: string | null,
  ): void {
    errorSignal.set(message);
    if (message) {
      control.setErrors({ format: true });
      control.markAsTouched();
      control.markAsDirty();
    } else {
      control.setErrors(null);
    }
  }

  private async issueHostAccess(
    code: string,
    capability: string,
  ): Promise<
    | { status: 'issued'; hostToken: string }
    | { status: 'rejected' }
    | { status: 'technical'; kind: 'networkError' | 'serverError' }
  > {
    try {
      const issued = await trpc.session.issueHostAccessToken.mutate({
        code,
        browserCapability: capability,
      });
      return { status: 'issued', hostToken: issued.hostToken };
    } catch (error) {
      const kind = classifyRecoveryRequestError(error, 'issue');
      if (kind === 'networkError' || kind === 'serverError') {
        return { status: 'technical', kind };
      }
      return { status: 'rejected' };
    }
  }

  private finishActivatedAccess(params: {
    supportId: string;
    code: string;
    capability: string;
    hostToken: string;
    showNewCodeHint: boolean;
    seq: number;
  }): void {
    markHostRecoveryActivated(params.supportId, params.capability);
    setHostToken(params.code, params.hostToken);
    this.sessionCode.set(params.code);
    this.showNewCodeHint.set(params.showNewCodeHint);
    if (this.destroyed || params.seq !== this.requestSeq) return;
    this.view.set('success');
    this.requestFocus();
  }

  private showTechnicalResumeError(
    kind: 'networkError' | 'serverError',
    phase?: 'prepared' | 'activation_unconfirmed' | 'activated',
  ): void {
    this.bannerError.set(this.publicErrorMessage(kind));
    this.view.set(phase === 'activation_unconfirmed' ? 'activationUnconfirmed' : 'resume');
    this.requestFocus();
  }

  private resetCredentialForm(options: { keepSupportId: boolean }): void {
    if (!options.keepSupportId) {
      this.supportId.set('');
      this.supportIdControl.setValue('');
    }
    this.supportIdControl.setErrors(null);
    this.supportIdError.set(null);
    this.secret.set('');
    this.secretControl.setValue('');
    this.secretControl.setErrors(null);
    this.secretError.set(null);
    this.prepared.set(null);
    this.sessionCode.set(null);
    this.bannerError.set(null);
    this.showNewCodeHint.set(false);
  }

  private beginBusy(kind: 'checking' | 'activating' | 'checkingState'): number {
    const seq = ++this.requestSeq;
    this.busy.set(true);
    this.busyKind.set(kind);
    return seq;
  }

  private endBusy(seq: number): void {
    if (seq !== this.requestSeq) return;
    this.busy.set(false);
    this.busyKind.set(null);
  }

  private requestFocus(): void {
    this.focusToken += 1;
  }

  private publicErrorMessage(
    kind:
      'genericError' | 'networkError' | 'serverError' | 'storageError' | 'activationUnconfirmed',
  ): string {
    switch (kind) {
      case 'networkError':
        return $localize`:@@hostRecovery.networkError:Verbindung unterbrochen. Bitte versuche es erneut.`;
      case 'serverError':
        return $localize`:@@hostRecovery.serverError:Die Wiederherstellung ist vorübergehend nicht verfügbar. Versuche es später erneut.`;
      case 'storageError':
        return $localize`:@@hostRecovery.storageError:Dein Browser konnte den Zugang nicht speichern. Prüfe die Einstellungen für Website-Daten und versuche es erneut.`;
      case 'activationUnconfirmed':
        return $localize`:@@hostRecovery.activationUnconfirmed:Die Aktivierung konnte nicht bestätigt werden. Dein Zugang könnte bereits aktiv sein. Setze die Wiederherstellung fort.`;
      default:
        return $localize`:@@hostRecovery.genericError:Der Zugang konnte nicht wiederhergestellt werden. Prüfe deine Angaben oder wende dich an den Support.`;
    }
  }

  private cardLabels(includePending: boolean) {
    const recoveryUrl = this.recoveryUrl;
    return {
      downloadHeading: $localize`:@@hostRecovery.downloadHeading:Host-Zugangsdaten`,
      downloadIntro: $localize`:@@hostRecovery.downloadIntro:Mit diesen Angaben kannst du deinen Host-Zugang auf einem anderen Gerät oder in einem anderen Browser wiederherstellen.`,
      supportIdLabel: $localize`:@@hostRecovery.supportIdLabel:Session-Kennung`,
      recoveryCodeLabel: $localize`:@@hostRecovery.recoveryCodeLabel:Wiederherstellungscode`,
      recoveryPageLabel: $localize`:@@hostRecovery.recoveryPageLabel:Wiederherstellungsseite`,
      supportIdHint: $localize`:@@hostRecovery.supportIdHint:Beginnt mit ARS-. Den sechsstelligen Teilnahme-Code brauchst du hier nicht.`,
      recoveryCodeHint: $localize`:@@hostRecovery.recoveryCodeHint:Halte diesen Code geheim.`,
      downloadHowTo: $localize`:@@hostRecovery.downloadHowTo:So stellst du den Host-Zugang wieder her`,
      downloadUsage: $localize`:@@hostRecovery.downloadUsage:Öffne ${recoveryUrl}:recoveryUrl: in dem Browser, in dem du die Session moderieren möchtest. Gib dort die Session-Kennung und den Wiederherstellungscode ein.`,
      downloadRotationNotice: $localize`:@@hostRecovery.downloadRotationNotice:Nach einer Wiederherstellung gilt der neu ausgegebene Wiederherstellungscode. Ersetze dann deine bisher gespeicherten Zugangsdaten.`,
      downloadStatePending: includePending
        ? $localize`:@@hostRecovery.downloadStatePending:Diese Zugangsdaten werden gültig, sobald du den neuen Host-Zugang aktivierst.`
        : undefined,
      cardWarning: $localize`:@@hostRecovery.cardWarning:Wenn dir der Browserzugang und die gespeicherten Zugangsdaten fehlen, wende dich an den Support. Er muss deine Berechtigung für diese Session prüfen.`,
      supportContactLink: $localize`:@@hostRecovery.supportContactLink:Kontaktdaten im Impressum`,
      supportContactHref: resolveLocalizedAppUrl('/legal/imprint'),
    };
  }

  private buildPlainText(prepared: PreparedHostRecovery): string {
    return buildHostRecoveryCardPlainText(
      prepared.recoveryCard,
      this.recoveryUrl,
      this.cardLabels(true),
    );
  }

  private buildDownloadHtml(prepared: PreparedHostRecovery): string {
    return buildHostRecoveryCardHtml({
      card: prepared.recoveryCard,
      recoveryUrl: this.recoveryUrl,
      lang: this.document.documentElement.lang || 'de',
      labels: this.cardLabels(true),
    });
  }

  private async writeClipboard(value: string, field: RecoveryCardField): Promise<void> {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    try {
      if (!clipboard) throw new Error('clipboard unavailable');
      await clipboard.writeText(value);
      this.copiedField.set(field);
      this.copyFailed.set(false);
      this.downloadStarted.set(false);
    } catch {
      this.copyFailed.set(true);
    }
  }
}
