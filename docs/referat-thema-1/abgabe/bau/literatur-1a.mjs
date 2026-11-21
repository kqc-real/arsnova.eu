// Literatur für Niklas' Teil (1A, 1B Schritte 3–4). Seit der Durchsicht 2026-11-18 gibt es ein gemeinsames
// Verzeichnis für das ganze Deck (abgabe/bau/literatur.mjs, nach ZL geprüft). Hier steht nur noch, welche
// Einträge Niklas zitiert; dieselben Schlüssel nutzt sein Handout in PaperLab (main.bib).

import { LITERATUR, kurzbeleg, quellenzeile } from './literatur.mjs';

export { quellenzeile };

const SCHLUESSEL_1A = [
  'arsnova2026adr0035',
  'arsnova2026pruefung',
  'dean2013',
  'heo2024',
  'nosek2018',
  'papadopoulos2021',
  'schneider2026',
  'ulrich2016',
  // Jonas' Messung (Inferenzdauer im Labor, N10)
  'weirauch2026c',
];

/** Einträge, die Niklas zitiert, in der Reihenfolge des gemeinsamen Verzeichnisses. */
export const LITERATUR_1A = LITERATUR.filter((e) => SCHLUESSEL_1A.includes(e.schluessel));
if (LITERATUR_1A.length !== SCHLUESSEL_1A.length)
  throw new Error('literatur-1a: Schlüssel fehlt im gemeinsamen Verzeichnis');

/** Kurzbeleg „(Autor, Jahr, Stelle)“ aus dem gemeinsamen Verzeichnis. */
export const kurzbeleg1A = kurzbeleg;
