import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { filter } from 'rxjs';
import { trpc } from '../../core/trpc.client';
import type { SessionInfoDTO } from '@arsnova/shared-types';
import { recordServerTimeIso } from './session-server-clock';

/**
 * Session-Shell (Epic 2 + 3). Child-Routes: host, present, vote. Redirect '' → host.
 * Host-Route ohne l-section, damit die Host-Ansicht volle Toolbar-Breite (56rem) nutzen kann.
 */
@Component({
  selector: 'app-session',
  imports: [MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatIcon, RouterOutlet],
  templateUrl: './session.component.html',
  styleUrl: './session.component.scss',
})
export class SessionComponent implements OnInit, OnDestroy {
  session = signal<SessionInfoDTO | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  /** true wenn Host-Route aktiv (dann keine l-section-Begrenzung). */
  isHostRoute = signal(false);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private sub: ReturnType<typeof Router.prototype.events.subscribe> | null = null;

  async ngOnInit(): Promise<void> {
    this.updateHostRoute();
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.updateHostRoute());

    const code = this.route.snapshot.paramMap.get('code') ?? '';
    if (code.length !== 6) {
      this.error.set($localize`Ungültiger Code.`);
      this.loading.set(false);
      return;
    }
    try {
      const info = await trpc.health.check.query();
      if (info.status !== 'ok') throw new Error('Backend nicht erreichbar');
      recordServerTimeIso(info.timestamp);
      const session = await trpc.session.getInfo.query({ code: code.toUpperCase() });
      recordServerTimeIso(session.serverTime);
      this.session.set(session);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : $localize`Nicht gefunden. Code prüfen oder neu eingeben.`;
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.sub = null;
  }

  private updateHostRoute(): void {
    const childPath =
      this.route.firstChild?.routeConfig?.path ?? this.route.snapshot.firstChild?.routeConfig?.path;
    this.isHostRoute.set(childPath === 'host');
  }
}
