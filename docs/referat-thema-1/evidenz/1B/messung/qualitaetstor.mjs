// Prüft die Modellantworten eines Laufs mit dem Qualitätstor der App
// (apps/backend/src/lib/qaSummaryQuality.ts, hasAcceptableQaSummaryQuality), das der
// Summary-Adapter vor dem Fallback aufruft (qaSummaryRuntimeAdapter.ts Z. 130–136).
//
// Eingabe: http.tsv eines Laufordners (tshark-Feldausgabe wie bei timings.mjs). Sie liegt nur
// auf dem Messrechner, weil die Anfragen den Token enthalten; ausgegeben werden nur Zahlen.
//
// Aufruf: node qualitaetstor.mjs <http.tsv> [locale, Standard de]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';
import { dateiDaten } from './timings.mjs';

const TOR = '../../../../../apps/backend/src/lib/qaSummaryQuality.ts';

// Antworten des Chat-Endpunkts in Mitschnitt-Reihenfolge, mit der Modellausgabe (output).
export function modellAntworten(tsv) {
  const antworten = [];
  for (const zeile of tsv.split('\n')) {
    if (zeile.trim() === '') continue;
    const [frame, , , feld] = zeile.replace(/\r$/, '').split('\t');
    const daten = dateiDaten(feld);
    if (!daten.includes('"choices"')) continue;
    const wahl = JSON.parse(daten).choices[0];
    antworten.push({
      frame: Number(frame),
      finishReason: wahl.finish_reason,
      output: JSON.parse(wahl.message.content).output,
    });
  }
  return antworten;
}

// Form „Stichwort: Text“ nach qaSummaryQuality.ts Z. 11–20: Doppelpunkt, sonst ein von
// Leerzeichen umgebener Strich, an Stelle 1–48.
export function hatTrenner(text) {
  const doppelpunkt = text.indexOf(':');
  const strich = text.match(/\s[–—-]\s/u);
  const stelle = doppelpunkt > 0 ? doppelpunkt : (strich?.index ?? -1);
  return stelle > 0 && stelle <= 48;
}

export async function pruefeAntworten(tsv, locale = 'de') {
  const { hasAcceptableQaSummaryQuality } = await tsImport(TOR, import.meta.url);
  const auftraege = modellAntworten(tsv).map((a, i) => ({
    nr: i + 1,
    finishReason: a.finishReason,
    status: a.output.status,
    aussagen: a.output.statements.length,
    mitTrenner: a.output.statements.filter((s) => hatTrenner(s.text)).length,
    tor: hasAcceptableQaSummaryQuality(a.output, locale) ? 'akzeptiert' : 'abgelehnt',
  }));
  return {
    locale,
    n: auftraege.length,
    abgelehnt: auftraege.filter((a) => a.tor === 'abgelehnt').length,
    auftraege,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [datei, locale] = process.argv.slice(2);
  if (!datei) {
    console.error('Aufruf: node qualitaetstor.mjs <http.tsv> [locale]');
    process.exit(2);
  }
  console.log(
    JSON.stringify(await pruefeAntworten(readFileSync(datei, 'utf8'), locale ?? 'de'), null, 2),
  );
}
