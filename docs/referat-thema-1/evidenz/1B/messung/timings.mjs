// Liest aus dem app-seitigen Mitschnitt die timings der Runtime je POST (für
// zeitzerlegung.mjs) und den Body des ersten POST (für Kalibrierung und Kontrolle C0).
//
// Eingabe: tshark-Feldausgabe
//   tshark -r app.pcap -Y 'http.request.method == "POST" || http.response' -T fields \
//     -E separator=/t -e frame.number -e http.request.method -e http.response_in -e http.file_data
// tshark gibt http.file_data je nach Version als Text oder als Hex aus; beides wird gelesen.
//
// Aufruf: node timings.mjs timings <tsv> > timings.json
//         node timings.mjs body <tsv> > body.json
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function dateiDaten(feld) {
  if (feld && feld.length % 2 === 0 && /^[0-9a-f]+$/i.test(feld)) {
    return Buffer.from(feld, 'hex').toString('utf8');
  }
  return feld ?? '';
}

function zeilen(text) {
  return text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const [frame, method, responseIn, data] = l.replace(/\r$/, '').split('\t');
      return {
        frame: Number(frame),
        method: method || null,
        responseIn: responseIn ? Number(responseIn) : null,
        data: data ?? '',
      };
    });
}

function posts(alle) {
  return alle.filter((z) => z.method === 'POST').sort((a, b) => a.frame - b.frame);
}

export function timingsAusTshark(text) {
  const alle = zeilen(text);
  const antworten = new Map(alle.filter((z) => z.method === null).map((z) => [z.frame, z.data]));
  return posts(alle).map((p) => {
    if (p.responseIn === null || !antworten.has(p.responseIn)) return null;
    let body;
    try {
      body = JSON.parse(dateiDaten(antworten.get(p.responseIn)));
    } catch {
      return null;
    }
    const t = body?.timings;
    if (!t) return null;
    return { prompt_ms: t.prompt_ms, predicted_ms: t.predicted_ms, cache_n: t.cache_n ?? null };
  });
}

export function ersterPostBody(text) {
  const p = posts(zeilen(text));
  if (p.length === 0) throw new Error('kein POST im Mitschnitt');
  return dateiDaten(p[0].data);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [modus, datei] = process.argv.slice(2);
  const text = readFileSync(datei, 'utf8');
  if (modus === 'timings') console.log(JSON.stringify(timingsAusTshark(text)));
  else if (modus === 'body') process.stdout.write(ersterPostBody(text));
  else throw new Error('Aufruf: timings.mjs timings|body <tsv>');
}
