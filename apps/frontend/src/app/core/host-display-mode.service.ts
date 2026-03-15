import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HostDisplayModeService {
  readonly hostSessionActive = signal(false);
  readonly preferImmersiveHost = signal(true);
  readonly immersiveHostActive = computed(() =>
    this.hostSessionActive() && this.preferImmersiveHost(),
  );

  setHostSessionActive(active: boolean): void {
    this.hostSessionActive.set(active);
    if (!active) {
      this.preferImmersiveHost.set(true);
    }
  }

  setPreferImmersiveHost(active: boolean): void {
    this.preferImmersiveHost.set(active);
  }
}
