# Backend-Auswahl gegen alle zwölf Fragen

Der Versuch prüft am selben Datensatz zwei mögliche Ursachen für eine unvollständige Zusammenfassung: Welche Anliegen erreichen Qwen und wie gibt es die sichtbaren Fragen wieder? [Ergebnisse aller zehn Anfragen](ergebnisse.md)

## So funktioniert der Versuch

1. **Vor dem Lauf die Erwartungen festlegen.** Neun Beiträge wünschen sich eine Beispielrechnung zum Konfidenzintervall. Zwei betreffen die Abgabefrist, darunter ein ausdrücklicher Nachtrag der Lehrperson mit der verbindlichen Antwort. Ein Beitrag fragt nach Untertiteln und beschreibt eine Zugangshürde. Damit gibt es im gesamten Datensatz zwei offene Anliegen und einen bereits geklärten Sachverhalt. Alle Texte sind eigens für diesen Test geschrieben. [Fragen](fragen.json) · [Vorab festgelegte Prüfkriterien](versuchsplan.md)
2. **Zwei Eingaben aus denselben Quellen bilden.** Im Arm **Auswahl** ruft der Test die originale Kontextaufbereitung vom 6. November auf. Bei diesem kleinen Snapshot begrenzt sie die Auswahl auf drei Kandidaten. Alle Beiträge haben denselben Status und keine Stimmen, geschützte Themenquellen fehlen. Bei gleichem Rang entscheidet die Quellen-ID. So gelangen 01, 02 und 03 zum Modell. Im Arm **Alle** gehen 01–12 direkt in der festgelegten Reihenfolge an Qwen. Beide Eingaben enthalten je Beitrag ausschließlich Text und ID. [Implementierung](quellenauswahl.test.ts) · [Snapshot](rohdaten/snapshot.json) · [Auswahlergebnis](rohdaten/auswahl.json) · [Auswahlregeln am Stichtag](https://github.com/kqc-real/arsnova.eu/blob/1d71bd9583954d5304e3d56ee2cc716196190a65/apps/backend/src/lib/moderationSummaryContext.ts#L191-L250)
3. **Generierung konstant halten.** Beide Arme verwenden Qwen3-4B-Instruct-2507 Q4_K_M lokal auf der RX 9070 XT. Die beiden Systemnachrichten entsprechen dem November-Backend. Es fordert zwei bis vier belegte Aussagen über wiederkehrende offene Themen. Das JSON-Format, Temperatur 0, Seed 456 und das Ausgabelimit von 1.024 Token sind gleich. Nur die Liste der Texte und die zur Zitation erlaubten IDs ändern sich. Die Backend-Auswahl verwendet ihr vorhandenes Profil mit 640 reservierten Ausgabetoken. Für die tatsächlichen Modellanfragen prüft der Test unabhängig davon, dass Eingabe, 1.024 Ausgabetoken und 128 Token Reserve in das Fenster von 8.192 passen. [Request mit Auswahl](rohdaten/request-auswahl.json) · [Request mit allen Fragen](rohdaten/request-alle.json) · [Tokenvorprüfung](rohdaten/tokenvorpruefung.json)
4. **Lokal messen.** Je Arm gibt es ein Warm-up und vier gewertete Wiederholungen in wechselnder Reihenfolge. Vor jeder Anfrage wurde der Slot geleert. Die Uhr lief vom Absenden der lokalen HTTP-Anfrage bis zum Ende der Antwort. Die Backend-Auswahl, das Laden des Modells und die Hostansicht zählen nicht zur Dauer. [Messskript](messen.py) · [Umgebung](rohdaten/environment.json) · [GPU- und Testnachweis](rohdaten/pruefprotokoll.txt)
5. **Form und Inhalt getrennt prüfen.** Der Test prüft das Roh-JSON, das arsnova-Schema, die erlaubten Quellen-IDs und den Formfilter. Für die Inhaltsbewertung wurde jede unterschiedliche Aussage und jeder Handlungsvorschlag mit den tatsächlich zitierten Texten verglichen. Gleiche Rohtexte erhalten dieselbe inhaltliche Bewertung. [Formprüfungen](rohdaten/validierung.json) · [Inhaltsbewertung](inhaltsbewertung.json)
6. **Die Ursache einer Auslassung zuordnen.** Zuerst prüfen, ob der Quelltext überhaupt in der Modellanfrage stand. Dann prüfen, ob Qwen das Anliegen erwähnt und ob die Formulierung dessen offenen oder geklärten Stand bewahrt. Die Inhaltsbewertung ist eine vorläufige, KI-gestützte Einzelbewertung ohne unabhängige Zweitbewertung. [Bewertungstabelle](tabellen/quellentreue.csv)

## Selbst nachprüfen

Aus dem Verzeichnis `docs/didaktik/referate/2c-tokenbudget` im November-Forschungsworktree ausführen. Ohne GPU lassen sich die Prüfsummen, die Messwerttabellen und die Zuordnung des Inhaltsurteils zum exakten Wortlaut prüfen:

```bash
(cd direktvergleich && sha256sum --quiet -c SHA256SUMS)
ziel=$(mktemp -d)
python3 direktvergleich/auswerten.py direktvergleich/rohdaten "$ziel/tabellen" \
  --bewertung direktvergleich/inhaltsbewertung.json
diff -ru direktvergleich/tabellen "$ziel/tabellen"
```

Für neue Messungen auf demselben WSL-Rechner den vorbereiteten November-Export und das vorhandene GPU-Testverzeichnis verwenden. [Gemeinsame Einrichtung](../README.md#messungen-wiederholen). Zur Ersteinrichtung siehe [November-Versuch](../messreihe/versuch.sh) und [GPU-Einrichtung](../gpu-einrichten.md). Der Starter beziffert die Release-Revision und prüft die verwendeten Quelldateien. `pack` läuft ohne GPU. `measure` erstellt beide Requests erneut und benötigt den lokalen Modellserver, das Modell und Docker mit GPU-Zugriff. Beide Aufrufe verlangen einen neuen Zielordner und der Container läuft ohne externes Netz.

```bash
# GPU_DIR und STUDY_WORK zuvor gemäß der verlinkten Einrichtung setzen.
ziel=$(mktemp -d)
bash direktvergleich/starten.sh pack "$ziel/pack"
bash direktvergleich/starten.sh measure "$ziel/messung"
python3 direktvergleich/auswerten.py "$ziel/messung" "$ziel/tabellen"
```

Bei abweichendem Wortlaut die neuen Aussagen anhand des [Studienplans](versuchsplan.md) erneut beurteilen. Mit `--bewertung` akzeptiert die Auswertung die archivierten Urteile nur bei identischen Rohtexten.

Die Datei `rohdaten/design-sha256.json` enthält die Hashes der beim Lauf verwendeten Skripte. Die heutige Ablage verwendet andere Verzeichnispfade im Startskript und im Versuchsplan. Die archivierten Eingaben und Modellantworten behalten ihre ursprünglichen Hashes.
