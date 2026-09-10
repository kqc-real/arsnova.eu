import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { localizePath } from '../../../core/locale-router';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from '../../../shared/confirm-leave-dialog/confirm-leave-dialog.component';
import { QuizStoreService } from '../data/quiz-store.service';

/**
 * Quiz per Sync-Link auf anderem Gerät öffnen (Epic 1).
 * Story 1.6, 1.6a, 1.6b, 1.6c Slice B (Share-Token / Rotation).
 */
@Component({
  selector: 'app-quiz-sync',
  standalone: true,
  imports: [RouterLink, MatButton, MatCard, MatCardContent, MatIcon],
  templateUrl: './quiz-sync.component.html',
  styleUrls: ['../../../shared/styles/dialog-title-header.scss', './quiz-sync.component.scss'],
})
export class QuizSyncComponent {
  readonly localizedPath = localizePath;
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizStore = inject(QuizStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly isSharedLibrary = computed(() => this.quizStore.librarySharingMode() === 'shared');

  readonly docId = this.route.snapshot.paramMap.get('docId') ?? '';
  readonly syncConnectionState = this.quizStore.syncConnectionState;
  readonly syncPeerInfos = this.quizStore.syncPeerInfos;
  readonly canInvalidateSyncLink = this.quizStore.canInvalidateSyncLink;
  readonly syncShareStatus = this.quizStore.syncShareStatus;
  readonly syncShareError = this.quizStore.syncShareError;
  readonly syncShareReady = computed(() => !!this.quizStore.syncShareToken());
  readonly syncError = signal<string | null>(null);
  readonly copyStatus = signal<string | null>(null);
  readonly invalidatePending = signal(false);
  readonly hasConnectedPeer = computed(
    () => this.syncConnectionState() === 'connected' && this.syncPeerInfos().length > 0,
  );
  readonly syncStatusLabel = computed(() => {
    const state = this.syncConnectionState();
    if (state === 'connected') {
      return this.hasConnectedPeer()
        ? $localize`:@@quizSync.stateConnected:Verbunden`
        : $localize`:@@quizSync.stateReady:Bereit (warte auf weiteres Gerät)`;
    }
    if (state === 'connecting') {
      return $localize`:@@quizSync.stateConnecting:Verbindung wird aufgebaut`;
    }
    return $localize`:@@quizSync.stateOffline:Offline (nur lokal)`;
  });
  readonly syncLink = computed(() =>
    this.quizStore.buildSyncShareLink(this.quizStore.syncRoomId()),
  );
  readonly copyDisabled = computed(
    () => !this.syncShareReady() || this.syncShareStatus() === 'pending',
  );

  constructor() {
    try {
      const fragmentToken = new URLSearchParams(this.route.snapshot.fragment ?? '').get('s');
      const shareToken = fragmentToken ?? this.route.snapshot.queryParamMap.get('s');
      const previousRoomId = this.quizStore.syncRoomId();
      const ownLocalLibrary =
        !shareToken &&
        previousRoomId === this.docId &&
        this.quizStore.librarySharingMode() === 'local';

      this.quizStore.activateSyncRoom(this.docId, {
        markShared: true,
        secureAsOrigin: ownLocalLibrary,
        shareToken,
      });

      if (shareToken) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { s: null },
          queryParamsHandling: 'merge',
          fragment: '',
          replaceUrl: true,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sync-Raum konnte nicht aktiviert werden.';
      this.syncError.set(message);
    }

    effect(() => {
      const roomId = this.quizStore.syncRoomId();
      if (!this.syncShareReady() || roomId === this.docId) return;
      void this.router.navigateByUrl(localizePath(`/quiz/sync/${roomId}`), {
        replaceUrl: true,
      });
    });
  }

  async copySyncLink(): Promise<void> {
    if (this.copyDisabled()) return;
    await this.copyText(
      this.syncLink(),
      $localize`:@@quizSync.copyLinkDone:Sync-Link wurde kopiert.`,
    );
  }

  async invalidateSyncLink(): Promise<void> {
    if (this.invalidatePending() || this.copyDisabled()) return;
    const confirmed =
      typeof globalThis.confirm !== 'function'
        ? true
        : globalThis.confirm(
            $localize`:@@quizSync.invalidateConfirm:Alten Sync-Link ungültig machen? Andere Geräte brauchen danach den neuen Link. Lokal gespeicherte Quizze bleiben erhalten.`,
          );
    if (!confirmed) return;

    this.invalidatePending.set(true);
    this.syncError.set(null);
    this.copyStatus.set(null);
    try {
      const nextLink = await this.quizStore.invalidateSyncShareLink();
      await this.copyText(
        nextLink,
        $localize`:@@quizSync.invalidateDone:Alter Sync-Link ist ungültig. Der neue Link wurde kopiert.`,
      );
    } catch (error) {
      this.syncError.set(
        error instanceof Error
          ? error.message
          : $localize`:@@quizSync.invalidateFailed:Sync-Link konnte nicht ungültig gemacht werden.`,
      );
    } finally {
      this.invalidatePending.set(false);
    }
  }

  async unlinkSharedLibrary(): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmLeaveDialogComponent, {
      data: {
        title: $localize`:@@quizList.syncUnlinkTitle:Teilen beenden?`,
        message: $localize`:@@quizList.syncUnlinkMessage:Die Quiz-Sammlung bleibt auf diesem Gerät. Die Sync-Verknüpfung und der Änderungsstatus werden zurückgesetzt.`,
        consequences: [
          $localize`:@@quizList.syncUnlinkConsequencePeers:Andere Geräte behalten ihren letzten Stand, sind aber nicht mehr mit dir verbunden.`,
          $localize`:@@quizList.syncUnlinkConsequenceNewLink:Ein neuer Klick auf „Sammlung teilen“ startet eine frische Verknüpfung.`,
        ],
        confirmLabel: $localize`:@@quizList.syncUnlinkConfirm:Teilen beenden`,
        cancelLabel: $localize`:@@quizList.syncUnlinkCancel:Abbrechen`,
      } satisfies ConfirmLeaveDialogData,
      width: 'min(26rem, calc(100vw - 1.5rem))',
      maxWidth: '100vw',
      autoFocus: 'dialog',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (confirmed !== true) return;

    this.quizStore.unlinkSharedLibrary();
    this.snackBar.open(
      $localize`:@@quizList.syncUnlinkSuccess:Teilen beendet. Die Sammlung ist wieder nur auf diesem Gerät aktiv.`,
      '',
      {
        duration: 4500,
        verticalPosition: 'top',
        horizontalPosition: 'center',
      },
    );
    await this.router.navigateByUrl(localizePath('/quiz'));
  }

  async createSecuredSyncLink(): Promise<void> {
    if (this.syncShareStatus() === 'pending') return;
    this.syncError.set(null);
    this.copyStatus.set(null);
    try {
      await this.quizStore.createSecuredSyncShareLink();
      this.copyStatus.set(
        $localize`:@@quizSync.secureLinkDone:Neuer abgesicherter Sync-Link ist bereit.`,
      );
    } catch (error) {
      this.syncError.set(
        error instanceof Error
          ? error.message
          : $localize`:@@quizSync.secureLinkFailed:Abgesicherter Sync-Link konnte nicht erstellt werden.`,
      );
    }
  }

  private async copyText(value: string, successMessage: string): Promise<void> {
    this.copyStatus.set(null);
    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      if (!clipboard) {
        throw new Error($localize`Clipboard API nicht verfügbar.`);
      }
      await clipboard.writeText(value);
      this.copyStatus.set(successMessage);
    } catch {
      this.copyStatus.set(
        $localize`:@@quizSync.copyFailed:Kopieren nicht möglich. Bitte manuell markieren und kopieren.`,
      );
    }
  }
}
