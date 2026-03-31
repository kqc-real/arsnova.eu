import { isPlatformBrowser, Location } from '@angular/common';
import {
  Component,
  computed,
  inject,
  isDevMode,
  LOCALE_ID,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { trpc } from '../../core/trpc.client';

/** Nur bei `ng serve` / nicht-Production: Demo-Zahl, wenn die API 0 liefert (leere lokale DB). */
const HELP_STATS_DEV_FAKE_MAX = 184;
/** Fester ISO-Zeitpunkt für die Demo-Anzeige (UTC). */
const HELP_STATS_DEV_FAKE_UPDATED_AT_ISO = '2025-11-08T16:45:00.000Z';

/**
 * Hilfe-Seite: Nutzerorientierte Anleitung, Layout und Stil wie Legal-Seiten.
 */
@Component({
  selector: 'app-help',
  imports: [MatButton, MatIcon],
  templateUrl: './help.component.html',
  styleUrls: ['../../shared/styles/dialog-title-header.scss', 'help.component.scss'],
})
export class HelpComponent implements OnInit {
  private readonly location = inject(Location);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly locale = inject(LOCALE_ID);

  readonly serverStatsLoading = signal(true);
  readonly serverStatsError = signal(false);
  readonly maxParticipantsRecord = signal(0);
  readonly maxParticipantsStatisticUpdatedAtIso = signal<string | null>(null);
  /** true, wenn die Rekord-Karte Demo-Zahlen aus isDevMode zeigt (API lieferte 0). */
  readonly statsUsesDevDemoValues = signal(false);

  /**
   * Zeitpunkt der letzten Kennzahl-Aktualisierung: Datum, Uhrzeit und Kurzname der Zeitzone
   * (z. B. MEZ/MESZ bei de-DE und Zeitzone Mitteleuropa) gemäß UI-Sprache und lokaler Systemzeitzone.
   */
  readonly recordUpdatedFormatted = computed(() => {
    const iso = this.maxParticipantsStatisticUpdatedAtIso();
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      try {
        return new Intl.DateTimeFormat(this.locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZoneName: 'short',
        }).format(d);
      } catch {
        return new Intl.DateTimeFormat(this.locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(d);
      }
    } catch {
      return null;
    }
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.serverStatsLoading.set(false);
      return;
    }
    void this.loadServerStats();
  }

  private async loadServerStats(): Promise<void> {
    try {
      const stats = await trpc.health.stats.query();
      const useDevFake = isDevMode() && stats.maxParticipantsSingleSession === 0;
      this.statsUsesDevDemoValues.set(useDevFake);
      if (useDevFake) {
        this.maxParticipantsRecord.set(HELP_STATS_DEV_FAKE_MAX);
        this.maxParticipantsStatisticUpdatedAtIso.set(HELP_STATS_DEV_FAKE_UPDATED_AT_ISO);
      } else {
        this.maxParticipantsRecord.set(stats.maxParticipantsSingleSession);
        this.maxParticipantsStatisticUpdatedAtIso.set(stats.maxParticipantsStatisticUpdatedAt);
      }
    } catch {
      this.serverStatsError.set(true);
    } finally {
      this.serverStatsLoading.set(false);
    }
  }

  back(): void {
    this.location.back();
  }
}
