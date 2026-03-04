import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { trpc } from '../../core/trpc.client';
import type { SessionInfoDTO } from '@arsnova/shared-types';

/**
 * Session-Shell (Epic 2 + 3). Child-Routes: host, present, vote. Redirect '' → host.
 */
@Component({
  selector: 'app-session',
  imports: [MatButton, MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatIcon, RouterOutlet],
  templateUrl: './session.component.html',
  styleUrl: './session.component.scss',
})
export class SessionComponent implements OnInit {
  session = signal<SessionInfoDTO | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  private readonly route = inject(ActivatedRoute);

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.paramMap.get('code') ?? '';
    if (code.length !== 6) {
      this.error.set('Ungültiger Code.');
      this.loading.set(false);
      return;
    }
    try {
      const info = await trpc.health.check.query();
      if (info.status !== 'ok') throw new Error('Backend nicht erreichbar');
      const session = await trpc.session.getInfo.query({ code: code.toUpperCase() });
      this.session.set(session);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Nicht gefunden. Code prüfen oder neu eingeben.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
