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
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resize?.observe(this.viewport().nativeElement);
    source.addEventListener('load', schedule, true);
    void source.ownerDocument.fonts?.ready.then(schedule);
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      mutations.disconnect();
      resize?.disconnect();
      cancelAnimationFrame(this.frame);
      source.removeEventListener('load', schedule, true);
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
      return (
        target.scrollHeight <= viewport.clientHeight + 1 &&
        target.scrollWidth <= viewport.clientWidth + 1
      );
    });
    this.count.set(this.pages.length);
    this.showPage();
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
