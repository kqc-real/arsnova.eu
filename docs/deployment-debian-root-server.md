# Deployment: arsnova.eu auf Debian Root-Server

> **Stand:** 2026-07-05 — abgeglichen mit `docker-compose.prod.yml`, `.env.production.example`, `scripts/deploy.sh`, Root-[README](../README.md), [ENVIRONMENT.md](ENVIRONMENT.md), [SECURITY-OVERVIEW.md](SECURITY-OVERVIEW.md), [TESTING.md](TESTING.md) und [server-erste-hilfe.md](server-erste-hilfe.md).
>
> **Domain:** Die hier beschriebene Produktionsinstanz ist unter
> https://arsnova.eu erreichbar. Falls bei künftigen Deployments ein
> anderer Hostname verwendet wird, passe die Nginx-Konfiguration sowie
> DNS‑Einträge entsprechend an. Optional kann eine ältere Subdomain per **301**
> auf `https://arsnova.eu` zeigen, falls noch alte URLs in Umlauf sind.
>
> **Incident-Runbook:** Für akute Serverprobleme wie 500er/404, ungültige
> Zertifikate, volle Platte oder Neustarts von Nginx/Docker Compose siehe
> [server-erste-hilfe.md](server-erste-hilfe.md).

Vorschlag für das Deployment auf einem externen Linux-Root-Server (Debian) nach aktuellem Stand der Technik: Let's Encrypt, Firewall, gehärteter Server. **Bei Hetzner** (Cloud oder Root) gelten die gleichen Schritte; Besonderheiten und Vereinfachungen sind in Abschnitt 2.7 und Abschnitt 11 beschrieben.

---

## 0. Editor-Empfehlung: micro

Auf dem Server wirst du Konfigurationsdateien bearbeiten (Nginx, SSH, Docker Compose …). Wir empfehlen **[micro](https://micro-editor.github.io/)** – einen modernen Terminal-Editor, der sich wie ein normaler GUI-Editor anfühlt. Besonders für Mac-User ideal, weil die gewohnten Tastenkürzel funktionieren.

### Installation (immer aktuellste Version)

```bash
curl https://getmic.ro | bash
sudo mv micro /usr/local/bin/
```

### Die wichtigsten Shortcuts

| Aktion     | Shortcut |
| ---------- | -------- |
| Speichern  | Ctrl+S   |
| Beenden    | Ctrl+Q   |
| Suchen     | Ctrl+F   |
| Kopieren   | Ctrl+C   |
| Einfügen   | Ctrl+V   |
| Rückgängig | Ctrl+Z   |

> **⚠️ Achtung Mac-User / VS Code Terminal:** Viele Terminal-Apps (macOS Terminal, iTerm2, und die integrierte VS Code Terminal-Instanz) fangen **Ctrl+Q** ab und schließen das Terminal-Fenster bzw. die SSH-Verbindung, bevor `micro` den Shortcut empfängt. Optionen:
>
> - Kurzfristig: Vor dem ersten `micro`-Start einmal `stty start undef stop undef` ausführen (oder in `~/.zshrc` eintragen):
>
> ```bash
> echo 'stty start undef stop undef' >> ~/.zshrc
> ```
>
> - In VS Code: Preferences → Keyboard Shortcuts (JSON) und diese Zeile einfügen, um `Ctrl+Q` zu deaktivieren:
>
> ```json
> { "key": "ctrl+q", "command": "-workbench.action.quit" }
> ```
>
> - Alternativ immer `Ctrl+S` zum Speichern, dann `Ctrl+Q` nur verwenden, wenn du sicher bist, dass der Terminal-Host das nicht abfängt.

> **Tipp:** Falls `micro` nicht verfügbar ist oder du Konflikte vermeiden willst, verwende `nano` (Speichern: `Ctrl+O`, Beenden: `Ctrl+X`).

Im Rest dieser Anleitung verwenden wir `micro` zum Bearbeiten von Dateien – du kannst jederzeit `nano` oder einen anderen Editor deiner Wahl verwenden.

---

## 1. Übersicht

| Komponente       | Technologie             | Rolle                                         |
| ---------------- | ----------------------- | --------------------------------------------- |
| Reverse Proxy    | Nginx                   | TLS-Terminierung, HTTP→HTTPS, WebSocket-Proxy |
| Zertifikate      | Let's Encrypt (Certbot) | Kostenlose, vertrauenswürdige TLS-Zertifikate |
| Firewall         | UFW                     | Nur benötigte Ports (22, 80, 443)             |
| App + DB + Redis | Docker Compose          | Isolierte Laufzeitumgebung                    |
| Prozess-Manager  | Docker (restart policy) | Automatischer Neustart bei Ausfall            |
| Härtung          | Siehe Abschnitt 2       | SSH, Updates, Fail2ban, minimale Dienste      |

**Port-Mapping (intern):**

- **3000** – HTTP (tRPC + statisches Frontend)
- **3001** – WebSocket (tRPC-Subscriptions)
- **3002** – WebSocket (Yjs Quiz-Sync)

Nach außen werden nur **80** und **443** exponiert; Nginx leitet auf die Container-Ports weiter.

---

## 2. Server-Vorbereitung und Härtung (Debian 12/13)

### 2.1 System aktualisieren

```bash
sudo apt update && sudo apt full-upgrade -y
```

### 2.2 Benutzer und SSH härten

**Dedizierten User für Deployment anlegen** (z. B. `deploy`):

```bash
sudo adduser deploy
sudo usermod -aG docker deploy   # nach Docker-Installation
sudo usermod -aG sudo deploy    # optional, für Admin-Aufgaben
```

**SSH-Schlüsselpaar erstellen (auf deinem Mac):**

Wir empfehlen **Ed25519** – schneller, kürzer und sicherer als RSA.

```bash
ssh-keygen -t ed25519 -C "deploy@arsnova.eu"
```

Du wirst nach einem Speicherort gefragt (Standard: `~/.ssh/id_ed25519`) und optional nach einer Passphrase (empfohlen). Danach den **öffentlichen Schlüssel** auf den Server kopieren:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub deploy@<server-ip>
```

**Testen:** Verbinde dich in einer neuen Terminal-Session per Key:

```bash
ssh deploy@<server-ip>
```

Wenn das funktioniert (kein Passwort nötig), erst **dann** SSH härten.

**SSH härten** – öffne die SSH-Konfiguration **auf dem Server**:

```bash
sudo micro /etc/ssh/sshd_config
```

Setze folgende Werte (oder ergänze sie am Ende):

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

**Wichtig:** Nach jeder Änderung an `/etc/ssh/sshd_config` muss der SSH-Dienst neu gestartet werden:

```bash
sudo systemctl restart sshd
```

> **Tipp:** Teste den SSH-Zugang vorher in einer **zweiten, offenen SSH-Session**, bevor du die erste schließt. Falls die Konfiguration fehlerhaft ist, kannst du über die zweite Session korrigieren, ohne dich auszusperren.

### 2.3 Firewall (UFW)

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp  # HTTP (für Certbot Challenge)
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable
sudo ufw status verbose
```

**Hinweis:** Die App-Ports 3000, 3001, 3002 werden **nicht** in UFW freigegeben; sie sind nur für Nginx auf localhost erreichbar.

### 2.4 Fail2ban (optional, empfohlen)

Schützt SSH vor Brute-Force:

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
# Standard-Jail für sshd ist aktiv
```

### 2.5 Automatische Sicherheits-Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades   # "Yes" wählen
```

### 2.6 Weitere Härtung (Überblick)

- **Kernel:** `sysctl` für z. B. SYN-Cookies, IP-Forwarding nur wenn nötig.
- **Minimale Dienste:** Keine unnötigen Pakete/Dienste installieren; nur SSH, Nginx, Docker.
- **Dateirechte:** App und Konfiguration nur für den `deploy`-User lesbar; Secrets nicht in Repo.

### 2.7 Hetzner (Cloud oder Root-Server)

- **Image:** Debian 12 (oder 13) beim Anlegen des Servers wählen – dann sind die Befehle in diesem Dokument 1:1 anwendbar.
- **Firewall:** Zusätzlich zur UFW (Abschnitt 2.3) bietet die **Hetzner Cloud** eine **Cloud Firewall** in der Konsole (Netzwerk-Ebene). Optional: Regeln dort setzen (SSH 22, HTTP 80, HTTPS 443) und UFW nur als zweite Ebene nutzen oder weglassen. Bei **Root-Servern** nur UFW.
- **SSH vor UFW:** Vor `ufw enable` unbedingt Port 22 freigeben, sonst Aussperrung (bei Cloud: ggf. Konsole/Recovery nutzen).
- **DNS:** Wenn die Domain bei Hetzner (DNS) verwaltet wird: A- und ggf. AAAA-Einträge auf die Server-IP (bzw. IPv6) zeigen lassen, bevor Let's Encrypt läuft.
- **Backups/Snapshots:** In der Hetzner Cloud Snapshots/Backups der Maschine einplanen; für DB-Sicherheit zusätzlich pg_dump (siehe Checkliste 8).

---

## 3. Docker und Docker Compose

```bash
# Offizielle Docker-Installation (Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER   # bzw. deploy
```

Docker Compose V2 ist bei neueren Docker-Installationen enthalten (`docker compose`).

---

## 4. Nginx als Reverse Proxy

### 4.1 Installation

```bash
sudo apt install -y nginx
```

### 4.2 Schritt 1 – Nginx nur mit HTTP starten (für Certbot)

> **Warum zwei Schritte?** Nginx kann nicht starten, wenn in der Konfiguration SSL-Zertifikatspfade stehen, die noch nicht existieren. Deshalb konfigurieren wir Nginx **zuerst nur für Port 80** (HTTP). Darüber kann Certbot dann die Zertifikate beantragen. Erst **danach** (Abschnitt 5.3) ergänzen wir die vollständige HTTPS-Konfiguration.

Ersetze `arsnova.eu` durch deine Domain (falls abweichend).

**Datei erstellen:** `/etc/nginx/sites-available/arsnova-click`

```nginx
# Schritt 1: Nur HTTP – damit Certbot das Zertifikat erstellen kann.
# Den HTTPS-Block fügen wir NACH dem Certbot-Lauf hinzu (siehe Abschnitt 5.3).
server {
    listen 80;
    listen [::]:80;
    server_name arsnova.eu www.arsnova.eu;

    # Certbot braucht diesen Pfad, um die Domain zu verifizieren
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    # Alles andere → HTTPS (funktioniert erst nach Zertifikatserstellung)
    location / {
        return 301 https://$host$request_uri;
    }
}
```

### 4.3 Site aktivieren und testen

```bash
sudo ln -s /etc/nginx/sites-available/arsnova-click /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Wenn `nginx -t` „syntax is ok" meldet, ist alles bereit für Certbot.

---

## 5. Let's Encrypt – TLS-Zertifikat (Certbot)

### 5.1 Certbot installieren

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 5.2 Zertifikat beantragen

**Voraussetzung:** Die Domain muss per DNS (A- und ggf. AAAA-Eintrag) bereits auf die Server-IP zeigen. Das lässt sich z. B. prüfen mit:

```bash
dig arsnova.eu +short    # sollte eure Server-IP zeigen
```

Dann Certbot starten:

```bash
sudo mkdir -p /var/www/certbot
sudo certbot --nginx -d arsnova.eu -d www.arsnova.eu
```

**Was passiert dabei?** Certbot erledigt automatisch drei Dinge:

1. Er verifiziert die Domain über den laufenden HTTP-Server (Port 80).
2. Er erstellt die Zertifikatsdateien unter `/etc/letsencrypt/live/arsnova.eu/`.
3. Er erweitert die Nginx-Konfiguration um einen HTTPS-Block (Port 443) mit den SSL-Pfaden.

Nach dem Lauf steht in `/etc/nginx/sites-available/arsnova-click` bereits ein funktionsfähiger HTTPS-Block.

### 5.3 Schritt 2 – Finale Nginx-Konfiguration (HTTPS + App-Proxy)

Jetzt ergänzen wir die Nginx-Konfiguration um die **Upstreams** (Weiterleitung an die lokal gebundenen Docker-Ports), **Security-Header** und **WebSocket-Proxy-Regeln**.

Öffne `/etc/nginx/sites-available/arsnova-click` und ersetze den gesamten Inhalt durch die vollständige Konfiguration unten.

> **Wichtig:** Die `ssl_certificate`-Pfade unten (`/etc/letsencrypt/live/arsnova.eu/...`) müssen zu deiner Domain passen. Kurz prüfen mit: `ls /etc/letsencrypt/live/`

```nginx
# Upstreams: Docker-Ports sind in docker-compose.prod.yml nur auf 127.0.0.1 gebunden.
upstream app_http {
    server 127.0.0.1:3000;   # HTTP (tRPC + Angular-Frontend)
}

upstream app_ws_trpc {
    server 127.0.0.1:3001;   # WebSocket (tRPC-Subscriptions)
}

upstream app_ws_yjs {
    server 127.0.0.1:3002;   # WebSocket (Yjs Quiz-Sync)
}

# HTTP → HTTPS Redirect
server {
    listen 80;
    listen [::]:80;
    server_name arsnova.eu www.arsnova.eu;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS – verschlüsselter Zugang + WebSocket-Proxy
# Kompatibel mit Debian-12-Nginx; neuere Versionen können dafür eine Deprecation-Warnung zeigen.
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name arsnova.eu www.arsnova.eu;

    ssl_certificate     /etc/letsencrypt/live/arsnova.eu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/arsnova.eu/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    access_log /var/log/nginx/arsnova_click_access.log;
    error_log  /var/log/nginx/arsnova_click_error.log;

    # Infrastruktur-Hard-Cap oberhalb des 2-MiB-tRPC-Limits:
    # tRPC erzeugt dadurch selbst die batch-kompatible HTTP-413-Fehlerantwort.
    client_max_body_size 8m;

    # API + tRPC HTTP + statisches Frontend → App-Container auf Port 3000
    location / {
        proxy_pass http://app_http;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Language $http_accept_language;
    }

    # tRPC WebSocket (Echtzeit-Subscriptions) → Port 3001
    location /trpc-ws {
        proxy_pass http://app_ws_trpc/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Yjs WebSocket (Quiz-Sync zwischen Geräten) → Port 3002
    location /yjs-ws {
        proxy_pass http://app_ws_yjs/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

Hinweis für Nginx **ab 1.25.1**: Falls `nginx -t` wegen `listen ... http2` nur eine Deprecation-Warnung ausgibt, kannst du stattdessen `listen 443 ssl;`, `listen [::]:443 ssl;` und darunter `http2 on;` verwenden.

Konfiguration testen und aktivieren:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

> **Falls `nginx -t` einen Fehler zeigt:** Prüfe, ob die SSL-Pfade existieren (`ls /etc/letsencrypt/live/arsnova.eu/`). Falls nicht, hat Certbot das Zertifikat noch nicht erstellt – zurück zu Abschnitt 5.2.

**Frontend-Anpassung:** Das Frontend erkennt automatisch, ob es in Produktion läuft (HTTPS), und nutzt dann die WebSocket-Pfade `wss://<domain>/trpc-ws` und `wss://<domain>/yjs-ws` (konfiguriert in `apps/frontend/src/app/core/ws-urls.ts`). Keine manuelle Anpassung nötig.

### 5.3.1 Root-URL `/` und Sprachwahl (Accept-Language)

**Verhalten in der App:** Für `GET https://arsnova.eu/` (nur `/`, optional mit Query-String) antwortet der Node-Server mit **302** auf `/{locale}/…`, wobei `locale` aus dem Header **`Accept-Language`** gewählt wird (`de`, `en`, `fr`, `it`, `es`; sonst Fallback `en`). Dafür setzt die Antwort **`Vary: Accept-Language`** und **`Cache-Control: private, no-cache`**, damit zwischengespeicherte Weiterleitungen nicht für alle Nutzer gleich aussehen.

**Nginx:** Standardmäßig reicht der Proxy; der Browser-Header wird an den Upstream durchgereicht. Falls irgendwo Header geändert werden, explizit erhalten:

```nginx
proxy_set_header Accept-Language $http_accept_language;
```

(Ergänzung innerhalb des bestehenden `location / { … }`-Blocks neben den anderen `proxy_set_header`-Zeilen.)

**Optional – reine Nginx-Lösung (nur wenn du ohne Node-Redirect am `/` arbeiten willst):** Du kannst `map` + `rewrite` nur für exakt `/` nutzen; die Locale-Liste muss dann **doppelt** zur App gepflegt werden (fehleranfällig). Empfehlung: Redirect im Backend belassen (eine Quelle der Wahrheit).

**Cloudflare (Worker, Skizze):** Wenn die Seite hinter Cloudflare liegt und `/` am Edge entscheiden soll, ein Worker nur für `GET` und Pfad `/`:

```javascript
// Skizze: gleiche Semantik wie pickLocaleFromAcceptLanguage im Backend
const SUPPORTED = ['de', 'en', 'fr', 'it', 'es'];

function pickLocale(header) {
  if (!header) return 'de';
  for (const part of header.split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase().replace(/_/g, '-').split('-')[0];
    if (SUPPORTED.includes(tag)) return tag;
  }
  return 'de';
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/') {
      return fetch(request);
    }
    const locale = pickLocale(request.headers.get('Accept-Language'));
    url.pathname = `/${locale}/`;
    // Nicht Response.redirect(): so lassen sich Vary/Cache wie am Node-Redirect setzen.
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        Vary: 'Accept-Language',
        'Cache-Control': 'private, no-cache',
      },
    });
  },
};
```

Hinweis: `url.search` bleibt beim Setzen von `pathname` erhalten. **Vary** und **Cache-Control** entsprechen dem Express-Redirect und helfen, dass zwischengespeicherte 302-Antworten nicht sprachfalsch ausgeliefert werden (Edge-Verhalten hängt vom Cloudflare-Setup ab; bei Unsicherheit Worker nur für `/` ohne aggressives Caching nutzen). Ohne Worker leitet Cloudflare an den Ursprung weiter; dann greift weiterhin der **Express-Redirect**.

### 5.4 Automatische Erneuerung

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

Optional nach Erneuerung Nginx neu laden (Certbot macht das oft bereits). Erstelle ein kleines Hook-Skript:

```bash
sudo micro /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Inhalt:

```bash
#!/bin/sh
systemctl reload nginx
```

Ausführbar machen:

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## 6. Produktions-Docker-Compose und Umgebung

### 6.1 Produktions-Compose

Das Repository enthält die aktuelle Produktionsvorlage in [`docker-compose.prod.yml`](../docker-compose.prod.yml). Diese Datei ist die Quelle der Wahrheit; die wichtigsten Eigenschaften:

- `postgres`, `redis` und `app` laufen in einem internen Docker-Netzwerk.
- App-Ports `3000`, `3001`, `3002` sind nur auf `127.0.0.1` gebunden; externer Zugriff läuft ausschließlich über Nginx/TLS.
- `.env.production` wird per `env_file` in die Container geladen. Das vermeidet leere Secrets, wenn `docker compose` ohne Shell-Export gestartet wird.
- Der App-Healthcheck prüft `http://localhost:3000/trpc/health.check`.
- Fixe Laufzeitwerte (`PORT`, `HOST`, `WS_PORT`, `YJS_WS_PORT`, `YJS_WS_HOST`, `NODE_ENV`) sind im Compose bzw. in `.env.production` gesetzt; Secrets und Verbindungsdaten kommen aus `.env.production`.

Start immer mit der Repo-Datei:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 6.2 Umgebungsvariablen (Produktion)

**Datei:** `.env.production` (nicht ins Git, nur auf dem Server). Ausgangspunkt ist [`.env.production.example`](../.env.production.example):

```dotenv
POSTGRES_USER=arsnova_user
POSTGRES_PASSWORD=<starkes-Passwort-setzen>
POSTGRES_DB=arsnova_v3
DATABASE_URL="postgresql://arsnova_user:<starkes-Passwort>@postgres:5432/arsnova_v3?schema=public"
REDIS_URL="redis://redis:6379"
JWT_SECRET=<starker-zufälliger-Schlüssel>
ADMIN_SECRET=<starker-admin-schlüssel>

NODE_ENV=production
PORT=3000
HOST=0.0.0.0
WS_PORT=3001
YJS_WS_PORT=3002
YJS_WS_HOST=0.0.0.0
TRUST_PROXY_HOPS=1

ADMIN_SESSION_TTL_SECONDS=28800
ADMIN_LEGAL_HOLD_DEFAULT_DAYS=30

RATE_LIMIT_SESSION_CODE_ATTEMPTS=20
RATE_LIMIT_SESSION_CODE_WINDOW_MINUTES=5
RATE_LIMIT_SESSION_CODE_LOCKOUT_SECONDS=45
RATE_LIMIT_VOTE_REQUESTS_PER_SECOND=2
RATE_LIMIT_SESSION_CREATE_PER_HOUR=480
RATE_LIMIT_SESSION_CREATE_BYPASS_LOCALHOST=false
RATE_LIMIT_MOTD_GET_CURRENT_PER_MINUTE=1200
RATE_LIMIT_MOTD_GET_CURRENT_BYPASS_LOCALHOST=false
RATE_LIMIT_MOTD_LIST_ARCHIVE_PER_MINUTE=180
RATE_LIMIT_MOTD_RECORD_INTERACTION_PER_MINUTE=120
```

Starke Passwörter und `JWT_SECRET` z. B. mit `openssl rand -base64 32`, `ADMIN_SECRET` mit `openssl rand -base64 48` erzeugen. `HOST_SESSION_TTL_SECONDS` ist optional; fehlt der Wert, nutzt das Backend 8 Stunden.

### 6.3 WebSocket-URLs im Frontend

Die App nutzt die zentrale Konfiguration **`apps/frontend/src/app/core/ws-urls.ts`**:

- **`getTrpcWsUrl()`** – wird vom tRPC-Client verwendet; in Produktion (HTTPS oder Host ≠ localhost) automatisch `wss://<domain>/trpc-ws`.
- **`getYjsWsUrl()`** – für Yjs Multi-Device-Sync (Story 1.6); in Produktion `wss://<domain>/yjs-ws`.

Lokale Entwicklung (localhost) verwendet weiterhin die Ports 3001 und 3002. Keine weiteren Anpassungen nötig.

---

## 7. Deployment-Ablauf

Empfohlen ist das versionierte Deploy-Skript:

```bash
cd /home/deploy/arsnova.eu
DEPLOY_BRANCH=main ./scripts/deploy.sh
```

Das Skript führt aus:

1. Git-Sync auf den Zielbranch.
2. App-Image bauen (`docker compose build --pull app`).
3. PostgreSQL und Redis starten.
4. Prisma-Migrationen mit deaktiviertem App-Entrypoint ausführen (`npx prisma migrate deploy`).
5. App-Container starten.
6. Container-Healthcheck, `health.check` und Frontend-Shell unter `/de/` prüfen.

Optionaler HTTP-Smoke aus Nutzerperspektive:

```bash
npm run verify:production-serving -- https://<domain>
```

**Manueller Fallback** ohne Skript:

```bash
cd /home/deploy/arsnova.eu
docker compose -f docker-compose.prod.yml --env-file .env.production build --pull app
docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres redis
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm --entrypoint "" app /app/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma
docker compose -f docker-compose.prod.yml --env-file .env.production up -d app
```

**Health prüfen:**

```bash
curl -fsS http://127.0.0.1:3000/trpc/health.check
curl -fsS http://127.0.0.1:3000/de/ | grep -qi "<app-root"
curl -fsS https://arsnova.eu/de/ | grep -qi "<app-root"
```

### 7.1 Laufende Quiz-Sessions während eines Deployments

Ein Rollout ersetzt den **App-Container** (Node/tRPC). Das bedeutet:

| Thema                                       | Verhalten                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session, Teilnehmer, abgegebene Stimmen** | Liegen in **PostgreSQL**. Bereits gespeicherte Daten gehen durch einen normalen App-Neustart **nicht** verloren.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **WebSocket / tRPC-Subscriptions**          | Die Verbindung bricht kurz ab. Der **Angular-Client** nutzt `createWSClient` mit **exponentiellem Backoff** (500 ms bis max. 10 s zwischen Versuchen) plus **Zufalls-Jitter** (0–349 ms), um Reconnect-Stürme zu entzerren — `apps/frontend/src/app/core/trpc.client.ts` (Story 4.3). **Lazy Connect** (60 s ohne Subscription → Verbindung zu). Subscriptions werden nach Reconnect wieder aufgebaut. Zusätzlich: **HTTP-Fallback-Polling** (Host ca. 3 s, Spieler ca. 2 s) und bei **Subscription-`onError`** ein sofortiger Resync (Host: ein Poll-Zyklus; Spieler: Session-Info + Frage/Q&A). |
| **HTTP-Mutationen** (z. B. Abstimmen)       | In den wenigen Sekunden des Container-Wechsels können Anfragen **fehlschlagen**; ein **erneuter Versuch** ist üblich und unkritisch, solange die Session dieselbe Frage noch aktiv hat.                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Blitzlicht / Quick Feedback**             | Zustand in **Redis**. Bleibt erhalten, wenn nur die **App** neu startet und der **Redis-Container** weiterläuft. Bei `docker compose down` / Redis-Neustart sind aktive Blitzlicht-Runden **flüchtig** (TTL-Konzept).                                                                                                                                                                                                                                                                                                                                                                             |
| **Emoji-Reaktionen in der Live-Session**    | Werden im Backend **nur im RAM** gehalten — nach App-Neustart **leer**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Prisma `migrate deploy`**                 | Kann die DB kurz **sperren**; bei großen Migrationen Deploy-Zeitfenster planen. Schema-Änderungen ohne kompatible App-Version vermeiden (Blue/Green oder wartungsbedingter Stop).                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Yjs** (`/yjs-ws`, Quiz-Sync zwischen Geräten): Eigener WebSocket — Verbindungsabbruch beim Backend-Neustart analog; Wiederverbindung hängt vom Yjs-Provider im Client ab (siehe `getYjsWsUrl()`).

---

## 8. Checkliste vor Go-Live

- [ ] UFW aktiv, nur 22, 80, 443 offen
- [ ] SSH: kein Root-Login, nur Key-Auth
- [ ] Nginx: TLS 1.2/1.3, HSTS, Security-Headers (Referrer-Policy, Permissions-Policy)
- [ ] Let's Encrypt Zertifikat installiert, Timer für Erneuerung aktiv
- [ ] Docker: App-Ports nur auf 127.0.0.1 gebunden
- [ ] Starke Passwörter, `JWT_SECRET`, `ADMIN_SECRET`; keine Defaults aus `.env.example`
- [ ] `.env.production` entspricht `.env.production.example`; `TRUST_PROXY_HOPS=1` hinter Nginx gesetzt
- [ ] Admin-Login, Legal-Hold, Löschung, Behördenexport, MOTD-Admin und Rekord-Reset getestet
- [ ] Test-Session mit Host-, Present- und Teilnehmergerät inkl. tRPC-WebSocket und Yjs-Sync durchgeführt
- [ ] `health.footerBundle` / Footer-Dot und `health.stats` / Detaildialog prüfen
- [ ] Fail2ban aktiv (optional)
- [ ] Unattended-Upgrades für Sicherheits-Updates
- [ ] Backups für PostgreSQL (z. B. cron + pg_dump) geplant und Restore praktisch getestet

---

## 9. Kurzreferenz Befehle

| Aktion              | Befehl                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy ausführen    | `DEPLOY_BRANCH=main ./scripts/deploy.sh`                                                                                                                                            |
| App starten         | `docker compose -f docker-compose.prod.yml --env-file .env.production up -d app`                                                                                                    |
| Stack starten       | `docker compose -f docker-compose.prod.yml --env-file .env.production up -d`                                                                                                        |
| App stoppen         | `docker compose -f docker-compose.prod.yml --env-file .env.production stop app`                                                                                                     |
| Logs anzeigen       | `docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app`                                                                                                  |
| Migrationen         | `docker compose -f docker-compose.prod.yml --env-file .env.production run --rm --entrypoint "" app /app/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma` |
| Nginx neu laden     | `sudo systemctl reload nginx`                                                                                                                                                       |
| Zertifikat erneuern | `sudo certbot renew` (läuft automatisch per Timer)                                                                                                                                  |

---

## 10. CI/CD (GitHub Actions)

Deployments laufen automatisch, **nur wenn alle CI-Jobs erfolgreich sind** (Build, Lint, Tests, Docker-Build). Standard ist ein Deploy bei **Push auf `main`**; ein eigener Deploy-Branch funktioniert nur, wenn er zusätzlich im Workflow-Trigger steht (siehe 10.4). Pull Requests deployen nicht.

### 10.1 Ablauf

1. Push auf `main` oder einen zusätzlich konfigurierten Deploy-Branch → CI startet (Build, Lint, Tests, Docker Build).
2. Sind alle Jobs grün und die Variable **`DEPLOY_ENABLED`** ist auf `true` gesetzt → **Deploy-Job** startet. **Ohne Server:** `DEPLOY_ENABLED` nicht setzen → Deploy wird übersprungen, CI bleibt grün.
3. Deploy-Job verbindet sich per SSH mit dem Server, synchronisiert den Zielbranch und führt `./scripts/deploy.sh` aus.

### 10.2 Server-Voraussetzung

- Repo auf dem Server geklont (z. B. `/home/deploy/arsnova.eu`).
- Datei `.env.production` im Repo-Verzeichnis (siehe Abschnitt 6.2).
- SSH-Zugang für den User `deploy` (oder gewählten User) mit **Private Key**; der zugehörige **Public Key** liegt in `~/.ssh/authorized_keys` des Servers.
- Der User muss ohne Passwort `docker` und `git` ausführen können (User in Gruppe `docker`, Key-Auth für Git falls nötig).

### 10.3 GitHub Repository Secrets & Variables (Settings → Secrets and variables → Actions)

**Deploy ist standardmäßig aus:** Ohne weitere Einstellung wird der Deploy-Job **übersprungen** (CI bleibt grün). Erst wenn du einen Server bereitstellst, setze die Variable und die Secrets.

| Typ          | Name              | Pflicht          | Beschreibung                                                                                                           |
| ------------ | ----------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Variable** | `DEPLOY_ENABLED`  | Ja (für Deploy)  | Auf `true` setzen, sobald der Server steht und deployt werden soll. Ohne diese Variable: kein Deploy, kein Fehlschlag. |
| Secret       | `DEPLOY_SSH_KEY`  | Ja (wenn Deploy) | Privater SSH-Schlüssel des Deploy-Users (kompletter Inhalt von z. B. `~/.ssh/id_ed25519`).                             |
| Secret       | `DEPLOY_HOST`     | Ja (wenn Deploy) | Hostname oder IP des Servers (z. B. `arsnova.eu` oder `123.45.67.89`).                                                 |
| Secret       | `DEPLOY_USER`     | Ja (wenn Deploy) | SSH-User (z. B. `deploy`).                                                                                             |
| Secret       | `DEPLOY_SSH_PORT` | Nein             | SSH-Port, falls nicht 22 (z. B. `2222`).                                                                               |
| **Variable** | `DEPLOY_DIR`      | Nein             | Pfad zum Repo auf dem Server. Standard: `/home/deploy/arsnova.eu`.                                                     |

**Hinweis:** Unter **Variables** (nicht Secrets) `DEPLOY_DIR` setzen, wenn das Repo woanders liegt.

### 10.4 Eigenen Deploy-Branch nutzen (optional)

Soll nur ein eigener Branch (z. B. `deploy`) deployen statt `main`:

1. In `.github/workflows/ci.yml` im Trigger `branches` um `deploy` erweitern:  
   `push: branches: [main, deploy]`
2. In den Repository-Variablen `DEPLOY_BRANCH=deploy` setzen.
3. Die bestehende Deploy-Bedingung liest `vars.DEPLOY_BRANCH || 'main'`; weitere YAML-Anpassungen sind dafür nicht nötig.

Dann wird nur bei Push auf `deploy` deployt; Merge von `main` → `deploy` löst das Deployment aus.

### 10.5 Manuelles Deploy auf dem Server

Ohne CI (z. B. Hotfix oder bei ausgefallener CI):

```bash
cd /home/deploy/arsnova.eu   # oder $DEPLOY_DIR
git fetch origin && git checkout main && git pull
./scripts/deploy.sh
```

---

## 11. Hetzner: Kurz-Checkliste (ohne eigenen Server)

Wenn ihr bei Hetzner startet und noch keinen Server habt:

1. **Server anlegen:** Hetzner Cloud oder Root – Image **Debian 12** (oder 13). (Optional: Cloud Firewall anlegen mit Regeln für 22, 80, 443.)
2. **Zugang:** Per SSH mit Root (oder angelegtem User); sofort SSH-Keys einrichten, Root-Login/Passwort-Login deaktivieren (Abschnitt 2.2).
3. **Reihenfolge:** System aktualisieren (2.1) → User `deploy` anlegen (2.2) → UFW: 22, 80, 443 erlauben, dann aktivieren (2.3) → Docker (3) → Nginx nur mit HTTP starten (4.2) → Certbot Zertifikat beantragen (5.2) → finale Nginx-Config (5.3) → Repo klonen, `.env.production` anlegen (6.2) → `DEPLOY_BRANCH=main ./scripts/deploy.sh` ausführen (7). Danach CI/CD-Secrets setzen und `DEPLOY_ENABLED=true` (10.3).

**Vereinfachung mit Hetzner:** Es gibt keine speziellen Hetzner-Pakete für diese App – der Stack (Debian + Docker + Nginx + Certbot) ist Standard. Die Hetzner Cloud Firewall ist optional und kann UFW ergänzen oder (wenn gewünscht) ersetzen; UFW auf dem System bleibt für viele Setups die einfachste Option.

**Kleinster Cloud-Server für geringes Lastaufkommen (Erstphase):** Siehe Abschnitt 12.

---

## 12. Hetzner Cloud: Instanzen und voraussichtliche Auslastung

Für die **Erstphase** mit geringem Lastaufkommen reicht die kleinste sinnvolle Instanz (4 GB). Die Werte unten sind **konservative Schätzungen** aus dem aktuellen Architekturstand (ein Node-Prozess, ein WebSocket-Server, Redis, PostgreSQL, Yjs); Basis: `docs/capacity-estimate-16gb-16cores.md` (16 GB = 20–25 Quizze, ~1.000 Teilnehmer). Engpass ist vor allem der Node-Heap für WebSocket-Verbindungen (~1–2 MB pro Client).

### 12.1 Größenklassen

| Größenklasse | Typische Ausstattung | Vorauss. max. gleichz. Quizze (Ø 30 Teiln./Quiz) | Vorauss. max. Teilnehmer (alle verbunden) |
| ------------ | -------------------- | ------------------------------------------------ | ----------------------------------------- |
| Klein        | 2 vCPU / 4 GB RAM    | 3–6                                              | ~150–250                                  |
| Mittel       | 4 vCPU / 8 GB RAM    | 8–12                                             | ~400–600                                  |
| Stabil       | 8 vCPU / 16 GB RAM   | 20–25                                            | ~1.000                                    |
| Groß         | 16 vCPU / 32 GB RAM  | 25–35                                            | ~1.200–1.500                              |

- **Bedeutung:** „Gleichzeitige Quizze“ = Sessions mit Status ≠ `FINISHED`. „Teilnehmer (alle verbunden)“ = gleichzeitig verbundene Clients (praktische Obergrenze). Bei höherer Teilnehmerzahl pro Quiz sinkt die Quiz-Anzahl.
- **CX vs. CAX:** **CX** = x86_64 (Intel/AMD), **CAX** = ARM64 (Ampere Altra). Node.js, Docker, PostgreSQL und Redis laufen grundsätzlich auf beiden Architekturen. **Empfehlung: CX (x86)** für maximale Kompatibilität, weil native npm-Binaries auf ARM vereinzelt mehr Risiko bedeuten.
- **2 vCPU:** Bei hoher Last kann CPU (Node Event-Loop + PostgreSQL) zum Engpass werden; für Dauerlast ab mittlerer Auslastung 4 vCPU oder mehr wählen.
- **Preise:** Anbieterpreise ändern sich. Vor Beschaffung immer die aktuelle Preisliste und den gewünschten Standort prüfen.

### 12.2 Empfehlung nach Phase

| Phase / Last               | Sinnvolle Größenklasse | Ungefährer Bereich                  |
| -------------------------- | ---------------------- | ----------------------------------- |
| Erstphase, geringe Last    | Klein                  | 1–2 Quizze, wenige Teilnehmer       |
| Wachsende Nutzung          | Mittel                 | Mehrere Quizze, bis ~400–600 Teiln. |
| Stabile Produktion         | Stabil                 | Bis ~20–25 Quizze, ~1.000 Teiln.    |
| Hohe Last / viele Sessions | Groß                   | Bis ~35 Quizze, ~1.500 Teiln.       |

- **Aufrüsten ohne Neuinstallation:** In der Hetzner Cloud Console „Resize“ / Servertyp ändern → größeren Typ wählen. Nach Neustart bleiben OS, Docker, App und Daten erhalten. Nur nach oben aufrüsten; Verkleinern oft nicht möglich.

---

## 13. Vergleich: Ein-Server vs. Cluster mit Load Balancer

Für **geringes bis mittleres Lastaufkommen** reicht ein einzelner Server (Abschnitte 1–12). Wenn ihr **höhere Verfügbarkeit**, **horizontale Skalierung** oder **mehr Durchsatz** braucht, kommt ein **Cluster** mit Load Balancer und mehreren App-Instanzen infrage. Kurzvergleich:

### 13.1 Architektur

| Aspekt         | Ein-Server (aktuell)                    | Cluster (Load Balancer + mehrere App-Server)                                                                                                                                                                                                                                                             |
| -------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Einstieg**   | 1 × Nginx (auf demselben Server)        | Load Balancer (Hetzner LB oder eigener Nginx/HAProxy) → mehrere App-Server                                                                                                                                                                                                                               |
| **App**        | 1 × Node (Docker)                       | 2+ × Node (je ein Server oder Container pro Instanz)                                                                                                                                                                                                                                                     |
| **Daten**      | PostgreSQL + Redis auf demselben Server | PostgreSQL + Redis **getrennt** (eigener Server oder Managed DB), von allen App-Instanzen genutzt                                                                                                                                                                                                        |
| **WebSockets** | Direkt zu einer Instanz                 | **Sticky Sessions** nötig: gleicher Client muss immer dieselbe App-Instanz treffen (tRPC-WS, Yjs-WS). Hetzner LB bietet nur Round Robin / Least Connections, **keine** Session-Affinität → daher typisch **eigener Reverse Proxy (Nginx/HAProxy)** mit Sticky (Cookie oder IP-Hash) vor den App-Servern. |

### 13.2 Vor- und Nachteile

|               | Ein-Server                                                                                                   | Cluster                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vorteile**  | Einfach zu betreiben, ein System zu patchen, ein Backup. Geringe Kosten. Keine Sticky-Session-Konfiguration. | Höhere Ausfallsicherheit (eine App-Instanz down → andere übernehmen). Horizontale Skalierung (mehr Instanzen = mehr Verbindungen/Throughput). Getrennte DB ermöglicht unabhängiges Skalieren und Backups. |
| **Nachteile** | Single Point of Failure: Ausfall oder Wartung = Downtime. Skalierung nur vertikal (größerer Server).         | Deutlich mehr Aufwand: mehrere Server, LB, Sticky Sessions, gemeinsame DB/Redis, Deployment auf alle App-Server, ggf. PgBouncer. Höhere Kosten.                                                           |
| **Betrieb**   | Ein Server, ein Docker Compose, ein Nginx.                                                                   | LB + N App-Server + 1 DB-Server (+ optional 1 Redis-Server oder Redis auf DB-Server). CI/CD muss alle App-Server deployen oder über zentralen Platz (shared storage) laufen.                              |

### 13.3 Kosten- und Betriebswirkung

Ein Cluster ist immer spürbar teurer und operativ aufwendiger als ein Ein-Server-Setup: Load Balancer, mehrere App-Instanzen, getrennte Datenhaltung, Backups, Monitoring, Rollout-Koordination und Sticky-Session-Konfiguration kommen hinzu. Er lohnt sich vor allem bei Anforderungen an **Verfügbarkeit** (kein einzelner App-Ausfallpunkt) oder **mehr Last**, als ein großer Ein-Server stemmen kann.

### 13.4 Technische Anforderungen für einen Cluster

- **Sticky Sessions:** Nginx oder HAProxy mit `ip_hash` oder Cookie-basierter Affinität, sodass HTTP und WebSocket eines Clients dieselbe App-Instanz treffen. Ohne Sticky brechen tRPC-Subscriptions und Yjs-Verbindungen beim nächsten Request.
- **Gemeinsame Daten:** PostgreSQL und Redis müssen für alle App-Instanzen erreichbar sein (privates Netzwerk). Redis wird für Rate-Limits, Token-TTLs und Live-Hilfsdaten gemeinsam genutzt.
- **Deployment:** Identischer Code auf allen App-Servern; CI/CD z. B. per Ansible, parallelem SSH oder „golden image“ mit Neuaufsetzen der Instanzen.
- **Zertifikate:** TLS am Load Balancer (Hetzner LB: TLS Termination) oder am zentralen Nginx/HAProxy (Let’s Encrypt wie bisher).

### 13.5 Wann welches Modell?

- **Ein-Server:** Erstphase, geringe bis mittlere Last, einfacher Betrieb, begrenztes Budget. Skalierung durch Resize (größeren Server wählen).
- **Cluster:** Wenn ihr **hohe Verfügbarkeit** (z. B. geplante Wartung ohne komplette Downtime) oder **mehr Last** als ein großer Ein-Server (z. B. CX53) abdeckt braucht, und den höheren Betriebsaufwand und die Kosten in Kauf nehmt.

---

## 14. Cloud-Lösung / Cloud-native (Kubernetes, Managed Services)

„**Cloud-native**“ bedeutet hier: die App in einer **Container-Orchestrierung (Kubernetes)** betreiben und **Managed Services** für Datenbank und Cache nutzen (PostgreSQL, Redis vom Anbieter verwaltet), statt alles selbst auf VMs zu installieren.

### 14.1 Typische Architektur (cloud-native)

| Komponente     | Ein-Server / Cluster (Abschnitt 13)  | Cloud-native                                                                                                                                                                    |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App**        | Docker Compose auf VM(s)             | **Kubernetes**: Deployment mit mehreren Pods (Node-Container), automatische Neustarts, Rolling Updates, horizontaler Autoscaler (HPA) möglich                                   |
| **Einstieg**   | Nginx auf VM oder LB + Nginx         | **Ingress-Controller** (z. B. Nginx Ingress, Traefik) im Cluster, TLS (z. B. cert-manager + Let’s Encrypt), **Sticky Sessions** für WebSockets konfigurierbar                   |
| **PostgreSQL** | Selbst betrieben (Container oder VM) | **Managed PostgreSQL** (z. B. AWS RDS, Google Cloud SQL, Aiven, oder auf Hetzner z. B. externe Anbieter wie Ubicloud) – Backups, Patches, HA vom Anbieter                       |
| **Redis**      | Selbst betrieben im Compose/VM       | **Managed Redis** (z. B. ElastiCache, Redis Cloud, Upstash) oder Redis im K8s (StatefulSet / Operator)                                                                          |
| **Deployment** | SSH + `docker compose` oder Ansible  | **CI/CD** baut Container-Image, pusht in **Container Registry** (GHCR, Docker Hub, GCR, ECR), Kubernetes zieht neues Image (kubectl set image oder GitOps z. B. Argo CD / Flux) |

### 14.2 Vor- und Nachteile (cloud-native)

|                      | Vorteile                                                                                                                                                                            | Nachteile                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kubernetes**       | Automatische Skalierung (mehr Pods bei Last), Self-Healing (abgestürzte Pods werden neu gestartet), Rolling Updates ohne komplette Downtime, deklarative Konfiguration (YAML/Helm). | Hoher Einstieg: Konzepte (Pods, Services, Ingress, ConfigMaps, Secrets), Betrieb und Updates der Control Plane (wenn self-managed). Managed K8s (GKE, EKS, AKS) kostet Aufpreis; auf **Hetzner** gibt es **kein** offizielles Managed Kubernetes – Optionen sind z. B. selbst gebaut (kubeadm, Cluster API, k3s) oder Drittanbieter (z. B. Cloudfleet, Edka). |
| **Managed DB/Redis** | Weniger Betrieb: Backups, Patches, Failover oft inklusive. Weniger eigene Fehlerquellen.                                                                                            | Zusätzliche laufende Kosten, Abhängigkeit vom Anbieter, Daten außerhalb der eigenen VM (Datenschutz/Standort prüfen). **Hetzner** bietet derzeit **keinen** eigenen Managed PostgreSQL/Redis; nutzbar wären z. B. Aiven, Ubicloud (auf Hetzner-Infrastruktur), oder DB in anderer Cloud.                                                                      |

### 14.3 Kostenhinweis (cloud-native)

Cloud-native Betrieb ist nicht primär ein Sparmodell. Rechne mit zusätzlichen Kosten für Control Plane oder zusätzliche Worker, Managed PostgreSQL/Redis, Backups, Netzwerk, Container Registry und Observability. Preise ändern sich je Anbieter und Region; für Beschaffungsentscheidungen immer aktuelle Anbieterpreise und Datenschutzstandort prüfen.

### 14.4 Wann cloud-native sinnvoll ist

- **Sinnvoll**, wenn: ihr **stark skalieren** wollt (viele Instanzen, automatisch), **mehrere Anwendungen** im gleichen Cluster laufen, oder ihr **Managed DB/Redis** wollt und bereits K8s-Know-how habt (oder aufbauen wollt).
- **Eher nicht** für: **Erstphase**, geringe Last, kleines Team, Fokus auf „einfach und günstig“. Dann bleibt Ein-Server (Abschnitt 12) die pragmatische Wahl; Cluster oder cloud-native später nachziehen, wenn Anforderungen steigen.

### 14.5 Kurzvergleich aller Optionen

| Modell                              | Komplexität | Kostenwirkung   | Skalierung                       | Verfügbarkeit                 |
| ----------------------------------- | ----------- | --------------- | -------------------------------- | ----------------------------- |
| **Ein-Server**                      | Niedrig     | Niedrig         | Vertikal (Resize)                | Ein Ausfallpunkt              |
| **Cluster (LB + VMs)**              | Mittel      | Mittel          | Horizontal (mehr App-Server)     | Höher (mehrere App-Instanzen) |
| **Cloud-native (K8s + Managed DB)** | Hoch        | Mittel bis hoch | Horizontal + automatisch möglich | Hoch (K8s + Managed Services) |

Für **arsnova.eu** in der Erstphase reicht der **Ein-Server**; Cluster oder cloud-native lohnen sich, wenn Last oder Anforderungen an Verfügbarkeit und Skalierung wachsen.

---

Dieses Dokument ist als Vorschlag und Referenz gedacht. Die genaue Nginx-Konfiguration (insbesondere WebSocket-Pfade) solltet ihr an eure tatsächlichen Client-Verbindungs-URLs anpassen; bei Bedarf kann das Backend/Frontend so erweitert werden, dass ein gemeinsamer Host und Pfad für HTTP und WebSockets verwendet wird.

**Stand:** 2026-07-05 — im Gleichschritt mit [ENVIRONMENT.md](ENVIRONMENT.md), [TESTING.md](TESTING.md) und [server-erste-hilfe.md](server-erste-hilfe.md) gepflegt.
