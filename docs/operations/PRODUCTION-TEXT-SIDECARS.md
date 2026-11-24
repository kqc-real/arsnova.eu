# Produktions-Rollout für spaCy und den Wortwolken-Encoder

Die beiden Sidecars haben einen eigenen Image-Rollout. Der Operator prüft
die Kandidaten vor der Produktionsfreigabe im isolierten Staging. Beide
Sidecars verwenden weiterhin ihre produktiven, projektbezogenen
Unix-Socket-Volumes. Der Rollout erneuert die Sidecar-Container.

## Images bauen und in Staging prüfen

`scripts/build-text-sidecars.sh` baut die kanonischen Dockerfiles aus einem
Git-Commit und verwendet dessen vollständigen SHA als Tag und OCI-Label.
Der Build läuft für die Zielarchitektur des Builders, in Produktion ARM64.
Die Ausgabe enthält die beiden lokalen Image-IDs zur eindeutigen Auswahl.
Der spaCy-Build prüft vor der Installation die SHA-256-Werte der vier
GitHub-Sprachmodell-Wheels und des PyPI-Wheels mit den italienischen Lookup-Daten.
Die Pins und Hashes stehen in `docker/spacy/requirements-models.txt`. Bei einem
Update Versionspin oder Release-URL, geprüften Wheel-Hash und Lizenzhinweise
gemeinsam abgleichen.
Der Encoder-Build lädt aus der im Dockerfile festgelegten Xenova-Revision
und bricht bei fehlenden oder abweichenden Dateien aus
`docker/wordcloud-encoder/model.sha256` ab. Bei einem Update Revision und
geprüfte Sollhashes gemeinsam aktualisieren.

```bash
revision=$(git rev-parse --verify HEAD)
./scripts/build-text-sidecars.sh "$revision"
```

Die geprüften Artefakte auf dem Zielhost vorhalten. Bei einem separaten
Builder die Images laden oder Registry-Referenzen mit `@sha256:` pullen.
In das [isolierte Staging](STAGING-COMPOSE.md#optionaler-aufbau-für-die-textanalyse)
dieselben Images über `STAGING_SPACY_IMAGE` und `STAGING_ENCODER_IMAGE`
eintragen. Beide Apps müssen für jede Locale Lemmata und einen Encoder-Vektor
erhalten. Die italienische Probe erwartet `andare` für `andavano`.

## Ausrollen

Der Ablauf setzt App A und das bisherige, laufende Sidecar-Paar voraus.
Bei einer Ersteinrichtung können die beiden Dienste zunächst wie bisher
über `prod-compose.sh up -d spacy wordcloud-encoder` gestartet werden.
Die Rollout- und Rollback-Images müssen lokal vorhanden sein.

```bash
spacy_image=$(docker image inspect --format '{{.Id}}' "arsnova-spacy:$revision")
encoder_image=$(docker image inspect --format '{{.Id}}' "arsnova-wordcloud-encoder:$revision")
./scripts/prod-text-sidecars.sh apply "$spacy_image" "$encoder_image"
```

Der Befehl akzeptiert lokale Image-IDs oder lokal vorgeladene Registry-Digests.
Er nutzt dieselbe Sperre wie App-Deploy und Replikatwechsel. Er hält das aktuell
laufende Paar vor dem Tausch fest, wartet auf die Container-Readiness und
prüft anschließend beide Socket-Aufrufe für `de`, `en`, `fr`, `es` und `it`
aus jeder laufenden App. Der Befehl gibt Locale und Modellkennungen aus.
Während die Sidecars neu starten, können Analyseanfragen vorübergehend die
etablierten Fallbacks verwenden.

Erst nach erfolgreicher Prüfung wird `.deploy-state/text-sidecars.env` atomar
auf das neue Paar gesetzt. `prod-compose.sh` und `deploy.sh` laden die aktuelle
Referenz daraus. Ein erneutes `apply` desselben Paars prüft die laufenden
Container und erhält das Rollback-Ziel. Für beide Image-Paare legt der
Operator projektbezogene Docker-Container im Zustand `created` an. Sie
sichern die lokalen Images gegen die reguläre Image-Bereinigung beim
App-Deploy. Nach einem erfolgreichen Wechsel entfernt der Operator nicht
mehr benötigte Halter. Docker entfernt per `image prune -a` Images ohne
Containerreferenz. [Docker Image Prune](https://docs.docker.com/reference/cli/docker/image/prune/)

Das Statusfile enthält Image-Referenzen und gehört zur Wiederherstellung
des Hostzustands. Die Halter beim Aufräumen gestoppter Container erhalten.

## Rollback und Wiederherstellung

Bei einer fehlerhaften Container- oder Locale-Readiness stellt der Befehl
automatisch das vorher laufende Paar wieder her und endet mit Fehlerstatus.
Der Restore prüft `/health` für beide Sockets aus allen laufenden Apps.
Das vorherige Paar kann einen kleineren Sprachumfang haben.

```bash
./scripts/prod-text-sidecars.sh --rollback
```

Nach einem erfolgreichen manuellen Rollback wird das zurückgesetzte Paar
als aktueller Stand gespeichert. Für einen erneuten Wechsel das gewünschte
Paar explizit mit `apply` angeben.

Wenn ein Restore fehlschlägt oder der Prozess nach dem Containerwechsel
unterbrochen wird, enthält der gespeicherte Zustand weiterhin das zuvor
aktive Paar. Nachdem ein laufender Deploy ausgeschlossen und eine durch
einen abrupten Abbruch verwaiste Operationssperre geprüft wurde, stellt
folgender Befehl dieses Paar wieder bereit.

```bash
./scripts/prod-text-sidecars.sh --recover
```

Siehe [Produktionsreplikate](PRODUCTION-REPLICAS.md) und
[Validierung des Textanalyse-Rollouts](../TESTING.md#rollout-der-produktions-sidecars).
