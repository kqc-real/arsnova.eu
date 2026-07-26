# Verschlüsselte Offsite-Backups und Restore

**Stand:** 2026-07-26  
**Gültig für:** W3.6, Ein-Server-Produktion mit `docker-compose.prod.yml`

## Schutzziel und Umfang

Das Backup schützt den dauerhaft relevanten PostgreSQL-Bestand und die für
einen Disaster-Recovery benötigte `.env.production` gegen Verlust des
Produktionshosts. Restic verschlüsselt alle Inhalte clientseitig, bevor sie
über SFTP zu einem separaten Hetzner-Storage-Box-Subaccount übertragen werden.

Nicht Bestandteil des Offsite-Backups:

- Browserseitige Quizbibliotheken: Sie liegen local-first in IndexedDB/Yjs und
  befinden sich nicht auf dem Server.
- Redis: überwiegend TTL-/Live-Daten; die lokale AOF-Persistenz bleibt
  ausreichend. Nach vollständigem Hostverlust müssen Yjs-Links bei Bedarf neu
  geteilt werden.
- Docker-Images, Quellcode, TLS-Zertifikate und Nginx-Vorlagen: Sie sind aus
  Git, Deployment-Dokumentation und Certbot reproduzierbar.
- `pdf_worker_socket`: rein flüchtiges IPC-Volume.

## Verbindliche Betriebsziele

| Ziel                   | Wert                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| RPO                    | höchstens 24 Stunden plus maximal 15 Minuten Zufallsverzögerung    |
| RTO                    | höchstens 4 Stunden ab bereitstehendem Ersatzhost                  |
| Offsite-Retention      | 14 tägliche Restic-Snapshots                                       |
| Backup-Lauf            | täglich 02:30 Uhr Serverzeit, `Persistent=true`                    |
| Automatischer Restore  | erster Sonntag im Monat ab 05:15 Uhr, maximal 30 Minuten verzögert |
| Disaster-Recovery-Test | mindestens vierteljährlich zusätzlich auf einem frischen Testhost  |

Der monatliche Container-Test prüft Dump-Integrität, SHA-256, Wiederherstellung
und Kerntabellen ohne Verbindung zum Produktions-PostgreSQL und ohne dessen
Volume. Der vierteljährliche Test auf einem frischen Host belegt zusätzlich,
dass weder Produktionshost noch dessen lokaler Cache benötigt werden.

Backup und Restore verwenden zusätzlich zu ihren eigenen Reentrancy-Locks
denselben lokalen Repository-Lock `/run/lock/arsnova-restic.lock`. Der Restore
beginnt planmäßig frühestens 30 Minuten nach dem maximal zweistündigen
Backup-Fenster. Damit greift kein zweiter lokaler Restic-Prozess während
`backup`, `forget --prune`, `check` oder `restore` auf das Repository zu.
`--retry-lock` wird bewusst nicht vorausgesetzt, da die von Debian 12
bereitgestellte Restic-Version diese Option noch nicht unterstützt. Das
Repository hat genau einen schreibenden Host; dessen Prozesse werden durch den
gemeinsamen lokalen Lock vollständig serialisiert.

## Storage Box vorbereiten

1. Einen separaten Subaccount ausschließlich für
   `backups/arsnova-production` anlegen. Der Produktionshost erhält nie die
   Zugangsdaten des Storage-Box-Hauptaccounts.
2. Für den Subaccount SFTP/SSH aktivieren. Port 23 verwendet normale
   OpenSSH-Schlüssel.
3. Im Hetzner-Console-Hauptaccount automatische tägliche Snapshots mit allen
   zehn BX11-Slots aktivieren. Der Subaccount kann diese Snapshots nicht
   verwalten; sie begrenzen den Schaden bei Löschung mit dem Upload-Key.
4. Hauptaccount mit 2FA schützen. Das Storage-Box-Passwort nicht auf dem
   Produktionshost hinterlegen.

Snapshots sind eine zusätzliche Rückfallebene innerhalb derselben Storage Box,
kein Ersatz für das Restic-Repository.

## Server einrichten

Pakete und geschützte Verzeichnisse:

```bash
sudo apt update
sudo apt install -y restic openssh-client openssl
sudo install -o root -g root -m 0700 -d \
  /etc/arsnova-backup \
  /var/lib/arsnova-backup \
  /var/lib/arsnova-restore-check \
  /var/cache/arsnova-restic
```

Vorlagen installieren:

```bash
cd /home/deploy/arsnova.eu
sudo install -o root -g root -m 0600 \
  deploy/backup/backup.env.example \
  /etc/arsnova-backup/backup.env
sudo install -o root -g root -m 0600 \
  deploy/backup/ssh_config.example \
  /etc/arsnova-backup/ssh_config
sudo install -o root -g root -m 0750 scripts/backup/arsnova-restic.sh /usr/local/sbin/
sudo install -o root -g root -m 0750 scripts/backup/arsnova-backup.sh /usr/local/sbin/
sudo install -o root -g root -m 0750 scripts/backup/arsnova-restore-check.sh /usr/local/sbin/
sudoedit /etc/arsnova-backup/backup.env
sudoedit /etc/arsnova-backup/ssh_config
```

In `ssh_config` nur Hostname und Benutzer des Subaccounts einsetzen. Das
Repository bleibt ein relativer Pfad im Subaccount:

```text
RESTIC_REPOSITORY=sftp:arsnova-storagebox:backups/arsnova-production
```

Upload-Key und Restic-Passwort erzeugen:

```bash
sudo ssh-keygen -t ed25519 \
  -f /etc/arsnova-backup/storagebox_ed25519 \
  -N '' \
  -C arsnova-eu-production-backup
sudo chmod 0600 /etc/arsnova-backup/storagebox_ed25519

sudo sh -c 'umask 077; openssl rand -base64 48 > /etc/arsnova-backup/restic-password'
```

Den öffentlichen SSH-Key beim Storage-Box-Subaccount hinterlegen. Den
Host-Key-Fingerprint aus der Hetzner Console mit der Ausgabe des ersten
Verbindungsaufbaus vergleichen und erst danach in
`/etc/arsnova-backup/known_hosts` übernehmen. `ssh-keyscan` allein ist kein
vertrauenswürdiger Fingerprint-Beleg.

Das Restic-Passwort sofort zusätzlich in einem organisationsverwalteten
Passwortmanager und in einer getrennten Offline-Notfallkopie speichern. Es
darf weder in Git noch in `.env.production`, Chat, Tickets oder CI-Secrets
landen. Ohne dieses Passwort sind alle Snapshots dauerhaft unlesbar.

Verbindung prüfen und Repository einmalig initialisieren:

```bash
sudo ARSNOVA_BACKUP_CONFIG=/etc/arsnova-backup/backup.env \
  /usr/local/sbin/arsnova-restic.sh snapshots

# Nur wenn die vorherige Ausgabe bestätigt, dass noch kein Repository existiert:
sudo ARSNOVA_BACKUP_CONFIG=/etc/arsnova-backup/backup.env \
  /usr/local/sbin/arsnova-restic.sh init
```

Ein Authentifizierungs-, Host-Key- oder Netzwerkfehler darf nicht durch
`restic init` „repariert“ werden. Zuerst Ziel und Fingerprint korrigieren.

## systemd installieren

```bash
cd /home/deploy/arsnova.eu
sudo install -o root -g root -m 0644 deploy/systemd/arsnova-backup.service /etc/systemd/system/
sudo install -o root -g root -m 0644 deploy/systemd/arsnova-backup.timer /etc/systemd/system/
sudo install -o root -g root -m 0644 deploy/systemd/arsnova-restore-check.service /etc/systemd/system/
sudo install -o root -g root -m 0644 deploy/systemd/arsnova-restore-check.timer /etc/systemd/system/
sudo systemctl daemon-reload

sudo systemctl start arsnova-backup.service
sudo systemctl start arsnova-restore-check.service
sudo systemctl enable --now arsnova-backup.timer arsnova-restore-check.timer
```

Abnahme:

```bash
sudo systemctl status arsnova-backup.service arsnova-restore-check.service
systemctl list-timers arsnova-backup.timer arsnova-restore-check.timer
sudo journalctl -u arsnova-backup.service -u arsnova-restore-check.service -n 100 --no-pager
sudo ARSNOVA_BACKUP_CONFIG=/etc/arsnova-backup/backup.env \
  /usr/local/sbin/arsnova-restic.sh snapshots
sudo cat /var/lib/arsnova-backup/last-success
sudo cat /var/lib/arsnova-restore-check/last-success
```

Die Skripte schreiben keine Secrets in Logs. Das temporäre Staging wird auch
bei Fehlern entfernt. Der Restic-Cache enthält verschlüsselte
Repository-Metadaten, bleibt aber root-only. Die systemd-Services führen nur
die nach `/usr/local/sbin` kopierten, root-eigenen Skripte aus; sie führen
niemals Dateien direkt aus dem vom `deploy`-Benutzer beschreibbaren Git-Checkout
als root aus.

## Disaster-Recovery auf einem frischen Host

1. Debian, Docker, Restic, Git und den aktuellen `main`-Stand bereitstellen.
2. Einen neuen, zeitlich begrenzten Storage-Box-Key im selben Subaccount
   hinterlegen. `backup.env`, `ssh_config`, `known_hosts` und das separat
   verwahrte Restic-Passwort root-only einspielen.
3. Vor Änderungen an Produktion den isolierten Test ausführen:

   ```bash
   cd /home/deploy/arsnova.eu
   sudo install -o root -g root -m 0750 scripts/backup/arsnova-*.sh /usr/local/sbin/
   sudo ARSNOVA_BACKUP_CONFIG=/etc/arsnova-backup/backup.env \
     /usr/local/sbin/arsnova-restore-check.sh
   ```

4. Den neuesten Snapshot in ein root-only Verzeichnis wiederherstellen:

   ```bash
   sudo install -o root -g root -m 0700 -d /var/lib/arsnova-disaster-restore
   sudo ARSNOVA_BACKUP_CONFIG=/etc/arsnova-backup/backup.env \
     /usr/local/sbin/arsnova-restic.sh restore latest \
     --host arsnova-production \
     --tag arsnova-production \
     --target /var/lib/arsnova-disaster-restore
   sudo find /var/lib/arsnova-disaster-restore -type f \
     \( -name postgres.dump -o -path '*/config/env.production' \)
   ```

5. Die wiederhergestellte `env.production` explizit als `deploy:deploy` mit
   Modus `0600` installieren. `sudo install` liest dabei aus dem root-only
   Restore-Ziel, ohne dieses für `deploy` zu öffnen:

   ```bash
   RESTORED_ENV="$(sudo find /var/lib/arsnova-disaster-restore \
     -type f -path '*/config/env.production' -print -quit)"
   test -n "$RESTORED_ENV"
   sudo install -o deploy -g deploy -m 0600 \
     "$RESTORED_ENV" \
     /home/deploy/arsnova.eu/.env.production
   ```

6. Nur PostgreSQL mit einem frischen Volume starten und den Custom-Dump
   einspielen. `sudo cat` öffnet den Dump im root-only Restore-Ziel; mit
   `pipefail` wird ein Lese- oder Restore-Fehler zuverlässig weitergegeben:

   ```bash
   set -euo pipefail
   cd /home/deploy/arsnova.eu
   COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.production)
   DUMP="$(sudo find /var/lib/arsnova-disaster-restore -type f -name postgres.dump -print -quit)"
   test -n "$DUMP"
   "${COMPOSE[@]}" up -d postgres
   sudo cat "$DUMP" | "${COMPOSE[@]}" exec -T postgres sh -eu -c \
     'exec pg_restore --clean --if-exists --exit-on-error --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'
   ```

7. Migrationen und reguläres Deployment ausführen, Healthchecks prüfen und
   erst danach DNS beziehungsweise Traffic umschalten.
8. Temporäre Restore-Dateien sicher löschen und den zeitlich begrenzten
   Recovery-Key widerrufen.

## Schlüsselrotation und Incident

- Upload-Key mindestens jährlich und sofort nach Verdacht auf Hostkompromittierung
  ersetzen. Der Storage-Box-Hauptaccount bleibt der unabhängige Recovery-Pfad.
- Das Restic-Passwort wird nicht routinemäßig „rotiert“: Ein neues Passwort
  schützt keine bereits kompromittierte Repository-Kopie. Bei Verdacht ein
  neues Repository mit neuem Passwort anlegen, einen frischen Snapshot
  schreiben und das alte Repository erst nach erfolgreichem Restore-Test
  ausmustern.
- Bei fehlgeschlagenem Backup den letzten erfolgreichen Snapshot nicht löschen.
  Erst Verbindung, Speicherplatz und Repository mit `restic check` prüfen.
- Bei möglicher Manipulation das Repository nicht prunen. Zuerst
  Storage-Box-Snapshot über den getrennten Hauptaccount sichern und daraus
  untersuchen.
