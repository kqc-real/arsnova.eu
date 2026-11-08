import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
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
  private readonly route = inject(ActivatedRoute);
  private navSub?: Subscription;

  readonly showHeader = signal(true);
  readonly pageTitle = signal<'LIST' | 'NEW'>('LIST');
  readonly useCompactLayout = signal(true);
  readonly useCollectionLayout = signal(false);

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
    const childSegments: string[] = [];
    let activeChild = this.route.firstChild;
    while (activeChild) {
      childSegments.push(...activeChild.snapshot.url.map((segment) => segment.path));
      activeChild = activeChild.firstChild;
    }
    const childRoute = childSegments[0] ?? '';
    const isPreview = childSegments.includes('preview');
    const isEditorRoute = childRoute === 'new' || (childRoute !== '' && childRoute !== 'sync');

    this.showHeader.set(!isPreview);
    this.pageTitle.set(childRoute === 'new' ? 'NEW' : 'LIST');
    this.useCollectionLayout.set(childRoute === '');
    this.useCompactLayout.set(childRoute !== '' && !isEditorRoute);
  }
}
