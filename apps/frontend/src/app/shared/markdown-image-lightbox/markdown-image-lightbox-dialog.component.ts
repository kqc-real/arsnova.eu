import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

export type MarkdownImageLightboxData = {
  src: string;
  alt: string;
  title: string;
};

@Component({
  selector: 'app-markdown-image-lightbox-dialog',
  standalone: true,
  imports: [MatButton, MatDialogClose, MatIcon],
  templateUrl: './markdown-image-lightbox-dialog.component.html',
  styleUrl: './markdown-image-lightbox-dialog.component.scss',
})
export class MarkdownImageLightboxDialogComponent {
  @ViewChild('viewport', { static: true }) private readonly viewportRef?: ElementRef<HTMLElement>;
  readonly data = inject<MarkdownImageLightboxData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<MarkdownImageLightboxDialogComponent>);
  private readonly activePointers = new Map<number, { x: number; y: number }>();
  private readonly maxScale = 4;
  private readonly zoomedScale = 2.5;
  private readonly doubleTapDelayMs = 280;
  private readonly tapSlopPx = 24;
  private readonly swipeCloseThresholdPx = 120;
  private naturalWidth = 1;
  private naturalHeight = 1;
  private gestureMode: 'none' | 'pan' | 'pinch' | 'swipe' = 'none';
  private gestureStartPoint: { x: number; y: number } | null = null;
  private gestureStartTranslate = { x: 0, y: 0 };
  private gestureStartScale = 1;
  private pinchStartDistance = 0;
  private pinchStartMidpoint = { x: 0, y: 0 };
  private lastTap: { x: number; y: number; time: number } | null = null;
  private movedDuringGesture = false;
  scale = 1;
  translateX = 0;
  translateY = 0;
  swipeOffsetY = 0;

  caption(): string | null {
    const title = this.data.title.trim();
    if (title) {
      return title;
    }
    const alt = this.data.alt.trim();
    return alt || null;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }

  onImageLoad(event: Event): void {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) {
      return;
    }
    this.naturalWidth = image.naturalWidth || 1;
    this.naturalHeight = image.naturalHeight || 1;
  }

  onDoubleClick(event: MouseEvent): void {
    event.preventDefault();
    this.toggleZoomAt(event.clientX, event.clientY);
  }

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const viewport = this.viewportRef?.nativeElement;
    viewport?.setPointerCapture?.(event.pointerId);
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      const [first, second] = Array.from(this.activePointers.values());
      this.gestureMode = 'pinch';
      this.movedDuringGesture = false;
      this.gestureStartScale = this.scale;
      this.gestureStartTranslate = { x: this.translateX, y: this.translateY };
      this.pinchStartDistance = Math.max(1, this.distance(first, second));
      this.pinchStartMidpoint = this.toRelativePoint(this.midpoint(first, second));
      this.lastTap = null;
      event.preventDefault();
      return;
    }

    this.gestureStartPoint = { x: event.clientX, y: event.clientY };
    this.gestureStartTranslate = { x: this.translateX, y: this.translateY };
    this.movedDuringGesture = false;
    this.gestureMode = this.scale > 1 ? 'pan' : 'none';
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.activePointers.has(event.pointerId)) {
      return;
    }

    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size >= 2) {
      const [first, second] = Array.from(this.activePointers.values());
      const currentDistance = Math.max(1, this.distance(first, second));
      const nextScale = this.clamp(
        this.gestureStartScale * (currentDistance / this.pinchStartDistance),
        1,
        this.maxScale,
      );
      const currentMidpoint = this.toRelativePoint(this.midpoint(first, second));
      const nextTranslate = this.clampTranslate(
        this.projectTranslateForScale(
          this.gestureStartScale,
          nextScale,
          this.gestureStartTranslate,
          this.pinchStartMidpoint,
          currentMidpoint,
        ),
        nextScale,
      );
      this.scale = nextScale;
      this.translateX = nextTranslate.x;
      this.translateY = nextTranslate.y;
      this.swipeOffsetY = 0;
      this.movedDuringGesture = true;
      event.preventDefault();
      return;
    }

    if (!this.gestureStartPoint) {
      return;
    }

    const deltaX = event.clientX - this.gestureStartPoint.x;
    const deltaY = event.clientY - this.gestureStartPoint.y;

    if (this.scale > 1) {
      const nextTranslate = this.clampTranslate(
        {
          x: this.gestureStartTranslate.x + deltaX,
          y: this.gestureStartTranslate.y + deltaY,
        },
        this.scale,
      );
      this.translateX = nextTranslate.x;
      this.translateY = nextTranslate.y;
      this.movedDuringGesture ||= Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1;
      event.preventDefault();
      return;
    }

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (deltaY > 0 && absY > Math.max(8, absX)) {
      this.gestureMode = 'swipe';
      this.swipeOffsetY = deltaY;
      this.movedDuringGesture = absY > this.tapSlopPx;
      event.preventDefault();
      return;
    }

    this.movedDuringGesture ||= absX > this.tapSlopPx || absY > this.tapSlopPx;
  }

  onPointerUp(event: PointerEvent): void {
    this.releasePointer(event.pointerId, event.currentTarget);

    if (this.gestureMode === 'pinch' && this.activePointers.size === 1) {
      const [remainingPointer] = Array.from(this.activePointers.values());
      this.gestureMode = this.scale > 1 ? 'pan' : 'none';
      this.gestureStartPoint = { ...remainingPointer };
      this.gestureStartTranslate = { x: this.translateX, y: this.translateY };
      this.movedDuringGesture = false;
      return;
    }

    if (this.activePointers.size > 0) {
      return;
    }

    if (this.gestureMode === 'swipe') {
      if (this.swipeOffsetY >= this.swipeCloseThresholdPx) {
        this.close();
        return;
      }
      this.swipeOffsetY = 0;
    }

    if (
      event.pointerType === 'touch' &&
      !this.movedDuringGesture &&
      this.gestureStartPoint &&
      this.gestureMode !== 'pinch'
    ) {
      this.handleTouchTap(event);
    }

    this.gestureMode = 'none';
    this.gestureStartPoint = null;
    this.movedDuringGesture = false;
  }

  onPointerCancel(event: PointerEvent): void {
    this.releasePointer(event.pointerId, event.currentTarget);
    if (this.activePointers.size === 0) {
      this.gestureMode = 'none';
      this.gestureStartPoint = null;
      this.movedDuringGesture = false;
      this.swipeOffsetY = 0;
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  imageTransform(): string {
    return `translate3d(${this.translateX}px, ${this.translateY}px, 0) scale(${this.scale})`;
  }

  viewportTransform(): string {
    const compress = Math.max(0.96, 1 - this.swipeOffsetY / 1200);
    return `translate3d(0, ${this.swipeOffsetY}px, 0) scale(${compress})`;
  }

  viewportOpacity(): number {
    return Math.max(0.72, 1 - this.swipeOffsetY / 360);
  }

  isZoomed(): boolean {
    return this.scale > 1.01;
  }

  isDragging(): boolean {
    return this.gestureMode === 'pan' || this.gestureMode === 'pinch';
  }

  private handleTouchTap(event: PointerEvent): void {
    const now = Date.now();
    const currentTap = { x: event.clientX, y: event.clientY, time: now };
    if (
      this.lastTap &&
      now - this.lastTap.time <= this.doubleTapDelayMs &&
      this.distance(this.lastTap, currentTap) <= this.tapSlopPx
    ) {
      this.toggleZoomAt(event.clientX, event.clientY);
      this.lastTap = null;
      return;
    }
    this.lastTap = currentTap;
  }

  private toggleZoomAt(clientX: number, clientY: number): void {
    if (this.isZoomed()) {
      this.resetZoom();
      return;
    }

    const focalPoint = this.toRelativePoint({ x: clientX, y: clientY });
    const nextTranslate = this.clampTranslate(
      this.projectTranslateForScale(1, this.zoomedScale, { x: 0, y: 0 }, focalPoint, focalPoint),
      this.zoomedScale,
    );
    this.scale = this.zoomedScale;
    this.translateX = nextTranslate.x;
    this.translateY = nextTranslate.y;
    this.swipeOffsetY = 0;
  }

  private resetZoom(): void {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.swipeOffsetY = 0;
  }

  private releasePointer(pointerId: number, currentTarget: EventTarget | null): void {
    this.activePointers.delete(pointerId);
    if (currentTarget instanceof HTMLElement && currentTarget.hasPointerCapture(pointerId)) {
      currentTarget.releasePointerCapture(pointerId);
    }
  }

  private toRelativePoint(point: { x: number; y: number }): { x: number; y: number } {
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport) {
      return { x: 0, y: 0 };
    }
    const rect = viewport.getBoundingClientRect();
    return {
      x: point.x - rect.left - rect.width / 2,
      y: point.y - rect.top - rect.height / 2,
    };
  }

  private projectTranslateForScale(
    startScale: number,
    nextScale: number,
    startTranslate: { x: number; y: number },
    startFocal: { x: number; y: number },
    nextFocal: { x: number; y: number },
  ): { x: number; y: number } {
    const contentX = (startFocal.x - startTranslate.x) / startScale;
    const contentY = (startFocal.y - startTranslate.y) / startScale;
    return {
      x: nextFocal.x - contentX * nextScale,
      y: nextFocal.y - contentY * nextScale,
    };
  }

  private clampTranslate(
    translate: { x: number; y: number },
    scale: number,
  ): { x: number; y: number } {
    const baseImageSize = this.baseImageSize();
    const viewport = this.viewportRef?.nativeElement;
    const viewportRect = viewport?.getBoundingClientRect();
    const viewportWidth = viewportRect?.width ?? baseImageSize.width;
    const viewportHeight = viewportRect?.height ?? baseImageSize.height;
    const scaledWidth = baseImageSize.width * scale;
    const scaledHeight = baseImageSize.height * scale;
    const maxX = Math.max(0, (scaledWidth - viewportWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - viewportHeight) / 2);
    return {
      x: this.clamp(translate.x, -maxX, maxX),
      y: this.clamp(translate.y, -maxY, maxY),
    };
  }

  private baseImageSize(): { width: number; height: number } {
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport || !this.naturalWidth || !this.naturalHeight) {
      return { width: 1, height: 1 };
    }
    const rect = viewport.getBoundingClientRect();
    const viewportRatio = rect.width / rect.height;
    const imageRatio = this.naturalWidth / this.naturalHeight;
    if (imageRatio >= viewportRatio) {
      return {
        width: rect.width,
        height: rect.width / imageRatio,
      };
    }
    return {
      width: rect.height * imageRatio,
      height: rect.height,
    };
  }

  private midpoint(
    first: { x: number; y: number },
    second: { x: number; y: number },
  ): { x: number; y: number } {
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
  }

  private distance(first: { x: number; y: number }, second: { x: number; y: number }): number {
    const deltaX = first.x - second.x;
    const deltaY = first.y - second.y;
    return Math.hypot(deltaX, deltaY);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
