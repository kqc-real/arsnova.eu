import assert from 'node:assert/strict';
import test from 'node:test';
import { fuelleAbgabeVorlage } from './render-resource-isolation-pdfs.mjs';

test('setzt belegte Dokumentwerte ein und maskiert HTML statt fremde Elemente einzufügen', () => {
  assert.equal(
    fuelleAbgabeVorlage('<p>{{BEFUND}}</p>', { BEFUND: 'H1 < Grenzwert & "Beleg"' }),
    '<p>H1 &lt; Grenzwert &amp; &quot;Beleg&quot;</p>',
  );
});

test('verweigert fehlende Belege und ungültige Ersetzungen statt Platzhalter in PDFs zu belassen', () => {
  assert.throws(() => fuelleAbgabeVorlage('<p>{{UNBEKANNT}}</p>', {}));
  assert.throws(() => fuelleAbgabeVorlage('<p>{{BEFUND}}</p>', { BEFUND: undefined }));
  assert.throws(() => fuelleAbgabeVorlage('<p>{{ungueltig}}</p>', {}));
});
