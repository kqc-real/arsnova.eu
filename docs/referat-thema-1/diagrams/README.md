# Diagramme

Quellen und gerenderte Bilder der Diagramme in `docs/referat-thema-1/`. Zu jeder `<name>.mmd` (außer `palette.*.mmd`) gibt es eine `<name>.light.svg` und eine `<name>.dark.svg`; ein SVG nie von Hand bearbeiten.

| Datei                                   | Enthält                                                               |
| --------------------------------------- | --------------------------------------------------------------------- |
| `<name>.mmd`                            | das Diagramm (Mermaid)                                                |
| `palette.light.mmd`, `palette.dark.mmd` | die Farbklassen der Flussdiagramme                                    |
| `theme.light.json`, `theme.dark.json`   | Schriften, Grundfarben und `themeCSS` (Konfiguration für mermaid-cli) |
| `render.sh`                             | rendert die SVGs: `docs/referat-thema-1/diagrams/render.sh [NAME...]` |

## Klassen

Farbe kommt nur aus Klassen, nie aus `style`-Zeilen. Ein Flussdiagramm endet mit der Zeile `%% palette`; `render.sh` ersetzt sie durch die Palette.

| Klasse                        | Verwendung                                                   |
| ----------------------------- | ------------------------------------------------------------ |
| `host`, `hostGroup`           | Browser und Host-Oberfläche                                  |
| `app`, `appGroup`             | synchrone Arbeit auf dem App-Server                          |
| `contract`, `contractGroup`   | Hashes, Versionen, Schemas                                   |
| `queue`, `queueGroup`         | die prozessinterne Queue der Zusammenfassung                 |
| `runtime`, `runtimeGroup`     | Adapter, LLM-Client, llama-server                            |
| `store`, `storeGroup`         | PostgreSQL und Redis                                         |
| `decision`                    | Prüfungen und Verzweigungen                                  |
| `result`                      | das erfolgreiche Ergebnis                                    |
| `fallback`, `fallbackGroup`   | Fallback-Ergebnisse                                          |
| `emph`, `ok`, `fail`, `muted` | Kanten: Hauptpfad, Erfolg, Fehlerpfad, Nebenverbindungen     |
| `same`                        | Kanten: Ergebnis unverändert zurück                          |
| `dot`, `plain`                | Hilfen für Legenden: unsichtbare Ankerknoten und reiner Text |
| `legendGroup`                 | neutrale Rahmen: Legendenfelder und gemischte Bänder         |

Sequenzdiagramme verwenden `box rgba(...)` mit denselben Farbtönen. Keine Klammern in Box-Namen, weil Mermaid die Farbe sonst als Text liest. Notizen sind neutral (Theme); nur Ergebnisnotizen stehen in einem `rect`: grün (`rgba(22, 163, 74, 0.16)`) für die Modell-Zusammenfassung, rot (`rgba(225, 29, 72, 0.14)`) für jedes Fallback-Ergebnis, extraktiv wie regelbasiert. A2 (`1c-context-path-sequence`) setzt nur die Fallback-Notizen in ein `rect`, die Notiz der Modell-Zusammenfassung bleibt neutral. Eine Ergebnisnotiz spannt zwei benachbarte Teilnehmer (`Note over A,Q` bzw. `Note over P,Q`), damit die Flächen gleich breit sind. `theme.dark.json` hebt genau diese zwei Farben über `themeCSS` an; eine neue `rect`-Farbe braucht dort eine eigene Regel.

Hinweise zum Layout:

- Mermaid zentriert Subgraph-Titel, deshalb kreuzt eine Kante, die mittig in ein Band läuft, den Titel. Angehängte (oder vorangestellte) `⠀` (U+2800, leer in der Render-Schrift) verschieben einen Titel nach links (oder rechts).
- Einen Knoten, der zu einem Band gehört, in diesen Subgraph setzen und Grenzen (etwa den entfernten Host) verschachteln, statt lose Knoten neben ein Band zu legen; dagre lässt lose Cluster überlappen.
- `1c-contract-layers` verwendet `layout: elk`, die übrigen das Standardlayout. Gleich lange Titel (mit `⠀` aufgefüllt) geben den Bändern gleiche Breite; ELK versetzt sie trotzdem seitlich. `nodePlacementStrategy: SIMPLE` richtet sie bündig aus, führt die Kanten aber in Umwegen. Die rot gestrichelten Kanten „Form verfehlt“ und „Client-safeParse scheitert“ knicken kurz vor „invalid_response“ zur Seite; `mergeEdges` und die übrigen Strategien (NETWORK_SIMPLEX, LINEAR_SEGMENTS) verschlechtern das Layout.
- Für eine Feinstufe unter einem `⠀` (etwa 10–12 px) hilft ein schmales Leerzeichen (U+2009, etwa 5 px) zwischen zwei `⠀`. Das gilt für die Schrift im Browser; mermaid-cli misst U+2009 breiter als ein `⠀`. Kastenbreiten in Legenden deshalb nur mit `⠀` angleichen, U+2009 nur für Textanfänge (etwa die Linien-Texte der Legenden, die gleich lang sein müssen, damit sie bündig beginnen).
- Abb. 1 verwendet `curve: bumpY`, damit die Pfeile von oben statt schräg von der Seite auf »Anzeige« treffen; sie laufen dabei leicht nach innen und enden auf den oberen Ecken des Kastens. Die übrigen Flussdiagramme verwenden `curve: basis`.
- In Abb. 1 steht das Band »Job nach der Inferenz« etwa 5 px links der übrigen Bänder (≈ 0,7 mm im Druck). Weder ein kürzerer Titel noch ein Rechteck statt des Sechsecks ändert das; ein Fix in Mermaid ist nicht bekannt.
- Im `look: neo` macht Mermaid jedes Sechseck fest 70 px höher als seinen Text; `flowchart.padding` und `h:` in Shape-Daten ändern daran nichts. Sechsecke (etwa »Erneut aufbauen und prüfen« in Abb. 1) haben deshalb viel Leerraum, und eine Legendenzeile mit Sechseck ist höher als die anderen. `look: classic` vermeidet das, kostet aber den neo-Stil des ganzen Satzes.
- `themeCSS` macht Kantenbeschriftungen deckend (`.edgeLabel rect`), nimmt den Sequenz-Boxen und Ergebnisflächen Rand und Schatten (`g rect.rect` mit `!important`, weil Mermaids eigene Regel spezifischer ist) und färbt die offene Pfeilspitze asynchroner Nachrichten (`filled-head`) wie die Linie.
- Kantenbeschriftungen brechen bei etwa 200 px um (fest in mermaid-cli); lange Beschriftungen mit `<br/>` von Hand umbrechen.
- In Sequenzdiagrammen mit `par` lässt `mirrorActors: false` die Lebenslinien zu früh enden; nur Abb. 2 nutzt es. Die Lebenslinien ragen etwa 10 px unter die farbigen Boxen; das lässt sich in Mermaid nicht abstellen.
- `actorFontSize`, `messageFontSize` und `noteFontSize` wirken mit dieser mermaid-cli nicht; Sequenzdiagramme rendern mit 16 px.
- Guards (`[...]`) in `alt`-Fragmenten haben keinen Text-Halo, Lebenslinien laufen durch sie: `themeCSS` gilt für alle Sequenzdiagramme, und eine Halo-Farbe passt nicht zu jedem Untergrund.

## Rendern und prüfen

1. Rendern: `docs/referat-thema-1/diagrams/render.sh <name>`. Das Skript startet ein gepinntes mermaid-cli in Podman ohne Netzzugang (`DIAGRAMS_ENGINE=docker` für Docker).
2. Prüfen: `grep -l "Syntax error" docs/referat-thema-1/diagrams/*.svg` darf nichts ausgeben.
3. Jedes SVG im Browser ansehen, auf heller und auf dunkler Seite. Jede Beschriftung muss in ihre Box passen, keine Kante darf einen Titel kreuzen, und jeder Pfeil muss in die richtige Richtung zeigen.
4. Die `.mmd` und beide SVGs zusammen committen.
