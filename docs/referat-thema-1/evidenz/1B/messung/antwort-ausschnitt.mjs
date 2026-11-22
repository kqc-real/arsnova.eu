// Ausschnitt einer Modellantwort aus einem Laufmitschnitt, als Beleg für Folie und Handout.
//
// Eingabe: http.tsv eines Laufordners (wie bei qualitaetstor.mjs). Sie liegt nur auf dem
// Messrechner, weil die Anfragen den Token enthalten. Ausgegeben werden nur die Aussagen der
// Modellausgabe (gekürzt), das Ergebnis des Qualitätstors der App und die SHA-256 der Quelle;
// keine Kopfzeilen, keine Anfragen.
//
// Aufruf: node antwort-ausschnitt.mjs <http.tsv> <auftrag, ab 1> [maxZeichen, Standard 600] [locale]
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';
import { hatTrenner, modellAntworten } from './qualitaetstor.mjs';

const TOR = '../../../../../apps/backend/src/lib/qaSummaryQuality.ts';

export async function ausschnitt(tsv, { auftrag, maxZeichen = 600, locale = 'de' }) {
  const antworten = modellAntworten(tsv);
  const antwort = antworten[auftrag - 1];
  if (!antwort) {
    throw new Error(`Auftrag ${auftrag} fehlt (${antworten.length} Antworten im Mitschnitt)`);
  }
  const { hasAcceptableQaSummaryQuality } = await tsImport(TOR, import.meta.url);
  const texte = antwort.output.statements.map((s) => s.text);
  const mitTrenner = texte.filter(hatTrenner).length;
  const torAkzeptiert = hasAcceptableQaSummaryQuality(
    { suggestedNextSteps: [], ...antwort.output },
    locale,
  );
  const voll = texte.join('\n');
  return {
    quelleSha256: createHash('sha256').update(tsv).digest('hex'),
    auftrag,
    locale,
    finishReason: antwort.finishReason,
    status: antwort.output.status,
    aussagen: texte.length,
    mitTrenner,
    ausgabe: voll.length <= maxZeichen ? voll : `${voll.slice(0, maxZeichen - 1)}…`,
    torAkzeptiert,
    grund: torAkzeptiert
      ? null
      : `${mitTrenner} von ${texte.length} Aussagen in der Form „Stichwort: Text“ (qaSummaryQuality.ts)`,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [datei, auftrag, maxZeichen, locale] = process.argv.slice(2);
  if (!datei || !auftrag) {
    console.error('Aufruf: node antwort-ausschnitt.mjs <http.tsv> <auftrag> [maxZeichen] [locale]');
    process.exit(2);
  }
  const r = await ausschnitt(readFileSync(datei, 'utf8'), {
    auftrag: Number(auftrag),
    maxZeichen: maxZeichen ? Number(maxZeichen) : undefined,
    locale: locale ?? 'de',
  });
  console.log(JSON.stringify(r, null, 2));
}
