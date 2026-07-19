<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# PDF/UA-1-Prüfprotokoll · Session-Ergebnisbericht

**Projekt:** arsnova.eu  
**Datum:** 2026-07-19  
**Prüfgegenstand:** barrierefreies Profil des Session-Ergebnisberichts  
**Normprofil:** PDF/UA-1, ISO 14289-1:2014  
**Validator:** veraPDF 1.30.2, Container `verapdf/cli:v1.30.2`  
**Container-Digest:** `sha256:d5ee329657cf9bc4b2400392dd54c7d0a0ce9980ff6fa2da5590eebeec007cdb`

## 1. Zweck und Abgrenzung

Dieses Protokoll dokumentiert den maschinellen PDF/UA-1-Nachweis und eine
repräsentative visuelle sowie strukturelle Prüfung der Session-Ergebnisberichte.
Es ergänzt den WCAG-2.2-AA-Audit und ersetzt keine Bedienprüfung mit einem
PDF-Reader und Screenreader.

Geprüft wurde das Profil „Barrierefrei (PDF/UA-1)“. Das visuell aufwendigere
Standardprofil erhebt bewusst keinen PDF/UA-Anspruch.

## 2. Reproduzierbarer Befehl

```bash
npm run validate:pdfua
```

Der Befehl validiert die fünf committed Demo-Dateien unter
`apps/frontend/src/assets/demo/` mit dem fest versionierten veraPDF-Container.
Der vollständige Textbericht wird nach
`tmp/pdfua-validation/verapdf-ua1.txt` geschrieben. In CI wird er als Artefakt
`verapdf-ua1-report` aufbewahrt.

Neue Demo-PDFs werden mit folgenden Befehlen erzeugt:

```bash
npm run build -w @arsnova/session-export-report
PDF_PROFILE=pdfua DEMO_PDF_LOCALES=de,en,fr,es,it \
  npm run generate:session-pdf-demo -w @arsnova/frontend
```

## 3. veraPDF-Ergebnis

| Locale | Datei                                  | Seiten | veraPDF PDF/UA-1 |
| ------ | -------------------------------------- | ------ | ---------------- |
| de     | `demo-session-results-30.de-pdfua.pdf` | 19     | PASS             |
| en     | `demo-session-results-30.en-pdfua.pdf` | 19     | PASS             |
| fr     | `demo-session-results-30.fr-pdfua.pdf` | 20     | PASS             |
| es     | `demo-session-results-30.es-pdfua.pdf` | 19     | PASS             |
| it     | `demo-session-results-30.it-pdfua.pdf` | 19     | PASS             |

Zusätzlicher Poppler-Nachweis für alle fünf Dateien:

- `Tagged: yes`;
- `Suspects: no`;
- `Metadata Stream: yes`;
- A4-Seitenformat.

## 4. Gefundener und behobener Defekt

Der erste veraPDF-Lauf bestand für `de`, `en`, `es` und `it`, aber nicht für
`fr`. Der französische Bericht verletzte:

- ISO 14289-1, 7.21.4.1: verwendete Fontprogramme müssen eingebettet sein;
- ISO 14289-1, 7.21.7: verwendete Zeichencodes müssen auf Unicode abbildbar
  sein.

Betroffen war ausschließlich ein mit `pdf-lib` nachträglich gezeichneter
Fortsetzungsstempel auf Seite 7. Die Standardfonts `Helvetica-Bold` und
`Symbol` wurden nicht eingebettet; das π-Zeichen des Fragetitels besaß dort
keine gültige Unicode-Abbildung.

Der Stempel ist als `Artifact` markiert und gehört nicht zur zugänglichen
Lesereihenfolge. Im PDF/UA-Profil wird er deshalb nicht mehr nachträglich
gezeichnet. Das Standardprofil behält ihn bei. Ein Integrationstest verhindert,
dass das PDF/UA-Profil erneut nicht eingebettete Standardfonts hinzufügt.

**UX-Auswirkung:** Auf einer französischen Fortsetzungsseite beginnt der
sichtbare Inhalt jetzt direkt mit „Répartition des estimations“, ohne
zusätzliche Frage-Nummer im oberen Seitenrand. Die eigentliche
Dokumentreihenfolge und der semantische Fragenkontext bleiben erhalten. Eine
spätere Wiedereinführung wäre nur mit vollständig eingebettetem Unicode-Font
zulässig.

## 5. Strukturelle Stichprobe

`pdfinfo -struct-text` ergab in allen fünf Locale-Dateien dieselbe
Grundstruktur:

| Struktur                    | Anzahl je Datei |
| --------------------------- | --------------- |
| `H1`                        | 1               |
| `H2`                        | 9               |
| `H3`                        | 32              |
| `Figure` mit Alternativtext | 3               |
| `Link`                      | 22              |
| `Table`                     | 4               |

Manuell nachvollzogen wurden:

- Dokumentwurzel und genau eine Hauptüberschrift;
- Abschnitts- und Fragenüberschriften in Dokumentreihenfolge;
- interne Inhalts- und Fragenlinks;
- Alternativtexte für die drei inhaltlichen Bilder;
- Tabellen für Teamwertung, Lernprofil und Bonus-Codes;
- Dokumenttitel, Dokument- und Inhaltssprache;
- sichtbare Seitentexte in der logischen Reihenfolge.

## 6. Visuelle Stichprobe

Mit Poppler wurden pro Locale drei repräsentative Seiten gerendert:

1. Titelseite;
2. Frage-/Ergebnisseite einschließlich Bild und Antwortverteilung;
3. letzte Seite mit Lernprofil und Bonus-Code-Tabellen.

In den 15 geprüften Renderings gab es keine abgeschnittenen Texte,
Überlagerungen, schwarzen Ersatzzeichen, unleserlichen Glyphen oder
Tabellenüberläufe. Die Übersetzungen, Datumsformate und Dezimaltrennzeichen
entsprachen der jeweiligen Locale.

## 7. Noch offene manuelle Nachweise

Für eine vollständige praktische Freigabe bleiben:

- Navigation und Lesereihenfolge mit VoiceOver in Vorschau oder Acrobat;
- Navigation und Lesereihenfolge mit NVDA in Acrobat Reader unter Windows;
- Linkaktivierung, Tabellenansage und Bildalternativen in mindestens einer
  dieser Kombinationen;
- optionaler Gegencheck mit PAC unter Windows.

Diese Punkte betreffen Reader-/Screenreader-Interoperabilität. Der
dateiformale PDF/UA-1-Nachweis durch veraPDF ist für alle fünf Locale-Demos
erbracht.
