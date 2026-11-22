# Abgabe Referat Thema 1 (Jonas und Niklas)

Gemeinsame Abgabe, ohne Sprechnotizen. Die Handouts enthalten Name und Matrikelnummer (Abgabefassung). Zum Öffnen:

| Datei                                        | Inhalt                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| [`folien-gesamt.html`](./folien-gesamt.html) | Gemeinsames Deck zum Präsentieren im Browser (offline)                      |
| [`folien-gesamt.pdf`](./folien-gesamt.pdf)   | Gemeinsames Deck als PDF                                                    |
| [`folien-jonas.pdf`](./folien-jonas.pdf)     | Teil Jonas (1C, 1B Schritte 1–2) mit Rahmen                                 |
| [`folien-niklas.pdf`](./folien-niklas.pdf)   | Teil Niklas (1A, 1B Schritte 3–4) mit Rahmen                                |
| [`handout-jonas.pdf`](./handout-jonas.pdf)   | Handout Jonas (1C, 1B Schritte 1–2), gebaut in PaperLab (`paperlab final`)  |
| [`handout-niklas.pdf`](./handout-niklas.pdf) | Handout Niklas (1A, 1B Schritte 3–4), gebaut in PaperLab (`paperlab final`) |

[`manifest.json`](./manifest.json) hält Prüfsummen, Seitenzahlen und Eingaben des Baus fest.

Die Fassungen mit Notizen (`folien-gesamt-mit-notizen.html`, `notizen-heft-*.html`,
`notizen-karten-*.pdf`, `notizen-*.md`) entstehen nur im privaten Repo unter
`privat/ausgabe/`.

## Bauen

```bash
node docs/referat-thema-1/abgabe/bau/bau.mjs
node --test docs/referat-thema-1/abgabe/bau/*.test.mjs
```

Quellen, Tests und Einzelheiten: [`bau/README.md`](./bau/README.md) (Deck, Handout-Zahlen)
und [`bau/README-1a-1b34.md`](./bau/README-1a-1b34.md) (Folien 1A und 1B Schritte 3–4).

Der frühere eigenständige 1A-Entwurf liegt in [`../1A/archiv/entwurf/`](../1A/archiv/entwurf/).
