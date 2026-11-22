// Niklas' Teil 1A im gemeinsamen Deck (Stil und Bausteine aus jonas/folien.mjs). Jede Zahl kommt aus
// daten-1a.mjs, also aus der committeten Reihe vom 15.11.2026; die Folien zeigen gerundete Werte, Notizen
// und Handout die genauen. Titel = Behauptung, eine Aussage je Folie, Kurzbelege nach ZL in der Fußzeile,
// volle Herkunft (Datei, Rechner, Commit) in `quelle`. Sprechnotizen in zwei Fassungen: `notiz`
// (Fließtext) und `stichpunkte` (zum freien Vortrag).
//
// Erzählbogen (Heldenzahlenkette): 40.000 von 40.000 Live-Aktionen erfolgreich → 80 gepaarte Vergleiche →
// 11 verfehlen die Regel → 4 davon schon ohne spaCy → 3 über 50 ms, alle im letzten Lauf in etwa 10 s →
// Freigabe nicht erteilt.

import {
  autorZeile,
  etikett,
  flaeche,
  frage,
  grafikBox,
  mono,
  zahl,
  zweiSpalten,
} from './folien.mjs';
import { fmt } from './zahlen.mjs';
import {
  analyseSvg,
  ausreisserSvg,
  liveSvg,
  profilSvg,
  vergleichsMatrixSvg,
} from './grafik-1a.mjs';
import { VARIANTEN } from './daten-1a.mjs';
import { quellenzeile } from './literatur-1a.mjs';
import { privat } from './notizen.mjs';

const S = 'schneider2026';
/**
 * Inferenzdauer eines LLM-Auftrags in Jonas' Labor (1B/1B-ergebnis.md: warm im Median 148,6 s, ThinkPad P50,
 * Commit 8e9d1317), auf Minuten gerundet; nur für die Übergabe an Jonas auf N10. Der Test prüft die Quelle.
 */
export const LLM_MIN_WARM = Math.round(148.6 / 60 / 0.5) * 0.5;

/** Kurzbelege je Folie (ZL Anhang B); die Fußzeile bleibt einzeilig. */
const ZITATE = {
  N1: [
    ['arsnova2026pruefung', 'Kap. 4.3'],
    [S, 'Reihe 1A'],
  ],
  N2: [
    [S, 'Laufmanifeste'],
    ['heo2024', 'Abschnitt CPU Interface Files'],
    ['arsnova2026adr0035', 'Kap. 2.1'],
  ],
  N3: [
    [S, '1A-Versuchsvertrag'],
    ['papadopoulos2021', 'Kap. 2.3'],
  ],
  N4: [
    [S, '1A-Versuchsvertrag'],
    ['nosek2018', 'S. 2600'],
    ['papadopoulos2021', 'Kap. 2.3'],
  ],
  N5: [
    [S, 'auswertung.json'],
    ['papadopoulos2021', 'Kap. 2.3'],
  ],
  N6: [[S, 'live-vergleiche.csv']],
  N7: [
    [S, 'V3/block-05'],
    ['nosek2018', 'S. 2600'],
  ],
  N9: [
    [S, 'auswertung.json'],
    ['ulrich2016', 'Abschnitt Test Noncritical Backends'],
  ],
  N10: [
    [S, '1A/1A-auswertung.md'],
    ['dean2013', 'S. 76'],
    ['weirauch2026c', '1B/1B-ergebnis.md'],
  ],
};

/** Kasten mit Akzentlinie links (wie J15/J4 bei Jonas). */
const kernsatz = (html, linie = 'var(--blau)', groesse = 32) =>
  `<p style="margin:0;font-size:${groesse}px;line-height:1.3;padding-left:22px;border-left:6px solid ${linie}">${html}</p>`;

/** Status der nachträglichen Auswertung: gedämpft in der Fragezeile nach der Frage (Kopfgrammatik). */
const explorativ = { status: 'nachträglich ausgewertet' };

/** Folien N1–N10 ohne N6b und N8, ohne eigenes Literaturverzeichnis (gemeinsam: J16, J16b); Reservefolien seit 2026-11-22 entfernt. */
export function folien1A(d) {
  const H = d.herkunft;
  const sw = d.schwellen;
  const rel = fmt(sw.relativ * 100);
  const abs = fmt(sw.absolutMs);
  const fehlAlle = d.vergleiche.filter((x) => !x.bestanden);
  const kontrolle = fehlAlle.filter((x) => x.variante === 'V1');
  const mitSpacy = fehlAlle.filter((x) => x.variante !== 'V1');
  const v3b5 = d.vergleiche.filter((x) => x.variante === 'V3' && x.block === 5);
  const v3b5Fehl = v3b5.filter((x) => !x.bestanden);
  const v3b5Abs = v3b5.filter((x) => !x.absolutBestanden);
  const e = d.explorativ;
  const k = d.konfig;
  const mitSpacyGesamt = d.h1.gesamt + d.h2.gesamt;
  const mitSpacyFehl = d.h1.fehl + d.h2.fehl;
  const timeoutS = fmt(k.timeoutMs / 1000);
  const proxyS = fmt(d.v4.verzoegerungMs / 1000);
  const datum = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
  const umgebung = `Niklas' Rechner, ${H.os} unter WSL2 (Kernel ${H.kernel}), ${H.cpus} logische CPUs, Lastgenerator auf demselben Rechner · App-Commit ${H.commit} (nach v1.4.0) · Auswertung SHA-256 ${H.auswertungSha}…`;
  const q = (was) => `${was} · ${umgebung}`;
  const F = [];
  const neu = (f) =>
    F.push({
      teil: 'niklas',
      auftrag: '1A',
      kurzfassung: false,
      station: null,
      ...f,
    });

  // ------------------------------------------------------------ N1 Antwort zuerst
  neu({
    id: 'N1',
    titel: 'Keine Freigabe für die spaCy-Glättung',
    inhalt: flaeche(
      frage(
        'Welche Reserve hat der App-Host für optionale Analyse, ohne die Live-Signale zu verzögern?',
        '1A',
      ) +
        autorZeile('Niklas Schneider') +
        zweiSpalten(
          kernsatz(
            `Die Live-Last läuft fehlerfrei. Mit spaCy hält die vorab festgelegte Regel aber nicht, und der Nutzen ist nicht gemessen.`,
            'var(--blau)',
            36,
          ) +
            `<p style="margin:34px 0 0;font-size:30px;line-height:1.35">Entscheidung: ${mono('NLP_ENABLED=false')} bleibt, die Wortwolke bleibt lexikalisch.</p>`,
          zahl({
            wert: fmt(d.live.erfolgreich),
            einheit: `/ ${fmt(d.live.geplant)}`,
            was: 'Live-Aktionen erfolgreich',
            gruppe: `${d.live.laeufe} Läufe, ${fmt(d.live.fehlgeschlagen)} Fehler`,
            gross: 84,
          }) +
            zahl({
              wert: `${mitSpacyFehl}`,
              einheit: `/ ${mitSpacyGesamt}`,
              was: `Vergleiche mit spaCy verfehlen die Regel, <b>Kontrolle ohne spaCy: ${kontrolle.length} / ${d.h1.gesamt}</b>`,
              gruppe: `H1 ${d.h1.fehl}/${d.h1.gesamt}, H2 ${d.h2.fehl}/${d.h2.gesamt}; ohne spaCy also nicht seltener`,
              linie: 'var(--bernstein)',
              gross: 84,
            }),
          760,
        ) +
        `<p class="beleg">Labor: ein Rechner (WSL2, ${H.cpus} logische CPUs), Code ${mono(H.commit)} (nach v1.4.0), ${d.live.laeufe} Läufe am ${datum(d.vorab.ersterLauf)}2026</p>`,
    ),
    notiz: privat('N1.notiz', { fmt, d, mitSpacyFehl, mitSpacyGesamt, kontrolle }),
    stichpunkte: privat('N1.stichpunkte', { fmt, d, mitSpacyFehl, mitSpacyGesamt, kontrolle }),
    zeitS: 50,
    kurzfassung: true,
    // Wegmarke (jonas/wegkarte.mjs MARKEN, Weg 1A): Einstieg mit der Antwort, daher der ganze Weg ohne Punkt;
    // danach fährt der Punkt jede Station der Reihe nach an, ohne Sprung und ohne Rücksprung:
    // App-Host (N2, N3) → Live-Pfad (N4–N7) → spaCy (N8) → Ersatz (N9) → Wortwolke (N10).
    marke: '1a-weg',
    quelle: q(
      `${H.datei} (live.*.planned/succeeded, hypotheses.H1/H2); Leitfrage: Prüfungsdokument Abschn. 4.3, Gruppenauftrag 1A`,
    ),
  });

  // ------------------------------------------------------------ N2 Dienste und Limits
  const NAMEN = {
    app: ['App (Backend)', 'Live-Aktionen, Kontextaufbau'],
    postgres: ['PostgreSQL', 'Sitzungsdaten'],
    redis: ['Redis', 'Pub/Sub, Cache'],
    'pdf-worker': ['PDF-Worker', 'Export, hier ohne Last'],
    spacy: ['spaCy-Sidecar', 'Glättung der Wortwolke'],
  };
  const limitText = (s) =>
    s.cpu === null
      ? 'kein Limit'
      : `${fmt(s.cpu)} CPU · ${fmt(s.speicherGiB)} GiB · ${fmt(s.pids)} PIDs`;
  neu({
    id: 'N2',
    titel: 'Fünf Dienste teilen sich den App-Host',
    inhalt: flaeche(
      frage('Was konkurriert mit den Live-Aktionen um CPU und Speicher?', '1A') +
        `<div style="display:grid;grid-template-columns:repeat(5,1fr);column-gap:18px;font-size:28px;line-height:1.3">` +
        k.dienste
          .map((s) => {
            const [n, rolle] = NAMEN[s.alias] ?? [s.alias, ''];
            const hervor = s.alias === 'spacy';
            return (
              `<div style="border:${hervor ? '3px solid var(--blau)' : 'var(--linie-min) solid var(--linie)'};border-radius:10px;padding:18px 16px;${hervor ? 'background:var(--raster)' : ''}">` +
              `<b>${n}</b><p style="margin:8px 0 0;color:var(--text-2)">${rolle}</p>` +
              `<p class="mono" style="margin:12px 0 0;font-size:var(--s-min);white-space:normal;color:${hervor ? 'var(--blau)' : 'var(--gedaempft)'}">${limitText(s)}</p></div>`
            );
          })
          .join('') +
        `</div>` +
        `<div style="margin-top:30px">` +
        kernsatz(
          'Ein Limit ist eine Obergrenze, keine Reservierung: Es hält spaCy klein, schützt aber nichts für die App.',
          'var(--blau)',
          30,
        ) +
        `</div>` +
        `<p class="sekundaer" style="margin-top:24px">${k.optionalAus ? 'In allen Läufen aus: Encoder der semantischen Wortwolke und Q&amp;A-Klassifikation (8.9b). Der Kontextaufbau läuft in der App.' : ''}</p>` +
        `<p class="sekundaer" style="margin-top:12px">Kein LLM hier: Der 16-GB-Host trägt neben Baseline und Sidecars kein ~4-GB-Modell, Live-Pfade dürfen nie auf Inferenz warten. Deshalb ein zweiter Host ${etikett('1B')}.</p>`,
    ),
    notiz: privat('N2.notiz', {}),
    // Wegmarke: Fünf Dienste teilen sich den App-Host: Station App-Host.
    marke: '1a-app',
    stichpunkte: privat('N2.stichpunkte', {}),
    zeitS: 45,
    quelle: q(
      `${H.datei}; Limits aus den Laufmanifesten V2/block-01/lauf.json manifest.services (= docker-compose.prod.yml, aufgelöste Compose je Lauf); Flags QA_NLP_ENABLED, WORD_CLOUD_SEMANTIC_ENABLED, OPEN_WEIGHT_LLM_ENABLED = false und kein Encoder-/LLM-Dienst in allen 25 Manifesten; Kernel-Doku cgroup v2 (Linux 6.12), Abschn. „CPU Interface Files“; ADR-0035 Z. 27–31 und Abschn. 2.1 (Live-Host-RAM ~10–11 GB Baseline plus spaCy 1 GB, Encoder 2 GB, PDF-Worker 1 GB trägt kein ~4-GB-LLM; Same-Host-Sidecar nur Labor)`,
    ),
  });

  // ------------------------------------------------------------ N4 Vorab-Festlegung
  const vr = d.vorab.vorreihe;
  // 12.11.: Vertrag v2 kam zusammen mit einer ersten vollständigen Reihe auf älterem Stand (offengelegt).
  const kette = [
    ...d.vorab.kette.map((x) => [
      datum(x.datum),
      x.commit === vr.commitDaten
        ? `Vertrag v2; erste Reihe auf ${mono(vr.baseline)} verfehlte H1 und H2 ebenso`
        : x.was,
      x.commit,
    ]),
    [datum(d.vorab.ersterLauf), `${d.live.laeufe} gewertete Läufe`, H.commit],
  ];
  neu({
    id: 'N4',
    titel: 'Die Regel stand eine Woche vorher fest',
    inhalt: flaeche(
      frage('Wann ist spaCy für die Live-Aktionen unschädlich?', '1A') +
        `<p style="margin:0 0 14px;font-size:24px;line-height:1.35;color:var(--text-2)"><b style="color:var(--tinte)">Fünf Varianten, je Block gemischt:</b> V0 ohne Analyse · V1 lexikalisch (Basis) · V2 spaCy ${fmt(k.spacy.V2.cpu)}&nbsp;CPU · V3 ${fmt(k.spacy.V3.cpu, 2)}&nbsp;CPU · V4 Proxy +${proxyS}&nbsp;s, Timeout ${timeoutS}&nbsp;s</p>` +
        `<div style="font-size:30px;line-height:1.35;padding:14px 26px;border-left:6px solid var(--blau);background:var(--raster);margin:0 0 20px">Je Aktion und Block steigt der p95 gegenüber V1 um höchstens <b>${rel} %</b> <b>und</b> höchstens <b>${abs} ms</b>. Alle fünf Blöcke müssen bestehen; kein Ausreißer wird entfernt.<p style="margin:12px 0 0;font-size:24px;line-height:1.35;color:var(--text-2)"><b style="color:var(--tinte)">H1:</b> Normales spaCy (V2) hält gegenüber V1 die p95- und Fehlergrenzen für Live-Aktionen ein.</p><p style="margin:4px 0 0;font-size:24px;line-height:1.35;color:var(--text-2)"><b style="color:var(--tinte)">H2:</b> Auch unter CPU-Drosselung (V3) und bei verzögerten Antworten (V4).</p></div>` +
        // Zeitleiste der Vorab-Festlegung (Git)
        `<div style="display:grid;grid-template-columns:repeat(${kette.length},1fr);column-gap:24px">` +
        kette
          .map(
            ([tag, was, c], i) =>
              `<div style="border-top:6px solid ${i === kette.length - 1 ? 'var(--tinte)' : 'var(--blau)'};padding-top:12px">` +
              `<p class="kennzahl" style="margin:0;font-size:44px">${tag}</p>` +
              `<p style="margin:8px 0 0;font-size:28px;line-height:1.3">${was}</p>` +
              `<p class="mono" style="margin:6px 0 0;font-size:var(--s-min);color:var(--gedaempft)">${c}</p></div>`,
          )
          .join('') +
        `</div>` +
        `<p class="beleg">Dazu vorab: Fehler ≤ ${fmt(sw.fehler * 100, 1)} %, Quiz-p95 ≤ ${fmt(sw.quizZielMs)} ms, spaCy gedrosselt ≤ ${fmt(sw.drosselung * 100)} %, Speicher ≤ ${fmt(sw.speicher * 100)} % von 1 GiB, kein OOM</p>`,
    ),
    notiz: privat('N4.notiz', {}),
    // Wegmarke: Die Regel vergleicht die Latenz der Live-Aktionen mit und ohne Analyse: Station Live-Pfad,
    // Saum auf dem Live-Pfad, die umgeschaltete Analyse gestrichelt.
    marke: '1a-regel',
    stichpunkte: privat('N4.stichpunkte', { fmt, k, rel, abs, datum, d, vr }),
    zeitS: 50,
    kurzfassung: true,
    quelle: `1A/1A-experiment-contract.md (Hypothesen H1, H2); 1A-Versuchsvertrag (Regeltabelle, „Alle fünf Blöcke“; SHA-256 ${d.vorab.vertragSha}… = contractSha256 aller ${d.live.laeufe} Laufmanifeste); Git: ${d.vorab.kette.map((x) => `${x.commit} ${x.datum}`).join(', ')}; erster Lauf ${d.vorab.ersterLauf} (lauf.json manifest.startAt); erste Reihe: Daten ${vr.commitDaten} (${vr.datumDaten}), Auswertung ${vr.commitAuswertung} (${vr.datumAuswertung}), Baseline ${vr.baseline}, gleicher Vertrag, Seed ${vr.gleicherSeed}, Fixture ${vr.fixtureSha}…, H1 ${vr.h1.fehl}/${vr.h1.gesamt}, H2 ${vr.h2.fehl}/${vr.h2.gesamt}, ${vr.absolutFehl} absolute Verletzungen; aus dem Arbeitsbaum entfernt in ab1619e7 · ${umgebung}`,
  });

  // ------------------------------------------------------------ N5 Live-Aktionen
  neu({
    id: 'N5',
    titel: `Alle ${fmt(d.live.erfolgreich)} Live-Aktionen kamen an`,
    inhalt: flaeche(
      frage('Kommen die Live-Aktionen unter Analyse-Last an?', '1A') +
        grafikBox(liveSvg(d)) +
        `<p class="beleg">Gemessen am Lastgenerator bis zur Antwort des Backends; Anzeige im Browser und Kompasskarten nicht gemessen</p>`,
    ),
    notiz: privat('N5.notiz', { fmt, d }),
    // Wegmarke: Alle Live-Aktionen kamen an: Station Live-Pfad, Saum nur auf dem Live-Pfad.
    marke: '1a-live',
    stichpunkte: privat('N5.stichpunkte', { fmt, d, sw }),
    zeitS: 40,
    kurzfassung: false,
    quelle: q(
      `${H.datei} runs[].live.<aktion>.p95Ms, planned, succeeded, failed; Kompass-Eingänge: docs/GLOSSAR.md (Moderationskompass)`,
    ),
  });

  // ------------------------------------------------------------ N6 Vergleiche (3 Stufen)
  neu({
    id: 'N6',
    titel: 'Deutlich verletzt wird die Regel nur einmal',
    inhalt: flaeche(
      frage('Hält die vorab festgelegte Regel in jedem Vergleich?', '1A') +
        grafikBox(vergleichsMatrixSvg(d)),
    ),
    notiz: privat('N6.notiz', { d, kontrolle, fmt, mitSpacy, v3b5Fehl, v3b5Abs, fehlAlle }),
    // Wegmarke: Gepaarte Vergleiche der Live-Latenz nach der Regel: wie N4.
    marke: '1a-regel',
    stichpunkte: privat('N6.stichpunkte', {
      d,
      kontrolle,
      mitSpacy,
      v3b5Fehl,
      v3b5Abs,
      abs,
      fmt,
      fehlAlle,
    }),
    zeitS: 70,
    kurzfassung: true,
    aufbau: 3,
    quelle: q(
      `${H.datei} comparisons[] (relativePassed, absolutePassed, absoluteChangeMs); evidenz/1A/…/auswertung/live-vergleiche.csv; nachgerechnet aus durationSamplesMs (Nearest Rank), 0 Abweichungen`,
    ),
  });

  // ------------------------------------------------------------ N7 Ausreißer (explorativ, 2 Stufen)
  neu({
    id: 'N7',
    titel: 'Der Ausreißer dauerte rund zehn Sekunden',
    inhalt: flaeche(
      frage('Was geschah im letzten Lauf (V3, Block 5)?', '1A', explorativ) +
        grafikBox(ausreisserSvg(d)) +
        `<p class="beleg">Ursache offen: Rückstau der gedrosselten Analyse oder Ereignis auf Host und Datenbank; dagegen: V4 mit ${fmt(d.v4.ersatzTimeout)} Timeouts ohne Live-Effekt</p>`,
    ),
    notiz: privat('N7.notiz', { e, fmt, d, k }),
    // Wegmarke: Der Ausreißer betrifft die Beitritte (Live-Aktionen) im Lauf V3/Block 5: Station Live-Pfad,
    // Ausschlag auf dem Live-Pfad. spaCy folgt erst mit N8 (eigene Ressourcen), deshalb kein Rücksprung.
    marke: '1a-wirkung',
    stichpunkte: privat('N7.stichpunkte', { e, fmt }),
    zeitS: 50,
    kurzfassung: true,
    aufbau: 2,
    quelle: q(
      `${H.datei.replace('auswertung/auswertung.json', 'V3/block-05/lauf.json')} (live.actions.join.latency.durationSamplesMs, live.lifecycle.arrivals[].scheduledAtMs, analysis.analysis.calls[]), V3/block-05/ressourcen.json.gz (snapshots[].containers[].delta.cpuPercent); Vergleich mit allen übrigen Läufen; Zuordnung Stichprobe ↔ Ankunft ist eine Näherung (Abschlussreihenfolge)`,
    ),
  });

  // ------------------------------------------------------------ N9 Analysezeit und Ersatz
  neu({
    id: 'N9',
    titel: `Nach ${timeoutS} s liefert die App den Ersatz`,
    inhalt: flaeche(
      frage('Was sehen Lehrende, wenn spaCy langsam ist?', '1A') +
        grafikBox(analyseSvg(d)) +
        `<p class="beleg">V4: Proxy hat ${fmt(d.v4.weitergeleitet)} Anfragen weitergeleitet, geprüft werden Frist und Ersatz; ${fmt(d.v4.ersatzGegendruck)} Ersatzfälle durch Gegendruck</p>`,
    ),
    notiz: privat('N9.notiz', { fmt, d }),
    // Wegmarke: Nach 5 s liefert die App den lexikalischen Ersatz: Station Ersatz nach dem Aufstieg zur App.
    marke: '1a-ersatz',
    stichpunkte: privat('N9.stichpunkte', { timeoutS, fmt, d, k, H }),
    zeitS: 55,
    kurzfassung: true,
    aufbau: 2,
    quelle: q(
      `${H.datei} runs[].analysis (successLatency, fallbackLatency, outcomes, fallbackReasons), runs[V4].proxy (delayMs, forwarded, cancelledBeforeForward; scope proxy-lifetime-including-warmup), runs[].resources[alias=spacy], runs[].collectorHost.minAvailableMemoryBytes (abgerundet); SIDECAR_UNAVAILABLE fasst Gegendruck und echte Unerreichbarkeit zusammen (apps/backend/src/lib/wordCloudNormalizer.ts, reasonFromSidecarError), Gegendruck daher erschlossen aus genau ${d.v4.gegendruckJeLauf} je Lauf; NLP_TIMEOUT_MS aus den Laufmanifesten; SPACY_MAX_IN_FLIGHT: apps/backend/src/lib/spacyClient.ts Z. 22, Prüfung Z. 187`,
    ),
  });

  // ------------------------------------------------------------ N10 Entscheidung
  const spalte = (kopf, farbe, punkte) =>
    `<div style="border-top:6px solid ${farbe};padding-top:12px">` +
    `<p style="margin:0 0 10px;font-weight:700;font-size:30px;color:${farbe}">${kopf}</p>` +
    `<ul style="margin:0;padding-left:28px;font-size:28px;line-height:1.36">${punkte.map((p) => `<li style="margin:0 0 12px">${p}</li>`).join('')}</ul></div>`;
  neu({
    id: 'N10',
    titel: 'Entscheidung: lexikalische Wortwolke bleibt',
    inhalt: flaeche(
      frage('Was folgt daraus für den Betrieb?', '1A') +
        `<div style="display:grid;grid-template-columns:repeat(3,1fr);column-gap:44px">` +
        spalte('Entscheidung', 'var(--blau)', [
          `${mono('NLP_ENABLED=false')} bleibt, Standard in ${mono('.env.production.example')}`,
          `Für neue Versuche: Budget ${fmt(k.spacy.V2.cpu)}&nbsp;CPU, ${fmt(k.spacy.V2.speicherGiB)}&nbsp;GiB, ${fmt(k.spacy.V2.pids)}&nbsp;PIDs`,
          `${fmt(k.spacy.V3.cpu, 2)}&nbsp;CPU ist keine gleichwertige Einsparung`,
        ]) +
        spalte('Begründung', 'var(--tinte)', [
          `Regel verfehlt (${mitSpacyFehl} von ${mitSpacyGesamt}), Beweislast bei der Option`,
          'Deutlich schadet spaCy nur bei knapper CPU (V3)',
          'Nutzen nicht gemessen, Betrieb kostet Pflege',
        ]) +
        spalte('Grenzen', 'var(--bernstein-text)', [
          'Ein WSL2-Rechner, Lastgenerator auf demselben Host',
          'Beitrittswelle statt Dauerlast',
          'Kein Rendering, keine Aussage zu einem LLM',
        ]) +
        `</div>` +
        `<p class="merksatz" data-ab="1"><b>Zur Diskussion:</b> Wie kalibriert man eine Regel, die schon ohne spaCy ${kontrolle.length}-mal anschlägt?</p>` +
        `<p class="uebergabe" data-ab="2">Ein LLM rechnet rund ${fmt(LLM_MIN_WARM, 1)}&nbsp;min je Auftrag. Was, wenn wir die schwere Arbeit auslagern? <span class="uebergabe-ziel">→ Jonas ${etikett('1C')} ${etikett('1B')}</span></p>`,
    ),
    notiz: privat('N10.notiz', {}),
    stichpunkte: privat('N10.stichpunkte', { mitSpacyFehl, mitSpacyGesamt, fmt, LLM_MIN_WARM }),
    zeitS: 65,
    kurzfassung: true,
    aufbau: 2,
    // Wegmarke: Entscheidung über das Ergebnis, das Lehrende sehen (lexikalische Wortwolke bleibt): Ende des Wegs.
    marke: '1a-wortwolke',
    quelle: q(
      `1A/1A-auswertung.md (Entscheidung, Budget und Rückweg, Grenzen); 1A-Versuchsvertrag (Gegenalternative); ${H.datei} hypotheses; NLP_ENABLED=false: .env.production.example Z. 205 (docker-compose.prod.yml liest es von dort, Default false); LLM-Dauer: 1B/1B-ergebnis.md, warm im Median 148,6 s je Auftrag (ThinkPad P50, Commit 8e9d1317) ≈ 2,5 min`,
    ),
  });

  // ------------------------------------------------------------ N3 Versuchsaufbau (bis 2026-11-16 Reserve RN3)
  const VAR = [
    ['V0', 'Live-Last ohne Analyse', ''],
    ['V1', 'Analyse lexikalisch, spaCy aus', 'Basis'],
    ['V2', `spaCy normal: ${fmt(k.spacy.V2.cpu)} CPU`, 'H1'],
    ['V3', `spaCy gedrosselt: ${fmt(k.spacy.V3.cpu, 2)} CPU`, 'H2'],
    ['V4', `spaCy hinter Proxy: +${proxyS} s, Timeout ${timeoutS} s`, 'H2'],
  ];
  neu({
    id: 'N3',
    titel: 'Fünf Varianten, je Block gemischt',
    // Wegmarke: Last und Daten auf dem App-Host sind in allen Läufen gleich; die fünf Varianten schalten nur die
    // Analyse um (aus, lexikalisch, spaCy normal, gedrosselt, hinter Proxy). Der Punkt bleibt deshalb am
    // App-Host (wie N2), der Saum zeigt die umgeschaltete Strecke. spaCy selbst ist erst N8.
    marke: '1a-varianten',
    zeitS: 45,
    inhalt: flaeche(
      frage('Welche Varianten vergleicht die Messreihe?', '1A') +
        `<table style="border-collapse:collapse;font-size:28px;width:100%;margin:0 0 12px">` +
        VAR.map(
          ([v, t, h]) =>
            `<tr style="border-top:var(--linie-min) solid var(--linie)"><td style="padding:7px 18px 7px 0;font-weight:700;width:80px">${v}</td><td style="padding:7px 0">${t}</td><td style="padding:7px 0 7px 18px;color:${h === 'Basis' ? 'var(--blau)' : 'var(--gedaempft)'};font-size:var(--s-min);font-weight:600;text-align:right">${h}</td></tr>`,
        ).join('') +
        `</table>` +
        grafikBox(profilSvg(d)) +
        `<p class="beleg">${VARIANTEN.length} Varianten × 5 Blöcke = ${d.live.laeufe} Läufe; Reihenfolge je Block per Seed gemischt; Daten und Last in jedem Lauf gleich</p>`,
    ),
    notiz: privat('N3.notiz', {}),
    stichpunkte: privat('N3.stichpunkte', { proxyS, timeoutS, fmt, k }),
    quelle: q(
      `1A-Versuchsvertrag (Varianten, Lastprofil); ${H.datei.replace('auswertung/auswertung.json', 'plan.json')} (profile, runs, Seed ${k.seed}); Laufmanifeste (Limits, NLP_TIMEOUT_MS), auswertung.json runs[V4].proxy.delayMs`,
    ),
  });

  // Kurzbelege in die Fußzeile (wie Jonas' Folien), eine Zeile
  for (const f of F) {
    const z = ZITATE[f.id];
    if (!z) throw new Error(`${f.id}: keine Kurzbelege`);
    f.fuss = quellenzeile(z);
  }

  // Literatur: seit der Durchsicht 2026-11-18 im gemeinsamen Verzeichnis (J16, J16b in folien.mjs), kein NL mehr.

  // Vortragsreihenfolge: N3 (bis 2026-11-16 RN3) an seiner Stelle.
  const ORDNUNG = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N9', 'N10'];
  const rang = (f) => (ORDNUNG.includes(f.id) ? ORDNUNG.indexOf(f.id) : ORDNUNG.length + 1);
  return F.map((f, i) => [f, i])
    .sort((a, b) => rang(a[0]) - rang(b[0]) || a[1] - b[1])
    .map(([f]) => f);
}
