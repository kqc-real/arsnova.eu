import type { ComponentFixture } from '@angular/core/testing';

/** Macro-Task-Tick in jsdom; delayMs=0 entspricht setTimeout(0). */
export async function flushMacroTask(delayMs = 0): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

/** Wartet auf Angular-Stabilität und optional einen Macro-Task-Tick. */
export async function flushComponentAfterStable(
  fixture: ComponentFixture<unknown>,
  delayMs = 0,
): Promise<void> {
  await fixture.whenStable();
  await flushMacroTask(delayMs);
}
