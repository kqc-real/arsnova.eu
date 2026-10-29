<!-- markdownlint-disable MD013 MD024 MD029 MD033 MD036 MD060 -->

# Betriebshandbuch: private CPU-Inferenz auf einem zweiten Linux-Host

Stand: 2026-10-29

Dieses Runbook installiert und betreibt die private Open-Weight-LLM-Runtime von
arsnova.eu auf einer **zweiten Linux-Box**. Es ist für Betreiber:innen geschrieben,
die Linux bedienen können, aber keine Betriebsinformatik-Ausbildung haben. Die
Kommandos sind zum Kopieren gedacht. Text in spitzen Klammern wie
`<PRIVATE-IP-DES-APP-HOSTS>` muss vorher ersetzt werden.

Die Anleitung gilt für einen frischen 64-Bit-Host mit **Ubuntu Server 24.04 LTS**
oder **Debian 12/13**. Abweichende Distributionen benötigen eine eigene Prüfung.

## 1. Was am Ende läuft

```text
Browser der Lehrenden
        |
        v
arsnova.eu / App-Host  ── privates Netz, TCP 8080 ──>  CPU-Inferenz-Host
                                                               |
                                                               +-- llama.cpp
                                                               +-- Gemma 3 4B QAT GGUF
```

- Der Inferenz-Host ist **nicht öffentlich** auf Port 8080 erreichbar.
- Nur der App-Host darf den Inferenz-Host auf TCP 8080 erreichen.
- App und Runtime authentifizieren sich zusätzlich mit einem eigenen Secret.
- Das Modell wird einmal heruntergeladen und vor jedem Start per SHA-256 geprüft.
- Es gibt keinen SaaS-Fallback und keinen automatischen Modell-Download beim Start.
- Der Container verwendet höchstens 8 CPUs, 8 GiB RAM, 10 GiB RAM plus Swap und einen Inferenz-Slot.
- Der normale arsnova.eu-Deploy startet oder aktualisiert diese Box nicht.

> **Wichtig:** Ein grüner Runtime-Test ist noch keine allgemeine Produktivfreigabe
> für alle drei Consumer. Für den ersten kurzen Produktivtest `QA_SUMMARY_ENABLED`
> auf `false` lassen und nur die ausdrücklich ausgelöste Lernzielableitung testen.

## 2. Voraussetzungen und Werteblatt

### 2.1 Hardware und Netz

Als praktische Untergrenze gelten:

| Ressource          |             Untergrenze | Empfehlung für Abnahme/Messung |
| ------------------ | ----------------------: | -----------------------------: |
| CPU                | 4 nutzbare 64-Bit-Kerne |                        8 Kerne |
| RAM                |                  12 GiB |                         16 GiB |
| freier Datenträger |                  10 GiB |                         20 GiB |
| Netz               |    private IPv4-Adresse |  eigenes privates Segment/VLAN |

Der Container selbst ist auf 8 CPUs und 8 GiB RAM begrenzt. Die kombinierte
RAM-und-Swap-Grenze liegt bei 10 GiB; Swap ist keine Ersatzkapazität für
zeitkritische Inferenz. Auf dem Produktionshost mit 15 GiB nutzbarem RAM löste
das frühere 5-GiB-Containerlimit am 12.10.2026 bei Batch 3 einer vierteiligen
Demo-Quiz-Ableitung ein Docker-OOM-Ereignis mit automatischem Neustart aus.
Weniger Host-RAM kann zu Swap-Nutzung, hohen Latenzen oder Abbrüchen führen.
GPU-Unterstützung wird nicht verwendet.

Eine Änderung per `docker update` am laufenden Container ist nur eine
Sofortmaßnahme für den aktuellen Container. Beim nächsten Erstellen durch Compose
gelten wieder die Grenzen aus `docker-compose.llm.yml`. Nach jedem Runtime-Deploy
deshalb mit `docker inspect` prüfen, dass `HostConfig.Memory` 8589934592 Byte
und `HostConfig.MemorySwap` 10737418240 Byte beträgt.

Vor dem Beginn müssen diese vier Werte bekannt sein:

| Name                          | Beispiel                                            | Woher kommt der Wert?                                          |
| ----------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| private IP des App-Hosts      | `10.0.0.10`                                         | Hosting-/Netz-Konfiguration des bestehenden arsnova.eu-Servers |
| private IP des Inferenz-Hosts | `10.0.0.20`                                         | Hosting-/Netz-Konfiguration der zweiten Box                    |
| arsnova.eu Git-Commit         | vollständige 40-stellige Commit-ID                  | freigegebener Produktionsstand                                 |
| Runtime-Image                 | `registry.example/arsnova-open-weight-llm@sha256:…` | von Release-Verantwortlichen bereitgestelltes Digest-Image     |

Das Runtime-Image darf **kein bloßer Tag** wie `:latest` sein. Fehlt das
Digest-Image noch, siehe [Anhang A](#anhang-a-runtime-image-einmalig-bauen-und-publizieren).

### 2.2 Was nicht in dieses Runbook gehört

- keine öffentliche Freigabe oder Portweiterleitung für TCP 8080;
- keine Installation auf dem bestehenden 16-GiB-App-Host;
- kein Kubernetes, kein Load Balancer und keine zweite Runtime-Instanz;
- keine Aktivierung aller LLM-Funktionen ohne separate Abnahme;
- keine Secrets in Git, Chat, Tickets oder Shell-Kommandos mit Klartextwerten.

## 3. Vorprüfung auf der zweiten Box

Per SSH auf die neue Box anmelden:

```bash
ssh <ADMIN-BENUTZER>@<PRIVATE-IP-DES-INFERENZ-HOSTS>
```

Die folgenden Befehle nur auf der **zweiten Box** ausführen:

```bash
set -e

echo '=== Betriebssystem ==='
cat /etc/os-release

echo '=== Architektur ==='
dpkg --print-architecture

echo '=== CPU ==='
nproc

echo '=== RAM ==='
free -h

echo '=== freier Speicher ==='
df -h /

echo '=== IP-Adressen ==='
ip -brief address
```

Nicht fortfahren, wenn einer dieser Punkte zutrifft:

- kein Ubuntu 24.04 beziehungsweise Debian 12/13;
- Architektur weder `amd64` noch `arm64`;
- weniger als 12 GiB RAM oder weniger als 10 GiB freier Speicher;
- die vorgesehene Inferenz-IP ist nicht als private Adresse vorhanden;
- der App-Host kann die private Inferenz-IP nicht routen.

## 4. Grundpakete, Docker und Node.js installieren

### 4.1 System aktualisieren

```bash
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y
sudo apt install -y ca-certificates curl git gnupg jq nano openssl procps ufw
```

Falls `/var/run/reboot-required` existiert, jetzt neu starten und erneut anmelden:

```bash
if [ -f /var/run/reboot-required ]; then
  echo 'Neustart erforderlich.'
  sudo reboot
else
  echo 'Kein Neustart erforderlich.'
fi
```

Nach einem Neustart wieder per SSH verbinden.

### 4.2 Docker aus dem offiziellen APT-Repository installieren

Der Block erkennt Ubuntu oder Debian selbst:

```bash
set -e
. /etc/os-release

case "$ID" in
  ubuntu)
    DOCKER_DISTRO='ubuntu'
    DOCKER_SUITE="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
    ;;
  debian)
    DOCKER_DISTRO='debian'
    DOCKER_SUITE="$VERSION_CODENAME"
    ;;
  *)
    echo "Nicht unterstützte Distribution: $ID" >&2
    exit 1
    ;;
esac

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL "https://download.docker.com/linux/${DOCKER_DISTRO}/gpg" \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

ARCH="$(dpkg --print-architecture)"
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/${DOCKER_DISTRO}
Suites: ${DOCKER_SUITE}
Components: stable
Architectures: ${ARCH}
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

Den angemeldeten Benutzer für Docker freischalten:

```bash
sudo usermod -aG docker "$USER"
echo 'Docker-Gruppe eingetragen. Jetzt SSH-Verbindung beenden und neu anmelden.'
exit
```

Neu anmelden und prüfen:

```bash
ssh <ADMIN-BENUTZER>@<PRIVATE-IP-DES-INFERENZ-HOSTS>
docker version >/dev/null
docker compose version
```

> Mitgliedschaft in der Gruppe `docker` entspricht technisch weitgehend
> Root-Rechten. Nur das dafür vorgesehene Administrationskonto aufnehmen.

### 4.3 Node.js 22 installieren

Der arsnova.eu-Produktionswrapper verlangt Node.js `>=22.22.3 <23` oder Node.js `>=24.15.0 <25` (`.npmrc` setzt `engine-strict=true`; mit älteren Versionen bricht `npm ci` mit `EBADENGINE` ab). Dieses Runbook verwendet Node.js 22 aus dem offiziellen NodeSource-DEB-Repo.

```bash
set -e
sudo install -m 0755 -d /usr/share/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | sudo gpg --dearmor --yes -o /usr/share/keyrings/nodesource.gpg
sudo chmod a+r /usr/share/keyrings/nodesource.gpg

ARCH="$(dpkg --print-architecture)"
sudo tee /etc/apt/sources.list.d/nodesource.sources >/dev/null <<EOF
Types: deb
URIs: https://deb.nodesource.com/node_22.x
Suites: nodistro
Components: main
Architectures: ${ARCH}
Signed-By: /usr/share/keyrings/nodesource.gpg
EOF

sudo apt update
sudo apt install -y nodejs
node --version
npm --version
```

Die Node-Ausgabe muss mit `v22.` beginnen und mindestens `v22.22.3` sein.

## 5. Firewall zuerst einrichten

In diesem Abschnitt die beiden Beispielwerte ersetzen. `APP_PRIVATE_IP` ist die
private IP des bestehenden App-Hosts. `LLM_PRIVATE_IP` ist die private IP dieser
zweiten Box.

```bash
export APP_PRIVATE_IP='<PRIVATE-IP-DES-APP-HOSTS>'
export LLM_PRIVATE_IP='<PRIVATE-IP-DES-INFERENZ-HOSTS>'

python3 - "$APP_PRIVATE_IP" "$LLM_PRIVATE_IP" <<'PY'
import ipaddress
import sys

for name, value in zip(('App-Host', 'Inferenz-Host'), sys.argv[1:]):
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        raise SystemExit(f'{name}: keine gültige IP-Adresse: {value!r}')
    if not address.is_private:
        raise SystemExit(f'{name}: keine private IP-Adresse: {address}')
    print(f'{name}: {address} ist privat')
PY
```

Die Firewall so aktivieren, dass SSH erreichbar bleibt und TCP 8080 nur vom
App-Host kommt:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow from "$APP_PRIVATE_IP" to "$LLM_PRIVATE_IP" port 8080 proto tcp
sudo ufw --force enable
sudo ufw status verbose
```

Erwartet werden eine SSH-Regel und genau eine 8080-Regel mit der privaten
App-Host-IP als Quelle. Wenn der Hoster zusätzlich eine Cloud-Firewall oder
Security Group anbietet, dort dieselbe Einschränkung setzen. **Keine** Regel
`8080 from Anywhere` und kein öffentliches DNAT anlegen.

Die Compose-Datei verwendet Host-Networking und keine Docker-Portfreigabe. Die
Firewall bleibt trotzdem verbindlich. Bei anderen Docker-Containern beachten,
dass veröffentlichte Docker-Ports UFW-Regeln umgehen können.

## 6. Freigegebenen arsnova.eu-Stand installieren

Auf der zweiten Box die vollständige freigegebene Commit-ID einsetzen:

```bash
export ARSNOVA_REF='<VOLLSTAENDIGE-40-STELLIGE-GIT-COMMIT-ID>'

case "$ARSNOVA_REF" in
  *[!0-9a-f]*|'')
    echo 'ARSNOVA_REF muss eine kleingeschriebene hexadezimale Commit-ID sein.' >&2
    exit 1
    ;;
esac
if [ "${#ARSNOVA_REF}" -ne 40 ]; then
  echo 'ARSNOVA_REF muss genau 40 Zeichen lang sein.' >&2
  exit 1
fi

sudo install -d -m 0755 -o "$USER" -g "$USER" /opt/arsnova-llm
git clone https://github.com/kqc-real/arsnova.eu.git /opt/arsnova-llm/repository
cd /opt/arsnova-llm/repository
git checkout --detach "$ARSNOVA_REF"
git rev-parse HEAD
npm ci --omit=dev --ignore-scripts
```

`git rev-parse HEAD` muss exakt dieselbe Commit-ID ausgeben. Ein bereits belegtes
Verzeichnis nicht überschreiben; dann zuerst klären, ob dies eine Aktualisierung
ist, und nach [Abschnitt 14](#14-kontrollierte-aktualisierung) vorgehen.

## 7. Gepinntes Modell herunterladen und prüfen

```bash
cd /opt/arsnova-llm/repository
sudo install -d -m 0755 -o "$USER" -g "$USER" \
  /srv/arsnova/models/open-weight-llm

curl --fail --location --retry 3 --retry-delay 5 \
  --output /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf.part \
  https://huggingface.co/unsloth/gemma-3-4b-it-qat-GGUF/resolve/0f80a8ebec6d07600bc3790a042a075527692b49/gemma-3-4b-it-qat-Q4_0.gguf

mv \
  /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf.part \
  /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf
chmod 0444 /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf

node scripts/open-weight-llm/verify-model.mjs \
  docker/open-weight-llm/model-manifest.json \
  /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf
```

Erwartete letzte Zeile:

```text
gemma-3-4b-it-qat-Q4_0.gguf: verified 2370065536 bytes, sha256:6a9baaf400db52a6855d2a0a20a5b4747ea9febbd304b7e2ecd8ab3a20711bb2
```

Geladen wird nur die Text-GGUF. Keinen Multimodal-Projektor danebenlegen oder an `llama-server` übergeben. Eine schon vorhandene `Qwen3-4B-Instruct-2507-Q4_K_M.gguf` bleibt liegen: der Rollback-Checkout in [Abschnitt 14.4](#144-rückkehr-zum-alten-checkout) prüft sie beim Start. Entfernen erst nach bestandener Abnahme, siehe [Anhang D.9](#d9-llm-host-qwen3-gguf-erst-nach-abnahme-entfernen).

Bei Größen- oder Hashfehler die Datei **nicht** verwenden. Die `.part`-Datei
beziehungsweise die fehlerhafte `.gguf` entfernen und erneut herunterladen.
Niemals die erwartete Prüfsumme an eine abweichende Datei anpassen.

## 8. Runtime konfigurieren

### 8.1 Digest-Image bereitstellen

Die von den Release-Verantwortlichen gelieferte unveränderliche Image-Referenz
eintragen. Sie muss mit `@sha256:` und 64 Hex-Zeichen enden:

```bash
export LLM_IMAGE_REF='<REGISTRY>/<IMAGE>@sha256:<64-HEX-ZEICHEN>'

if ! printf '%s\n' "$LLM_IMAGE_REF" \
  | grep -Eq '^.+@sha256:[a-f0-9]{64}$'; then
  echo 'LLM_IMAGE_REF ist keine vollständige Digest-Referenz.' >&2
  exit 1
fi
```

Für eine private Registry jetzt anmelden. Bei einer öffentlichen Registry diesen
Block überspringen. Das Kennwort wird verdeckt abgefragt und erscheint nicht in
der Shell-History:

```bash
read -r -p 'Registry-Benutzer: ' REGISTRY_USER
read -r -s -p 'Registry-Token: ' REGISTRY_TOKEN
echo
printf '%s' "$REGISTRY_TOKEN" \
  | docker login <REGISTRY-HOSTNAME> --username "$REGISTRY_USER" --password-stdin
unset REGISTRY_TOKEN
```

Anschließend das Image über seinen Digest laden:

```bash
docker pull "$LLM_IMAGE_REF"
```

### 8.2 Eigenes Runtime-Secret erzeugen

Das Secret ist **nicht** das JWT-Secret, kein Benutzerkennwort und kein bereits
anderweitig verwendeter Token. Der nächste Block erzeugt einen neuen Wert und
zeigt ihn genau einmal an:

```bash
umask 077
LLM_TOKEN="$(openssl rand -hex 32)"
printf '\nDIESEN WERT JETZT IM PASSWORTMANAGER SPEICHERN:\n%s\n\n' "$LLM_TOKEN"
```

Den angezeigten Wert im Passwortmanager als
`arsnova.eu OPEN_WEIGHT_LLM_TOKEN Produktion` speichern. Er wird später auf dem
App-Host benötigt.

### 8.3 `.env.llm` schreiben

Falls die SSH-Verbindung seit Abschnitt 5 getrennt wurde, zuerst
`LLM_PRIVATE_IP` erneut setzen.

```bash
export LLM_PRIVATE_IP='<PRIVATE-IP-DES-INFERENZ-HOSTS>'
cd /opt/arsnova-llm/repository

test -n "${LLM_IMAGE_REF:-}" || { echo 'LLM_IMAGE_REF fehlt.' >&2; exit 1; }
test -n "${LLM_TOKEN:-}" || { echo 'LLM_TOKEN fehlt.' >&2; exit 1; }

install -m 0600 /dev/null .env.llm
{
  printf 'OPEN_WEIGHT_LLM_IMAGE=%s\n' "$LLM_IMAGE_REF"
  printf 'OPEN_WEIGHT_LLM_MODEL_DIR=%s\n' '/srv/arsnova/models/open-weight-llm'
  printf 'OPEN_WEIGHT_LLM_BIND_ADDRESS=%s\n' "$LLM_PRIVATE_IP"
  printf 'OPEN_WEIGHT_LLM_TOKEN=%s\n' "$LLM_TOKEN"
} >.env.llm
chmod 0600 .env.llm
unset LLM_TOKEN

ls -l .env.llm
grep -E '^(OPEN_WEIGHT_LLM_IMAGE|OPEN_WEIGHT_LLM_MODEL_DIR|OPEN_WEIGHT_LLM_BIND_ADDRESS)=' .env.llm
```

Die letzte Ausgabe darf Image, Modellpfad und private IP zeigen. Das Secret wird
absichtlich nicht ausgegeben.

## 9. Konfiguration prüfen und Runtime starten

```bash
cd /opt/arsnova-llm/repository
npm run llm:prod -- config >/dev/null
npm run llm:prod -- up -d
npm run llm:prod -- ps
```

Der erste Start kann wegen Modellinitialisierung einige Minuten benötigen. Bis zu
vier Minuten beobachten:

```bash
for attempt in $(seq 1 24); do
  STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' arsnova-open-weight-llm 2>/dev/null || true)"
  printf '%s Versuch %02d/24: %s\n' "$(date --iso-8601=seconds)" "$attempt" "$STATUS"
  [ "$STATUS" = 'healthy' ] && break
  sleep 10
done

docker inspect --format 'Status={{.State.Status}} Health={{.State.Health.Status}} Neustarts={{.RestartCount}}' \
  arsnova-open-weight-llm
```

Erwartet:

```text
Status=running Health=healthy Neustarts=0
```

Wenn `unhealthy`, `restarting` oder `exited` erscheint:

```bash
cd /opt/arsnova-llm/repository
npm run llm:prod -- logs --tail=200 open-weight-llm
```

Nicht durch wiederholtes Neustarten übergehen. Erst die konkrete Ursache nach
[Abschnitt 13](#13-fehlersuche) beheben.

## 10. Tests auf dem Inferenz-Host

### 10.1 Bind-Adresse und Ressourcen prüfen

```bash
(
  set -euo pipefail
  cd /opt/arsnova-llm/repository
  LLM_PRIVATE_IP="$(sed -n 's/^OPEN_WEIGHT_LLM_BIND_ADDRESS=//p' .env.llm)"
  LLM_TOKEN="$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.llm)"

  ss -ltnp | grep -F "${LLM_PRIVATE_IP}:8080"
  curl --fail --silent --show-error --max-time 5 \
    --header "Authorization: Bearer $LLM_TOKEN" \
    "http://${LLM_PRIVATE_IP}:8080/health"
  echo
  docker stats --no-stream arsnova-open-weight-llm
)
```

`ss` muss die **private Inferenz-IP**, nicht `0.0.0.0`, `::` oder eine öffentliche
IP anzeigen. Der Health-Aufruf muss HTTP 200 liefern.

### 10.2 Authentifizierung prüfen

Ohne Token muss der geschützte Slot-Endpunkt HTTP 401 liefern:

```bash
(
  set -euo pipefail
  cd /opt/arsnova-llm/repository
  LLM_PRIVATE_IP="$(sed -n 's/^OPEN_WEIGHT_LLM_BIND_ADDRESS=//p' .env.llm)"

  HTTP_CODE="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 \
    "http://${LLM_PRIVATE_IP}:8080/slots?fail_on_no_slot=1")"
  echo "Ohne Token: HTTP $HTTP_CODE"
  test "$HTTP_CODE" = '401'
)
```

Mit Token muss er antworten:

```bash
(
  set -euo pipefail
  cd /opt/arsnova-llm/repository
  LLM_PRIVATE_IP="$(sed -n 's/^OPEN_WEIGHT_LLM_BIND_ADDRESS=//p' .env.llm)"
  LLM_TOKEN="$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.llm)"

  curl --fail --silent --show-error --max-time 5 \
    --header "Authorization: Bearer $LLM_TOKEN" \
    "http://${LLM_PRIVATE_IP}:8080/slots?fail_on_no_slot=1" \
    | jq -e 'type == "array" and length == 1' >/dev/null
  echo 'Mit Token: genau ein Slot erreichbar.'
)
```

Erwartet wird `Mit Token: genau ein Slot erreichbar.`. Jede andere
Antwortstruktur bricht den Block ab.

### 10.3 Künstliche Testinferenz ausführen

Dieser Test enthält absichtlich keine Produktions- oder Personendaten:

```bash
(
  set -euo pipefail
  cd /opt/arsnova-llm/repository
  LLM_PRIVATE_IP="$(sed -n 's/^OPEN_WEIGHT_LLM_BIND_ADDRESS=//p' .env.llm)"
  LLM_TOKEN="$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.llm)"

  RESPONSE="$(curl --fail --silent --show-error --max-time 120 \
    --request POST \
    --header "Authorization: Bearer $LLM_TOKEN" \
    --header 'Content-Type: application/json' \
    --data '{"model":"gemma-3-4b-it-qat-q4_0","messages":[{"role":"system","content":"Antworte nur mit dem Wort bereit."},{"role":"user","content":"Kurzer technischer Bereitschaftstest."}],"temperature":0.2,"max_tokens":8,"stream":false,"cache_prompt":true}' \
    "http://${LLM_PRIVATE_IP}:8080/v1/chat/completions")"
  ANSWER="$(jq -er \
    '.choices[0].message.content | select(type == "string" and length > 0)' \
    <<<"$RESPONSE")"
  printf 'Modellantwort: %s\n' "$ANSWER"
)
```

Nur eine erfolgreiche HTTP-Antwort mit einem nicht leeren String im erwarteten
Antwortfeld bestätigt den Modellpfad. HTTP-Fehler, Timeout, leere Ausgabe,
ungültiges JSON oder ein fehlendes Antwortfeld brechen den Block mit Fehler ab.
Der genaue Wortlaut ist für diesen Infrastrukturtest nicht die fachliche
Qualitätsabnahme.

### 10.4 Health und fünfsprachiges JSON-Schema

`/health` verlangt auf diesem llama.cpp-Build keinen API-Key. Die Completion
prüft Bearer, Alias und ein Objekt mit `de`, `en`, `fr`, `it` und `es`.
Das ist ein Laufzeittest des Servers. Der Produktvertrag der Lernzielableitung
sendet weiterhin eine Locale pro Batch.

```bash
(
  set -euo pipefail
  cd /opt/arsnova-llm/repository
  LLM_PRIVATE_IP="$(sed -n 's/^OPEN_WEIGHT_LLM_BIND_ADDRESS=//p' .env.llm)"
  LLM_TOKEN="$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.llm)"

  curl --fail --silent --show-error --max-time 5 \
    "http://${LLM_PRIVATE_IP}:8080/health"
  echo

  curl --fail --silent --show-error --max-time 90 \
    --request POST \
    --header "Authorization: Bearer ${LLM_TOKEN}" \
    --header 'Content-Type: application/json' \
    --data '{"model":"gemma-3-4b-it-qat-q4_0","messages":[{"role":"system","content":"Return only JSON matching the schema. Write one short observable learning objective per locale."},{"role":"user","content":"Question: What is the slope of y = 2x + 1? Correct answer: 2. Distractors: 1, 3, 4."}],"response_format":{"type":"json_object","schema":{"type":"object","properties":{"de":{"type":"string","minLength":1},"en":{"type":"string","minLength":1},"fr":{"type":"string","minLength":1},"it":{"type":"string","minLength":1},"es":{"type":"string","minLength":1}},"required":["de","en","fr","it","es"],"additionalProperties":false}},"max_tokens":768,"temperature":0.2,"stream":false,"cache_prompt":true}' \
    "http://${LLM_PRIVATE_IP}:8080/v1/chat/completions" \
    | jq -e '.choices[0].finish_reason == "stop" and (.choices[0].message.content | fromjson | has("de") and has("en") and has("fr") and has("it") and has("es"))'
  echo 'Fünfsprachiges Schema: stop und alle fünf Locale-Felder vorhanden.'
)
```

## 11. Verbindung vom App-Host prüfen

Jetzt per SSH auf den **bestehenden App-Host** wechseln:

```bash
ssh <ADMIN-BENUTZER>@<PRIVATE-IP-DES-APP-HOSTS>
```

Zuerst nur das Netz prüfen, ohne die Anwendung zu verändern:

```bash
(
  set -euo pipefail
  LLM_PRIVATE_IP='<PRIVATE-IP-DES-INFERENZ-HOSTS>'
  curl --fail --silent --show-error --max-time 5 \
    "http://${LLM_PRIVATE_IP}:8080/health"
  echo
)
```

Der `/health`-Endpunkt ist im gepinnten llama.cpp-Build nicht selbst die
Authentifizierungsgrenze. Das ist beabsichtigt; Netzsegment und Firewall schützen
ihn. Danach den Token verdeckt aus dem Passwortmanager eingeben und den geschützten
Endpunkt testen:

```bash
(
  set -euo pipefail
  LLM_PRIVATE_IP='<PRIVATE-IP-DES-INFERENZ-HOSTS>'
  read -r -s -p 'OPEN_WEIGHT_LLM_TOKEN aus dem Passwortmanager: ' LLM_TOKEN
  echo
  curl --fail --silent --show-error --max-time 5 \
    --header "Authorization: Bearer $LLM_TOKEN" \
    "http://${LLM_PRIVATE_IP}:8080/slots?fail_on_no_slot=1" \
    | jq -e 'type == "array" and length == 1' >/dev/null
  echo 'App-Host erreicht mit Token genau einen Slot.'
)
```

Erwartet wird `App-Host erreicht mit Token genau einen Slot.`. Zusätzlich muss ein
Zugriff von einem beliebigen anderen Host auf Port 8080 scheitern. Dafür **keine**
öffentliche Firewall-Freigabe zum Testen anlegen.

## 12. App-Host konfigurieren und kurz aktivieren

### 12.1 Zunächst ausgeschaltet konfigurieren

Auf dem App-Host in das Produktionsverzeichnis wechseln. Der Standardpfad ist:

```bash
cd /home/deploy/arsnova.eu
test -f .env.production
test -x scripts/prod-compose.sh
```

Vor der Änderung eine geschützte Sicherung **außerhalb des Git-Checkouts**
anlegen:

```bash
umask 077
BACKUP_DIR="$HOME/.local/state/arsnova/backups"
BACKUP_FILE="$BACKUP_DIR/env.production.before-llm-$(date +%Y%m%d-%H%M%S)"
install -d -m 0700 "$BACKUP_DIR"
cp .env.production "$BACKUP_FILE"
chmod 0600 "$BACKUP_FILE"
printf 'Sicherung: %s\n' "$BACKUP_FILE"
```

Dann bearbeiten:

```bash
nano .env.production
```

Diese vier Variablen suchen und auf genau einen Eintrag je Variable bringen:

```dotenv
OPEN_WEIGHT_LLM_ENABLED=false
OPEN_WEIGHT_LLM_URL=http://<PRIVATE-IP-DES-INFERENZ-HOSTS>:8080
OPEN_WEIGHT_LLM_SOCKET_PATH=
OPEN_WEIGHT_LLM_TOKEN=<SECRET-AUS-DEM-PASSWORTMANAGER>
```

Für den ersten Test außerdem sicherstellen:

```dotenv
QA_SUMMARY_ENABLED=false
```

Speichern mit `Ctrl+O`, Eingabetaste, schließen mit `Ctrl+X`. Danach ohne Ausgabe
des Secrets prüfen:

```bash
chmod 0600 .env.production
grep -E '^(OPEN_WEIGHT_LLM_ENABLED|OPEN_WEIGHT_LLM_URL|OPEN_WEIGHT_LLM_SOCKET_PATH|QA_SUMMARY_ENABLED)=' \
  .env.production
test "$(grep -c '^OPEN_WEIGHT_LLM_TOKEN=' .env.production)" -eq 1
```

Die App mit weiterhin ausgeschaltetem Kill-Switch neu erstellen:

```bash
./scripts/prod-compose.sh up -d app
./scripts/prod-compose.sh ps app
```

### 12.2 Kurzen produktiven Test aktivieren

Erst fortfahren, wenn alle Abschnitte 9 bis 11 erfolgreich waren und eine Person
den Test beobachtet. Den globalen Kill-Switch aktivieren:

```bash
cd /home/deploy/arsnova.eu
sed -i 's/^OPEN_WEIGHT_LLM_ENABLED=.*/OPEN_WEIGHT_LLM_ENABLED=true/' .env.production
test "$(grep -c '^OPEN_WEIGHT_LLM_ENABLED=true$' .env.production)" -eq 1
./scripts/prod-compose.sh up -d app
./scripts/prod-compose.sh ps app
```

Jetzt im Produkt ausschließlich eine Lernzielableitung bewusst durch den Host
auslösen. Nicht parallel `QA_SUMMARY_ENABLED` oder andere optionale LLM-Consumer
aktivieren. Während des Tests in zwei SSH-Fenstern beobachten:

Auf dem App-Host:

```bash
cd /home/deploy/arsnova.eu
./scripts/prod-compose.sh logs --since=10m --follow app
```

Auf dem Inferenz-Host:

```bash
cd /opt/arsnova-llm/repository
npm run llm:prod -- logs --since=10m --follow open-weight-llm
```

In einem dritten Fenster auf dem Inferenz-Host:

```bash
watch -n 2 'docker stats --no-stream arsnova-open-weight-llm'
```

Abbrechen bei Container-Neustarts, wiederholten Timeouts, Speicherknappheit,
unerwarteten Antwortformaten oder Beeinträchtigung der Live-Session.

### 12.3 Nach dem kurzen Test wieder deaktivieren

Solange keine ausdrückliche Dauerfreigabe vorliegt, den Kill-Switch nach dem Test
wieder ausschalten:

```bash
cd /home/deploy/arsnova.eu
sed -i 's/^OPEN_WEIGHT_LLM_ENABLED=.*/OPEN_WEIGHT_LLM_ENABLED=false/' .env.production
test "$(grep -c '^OPEN_WEIGHT_LLM_ENABLED=false$' .env.production)" -eq 1
./scripts/prod-compose.sh up -d app
./scripts/prod-compose.sh ps app
```

Die Runtime darf für weitere Messungen laufen bleiben. Soll sie ebenfalls stoppen:

```bash
cd /opt/arsnova-llm/repository
npm run llm:prod -- stop open-weight-llm
```

Wenn die Rückkehr zu `false` bestätigt ist und kein Rollback mehr benötigt wird,
die genaue Sicherungsdatei aus Abschnitt 12.1 anzeigen und erst nach bewusster
Bestätigung entfernen:

```bash
ls -l "$HOME/.local/state/arsnova/backups"/env.production.before-llm-*
read -r -p 'Exakten vollständigen Pfad der zu löschenden Sicherung eingeben: ' BACKUP_FILE
case "$BACKUP_FILE" in
  "$HOME/.local/state/arsnova/backups/"env.production.before-llm-*) ;;
  *) echo 'Abbruch: Pfad liegt nicht im vorgesehenen Sicherungsverzeichnis.' >&2; exit 1 ;;
esac
test -f "$BACKUP_FILE"
ls -l "$BACKUP_FILE"
read -r -p 'Diese Datei endgültig löschen? Zum Bestätigen LOESCHEN eingeben: ' CONFIRM
if [ "$CONFIRM" = 'LOESCHEN' ]; then
  rm -- "$BACKUP_FILE"
  echo 'Sicherung gelöscht.'
else
  echo 'Nicht gelöscht.'
fi
```

Die Sicherung enthält Produktionssecrets. Sie darf nicht dauerhaft als
Dateileiche liegen bleiben und nie in Git gelangen.

## 13. Fehlersuche

### `OPEN_WEIGHT_LLM_IMAGE must be pinned by sha256 digest`

Ursache: In `.env.llm` steht ein Tag statt einer Digest-Referenz oder der Digest
ist unvollständig.

```bash
grep '^OPEN_WEIGHT_LLM_IMAGE=' /opt/arsnova-llm/repository/.env.llm
```

Eine gültige Referenz endet mit `@sha256:` plus 64 kleingeschriebenen
Hex-Zeichen. Nicht mit `latest` weiterarbeiten.

### `OPEN_WEIGHT_LLM_BIND_ADDRESS must be a private IP literal`

Ursache: Hostname, Loopback, Wildcard oder öffentliche IP eingetragen.

```bash
ip -brief address
grep '^OPEN_WEIGHT_LLM_BIND_ADDRESS=' /opt/arsnova-llm/repository/.env.llm
```

Eine tatsächlich am Host vorhandene RFC1918-Adresse verwenden, zum Beispiel
`10.x.x.x`, `172.16.x.x` bis `172.31.x.x` oder `192.168.x.x`.

### `GGUF size mismatch` oder `GGUF digest mismatch`

Ursache: unvollständiger oder falscher Modell-Download. Runtime nicht starten.

```bash
mv \
  /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf \
  "/srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf.defekt-$(date +%Y%m%d-%H%M%S)"
```

Danach Abschnitt 7 wiederholen. Die umbenannte defekte Datei erst nach
erfolgreicher Verifikation der neuen Datei und ausdrücklicher Bestätigung
löschen.

### Container bleibt `starting`

Die erste Modellinitialisierung kann bis zum Healthcheck-Startfenster von 180
Sekunden dauern. Danach Logs und Ressourcen prüfen:

```bash
cd /opt/arsnova-llm/repository
npm run llm:prod -- logs --tail=200 open-weight-llm
free -h
df -h / /srv/arsnova/models/open-weight-llm
(
  set -o pipefail
  docker inspect --format '{{json .State.Health}}' arsnova-open-weight-llm | jq
)
```

### App-Host erhält Timeout oder `Connection refused`

Auf dem Inferenz-Host:

```bash
sudo ufw status numbered
ss -ltnp | grep ':8080'
docker inspect --format '{{.State.Health.Status}}' arsnova-open-weight-llm
```

Auf dem App-Host:

```bash
ip route get <PRIVATE-IP-DES-INFERENZ-HOSTS>
curl --verbose --max-time 5 http://<PRIVATE-IP-DES-INFERENZ-HOSTS>:8080/health
```

Keine öffentliche Portfreigabe als Abkürzung einrichten.

### HTTP 401 am geschützten Endpunkt

Die Tokens auf beiden Hosts stimmen nicht überein. Sie nicht ausgeben, sondern
Hashwerte vergleichen:

Auf dem Inferenz-Host:

```bash
sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' /opt/arsnova-llm/repository/.env.llm \
  | sha256sum
```

Auf dem App-Host:

```bash
sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' /home/deploy/arsnova.eu/.env.production \
  | sha256sum
```

Nur wenn beide Hashwerte identisch sind, sind die Tokens gleich. Bei Abweichung
das Passwortmanager-Original erneut verdeckt eintragen und beide Dienste
kontrolliert neu erstellen.

### Host wird langsam oder nutzt Swap

```bash
free -h
vmstat 2 10
docker stats --no-stream arsnova-open-weight-llm
```

Nicht die 8-GiB-RAM- oder 10-GiB-RAM-plus-Swap-Grenze erhöhen, ohne Abnahme und
Dokumentation. Zuerst den App-Kill-Switch ausschalten und den Runtime-Container
stoppen.

## 14. Kontrollierte Aktualisierung

Ein Update ist eine geplante Wartung. Nie unbemerkt `git pull`, einen beweglichen
Image-Tag oder eine ungeprüfte neue Modelldatei verwenden. Der aktive Checkout
bleibt immer unter `/opt/arsnova-llm/repository`. Dadurch bleibt auch der von
Docker Compose aus dem Verzeichnis abgeleitete Projektname `repository` stabil.

### 14.1 App-Consumer vor der Wartung ausschalten

Auf dem App-Host:

```bash
set -e
cd /home/deploy/arsnova.eu
sed -i 's/^OPEN_WEIGHT_LLM_ENABLED=.*/OPEN_WEIGHT_LLM_ENABLED=false/' .env.production
test "$(grep -c '^OPEN_WEIGHT_LLM_ENABLED=false$' .env.production)" -eq 1
./scripts/prod-compose.sh up -d app
./scripts/prod-compose.sh ps app
```

### 14.2 Neuen Checkout vollständig vorbereiten

Auf dem Inferenz-Host den neuen freigegebenen Commit einsetzen:

```bash
set -euo pipefail
NEW_REF='<VOLLSTAENDIGE-40-STELLIGE-NEUE-GIT-COMMIT-ID>'
case "$NEW_REF" in
  *[!0-9a-f]*|'') echo 'Ungültige Commit-ID.' >&2; exit 1 ;;
esac
test "${#NEW_REF}" -eq 40

ACTIVE_DIR='/opt/arsnova-llm/repository'
NEW_DIR="/opt/arsnova-llm/release-${NEW_REF}"
test -d "$ACTIVE_DIR/.git"
test ! -e "$NEW_DIR"

git clone https://github.com/kqc-real/arsnova.eu.git "$NEW_DIR"
git -C "$NEW_DIR" checkout --detach "$NEW_REF"
test "$(git -C "$NEW_DIR" rev-parse HEAD)" = "$NEW_REF"
cd "$NEW_DIR"
npm ci --omit=dev --ignore-scripts

install -m 0600 "$ACTIVE_DIR/.env.llm" .env.llm
npm run llm:prod -- config >/dev/null
```

Jetzt bei Bedarf in `"$NEW_DIR/.env.llm"` ausschließlich die freigegebene neue
Digest-Image-Referenz eintragen und gegebenenfalls das neue, separat verifizierte
Modell bereitstellen. `npm run llm:prod -- config` rendert danach nur die
Compose-Datei. Image-Digest, private Bind-Adresse, Credential, Modellpfad sowie
GGUF-Größe und -Hash prüft `scripts/open-weight-llm/prod-compose.mjs` erst bei
`create`, `restart`, `run`, `start` und `up`
(`scripts/open-weight-llm/prod-compose-policy.mjs`). Vor dem `down` in
Abschnitt 14.3 den Preflight aus [Anhang D.4](#d4-llm-host-preflight-vor-dem-abschalten) ausführen, inklusive `docker pull` des Digest-Images.

### 14.3 Alten Container entfernen und Checkout wechseln

`stop` allein genügt hier nicht: Der feste Containername muss vor dem Wechsel aus
dem alten Compose-Projekt entfernt werden. Der folgende Block verwendet deshalb
`down`, behält den alten Checkout als direkten Rollback und stellt anschließend
den neuen Checkout unter dem unveränderten kanonischen Pfad bereit. Für die
Gemma-Umstellung diesen Block nicht direkt ausführen. Zuerst
[Anhang D.0](#d0-app-host-consumer-ausschalten) bis
[D.4](#d4-llm-host-preflight-vor-dem-abschalten): der Preflight muss grün sein,
bevor die alte Runtime endet. `config` ersetzt diese Prüfung nicht.

```bash
set -euo pipefail
ACTIVE_DIR='/opt/arsnova-llm/repository'
NEW_REF='<VOLLSTAENDIGE-40-STELLIGE-NEUE-GIT-COMMIT-ID>'
NEW_DIR="/opt/arsnova-llm/release-${NEW_REF}"
OLD_REF="$(git -C "$ACTIVE_DIR" rev-parse HEAD)"
ROLLBACK_DIR="/opt/arsnova-llm/rollback-${OLD_REF}"

test -d "$NEW_DIR/.git"
test "$(git -C "$NEW_DIR" rev-parse HEAD)" = "$NEW_REF"
test ! -e "$ROLLBACK_DIR"
printf 'Rollback-Commit für eine mögliche Rückkehr: %s\n' "$OLD_REF"

cd "$ACTIVE_DIR"
npm run llm:prod -- down
cd /opt/arsnova-llm
mv repository "rollback-${OLD_REF}"
mv "release-${NEW_REF}" repository

cd /opt/arsnova-llm/repository
npm run llm:prod -- up -d
npm run llm:prod -- ps
```

Danach Abschnitte 9 bis 11 vollständig wiederholen. Erst anschließend darf ein
zeitlich begrenzter App-Test wieder aktiviert werden.

### 14.4 Rückkehr zum alten Checkout

Falls der neue Stand nicht abgenommen wird, auf dem App-Host den Kill-Switch auf
`false` belassen. Auf dem Inferenz-Host die beim Wechsel ausgegebene alte
Commit-ID einsetzen. Die vorherige GGUF muss noch unter
`/srv/arsnova/models/open-weight-llm/` liegen, weil das alte Manifest sie vor
dem Start per Größe und SHA-256 prüft. Ohne diese Datei ist der Rollback kein
Start, sondern ein mehrgigabytegroßer Notfall-Download.

```bash
set -euo pipefail
OLD_REF='<VOLLSTAENDIGE-40-STELLIGE-ALTE-GIT-COMMIT-ID>'
ACTIVE_DIR='/opt/arsnova-llm/repository'
ROLLBACK_DIR="/opt/arsnova-llm/rollback-${OLD_REF}"
FAILED_REF="$(git -C "$ACTIVE_DIR" rev-parse HEAD)"
FAILED_DIR="/opt/arsnova-llm/failed-${FAILED_REF}"

test -d "$ROLLBACK_DIR/.git"
test "$(git -C "$ROLLBACK_DIR" rev-parse HEAD)" = "$OLD_REF"
test ! -e "$FAILED_DIR"

cd "$ACTIVE_DIR"
npm run llm:prod -- down
cd /opt/arsnova-llm
mv repository "failed-${FAILED_REF}"
mv "rollback-${OLD_REF}" repository

cd /opt/arsnova-llm/repository
npm run llm:prod -- up -d
npm run llm:prod -- ps
```

Abschnitte 9 bis 11 erneut ausführen. Erst nach bestätigtem stabilen Betrieb die
genau benannten `failed-…`- oder alten Rollback-Verzeichnisse nach gesonderter
Bestätigung entfernen.

Der Container-Neustart nach einem geplanten Host-Reboot wird durch
`restart: always` übernommen. Danach trotzdem prüfen:

```bash
docker inspect --format 'Status={{.State.Status}} Health={{.State.Health.Status}} Neustarts={{.RestartCount}}' \
  arsnova-open-weight-llm
```

## 15. Sofort-Rollback

Der sichere Rückweg benötigt keine Datenbankmigration.

### Schritt 1: Consumer auf dem App-Host ausschalten

```bash
cd /home/deploy/arsnova.eu
sed -i 's/^OPEN_WEIGHT_LLM_ENABLED=.*/OPEN_WEIGHT_LLM_ENABLED=false/' .env.production
./scripts/prod-compose.sh up -d app
./scripts/prod-compose.sh ps app
```

### Schritt 2: Runtime auf der zweiten Box stoppen

```bash
cd /opt/arsnova-llm/repository
npm run llm:prod -- stop open-weight-llm
npm run llm:prod -- ps
```

### Schritt 3: Zustand dokumentieren

Notieren: Zeitpunkt, Git-Commit, Image-Digest, Containerstatus, beobachteter Fehler
und ob der App-Kill-Switch erfolgreich `false` ist. Keine Prompts, Antworten,
Tokens oder `.env`-Inhalte in das Ticket kopieren.

## 16. Regelbetrieb

### Täglich während einer Testphase

```bash
docker inspect --format 'Status={{.State.Status}} Health={{.State.Health.Status}} Neustarts={{.RestartCount}}' \
  arsnova-open-weight-llm
docker stats --no-stream arsnova-open-weight-llm
```

### Nach jedem Host-Reboot

```bash
systemctl is-active docker
docker inspect --format 'Status={{.State.Status}} Health={{.State.Health.Status}} Neustarts={{.RestartCount}}' \
  arsnova-open-weight-llm
```

### Logs der letzten Stunde

```bash
cd /opt/arsnova-llm/repository
npm run llm:prod -- logs --since=1h open-weight-llm
```

### Was gesichert werden muss

- das Runtime-Secret im Passwortmanager;
- die freigegebene Git-Commit-ID;
- die vollständige Runtime-Image-Digest-Referenz;
- die private Netz- und Firewall-Konfiguration.

Das GGUF kann aus der revisionsgebundenen URL erneut geladen und gegen den
versionierten SHA-256 verifiziert werden. Container und Modell enthalten keine
Nutzerdaten und brauchen kein klassisches Datenbackup.

## 17. Abnahmeprotokoll

Vor einer zeitlich begrenzten Aktivierung alle Kästchen abhaken:

- [ ] Unterstütztes 64-Bit-Linux, mindestens 12 GiB RAM und 10 GiB frei
- [ ] App- und Inferenz-Host besitzen private, geroutete IP-Adressen
- [ ] TCP 8080 ist nur vom App-Host erlaubt und nicht öffentlich weitergeleitet
- [ ] Freigegebener Git-Commit ist vollständig dokumentiert
- [ ] Runtime-Image ist per Registry-Digest gepinnt
- [ ] GGUF-Größe und SHA-256 stimmen exakt
- [ ] `.env.llm` hat Modus `0600`; Secret liegt zusätzlich im Passwortmanager
- [ ] Container ist `running`, `healthy`, Neustartzahl 0
- [ ] geschützter Endpunkt liefert ohne Token HTTP 401
- [ ] geschützter Endpunkt liefert mit Token genau einen Slot
- [ ] künstliche Testinferenz war erfolgreich
- [ ] Verbindung vom App-Host war erfolgreich
- [ ] `QA_SUMMARY_ENABLED=false`
- [ ] Rückrollbefehle liegen bereit
- [ ] Beobachter:in und Testzeitraum sind benannt
- [ ] nach dem Test ist `OPEN_WEIGHT_LLM_ENABLED=false`, sofern keine Dauerfreigabe vorliegt

Für eine reale Betriebsabnahme zusätzlich Hardware, Containergrenzen, Git- und
Image-Digest, Modell-Digest, Prompt-/Completion-Tokenzahlen, Prefill/TTFT,
Gesamtlatenz, Tokens pro Sekunde, Peak-/stabilen RSS, Kalt-/Warmlauf, Slotstatus,
Timeout und Fallback dokumentieren. Die Abnahmekriterien stehen in
[`ISSUE-456-SLICE-8-ABNAHME.md`](../implementation/ISSUE-456-SLICE-8-ABNAHME.md).

## Anhang A: Runtime-Image einmalig bauen und publizieren

Dieser Abschnitt ist für Release-Verantwortliche. Wenn bereits eine freigegebene
Digest-Referenz vorliegt, diesen Anhang überspringen.

Die Registry benötigt einen eigenen Image-Namen, zum Beispiel
`ghcr.io/kqc-real/arsnova-open-weight-llm`. Für GHCR muss das verwendete Token
Pakete schreiben dürfen.

```bash
cd /opt/arsnova-llm/repository
export IMAGE_REPOSITORY='ghcr.io/kqc-real/arsnova-open-weight-llm'
export IMAGE_TAG="server-b10524-$(git rev-parse --short=12 HEAD)"
export IMAGE_REF="${IMAGE_REPOSITORY}:${IMAGE_TAG}"

docker build --pull \
  --file docker/open-weight-llm/Dockerfile \
  --tag "$IMAGE_REF" \
  docker/open-weight-llm
```

Anmelden, ohne das Token in die Shell-History zu schreiben:

```bash
read -r -p 'GHCR-Benutzername: ' GHCR_USER
read -r -s -p 'GHCR-Token mit write:packages: ' GHCR_TOKEN
echo
printf '%s' "$GHCR_TOKEN" \
  | docker login ghcr.io --username "$GHCR_USER" --password-stdin
unset GHCR_TOKEN
```

Pushen, anschließend über die Registry zurückholen und die Digest-Referenz
ausgeben:

```bash
docker push "$IMAGE_REF"
docker pull "$IMAGE_REF"

LLM_IMAGE_REF="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$IMAGE_REF" \
  | grep -F "${IMAGE_REPOSITORY}@sha256:" \
  | head -n 1)"

test -n "$LLM_IMAGE_REF"
printf 'Freizugebende Digest-Referenz:\n%s\n' "$LLM_IMAGE_REF"
```

Diese vollständige Ausgabe wird in `.env.llm` verwendet. Das Image erbt die
gepinnten llama.cpp-Basisbytes aus
[`docker/open-weight-llm/model-manifest.json`](../../docker/open-weight-llm/model-manifest.json)
und enthält die arsnova.eu-Validierungs- und Healthcheck-Skripte. Ein lokal
gebautes Image ohne Registry-Digest genügt dem Produktionswrapper absichtlich
nicht.

## Anhang B: Referenzen

- [Technischer Runtime-Vertrag](../features/open-weight-llm-runtime.md)
- [Produktions-Compose](../../docker-compose.llm.yml)
- [Beispielkonfiguration](../../.env.llm.example)
- [Modellmanifest](../../docker/open-weight-llm/model-manifest.json)
- [Docker Engine auf Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker Engine auf Debian](https://docs.docker.com/engine/install/debian/)
- [NodeSource-DEB-Distributionen](https://github.com/nodesource/distributions)
- [Anhang D: Gemma-Umstellung, Copy-and-Paste](#anhang-d-gemma-umstellung-copy-and-paste-für-das-review)

## Anhang C: Nativer llama-server statt Compose

Der kanonische Betrieb bleibt `npm run llm:prod`. Dieser Anhang ist nur der
alternative Debian-Dienst, wenn auf dem dedizierten Host kein Docker läuft.
Die Binärdatei muss llama.cpp `server-b10524` sein und unter
`/usr/local/bin/llama-server` liegen. Dieselben Hartflags wie
`docker/open-weight-llm/entrypoint.sh` verwenden. Keinen Multimodal-Projektor
laden.

```bash
sudo useradd --system --home /srv/arsnova --shell /usr/sbin/nologin arsnova-llm
sudo install -d -m 0755 -o arsnova-llm -g arsnova-llm /srv/arsnova/models/open-weight-llm
sudo tee /etc/systemd/system/llama-server.service >/dev/null <<'EOF'
[Unit]
Description=arsnova open-weight llama-server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=arsnova-llm
Group=arsnova-llm
EnvironmentFile=/opt/arsnova-llm/repository/.env.llm
ExecStart=/usr/local/bin/llama-server --model /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf --alias gemma-3-4b-it-qat-q4_0 --parallel 1 --ctx-size 8192 --batch-size 2048 --ubatch-size 512 --n-predict 768 --threads 8 --threads-batch 8 --flash-attn on --cache-reuse 256 --no-webui --slots --api-key ${OPEN_WEIGHT_LLM_TOKEN} --reasoning off --n-gpu-layers 0 --slot-prompt-similarity 0 --jinja --offline --host ${OPEN_WEIGHT_LLM_BIND_ADDRESS} --port 8080
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadOnlyPaths=/srv/arsnova/models/open-weight-llm
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now llama-server.service
sudo systemctl status llama-server.service --no-pager
```

## Anhang D: Gemma-Umstellung, Copy-and-Paste für das Review

Dieser Anhang bündelt die Befehle der Umstellung von Qwen3-4B auf Gemma 3 4B QAT.
Jeder Block ist eine eigene Shell: Platzhalter in diesem Block ersetzen, auch wenn
derselbe Wert schon in einem früheren Block stand. Die Überschrift nennt den Host.
`<NEUER-40-STELLIGER-COMMIT>` ist der freigegebene Stand mit diesem Pin und zugleich
`DEPLOY_SHA` auf dem App-Host. Der Alias `gemma-3-4b-it-qat-q4_0` steckt im Backend
und nicht in einer Env-Variable. App-Image und LLM-Host müssen denselben Stand
fahren. `--ctx-size` bleibt 8192. Den Consumer erst in D.8 wieder einschalten, nach
grünem LLM-Smoke-Test und nachgewiesenem neuen App-Image.

### D.0 App-Host: Consumer ausschalten

Zuerst hier, danach erst auf dem LLM-Host. Solange die alte App eingeschaltet ist,
fragt sie während des Runtime-Wechsels weiter an und spricht danach noch den
Qwen-Alias.

```bash
set -euo pipefail
cd /home/deploy/arsnova.eu
test -f .env.production

if grep -q '^OPEN_WEIGHT_LLM_ENABLED=' .env.production; then
  sed -i 's/^OPEN_WEIGHT_LLM_ENABLED=.*/OPEN_WEIGHT_LLM_ENABLED=false/' .env.production
else
  printf '\nOPEN_WEIGHT_LLM_ENABLED=false\n' >>.env.production
fi
test "$(grep -c '^OPEN_WEIGHT_LLM_ENABLED=false$' .env.production)" -eq 1

./scripts/prod-compose.sh up -d --force-recreate --no-deps app

STATUS='missing'
for attempt in $(seq 1 24); do
  STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' arsnova-v3-app 2>/dev/null || true)"
  printf '%s Versuch %02d/24: %s\n' "$(date --iso-8601=seconds)" "$attempt" "$STATUS"
  if [ "$STATUS" = 'healthy' ]; then
    break
  fi
  sleep 10
done
if [ "$STATUS" != 'healthy' ]; then
  echo 'App nach 24 Versuchen nicht healthy. LLM-Host nicht anfassen.' >&2
  ./scripts/prod-compose.sh logs --tail=200 app || true
  exit 1
fi
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3000/trpc/health.check >/dev/null
echo 'App-Host: Consumer aus, Health ok. Weiter mit D.1 auf dem LLM-Host.'
```

### D.1 LLM-Host: Checkout und Modellverzeichnis

```bash
set -euo pipefail
NEW_REF='<NEUER-40-STELLIGER-COMMIT>'
case "$NEW_REF" in *[!0-9a-f]*|'') echo 'Ungültige Commit-ID.' >&2; exit 1 ;; esac
test "${#NEW_REF}" -eq 40

ACTIVE_DIR='/opt/arsnova-llm/repository'
NEW_DIR="/opt/arsnova-llm/release-${NEW_REF}"
test -d "$ACTIVE_DIR/.git"
test ! -e "$NEW_DIR"

git clone https://github.com/kqc-real/arsnova.eu.git "$NEW_DIR"
git -C "$NEW_DIR" checkout --detach "$NEW_REF"
test "$(git -C "$NEW_DIR" rev-parse HEAD)" = "$NEW_REF"
cd "$NEW_DIR"
npm ci --omit=dev --ignore-scripts
install -m 0600 "$ACTIVE_DIR/.env.llm" .env.llm

sudo install -d -m 0755 -o "$USER" -g "$USER" /srv/arsnova/models/open-weight-llm
```

### D.2 LLM-Host: Download und SHA-256

Die vorhandene Qwen3-Datei nicht löschen. Sie bleibt der Rollback-Pfad, bis
[D.9](#d9-llm-host-qwen3-gguf-erst-nach-abnahme-entfernen) nach der Abnahme
ausdrücklich bestätigt wird.

```bash
set -euo pipefail
NEW_REF='<NEUER-40-STELLIGER-COMMIT>'
case "$NEW_REF" in *[!0-9a-f]*|'') echo 'Ungültige Commit-ID.' >&2; exit 1 ;; esac
test "${#NEW_REF}" -eq 40
cd "/opt/arsnova-llm/release-${NEW_REF}"

curl --fail --location --retry 3 --retry-delay 5 \
  --output /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf.part \
  https://huggingface.co/unsloth/gemma-3-4b-it-qat-GGUF/resolve/0f80a8ebec6d07600bc3790a042a075527692b49/gemma-3-4b-it-qat-Q4_0.gguf

mv /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf.part \
  /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf
chmod 0444 /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf

node scripts/open-weight-llm/verify-model.mjs \
  docker/open-weight-llm/model-manifest.json \
  /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf
```

Erwartete letzte Zeile:

```text
gemma-3-4b-it-qat-Q4_0.gguf: verified 2370065536 bytes, sha256:6a9baaf400db52a6855d2a0a20a5b4747ea9febbd304b7e2ecd8ab3a20711bb2
```

### D.3 LLM-Host: `.env.llm`

Bestehendes Secret behalten und nicht ausgeben. Nur erzeugen, wenn noch keines mit
gültigem Zeichensatz und 32 bis 512 Zeichen steht. Einen neuen Wert sofort im
Passwortmanager speichern, nicht in Chat, Ticket oder einem weiteren Befehl.

```bash
set -euo pipefail
NEW_REF='<NEUER-40-STELLIGER-COMMIT>'
case "$NEW_REF" in *[!0-9a-f]*|'') echo 'Ungültige Commit-ID.' >&2; exit 1 ;; esac
test "${#NEW_REF}" -eq 40
cd "/opt/arsnova-llm/release-${NEW_REF}"

export LLM_PRIVATE_IP='<PRIVATE-IP-DES-LLM-HOSTS>'
export LLM_IMAGE_REF='<REGISTRY>/<IMAGE>@sha256:<64-HEX>'
case "$LLM_PRIVATE_IP$LLM_IMAGE_REF" in *'<'*|*'>'*) echo 'Platzhalter noch nicht ersetzt.' >&2; exit 1 ;; esac
printf '%s\n' "$LLM_IMAGE_REF" | grep -Eq '^.+@sha256:[a-f0-9]{64}$' \
  || { echo 'LLM_IMAGE_REF ist kein Digest.' >&2; exit 1; }

if [[ -f .env.llm ]] && grep -q '^OPEN_WEIGHT_LLM_TOKEN=.\+' .env.llm; then
  LLM_TOKEN="$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.llm)"
else
  LLM_TOKEN="$(openssl rand -hex 32)"
  printf '\nNeuen Token jetzt im Passwortmanager speichern:\n%s\n\n' "$LLM_TOKEN"
fi
case "$LLM_TOKEN" in *[!A-Za-z0-9._~-]*) echo 'Token-Zeichensatz ungültig.' >&2; unset LLM_TOKEN; exit 1 ;; esac
if [ "${#LLM_TOKEN}" -lt 32 ] || [ "${#LLM_TOKEN}" -gt 512 ]; then
  echo 'Token-Länge ungültig.' >&2
  unset LLM_TOKEN
  exit 1
fi

install -m 0600 /dev/null .env.llm
{
  printf 'OPEN_WEIGHT_LLM_IMAGE=%s\n' "$LLM_IMAGE_REF"
  printf 'OPEN_WEIGHT_LLM_MODEL_DIR=%s\n' '/srv/arsnova/models/open-weight-llm'
  printf 'OPEN_WEIGHT_LLM_BIND_ADDRESS=%s\n' "$LLM_PRIVATE_IP"
  printf 'OPEN_WEIGHT_LLM_THREADS=%s\n' '8'
  printf 'OPEN_WEIGHT_LLM_TOKEN=%s\n' "$LLM_TOKEN"
} >.env.llm
chmod 0600 .env.llm
unset LLM_TOKEN
grep -E '^(OPEN_WEIGHT_LLM_IMAGE|OPEN_WEIGHT_LLM_MODEL_DIR|OPEN_WEIGHT_LLM_BIND_ADDRESS|OPEN_WEIGHT_LLM_THREADS)=' .env.llm
```

### D.4 LLM-Host: Preflight vor dem Abschalten

`npm run llm:prod -- config` prüft die Gemma-GGUF nicht. Dieselben Bedingungen wie
ein späteres `up` laufen hier im neuen Checkout, solange die alte Runtime noch
läuft: keine Platzhalter, privater Bind, Token und Digest im Wrapper-Format,
GGUF-Prüfung, `docker pull` des exakten Digests, danach nur das Rendern der
Compose-Datei. Eine öffentliche Registry braucht keinen Login. Bei einer privaten
Registry zuerst den Login aus [Abschnitt 8.1](#81-digest-image-bereitstellen).
Erst die Zeile `Preflight grün.` erlaubt D.5.

```bash
set -euo pipefail
NEW_REF='<NEUER-40-STELLIGER-COMMIT>'
case "$NEW_REF" in *[!0-9a-f]*|'') echo 'Ungültige Commit-ID.' >&2; exit 1 ;; esac
test "${#NEW_REF}" -eq 40
NEW_DIR="/opt/arsnova-llm/release-${NEW_REF}"
cd "$NEW_DIR"
test -f .env.llm

node --input-type=module <<'EOF'
import { readFileSync } from 'node:fs';
import { BlockList, isIP } from 'node:net';

const env = {};
for (const line of readFileSync('.env.llm', 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq < 1) continue;
  env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
}
const image = (env.OPEN_WEIGHT_LLM_IMAGE ?? '').trim();
const bind = (env.OPEN_WEIGHT_LLM_BIND_ADDRESS ?? '').trim();
const token = env.OPEN_WEIGHT_LLM_TOKEN ?? '';
const modelDir = (env.OPEN_WEIGHT_LLM_MODEL_DIR ?? '').trim();
for (const value of [image, bind, token, modelDir]) {
  if (value.includes('<') || value.includes('>')) {
    console.error('Platzhalter in .env.llm.');
    process.exit(1);
  }
}
if (!/@sha256:[a-f0-9]{64}$/.test(image)) {
  console.error('OPEN_WEIGHT_LLM_IMAGE ist kein Digest.');
  process.exit(1);
}
const privateAddresses = new BlockList();
privateAddresses.addSubnet('10.0.0.0', 8, 'ipv4');
privateAddresses.addSubnet('172.16.0.0', 12, 'ipv4');
privateAddresses.addSubnet('192.168.0.0', 16, 'ipv4');
privateAddresses.addSubnet('fc00::', 7, 'ipv6');
const family = isIP(bind);
const isPrivate =
  family === 4
    ? privateAddresses.check(bind, 'ipv4')
    : family === 6 && privateAddresses.check(bind, 'ipv6');
if (!isPrivate) {
  console.error('OPEN_WEIGHT_LLM_BIND_ADDRESS ist keine private IP.');
  process.exit(1);
}
if (token.length < 32 || token.length > 512 || !/^[A-Za-z0-9._~-]+$/.test(token)) {
  console.error('OPEN_WEIGHT_LLM_TOKEN liegt außerhalb des Wrapper-Formats.');
  process.exit(1);
}
if (!modelDir.startsWith('/')) {
  console.error('OPEN_WEIGHT_LLM_MODEL_DIR ist nicht absolut.');
  process.exit(1);
}
console.log(`Preflight-Werte gültig. Image: ${image}`);
EOF

node scripts/open-weight-llm/verify-model.mjs \
  docker/open-weight-llm/model-manifest.json \
  /srv/arsnova/models/open-weight-llm/gemma-3-4b-it-qat-Q4_0.gguf

IMAGE="$(sed -n 's/^OPEN_WEIGHT_LLM_IMAGE=//p' .env.llm)"
test "$(printf '%s\n' "$IMAGE" | grep -c .)" -eq 1
docker pull "$IMAGE"
npm run llm:prod -- config >/dev/null
echo 'Preflight grün. Die alte Runtime läuft noch. Weiter mit D.5.'
```

### D.5 LLM-Host: Checkout wechseln und Runtime starten

Nur nach `Preflight grün.` `stop` allein lässt den festen Containernamen im alten
Compose-Projekt. Der Block fährt die alte Runtime herunter, behält ihren Checkout
als Rollback und legt `release-${NEW_REF}` auf `/opt/arsnova-llm/repository`. Der
Start geht nur über `npm run llm:prod`: ein bloßes `docker compose up` prüft
Digest, Bind, Token und GGUF nicht.

```bash
set -euo pipefail
NEW_REF='<NEUER-40-STELLIGER-COMMIT>'
case "$NEW_REF" in *[!0-9a-f]*|'') echo 'Ungültige Commit-ID.' >&2; exit 1 ;; esac
test "${#NEW_REF}" -eq 40

ACTIVE_DIR='/opt/arsnova-llm/repository'
NEW_DIR="/opt/arsnova-llm/release-${NEW_REF}"
OLD_REF="$(git -C "$ACTIVE_DIR" rev-parse HEAD)"
ROLLBACK_DIR="/opt/arsnova-llm/rollback-${OLD_REF}"

test -d "$NEW_DIR/.git"
test "$(git -C "$NEW_DIR" rev-parse HEAD)" = "$NEW_REF"
test -f "$NEW_DIR/.env.llm"
test ! -e "$ROLLBACK_DIR"
printf 'Rollback-Commit für eine mögliche Rückkehr: %s\n' "$OLD_REF"

cd "$ACTIVE_DIR"
npm run llm:prod -- down
cd /opt/arsnova-llm
mv repository "rollback-${OLD_REF}"
mv "release-${NEW_REF}" repository

cd /opt/arsnova-llm/repository
npm run llm:prod -- up -d --force-recreate
npm run llm:prod -- ps
echo 'Container gestartet, noch nicht unbedingt healthy. Weiter mit D.6.'
```

### D.6 LLM-Host: auf healthy warten

`up -d` kehrt zurück, während die Modellinitialisierung noch läuft. Erst `healthy`
erlaubt den Smoke-Test. Nach 24 Versuchen im Abstand von 10 Sekunden bricht der
Block ab und zeigt die Logs.

```bash
set -euo pipefail
cd /opt/arsnova-llm/repository
STATUS='missing'
for attempt in $(seq 1 24); do
  STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' arsnova-open-weight-llm 2>/dev/null || true)"
  printf '%s Versuch %02d/24: %s\n' "$(date --iso-8601=seconds)" "$attempt" "$STATUS"
  if [ "$STATUS" = 'healthy' ]; then
    break
  fi
  sleep 10
done
if [ "$STATUS" != 'healthy' ]; then
  echo 'Runtime nach 24 Versuchen nicht healthy.' >&2
  docker inspect --format 'Status={{.State.Status}} Health={{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}} Neustarts={{.RestartCount}}' \
    arsnova-open-weight-llm || true
  npm run llm:prod -- logs --tail=200 open-weight-llm || true
  exit 1
fi
echo 'Runtime ist healthy. Weiter mit D.7.'
```

### D.7 LLM-Host: Smoke-Test

```bash
(
  set -euo pipefail
  cd /opt/arsnova-llm/repository
  STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' arsnova-open-weight-llm 2>/dev/null || true)"
  if [ "$STATUS" != 'healthy' ]; then
    echo 'Smoke-Test abgebrochen: zuerst D.6, bis die Runtime healthy ist.' >&2
    exit 1
  fi
  LLM_PRIVATE_IP="$(sed -n 's/^OPEN_WEIGHT_LLM_BIND_ADDRESS=//p' .env.llm)"
  LLM_TOKEN="$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.llm)"

  curl --fail --silent --show-error --max-time 5 \
    "http://${LLM_PRIVATE_IP}:8080/health"
  echo

  curl --fail --silent --show-error --max-time 90 \
    --request POST \
    --header "Authorization: Bearer ${LLM_TOKEN}" \
    --header 'Content-Type: application/json' \
    --data '{"model":"gemma-3-4b-it-qat-q4_0","messages":[{"role":"system","content":"Return only JSON matching the schema. Write one short observable learning objective per locale."},{"role":"user","content":"Question: What is the slope of y = 2x + 1? Correct answer: 2. Distractors: 1, 3, 4."}],"response_format":{"type":"json_object","schema":{"type":"object","properties":{"de":{"type":"string","minLength":1},"en":{"type":"string","minLength":1},"fr":{"type":"string","minLength":1},"it":{"type":"string","minLength":1},"es":{"type":"string","minLength":1}},"required":["de","en","fr","it","es"],"additionalProperties":false}},"max_tokens":768,"temperature":0.2,"stream":false,"cache_prompt":true}' \
    "http://${LLM_PRIVATE_IP}:8080/v1/chat/completions" \
    | jq -e '.choices[0].finish_reason == "stop" and (.choices[0].message.content | fromjson | has("de") and has("en") and has("fr") and has("it") and has("es"))'
  echo 'Fünfsprachiges Schema: stop und de, en, fr, it, es vorhanden.'
)
```

`/health` verlangt auf diesem Build keinen API-Key. Dieses JSON-Schema prüft nur
den Server. Die App-Lernzielableitung validiert weiterhin ihr Ein-Locale-Schema.
Den Consumer noch nicht einschalten.

### D.8 App-Host: neues Image nachweisen, dann erst aktivieren

`./scripts/prod-compose.sh up` deployt kein neues Image. Es verwendet den Digest
aus `.env.arsnova-image`. Der folgende Deploy ist der kanonische Ablauf aus der
Deploy-Dokumentation: `DEPLOY_SHA`, `DEPLOY_IMAGE`, die vier Git-Prüfungen von
`scripts/deploy/checkout-deploy-sha.sh` und danach `scripts/deploy.sh`. Die
Prüfungen stehen inline, weil der bisher installierte Checkout den Helfer noch
nicht enthalten muss. `DEPLOY_SHA` ist derselbe Commit wie `NEW_REF`. Der
Kill-Switch bleibt `false`, bis der Digest-Nachweis gelungen ist.

Token nicht in den Befehl schreiben. Auf dem LLM-Host liegt er in `.env.llm` mit
Modus `0600`. Steht er noch nicht im Passwortmanager, ihn dort einmalig aus einem
lokalen Terminal übernehmen (`sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.llm`),
die Anzeige nicht kopieren und die Shell danach schließen. Nicht per Chat, Ticket,
`scp` oder Shell-History auf den App-Host bringen. Auf dem App-Host den
Passwortmanager-Eintrag verdeckt eintippen.

```bash
set -euo pipefail
cd /home/deploy/arsnova.eu
export DEPLOY_DIR=/home/deploy/arsnova.eu
export DEPLOY_BRANCH=main
export DEPLOY_SHA='<NEUER-40-STELLIGER-COMMIT>'
export DEPLOY_IMAGE='ghcr.io/kqc-real/arsnova.eu@sha256:<64-HEX>'
case "$DEPLOY_SHA" in *[!0-9a-f]*|'') echo 'Ungültige Commit-ID.' >&2; exit 1 ;; esac
test "${#DEPLOY_SHA}" -eq 40
printf '%s\n' "$DEPLOY_IMAGE" | grep -Eq '^ghcr\.io/kqc-real/arsnova\.eu@sha256:[a-f0-9]{64}$'
test "$(grep -c '^OPEN_WEIGHT_LLM_ENABLED=false$' .env.production)" -eq 1

if ! git cat-file -e "${DEPLOY_SHA}^{commit}" 2>/dev/null; then
  git fetch origin "$DEPLOY_SHA"
fi
if ! git cat-file -e "${DEPLOY_SHA}^{commit}" 2>/dev/null; then
  echo "Ziel-Commit $DEPLOY_SHA konnte nicht gefunden werden." >&2
  exit 1
fi
git checkout --detach --force "$DEPLOY_SHA"
test "$(git rev-parse HEAD)" = "$DEPLOY_SHA"
./scripts/deploy.sh
```

Nachweis, bevor irgendetwas eingeschaltet wird. Erwartete Zeile:
`Laufende App entspricht freigegebenem Digest und Commit.`

```bash
set -euo pipefail
cd /home/deploy/arsnova.eu
DEPLOY_SHA='<NEUER-40-STELLIGER-COMMIT>'
DEPLOY_IMAGE='ghcr.io/kqc-real/arsnova.eu@sha256:<64-HEX>'
case "$DEPLOY_SHA" in *[!0-9a-f]*|'') echo 'Ungültige Commit-ID.' >&2; exit 1 ;; esac
test "${#DEPLOY_SHA}" -eq 40
printf '%s\n' "$DEPLOY_IMAGE" | grep -Eq '^ghcr\.io/kqc-real/arsnova\.eu@sha256:[a-f0-9]{64}$'

test "$(git rev-parse HEAD)" = "$DEPLOY_SHA"
test "$(sed -n 's/^SHA=//p' .deploy-state/current.state)" = "$DEPLOY_SHA"
test "$(sed -n 's/^IMAGE=//p' .deploy-state/current.state)" = "$DEPLOY_IMAGE"
grep -Fqx "ARSNOVA_IMAGE=${DEPLOY_IMAGE}" .env.arsnova-image

LOCAL_ID="$(docker image inspect --format '{{.Id}}' "$DEPLOY_IMAGE")"
REPO_DIGESTS="$(docker image inspect --format '{{json .RepoDigests}}' "$DEPLOY_IMAGE")"
printf '%s' "$REPO_DIGESTS" | grep -Fq "$DEPLOY_IMAGE"
test "$(docker inspect --format '{{.Image}}' arsnova-v3-app)" = "$LOCAL_ID"
test "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' arsnova-v3-app)" = 'healthy'
echo 'Laufende App entspricht freigegebenem Digest und Commit.'
```

Erst jetzt URL, Timeouts und Token setzen und den Consumer einschalten. Das Secret
kommt verdeckt aus dem Passwortmanager.

```bash
set -euo pipefail
cd /home/deploy/arsnova.eu
test -f .env.production
DEPLOY_SHA='<NEUER-40-STELLIGER-COMMIT>'
DEPLOY_IMAGE='ghcr.io/kqc-real/arsnova.eu@sha256:<64-HEX>'
LLM_PRIVATE_IP='<PRIVATE-IP-DES-LLM-HOSTS>'
case "$DEPLOY_SHA" in *[!0-9a-f]*|'') echo 'Ungültige Commit-ID.' >&2; exit 1 ;; esac
test "${#DEPLOY_SHA}" -eq 40
printf '%s\n' "$DEPLOY_IMAGE" | grep -Eq '^ghcr\.io/kqc-real/arsnova\.eu@sha256:[a-f0-9]{64}$'
case "$LLM_PRIVATE_IP" in *'<'*|*'>'*) echo 'Platzhalter in der LLM-IP.' >&2; exit 1 ;; esac
test "$(sed -n 's/^SHA=//p' .deploy-state/current.state)" = "$DEPLOY_SHA"
test "$(docker inspect --format '{{.Image}}' arsnova-v3-app)" = "$(docker image inspect --format '{{.Id}}' "$DEPLOY_IMAGE")"

read -r -s -p 'OPEN_WEIGHT_LLM_TOKEN aus dem Passwortmanager: ' LLM_TOKEN
echo
case "$LLM_TOKEN" in *[!A-Za-z0-9._~-]*) echo 'Token-Zeichensatz ungültig.' >&2; unset LLM_TOKEN; exit 1 ;; esac
if [ "${#LLM_TOKEN}" -lt 32 ] || [ "${#LLM_TOKEN}" -gt 512 ]; then
  echo 'Token-Länge ungültig.' >&2
  unset LLM_TOKEN
  exit 1
fi

upsert() {
  local key="$1" value="$2"
  if grep -q "^${key}=" .env.production; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env.production
  else
    printf '%s=%s\n' "$key" "$value" >>.env.production
  fi
}

upsert OPEN_WEIGHT_LLM_URL "http://${LLM_PRIVATE_IP}:8080"
upsert OPEN_WEIGHT_LLM_SOCKET_PATH ''
upsert OPEN_WEIGHT_LLM_TOKEN "$LLM_TOKEN"
upsert OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS 30000
upsert OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS 90000
upsert OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS 300000
upsert OPEN_WEIGHT_LLM_ENABLED true
unset LLM_TOKEN
chmod 0600 .env.production

test "$(grep -c '^OPEN_WEIGHT_LLM_ENABLED=true$' .env.production)" -eq 1
test "$(grep -c '^OPEN_WEIGHT_LLM_TOKEN=' .env.production)" -eq 1
grep -E '^(OPEN_WEIGHT_LLM_ENABLED|OPEN_WEIGHT_LLM_URL|OPEN_WEIGHT_LLM_SOCKET_PATH|OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS|OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS|OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS)=' .env.production

./scripts/prod-compose.sh up -d --force-recreate --no-deps app
STATUS='missing'
for attempt in $(seq 1 24); do
  STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' arsnova-v3-app 2>/dev/null || true)"
  printf '%s Versuch %02d/24: %s\n' "$(date --iso-8601=seconds)" "$attempt" "$STATUS"
  if [ "$STATUS" = 'healthy' ]; then
    break
  fi
  sleep 10
done
if [ "$STATUS" != 'healthy' ]; then
  echo 'App nach dem Einschalten nicht healthy.' >&2
  ./scripts/prod-compose.sh logs --tail=200 app || true
  exit 1
fi
```

Konnektivität vom App-Host. Der Token wird aus der Datei gelesen und nicht
ausgegeben.

```bash
(
  set -euo pipefail
  cd /home/deploy/arsnova.eu
  LLM_PRIVATE_IP='<PRIVATE-IP-DES-LLM-HOSTS>'
  case "$LLM_PRIVATE_IP" in *'<'*|*'>'*) echo 'Platzhalter in der LLM-IP.' >&2; exit 1 ;; esac
  LLM_TOKEN="$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.production)"

  curl --fail --silent --show-error --max-time 5 \
    "http://${LLM_PRIVATE_IP}:8080/health"
  echo

  curl --fail --silent --show-error --max-time 5 \
    --header "Authorization: Bearer ${LLM_TOKEN}" \
    "http://${LLM_PRIVATE_IP}:8080/slots?fail_on_no_slot=1"
  echo
)
```

Lernzielableitung im Quiz-Editor auslösen und parallel die App-Logs lesen.
Erfolg: `learning_objectives:batch_completed` und
`learning_objectives:derivation_completed`. Fehler:
`learning_objectives:batch_failed`.

```bash
cd /home/deploy/arsnova.eu
./scripts/prod-compose.sh logs -f --tail=200 app
```

### D.9 LLM-Host: Qwen3-GGUF erst nach Abnahme entfernen

Diesen Block erst ausführen, wenn der LLM-Smoke-Test, der App-Smoke-Test und
eine ausdrückliche Abnahme erfolgt sind. Vorher bleibt
`Qwen3-4B-Instruct-2507-Q4_K_M.gguf` liegen, damit [Abschnitt 14.4](#144-rückkehr-zum-alten-checkout)
den alten Checkout ohne neuen Download starten kann.

```bash
set -euo pipefail
QWEN_GGUF=/srv/arsnova/models/open-weight-llm/Qwen3-4B-Instruct-2507-Q4_K_M.gguf
if [ ! -f "$QWEN_GGUF" ]; then
  echo 'Keine Qwen3-Datei vorhanden.'
  exit 0
fi
ls -l "$QWEN_GGUF"
read -r -p 'Qwen3-GGUF nach bestandener Abnahme löschen? Zum Bestätigen LOESCHEN eingeben: ' CONFIRM
if [ "$CONFIRM" = 'LOESCHEN' ]; then
  rm -- "$QWEN_GGUF"
  echo 'Qwen3-GGUF gelöscht.'
else
  echo 'Nicht gelöscht.'
fi
```
