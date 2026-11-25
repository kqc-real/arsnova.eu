// Literaturverzeichnis der Folien nach dem IU-Zitierleitfaden (ZL): dieselben Einträge und Jahresbuchstaben
// wie das Handout in PaperLab (presentation-semester-7-cloud-computing-1b-1c_jonas/main.bib, dort am Volltext
// und gegen Crossref geprüft). Schlüssel = bibkey dort; literatur.test.mjs gleicht beide ab.
// Eigene Arbeit ist ein Eintrag (weirauch2026c, im Handout ohne Jahresbuchstaben „Weirauch, 2026“); die Fundstelle
// (Ordner, Datei, ADR) steht im Kurzbeleg. Projektdokumente von arsnova.eu als Permalink auf a19ca70f, eigene Arbeit
// auf main des Forks (dort nach dem Merge, Wunsch des Autors 2026-11-15).
// Kurzbelege auf den Folien: kurzbeleg(schluessel, stelle) → „(Autor, Jahr, Stelle)“ (ZL S. 2–3, Anhang B).
//
// Seit der Durchsicht 2026-11-18 ein gemeinsames Verzeichnis für das ganze Deck: Niklas' Einträge (heo2024,
// nosek2018, schneider2026, Schlüssel wie in seinem main.bib) stehen hier; literatur-1a.mjs liest nur noch daraus.
// Geprüft 2026-11-18 gegen IU_Source_of_Truth.md und das ZL-Original: kwon2023 als Sammelwerksbeitrag
// („In <i>Proceedings …</i> (S. 611–626). Association for Computing Machinery.“, ZL S. 29–32, Institution nicht
// abgekürzt, ZL S. 26); mell2011 „Nr. 800-145“ wie im Handout (Normen-Muster ZL S. 36). Datum der arsnova-Einträge
// bleibt in der biblatex-Form „(2026a, 17. Oktober)“ wie im Handout (ZL Anhang C, S. 47, duldet das).
// Aus literatur-1a.mjs übernommen:
// Geprüft 2026-11-16:
// - heo2024: Kernel-Doku in der Fassung von Linux 6.12 (2024), geprüft 2026-11-16 auf
//   https://www.kernel.org/doc/html/v6.12/admin-guide/cgroup-v2.html: Titel „Control Group v2“, „Author: Tejun
//   Heo“; Abschnitte „CPU Interface Files“ (cpu.max „The maximum bandwidth limit“, cpu.stat nr_throttled) und
//   „Memory Interface Files“ (memory.peak). Früher heo2015 mit „Date: October, 2015“ aus dem Dokumentkopf: Der
//   CPU-Controller kam erst mit Linux 4.15 (2018) in cgroup v2, die zitierten Stellen fehlen in der Fassung von
//   2015. Deshalb die gelesene, versionierte Fassung.
// - nosek2018: Crossref 10.1073/pnas.1708274114 (4 Autoren, PNAS 115(11), 2600–2606); Volltext PMC5856500,
//   Abstract S. 2600: „Preregistration distinguishes analyses and outcomes that result from predictions from
//   those that result from postdictions.“
// - schneider2026: eigene Arbeit als ein Eintrag (wie weirauch2026c bei Jonas, ZL S. 31 Fn. 11); die
//   Fundstelle (Vertrag, Reihe, Datei) steht im Kurzbeleg. URL gilt nach dem Merge auf main des Forks.

const GH_FORK = 'https://github.com/NiklasSkulll/arsnova.eu/tree';
const GH_UP = 'https://github.com/kqc-real/arsnova.eu/blob/a19ca70f';

/** Alphabetisch nach ZL. `kurz` ist die Autor-Jahr-Angabe des Kurzbelegs. */
export const LITERATUR = [
  {
    schluessel: 'arsnova2026adr0035',
    kurz: 'arsnova.eu-Projektteam, 2026a',
    voll: `arsnova.eu-Projektteam. (2026a, 17. Oktober). <i>ADR-0035: Selbstgehosteter Open-Weight-LLM-Server: llama.cpp (llama-server) statt Ollama</i>. GitHub. ${GH_UP}/docs/architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md`,
  },
  {
    schluessel: 'arsnova2026pruefung',
    kurz: 'arsnova.eu-Projektteam, 2026b',
    voll: `arsnova.eu-Projektteam. (2026b, 13. Oktober). <i>Referatsprüfung Cloud Computing: Verbindliche Umsetzung</i>. GitHub. ${GH_UP}/docs/didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md`,
  },
  {
    schluessel: 'dean2013',
    kurz: 'Dean & Barroso, 2013',
    voll: 'Dean, J. & Barroso, L. A. (2013). The tail at scale. <i>Communications of the ACM, 56</i>(2), 74–80. https://doi.org/10.1145/2408776.2408794',
  },
  {
    schluessel: 'ggml2026',
    kurz: 'ggml-org, 2026',
    voll: 'ggml-org. (2026). <i>llama.cpp: LLaMA.cpp HTTP server</i> (Version b10524) [Computer Software]. GitHub. https://github.com/ggml-org/llama.cpp/blob/b10524/tools/server/README.md',
  },
  {
    schluessel: 'heo2024',
    kurz: 'Heo, 2024',
    voll: 'Heo, T. (2024). <i>Control Group v2</i> (Linux 6.12). The Linux Kernel Documentation. https://www.kernel.org/doc/html/v6.12/admin-guide/cgroup-v2.html',
  },
  {
    schluessel: 'kwon2023',
    kurz: 'Kwon et al., 2023',
    voll: 'Kwon, W., Li, Z., Zhuang, S., Sheng, Y., Zheng, L., Yu, C. H., Gonzalez, J. E., Zhang, H. & Stoica, I. (2023). Efficient memory management for large language model serving with PagedAttention. In <i>Proceedings of the 29th Symposium on Operating Systems Principles</i> (S. 611–626). Association for Computing Machinery. https://doi.org/10.1145/3600006.3613165',
  },
  {
    schluessel: 'mell2011',
    kurz: 'Mell & Grance, 2011',
    voll: 'Mell, P. & Grance, T. (2011). <i>The NIST definition of cloud computing</i> (NIST Special Publication Nr. 800-145). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-145',
  },
  {
    schluessel: 'nosek2018',
    kurz: 'Nosek et al., 2018',
    voll: 'Nosek, B. A., Ebersole, C. R., DeHaven, A. C. & Mellor, D. T. (2018). The preregistration revolution. <i>Proceedings of the National Academy of Sciences, 115</i>(11), 2600–2606. https://doi.org/10.1073/pnas.1708274114',
  },
  {
    schluessel: 'papadopoulos2021',
    kurz: 'Papadopoulos et al., 2021',
    voll: 'Papadopoulos, A. V., Versluis, L., Bauer, A., Herbst, N., von Kistowski, J., Ali-Eldin, A., Abad, C. L., Amaral, J. N., Tůma, P. & Iosup, A. (2021). Methodological principles for reproducible performance evaluation in cloud computing. <i>IEEE Transactions on Software Engineering, 47</i>(8), 1528–1543. https://doi.org/10.1109/TSE.2019.2927908',
  },
  {
    schluessel: 'schneider2026',
    kurz: 'Schneider, 2026',
    voll: `Schneider, N. (2026). <i>Referat Thema 1, Aufträge 1A und 1B</i> [Referatsausarbeitung: Versuchsvertrag, Messreihen, Auswertung]. GitHub. ${GH_FORK}/main/docs/referat-thema-1`,
  },
  {
    schluessel: 'shankar2024',
    kurz: 'Shankar et al., 2024',
    voll: 'Shankar, S., Zamfirescu-Pereira, J. D., Hartmann, B., Parameswaran, A. G. & Arawjo, I. (2024). <i>Who validates the validators? Aligning LLM-assisted evaluation of LLM outputs with human preferences</i>. arXiv. https://doi.org/10.48550/arXiv.2404.12272',
  },
  {
    schluessel: 'ulrich2016',
    kurz: 'Ulrich, 2016',
    voll: 'Ulrich, M. (2016). Addressing cascading failures. In B. Beyer, C. Jones, J. Petoff & N. R. Murphy (Hrsg.), <i>Site reliability engineering: How Google runs production systems</i>. O’Reilly Media. https://sre.google/sre-book/addressing-cascading-failures/',
  },
  {
    schluessel: 'weirauch2026c',
    kurz: 'Weirauch, 2026',
    voll: `Weirauch, J. (2026). <i>Referat Thema 1, Aufträge 1B und 1C</i> [Referatsausarbeitung: Entscheidungen, Berichte, Messdaten]. GitHub. ${GH_FORK}/main/docs/referat-thema-1`,
  },
  {
    schluessel: 'yang2025',
    kurz: 'Yang et al., 2025',
    voll: 'Yang, A., Li, A., Yang, B., Zhang, B., Hui, B., Zheng, B., Yu, B., Gao, C., Huang, C., Lv, C., Zheng, C., Liu, D., Zhou, F., Huang, F., Hu, F., Ge, H., Wei, H., Lin, H., Tang, J., … Qiu, Z. (2025). <i>Qwen3 technical report</i>. arXiv. https://doi.org/10.48550/arXiv.2505.09388',
  },
];

const NACH_SCHLUESSEL = new Map(LITERATUR.map((e) => [e.schluessel, e]));

/**
 * Ordnung zweier Kurzbelege „Autor, Jahr“: zuerst nach Erstautor, bei gleichem Erstautor das Werk allein vor zwei
 * Autor:innen vor „et al.“, dann nach Jahr samt Buchstabe (ZL S. 14; APA 7, 9.44 „one-author entries … precede
 * multiple-author entries“). Ein reiner Textvergleich stellte „Kwon & Li“ vor „Kwon, 2020“ (Review 2026-11-18).
 */
function teileKurz(kurz) {
  const [, autor, jahr] = kurz.match(/^(.*), (\d{4}[a-z]?)$/) ?? [null, kurz, ''];
  const etAl = autor.endsWith(' et al.');
  const [erst, zweit] = autor.replace(/ et al\.$/, '').split(' & ');
  return { erst, anzahl: etAl ? 3 : zweit ? 2 : 1, zweit: zweit ?? '', jahr };
}
function vergleicheKurz(a, b) {
  const x = teileKurz(a);
  const y = teileKurz(b);
  return (
    x.erst.localeCompare(y.erst, 'de') ||
    x.anzahl - y.anzahl ||
    x.zweit.localeCompare(y.zweit, 'de') ||
    x.jahr.localeCompare(y.jahr, 'de')
  );
}
/** Kurzbelege „Autor, Jahr“ in der Reihenfolge nach ZL; für Tests und Fußzeilen. */
export function sortiereKurz(liste) {
  return [...liste].sort(vergleicheKurz);
}

/**
 * Fußzeile „Quelle: …“ aus [Schlüssel, Stelle]-Paaren. Mehrere Werke alphabetisch nach Autor, gleiche Autorschaft
 * chronologisch (ZL S. 14), getrennt durch Semikolon; Reihenfolge der Tabellen ist damit egal (Prüfung 2026-11-18).
 */
export function quellenzeile(zitate) {
  return `Quelle: ${zitate
    .map(([k, stelle]) => ({ e: NACH_SCHLUESSEL.get(k) ?? kurzbeleg(k), stelle }))
    .sort((a, b) => vergleicheKurz(a.e.kurz, b.e.kurz))
    .map(({ e, stelle }) => `${e.kurz}${stelle ? `, ${stelle}` : ''}`)
    .join('; ')}`;
}

/** Kurzbeleg „(Autor, Jahr, Stelle)“; ohne Stelle nur, wenn das Werk als Ganzes gemeint ist. */
export function kurzbeleg(schluessel, stelle) {
  const e = NACH_SCHLUESSEL.get(schluessel);
  if (!e) throw new Error(`Literatur: ${schluessel} fehlt in LITERATUR`);
  return `(${e.kurz}${stelle ? `, ${stelle}` : ''})`;
}
