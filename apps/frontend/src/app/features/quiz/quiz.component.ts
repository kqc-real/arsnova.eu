import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

/**
 * Quiz-Shell (Epic 1). Child-Routes: Liste, new, :id, :id/preview, sync/:docId.
 * Header „Deine Quiz-Sammlung“ wird auf der Vorschau-Seite ausgeblendet.
 */
@Component({
  selector: 'app-quiz',
  imports: [RouterOutlet, MatIcon],
  templateUrl: './quiz.component.html',
  styleUrl: './quiz.component.scss',
})
export class QuizComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private navSub?: Subscription;

  readonly showHeader = signal(true);
  readonly pageTitle = signal<'LIST' | 'NEW'>('LIST');

  ngOnInit(): void {
    this.updateHeaderVisibility();
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.updateHeaderVisibility());
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  private updateHeaderVisibility(): void {
    const isPreview = this.router.url.includes('/preview');
    this.showHeader.set(!isPreview);
    this.pageTitle.set(this.router.url.includes('/new') ? 'NEW' : 'LIST');
  }
}
