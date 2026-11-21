# Änderungen nach der gemeinsamen Durchsicht (18.11.2026)

Jonas und Niklas haben das gemeinsame Deck durchgesehen. Dieses Dokument hält
fest, was sich ändert und warum. Es ergänzt die
[Gesamtpräsentation](2026-11-16-gesamtpraesentation-design.md); alle Regeln
von dort gelten weiter: Stage 1920 × 1080, Inter und IBM Plex Mono,
Quellenfußzeile auf jeder Folie, Layouttests in `deck.test.mjs`,
Animationen nur per Klick oder Taste, `prefers-reduced-motion`, eine
HTML-Datei offline, jede Zahl mit Quelle aus Protokoll oder ADR.
Sprechnotizen liegen nur in `privat/notizen.mjs`.

## Ziel

Das Publikum soll Titel, Struktur und Belege ohne Rätselraten lesen können.
Auslöser waren Stellen, an denen selbst wir beim Durchsehen nicht sofort
wussten, was gemeint ist: der 1B-Chip mit losem „Schritte 1–2“, die drei
Konfigurationsstände auf Folie 14, die überlagerten Punkte auf Folie 32 und
die gequetschte Endfolie.

**Nicht-Ziele:** keine neuen Messungen, keine neuen Zahlen ohne Quelle,
keine Änderung an Produktionscode oder eingefrorenen Protokollen.

## Entscheidungen

### 1. Titelfolie (GT), Entwurf A

- Über dem Titel steht klein in Großbuchstaben „Thema 1 · Cloud Computing“.
- H1 ist nur noch „KI-Inferenz im Moderationskompass“, 96 px, Gewicht 800,
  zweizeilig („KI-Inferenz im“ / „Moderationskompass“).
- Untertitel, die Namen (44 px) und die Spalten bleiben wie bisher.
- Die Kursdaten stehen in einer Zeile: Kurs, Hochschule, Prüfer, Datum.
- Ein Entwurfsbild wurde in der Sitzung gerendert. Maßgeblich ist die
  Beschreibung hier.

### 2. 1B-Chip, global

- Wo 1B mit Schritten vorkommt, ist das **ein** Bernstein-Chip:
  „1B **Schritte 1–2**“, die Schritte etwas kleiner (20 px, 600) im selben
  Chip.
- Das gilt auf der Titelfolie, auf Folie G0 und überall sonst als HTML-Chip
  im Deck.
- In SVG-Grafiken (GK: „1B 1–2“, „1B 3–4“) bleibt die Kurzform, aber im
  selben Chip-Stil wie heute.
- Die Wegkarte oben rechts ist Navigation, kein Chip. Ihre Tabs bleiben als
  Text („1B 1–2“).
- _Entscheidung des Agenten:_ Navigation und Grafik bleiben bei der
  Kurzform, weil der volle Text dort nicht passt.

### 3. Folie G0 (Eine Leitfrage, vier Teile)

- Spalte 4 „Gemeinsam“: statt „alle Aufträge“ stehen die Chips 1A, 1B und
  1C, ohne Schritte.
- Der Text darunter wird zu „Fazit: Antwort auf die Leitfrage“.
- Spalten 2 und 3 nutzen den neuen 1B-Chip.

### 4. Folie GK (arsnova.eu)

- Titel: „arsnova.eu im Überblick“.
- Untertitel wörtlich: „Open-Source-Live-App (MIT) für den Hörsaal mit
  Live-Interaktion in der Lehre, ohne Pflichtkonten, KI nur als Zusatz.“
- Grafik: Der bisherige Kasten „Hörsaal … Lehrperson“ wird zu zwei Kästen:
  - „Hörsaal (+Lehrperson)“ mit „≥ 500 Clients zugleich, auch hinter einem
    gemeinsamen NAT“, Pfeil auf **Live-App**;
  - „Lehrperson“, Pfeil auf **Moderationskompass**.
- Alles andere in der Grafik bleibt.

### 5. Folie J2 (Zwei Hosts nachgebaut)

- Der Kasten „Abweichungen und Grenzen“ wird eine Tabelle mit vier Spalten.
  Zeilen und Werte stehen fest; alle Werte sind schon in `folien.mjs` mit
  Quelle vorhanden:

  |                  | Release 1.3 (Tag) | v1.4.0 ab Werk (gemessener Code) | Labor 1B (zwei VMs) | Labor 1C (ein Rechner) |
  | ---------------- | ----------------- | -------------------------------- | ------------------- | ---------------------- |
  | CPUs/Threads     | 4                 | 8                                | **4**               | **4**                  |
  | Speicher Runtime | 5 GiB             | 8 GiB                            | 8 GiB               | **5 GiB**              |
  | Summary-Timeout  | 8 s               | 90 s                             | **300 s**           | **300 s**              |

- Fett ist, was vom gemessenen Code abweicht.
- Darunter steht eine Zeile mit dem Rest: Images selbst gebaut,
  Summary-Schalter an, 1C über Loopback mit Messproxy, Kalibrierung 202 s
  (1B).
- _Entscheidung des Agenten:_ Ob die Tabelle neben der Host-Grafik passt
  oder die Grafik schmaler werden muss, entscheidet der Layouttest. Lesbar
  sein muss die Tabelle.

### 6. Folie J4 (Erst die Hypothese, dann die Messung)

- Der Kasten „1C Abweichungen und Grenzen im Labor“ entfällt; der Inhalt
  steht jetzt in der Tabelle auf J2.
- Die Hypothesen-Tabelle (H_B1–H_B3) bekommt den Platz.
- 1A kommt **nicht** in diese Tabelle.

### 7. Folie N4 (Niklas, „Die Regel stand eine Woche vorher fest“)

- H1 und H2 werden ausgeschrieben, nach dem 1A-Versuchsvertrag:
  - H1: spaCy im Normalbetrieb (V2) hält gegenüber V1 die p95- und
    Fehlergrenzen der Live-Aktionen;
  - H2: das gilt auch bei CPU-Drosselung (V3) und verzögerten Antworten
    (V4).
- Die beiden Zeilen gehören an den Regelkasten.
- Quelle: `1A-experiment-contract.md`.

### 8. Folie M1 (Niklas, Ersatzzeit je Störung)

- Hinter jedem Zeilennamen steht n je Consumer, aus den Daten berechnet und
  nicht fest eingetragen: „Summary n = 10 · Label n = 30“, bei nur einem
  Consumer nur der eine.
- Unter der Achse steht die Lesehilfe: „Jeder Punkt ein Auftrag; gleiche
  Zeiten liegen übereinander.“
- Die Grafik selbst bleibt (kein Jitter).
- Die Notizen erklären die Zählung (114 Aufträge in dieser Grafik).

### 9. Neue Folie „Nachweisumfang: Rechnerzeit, Tests, Hypothesen“

- Sie wird aus R17 gebaut, steht zwischen G9 und GD und wird gezeigt.
- Inhalt:
  - die fünf Kennzahlen (gewertete Laborzeit, Aufbau/Tests/weitere Läufe,
    automatisierte Tests, ADRs, Hypothesen);
  - das Balkendiagramm Rechnerzeit je Auftrag (bisher auf GD);
  - die Aufschlüsselung von R17, gekürzt auf das, was neben Diagramm und
    Kennzahlen noch Information trägt.
- R17 entfällt als eigene Reserve. Alle Zahlen bleiben aus
  `nachweisumfang.mjs`.
- Sprecher: Jonas, etwa 20 s. Das Fazit wird höchstens minimal gekürzt.
  Der Hauptteil endet dann bei etwa 29:20 statt 29:00.

### 10. Endfolie (GD)

- Titel „Danke. Wir freuen uns auf Ihre Fragen.“ in derselben Größe und
  demselben Gewicht wie der H1 der Titelfolie (96 px, 800), zweizeilig wenn
  nötig.
- Darunter: „Alle Belege zum Nachprüfen“ und der Satz zu den Belegen.
- Dann der neue Satz: „Gemeinsam entwickelt im Fork von Niklas Schneider;
  der Fork von Jonas Weirauch ist auf denselben Stand synchronisiert.“
- Danach Link, Namen und QR-Code.
- Kennzahlen und Diagramm entfallen hier (siehe 9).

### 11. Ein Literaturverzeichnis

- Die beiden Verzeichnisse (J16 und NL „Literaturverzeichnis 1A“) werden zu
  einem gemeinsamen Verzeichnis auf zwei Folien:
  - „Literaturverzeichnis (1/2)“ und „(2/2)“;
  - alphabetisch fortlaufend;
  - alle im Deck zitierten Quellen, also auch Heo, Nosek, Schneider, Kwon,
    Shankar, Yang und NIST (Mell & Grance).
- Jeder Eintrag und jeder Kurzbeleg wird gegen APA 7 und
  `~/Documents/Code/PaperLab/docs/guidelines/IU_Source_of_Truth.md` geprüft:
  - Sortierung, `&`, Hrsg., Datumsformat, DOI/URL-Form, kursive Teile;
  - Kurzbelege auf den Folien (Seiten- oder Abschnittsangabe).
- Es gibt nur noch eine Quelle der Wahrheit für die Einträge. Die beiden
  Module `literatur.mjs` und `literatur-1a.mjs` werden zusammengeführt oder
  eines liest das andere.
- **Vorrang:** Wo APA 7 und der IU-Leitfaden sich widersprechen, gilt der
  IU-Leitfaden (deutschsprachig: kein Komma vor „&“, „Hrsg.“, deutsches
  Datum). _Entscheidung des Agenten,_ gestützt auf „nach IU-Vorgaben“.
- **Fundstelle im Kurzbeleg:** Pflicht nur, wo der IU-Leitfaden sie
  verlangt. Ein Beleg auf ein Werk als Ganzes bleibt ohne Stelle erlaubt.
  _Entscheidung des Agenten._
- **Handouts:** Sie bleiben je Person mit eigener `main.bib` in PaperLab.
  - Der Abgleichtest prüft nur noch, ob jeder Eintrag des Decks mit dem
    gleichnamigen Eintrag in einer der beiden `.bib` übereinstimmt.
  - Korrekturen aus der Prüfung gehen in beide `.bib`; das PaperLab-Repo
    wird dafür geändert.
- **Abgabe-PDFs:** Beide (`jonas-folien.pdf`, `niklas-folien.pdf`) enden mit
  den zwei gemeinsamen Literaturfolien, wie im Deck.
- Ein Test prüft:
  - jeder Kurzbeleg im Deck hat genau einen Eintrag;
  - jeder Eintrag wird zitiert;
  - die Sortierung stimmt.

## Folgen für Notizen, Hefte und Zeiten

- Für jede geänderte Folie werden Sprechnotiz, Stichpunkte und Heftseite in
  `privat/` angepasst. Das gilt auch für die neue Folie, damit keine
  Heftseite verwaist.
- Zeiten und „bis hier“-Angaben werden aus der Folge neu berechnet.
- Die Übergänge zwischen G9, Nachweisumfang und GD werden neu geschrieben.
- Handout und Abgabe-PDFs werden neu gebaut.
- Folien, die die Literaturfolien oder R17 per ID erwarten (Tests, Wegkarte,
  Reserve-Liste), werden mitgezogen.

## Prüfung

- Alle bestehenden Tests sind grün, mit und ohne `privat/`.
- Neue Tests für den 1B-Chip, die Tabelle auf J2, das n auf M1, die
  Nachweisumfang-Folie und das gemeinsame Literaturverzeichnis.
- Jede geänderte Folie wird gerendert und angesehen, in der Endstufe und den
  Zwischenstufen.

## Offen für den Bauenden

- Exakte Abstände und Spaltenbreiten innerhalb der Layoutregeln.
- Wie R17 gekürzt wird, solange keine Zahl ohne Quelle entsteht und die
  Folie lesbar bleibt.
