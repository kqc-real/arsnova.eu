<!-- markdownlint-disable MD013 -->

# ADR-0020: Einheitliche Exit-Strategie fuer beendete, geloeschte oder abgelaufene Session-Pfade

**Status:** Accepted  
**Datum:** 2026-04-06  
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-05-31

## Kontext

Mit `ADR-0009` wurde die einheitliche Live-Session-Struktur fuer Quiz, Q&A und Blitzlicht festgelegt. In der praktischen Nutzung zeigte sich jedoch eine Inkonsistenz bei Session-Pfaden, deren fachlicher Kontext nicht mehr gueltig ist:

1. **Beendete Session:** Eine laufende Session kann serverseitig auf `FINISHED` wechseln, waehrend Nutzer:innen noch auf `host`, `present`, `vote` oder `join` sind.
2. **Verwaiste Session:** Eine Session kann geloescht worden sein, obwohl die Route noch im Browser offen ist.
3. **Abgelaufene Blitzlicht-Runde:** Ein Standalone-Blitzlicht kann nicht mehr verfuegbar sein, waehrend die Vote-Seite noch offen ist.
4. **Inkonsistente Rueckwege:** Manche Views navigierten direkt zur Startseite, andere zeigten nur einen Fehlertext und verliessen sich auf die globale Toolbar.
5. **Fehlerzustand konnte ueberschrieben werden:** In einzelnen Views liefen Polling- oder Live-Refreshes weiter und ersetzten den bereits erkannten Fehlerzustand wieder durch nachgelagerte Platzhaltertexte.

Das fuehrt zu einem UX- und Robustheitsproblem: Sobald der aktuelle Session-Pfad keinen gueltigen fachlichen Fortsetzungsweg mehr hat, braucht die Person einen **eindeutigen und sofort erkennbaren Ausweg zur Startseite**, ohne an einem alten Session-Code in der URL haengen zu bleiben.

## Entscheidung

### 1. Aktive Session-Views leiten bei eindeutigem Endzustand automatisch nach Home weiter

Views, die bereits **in einer laufenden Session** sind und deren Session-Kontext serverseitig eindeutig beendet ist, navigieren automatisch per `replaceUrl` zur Startseite.

Das gilt insbesondere fuer:

- Presenter (`/session/:code/present`) bei `FINISHED`
- Vote (`/session/:code/vote`) bei `FINISHED`, sofern kein explizites Abschluss-Gate offen bleiben muss
- Host (`/session/:code/host`) bei verwaister oder serverseitig bereits beendeter Session, wenn eine Host-Aktion wie `session.end` keine gueltige Session mehr findet

`replaceUrl` ist verbindlich, damit der veraltete Session-Pfad nicht im Verlauf als naechster Ruecksprungpunkt erhalten bleibt.

### 2. Entry- und Fehleransichten zeigen zusaetzlich immer eine lokale CTA zur Startseite

Views, die **kein aktiver Session-Fortsetzungsfluss** sind oder bereits im Fehlerzustand rendern, muessen in ihrer eigenen Fehlerkarte oder Platzhalteransicht eine sichtbare Primäraktion `Zur Startseite` anzeigen.

Das gilt insbesondere fuer:

- Join (`/join/:code`)
- Presenter-Fehlerzustand ohne gueltige Session-Metadaten
- Standalone-Blitzlicht-Vote (`/feedback/:code/vote`) im Fehlerzustand

Die globale Toolbar bleibt ein sekundärer Fallback, ist aber **nicht** der alleinige Rettungsweg.

### 3. Abschluss-Gates sind die einzige zulaessige Ausnahme vom Sofort-Redirect

Wenn nach Session-Ende noch ein fachlich relevanter Zwischenschritt angezeigt werden muss, darf der Auto-Redirect kurz aufgeschoben werden.

Zulaessige Beispiele:

- Bonus-Code muss vor Verlassen sichtbar und kopierbar sein
- optionales Abschluss-Feedback wird noch direkt auf derselben Seite angeboten

Auch in diesem Fall muss die View eine eindeutige Primäraktion `Zur Startseite` anbieten.

### 4. Fehlerzustand ist terminal, bis wieder gueltige Session-Metadaten vorliegen

Sobald eine View festgestellt hat, dass der Session-Kontext nicht mehr verfuegbar ist, duerfen nachgelagerte Polling-, Subscription- oder Fallback-Refreshes diesen Zustand nicht mit generischen Platzhaltertexten ueberschreiben.

Das bedeutet:

- Ohne gueltige Session-Metadaten keine weitere Live-Nachladung fuer denselben Screen-Zustand
- Fehlertext und Home-CTA bleiben sichtbar, bis entweder navigiert wurde oder eine neue, gueltige Session-Antwort vorliegt

### 5. Einfache Produktregel fuer alle Session-Routen

Fuer Session-bezogene Frontend-Routen gilt kuenftig die folgende Regel:

- **Eindeutiger Endzustand in aktiver Session-View:** automatisch nach Home
- **Nicht mehr gueltiger oder nicht aufloesbarer Session-Pfad:** lokale Fehleransicht mit CTA `Zur Startseite`
- **Toolbar-Home:** nur sekundärer Fallback, nie einziges Exit-Muster

## Konsequenzen

### Positiv

- Nutzer:innen bleiben nicht mehr an toten Session-Codes in der URL haengen.
- Session-Ende, geloeschte Session und abgelaufene Feedback-Runden verhalten sich konsistenter.
- Die Startseite wird als klarer Rueckkehrpunkt fuer irrecoverable Session-Zustaende etabliert.
- Fehler-CTAs sind auch dann sichtbar, wenn die Toolbar visuell nicht als primaerer Ausweg wahrgenommen wird.
- `replaceUrl` reduziert Rueckspruenge auf nicht mehr gueltige Session-Routen.

### Negativ / Risiken

- Mehr lokale Fehler-CTAs erzeugen etwas Redundanz zur globalen Toolbar.
- Zu aggressive Auto-Redirects koennen Nutzenden Kontexthinweise nehmen, wenn fachlich doch noch ein Abschluss-Schritt noetig gewesen waere.
- Jede neue Session-View muss explizit gegen diese Exit-Regel geprueft werden; Inkonsistenzen entstehen sonst leicht erneut.

## Alternativen (geprueft)

- **Nur globale Toolbar als Rueckweg:** verworfen, weil sie in Fehler- und Live-Kontexten nicht deutlich genug als primaerer Exit funktioniert.
- **Nie automatisch redirecten, immer nur Fehlerkarte zeigen:** verworfen, weil aktive Session-Views bei eindeutigem Endzustand keinen Mehrwert durch weiteres Verbleiben auf der Route bieten.
- **Browser-Back statt Home als Standard-Ausweg:** verworfen, weil dadurch erneut auf ungueltige oder stale Session-Pfade zurueckgesprungen werden kann.

## Umsetzungsleitplanken

- Neue Session-Views muessen bei `FINISHED`, `NOT_FOUND` oder abgelaufenem Kontext explizit auf diese Exit-Strategie geprueft werden.
- Auto-Redirects aus aktiven Session-Views nutzen `navigateByUrl(localizePath('/'), { replaceUrl: true })`.
- Fehlerkarten in Entry- oder Standalone-Views enthalten eine lokale CTA `Zur Startseite`.
- Polling oder Fallback-Refreshes duerfen einen terminalen Fehlerzustand nicht mehr ueberschreiben, solange `session()` oder aequivalente Metadaten fehlen.

## Implementierungsstand (Projekt arsnova.eu)

Stand 2026-04-06:

- Host behandelt verwaiste Sessions beim Verlassen oder bei `Session beenden` so, dass der lokale Zustand zuerst als beendet markiert und dann per `replaceUrl` zur Startseite navigiert wird.
- Join zeigt im Fehlerzustand eine lokale CTA `Zur Startseite`; bei beendeter Session bleibt zusaetzlich der Host-Link sichtbar.
- Presenter zeigt bei fehlender oder ungueltiger Session-Metadatenlage eine lokale CTA `Zur Startseite`; Live-Freitext-Refreshes ueberschreiben den Fehlerzustand dann nicht mehr.
- Standalone-Blitzlicht-Vote zeigt im Fehlerzustand eine lokale CTA `Zur Startseite`.
- Vote behaelt das bestehende Abschluss-Gate fuer Bonus-Code bzw. Session-Feedback und fuehrt von dort ueber eine explizite CTA zur Startseite.

Stand 2026-05-31:

- Die Exit-Regel bleibt gueltig fuer Host, Presenter, Join, Vote und Standalone-Blitzlicht.
- Host-Route-Guards leiten bei fehlendem oder ungueltigem Host-Token in den Join- bzw. Vote-Pfad, statt Host-Rechte aus der URL abzuleiten.
- Session-Ende bleibt mit Bonus-Code-/Feedback-Gates vereinbar; solche Gates sind die dokumentierte Ausnahme vom Sofort-Redirect.

---

**Referenzen:** [ADR-0009: Einheitliche Live-Session mit Tabs fuer Quiz, Q&A und Blitzlicht](./0009-unified-live-session-channels.md), [ADR-0014: Mobile-first Informationsarchitektur fuer Host-Views](./0014-mobile-first-information-architecture-for-host-views.md), [ADR-0019: Host-Haertung und besitzgebundene Session-Zugriffe ohne Accounts](./0019-host-hardening-and-owner-bound-session-access.md), [join.component.ts](../../../apps/frontend/src/app/features/join/join.component.ts), [join.component.html](../../../apps/frontend/src/app/features/join/join.component.html), [session-present.component.ts](../../../apps/frontend/src/app/features/session/session-present/session-present.component.ts), [session-present.component.html](../../../apps/frontend/src/app/features/session/session-present/session-present.component.html), [feedback-vote.component.ts](../../../apps/frontend/src/app/features/feedback/feedback-vote.component.ts), [feedback-vote.component.html](../../../apps/frontend/src/app/features/feedback/feedback-vote.component.html), [session-host.component.ts](../../../apps/frontend/src/app/features/session/session-host/session-host.component.ts), [session-vote.component.ts](../../../apps/frontend/src/app/features/session/session-vote/session-vote.component.ts).
