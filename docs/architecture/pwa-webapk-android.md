# PWA & Android WebAPK (Chrome „Add to Home Screen“)

**Stand:** 2026-05-31

## Hintergrund: WebAPK und Target SDK

Unter Android erzeugt Chrome beim „App installieren“ (Add to Home Screen) kein einfaches Lesezeichen, sondern fordert bei Googles **WebAPK Minting Server** eine generierte APK an. Deren `targetSdkVersion` muss aktuell sein, sonst blockiert Android 14+ bzw. Play Protect die Installation mit einer Warnung („für ältere Android-Version entwickelt“).

Ursachen können sein: veraltete Chrome-Version beim Nutzer oder **gecachte alte WebAPKs** auf Googles Servern.

## Was wir tun: Manifest-Cache-Busting

Damit Google ein **neues** WebAPK mit aktueller targetSdkVersion erzeugt, wird das Manifest bewusst geändert, sobald das Problem auftritt:

- **`start_url`:** Zusätzlicher Query-Parameter. Aktueller Repo-Stand: `/?homescreen=1`. Die App funktioniert unverändert; der Parameter dient nur der Unterscheidung und zwingt den Minting-Server zu einem neuen Build.
- **Icon- und Screenshot-URLs:** Manifest-Assets tragen explizite Cache-Buster (`?v=2` bei Icons, `?v=4` bei Screenshots), damit Chrome und der WebAPK-Minting-Server neue Artefakte zuverlässig erkennen.
- **`theme_color`:** Ggf. minimale Änderung (aktuell `#6750a5`), um das Manifest bei Bedarf zusätzlich zu invalideren.

Nach dem Deploy sollten Nutzer die PWA erneut „Zum Startbildschirm hinzufügen“ anstoßen; Chrome lädt dann ein frisches WebAPK.

## Hinweise für Nutzer (falls die Warnung weiterhin erscheint)

- **„Trotzdem installieren“:** Unter „Weitere Details“ in der Android-Warnung gibt es oft die Option „Trotzdem installieren“. Für unsere vertrauenswürdige Web-App unkritisch.
- **Chrome aktualisieren:** Play Store → Chrome auf neueste Version; ggf. Browser-Cache für arsnova.eu leeren und Installation erneut versuchen.

## Referenz

- Manifest: `apps/frontend/src/manifest.webmanifest`
- Kein Fehler in unserer Architektur; bekanntes Verhalten im Google-WebAPK-Ökosystem.
