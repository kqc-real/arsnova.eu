/**
 * Server-Status-Widget (Footer): ein kompakter Status-Button, der den Statistik-Dialog öffnet.
 */
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import type { ServerStatsDTO } from '@arsnova/shared-types';

@Component({
  selector: 'app-server-status-widget',
  imports: [MatButton, MatIcon],
  templateUrl: './server-status-widget.component.html',
  styleUrls: ['./server-status-widget.component.scss'],
})
export class ServerStatusWidgetComponent {
  /** Wenn false, ist der Serverstatus derzeit nicht erreichbar. */
  @Input() connectionOk = true;
  /** true, solange die erste Footer-Health-Abfrage noch läuft. */
  @Input() loading = false;
  /** Aktuelle Kennzahlen aus dem App-Shell-State. */
  @Input() stats: ServerStatsDTO | null = null;
  @Output() openRequested = new EventEmitter<void>();

  openDialog(): void {
    this.openRequested.emit();
  }

  statusColor(): 'green' | 'yellow' | 'red' | 'gray' {
    if (!this.connectionOk || this.loading) return 'gray';
    const s = this.stats;
    if (!s) return 'gray';
    switch (s.serverStatus) {
      case 'healthy':
        return 'green';
      case 'busy':
        return 'yellow';
      case 'overloaded':
        return 'red';
      default:
        return 'gray';
    }
  }
}
