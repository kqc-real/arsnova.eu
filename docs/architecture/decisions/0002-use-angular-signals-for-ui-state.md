<!-- markdownlint-disable MD013 -->

# ADR-0002: Nutzung von Angular Signals für UI-State

**Status:** Accepted
**Datum:** 2026-02-18
**Entscheider:** Projektteam

## Kontext

Angular bietet mehrere Möglichkeiten zur Zustandsverwaltung: RxJS (`BehaviorSubject`), NgRx Store, oder die seit Angular 16 verfügbaren **Signals**. Wir müssen festlegen, welcher Ansatz für den UI-State im Frontend verbindlich ist.

## Entscheidung

Für den **UI-State** (reaktive Werte, die an Templates gebunden werden) verwenden wir **ausschließlich Angular Signals** (`signal()`, `computed()`, `effect()`).

RxJS (`Observable`, `Subject`) bleibt erlaubt, aber **nur** für:

- WebSocket-Streams (tRPC Subscriptions)
- Komplexe asynchrone Pipelines (Debouncing, Throttling, Merging)

**Verboten:** `BehaviorSubject` oder `ReplaySubject` als State-Container für UI-Daten.

## Konsequenzen

### Positiv

- Einfacheres mentales Modell (kein `subscribe()`/`unsubscribe()` für UI-State)
- Bessere Performance durch granulare Change Detection
- Zukunftssicher – Signals werden Angulars primärer Reaktivitäts-Mechanismus

### Negativ / Risiken

- Studenten mit RxJS-Erfahrung müssen sich umgewöhnen
- Signals sind noch relativ neu; manche Patterns sind noch im Aufbau

## Alternativen (geprüft)

- **NgRx Store:** Zu viel Boilerplate für dieses Projekt
- **RxJS BehaviorSubject:** Funktioniert, aber Memory-Leak-Risiko bei vergessenen Unsubscriptions
