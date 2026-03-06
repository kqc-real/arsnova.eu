import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatCard, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { trpc } from '../../../core/trpc.client';
import type { SessionInfoDTO } from '@arsnova/shared-types';

/**
 * Host-Ansicht: Lobby + Präsentations-Steuerung (Epic 2).
 * Story 2.1a, 2.2, 2.3, 2.4, 4.2, 4.6, 4.7, 4.8, 7.1, 8.1, 8.4.
 */
@Component({
  selector: 'app-session-host',
  standalone: true,
  imports: [
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardSubtitle,
    MatCardTitle,
  ],
  templateUrl: './session-host.component.html',
  styleUrl: './session-host.component.scss',
})
export class SessionHostComponent implements OnInit {
  session = signal<SessionInfoDTO | null>(null);
  private readonly route = inject(ActivatedRoute);

  async ngOnInit(): Promise<void> {
    const code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
    if (code.length !== 6) return;
    try {
      const session = await trpc.session.getInfo.query({ code: code.toUpperCase() });
      this.session.set(session);
    } catch {
      this.session.set(null);
    }
  }
}
