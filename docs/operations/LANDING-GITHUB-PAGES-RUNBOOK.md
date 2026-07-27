# Landing unter `info.arsnova.eu`

Dieses Runbook aktiviert die Astro-Landing als GitHub-Pages-Custom-Domain. Die
Live-Anwendung unter `https://arsnova.eu` und die DNS-Einträge der Apex-Domain
bleiben unverändert.

## Voraussetzungen

- Der Landing-Workflow ist auf `main` gemergt und erfolgreich durchgelaufen.
- Unter Repository → Settings → Pages ist **GitHub Actions** als Quelle gewählt.
- Die ausführende Person kann DNS-Einträge für `arsnova.eu` und GitHub-Pages-
  Einstellungen verwalten.

## Aktivierungsreihenfolge

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
4. `https://info.arsnova.eu/`, `/robots.txt` und `/sitemap.xml` prüfen.
5. Sobald GitHub das Let's-Encrypt-Zertifikat bereitgestellt hat,
   **Enforce HTTPS** aktivieren.

Die Aktivierung erfolgt bewusst manuell und nicht vorab per API. Bei dem
Actions-basierten Pages-Deploy ist keine `CNAME`-Datei nötig; GitHub ignoriert
sie bei eigenen Actions-Workflows. Die Zuordnung wird in den Pages-
Einstellungen gespeichert.

### 5. Suchmaschinen umstellen

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
