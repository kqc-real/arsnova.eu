import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostScenarioService, type HostScenario } from './host-scenario.service';

const PREFERENCE_KEY = 'arsnova-host-scenario:v1';
const SESSION_KEY = 'arsnova-host-scenario-session:v1:ABC123';
const QUICK_FEEDBACK_KEY = 'arsnova-host-scenario-quick-feedback:v1:ABC123';

describe('HostScenarioService', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps first visits unselected and uses QUICK only for actions', () => {
    const service = TestBed.inject(HostScenarioService);

    expect(service.preference()).toBeNull();
    expect(service.scenarioForAction()).toBe('QUICK');
    expect(localStorage.getItem(PREFERENCE_KEY)).toBeNull();
    expect(service.getForSession('ABC123')).toBeNull();
  });

  it('stages a scenario without restoring it after reload', () => {
    const service = TestBed.inject(HostScenarioService);
    service.selectScenario('EVENT');
    service.stageScenario('CLASSROOM');

    expect(service.preference()).toBe('CLASSROOM');
    expect(service.scenarioForAction()).toBe('CLASSROOM');
    expect(localStorage.getItem(PREFERENCE_KEY)).toBeNull();

    TestBed.resetTestingModule();
    expect(TestBed.inject(HostScenarioService).preference()).toBeNull();
  });

  it('drops a stored preference when the home selection is discarded', () => {
    localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ version: 1, scenario: 'EVENT' }));
    const service = TestBed.inject(HostScenarioService);
    expect(service.preference()).toBe('EVENT');

    service.discardDurablePreference();

    expect(service.preference()).toBeNull();
    expect(service.scenarioForAction()).toBe('QUICK');
    expect(localStorage.getItem(PREFERENCE_KEY)).toBeNull();
  });

  it.each<HostScenario>(['CLASSROOM', 'EVENT', 'QUICK'])(
    'persists an explicit %s preference across reloads',
    (scenario) => {
      TestBed.inject(HostScenarioService).selectScenario(scenario);
      TestBed.resetTestingModule();

      const reloaded = TestBed.inject(HostScenarioService);
      expect(reloaded.preference()).toBe(scenario);
      expect(reloaded.scenarioForAction()).toBe(scenario);
      expect(JSON.parse(localStorage.getItem(PREFERENCE_KEY)!)).toEqual({
        version: 1,
        scenario,
      });
    },
  );

  it.each([
    'broken JSON',
    'null',
    '[]',
    '"CLASSROOM"',
    '{"version":2,"scenario":"CLASSROOM"}',
    '{"version":1,"scenario":"INVALID"}',
    '{"scenario":"EVENT"}',
    JSON.stringify({ version: 1, scenario: 'EVENT', oversized: 'x'.repeat(128) }),
  ])('ignores invalid or unknown-version storage: %s', (raw) => {
    localStorage.setItem(PREFERENCE_KEY, raw);
    sessionStorage.setItem(SESSION_KEY, raw);
    const service = TestBed.inject(HostScenarioService);

    expect(service.preference()).toBeNull();
    expect(service.scenarioForAction()).toBe('QUICK');
    expect(service.getForSession('ABC123')).toBeNull();
  });

  it('keeps each created session independent of later preferences and other codes', () => {
    const service = TestBed.inject(HostScenarioService);
    service.selectScenario('CLASSROOM');
    service.assignToSession(' abc123 ', service.scenarioForAction());
    service.selectScenario('EVENT');
    service.assignToSession('DEF456', service.scenarioForAction());

    expect(service.getForSession('ABC123')).toBe('CLASSROOM');
    expect(service.getForSession('def456')).toBe('EVENT');
    expect(service.getForSession('OLD123')).toBeNull();

    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(HostScenarioService);
    expect(reloaded.getForSession('ABC123')).toBe('CLASSROOM');
    expect(reloaded.getForSession('DEF456')).toBe('EVENT');
    expect(reloaded.getForSession('OLD123')).toBeNull();
  });

  it('never promotes a global preference into a legacy session or host capability', () => {
    const service = TestBed.inject(HostScenarioService);
    service.selectScenario('EVENT');
    service.assignToSession('ABC123', 'CLASSROOM');

    expect(service.getForSession('LEGACY')).toBeNull();
    expect(sessionStorage.getItem('arsnova-host-token:ABC123')).toBeNull();
    expect(service.hasQuickFeedbackAfterQa('ABC123')).toBe(false);
  });

  it('remembers and clears the one-time quick-feedback request only for its session', () => {
    const service = TestBed.inject(HostScenarioService);
    service.requestQuickFeedbackAfterQa(' abc123 ');
    expect(service.hasQuickFeedbackAfterQa('ABC123')).toBe(true);
    expect(service.hasQuickFeedbackAfterQa('DEF456')).toBe(false);

    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(HostScenarioService);
    expect(reloaded.hasQuickFeedbackAfterQa('ABC123')).toBe(true);
    reloaded.clearQuickFeedbackAfterQa('ABC123');
    expect(reloaded.hasQuickFeedbackAfterQa('ABC123')).toBe(false);
    expect(sessionStorage.getItem(QUICK_FEEDBACK_KEY)).toBeNull();

    TestBed.resetTestingModule();
    expect(TestBed.inject(HostScenarioService).hasQuickFeedbackAfterQa('ABC123')).toBe(false);
  });

  it('ignores malformed quick-feedback markers and invalid codes', () => {
    sessionStorage.setItem(QUICK_FEEDBACK_KEY, 'true');
    const service = TestBed.inject(HostScenarioService);
    expect(service.hasQuickFeedbackAfterQa('ABC123')).toBe(false);
    for (const code of ['', 'ABC', 'ABC1234', '../../', 'x'.repeat(1024)]) {
      service.assignToSession(code, 'EVENT');
      service.requestQuickFeedbackAfterQa(code);
      service.clearQuickFeedbackAfterQa(code);
      expect(service.getForSession(code)).toBeNull();
      expect(service.hasQuickFeedbackAfterQa(code)).toBe(false);
    }
    service.selectScenario('INVALID' as HostScenario);
    service.assignToSession('DEF456', 'INVALID' as HostScenario);
    expect(service.preference()).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(1);
  });

  it('keeps same-tab actions usable when storage access and writes throw', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });
    }
    const service = TestBed.inject(HostScenarioService);
    service.selectScenario('EVENT');
    service.assignToSession('ABC123', 'EVENT');
    service.requestQuickFeedbackAfterQa('ABC123');

    expect(service.scenarioForAction()).toBe('EVENT');
    expect(service.getForSession('ABC123')).toBe('EVENT');
    expect(service.hasQuickFeedbackAfterQa('ABC123')).toBe(true);
    service.clearQuickFeedbackAfterQa('ABC123');
    expect(service.hasQuickFeedbackAfterQa('ABC123')).toBe(false);
  });

  it('does not repeat a dismissed marker when persisted removal fails', () => {
    sessionStorage.setItem(QUICK_FEEDBACK_KEY, '1');
    const service = TestBed.inject(HostScenarioService);
    expect(service.hasQuickFeedbackAfterQa('ABC123')).toBe(true);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    service.clearQuickFeedbackAfterQa('ABC123');

    expect(service.hasQuickFeedbackAfterQa('ABC123')).toBe(false);
  });

  it('tolerates denied storage getters before any storage method can run', () => {
    for (const storage of ['localStorage', 'sessionStorage'] as const) {
      vi.spyOn(window, storage, 'get').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });
    }
    const service = TestBed.inject(HostScenarioService);
    service.selectScenario('QUICK');
    service.assignToSession('ABC123', 'QUICK');
    service.requestQuickFeedbackAfterQa('ABC123');

    expect(service.getForSession('ABC123')).toBe('QUICK');
    expect(service.hasQuickFeedbackAfterQa('ABC123')).toBe(true);
    service.clearQuickFeedbackAfterQa('ABC123');
    expect(service.hasQuickFeedbackAfterQa('ABC123')).toBe(false);
  });

  it('does not touch browser storage during server rendering', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const service = TestBed.inject(HostScenarioService);
    expect(service.preference()).toBeNull();
    service.selectScenario('CLASSROOM');
    service.assignToSession('ABC123', 'CLASSROOM');
    service.requestQuickFeedbackAfterQa('ABC123');
    service.clearQuickFeedbackAfterQa('ABC123');
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
