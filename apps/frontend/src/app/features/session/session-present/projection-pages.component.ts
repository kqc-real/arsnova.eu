import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { paginateProjection, prepareProjectionSource } from './projection-pages.util';

@Component({
  selector: 'app-projection-pages',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div #source class="projection-pages__source" aria-hidden="true" inert><ng-content /></div>
    <div #viewport class="projection-pages__viewport">
      <div #page class="projection-pages__page"></div>
    </div>
    <div #status class="projection-pages__status"></div>
    <p
      class="projection-pages__indicator"
      aria-live="polite"
      i18n="@@sessionPresent.projectionPage"
    >
      Seite {{ visibleIndex() + 1 }} / {{ count() }}
    </p>
  `,
  styleUrl: './projection-pages.component.scss',
})
export class ProjectionPagesComponent implements AfterViewInit {
  readonly pageIndex = input(0);
  readonly pageContext = input('');
  readonly pageCount = output<number>();
  readonly count = signal(1);
  readonly visibleIndex = signal(0);
  private readonly source = viewChild.required<ElementRef<HTMLElement>>('source');
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly page = viewChild.required<ElementRef<HTMLElement>>('page');
  private readonly status = viewChild.required<ElementRef<HTMLElement>>('status');
  private readonly destroyRef = inject(DestroyRef);
  private pages: HTMLElement[] = [];
  private frame = 0;
  private signature = '';
  private emittedCount = '';
  private destroyed = false;

  constructor() {
    effect(() => {
      this.pageIndex();
      this.showPage();
    });
    effect(() => {
      this.pageContext();
      this.signature = '';
      this.schedule();
    });
  }

  ngAfterViewInit(): void {
    const source = this.source().nativeElement;
    const schedule = (): void => this.schedule();
    const mutations = new MutationObserver(schedule);
    mutations.observe(source, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    const resize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            const viewport = this.viewport().nativeElement;
            const page = this.page().nativeElement;
            // Late fonts and fractional layout changes can alter a previously measured page.
            if (
              page.scrollHeight > viewport.clientHeight ||
              page.scrollWidth > viewport.clientWidth
            )
              this.signature = '';
            schedule();
          });
    resize?.observe(this.viewport().nativeElement);
    resize?.observe(this.page().nativeElement);
    const remeasure = (): void => {
      this.signature = '';
      schedule();
    };
    const loadedVisibleImages = new Set<string>();
    const visibleImageLoaded = (event: Event): void => {
      if (!(event.target instanceof HTMLImageElement)) return;
      const image = event.target;
      const key = `${image.currentSrc}:${image.naturalWidth}:${image.naturalHeight}`;
      // Cached images also fire load when cloned; each intrinsic size needs only one extra pass.
      if (loadedVisibleImages.has(key)) return;
      loadedVisibleImages.add(key);
      remeasure();
    };
    source.addEventListener('load', remeasure, true);
    source.addEventListener('error', remeasure, true);
    this.page().nativeElement.addEventListener('load', visibleImageLoaded, true);
    const fonts = source.ownerDocument.fonts;
    fonts?.addEventListener('loadingdone', remeasure);
    void fonts?.ready.then(remeasure);
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      mutations.disconnect();
      resize?.disconnect();
      cancelAnimationFrame(this.frame);
      source.removeEventListener('load', remeasure, true);
      source.removeEventListener('error', remeasure, true);
      this.page().nativeElement.removeEventListener('load', visibleImageLoaded, true);
      fonts?.removeEventListener('loadingdone', remeasure);
    });
    schedule();
  }

  private schedule(): void {
    if (this.destroyed) return;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.rebuild());
  }

  private rebuild(): void {
    const root = this.source().nativeElement.firstElementChild as HTMLElement | null;
    if (!root) return;
    const viewport = this.viewport().nativeElement;
    if (!viewport.clientHeight || !viewport.clientWidth) return;
    const status = root.querySelector('[data-projection-status]');
    this.status().nativeElement.replaceChildren(...(status ? [status.cloneNode(true)] : []));
    const snapshot = prepareProjectionSource(root);
    snapshot.querySelectorAll('[data-projection-status]').forEach((node) => node.remove());
    const signature = `${viewport.clientWidth}:${viewport.clientHeight}:${snapshot.innerHTML}`;
    if (signature === this.signature) return;
    this.signature = signature;
    const target = this.page().nativeElement;
    this.pages = paginateProjection(snapshot, (candidate) => {
      target.replaceChildren(candidate);
      // Leave room for fractional font/layout rounding when the fragment is cloned again.
      return (
        target.scrollHeight <= viewport.clientHeight - 8 &&
        target.scrollWidth <= viewport.clientWidth
      );
    });
    this.count.set(this.pages.length);
    this.showPage();
    // A provisional short layout must not clamp the saved page while media/fonts reload.
    const resourcesPending =
      Array.from(root.querySelectorAll('img')).some((image) => !image.complete) ||
      root.ownerDocument.fonts?.status === 'loading';
    if (resourcesPending && this.pageIndex() >= this.pages.length) return;
    if (this.emittedCount !== `${this.pageContext()}:${this.pages.length}`) {
      this.emittedCount = `${this.pageContext()}:${this.pages.length}`;
      this.pageCount.emit(this.pages.length);
    }
  }

  private showPage(): void {
    if (!this.pages.length) return;
    const index = Math.max(0, Math.min(this.pages.length - 1, this.pageIndex()));
    this.visibleIndex.set(index);
    this.page().nativeElement.replaceChildren(this.pages[index]!.cloneNode(true));
  }
}
