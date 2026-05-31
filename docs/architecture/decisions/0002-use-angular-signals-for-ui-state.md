<!-- markdownlint-disable MD013 -->

# ADR-0002: Nutzung von Angular Signals für UI-State

**Status:** Accepted
**Datum:** 2026-02-18
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-05-31

## Kontext

Angular bietet mehrere Möglichkeiten zur Zustandsverwaltung: RxJS (`BehaviorSubject`), NgRx Store, oder die seit Angular 16 verfügbaren **Signals**. Wir müssen festlegen, welcher Ansatz für den UI-State im Frontend verbindlich ist.

## Entscheidung

Für den **UI-State** (reaktive Werte, die an Templates gebunden werden) verwenden wir **ausschließlich Angular Signals** (`signal()`, `computed()`, `effect()`).

RxJS (`Observable`, `Subject`) bleibt erlaubt, aber **nur** für:

- WebSocket-Streams (tRPC Subscriptions)
- Komplexe asynchrone Pipelines (Debouncing, Throttling, Merging)

**Verboten:** `BehaviorSubject` oder `ReplaySubject` als State-Container für UI-Daten.

## Repo-Abgleich 2026-05-31

Der aktuelle Angular-Code nutzt `signal()`, `computed()` und `effect()` breit fuer Komponenten- und UI-State. RxJS-`Subject` kommt weiterhin punktuell fuer erlaubte Ereignis- und Lifecycle-Pfade vor, z. B. Destroy-Signale, passive Refresh-Trigger oder Testdoubles. Es wurde kein produktiver `BehaviorSubject`-/`ReplaySubject`-basierter UI-State-Store im App-Code gefunden.

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
