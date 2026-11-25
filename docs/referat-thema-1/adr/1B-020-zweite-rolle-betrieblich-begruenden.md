# 1B-020: Zweite Serverrolle betrieblich begründen, keinen pauschalen Isolationsgewinn behaupten

- **Status:** empfohlen (2026-11-16), Autorenprüfung am 2026-11-16 durch Niklas bestätigt
- **Kategorie:** Betrieb

## Kontext

Issue #9 verlangt, den Aufwand der zweiten privaten Inferenzrolle gegen die
beobachtete Isolation abzuwägen. Schritt 3 umfasst Normalbetrieb und Störungen,
Schritt 4 den S1-Konsolidierungsvergleich. Die Messungen auf Niklas' Rechner
zeigen funktionierende Fallbacks und fehlerfreie Live-Aktionen, aber mehrfach
überschrittene Latenzschwellen. S1 liefert unterschiedliche Ergebnisse für
Label und Summary. Der gemeinsame physische Rechner verhindert den Nachweis
unabhängiger Hardware-Fehlerbereiche.

## Entscheidung

Die bestehende Produktionsleitplanke bleibt bestehen; S1 erteilt keine Freigabe
zur produktiven Konsolidierung. Ein zusätzlicher Host ist durch getrennte
Ressourcenzuteilung, Wartung und Verantwortlichkeit zu begründen; ein allgemeiner
Leistungs- oder Wirtschaftlichkeitsvorteil ist mit diesen Daten nicht belegt.
Für den Betrieb werden begrenzte, hostabhängig kalibrierte Inferenzbudgets,
überwachter Fallback und koordinierte Runtime-/Secret-Wartung empfohlen.
Dies ist eine begründete Empfehlung, keine umgesetzte Produktionsänderung.

## Betriebsaufwand und Gegenwert

Die Einordnung ist qualitativ aus dem bestehenden
[Second-Host-Runbook](../../operations/OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md)
und den Laborbefunden abgeleitet. Keine gemessenen Personalstunden, Preise,
Energiekosten oder Verfügbarkeitszusagen.

| Bereich             | Zusätzlicher Aufwand der zweiten Rolle                                                                                                                                            | Gegenwert und Grenze                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Host und Ressourcen | Zweites OS, reservierter RAM/CPU, Plattenreserve, Firewall und Routing pflegen.                                                                                                   | Runtime-Ressourcen separat zuteilbar. Zwei VMs auf einem PC bleiben von dessen RAM, CPU, Strom und Ausfall abhängig.                                                                       |
| Deployment          | Runtime-Checkout, Image-Digest und Modellhash zusätzlich zum App-Deployment freigeben; Authentifizierung und Testinferenz von beiden Seiten prüfen.                               | Runtime separat wartbar. Zwei Freigabe-/Rollbackpfade und Versionsbezüge müssen zusammenpassen; App-Deployment allein belegt keine funktionierende Inferenz.                               |
| Updates             | OS-/Docker-/Runtime-/Modelländerungen mit Wartungsfenster, Prüfschritten und Rückkehr zum alten Stand.                                                                            | App muss nicht wegen jeder Runtime-Änderung aktualisiert werden. Wartung kann trotzdem Fallbacks und lange Warteschlangen verursachen.                                                     |
| Monitoring          | Health, Slotzugriff, Neustarts, OOM, CPU/RSS und Fallback-Gründe beider Rollen beobachten.                                                                                        | Ausfallursachen besser zuordenbar. Gesundes HTTP allein belegt weder akzeptierte Modellantworten noch kurze Job-Zeiten; Labor-Detailmessungen sind kein vorhandenes Produktionsmonitoring. |
| Token-Rotation      | Separates Runtime-Secret geschützt verwalten und auf App/Runtime koordiniert austauschen; gültigen sowie fehlenden/falschen Token prüfen.                                         | App-Secrets müssen nicht auf die Runtime. Übergangsweise nicht passende Tokens führen zu Ausfällen; nahtlose Mehrfachtoken-Rotation ist hier nicht nachgewiesen.                           |
| TLS und Netz        | Vertrauensannahme für Klartext-HTTP dokumentieren; bei entsprechendem Schutzbedarf TLS-Terminierung oder einen verschlüsselten Tunnel samt Zertifikats-/Schlüsselpflege vorsehen. | Bearer-Token und Inhalte werden durch ein privates IP-Netz nicht verschlüsselt. Das isolierte Labor misst weder TLS-Aufwand noch Produktionssicherheit.                                    |

S1 spart im untersuchten Aufbau eine aktive App-Serverrolle für den Messpfad,
teilt aber Runtime und App-Ressourcen. Das Labor benötigt zusätzlich temporäre
Images, Stack, Datenvolumes und Bridge-Freigabe; dieser Versuchshilfsaufwand
ist kein geschätzter Aufwand eines produktiven Same-Host-Deployments.
Die ursprüngliche App-VM bleibt im Versuch erhalten: keine gemessene Ersparnis
der Host-Gesamtenergie oder tatsächlich gebuchter Infrastrukturkosten.

## Alternativen

- **Zweiten Host allein wegen besserer Live-p95 rechtfertigen:** zurückgehalten.
  Schwellenverletzungen in Schritt 3 und gemischte S1-Befunde tragen das nicht.
- **S1 als Freigabe für produktiven Same-Host-Betrieb verwenden:** verworfen.
  Ressourcen und Messplatzierung sind verschieden; S1 verwendet HTTP auf
  derselben VM statt des produktiven lokalen Unix-Socket-Pfads.
- **Timeouts pauschal erhöhen oder dem Breaker alle Hänger überlassen:** verworfen.
  Längere Budgets verlängern die Wartebindung; die gerichtete Queue-Folge
  zeigt wiederholte Netzversuche trotz vorheriger Timeout-Fallbacks.
- **Betriebsentscheidung mit weiteren optionalen Reihen vertagen:** nicht geplant.
  Die festgelegten Grenzen werden berichtet; daraus entsteht kein Bedarf,
  negative Befunde durch weitere Versuche zu ersetzen.

## Belege

Ausführungscommits, Rechner, Zahlen und Rücknahmen stehen in den Protokollen:

- [Schritt-3-Gesamtstand](../1B/1B-ergebnis.md): eigene Baselines,
  Normal-/Störreihen und H2-Grenzen; Fakes nur als Störung.
- [S1-Label](../evidenz/1B/2026-11-16-lauf-s1-label.md) und
  [S1-Summary](../evidenz/1B/2026-11-16-lauf-s1-summary.md): gewertete
  Konsolidierungsreihen, vollständige Live-/Ressourcenfenster, Rücknahme.
- [F1-Breaker-Kontrolle](../evidenz/1B/2026-11-16-lauf-breaker-f1-summary.md)
  und [Queue-Folge](../evidenz/1B/2026-11-16-lauf-breaker-l3-summary.md):
  schnelles RST und Queue-Timeouts zählen beobachtbar unterschiedlich.
- [Transportauswertung](../evidenz/1B/2026-11-16-transportauswertung.md):
  geringer Transportanteil in den beobachteten Normalreihen; andere Netze,
  TLS oder entfernte Rechenzentren sind damit nicht vermessen.
- [Betriebs-Runbook](../../operations/OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md),
  insbesondere Abschnitte 4–5, 8–12 und 14–16: Installation, Netz,
  Secret, Prüfungen, Updates, Rücknahme und Regelbetrieb.
- [Produktions-Compose](../../../docker-compose.prod.yml),
  [Umgebungsvorlage](../../../.env.production.example),
  [Deploy-Skript](../../../scripts/deploy.sh) und
  [CI](../../../.github/workflows/ci.yml): Konfigurations-/Betriebsverträge
  gegengeprüft; unverändert. Keine Produktionsfreigabe aus lokalen Dokuchecks.

## Folgen

Bei verzögerter oder nicht erreichbarer Inferenz den Livebetrieb erhalten und
Fallback-Gründe beobachten. Budgets anhand erfolgreicher Aufträge auf dem
Zielhost festlegen; die Laborwerte nicht pauschal als Produktionswerte übernehmen.
Die beobachteten Summary-Qualitätsfallbacks gesondert behandeln: mehr Zeit oder
ein zweiter Host garantiert keine akzeptierte Modellantwort.

Für Updates/Rotation Consumer kontrolliert deaktivieren oder Fallback während
des Wartungsfensters bewusst einplanen, beide Rollen aktualisieren und danach
Authentifizierung, Inferenz und tatsächliches App-Ergebnis prüfen. Vorherige
Konfiguration/Digests geschützt für Rückkehr bereithalten. Kein alleiniger
Verlass auf das Öffnen des Breakers nach Queue-Timeouts.

Der Mehrbetrieb ist nur dann fachlich gerechtfertigt, wenn die benötigte
Trennung und betriebliche Zuständigkeit diesen Aufwand tragen. Unabhängige
physische Fehlerbereiche, Kostenersparnis, verbesserte Verfügbarkeit und
Produktionslast jenseits der getesteten Profile bleiben unbelegt.
Autorenprüfung am 2026-11-16 bestätigt; formaler Abschluss von Issue #9 steht aus.
