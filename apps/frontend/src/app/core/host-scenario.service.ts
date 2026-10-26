import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type HostScenario = 'CLASSROOM' | 'EVENT' | 'QUICK';

const PREFERENCE_KEY = 'arsnova-host-scenario:v1';
const SESSION_PREFIX = 'arsnova-host-scenario-session:v1:';
const QUICK_FEEDBACK_PREFIX = 'arsnova-host-scenario-quick-feedback:v1:';

function isHostScenario(value: unknown): value is HostScenario {
  return value === 'CLASSROOM' || value === 'EVENT' || value === 'QUICK';
}

function parseScenario(raw: string | null): HostScenario | null {
  if (!raw || raw.length > 128) return null;
  try {
    const entry: unknown = JSON.parse(raw);
    if (
      entry !== null &&
      typeof entry === 'object' &&
      'version' in entry &&
      entry.version === 1 &&
      'scenario' in entry &&
      isHostScenario(entry.scenario)
    ) {
      return entry.scenario;
    }
  } catch {
    // Local preferences are optional and never block a session start.
  }
  return null;
}

function scenarioEntry(scenario: HostScenario): string {
  return JSON.stringify({ version: 1, scenario });
}

function sessionKey(prefix: string, code: string): string | null {
  const normalized = code.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(normalized) ? `${prefix}${normalized}` : null;
}

/** Local host UI choices only. These values never grant session capabilities. */
@Injectable({ providedIn: 'root' })
export class HostScenarioService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly selectedScenario = signal<HostScenario | null>(
    parseScenario(this.readStorage('localStorage', PREFERENCE_KEY)),
  );
  private readonly sessionScenarios = new Map<string, HostScenario>();
  private readonly quickFeedbackRequests = new Map<string, boolean>();
  /** Eine ausdrückliche Wahl in diesem Lauf darf der Startseiten-Reset nicht verwerfen. */
  private explicitSelection = false;

  readonly preference = this.selectedScenario.asReadonly();

  selectScenario(scenario: HostScenario): void {
    if (!isHostScenario(scenario)) return;
    this.explicitSelection = true;
    this.selectedScenario.set(scenario);
    this.writeStorage('localStorage', PREFERENCE_KEY, scenarioEntry(scenario));
  }

  /**
   * Startseiten-Auswahl nur für den laufenden Aufruf. Schreibt nichts nach
   * localStorage und entfernt eine früher gespeicherte Präferenz.
   */
  stageScenario(scenario: HostScenario): void {
    if (!isHostScenario(scenario)) return;
    this.explicitSelection = true;
    this.selectedScenario.set(scenario);
    this.writeStorage('localStorage', PREFERENCE_KEY, null);
  }

  /**
   * Reload der Startseite beginnt ohne gespeicherte Aufgabenwahl.
   * Eine schon in diesem Lauf getroffene Wahl bleibt erhalten.
   */
  discardDurablePreference(): void {
    if (this.explicitSelection) return;
    this.selectedScenario.set(null);
    this.writeStorage('localStorage', PREFERENCE_KEY, null);
  }

  scenarioForAction(): HostScenario {
    return this.preference() ?? 'QUICK';
  }

  assignToSession(code: string, scenario: HostScenario): void {
    const key = sessionKey(SESSION_PREFIX, code);
    if (!key || !isHostScenario(scenario)) return;
    this.sessionScenarios.set(key, scenario);
    this.writeStorage('sessionStorage', key, scenarioEntry(scenario));
  }

  getForSession(code: string): HostScenario | null {
    const key = sessionKey(SESSION_PREFIX, code);
    if (!key) return null;
    return this.sessionScenarios.get(key) ?? parseScenario(this.readStorage('sessionStorage', key));
  }

  requestQuickFeedbackAfterQa(code: string): void {
    const key = sessionKey(QUICK_FEEDBACK_PREFIX, code);
    if (!key) return;
    this.quickFeedbackRequests.set(key, true);
    this.writeStorage('sessionStorage', key, '1');
  }

  hasQuickFeedbackAfterQa(code: string): boolean {
    const key = sessionKey(QUICK_FEEDBACK_PREFIX, code);
    if (!key) return false;
    return this.quickFeedbackRequests.get(key) ?? this.readStorage('sessionStorage', key) === '1';
  }

  clearQuickFeedbackAfterQa(code: string): void {
    const key = sessionKey(QUICK_FEEDBACK_PREFIX, code);
    if (!key) return;
    // Remember dismissal even when removing the persisted marker is blocked.
    this.quickFeedbackRequests.set(key, false);
    this.writeStorage('sessionStorage', key, null);
  }

  private readStorage(storage: 'localStorage' | 'sessionStorage', key: string): string | null {
    if (!this.browser) return null;
    try {
      return window[storage].getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(
    storage: 'localStorage' | 'sessionStorage',
    key: string,
    value: string | null,
  ): void {
    if (!this.browser) return;
    try {
      if (value === null) {
        window[storage].removeItem(key);
      } else {
        window[storage].setItem(key, value);
      }
    } catch {
      // Keep this tab usable when browser storage is unavailable or full.
    }
  }
}
