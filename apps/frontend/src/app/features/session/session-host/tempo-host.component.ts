import { Component, input, output, signal, computed, OnDestroy, OnInit } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import type { TempoSnapshot, TempoTendency } from '@arsnova/shared-types';
import { trpc } from '../../../core/trpc.client';
import type { Unsubscribable } from '@trpc/server/observable';

type TempoDistEntry = { state: string; emoji: string; label: string; count: number; pct: number };

@Component({
  selector: 'app-tempo-host',
  standalone: true,
  imports: [MatButton, MatIconButton, MatIcon],
  template: `
    <div class="tempo-host">
      <div class="tempo-host__header">
        <span class="tempo-host__title" i18n="@@tempo.host.title">Tempo-Livekanal</span>
        <button
          mat-icon-button
          (click)="onClose()"
          [attr.aria-label]="closeLabel"
          i18n-aria-label="@@tempo.host.closeAria"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      @if (snapshot(); as snap) {
        <div class="tempo-host__bars" role="list" aria-label="Tempo-Verteilung">
          @for (entry of distribution(); track entry.state) {
            <div class="tempo-host__bar-row" role="listitem">
              <span class="tempo-host__emoji" aria-hidden="true">{{ entry.emoji }}</span>
              <span class="tempo-host__bar-label">{{ entry.label }}</span>
              <div class="tempo-host__bar-track" [attr.aria-label]="entry.pct + '%'">
                <div
                  class="tempo-host__bar-fill"
                  [style.width.%]="entry.pct"
                  [attr.data-state]="entry.state"
                ></div>
              </div>
              <span class="tempo-host__pct">{{ entry.pct }}&thinsp;%</span>
              @if (showAbsolute()) {
                <span class="tempo-host__abs">({{ entry.count }})</span>
              }
            </div>
          }
        </div>

        <div class="tempo-host__meta">
          <span class="tempo-host__total" i18n="@@tempo.host.totalVotes"
            >{{ snap.totalVotes }} Rückmeldung(en)</span
          >
          <span class="tempo-host__tendency">{{ tendencyText() }}</span>
        </div>

        <div class="tempo-host__actions">
          <button mat-button (click)="toggleAbsolute()" i18n="@@tempo.host.toggleAbsolute">
            {{ showAbsolute() ? 'Absolut ausblenden' : 'Absolut anzeigen' }}
          </button>
          <button mat-button color="warn" (click)="onClose()" i18n="@@tempo.host.closeChannel">
            Kanal schließen
          </button>
        </div>
      } @else {
        <p class="tempo-host__empty" i18n="@@tempo.host.noData">Noch keine Rückmeldungen.</p>
      }

      <p class="tempo-host__anon-hint" i18n="@@tempo.host.anonHint">
        Das Feedback ist anonym – Hosts sehen nur aggregierte Werte.
      </p>
    </div>
  `,
  styleUrl: './tempo-host.component.scss',
})
export class TempoHostComponent implements OnInit, OnDestroy {
  readonly sessionCode = input.required<string>();
  readonly closed = output<void>();

  readonly closeLabel = $localize`:@@tempo.host.closeAria:Tempo-Kanal schließen`;

  private sub: Unsubscribable | null = null;
  readonly snapshot = signal<TempoSnapshot | null>(null);
  readonly showAbsolute = signal(false);

  readonly distribution = computed<TempoDistEntry[]>(() => {
    const snap = this.snapshot();
    if (!snap) return [];
    const total = snap.totalVotes || 1;
    return [
      {
        state: 'speed_up',
        emoji: '🚀',
        label: $localize`:@@tempo.state.speedUp:Schneller`,
        count: snap.distribution.speed_up,
        pct: Math.round((snap.distribution.speed_up / total) * 100),
      },
      {
        state: 'following',
        emoji: '🙂',
        label: $localize`:@@tempo.state.following:Ich folge`,
        count: snap.distribution.following,
        pct: Math.round((snap.distribution.following / total) * 100),
      },
      {
        state: 'slow_down',
        emoji: '🐢',
        label: $localize`:@@tempo.state.slowDown:Langsamer`,
        count: snap.distribution.slow_down,
        pct: Math.round((snap.distribution.slow_down / total) * 100),
      },
      {
        state: 'lost',
        emoji: '😵',
        label: $localize`:@@tempo.state.lost:Verloren`,
        count: snap.distribution.lost,
        pct: Math.round((snap.distribution.lost / total) * 100),
      },
    ];
  });

  readonly tendencyText = computed<string>(() => {
    const tendency: TempoTendency = this.snapshot()?.tendency ?? 'no_data';
    const map: Record<TempoTendency, string> = {
      following: $localize`:@@tempo.tendency.following:Die Mehrheit kann folgen.`,
      too_fast: $localize`:@@tempo.tendency.tooFast:Das Tempo wirkt zu hoch.`,
      lost: $localize`:@@tempo.tendency.lost:Mehrere Teilnehmende sind abgehängt.`,
      underchallenged: $localize`:@@tempo.tendency.underchallenged:Die Gruppe signalisiert Unterforderung.`,
      heterogeneous: $localize`:@@tempo.tendency.heterogeneous:Die Gruppe ist heterogen.`,
      no_data: $localize`:@@tempo.tendency.noData:Noch keine Daten.`,
    };
    return map[tendency];
  });

  ngOnInit(): void {
    this.sub = trpc.tempo.onHostSnapshot.subscribe(
      { sessionCode: this.sessionCode() },
      {
        onData: (snap) => this.snapshot.set(snap),
        onError: () => {},
      },
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggleAbsolute(): void {
    this.showAbsolute.update((v) => !v);
  }

  onClose(): void {
    void trpc.tempo.setOpen.mutate({
      sessionCode: this.sessionCode(),
      open: false,
    });
    this.closed.emit();
  }
}
