import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verletzteRegeln } from './gate-ablation.mjs';

const aus = (...texte) => ({
  status: 'ready',
  statements: texte.map((text) => ({ text, sourceIds: [] })),
});

test('saubere Aussagen mit Leitwort verletzen keine Regel', () => {
  assert.deepEqual(
    verletzteRegeln(
      aus('Regression: Mehrere wünschen ein Beispiel.', 'Tempo: Die Hälfte will langsamer.'),
    ),
    [],
  );
});

test('Aussage ohne Leitwort verletzt R2, internes Statuswort R4', () => {
  assert.deepEqual(
    verletzteRegeln(
      aus('Eine Frage ist als PINNED markiert und beliebt.', 'Tempo: Die Hälfte will langsamer.'),
    ),
    ['R2', 'R4'],
  );
});

test('doppeltes und generisches Leitwort verletzen R7 und R8, eine Aussage R1', () => {
  assert.deepEqual(
    verletzteRegeln(
      aus('Fragen: Viele fragen nach Beispielen.', 'Fragen: Einige fragen nach dem Tempo.'),
    ),
    ['R7', 'R8'],
  );
  assert.deepEqual(verletzteRegeln(aus('Tempo: Die Hälfte will langsamer.')), ['R1']);
});

test('failed und leeres uncertain lässt das Gate durch', () => {
  assert.deepEqual(verletzteRegeln({ status: 'failed', statements: [] }), []);
  assert.deepEqual(verletzteRegeln({ status: 'uncertain', statements: [] }), []);
});
