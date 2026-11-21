// Handout von Jonas (1C und 1B Schritte 1–2): A4, höchstens 5 Seiten, Aufbau nach Design Abschnitt 9.
// Jede Zahl kommt aus dem Datenmodul (über ladeFolienDaten) oder aus FESTWERTE; der Test prüft das.
// Namen und Matrikelnummern stehen nur im Abgabe-PDF: personen kommt von außerhalb des Repos,
// ohne personen stehen Platzhalter.
//
// CLI: node handout.mjs <ausgabeordner> [personen.json]
//   personen.json = [{ "name": "…", "matrikel": "…" }, { … }] in der Reihenfolge Jonas, Niklas.
/* global console, document, process -- Node-Skript, page.evaluate läuft im Browser */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { FESTWERTE, ladeFolienDaten } from './folien.mjs';
import { wegSvg, zeitzerlegungSvg } from './grafik.mjs';
import { fmt } from './zahlen.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HIER, '../..');
const TITEL = 'Kontextpfad und zweite Serverrolle';
const PLATZHALTER = 'Name, Matrikelnummer: [lokal eintragen]';
const GRUPPE = [
  { vorname: 'Jonas', teil: '1C, 1B Schritte 1–2 (dieses Handout)' },
  { vorname: 'Niklas', teil: '1A, 1B Schritte 3–4 (eigenes Handout)' },
];

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const w = (s) => `<span class="w">${s}</span>`;
const code = (s) => `<code>${s}</code>`;
const adr = (id) => `<span style="white-space:nowrap">${id}</span>`;
const etikett = (a) => `<span class="etikett etikett-${a.toLowerCase()}">${a}</span>`;

/** Kurzname des Rechners aus der Umgebungsangabe der Ergebnis-JSONs. */
function rechnerKurz(rechner) {
  if (!/i7-6820HQ/.test(rechner)) throw new Error(`unerwarteter Rechner: ${rechner}`);
  return 'ThinkPad P50';
}

/**
 * Alle Zahlen und Herkunftsangaben des Handouts, formatiert (deutsches Komma).
 * Gemeinsam für das HTML-Handout und das LaTeX-Handout (handout-latex.mjs).
 */
export function handoutWerte(daten) {
  const { b1: b, c1: c, antwort: a, nutzlast: nl, auftrag: au } = daten;
  const H = b.herkunft;
  const fw = Object.fromEntries(Object.entries(FESTWERTE).map(([k, v]) => [k, fmt(v.wert)]));
  const z = {
    netz: fmt(b.netzMs, 2),
    netzMax: fmt(b.netzMaxMs, 2),
    transport: fmt(b.transportMs, 1),
    adapter: fmt(b.adapterMs, 0),
    anteil: fmt(b.inferAnteil * 100, 2),
    jobWarm: fmt(b.jobWarmMs / 1000, 1),
    jobKalt: fmt(b.jobKaltMs / 1000, 1),
    kaltMedian: fmt(b.kaltMedianS, 1),
    warmMin: fmt(b.jobWarmSpanneS[0], 1),
    warmMax: fmt(b.jobWarmSpanneS[1], 1),
    kaltMin: fmt(b.kaltSpanneS[0], 1),
    kaltMax: fmt(b.kaltSpanneS[1], 1),
    c0: fmt(b.c0DiffMs, 1),
    b0: fmt(b.b0JobMs, 1),
    request: fmt(c.requestMs.wert, 1),
    valMs: fmt(c.validierungMs.wert, 1),
    valP: fmt(c.validierungAnteilProzent.wert, 1),
    q: fmt(c.q.wert, 3),
    infer1C: fmt(c.inferenzS.wert, 1),
    kalPc: fmt(c.kalibrierungPcS.wert, 1),
    delta: fmt(c.speicherDeltaGb.wert, 3),
    nachpr: fmt(c.nachpruefungAnteilProzent.wert, 2),
    // Der verfolgte Auftrag; Titel = Wartezeit am Client gerundet wie Folie J1 (folien.mjs, z.auS).
    auS: fmt(Math.round(au.clientWaitMs / 1000)),
    auWarte: fmt(au.clientWaitMs / 1000, 1),
    auJob: fmt(au.jobMs / 1000, 1),
    kaltAnteilMin: fmt(b.kaltAnteilSpanne[0] * 100, 2),
    kaltAnteilMax: fmt(b.kaltAnteilSpanne[1] * 100, 2),
    kaltNetz: fmt(b.kaltNetzMedianMs, 2),
    transportAnteil: fmt(b.transportAnteil * 100, 2),
    speicher1B: fmt(b.speicherMaxGb, 2),
  };
  const n = b.anzahl;
  const nWarm = b.nWarm;
  const P50 = rechnerKurz(H.hauptlauf.rechner);
  if (rechnerKurz(H.nachtrag.rechner) !== P50) throw new Error('Nachtrag auf anderem Rechner');
  const haupt = H.hauptlauf.commit.slice(0, 8);
  const nachtrag = H.nachtrag.commit.slice(0, 8);
  const nachlauf = c.requestMs.commit.slice(0, 8); // def56700 (Messung auf dem Branch f746ffba)
  const teil2 = c.validierungMs.commit;
  const ersteAussage = a.ausgabe.split('\n')[0];
  const gateBeob = daten.abgeleitet.gateBeobachtet;
  return {
    b,
    c,
    a,
    nl,
    au,
    H,
    fw,
    z,
    n,
    nWarm,
    P50,
    haupt,
    nachtrag,
    nachlauf,
    teil2,
    ersteAussage,
    gateBeob,
  };
}

/**
 * Handout als HTML-Dokument.
 * @param daten   Ergebnis von ladeFolienDaten(root)
 * @param personen optional [{ name, matrikel }, { name, matrikel }] für Jonas und Niklas
 * @param optionen { basis }: URL des Ordners mit stil.css und schriften/ (für <base>)
 */
export function baueHandout(daten, personen, { basis } = {}) {
  if (personen !== undefined && (!Array.isArray(personen) || personen.length !== GRUPPE.length)) {
    throw new Error(`personen braucht genau ${GRUPPE.length} Einträge (Jonas, Niklas)`);
  }
  const {
    b,
    c,
    a,
    au,
    H,
    fw,
    z,
    n,
    nWarm,
    P50,
    haupt,
    nachtrag,
    nachlauf,
    teil2,
    ersteAussage,
    gateBeob,
  } = handoutWerte(daten);

  // ------------------------------------------------------------ Seite 1
  const personZeile = (g, i) =>
    `<tr><td><b>${g.vorname}</b></td><td>${g.teil}</td><td>${
      personen
        ? `${esc(personen[i].name)}, Matrikelnummer: ${esc(personen[i].matrikel)}`
        : PLATZHALTER
    }</td></tr>`;
  const grenzen = (auftrag, punkte) =>
    `<div class="grenzen ${auftrag === '1B' ? 'b' : ''}"><p><b>Abweichungen und Grenzen ${etikett(auftrag)}</b></p>` +
    `<ul>${punkte.map((p) => `<li>${p}</li>`).join('')}</ul></div>`;

  const seite1 =
    `<h1>Ein Klick. ${z.auS} Sekunden. Keine Modellantwort.</h1>` +
    `<p class="unter">${TITEL} im KI-Pfad von arsnova.eu: Architektur nach Release 1.3, Messungen nach v1.4.0 und davor, je Zahl angegeben</p>` +
    `<p class="meta" data-frei>Cloud Computing, Referat Thema 1 · Handout · Stand 15.11.2026</p>` +
    `<table class="personen"><tr><th>Gruppe</th><th>Teil im Referat</th><th>Name und Matrikelnummer</th></tr>` +
    GRUPPE.map(personZeile).join('') +
    `</table>` +
    `<div class="kasten"><p><b>Kurzantwort.</b> Auftrag ${au.nr} des 1B-Laufs (synthetische Daten) wartet vom Klick bis zum Ergebnis ${w(`${z.auWarte} s`)}, Jobdauer am Server (T_job) ${w(`${z.auJob} s`)}. ` +
    `${etikett('1C')} Der Kontextpfad hält seine Zusagen, mit Ausnahmen. ` +
    `${etikett('1B')} Die zweite Serverrolle kostet keine relevante Zeit: Netz ${w(`${z.netz} ms`)}, Transport ${w(`${z.transport} ms`)} je Auftrag (Median); die Inferenz macht ${w(`${z.anteil} %`)} aus, auf schnellerer Hardware wäre der Anteil kleiner. ` +
    `Nach v1.4.0 besteht keine der ${w(`${gateBeob}`)} geprüften Modellantworten das Quality-Gate; auf ${code('9f230abc')} (Instruktion v2, ohne Gate) endeten ${w(c.fullContextVorGate.wert)} mit Modellzusammenfassung. Instruktion und Gate änderten sich zugleich, nicht getrennt gemessen.</p></div>` +
    `<h2>1 Leitfragen und Weg eines Auftrags (Jonas)</h2>` +
    `<p class="zitat">${etikett('1C')} „Wie zuverlässig hält der implementierte 1.3-Kontextpfad seine Vertrags-, Konsistenz- und Entkopplungszusagen vom App-Zustand bis zur privaten Inferenz ein?“ (Prüfungsdokument [1])</p>` +
    `<p class="zitat">${etikett('1B')} „Wie schlüsselt sich die Zeit eines echten Kompass-Auftrags […] auf, und wie groß ist der Transportanteil im Vergleich zur Inferenz?“ (ADR 1B-011 [10])</p>` +
    `<figure>${wegSvg({ aktiv: null, b1: b, c1: c, auftrag: au })}` +
    `<figcaption><b>Abb. 1:</b> Weg von Auftrag ${au.nr}; Kontext und Nachprüfung: 1C-Werte (ein Rechner, Loopback). Eigene Darstellung. ` +
    `Quelle: Auftrag ${au.nr} [7], ${P50}, ${haupt}; Nachprüfung [8], ${P50}, ${nachlauf}; Validierung [9], ${P50}, ${teil2}.</figcaption></figure>`;

  // ------------------------------------------------------------ Seite 2: 1C
  const zeile = (schritt, gezeigt, urteil, klasse = 'ja') =>
    `<tr><td><b>${schritt}</b></td><td>${gezeigt}</td><td class="${klasse}">${urteil}</td></tr>`;
  const seite2 =
    `<h2>2 Auftrag 1C: Hält der Kontextpfad seine Zusagen? (Jonas)</h2>` +
    `<table><tr><th style="width:15%">Schritt</th><th>Gezeigt und gemessen</th><th style="width:22%">Urteil</th></tr>` +
    zeile(
      '1 Datenfluss',
      `je #456-Bereich Quelle, Funktion, Schema, Rechteprüfung [5]; Vorschau und Auftrag nur mit Host-Token (${code('assertHostSessionAccessFromContext')})`,
      'belegt',
    ) +
    zeile(
      '2 Realer Auftrag',
      `Schichten getrennt (E2), Vertrag nur in Negativprobe verändert (E4); Vorschau = Nutzlast in allen ${w(c.n1LaeufeMitAufruf.wert)} Läufen mit Aufruf, K_L1 formal verfehlt (zwei ohne Aufruf nach OOM-Kill); Host-Aufruf ${w(`${z.request} ms`)}, Inferenz ${w(`${z.infer1C} s`)}`,
      'hält, bleibt (1C-012, 1C-013)',
    ) +
    zeile(
      '3 Fehlerfälle',
      'inkompatible Version kontrolliert (T1); fehlender Bereich mit Grund (T2.1, T2.2); langsamer Empfänger, Slot, Queue (E6a/b, E10, E11). Stiller Feldverlust: fremde Snapshot-Version als „keine Daten“ (T2.3), Bereich aus Budgetgründen leer (E15)',
      'hält; Ausnahmen empfohlen (1C-015, 1C-014)',
      'empf',
    ) +
    zeile(
      '4 Änderungen',
      `Stimme oder gelöschte Quelle: ${code('source_changed')} (T5, E7, E8); Stimme im Aufbau: ${code('CONFLICT')} (E12); Legacy- und Regelfallback kontrolliert (E13, E14, E6a); Nachprüfung ${w(`${z.nachpr} %`)} (Regel unter ${w(`${fw.schwelleNachpruefungProzent} %`)}). Blitzlicht außer TEMPO: <span style="white-space:nowrap">${code('YESNO')} ${w(c.yesno.wert)}</span> ${code('source_changed')} ohne Änderung`,
      'hält, bleibt (1C-010); Blitzlicht empfohlen (1C-016)',
    ) +
    zeile(
      'Kosten',
      `Validierung ${w(`${z.valMs} ms`)} = ${w(`${z.valP} %`)} eines warmen Aufbaus (Test-Runtime, 248029dc); q = ${w(z.q)} bei ${w(`${fmt(c.bytesJeToken.wert, 2)}`)} Byte je Token im Mittel: zwei Drittel des geschätzten Budgets ungenutzt; jedes Token hat mindestens ein Byte: Obergrenze für den budgetierten Teil, Template nicht budgetiert`,
      'bleibt (1C-011); Zählung prüfen (1C-014)',
    ) +
    zeile(
      'Ergebnis',
      `${w(c.fullContextN4.wert)} mit Modellzusammenfassung, ${w(c.gateAntworten.wert)} Antworten bestehen das Gate`,
      'Gate abstimmen (1C-018)',
      'empf',
    ) +
    zeile(
      'Gegenprüfung',
      'V1 ohne Nachprüfung: Queue-Zustand veraltet in 10 von 10 Änderungsläufen',
      'Nachprüfung bleibt (1C-010)',
    ) +
    `</table>` +
    `<p class="quelle"><b>Tab. 1:</b> Aufgabenabdeckung 1C, Details im Ergebnisbericht [10]. Quelle: Nachlauf [8], ${P50}, ${nachlauf}; Tests, Teil 2 [9], ${P50}, ${teil2}.</p>` +
    grenzen('1C', [
      `ein Rechner, Runtime über Loopback, kein zweiter Host; Image lokal gebaut, Messproxy; eine synthetische Fixture`,
      `Laborlimits ${w(`${fw.laborCpus1C} CPUs`)}, ${w(`${fw.laborSpeicher1CGiB} GiB`)} statt ${w(`${fw.releaseCpus} CPUs`)}, ${w(`${fw.prodSpeicherGiB} GiB`)} ab Werk v1.4.0; Timeout ${w(`${fw.laborTimeoutS} s`)} statt ${w(`${fw.releaseTimeoutS} s`)} (Kalibrierung am Laptop ${w(`${fw.kalibrierungLaptopS} s`)})`,
      `Stand ${code('def56700')} (v1.4.0-14), nicht v1.3.0 (ADR 1C-001); „hält“ heißt vertragsgültig, kein Urteil über Prompts`,
    ]) +
    `<h3>Betrieb: Timeout und Speicher ${etikett('1C')}</h3>` +
    `<p>Ab Werk v1.4.0 bricht die App nach ${w(`${fw.releaseTimeoutS} s`)} ab; die Inferenz dauerte bei der Kalibrierung am PC (${code(c.kalibrierungPcS.commit)}) ${w(`${z.kalPc} s`)}, am Laptop im Median ${w(`${z.infer1C} s`)} (${code('def56700')}). ` +
    `Bei wechselnden Prompts wächst der Speicher der Runtime je Auftrag um ${w(`${z.delta} GB`)} (Median, Laptop); der KV-Cache belegt Speicher je Token [11]. Beide Grenzen ${w(`${fw.grenzeGesamtGiB} GiB`)} (Labor ${w(`${fw.laborSpeicher1CGiB} GiB`)} + ${w(`${fw.laborSpeicher1CGiB} GiB`)}, Produktion ${w(`${fw.prodSpeicherGiB} GiB`)} + bis zu ${w(`${fw.prodSwapGiB} GiB`)} Swap, Swap des Hosts unbekannt): OOM-Kill auf ${code(c.oomAuftrag9f230abc.commit)} im ${w(`${c.oomAuftrag9f230abc.wert}.`)} Auftrag (Laptop und PC), auf ${code('def56700')} im ${w(`${c.oomAuftrag.wert}.`)} (Ursache nicht getrennt gemessen) [8, 10]. ` +
    `Im 1B-Lauf mit gleichem Prompt blieb er bei höchstens ${w(`${z.speicher1B} GB`)} [7].</p>`;

  // ------------------------------------------------------------ Seite 3: 1B
  const hyp = (h, groesse, schwelle, wert) =>
    `<tr><td><b>${h}</b></td><td>${groesse}</td><td>${schwelle}</td><td class="ja">${wert}</td></tr>`;
  const seite3 =
    `<h2>3 Auftrag 1B, Schritte 1–2: Wo steckt die Zeit? (Jonas)</h2>` +
    `<p><b>Aufbau (Schritt 1).</b> Nach ADR-0035 [2] und Runbook [3] zwei KVM-VMs auf einem Laptop: app-host mit App samt App-Adapter, PostgreSQL, Redis (Encoder ab Werk aus); llm-host mit dem LLM-Server ${code('llama-server')}, Qwen3-4B Q4_K_M; Firewall und Token; Manifest mit Commit, lokal gebauten Image-Digests, <span style="white-space:nowrap">GGUF-SHA-256</span> und Startflags [7]. ` +
    `Abgleich mit ADR-0035 [7]: Lücke bei ${code('--n-predict')} (ADR „Richtung ${fw.nPredictAdr}“, ausgeliefert ${fw.nPredictRelease}).</p>` +
    `<p><b>Messung (Schritt 2).</b> ${n} echte Aufträge über die App; Mitschnitt auf beiden Hosts (t<sub>0</sub>–t<sub>3</sub>), Inferenz aus ${code('timings')} [4], ohne Änderung am Produktionscode (ADR 1B-006, Begriffe [6]).</p>` +
    `<figure>${zeitzerlegungSvg(b)}` +
    `<figcaption><b>Abb. 2:</b> Zeitzerlegung, Schwellen vorab (Log-Achse), Gruppen an den Balken. Eigene Darstellung. ` +
    `Quelle: Lauf [7], ${P50}, ${haupt}; Kaltläufe: Nachtrag [7], ${P50}, ${nachtrag}.</figcaption></figure>` +
    `<table><tr><th style="width:14%">Hypothese</th><th style="width:28%">Messgröße</th><th style="width:20%">Schwelle, vorab</th><th>Messwert (alle erfüllt)</th></tr>` +
    hyp(
      'H_B1',
      'Netz je Auftrag',
      `${w(`Median ≤ ${fw.schwelleNetzMs} ms`)}, ${w(`Max. ≤ ${fw.schwelleNetzMaxMs} ms`)}`,
      `${w(`${z.netz} ms`)}, Max. ${w(`${z.netzMax} ms`)}`,
    ) +
    hyp(
      'H_B2',
      'Adapter je Auftrag, Median',
      w(`≤ ${fw.schwelleAdapterS} s`),
      w(`${z.adapter} ms`),
    ) +
    hyp(
      'H_B3',
      'Inferenzanteil, Median',
      w(`≥ ${fw.schwelleInferenzProzent} %`),
      w(`${z.anteil} %`),
    ) +
    hyp(
      'H_B3 kalt (M4)',
      `Anteil in ${b.nKaltLaeufe} Kaltläufen; Netz`,
      `${w(`≥ ${fw.schwelleInferenzProzent} %`)} in allen; ${w(`Netz ≤ ${fw.schwelleNetzMs} ms`)}`,
      `${w(`${z.kaltAnteilMin}–${z.kaltAnteilMax} %`)}, Netz ${w(`${z.kaltNetz} ms`)}`,
    ) +
    `</table>` +
    `<p class="quelle"><b>Tab. 2:</b> Schwellen vorab (ADR 1B-008 [10]). Quelle: H_B1–H_B3 Lauf [7], n = ${n}, ${P50}, ${haupt}; M4 Nachtrag [7], ${P50}, ${nachtrag}.</p>` +
    `<p>T_job: Auftrag 1 kalt (n = 1) ${w(`${z.jobKalt} s`)} (Kaltläufe ${w(`${z.kaltMedian} s`)}), Median warm ${w(`${z.jobWarm} s`)} (warm, n = ${nWarm}).</p>` +
    `<p><b>Gegenprüfung.</b> C0 Strecke gegen lokal ${w(`${z.c0} ms`)}, kein messbarer Unterschied; B0 ohne Runtime ${w(`${z.b0} ms`)}, ${w(`${b.nB0} von ${b.nB0}`)} extraktiv [7]. Gegenalternative vorab: Netz und Adapter über ${w('5 %')} oder ${w(`${fw.schwelleAdapterS} s`)} (ADR 1B-008).</p>`;

  // ------------------------------------------------------------ Seite 4: Befunde und Entscheidung
  const ent = (art, inhalt, folge, beleg, klasse) =>
    `<tr><td class="${klasse}">${art}</td><td>${inhalt}</td><td>${folge}</td><td>${beleg}</td></tr>`;
  // Abweichungen 1B stehen auf Seite 4 bei den Grenzen (Design Abschnitt 9), damit die Seiten ausgewogen bleiben.
  const grenzen1B = grenzen('1B', [
    `${w(`${fw.laborCpus} statt ${fw.releaseCpus} CPUs`)} und Timeout ${w(`${fw.laborTimeout1BS} s`)} statt ${w(`${fw.releaseTimeoutS} s`)} ab Werk v1.4.0, nach Kalibrierung (I = ${w(`${fw.kalibrierung1BS} s`)}); v1.3.0 hatte ${fw.v13Cpus} CPUs, ${fw.v13SpeicherGiB} GiB, ${fw.v13TimeoutS} s; gemessen ist auf Wunsch des Prüfers der aktuelle Stand`,
    'Images selbst gebaut; Start ohne Wrapper, weil er das CPU-Override nicht durchreicht (Trockenlauf vorher); Summary-Schalter an; Hintergrunddienste vor dem gewerteten Lauf von Hand abgeschaltet',
    `ein Laptop, virtuelles Netz, keine parallele Last; Netzauflösung ≈ ${w(`${fw.netzAufloesungMs} ms`)}; Token im Klartext über HTTP`,
    `warm heißt: identischer Snapshot aus dem KV-Cache, bei geändertem Zustand gilt eher der Kaltwert; Code ${code('a19ca70f')} (v1.4.0-184), Lauf-Commit ${code(haupt)} nur Laborskripte`,
  ]);
  const seite4 =
    `<h2>4 Befunde und Entscheidung zu 1C und 1B (Jonas)</h2>` +
    `<h3>Keine geprüfte Modellantwort besteht das Gate ${etikett('1C')} ${etikett('1B')}</h3>` +
    `<p>Im 1B-Lauf verwirft das Quality-Gate ${w(`${b.verworfen} von ${n}`)} Antworten, im 1C-Nachlauf bestehen ${w(c.gateAntworten.wert)} [7, 8]: ${gateBeob} geprüfte Antworten, ein Modell, eine Fixture. Ausgaben mit Status failed und unsichere ohne Aussagen lässt es durch; sonst verlangt es mindestens zwei Aussagen, jede in der Form „Stichwort: Text“, mit verschiedenen, nicht generischen Stichwörtern, ganze Sätze, keine Metamuster; Sprache und Thema prüft es nicht. ` +
    `Auftrag ${a.auftrag} scheitert an der Form (${w(`${a.mitTrenner} von ${a.aussagen}`)} Aussagen) und verfehlt auch den Inhalt (englisch, Moderationsstatus):</p>` +
    `<p class="zitat antwort" lang="en">${esc(ersteAussage)}</p>` +
    `<p class="quelle">Ausschnitt ohne Header und Token [7], Lauf ${haupt}, ${P50}.</p>` +
    `<p>Die Lehrperson sieht eine extraktive Ersatzzusammenfassung mit dem allgemeinen Hinweis „Eine ausführliche Zusammenfassung war diesmal nicht möglich …“, den Grund nicht. ` +
    `</p>` +
    `<table><tr><th style="width:15%">Entscheidung</th><th style="width:27%">Inhalt</th><th>Kosten, Risiko, Betrieb</th><th style="width:15%">ADR, Issue</th></tr>` +
    ent(
      'beibehalten (1C)',
      'Nachprüfung, Validierung, Entkopplung, Vorschau',
      'wenig Zeit; Risiko: beim Voting verwirft jede Stimme während der Inferenz die Antwort, Häufigkeit offen (1C-017)',
      `${adr('1C-010')} bis ${adr('1C-013')}`,
      'ja',
    ) +
    ent(
      'empfohlen (1C)',
      'Gate mit Instruktion und Grammatik abstimmen',
      'Abnahmemessung; lockere Schwelle zeigt Metaaussagen',
      `${adr('1C-018')}, #13`,
      'empf',
    ) +
    ent(
      'empfohlen (1C)',
      'Timeout am Inferenz-Host kalibrieren',
      'eine Kalibrierung; Slot länger belegt',
      `${adr('1C-023')}, #16`,
      'empf',
    ) +
    ent(
      'empfohlen (1C)',
      'Prompt-Cache im RAM begrenzen',
      'eine Zeile; Risiko: nur ein Slot gemessen',
      `${adr('1C-024')}, #14`,
      'empf',
    ) +
    ent(
      'empfohlen (1C)',
      'genauere Token-Zählung prüfen',
      'Änderung am Packer; Fenster kann überlaufen',
      `${adr('1C-014')}, #17`,
      'empf',
    ) +
    ent(
      'empfohlen (1C)',
      'Snapshot-Zustand; Blitzlicht-Hash',
      'klein; Risiko: Fenster ohne Rundenlaufzeit',
      `${adr('1C-015')}, ${adr('1C-016')}; #15, #18`,
      'empf',
    ) +
    ent(
      'Konfiguration (1B)',
      'Topologie bleibt; Hebel am Inferenz-Host',
      'keine zusätzlichen; Aufwand der Rolle: Niklas, Schritt 4',
      '1B-Ergebnis; #13',
      'ja',
    ) +
    ent(
      'empfohlen (1B)',
      `Log zeigt nur ${code('latencyMs')} und ${code('invalid_response')} [7]: Zeiten und Grund loggen`,
      'Logzeilen; kein Prompttext',
      '#19, #20',
      'empf',
    ) +
    `</table>` +
    `<p class="quelle"><b>Tab. 3:</b> Entscheidungen; Empfehlungen nicht umgesetzt. Quelle: ADRs (Folgen), Berichte [10].</p>` +
    grenzen1B;

  // ------------------------------------------------------------ Seite 5: Quellen, Evidenz, KI
  const lit = [
    `arsnova.eu-Projektteam (2026): Referatsprüfung Cloud Computing: verbindliche Umsetzung. ${code('docs/didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md')}, Abschnitt 4.3.`,
    `arsnova.eu-Projektteam (2026): ADR-0035, Selbstgehosteter Open-Weight-LLM-Server: llama.cpp (llama-server) statt Ollama. ${code('docs/architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md')}.`,
    `arsnova.eu-Projektteam (2026): Betriebshandbuch: private CPU-Inferenz auf einem zweiten Linux-Host. ${code('docs/operations/OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md')}.`,
    `ggml-org (o. J.): llama.cpp HTTP Server, README, Antwortfeld ${code('timings')}, Tag b10524. <a href="https://github.com/ggml-org/llama.cpp/blob/b10524/tools/server/README.md">github.com/ggml-org/llama.cpp/blob/b10524/tools/server/README.md</a>, abgerufen am 15.11.2026.`,
    `Eigene Arbeit (2026): Dossier 1C, Autorisierter Kontext und asynchroner Adapterpfad. ${code('1C-kontext-und-adapterpfad.md')}; Diagrammdoku ${code('1C-diagrams.md')}.`,
    `Eigene Arbeit (2026): Recherchedossier 1B, Private Inferenz als getrennte Serverrolle. ${code('1B-private-inferenz-zweiter-host.md')}.`,
    `Eigene Messung (2026): 1B-Aufbau ${code('evidenz/1B/2026-11-12-aufbau.md')}, Lauf ${code('evidenz/1B/2026-11-13-lauf.md')}, Rohdaten ${code('evidenz/1B/messung/')}.`,
    `Eigene Messung (2026): 1C-Nachlauf ${code('evidenz/1C/2026-11-09-labor-nachlauf.md')}, Rohdaten in ${code('messung/')}.`,
    `Eigene Messung (2026): 1C, Teil 2 mit Test-Runtime, ${code('evidenz/1C/2026-10-24-teil2.md')}.`,
    `Eigene Arbeit (2026): ADRs 1C-001 bis 1C-026 und 1B-001 bis 1B-012 (${code('adr/')}); Berichte ${code('1C-ergebnis.md')}, ${code('1B-ergebnis.md')}; Eigenanteil ${code('1C-eigenanteil.md')}, ${code('1B-eigenanteil.md')}.`,
    `Kwon, W. et al. (2023): Efficient Memory Management for Large Language Model Serving with PagedAttention. In: Proc. 29th Symposium on Operating Systems Principles (SOSP ’23), ACM, S. 611–626. <a href="https://doi.org/10.1145/3600006.3613165">doi.org/10.1145/3600006.3613165</a>.`,
  ];
  const seite5 =
    `<h2>5 Quellen, Evidenz und KI-Offenlegung (Jonas)</h2>` +
    `<h3>Literatur und Quellen</h3>` +
    `<ol class="literatur">${lit.map((t, i) => `<li id="q${i + 1}">${t}</li>`).join('')}</ol>` +
    `<p class="quelle">[1]–[3] im Fork, Stand ${code('a19ca70f')}; Pfade [5]–[10] relativ zu ${code('docs/referat-thema-1/')}; Issues #13–#20 im Fork <a href="https://github.com/NiklasSkulll/arsnova.eu/issues">github.com/NiklasSkulll/arsnova.eu/issues</a>.</p>` +
    `<h3>Evidenzort und Rechner</h3>` +
    `<p>Alle eigenen Belege liegen im Fork <a href="https://github.com/NiklasSkulll/arsnova.eu">github.com/NiklasSkulll/arsnova.eu</a> unter ${code('docs/referat-thema-1/')}: 1C in ${code('main')} (PR #12); 1B und dieses Material im Zweig ${code('feature-praesentation-jonas')}, Antwortausschnitt seit Commit ${code(daten.antwortCommit)}.</p>` +
    `<p class="klein" data-frei><b>Rechner.</b> ThinkPad P50: ${esc(H.hauptlauf.rechner.replace(/Intel\(R\) Core\(TM\) | CPU @ [\d.]+GHz/g, ''))}. PC: i7-8700.</p>` +
    `<h3>KI-Offenlegung</h3>` +
    `<p>Werkzeug: Claude Code; Modell laut Protokollen Claude Opus 5.5 (ein Entwurf mit Sonnet), nicht unabhängig geprüft. ` +
    `Die KI entwarf Skripte, Tests, Auswertungen, Texte, Folien, Notizen und dieses Handout; Auswerteregeln, die sie nachts festlegte, habe ich danach bestätigt. ` +
    `Hypothesen und Schwellen habe ich vor den gewerteten Läufen freigegeben; Ausnahmen: M7b/M7c liefen ohne vorherige Freigabe, T3.1 war exploratorisch, die 1B-Leitfrage habe ich nach dem Lauf bestätigt (ADR 1B-011). Läufe und Abweichungen habe ich entschieden, Ergebnisse geprüft. ` +
    `Reviews waren KI-Sitzungen, keine menschlichen Gutachten. Details: Eigenanteil-Dateien [10].</p>`;

  // ADR-Kennungen nicht am Bindestrich umbrechen (nur im HTML-Text, nie in den SVG-Grafiken).
  const seiten = [seite1, seite2, seite3, seite4, seite5].map((t) =>
    t
      .split(/(<svg[\s\S]*?<\/svg>)/)
      .map((teil) =>
        teil.startsWith('<svg') ? teil : teil.replace(/(?<![\w-])1[BC]-\d{3}\b/g, (k) => adr(k)),
      )
      .join(''),
  );
  const html = seiten
    .map(
      (s, i) =>
        `<section class="seite"><div class="inhalt">${s}</div>` +
        `<footer data-frei><span>Handout Jonas</span><span>${i + 1} / ${seiten.length}</span></footer></section>`,
    )
    .join('\n');

  return readFileSync(join(HIER, 'handout-vorlage.html'), 'utf8')
    .replace('{{BASIS}}', () => (basis ? `<base href="${esc(basis)}" />` : ''))
    .replace('{{TITEL}}', () => esc(`${TITEL} · Handout Jonas`))
    .replace('{{SEITEN}}', () => html);
}

/**
 * Rendert das Handout mit Chromium (Playwright aus den Repo-Abhängigkeiten) als A4-PDF.
 * Ohne <base> im HTML wird es neben stil.css gelegt, damit Schriften und Stil laden.
 * Liefert Layoutbefunde: Anzahl Seitenabschnitte, Seiten mit Überlauf, geladene Schriften.
 */
export async function rendereHandout(html, pdfPfad) {
  const { chromium } = createRequire(resolve(ROOT, '../../package.json'))('playwright');
  const mitBasis = html.includes('<base ')
    ? html
    : html.replace(
        '<meta charset="utf-8" />',
        (m) => `${m}<base href="${pathToFileURL(`${HIER}/`).href}" />`,
      );
  // Das HTML kann Matrikelnummern enthalten: eigener Ordner (0700), Datei 0600, am Ende entfernt.
  const tmpOrdner = mkdtempSync(join(tmpdir(), 'handout-'));
  const tmp = join(tmpOrdner, 'handout.html');
  writeFileSync(tmp, mitBasis, { mode: 0o600 });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(tmp).href);
    await page.emulateMedia({ media: 'print' });
    const layout = await page.evaluate(async () => {
      await document.fonts.ready;
      const seiten = [...document.querySelectorAll('.seite')];
      const ueberlauf = [];
      const zuBreit = [];
      seiten.forEach((s, i) => {
        const inhalt = s.querySelector('.inhalt');
        if (inhalt.scrollHeight > inhalt.clientHeight + 1) ueberlauf.push(i + 1);
        if (s.scrollWidth > s.clientWidth + 1) zuBreit.push(i + 1);
      });
      const schriften = [...document.fonts]
        .filter((f) => f.status === 'loaded')
        .map((f) => `${f.family.replace(/"/g, '')} ${f.weight}`);
      const frei = seiten.map((s) => {
        const inhalt = s.querySelector('.inhalt');
        const letzte = inhalt.lastElementChild.getBoundingClientRect().bottom;
        return Math.round((inhalt.getBoundingClientRect().bottom - letzte) * 0.2646); // px → mm
      });
      return { seiten: seiten.length, ueberlauf, zuBreit, schriften, freiMm: frei };
    });
    await page.pdf({ path: pdfPfad, preferCSSPageSize: true, printBackground: true });
    return layout;
  } finally {
    await browser.close();
    rmSync(tmpOrdner, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------ CLI
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [ziel, personenDatei] = process.argv.slice(2);
  if (!ziel) {
    console.error('Aufruf: node handout.mjs <ausgabeordner> [personen.json]');
    process.exit(2);
  }
  const personen = personenDatei ? JSON.parse(readFileSync(personenDatei, 'utf8')) : undefined;
  mkdirSync(ziel, { recursive: true });
  const html = baueHandout(ladeFolienDaten(ROOT), personen);
  const pdf = join(resolve(ziel), 'jonas-handout.pdf');
  const layout = await rendereHandout(html, pdf);
  console.log(JSON.stringify({ pdf, ...layout }, null, 2));
}
