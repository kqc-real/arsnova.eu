/**
 * Server-Status-Widget (Footer): ein kompakter Status-Button, der den Statistik-Dialog öffnet.
 */
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import type { FooterStatusDTO } from '@arsnova/shared-types';
import { resolveFooterStatusColor, type FooterStatusColor } from './footer-status-color';

@Component({
  selector: 'app-server-status-widget',
  imports: [MatButton, MatIcon, MatTooltip],
  templateUrl: './server-status-widget.component.html',
  styleUrls: ['./server-status-widget.component.scss'],
})
export class ServerStatusWidgetComponent {
  /** Wenn false, ist der Serverstatus derzeit nicht erreichbar. */
  @Input() connectionOk = true;
  /** true, solange die erste Footer-Health-Abfrage noch läuft. */
  @Input() loading = false;
  /** Aktuelle Kennzahlen aus dem App-Shell-State. */
  @Input() stats: FooterStatusDTO | null = null;
  @Output() openRequested = new EventEmitter<void>();

  openDialog(): void {
    this.openRequested.emit();
  }

  statusColor(): FooterStatusColor {
    return resolveFooterStatusColor(this.connectionOk, this.loading, this.stats);
  }
}
