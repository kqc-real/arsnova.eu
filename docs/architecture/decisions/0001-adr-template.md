<!-- markdownlint-disable MD013 -->

# ADR-0001: ADR-Template & Konventionen

**Status:** Accepted
**Datum:** 2026-02-18
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-05-31

## Kontext

Wir benötigen ein einheitliches Format für Architecture Decision Records (ADRs), damit alle Architekturentscheidungen nachvollziehbar und konsistent dokumentiert werden.

## Entscheidung

Jede ADR folgt diesem Template:

```markdown
# ADR-NNNN: [Titel der Entscheidung]

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXXX
**Datum:** YYYY-MM-DD
**Entscheider:** [Wer hat entschieden?]
**Letzter Repo-Abgleich:** YYYY-MM-DD

## Kontext

[Warum stehen wir vor dieser Entscheidung? Was ist das Problem?]

## Entscheidung

[Was wurde entschieden?]

## Konsequenzen

### Positiv

- ...

### Negativ / Risiken

- ...

## Alternativen (geprüft)

- [Alternative A]: [Warum verworfen?]
- [Alternative B]: [Warum verworfen?]
```

### Namenskonvention

- Dateiname: `NNNN-kebab-case-titel.md` (4-stellige Nummer, aufsteigend)
- Ordner: `docs/architecture/decisions/`
- Statuswechsel wie `Superseded by ADR-XXXX` bleiben in der alten ADR sichtbar; die abloesende ADR wird verlinkt.
- Bei spaeterem Code-Drift wird ein kurzer Repo-Abgleich oder Implementierungsstand ergaenzt, statt historische Entscheidungsgruende umzuschreiben.

## Konsequenzen

### Positiv

- Einheitliche, durchsuchbare Dokumentation aller Architekturentscheidungen
- Neue Teammitglieder können Entscheidungen nachvollziehen
- Git-History zeigt die Entwicklung der Architektur

### Negativ / Risiken

- Overhead: Jede Entscheidung muss dokumentiert werden (bewusst akzeptiert)
