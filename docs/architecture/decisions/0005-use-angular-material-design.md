<!-- markdownlint-disable MD013 -->

# ADR-0005: UI-Styling-Strategie mit Angular Material 3

## Status

Accepted

## Datum

2026-02-25

## Kontext

Unsere Angular-Anwendung soll Material-3-konform umgesetzt werden, mit konsistentem Erscheinungsbild und klarer Governance fuer Styling-Entscheidungen.

Technisch ist eine Kombination aus Angular Material und Tailwind moeglich. In der Praxis fuehrt diese Kombination jedoch zu konkurrierenden Styling-Strategien:

- Angular Material mit `mat.theme`, System-Tokens und Override-APIs
- Utility-First-Klassen auf Komponentenebene

Das erhoeht das Risiko von:

- inkonsistenten Abstaenden und Layout-Rastern
- uneinheitlicher Typografie und Farbsemantik
- fragilen CSS-Overrides gegen interne Material-DOM-Strukturen
- steigendem Review- und Governance-Aufwand

## Entscheidung

Im gesamten Repository verwenden wir **kein Tailwind CSS**.

Verbindlich sind:

- Angular Material Komponenten als Default fuer interaktive UI
- Angular Material Theming auf Basis Material 3 (`mat.theme`)
- Design Tokens als zentrale Styling-Schnittstelle
- zentrale SCSS-Patterns fuer Layout und wiederkehrende UI-Muster

## Verbindliche Architekturregeln

### 1. Theme-Foundation

- Es gibt ein globales App-Theme auf Root-Ebene (`html`) mit `mat.theme(...)`.
- `mat.system-classes()` darf global aktiviert werden.
- Light/Dark-Unterstuetzung erfolgt ueber `color-scheme` und Theme-Tokens, nicht ueber parallele Farbpaletten pro Feature.

### 2. Token-Hierarchie

- **System Tokens:** `--mat-sys-*` bilden die technische Grundlage.
- **App-Semantik-Tokens:** projektspezifische Tokens (z. B. Erfolg/Warnung/Info) muessen auf System-Tokens mappen.
- **Komponentenspezifische Tokens:** Anpassungen an Material-Komponenten erfolgen ueber offizielle `overrides`-Mixins.

### 3. Override-Policy (hart)

- CSS-Overrides gegen interne Angular-Material-Klassen oder DOM-Strukturen sind in produktiver UI verboten.
- Anpassungen an Angular-Material-Komponenten erfolgen ausschliesslich ueber `mat.theme-overrides(...)` fuer System-Tokens oder `<component>-overrides(...)` fuer komponentenspezifische Token.
- Direkte Hex- oder RGB-Werte sind in Feature-Komponenten zu vermeiden; Farben kommen aus Tokens.

### 4. SCSS-Patterns und Layout

- Eigene SCSS-Schicht ist erlaubt und gewuenscht, aber nur fuer:
  - Layout-Primitives wie Stack, Cluster, Grid oder Inset
  - wiederkehrende Strukturmuster wie Page-Section oder Panel-Container
  - app-spezifische Nicht-Komponenten-Stylinglogik
- Spacing, Radius, Typografie und Elevation sollen tokenbasiert erfolgen.

### 5. Komponentenstrategie

- Neue UI-Funktionen nutzen zuerst Angular-Material-Komponenten.
- Eigenentwickelte Komponenten sind erlaubt, wenn Material-Funktionalitaet fachlich nicht ausreicht.
- Eigenkomponenten muessen dieselben Tokens (`--mat-sys-*` bzw. App-Semantik-Tokens) konsumieren.

## Durchsetzung und Governance

- Jede UI-PR muss folgende Checks bestehen:
  - kein Tailwind im Repository, inklusive neuer Klassen, Configs oder Utilities
  - keine fragilen Material-DOM-Overrides
  - neue Farben, Typo oder Shape nur ueber Tokenquellen
  - Light/Dark-Verhalten getestet
- Ausnahmen brauchen explizites Review und ein Ablaufdatum.
- Ausnahmen duerfen nicht als Praezedenzfall fuer produktive UI-Features gelten.

## Migration und Einfuehrung

1. Globales Theme und Systemklassen konsolidieren.
2. Bestehende Hotspot-Screens auf Token-Nutzung umstellen (Farben, Typo, Radius, Elevation).
3. Fragile CSS-Overrides schrittweise durch offizielle Override-APIs ersetzen.
4. SCSS-Pattern-Bibliothek fuer Layout standardisieren.

## Definition of Done (DoD) fuer UI-Umsetzung

Eine UI-Aenderung gilt erst als erledigt, wenn alle folgenden Punkte erfuellt sind:

- Keine Tailwind-Nutzung im Repository.
- Neue oder geaenderte UI verwendet Angular-Material-Komponenten als Standard oder dokumentierte Ausnahme.
- Farben, Typografie, Shape und Elevation werden ueber Tokens umgesetzt.
- Keine fragilen CSS-Overrides gegen interne Angular-Material-DOM-Strukturen.
- Material-Anpassungen erfolgen ueber `mat.theme-overrides(...)` oder `<component>-overrides(...)`.
- Light- und Dark-Darstellung wurde geprueft.
- Fokus-, Hover-, Disabled- und Error-Zustaende wurden geprueft.
- Aenderung ist in der UI-PR-Checkliste nachvollziehbar abgeprueft.
- Falls neue Token benoetigt wurden, sind sie in `docs/ui/TOKENS.md` dokumentiert.
- Falls eine Ausnahme erforderlich war, ist sie mit Scope, Dauer und Rueckbauplan dokumentiert.

## Konsequenzen

### Positiv

- Ein UI-System statt zwei paralleler Systeme
- Hoehere visuelle Konsistenz und bessere Wartbarkeit
- Klarere Review-Kriterien und geringeres Design-Drift-Risiko
- Bessere Upgrade-Faehigkeit bei Angular-Material-Updates

### Negativ

- Weniger Freiheit fuer schnelle Utility-basierte Experimente
- Initialer Aufwand fuer Token- und Pattern-Konsolidierung
- Team muss Pattern- und Token-Erweiterungen aktiv pflegen

## Ausnahmen

Ausnahmen sind nur nach explizitem Review erlaubt, z. B.:

- Prototyping oder Spikes ausserhalb produktiver Screens
- interne Entwickler-Tools ohne Designsystem-Relevanz

Jede Ausnahme muss dokumentiert sein (Scope, Dauer, Rueckbauplan).

### Dokumentierte Ausnahmen

| Scope | Dauer | Begruendung | Rueckbauplan |
| --- | --- | --- | --- |
| `apps/landing` (Astro) nutzt Tailwind | Offen | Separate Codebase, Marketing-Landing, kein Angular. Kein Konflikt mit `apps/frontend` Material-Theme. | Bei Bedarf auf eigenes Designsystem oder statische Styles umstellen. |
| `index.html` meta `theme-color` mit Hex-Werten | Dauerhaft | HTML-meta-Attribute unterstuetzen keine CSS-Variablen. Browser-Limitation. | Kein Rueckbau moeglich; Werte (`#f5f5f5` / `#1c1b1f`) orientieren sich an M3-Surface-Farben. |
| Home: `.mat-button-toggle`-Selektoren fuer transparente Theme- oder Preset-Toggles | Bis Override-API | Offizielle `mat.button-toggle-overrides()` decken transparenten Look (Playful/Dark) nicht zuverlaessig ab. Farben bleiben tokenbasiert. | Sobald Material-Override-API transparente Toggle-Gruppen unterstuetzt, auf Overrides umstellen und Selektoren entfernen. |

## Verwandte Dokumente

- `docs/architecture/decisions/0002-use-angular-signals-for-ui-state.md`
- `docs/ui/README.md`
- `docs/ui/STYLEGUIDE.md`
- `docs/ui/TOKENS.md`
- `docs/ui/PR-CHECKLIST-UI.md`
- Material Design 3: [m3.material.io](https://m3.material.io/)
- Angular Material Theming: [material.angular.dev/guide/theming](https://material.angular.dev/guide/theming)
- Angular Material Systemvariablen: [material.angular.dev/guide/system-variables](https://material.angular.dev/guide/system-variables)
