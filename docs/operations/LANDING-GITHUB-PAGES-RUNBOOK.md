# Landing unter `info.arsnova.eu`

Dieses Runbook aktiviert die Astro-Landing als GitHub-Pages-Custom-Domain. Die
Live-Anwendung unter `https://arsnova.eu` und die DNS-Einträge der Apex-Domain
bleiben unverändert.

> **Cutover-Status vom 27. Juli 2026:** Die GitHub-Pages-Custom-Domain
> `info.arsnova.eu` ist aktiv und verifiziert, der CNAME löst auf
> `kqc-real.github.io` auf, das Zertifikat ist freigegeben und HTTPS wird
> erzwungen. Die bisherige Projekt-URL
> `https://kqc-real.github.io/arsnova.eu/` antwortet mit `301` und leitet auf
> `https://info.arsnova.eu/` weiter. Damit sind die Voraussetzungen für den
> Root-Build dieses PRs bereits erfüllt.

## Voraussetzungen

- Unter Repository → Settings → Pages ist **GitHub Actions** als Quelle gewählt.
- Die ausführende Person kann DNS-Einträge für `arsnova.eu` und GitHub-Pages-
  Einstellungen verwalten.
- **Vor** einem Merge oder produktiven Deploy mit
  `PUBLIC_SITE_URL=https://info.arsnova.eu/` und `BASE_PATH=/` müssen
  Domain-Verifikation, CNAME, Pages-Custom-Domain, Zertifikat und
  HTTPS-Erzwingung vollständig aktiv und mit den Prüfungen in Schritt 5
  bestätigt sein.

## Aktivierungsreihenfolge

Die Schritte 1 bis 5 werden noch mit dem bestehenden Projektseiten-Build
abgeschlossen. Erst Schritt 6 stellt den Build auf Root-Pfade um. Diese
Reihenfolge verhindert, dass absolute Pfade wie `/_astro/…` vor dem
Domain-Cutover unter `kqc-real.github.io/arsnova.eu/` veröffentlicht werden.

### 1. Apex-Domain bei GitHub verifizieren

1. GitHub-Profil → Settings → Pages → **Add a domain** öffnen.
2. `arsnova.eu` eintragen. GitHub zeigt einen individuellen TXT-Wert an.
3. Beim DNS-Provider den von GitHub angezeigten Eintrag anlegen:
   - Typ: `TXT`
   - Host/Name: `_github-pages-challenge-kqc-real`
   - Value/Ziel: der **individuelle GitHub-Verifizierungscode**
   - TTL: Provider-Standard oder `3600`
4. Falls der Provider einen vollständigen Namen erwartet, stattdessen
   `_github-pages-challenge-kqc-real.arsnova.eu` verwenden. Die Domain darf
   nicht doppelt angehängt werden.
5. Auflösung prüfen:

   ```bash
   dig TXT _github-pages-challenge-kqc-real.arsnova.eu +short
   ```

6. In GitHub **Verify** wählen. Den TXT-Eintrag danach als Takeover-Schutz
   dauerhaft beibehalten.

### 2. CAA für das Pages-Zertifikat prüfen

```bash
dig CAA arsnova.eu +short
```

Existieren keine CAA-Einträge, ist keine Änderung nötig. Existieren CAA-
Einträge, muss mindestens einer Let's Encrypt erlauben. Fehlt diese Erlaubnis,
beim Provider ergänzen:

- Typ: `CAA`
- Host/Name: `@`
- Flag: `0`
- Tag: `issue`
- Value: `letsencrypt.org`
- TTL: Provider-Standard oder `3600`

Je nach Provider wird der Inhalt zusammengefasst als
`0 issue "letsencrypt.org"` eingegeben. Bestehende CAA-Einträge nicht
ungeprüft ersetzen.

### 3. Landing-Subdomain im DNS setzen

Beim DNS-Provider genau diesen Record anlegen:

- Typ: `CNAME`
- Host/Name: `info`
- Ziel/Value: `kqc-real.github.io`
- TTL: Provider-Standard oder `3600`

Nicht eintragen:

- kein `https://`
- keinen Pfad wie `/arsnova.eu`
- keinen abschließenden URL-Slash
- keine A- oder AAAA-Records für `info`
- keine Änderung am Apex/Root `arsnova.eu`

Vorhandene, widersprüchliche Records für `info` müssen entfernt werden. Danach
die öffentliche Auflösung prüfen:

```bash
dig CNAME info.arsnova.eu +short
```

Das Ergebnis muss auf `kqc-real.github.io.` zeigen.

### 4. Custom Domain in GitHub Pages aktivieren

Erst nach erfolgreicher Domain-Verifikation und auflösbarem CNAME:

1. Repository → Settings → Pages öffnen.
2. Unter **Custom domain** `info.arsnova.eu` eintragen und **Save** wählen.
3. Den DNS-Check abwarten.
4. Sobald GitHub das Let's-Encrypt-Zertifikat bereitgestellt hat,
   **Enforce HTTPS** aktivieren.
5. Noch keinen Root-Build deployen, bevor die Prüfungen in Schritt 5
   erfolgreich sind.

Die Aktivierung erfolgt bewusst manuell und nicht vorab per API. Bei dem
Actions-basierten Pages-Deploy ist keine `CNAME`-Datei nötig; GitHub ignoriert
sie bei eigenen Actions-Workflows. Die Zuordnung wird in den Pages-
Einstellungen gespeichert.

### 5. Cutover vor Root-Build und Merge verifizieren

```bash
node --input-type=module -e \
  "import { resolveCname } from 'node:dns/promises'; console.log(await resolveCname('info.arsnova.eu'))"
curl -I http://info.arsnova.eu/
curl -I https://info.arsnova.eu/
curl -I https://kqc-real.github.io/arsnova.eu/
```

Erwartet werden:

- der CNAME `kqc-real.github.io`,
- eine HTTP-Weiterleitung auf `https://info.arsnova.eu/`,
- ein gültiges HTTPS-Zertifikat und eine erfolgreiche HTTPS-Antwort,
- eine `301`-Weiterleitung der bisherigen Projekt-URL auf die Custom Domain.

Zusätzlich unter Settings → Pages prüfen, dass die Domain als verifiziert
angezeigt wird und **Enforce HTTPS** aktiv ist. Der Deploy-Workflow wiederholt
diese Prüfungen als Preflight und bricht vor Installation und Root-Build ab,
wenn eine Cutover-Annahme nicht mehr gilt.

### 6. Root-Build mergen und deployen

Erst jetzt die Workflow-Konfiguration mit
`PUBLIC_SITE_URL=https://info.arsnova.eu/` und `BASE_PATH=/` nach `main`
mergen beziehungsweise produktiv auslösen. Nach dem Deploy prüfen:

```bash
curl -I https://info.arsnova.eu/
curl -I https://info.arsnova.eu/impressum/
curl -I https://info.arsnova.eu/datenschutz/
curl -I https://info.arsnova.eu/robots.txt
curl -I https://info.arsnova.eu/sitemap.xml
```

Im HTML müssen Canonicals und Asset-URLs auf `https://info.arsnova.eu/`
beziehungsweise Root-Pfade zeigen.

### 7. Suchmaschinen umstellen

1. In der Google Search Console eine URL-Präfix-Property für
   `https://info.arsnova.eu/` hinzufügen und verifizieren.
2. `https://info.arsnova.eu/sitemap.xml` einreichen.
3. Stichprobenartig Canonical, Open Graph, `robots.txt` und indexierte URLs
   kontrollieren.

## Rollback und Takeover-Schutz

Wenn die Pages-Zuordnung entfernt oder das Pages-Site deaktiviert wird, den
DNS-CNAME `info` unmittelbar vorher oder gleichzeitig entfernen. Ein
verwaister CNAME darf nicht auf `kqc-real.github.io` zeigen, weil er eine
Domainübernahme begünstigen kann.

Den GitHub-Verifizierungs-TXT-Record beibehalten. Soll die Landing wieder über
die Projekt-Site `kqc-real.github.io/arsnova.eu/` laufen, müssen zusätzlich
`PUBLIC_SITE_URL` und `BASE_PATH` im Build auf diese Projekt-URL bzw.
`/arsnova.eu/` zurückgestellt und neu deployt werden.
