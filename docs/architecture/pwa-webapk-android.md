# PWA & Android WebAPK (Chrome „Add to Home Screen“)

**Stand:** 2026-09-02

## Hintergrund: WebAPK und Target SDK

Unter Android erzeugt Chrome beim „App installieren“ (Add to Home Screen) kein einfaches Lesezeichen, sondern fordert bei Googles **WebAPK Minting Server** eine generierte APK an. Deren `targetSdkVersion` muss aktuell sein, sonst blockiert Android 14+ bzw. Play Protect die Installation mit einer Warnung („für ältere Android-Version entwickelt“).

Ursachen können sein: veraltete Chrome-Version beim Nutzer oder **gecachte alte WebAPKs** auf Googles Servern.

## Temporärer Schutz für Samsung Internet

Für Samsung Internet ist seit April 2026 ein noch offener Fehlerbericht bekannt,
nach dem der Browser auf Android 14+ ein WebAPK mit veraltetem Target SDK erzeugen
kann. Android blockiert die Installation dann als unsicher, während dieselbe PWA
über Chrome installierbar bleibt:
[`SamsungInternet/support#123`](https://github.com/SamsungInternet/support/issues/123).

arsnova.eu unterdrückt deshalb vorübergehend nur seinen eigenen
Installationshinweis, wenn das `beforeinstallprompt`-Event aus einem User-Agent mit
dem von Samsung dokumentierten Token `SamsungBrowser/` stammt. Die
browser-eigenen Menüfunktionen bleiben davon unberührt. Firefox und allgemeine
In-App-Browser werden nicht per User-Agent gesperrt: Ohne unterstütztes
`beforeinstallprompt`-Event erscheint der eigene Installationshinweis ohnehin
nicht.

## Was wir tun: Manifest-Cache-Busting

Damit Google ein **neues** WebAPK mit aktueller targetSdkVersion erzeugt, wird das Manifest bewusst geändert, sobald das Problem auftritt:

- **`start_url`:** Zusätzlicher Query-Parameter. Aktueller Repo-Stand: `/?homescreen=1`. Die App funktioniert unverändert; der Parameter dient nur der Unterscheidung und zwingt den Minting-Server zu einem neuen Build.
- **Icon- und Screenshot-URLs:** Manifest-Assets tragen explizite Cache-Buster (`?v=5` bei App-Icons, `?v=3` bei Shortcut-Icons, `?v=10` bei Screenshots), damit Chrome und der WebAPK-Minting-Server neue Artefakte zuverlässig erkennen. `purpose: "any"` und `purpose: "maskable"` sind getrennte Einträge (Chrome warnt vor `"any maskable"` auf einem Icon). Der gelbe Stern sitzt in `favicon.svg` in der Maskable-Safe-Zone (Kreis mit 80 % Durchmesser), damit weder Android noch die DevTools-Kreismaske Zacken abschneiden. Neu erzeugen mit `npm run icons -w @arsnova/frontend`.
- **`theme_color`:** Ggf. minimale Änderung (aktuell `#6750a5`), um das Manifest bei Bedarf zusätzlich zu invalideren.

Nach dem Deploy sollten Nutzer die PWA erneut „Zum Startbildschirm hinzufügen“ anstoßen; Chrome lädt dann ein frisches WebAPK.

## Hinweise für Nutzer (falls die Warnung weiterhin erscheint)

- **„Trotzdem installieren“:** Unter „Weitere Details“ in der Android-Warnung gibt es oft die Option „Trotzdem installieren“. Für unsere vertrauenswürdige Web-App unkritisch.
- **Chrome aktualisieren:** Play Store → Chrome auf neueste Version; ggf. Browser-Cache für arsnova.eu leeren und Installation erneut versuchen.

## Manifest-Screenshots

`screenshots` im Web-App-Manifest ist ein Array. Chrome zeigt passende Einträge in der erweiterten Installations-UI als Karussell: Desktop nur `form_factor: "wide"` (höchstens acht), Android nur `narrow` (höchstens fünf). Alle Shots desselben Formfaktors müssen dasselbe Seitenverhältnis haben (hier 1920×1080 bzw. 440×956). Chrome verlangt Kanten zwischen 320 px und 3840 px; die längere Seite darf höchstens das 2,3-Fache der kürzeren sein (440×956 ≈ 2,17).

Aktueller Satz (Chrome-Maximum): **acht Wide** in 1080p und **fünf Narrow** im iPhone-16-Pro-Viewport (440×956). Die Szenen zeigen die Produkt-USPs: drei Kanäle in einer App, ohne Anmeldung, Beamer mit QR, Teams/Nicknames, Wortwolke und Blitzlicht.

Wide:

1. Startseite
2. Beamer-Lobby mit QR-Code
3. Live-Quiz (Host)
4. Beamer-Ansicht der Quizfrage
5. Wortwolke
6. Q&A-Wand
7. Blitzlicht
8. Rangliste

Narrow:

1. Startseite
2. Abstimmung im Demo-Quiz
3. Freitext
4. Frage stellen (Q&A)
5. Stimmungsbild (Blitzlicht)

Erzeugen: Frontend und API müssen laufen, dann `npm run screenshots -w @arsnova/frontend`. Nur Startseite: `HOME_ONLY=1`. Labels werden beim lokalisierten Build in `patch-pwa-manifest-per-locale.mjs` übersetzt.

## Homescreen-Shortcuts

`shortcuts` im Manifest sind statische Deep-Links auf dem installierten App-Icon: langer Druck auf Android (WebAPK) bzw. Rechtsklick/Jumplist unter Windows. Chrome auf Android zeigt in der Praxis die **ersten drei** Einträge (ein Slot ist die Website-Einstellung); Windows kann mehr anzeigen. Reihenfolge ist deshalb die Hero-Reihenfolge der Startseite:

1. **Code eingeben** → `/join` (Fokus auf die Code-Eingabe)
2. **Quiz erstellen** → `/quiz/new`
3. **Q&A öffnen** → `/?host=qa` (gleicher Host-Flow wie der Hero-Chip: Session anlegen oder letzte Session öffnen)
4. **Blitzlicht starten** → `/?host=quickFeedback` (vierter Eintrag, auf Android oft nicht sichtbar)

Namen und URLs werden beim lokalisierten Build wie die Screenshot-Labels in `patch-pwa-manifest-per-locale.mjs` übersetzt bzw. mit `/{locale}/` präfixiert. Shortcut-Icons sind 192×192-PNG (Chrome akzeptiert kein SVG) und liegen unter `assets/icons/shortcut-*.png`. Neu erzeugen mit `npm run icons -w @arsnova/frontend`.

## Referenz

- Manifest: `apps/frontend/src/manifest.webmanifest`
- Capture: `apps/frontend/scripts/capture-screenshots.mjs`
- Kein Fehler in unserer Architektur; bekanntes Verhalten im Google-WebAPK-Ökosystem.
