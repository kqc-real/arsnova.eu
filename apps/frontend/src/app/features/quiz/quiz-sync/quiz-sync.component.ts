import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { localizePath } from '../../../core/locale-router';
import { resolveLocalizedAppUrl } from '../../../core/locale-router';
import { QuizStoreService } from '../data/quiz-store.service';

/**
 * Quiz per Sync-Link auf anderem Gerät öffnen (Epic 1).
 * Story 1.6, 1.6a, 1.6b.
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
  private readonly quizStore = inject(QuizStoreService);

  readonly docId = this.route.snapshot.paramMap.get('docId') ?? '';
  readonly syncConnectionState = this.quizStore.syncConnectionState;
  readonly syncPeerInfos = this.quizStore.syncPeerInfos;
  readonly syncError = signal<string | null>(null);
  readonly copyStatus = signal<string | null>(null);
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
  readonly syncLink = computed(() => {
    return resolveLocalizedAppUrl(`/quiz/sync/${this.docId}`);
  });

  constructor() {
    try {
      this.quizStore.activateSyncRoom(this.docId, { markShared: true, registerOrigin: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sync-Raum konnte nicht aktiviert werden.';
      this.syncError.set(message);
    }
  }

  async copySyncLink(): Promise<void> {
    await this.copyText(
      this.syncLink(),
      $localize`:@@quizSync.copyLinkDone:Sync-Link wurde kopiert.`,
    );
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
