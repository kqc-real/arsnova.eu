# i18n in Angular (offizieller Weg) — Umsetzungshinweise für Story 6.2

Recherche basierend auf der **offiziellen Angular-Dokumentation** (angular.dev). Der beschriebene Ansatz gilt für **Angular 17+** (inkl. v21/v22); die i18n-API ist stabil.

---

## 1. Zwei Wege: Offiziell vs. Laufzeit

| Aspekt            | **@angular/localize (offiziell)**                                                   | **ngx-translate / Transloco**                             |
| ----------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Sprachwechsel** | Pro Sprache eigener Build; Wechsel = andere URL/Subdirectory (z. B. `/de/`, `/en/`) | Ein Build; Wechsel zur Laufzeit ohne Reload               |
| **Performance**   | Optimal (nur eine Sprache pro Bundle)                                               | Alle Sprachen im Bundle oder nachladen                    |
| **Workflow**      | Extract → Übersetzen → Merge → Build pro Locale                                     | JSON-Dateien, zur Laufzeit geladen                        |
| **Empfehlung**    | Wenn wenige Sprachen, SEO/Performance wichtig, Deployment mit Subpfaden ok          | Wenn dynamischer Sprachwechsel in einer App-Instanz nötig |

**Backlog 6.2** nennt „Angulars eingebautes i18n (`@angular/localize`) oder `ngx-translate`“. Für **de, en, fr, it, es** und typisches Deployment (Subpfade wie `/de/`, `/en/`) ist **@angular/localize** der empfohlene, offizielle Weg.

---

## 1b. Sprachwechsel: Was passiert, wo geht State verloren?

**Aktuell (ohne i18n):** Der Sprachwähler in der Top-Toolbar speichert nur die Präferenz in `localStorage` (`home-language`). Es gibt **keinen** Reload und **keinen** Seitenwechsel – der sichtbare Inhalt ändert sich nicht, es geht **kein** State verloren.

**Mit @angular/localize (Locale = Subpfad):** Sprachwechsel bedeutet in der Regel **Navigation auf eine andere URL** (z. B. `/de/session/ABC123/host` → `/en/session/ABC123/host`). Das wird oft als **vollständiger Seiten-Reload** umgesetzt (neues Dokument, App neu gebootet). Dann gilt:

- **Alles, was nur im Speicher lebt** (Komponenten-State, Service-State, ungespeicherte Formulare), ist weg.
- **Erhalten bleiben:** `localStorage`, `sessionStorage`, und alles, was die App nach dem Reload wieder vom Server oder aus der URL lädt.

| View / Route                                 | URL enthält  | Was bei Reload passiert                                           | Risiko State-Verlust                                                                                                   |
| -------------------------------------------- | ------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Startseite** `/`                           | –            | Formular (Session-Code) neu                                       | **Niedrig:** Nur eingegebener Code weg; Nutzer tippt neu.                                                              |
| **Join** `/join/:code`                       | Session-Code | Code bleibt; Formular (Nickname etc.) neu                         | **Mittel:** Nickname/ausgewählte Optionen weg; Code bleibt, Beitritt schnell wiederholbar.                             |
| **Session Host** `/session/:code/host`       | Session-Code | Session wird per tRPC wieder geladen                              | **Niedrig:** Server-State (Frage, Phase) wird neu geholt; nur rein lokale UI-Zustände (z. B. aufgeklapptes Panel) weg. |
| **Session Vote** `/session/:code/vote`       | Session-Code | Session/aktuelle Frage wieder per tRPC                            | **Niedrig:** Abstimmung/Scorecard vom Server; nur kurz „Neuladen“.                                                     |
| **Session Present** `/session/:code/present` | Session-Code | Wie Host, State vom Server                                        | **Niedrig.**                                                                                                           |
| **Quiz-Liste** `/quiz`                       | –            | Liste aus IndexedDB/Store neu laden                               | **Niedrig.**                                                                                                           |
| **Quiz bearbeiten** `/quiz/:id`              | Quiz-ID      | Quiz aus Store laden; **ungespeicherte Änderungen** nicht mehr da | **Hoch:** Ungespeicherte Bearbeitung (Fragen, Antworten, Einstellungen) geht verloren.                                 |
| **Quiz neu** `/quiz/new`                     | –            | Kein persistierter Entwurf                                        | **Hoch:** Gesamter neuer Quiz-Entwurf weg, wenn noch nicht gespeichert.                                                |
| **Quiz Preview** `/quiz/:id/preview`         | Quiz-ID      | Quiz aus Store                                                    | **Mittel:** Nur aktueller View-State (z. B. Seite) weg.                                                                |
| **Legal/Help**                               | –            | Nur Inhalt neu geladen                                            | **Keins.**                                                                                                             |

**Praktische Konsequenzen:**

- **Kritisch:** Sprachwechsel während **Quiz bearbeiten** oder **Quiz neu** → Hinweis anzeigen (z. B. „Sprache wechseln? Ungespeicherte Änderungen gehen verloren.“) oder Sprachwahl deaktivieren, solange es ungespeicherte Änderungen gibt.
- **Optional:** Beim Wechsel von einer „kritischen“ Route (Quiz Edit/New) zur anderen Locale die **gleiche Route** in der neuen Locale ansteuern (z. B. `/de/quiz/xyz` → `/en/quiz/xyz`), damit der Nutzer wieder auf derselben fachlichen Seite landet; State muss trotzdem neu geladen werden (Quiz aus Store), nur die Kontext-URL bleibt sinnvoll.
- **Session-Seiten:** Reload ist akzeptabel; Session-Code in der URL reicht, um den Kontext wiederherzustellen.

**Alternative (ngx-translate/Transloco):** Wenn Sprachwechsel **ohne Reload** gewünscht ist (kein State-Verlust auf keiner Seite), müsste ein **Laufzeit-i18n**-Ansatz gewählt werden (ngx-translate o. Ä.); dann bleibt die App-Instanz erhalten und nur die angezeigten Strings wechseln.

---

## 2. Installation

```bash
cd apps/frontend
ng add @angular/localize
```

- Ergänzt `package.json` und TypeScript-Config (u. a. `types: ["@angular/localize"]`).
- Fügt in `main.ts` die nötige Referenz für `$localize` ein.

**Option** `--use-at-runtime`: Wenn ihr `$localize` zur Laufzeit nutzen wollt (z. B. für Lazy-Load von Übersetzungen), dann wird `@angular/localize` in `dependencies` statt `devDependencies` eingetragen.

---

## 3. Texte für Übersetzung markieren

### 3.1 Im Template (HTML)

- **Statischer Text:** Attribut `i18n` auf dem Element.
  ```html
  <h1 i18n>Willkommen</h1>
  <p i18n="Beschreibung des Absatzes">Session beitreten</p>
  ```
- **Kontext für Übersetzer:** `i18n="Bedeutung|Beschreibung@@customId"`.
  ```html
  <h1 i18n="Seitenkopf|Willkommenstitel auf der Startseite@@homeTitle">Willkommen</h1>
  ```
- **Attribute:** `i18n-{attributname}`.
  ```html
  <input i18n-placeholder placeholder="Session-Code eingeben" />
  <img [src]="logo" i18n-title title="Logo" i18n-alt alt="Logo" />
  ```

### 3.2 Im TypeScript-Code

- **Tagged Template Literal** `$localize`:

  ```ts
  import { $localize } from '@angular/localize/init';

  title = $localize`Willkommen`;
  message = $localize`:Button-Label|Beschreibung:Abbrechen`;
  withVar = $localize`Hallo ${this.name}:name:!`;
  ```

- **Bedingt:** z. B. für Aria-Labels.
  ```ts
  return this.visible ? $localize`Anzeigen` : $localize`Ausblenden`;
  ```

### 3.3 Pluralisierung und Alternativen (ICU)

- **Plural:** `{ variable, plural, =0 {...} =1 {...} other {...} }`
- **Select (z. B. Geschlecht):** `{ variable, select, male {...} female {...} other {...} }`

Beispiele siehe [Prepare component for translation](https://angular.dev/guide/i18n/prepare).

#### 3.3.1 Pflicht: ICU-Schlüsselwörter in XLF `<target>` nicht übersetzen

Die **Message-Format-Syntax** (Unicode ICU) verwendet **feste englische Schlüsselwörter**. Sie müssen in den Übersetzungsdateien **unverändert** bleiben — auch in Französisch, Italienisch, Spanisch usw. Nur der **sichtbare Nutzertext** innerhalb der geschweiften Blöcke ist zu übersetzen.

| Immer englisch lassen (Beispiele)                                   | Falsch (bricht Laufzeit / Template)                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `plural` (Plural-Selektor)                                          | `pluriel`, `plurale`, …                                     |
| `select` (Auswahl-Selektor)                                         | übersetzte Varianten des Wortes „select“                    |
| Plural-Kategorien: `zero`, `one`, `two`, `few`, `many`, **`other`** | z. B. `autres`, `altro`, `otros` statt `other`              |
| Select-Keys aus dem Quelltext (z. B. `male`, `female`, `other`)     | nur ändern, wenn der **Quell**-String dieselben Keys ändert |

**Hintergrund:** `@angular/localize` parst die Zielzeichenkette zur Laufzeit. Falsche Tokens führen zu Fehlern oder dazu, dass **ganze Template-Abschnitte** (z. B. eine Zeile mit Stimmenzahl **und** darunter folgende UI wie Balkendiagramme) **nicht gerendert** werden.

**Richtiges Muster (Plural):**

```text
{VAR_PLURAL, plural, =1 {1 vote} other {<x id="INTERPOLATION"/> votes}}
```

Hier sind `VAR_PLURAL`, `plural`, `=1`, `other` und die Platzhalter-Struktur beizubehalten; nur `1 vote` / `votes` (bzw. die entsprechenden Zielsprachen-Texte) werden sprachlich angepasst.

---

## 4. Übersetzungsdateien erzeugen und pflegen

### 4.1 Quelltext extrahieren

```bash
ng extract-i18n
```

- Erzeugt standardmäßig `messages.xlf` (XLIFF 1.2) im Projektroot. **Angular CLI (inkl. v22):** Default-Format ist `xlf`; erlaubt sind `xlf`, `xlf2`, `xliff`, `xliff2`, `json`, `arb`, `xmb`, `legacy-migrate`. Es gibt keine explizite „Empfehlung für v22“; der Default XLIFF unterstützt alle Metadaten.
- **Optionen (Auszug):**
  - `--format=xlf` | `xlf2` | `json` | `arb` (z. B. `--format=json` für JSON).
  - `--output-path src/locale` — Ablage in `src/locale`.
  - `--out-file source.xlf` — Dateiname.

Beispiel für strukturierte Ablage (Backlog: „Übersetzungsdateien `i18n/*.json`“):

```bash
ng extract-i18n --format=json --output-path src/locale --out-file messages.json
```

**Hinweis:** Bei `--format=json` entfallen in der aktuellen Tool-Version teils Meaning/Description; XLIFF (xlf/xlf2) ist für volle Metadaten die sichere Wahl.

### 4.2 Pro Sprache eine Übersetzungsdatei

- **XLIFF:** Kopie der Quell-XLF pro Locale (z. B. `messages.de.xlf`, `messages.en.xlf`); in jeder Datei die `<target>`-Tags mit den Übersetzungen füllen. **ICU:** In Plural-/Select-Messages die Schlüsselwörter `plural`, `select`, `other` usw. nie übersetzen (siehe **Abschnitt 3.3.1** oben).
- **JSON/ARB:** Entsprechend eine JSON-Datei pro Locale (z. B. `messages.de.json`).

Sprachen laut Backlog: **de, en, fr, it, es**.

---

## 5. Build-Konfiguration (angular.json)

Unter dem Projekt (z. B. `apps/frontend`) im **`options`-Block** des **`build`-Targets**:

```json
"i18n": {
  "sourceLocale": "de",
  "locales": {
    "de": {},
    "en": {
      "translation": "src/locale/messages.en.xlf"
    },
    "fr": {
      "translation": "src/locale/messages.fr.xlf"
    },
    "it": {
      "translation": "src/locale/messages.it.xlf"
    },
    "es": {
      "translation": "src/locale/messages.es.xlf"
    }
  }
},
"localize": true
```

- **sourceLocale:** Die Sprache, in der der Quellcode geschrieben ist (z. B. `de`).
- **locales:** Map von Locale-IDs auf Übersetzungsdateien; für die Quellsprache kann `{}` reichen (keine separate Übersetzungsdatei nötig).
- **localize: true:** Es wird ein Build pro definierter Locale erzeugt.

**Development:** `ng serve` unterstützt nur **eine** Locale. Für lokales Testen z. B.:

```json
"localize": ["de"]
```

oder eine Konfiguration z. B. `"fr": { "localize": ["fr"] }` und dann `ng serve --configuration=fr`.

---

## 6. Build und Ausgabe

```bash
ng build --localize
```

- Pro Locale entsteht ein eigener Output (z. B. `dist/browser/de`, `dist/browser/en`, …).
- Der CLI setzt für jede Variante u. a.:
  - `lang` auf `<html>`
  - `baseHref` (z. B. `/de/`, `/en/`) über die Locale-Konfiguration (`subPath` o. ä.).

---

## 7. Deployment (mehrere Locales)

- Jede Locale wird aus einem **eigenen Unterpfad** ausgeliefert (z. B. `/de/`, `/en/`).
- **Spracherkennung:** Serverseitig anhand des `Accept-Language`-Headers auf die passende Locale umleiten (z. B. `/` → `/de/` oder `/en/`).
- **Sprachwahl in der App:** Navigation zu anderem Subpfad (z. B. von `/de/` zu `/en/`), ggf. mit Reload.

Dokumentation: [Deploy multiple locales](https://angular.dev/guide/i18n/deploy) (inkl. Nginx-/Apache-Beispiele).

### 7a. Sprachwähler → Locale-URL (implementiert)

Die Top-Toolbar liest die aktuelle Locale aus dem **ersten URL-Segment** (`/de/`, `/en/`, …) und zeigt sie im Sprachmenü an. Beim Wechsel der Sprache (`setLanguage(code)`):

1. **Navigation:** Wenn die aktuelle Pfad-URL bereits eine Locale enthält (z. B. `/en/session/ABC123/host`), wird das erste Segment durch die gewählte Locale ersetzt und die Seite per **vollständigem Reload** geladen (z. B. `/de/session/ABC123/host`). So wird die passende lokalisierte Build-Variante geladen.
2. **Ohne Locale im Pfad** (z. B. Dev-Server mit `base href="/"`): Redirect auf `/{code}/` bzw. `/{code}{rest}`.

**Hinweis:** Es werden nur die Locales gebaut, die in `angular.json` unter `i18n.locales` eingetragen sind (aktuell: de, en, fr, it, es). Für `fr/it/es` sind technische Übersetzungsdateien vorhanden; die inhaltliche Übersetzung wird schrittweise ergänzt.

**Dev-Server (`ng serve`):** Es wird nur **eine** Locale gebaut (Quellsprache Deutsch). Die Pfade `/de/`, `/en/`, `/fr/`, `/it/`, `/es/` funktionieren (Routing), liefern aber denselben deutschen Inhalt. Um echte Übersetzungen zu sehen: lokalisierten Build ausführen und mit API-Server starten (siehe Abschnitt **„Lokalisierter Build lokal“** unten), z. B. http://localhost:4200/en/.

#### Lokalisierter Build lokal (Schritt für Schritt)

Damit die lokalisierten Builds (de/en/fr/it/es) mit **funktionierender API, tRPC-Subscriptions und Yjs-WebSocket** laufen, wird ein **eigener Proxy** genutzt – ein reiner Statik-Serve reicht nicht.

| Schritt | Befehl                                            | Erklärung                                                                                                                                               |
| ------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | `npm run dev -w @arsnova/backend`                 | Backend muss laufen: HTTP (3000), tRPC-WS (3001), Yjs-WS (3002).                                                                                        |
| 2       | `npm run build:localize -w @arsnova/frontend`     | Baut `dist/browser/de/`, `dist/browser/en/`, `dist/browser/fr/`, `dist/browser/it/`, `dist/browser/es/`, kopiert Root-`index.html` (Redirect → `/de/`). |
| 3       | `npm run serve:localize:api -w @arsnova/frontend` | Startet `scripts/serve-localized-with-api.mjs` auf Port 4200.                                                                                           |

**Was der Proxy macht:** Er serviert statische Dateien aus `dist/browser`, liefert für `/`, `/de`, `/en`, `/fr`, `/it`, `/es` (jeweils inkl. Subpfaden) die passende `index.html` aus, und leitet weiter:

- **`/trpc`** → HTTP an Backend (Port 3000); Response-Header `content-encoding` werden entfernt (sonst ERR_CONTENT_DECODING_FAILED).
- **`/trpc-ws`** → WebSocket-Proxy nach Port 3001; Nachrichten Backend→Client werden als **Text-Frames** weitergegeben (tRPC erwartet JSON-Text).
- **`/yjs-ws`** → WebSocket-Proxy nach Port 3002 (Yjs Quiz-Sync); Pfad-Suffix (z. B. `/quiz-library-room-…`) wird durchgereicht.
- **`/assets`** → wird aus `dist/browser/de/assets` bedient (damit Manifest-Icons unter absoluten Pfaden funktionieren).

**Häufige Probleme:**

- **„Feedback konnte nicht gestartet werden“ / Health-Check schlägt fehl:** Backend nicht gestartet oder Proxy-Ziel-URL falsch (Proxy baut `/trpc` + Rest-Pfad; Backend muss auf 3000 lauschen).
- **„jsonEncoder received binary data“:** Proxy muss tRPC-Antworten als Text-Frames an den Browser senden (siehe Skript: Backend→Client immer als Text).
- **Yjs „ECONNREFUSED“:** Yjs-Server (Port 3002) wird vom Backend als Child-Prozess gestartet; Backend mit `npm run dev -w @arsnova/backend` starten. Der Proxy loggt diesen Fehler nur **einmal** pro Lauf, um die Konsole nicht zu überfluten.
- **Icons/Manifest 404:** Der Proxy mountet `/assets` auf `dist/browser/de/assets`; ohne diesen Schritt würden Anfragen zu `/assets/icons/…` ins Leere laufen (lokalisierter Build hat keine `dist/browser/assets`).

### 7b. Hinweis bei Sprachwechsel auf Quiz Edit/New (implementiert)

Auf den Routen **Quiz bearbeiten** (`/quiz/:id`) und **Quiz neu** (`/quiz/new`) kann ein Sprachwechsel ungespeicherte Änderungen verwerfen. Dafür gibt es den **LocaleSwitchGuardService** (`core/locale-switch-guard.service.ts`):

- **Quiz-Edit** und **Quiz-New** registrieren beim Aktivwerden einen Getter für „Formular dirty“ und melden sich in `ngOnDestroy` wieder ab.
- Beim Klick auf eine andere Sprache in der Toolbar prüft `setLanguage()` vor dem Redirect, ob `localeGuard.hasUnsavedChanges()` true ist (nur auf diesen Routen).
- Wenn ja, öffnet sich ein Bestätigungsdialog („Sprache wechseln? Ungespeicherte Änderungen gehen verloren.“) mit **Abbrechen** / **Trotzdem wechseln**; nur bei „Trotzdem wechseln“ erfolgt der Reload auf die neue Locale-URL.

---

### 7c. Verfahren der Sprachauswahl (implementiert)

Die Sprachwahl priorisiert bewusst den **Normalfall**: Die App folgt der Spracheinstellung des Browsers.

1. **URL-Locale hat Vorrang im laufenden Request**  
   Auf konkreten Pfaden wie `/de/...` oder `/en/...` ist die Sprache bereits eindeutig über die URL festgelegt.

2. **Root-Redirect (`GET /`) im Backend**  
   Wenn nur `/` aufgerufen wird, wählt der Server die Locale aus **`Accept-Language`** (`de`, `en`, `fr`, `it`, `es`; sonst Fallback auf verfügbare Standard-Locale, typischerweise `en`).

3. **Sprachwechsel in der App**  
   Die Sprachwahl im Menü navigiert auf die entsprechende Locale-URL. Das gilt für die laufende Sitzung und den aktuellen Pfad.

4. **Keine dauerhafte Präferenzspeicherung**  
   Die Locale wird **nicht** als Cookie gespeichert. Damit bleibt das Verhalten bei neuen Sitzungen browserbasiert.

5. **Static-Fallback (ohne Node-Backend)**  
   Die `static-root-index.html` nutzt `navigator.languages` und fällt sonst auf `en` zurück.

6. **Cache-Verhalten beim Root-Redirect**  
   Der Redirect setzt `Vary: Accept-Language` und `Cache-Control: private, no-cache`, damit Caches keine falsche Sprache global wiederverwenden.

Betroffene Stellen im Code:

- Backend: `apps/backend/src/lib/pick-locale-from-accept-language.ts`, `apps/backend/src/index.ts`
- Frontend: `apps/frontend/src/app/shared/top-toolbar/top-toolbar.component.ts`
- Static Fallback: `apps/frontend/static-root-index.html`

---

## 8. Datum, Zahlen, Währung (Backlog: „Datums- und Zahlenformate“)

- **DatePipe, DecimalPipe, PercentPipe, CurrencyPipe** nutzen automatisch **LOCALE_ID**.
- Pro gebauter Locale ist LOCALE_ID bereits die jeweilige Locale; es sind keine zusätzlichen Schritte nötig, damit Datum/Zahl zur angezeigten Sprache passen.
- Optional: Locale explizit überschreiben, z. B. `{{ value | date : undefined : undefined : locale }}` bzw. Pipes mit Locale-Parameter.

---

## 9. Rechtliche Seiten (Impressum/Datenschutz) und 6.2

- **Routen** bleiben sprachneutral (`/legal/imprint`, `/legal/privacy`).
- **Inhalte** können pro Locale unterschiedlich sein:
  - Entweder: Pro Locale eigene Markdown-Dateien (z. B. `imprint.de.md`, `imprint.en.md`) und im Frontend die aktuelle Locale (z. B. aus Pfad oder einer Locale-Service) verwenden, um die richtige Datei zu laden.
  - Oder: Inhalte in die jeweilige Übersetzungsdatei (XLIFF/JSON) legen und über `$localize`/Template ausgeben.

**Umsetzung (Phase 5.1):** `LegalPageComponent` liest die Locale über `getLocaleFromPath()` (aus `core/locale-from-path.ts`) und lädt `assets/legal/{slug}.{locale}.md`. Bei 404 wird auf `{slug}.de.md` zurückgefallen. **Vorhanden:** `imprint.de.md`, `imprint.en.md`, `privacy.de.md`, `privacy.en.md`; für fr, it, es können weitere Dateien ergänzt werden.

---

## 9a. Vorgaben für Übersetzungen (ADR-0008)

Verbindliche Vorgaben für alle Übersetzungen sind in **ADR-0008** (Abschnitt 4) festgehalten. Kurzüberblick:

- **Sprachstil:** Informelle Anrede (Duzen), zeitgemäßer Sprachstil in allen Sprachen.
- **Referenz Deutsch:** Deutscher Quelltext ist in Form und Länge geprüft und gilt als **Maßstab**; Übersetzungen sollen nicht unnötig länger werden und die vorgegebene Struktur wahren.
- **Visuelle Prüfung, Mobile-First:** Längere Texte in Zielsprachen können **Strukturbrüche** verursachen. Es muss **stets visuell geprüft** werden – **zuerst auf Smartphone**, danach auf Desktop (Mobile-First). Pro View, pro Locale, ggf. pro Breakpoint. Bei Überlängen: kürzere Formulierung wählen oder Layout anpassen (Umbrüche, Truncation).
- **Zwei Übersetzungen (Mobile/Desktop):** Wenn ein Text auf Smartphone bricht, auf Desktop aber passt, sind **zwei Varianten** erlaubt (kurz für Mobile, voll für Desktop); Quelltexte (Deutsch) liefern dann ebenfalls zwei Varianten.
- **Datum, Einheiten, Idiomatik:** Datums- und Zahlenformate sowie Maßeinheiten folgen der **Zielsprache/Locale**. Formulierungen sind **idiomatisch** (natürlich in der Zielsprache, nicht wörtlich).

Details: [docs/architecture/decisions/0008-i18n-internationalization.md](architecture/decisions/0008-i18n-internationalization.md).

---

## 9b. Aktueller Stand (Projekt arsnova.eu)

| Aspekt                       | Stand                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Extrahierte Messages**     | 607 (Stand nach `ng extract-i18n`)                                                                                                                                                                                                                                                                                                                                           |
| **Englisch (en)**            | Vollständig: Alle trans-units in `messages.en.xlf` haben ein `<target>`; Build ohne „No translation found“.                                                                                                                                                                                                                                                                  |
| **fr/it/es (Technikstatus)** | `messages.fr.xlf`, `messages.it.xlf`, `messages.es.xlf` vorhanden (Startbasis, Source=Target) und in `angular.json` eingebunden; Build erzeugt Locale-Ausgaben für alle fünf Sprachen.                                                                                                                                                                                       |
| **Legal-Seiten**             | DE + EN: `imprint.de.md`, `imprint.en.md`, `privacy.de.md`, `privacy.en.md` in `src/assets/legal/`.                                                                                                                                                                                                                                                                          |
| **Markierte Bereiche**       | App, Home, Toolbar, Join, Preset-Toast, Session (Host/Vote/Present), Quiz (Liste/New/Edit/Preview/Sync), Help, Feedback, Legal.                                                                                                                                                                                                                                              |
| **Demo-Quiz (fest)**         | Inhalte pro Sprache: `apps/frontend/src/assets/demo/quiz-demo-showcase.{de,en,fr,es,it}.json`. Auswahl über URL-Locale (`getLocaleFromPath`) bzw. `LOCALE_ID`; `QuizStoreService.ensureDemoQuiz()` ersetzt das Demo bei Sprachwechsel. Übersetzte Texte aus dem Deutschen ableiten: `npm run demo-quiz:locales` im Ordner `apps/frontend`.                                   |
| **Skripte**                  | `scripts/merge-missing-i18n-en.mjs`: fehlende EN-Targets aus fester TARGET_MAP einfügen. `scripts/add-missing-en-translations.mjs`: nach neuem Extract fehlende trans-units in `messages.en.xlf` mit EN-Targets ergänzen (ID→Target-Map im Skript). Nach Änderungen an UI-Texten: `ng extract-i18n` ausführen, dann ggf. Skript ausführen und neue IDs in die Map aufnehmen. |

---

## 10. Kurz-Checkliste für Story 6.2

| Backlog-Kriterium             | Umsetzung                                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprachen de, en, fr, it, es   | In `i18n.locales` eintragen + Übersetzungsdateien pflegen                                                                                                |
| Browser (default) / Userwahl  | Root-Redirect per Accept-Language; Sprachmenü wechselt die Locale-URL für die laufende Sitzung                                                           |
| Sprachwähler in der Nav       | Link/Button zu den Locale-Subpfaden (`/de/`, `/en/`, …) oder Redirect mit Reload                                                                         |
| Persistenz der Auswahl        | Keine dauerhafte Cookie-Persistenz; neuer Besuch folgt wieder der Browser-Sprache (`Accept-Language`)                                                    |
| @angular/localize             | `ng add @angular/localize`; Templates/Code mit `i18n` und `$localize` markieren                                                                          |
| Übersetzungsdateien           | `ng extract-i18n`; pro Sprache eine Datei (z. B. in `src/locale/` oder `i18n/`)                                                                          |
| Quiz-Inhalte nicht übersetzen | Kein `i18n` an Nutzer-Inhalten (Fragenstamm, Antworten); nur UI-Texte markieren. **Ausnahme:** festes Demo-Quiz (siehe Abschnitt 9b, Zeile „Demo-Quiz“). |
| Datum/Zahl nach Locale        | DatePipe/DecimalPipe nutzen; LOCALE_ID kommt durch Build pro Locale                                                                                      |

---

## 11. Nützliche Links (angular.dev)

- [Internationalization – Overview](https://angular.dev/guide/i18n)
- [Add the localize package](https://angular.dev/guide/i18n/add-package)
- [Prepare component for translation](https://angular.dev/guide/i18n/prepare)
- [Work with translation files](https://angular.dev/guide/i18n/translation-files)
- [Merge translations into the app](https://angular.dev/guide/i18n/merge)
- [Deploy multiple locales](https://angular.dev/guide/i18n/deploy)
- [Format data based on locale](https://angular.dev/guide/i18n/format-data-locale)
- [CLI: ng extract-i18n](https://angular.dev/cli/extract-i18n)

---

_Stand: Recherche für Angular v21/v22; Dokumentation unter https://angular.dev/guide/i18n._
