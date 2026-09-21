# Datenmanagement und Datenschutz im Modul Cloud Computing

**Stand:** 14.09.2026 · **Status:** operativer Kursstandard mit institutionellen Gates

**LIVE** bezeichnet Daten, die im konkreten Kurslauf durch Teilnahme, Werkzeugnutzung oder Betrieb entstehen. Dazu gehören auch pseudonyme und bereits aggregierte Kursdaten.

**REPO** bezeichnet versionierte Code-, Konfigurations-, Dokumentations- und Messnachweise aus einem Repository. Eine dokumentierte oder synthetische Repositorymessung ist keine Beobachtung des aktuellen Kurslaufs.

**LEHRDATEN** bezeichnet eigens konstruierte, synthetische Übungsdaten ohne Bezug zu realen Teilnehmenden. Sie werden sichtbar als synthetisch gekennzeichnet und nie als LIVE-Beobachtung ausgegeben.

Die Herkunftsklasse ändert sich durch Bearbeitung nicht: Ein anonym freigegebenes Kursaggregat bleibt LIVE; ein synthetischer Lastreport im Repository bleibt REPO.

## 1. Begriffe, Schutzstatus und Rollen

### 1.1 Weitere Begriffe

- **Multiple Choice (MC):** Aufgaben mit vorgegebenen Antwortoptionen; **MC-Test** bezeichnet die formative Lernanwendung.
- **Fragen und Antworten (Q&A):** der moderierte ARSnova-Fragenkanal.
- **Agentic Cloud Engineering Dossier (Dossier):** formative Arbeits- und Quellenbasis mit Aufträgen, Quellen, Änderungen, Prüfungen, Messungen und Entscheidungen.
- **Infrastructure as Code (IaC):** versioniert und reproduzierbar beschriebene Infrastruktur.
- **Identifier (ID):** technische Kennung; sie kann auch ohne Klarnamen personen- oder sitzungsbeziehbar sein.
- **Internet Protocol (IP):** Adressierungs- und Vermittlungsprotokoll für Netze; eine IP-Adresse ist keine verlässliche Personenkennung.
- **Structured Query Language (SQL):** Sprache für relationale Datenbanken.
- **Comma-Separated Values (CSV) und JavaScript Object Notation (JSON):** textuelle Export- und Datenformate; das Format ändert den Schutzstatus nicht.
- **Künstliche Intelligenz (KI):** Oberbegriff für die im Kurs eingesetzten agentischen und modellbasierten Werkzeuge.
- **Large Language Model (LLM):** großes Sprachmodell.
- **Indexed Database API (IndexedDB):** browserseitiger strukturierter Speicher.
- **Transport Layer Security (TLS):** Schutz von Netzwerkverbindungen durch Verschlüsselung und Serverauthentisierung.
- **Time to live (TTL):** technische Ablaufzeit eines gespeicherten Zustands.
- **T0:** dokumentiertes Ende des jeweiligen Erhebungs-, Bearbeitungs- oder Laborfensters.
- **TB01–TB12:** zwölf stabile Themenblöcke ohne Kalender- oder Modalitätszuordnung.
- **G1–G4:** die vier institutionellen Gates aus Abschnitt 3.
- **Small-cell-Suppression:** Nichtausgabe kleiner Zellen und ergänzende Unterdrückung, damit Werte nicht zurückgerechnet werden können.

Jedes Artefakt erhält zusätzlich genau einen Schutzstatus:

| Schutzstatus           | Bedeutung                                                                                                 | Zulässiger Ort                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **RAW-RESTRICTED**     | unveränderter Export, Pseudonyme, Kennungen, Freitext, technische Rohlogs oder vollständige Betriebsdaten | verschlüsselter Eingangs- oder Quarantänebereich |
| **WORK-RESTRICTED**    | bereinigte, aber noch pseudonyme, kleinzellige oder rückrechenbare Arbeitsdatei                           | verschlüsselter Arbeitsbereich                   |
| **ANON-APPROVED**      | geprüfte anonyme LIVE-Aggregate ohne Identifikatoren, Originalfreitext oder rückrechenbare Kleinzellen    | freigegebener interner Lehrbereich               |
| **SYNTHETIC-APPROVED** | geprüfte LEHRDATEN ohne Personenbezug                                                                     | Lehrbereich oder Repository                      |
| **PUBLIC-REPO**        | bereits öffentlich versionierte REPO-Quelle oder korrekt daraus zitierter Nachweis                        | Repository oder Lehrbereich                      |

Pseudonymisierung ist keine Anonymisierung. Automatische Nicknames, Hashes, Teilnehmer-, Session-, Geräte- und Nutzerkennungen bleiben Identifikatoren. Das Dateiformat ändert den Schutzstatus nicht.

### 1.2 Rollen

| Kürzel | Rolle                                                          | Verantwortung                                                                   | Maximaler Routinezugriff                                                       |
| ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **MV** | Modulverantwortung                                             | Zwecke, institutionelle Gates, Freigabe und Löschkontrolle                      | Kursregister und alle Kursbereiche, aber kein unnötiger Plattform-Adminzugriff |
| **LD** | Lehrdurchführung und Session-Host                              | datensparsame Konfiguration, Moderation, unmittelbarer Export                   | Hostansicht und RAW-Eingang der eigenen Sitzung                                |
| **DK** | Datenkuratierung                                               | Registrierung, Minimierung, Aggregation, Freigabevorbereitung und Löschung      | RAW-, WORK- und Freigabebereich                                                |
| **LA** | Lehrassistenz                                                  | Arbeit mit freigegebenen Quellen und Aggregaten                                 | ANON-APPROVED, SYNTHETIC-APPROVED und PUBLIC-REPO                              |
| **LB** | Lehrlaborbetrieb                                               | isolierte Umgebungen, kurzlebige Zugänge, Kosten- und Cleanupkontrolle          | technische Labordaten des freigegebenen Zielraums                              |
| **AP** | ARSnova-Plattformbetrieb                                       | Plattformzugriff, Purge und technische Abwesenheitsprüfung                      | erforderliche ARSnova-Betriebsdaten                                            |
| **MP** | MC-Test-Plattformbetrieb                                       | kursisolierte Fenster, Konfiguration, Purge und Abwesenheitsprüfung             | erforderliche MC-Plattformdaten                                                |
| **DS** | institutionelle Datenschutz- und Informationssicherheitsstelle | Rechts-, Rollen- und Incidentbewertung                                          | nur die für den Vorgang erforderlichen Informationen                           |
| **TN** | Teilnehmende                                                   | freiwillige Nutzung; keine Personen-, Geheim- oder Produktionsdaten in Eingaben | eigene Ansicht und freigegebene Materialien                                    |

DK führt Bereinigung oder Löschung aus; MV oder DS prüft das Protokoll. Bei Personalunion bleibt die zweite Prüfung durch eine andere Rolle dokumentiert.

## 2. Zweck und unzulässige Nutzung

Zulässige Zwecke sind ausschließlich:

1. formative Steuerung der laufenden Lehre;
2. Bearbeitung und Rückmeldung zu den Lernzielen des Moduls;
3. interne Qualitätssicherung anhand vorab festgelegter, aggregierter Kennzahlen;
4. technische Fehlerklärung mit den dafür minimal erforderlichen Betriebsdaten;
5. reproduzierbare Laborarbeit mit REPO und LEHRDATEN.

Nicht zulässig sind:

- Noten, Prüfungszulassung, Anwesenheitskontrolle oder Sanktionen aus ARSnova-, MC-Test-, Dossier-, Agenten- oder Labordaten;
- individuelle Leistungs-, Verhaltens-, Tempo-, Engagement- oder Risikoprofile;
- Verbindung eines Pseudonyms mit Namen, Lernmanagementsystem, Kursliste, Prüfung oder einem anderen Werkzeug;
- Rekonstruktion individueller Verläufe aus IDs, Zeitstempeln, Rang, Team, Bonus, Antwortmustern oder Geräteinformationen;
- Forschung, Publikation, Konferenzbeitrag, öffentliche Evaluation oder Wirksamkeitsbehauptung;
- Werbung, allgemeine Produktanalyse oder Training externer KI-Systeme;
- Upload von LIVE/RAW-RESTRICTED oder LIVE/WORK-RESTRICTED in Chatbots, externe LLM-Dienste, Webanalyse, private Cloudspeicher oder nicht freigegebene Tabellenwerkzeuge;
- nachträgliche Zweckänderung. Ein Forschungs- oder Publikationszweck benötigt einen eigenständigen institutionellen Prozess vor einer neuen Erhebung und ist nicht durch diesen Plan gedeckt.

Freiwilligkeit und Pseudonyme sind keine Rechtsgrundlage. Dieser Plan ist eine technische und organisatorische Kursregel, keine Rechtsberatung.

## 3. Institutionelle Gates

### Gate G1 – Verantwortung und Rechtsrahmen

Vor jeder LIVE-Erhebung bestätigt die zuständige Institution schriftlich:

- wer Verantwortlicher, Plattformbetrieb und gegebenenfalls Auftragsverarbeiter ist;
- auf welcher Rechtsgrundlage und mit welcher Transparenzinformation verarbeitet wird;
- ob Verträge, Verarbeitungsverzeichnis, Folgenabschätzung oder weitere Freigaben erforderlich sind;
- welche Rechte- und Kontaktwege für Teilnehmende gelten;
- welche strengeren Aufbewahrungs-, Lösch- und Incidentregeln Vorrang haben.

Der Kurs erfindet keine Rechtsgrundlage und interpretiert keine Einwilligung stillschweigend.

### Gate G2 – Plattformen und Löschung

AP und MP bestätigen vor Kursstart für die tatsächlich eingesetzten Instanzen:

- Speicherorte, Betriebsrollen, Unterauftragnehmer und Backupzyklen;
- welche Datenfelder, Logs, Session-Summaries und Exporte entstehen;
- einen kursbezogenen Löschweg über alle Tabellen, Volumes, Snapshots und temporären Kopien;
- eine Abwesenheitsprüfung nach Löschung;
- dass öffentliche Ranglisten im MC-Test deaktiviert sind;
- dass technische Löschfristen mit Abschnitt 10 vereinbar sind.

Repositorydokumentation oder Anwendungscode beweisen nicht, dass eine konkrete Instanz entsprechend konfiguriert oder operativ abgenommen ist.

### Gate G3 – Agenten, Kommunikationswerkzeuge und externe Cloud

MV und DS bestätigen:

- institutionell zulässige Agenten, Modelle, Datenverwendung, Speicher-/Trainingsverhalten, Region und Löschung;
- Kommunikationsplattform-, Board-, Untertitel-, Transkriptions- und Aufzeichnungspraxis;
- Providerkonten, Regionen, Quotas, Budgets, Abrechnung und automatischen Cleanup;
- dass Produktion, Echtdaten und Produktionszugänge technisch und organisatorisch gesperrt bleiben.

### Gate G4 – Kursfristen

Die Institution bestätigt die Kursstandardfristen aus Abschnitt 10 oder ersetzt sie vor der ersten Erhebung durch strengere, dokumentierte Fristen. Ohne diese Bestätigung werden keine LIVE-Daten exportiert und keine kursverwalteten Langzeitkopien angelegt.

Ist eines der Gates rot, wird die Aktivität mit LEHRDATEN, PUBLIC-REPO-Quellen und einer offline bearbeiteten, nicht eingesammelten Alternative durchgeführt.

## 4. Verbindliche Grundsätze

1. **Datenminimierung:** Vor jeder Erhebung stehen Zweck, Beobachtungseinheit, benötigte Felder, T0 und Löschdatum im Datenregister.
2. **Aggregation vor Verteilung:** TN und LA erhalten keine pseudonymen Einzelantworten oder technischen Rohlogs.
3. **Herkünfte trennen:** LIVE, REPO und LEHRDATEN bleiben in Datei, Bericht und Dossier sichtbar getrennt.
4. **Kein Personenmodell:** Werkzeugkennungen werden weder werkzeugintern für Kursanalytik verlängert noch werkzeugübergreifend verbunden.
5. **Keine Rohdatenrekonstruktion:** Aggregate werden nicht in erfundene Einzelwerte, Paare oder Vorher-Nachher-Verläufe umgerechnet.
6. **Freitext vermeiden:** Q&A und Freitext werden nur eingesetzt, wenn geschlossene Antworten den Lehrzweck nicht erfüllen.
7. **Lokale beziehungsweise institutionelle Verarbeitung:** RAW und WORK bleiben auf verwaltetem, verschlüsseltem Speicher.
8. **Reproduzierbarkeit ohne Identifikatoren:** Quelle, Commit, Version, Importparameter, Ausschlüsse, Nenner und Auswertungsschritte werden dokumentiert; Identifikatoren werden nicht archiviert.
9. **Keine Schattenkopien:** Private Geräte, E-Mail, Messenger, private Synchronisation, USB-Datenträger und Git sind keine RAW-/WORK-Speicherorte.
10. **Kürzere Frist gewinnt:** Für Kurskopien gilt die kürzere anwendbare Frist, sofern keine dokumentierte institutionelle Anordnung entgegensteht.

## 5. Datenflüsse

### 5.1 ARSnova

Der reguläre Fluss lautet:

```text
freiwillige Browserantwort
→ pseudonyme Live-Session
→ Hostansicht mit Aggregaten
→ nur bei registriertem Zweck geschützter Export
→ minimale, kleinzellengeprüfte Aggregation
→ Löschung von Rohdaten, Arbeitskopien und Plattformbestand
```

Verarbeitete Daten können umfassen:

- automatisch vergebenes Pseudonym und technische Teilnehmerkennung;
- Session-, Quiz-, Frage-, Antwort- und Rundenkennungen;
- Antworten, Richtigkeit nach Auflösung, Confidence und numerische Werte;
- Q&A- und Freitext, Stimmen und Moderationsstatus;
- Team, Rang, Punkte, Boni, Reaktionen, Timer- und Zeitunterstützungsstatus;
- technische Zeitstempel, Verbindungs- und Betriebsdaten.

Kursregeln:

- eigene Nicknames und Klarnamen bleiben deaktiviert;
- Team, Rang, Punkte, Boni, Geschwindigkeit und Reaktionen werden nicht in die Lernanalytik übernommen;
- Original-Q&A und Originalfreitext werden nie an den Kurs verteilt oder in das Dossier kopiert;
- der allgemeine Sessionexport wird bis zur Feldprüfung als RAW-RESTRICTED behandelt, auch wenn er überwiegend Aggregate enthält;
- die lokale Quizbibliothek im Hostbrowser liegt local-first in IndexedDB/Yjs; Sync-Links, Fragmente, Access-Proofs und Host-Tokens sind Geheimnisse beziehungsweise Capabilities und keine Lehrdaten;
- eine Quizdefinition darf als REPO oder LEHRDATEN versioniert werden, jedoch nie mit Sessioncode, Host-Token oder LIVE-Ergebnissen.

Der aktuelle Backendcode materialisiert bei Ablauf `endedAt = expiresAt` und löscht nach der 14-tägigen Host-Nachbereitung, sofern kein Legal Hold greift. Bonus-Tokens und Sessionfeedback können den Purge zusätzlich verzögern. Diese Implementierung ist deshalb kein Nachweis der Löschung einer konkreten Kursinstanz. Kanonisch: [session-lifecycle.md](../../features/session-lifecycle.md).

### 5.2 MC-Test

Der reguläre Fluss lautet:

```text
freiwilliger Lernmodus
→ Einzelantwort und unmittelbares persönliches Feedback
→ nur erforderliches Plattformaggregat
→ kleinzellengeprüfter Themenblockbefund
→ tabellen- und sicherungsübergreifender Kurs-Purge
```

Der Kurs verwendet den in den Altunterlagen festgeschriebenen MC-Test-Commit. Der laufende Deploymentzustand ist dadurch nicht bewiesen. Bis G2 bestanden ist, werden alle Antworten, Pseudonyme, technischen Nutzerkennungen, Bookmarks, Feedbacks, Sessionverläufe, Punkte, Zeiten und Summaries als LIVE/RAW-RESTRICTED behandelt.

Kursregeln:

- Modus `practice`, Sofortfeedback, kein technischer Countdown und `show_top5_public=false`;
- unreservierte Pseudonyme ohne Zuordnungsliste und ohne Wiederverwendung als Kurskennung;
- kein Abgleich mit ARSnova, Dossier, Kommunikationsplattform, Kursliste oder Prüfung;
- kein vollständiger Datenbank- oder SQL-Dump im Regelbetrieb;
- Lernendenberichte verbleiben bei den Lernenden und werden nicht zentral eingesammelt;
- nur Itemzählwerte, Lösungs- und Auslassungsquoten sowie der dokumentierte Nenner dürfen nach Small-cell-Suppression in die interne Qualitätssicherung eingehen;
- der erste Abruf in UE 3 und jedes tatsächlich geöffnete weitere Abruffenster sind ohne kalendarische Vorgabe getrennte Fenster mit eigenem T0 und Löschbeleg.

### 5.3 Dossier

Der reguläre Fluss lautet:

```text
REPO und LEHRDATEN
→ Agentenauftrag und isolierte Ausführung
→ minimierte Evidenz
→ menschlich geprüfter Dossierbaustein
→ formative Rückmeldung
→ fristgerechte Entfernung von Rohlogs und Kurskopien
```

Zulässige Dossierinhalte:

- Agentenauftrag, Rechteklasse, Budget, Freigabe- und Abbruchkriterien;
- Repository-Commit, direkte Quellen und Datenherkunft;
- bereinigter Diff, IaC, Konfiguration und Systeminventar ohne Secrets;
- Test-, Scan-, Mess-, Recovery- und Kostenbericht aus isolierter Umgebung;
- Evidenzstufe, Gültigkeitsgrenze, stärkste verworfene Alternative und menschliche Entscheidung;
- individuelle kritische Reflexion, sofern sie im geschützten Kursbereich bleibt.

Unzulässige Dossierinhalte:

- ARSnova- oder MC-Einzelantworten, Pseudonyme, Rang, Team oder Antwortzeiten;
- Q&A-Originaltext und Screenshots mit LIVE-Inhalten;
- vollständige Agententranskripte mit Personen-, Konto-, Host- oder Geheimdaten;
- Produktionslogs, Produktionsdaten, interne Produktivhostnamen, private IP-Inventare oder Credentials;
- verdeckte Zuordnung von Gruppen- oder Werkzeugdaten zu Einzelpersonen.

Das Dossier ist eine formative Arbeits- und Quellenbasis, keine zusätzliche benotete Leistung. Wird ein Teil ausdrücklich Bestandteil der formalen Prüfung, gelten dafür die institutionell veröffentlichten Prüfungs- und Aufbewahrungsregeln außerhalb dieses Datenplans.

### 5.4 Isolierte Lehrlabore

Der reguläre Fluss lautet:

```text
festgelegter REPO-Commit + LEHRDATEN
→ kurzlebige Identität und budgetierte Sandbox
→ agentische Änderung und Prüfung
→ minimierter technischer Nachweis
→ Credential-Widerruf und vollständiger Destroy
```

Verbindlich sind:

- ausschließlich synthetische oder ausdrücklich institutionell freigegebene Daten;
- keine Produktion, keine Produktionsdatenbank, keine Produktivtokens und kein Produktivlasttest;
- eigener unprivilegierter Account; privilegierte Schritte nur zeitlich und sachlich begrenzt;
- minimale Ingress- und Egressziele, dokumentierte Region und Quota;
- Logs und Provider-IDs zunächst WORK-RESTRICTED, weil sie Konto-, Host- oder Gruppenbezug enthalten können;
- Screenshots nur nach Entfernung von Namen, E-Mail-Adressen, IPs, Tokens, Rechnungs- und Kontokennungen;
- maschinenprüfbarer Stopp, Credential-Widerruf, Ressourcen-Destroy und Kostenabschluss;
- Snapshots, Volumes, Objekte, Images, Schlüssel und Monitoringdaten in den Cleanup einbeziehen.

## 6. Speicherorte und Zugriff

Der institutionell geschützte Kursroot folgt dem Schema `CC_JJJJ_TERM`:

```text
CC_JJJJ_TERM/
├── 00_register/
│   ├── datenregister.csv
│   ├── freigaben.csv
│   └── loeschprotokoll.csv
├── 10_live_eingang_restricted/
│   └── TB01/ ... TB12/
├── 20_work_restricted/
│   └── TB01/ ... TB12/
├── 30_dossier_restricted/
├── 40_approved/
│   ├── live_anon/
│   ├── repo/
│   └── lehrdaten/
├── 50_interne_berichte/
└── 90_quarantaene_restricted/
```

| Ort                        | Zulässiger Inhalt                              | Zugriff                                            |
| -------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| ARSnova- und MC-Plattform  | nur für den Betrieb erforderliche LIVE-Daten   | AP beziehungsweise MP; LD nur in eigener Hostrolle |
| verwalteter Eingang        | RAW-RESTRICTED                                 | LD, DK; MV und DS nur bei Bedarf                   |
| verwalteter Arbeitsbereich | WORK-RESTRICTED                                | DK und MV                                          |
| Dossierbereich             | minimierte formative Artefakte                 | jeweiliges Team, LD und LA nach Kursrolle          |
| Freigabebereich            | ANON-APPROVED, SYNTHETIC-APPROVED, PUBLIC-REPO | Kurs                                               |
| Quarantäne                 | Incidentkopie ohne unnötige Vervielfältigung   | DS, MV und ausführende Rolle                       |
| Git-Repository             | PUBLIC-REPO und SYNTHETIC-APPROVED             | gemäß Repositoryzugriff                            |

RAW, WORK und Quarantäne liegen nur auf institutionell verwaltetem, verschlüsseltem Speicher. Freigabelinks sind rollenbegrenzt und befristet. Bildschirmsperre und Mehrfaktorauthentifizierung werden eingesetzt, soweit institutionell verfügbar.

## 7. Dateinamen und Datenregister

Das Schema für Laufzeitartefakte lautet:

`JJJJMMTT_TBNN_SYSTEM_HERKUNFT_EREIGNIS_INHALT_STATUS_VNN.EXT`

Dabei bezeichnet `JJJJMMTT` das Datum, `TBNN` den Themenblock, `VNN` die zweistellige Version und `EXT` die Dateiendung.

Zulässige Beispiele:

- `20260913_TB01_ARSNOVA_LIVE_E01_ITEM-AGG_RAW-RESTRICTED_V01.csv`
- `20260913_TB01_MC-TEST_LIVE_R1_ITEM-AGG_WORK-RESTRICTED_V01.csv`
- `20260914_TB01_LAB_REPO_E01_RECOVERY_PUBLIC-REPO_V01.json`

Personennamen, Pseudonyme, Sessioncodes, Teilnehmer-, Konto- oder Provider-IDs, IP-Adressen, Tokens und vollständige Freitexte sind in Dateinamen verboten.

Das Datenregister enthält mindestens:

- Artefakt-, Kurs-, Themenblock- und Ereigniskennung;
- System, Herkunftsklasse und Schutzstatus;
- Zweck `LEHRE`, `INTERN-QS` oder `INCIDENT`;
- Beobachtungseinheit und minimalen Variablenumfang;
- Freitext ja/nein;
- logischen Speicherbereich;
- Erhebungsende, T0, Zeitzone und Löschdatum;
- Prüfsumme für lokale Exportartefakte;
- ausführende, freigebende und löschende Rollen;
- Freigabe-, Lösch- und Incidentstatus.

## 8. Aggregierte Auswertung ohne Verknüpfung

Vor Kursstart werden nur folgende internen Kennzahlen zugelassen:

### ARSnova

- tatsächliche Zahl der Antworten je Item und Runde;
- vollständig korrekte Quote bei bewertbaren Fragen;
- Options- oder Kategorienanteile mit korrektem Nenner;
- aggregierte Confidence nur bei mindestens fünf Antworten;
- Anzahl technischer Abbrüche und verlorene Lehrzeit.

### MC-Test

- Zahl begonnener und abgeschlossener Lernsessions im festgelegten Fenster;
- Lösungs-, Distraktor- und Auslassungsquote je redaktionellem Item;
- Thema, Konzept, Gewicht und kognitive Stufe aus der freigegebenen MC-Datei;
- keine individuelle Zeit-, Punkte- oder Wiederholungsanalyse.

### Dossier und Labor

- Material- oder Quellenfehler als sachliche Kategorie;
- Vollständigkeit des vorgesehenen Prozessartefakts auf Modulebene, nicht je Person;
- Laufzeit, Fehlerquote, Ressourcen- und Kostenwerte je synthetischem Szenario;
- keine Verbindung technischer Labordaten mit ARSnova- oder MC-Ergebnissen.

Es gibt keinen gemeinsamen Personen-, Pseudonym-, Team-, Gruppen-, Geräte- oder Zeitstempelschlüssel. Auch manuell wird keine Zuordnungsliste geführt. Das Modulpaket sieht keinen Vergleich von Durchführungsmodalitäten vor.

Antwortzeit ist ein technisches Nutzungssignal, kein Kompetenzmaß. Eine Korrelation, ein Vorher-Nachher-Vergleich oder eine Kausalaussage aus den Toolaggregaten ist nicht zulässig.

## 9. Small-cell-Suppression

Für jede präsentierte, verteilte oder intern aufbewahrte LIVE-Auswertung gilt:

1. Exakte Zellenwerte von 1 bis 4 werden nicht ausgegeben.
2. Kleine Zellen werden fachlich sinnvoll zusammengefasst oder die Darstellung entfällt; sie werden nicht als null dargestellt.
3. Kann ein unterdrückter Wert aus Gesamtsumme, Prozenten, Randwerten oder einer Vergleichstabelle berechnet werden, wird mindestens eine weitere Zelle beziehungsweise der Randwert unterdrückt.
4. Untergruppen werden nur berichtet, wenn jede sichtbare Zelle mindestens fünf Beobachtungen enthält und die Kombination keine Person erkennbar macht.
5. Bei weniger als fünf Antworten in der gesamten betrachteten Gruppe wird keine LIVE-Auswertung berichtet; stattdessen werden LEHRDATEN genutzt.
6. Themenblöcke, Items und wiederholte MC-Fenster werden nicht so nebeneinandergestellt, dass Differenzen kleine Gruppen offenlegen.
7. Systemseitige Unterdrückung wird nicht umgangen.
8. Originalfreitext wird unabhängig von seiner Häufigkeit nicht als anonym freigegeben.
9. Bei kleinen, bekannten Kohorten kann auch eine größere Zelle erkennbar sein; dann wird weiter aggregiert oder nicht berichtet.

## 10. Aufbewahrung und Löschung

### 10.1 Festlegung von T0

- ARSnova: T0 ist `FINISHED`.
- Erstes MC-Fenster: T0 ist 24 Stunden nach Öffnung in UE 3.
- Zweites MC-Fenster: T0 ist 24 Stunden nach der Freischaltung zwei Tage nach dem Termin.
- Verzögertes MC-Fenster: T0 ist 24 Stunden nach der Freischaltung vierzehn Tage nach dem Termin.
- Labor: T0 ist der im Agentenvertrag festgelegte End- oder Abbruchzeitpunkt.
- Dossier-Arbeitsfenster: T0 ist die dokumentierte Freigabe des jeweiligen minimierten Bausteins.

### 10.2 Kursstandardfristen

Die folgenden Fristen sind operative Obergrenzen, keine behaupteten gesetzlichen Fristen:

| Artefakt                                                             | Kursstandardfrist                                                                                       | Löschaktion                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Browserdownload, Zwischenablage, temporärer Freigabelink             | spätestens zwei Stunden nach Erzeugung                                                                  | registrieren, in geschützten Eingang verschieben, temporäre Kopien und Link entfernen                         |
| Q&A-, Feedback- oder sonstiger Originalfreitext                      | spätestens 72 Stunden nach T0                                                                           | kategorisieren oder neutral paraphrasieren, dann alle Roh- und Arbeitskopien löschen                          |
| sonstige RAW-/WORK-Arbeitskopie                                      | Verarbeitung binnen 48 Stunden; Löschung spätestens sieben Kalendertage nach T0 des Auswertungsfensters | aus Eingang, Arbeit, Downloads, Papierkorb und lokalen Synchronisationsresten löschen                         |
| ARSnova-Kursbestand                                                  | spätestens sieben Kalendertage nach T0 mit technischem Abwesenheitsnachweis                             | Session, Antworten, Q&A, Teilnehmer-, Team-, Bonus- und abhängige Daten kursbezogen löschen                   |
| MC-Test-Einzelantworten, Pseudonyme, Summaries und technische Zeilen | spätestens sieben Kalendertage nach T0 jedes Fensters                                                   | alle kursbezogenen Tabellenzeilen purgen oder isolierte Datenbank samt Neben- und Sicherungsdateien verwerfen |
| Labor-Credentials                                                    | sofort bei T0 widerrufen; technische Ablaufzeit höchstens 24 Stunden                                    | Schlüssel, Tokens, Rollenbindung und Freigabelinks widerrufen                                                 |
| Laborressourcen                                                      | automatischer Destroy bei T0, manuell bestätigt binnen zwei Stunden                                     | Instanzen, Volumes, Snapshots, Objekte, reservierte Adressen, Images und Monitoringreste entfernen            |
| technische Laborrohlogs                                              | spätestens sieben Kalendertage nach T0                                                                  | minimierte Evidenz extrahieren, Rohlogs löschen                                                               |
| Dossier-Rohlogs und Volltranskripte                                  | spätestens sieben Kalendertage nach Freigabe des minimierten Bausteins                                  | löschen; nur nachvollziehbare, bereinigte Evidenz behalten                                                    |
| kursverwaltetes formatives Dossier                                   | 30 Kalendertage nach offiziellem Kursende, sofern G4 bestätigt                                          | Kurszugriff schließen und institutionelle Kurskopie löschen; formale Prüfungsunterlagen sind nicht umfasst    |
| anonymes internes Lehrfazit                                          | nur bis Abschluss der nächsten Kursplanung, höchstens zwölf Monate nach Kursende, sofern G4 bestätigt   | nach Übernahme der beschlossenen Änderung löschen                                                             |
| lokale REPO-Arbeitskopie                                             | bis Kursende plus 30 Tage                                                                               | löschen; dauerhafte Quelle bleibt der versionierte Repositoryverweis                                          |
| LEHRDATEN                                                            | solange aktiv eingesetzt; mindestens jährliche Prüfung                                                  | weiterführen oder aus aktivem Lehrmaterial entfernen                                                          |
| minimiertes Daten- und Löschprotokoll                                | 24 Monate nach Kursende, nur wenn G4 dies bestätigt                                                     | danach löschen                                                                                                |
| Incident-Quarantäne                                                  | höchstens 72 Stunden ohne institutionelle Anordnung                                                     | löschen oder mit eigenem Zweck, Zugriff und Termin an institutionellen Incidentprozess übergeben              |

Ist die institutionell bestätigte Frist kürzer, gilt sie. Erfordert eine dokumentierte institutionelle Anordnung eine längere Aufbewahrung, werden Zweck, Zugriff, Rechtsentscheidung und neues Löschdatum separat festgehalten.

### 10.3 Technische Grenzen

- Die ARSnova-Purge-Fälligkeit nach der 14-tägigen Nachbereitung ist keine Exportzusage und kein Abwesenheitsnachweis.
- Bonus- oder Feedbackretention und Legal Hold können einen automatischen ARSnova-Purge verzögern. AP muss den Kursbestand deshalb ausdrücklich prüfen.
- Die MC-Freigabe eines Pseudonyms beweist nicht, dass Antworten oder Session-Summaries gelöscht sind.
- Es werden keine eigenen RAW-Backups angelegt. Institutionelle oder Plattformbackups folgen ihrem bestätigten Zyklus; das Löschprotokoll nennt diese Grenze.
- Physische Überschreibung von Solid-State-Speicher wird nicht behauptet. Schutz beruht zusätzlich auf Verschlüsselung, Zugriffskontrolle und bestätigtem Backupzyklus.
- Der aktuelle [Security-Härtungsplan](../../SECURITY-HARDENING-PLAN.md) und das [Security-Handoff](../../SECURITY-HARDENING-HANDOFF.md) dokumentieren W3.6 als implementiert, gemergt und historisch operativ abgenommen: Am 26.07.2026 waren ein erster Offsite-Snapshot und ein isolierter Restore mit 21 Tabellen erfolgreich. Der Abschnitt „Ausstehende Betriebsabnahme“ im älteren [W3.6-Abnahmedokument](../../implementation/W3.6-EXTERNAL-BACKUPS-ABNAHME.md) bildet den davor offenen Stand ab und ist durch diese jüngeren kanonischen Nachweise zeitlich überholt. Die datierte Abnahme garantiert weder aktuelle Snapshots und verfügbare Schlüssel noch erfolgreiche Wiederholungen, die aktuelle Einhaltung der RPO/RTO-Ziele oder den Backupzustand der tatsächlich eingesetzten Kursinstanz.

## 11. Löschablauf und Abwesenheitsprüfung

1. Das Datenregister setzt bei Aufnahme jedes Artefakts sofort T0 und Löschdatum.
2. DK prüft am Löschtermin Eingang, Arbeit, Dossier-Rohbereich, Quarantäne, Downloads, temporäre Ordner, Papierkorb, Freigabelinks und Synchronisationsreste.
3. LB prüft Providerkonsole und IaC-State auf Instanzen, Disks, Snapshots, Objekte, Schlüssel, Adressen und Kostenreste.
4. AP prüft ARSnova-Session, Teilnehmende, Antworten, Q&A, Team-, Bonus- und abhängige Daten.
5. MP prüft aktive Sessions, Antworten, Feedback, Bookmarks, Summaries, Präferenzen, Heartbeats sowie Datenbank-, Write-ahead-log-, Shared-memory-, Snapshot- und Exportkopien.
6. MV oder DS prüft das Löschprotokoll binnen zwei Arbeitstagen.
7. Ergebnis ist `SUCCESS`, `PARTIAL`, `FAILED` oder `NOT_VERIFIABLE`. Nur `SUCCESS` schließt das Fenster.
8. Bei `PARTIAL`, `FAILED` oder `NOT_VERIFIABLE` wird die betroffene Plattform für weitere LIVE-Erhebungen gesperrt und der Vorgang als Incident behandelt.

Das Löschprotokoll enthält keine Inhalte, Pseudonyme, Sessioncodes, lokalen Benutzerpfade oder Secrets. Es nennt nur Ereigniskennung, Datenklasse, Artefaktgruppe, Frist, Ausführungszeit, Speicherortkategorie, Methode, Ergebnis, Rollen, Backupzyklus und gegebenenfalls Incidentkennung.

## 12. Secrets, Produktion und Repository

Im Repository, Dossier, Agentenprompt, Chat, Board, Screensharing und Lehrmaterial sind verboten:

- `.env`-Inhalte, private Schlüssel, Tokens, Passwörter und Recovery-Geheimnisse;
- ARSnova-Host-Token, Admin-Token, Access-Proof, Quiz-Sync-Capability und Sessioncode;
- Provider-, Kommunikationsplattform-, Datenbank-, Redis- oder Monitoring-Credentials;
- Produktionsdaten, Produktionsdatenbankdumps und Produktionslogs;
- personenbezogene LIVE-Daten, Q&A-Originaltexte und Incidentinhalte;
- private Hostinventare, wenn sie nicht als freigegebene synthetische Lehrtopologie neu erstellt wurden.

Git-Historie ist kein Löschmechanismus. Gelangt ein Geheimnis oder LIVE-Datum in Git, wird nicht nur die Datei entfernt: Zugriff stoppen, Credential widerrufen, DS informieren und institutionellen Incidentprozess auslösen.

## 13. Incident-Ablauf

Incidents sind insbesondere:

- Personen-, Gesundheits-, Kontakt-, Prüfungs- oder Geheimdaten in Freitext;
- Fehlversand oder offener Link zu RAW/WORK;
- Upload in Git, private Cloud, Messenger, externes LLM oder Webwerkzeug;
- verlorenes Gerät mit Kursdaten;
- veröffentlichte Kleinzelle oder rückrechenbare Tabelle;
- Produktionszugriff oder unbeabsichtigte kostenpflichtige Ressource;
- fehlgeschlagener Purge oder fortbestehende Session-Summary;
- vollständiger Datenbankdump als vermeintlicher Exportersatz.

Verbindliche Reaktion:

1. **Stoppen:** Erhebung, Export, Freigabe, Agent, Synchronisierung und weitere Analyse anhalten.
2. **Eindämmen:** Link sperren, Credential widerrufen, Writer stoppen und genau eine erforderliche Kopie in Quarantäne führen; keine zusätzlichen Inhaltskopien erzeugen.
3. **Informieren:** MV und DS unverzüglich über den institutionellen Weg informieren. DS entscheidet über rechtliche oder externe Meldungen.
4. **Minimal dokumentieren:** Zeitpunkt, Datenklasse, Systeme, ungefährer Umfang, Empfängerkreis und Eindämmung ohne Originalfreitext festhalten.
5. **Beheben:** Zugriff entziehen, bereinigte Fassung neu erzeugen oder kontrolliert löschen; Empfänger werden institutionell zur Löschung aufgefordert.
6. **Frist steuern:** Ohne Anordnung Quarantäne binnen 72 Stunden löschen; angeordnete Aufbewahrung erhält eigenen Zweck und Termin.
7. **Prüfen:** zweite Rolle bestätigt Löschung oder institutionelle Übergabe; Ursache und präventive Kursmaßnahme werden ohne Personenbezug dokumentiert.

Technischer Exportausfall berechtigt nicht zur Rekonstruktion von Einzelwerten, zum Adminauszug, zum Legal Hold für Lehrzwecke oder zum Datenbankdump. Die Datenlücke wird dokumentiert und die Lehre mit REPO oder LEHRDATEN fortgesetzt.

## 14. Freigabecheck für Aggregate

Eine Datei erhält nur dann ANON-APPROVED, wenn:

- Zweck, Herkunft, Beobachtungseinheit, Themenblock, Runde und Nenner dokumentiert sind;
- Namen, Pseudonyme, Hashes, IDs, Codes, Tokens, exakte personenbezogene Zeitstempel und private Pfade fehlen;
- Original-Q&A, Feedback- und sonstiger Freitext fehlen;
- keine Personen-Rohwerte oder rekonstruierten Verläufe enthalten sind;
- jede sichtbare Zelle mindestens fünf Beobachtungen umfasst und Differenzbildung ausgeschlossen ist;
- fehlende und unterdrückte Werte nicht als null erscheinen;
- LIVE/REPO/LEHRDATEN und unterschiedliche Messumgebungen nicht vermischt sind;
- keine werkzeugübergreifende Verknüpfung möglich ist;
- Darstellung, Einheit, Quelle, Evidenzstufe und Gültigkeitsgrenze vollständig sind;
- Löschdatum, Zielgruppe sowie Freigabe durch DK und MV dokumentiert sind.

Fehlt eine Bestätigung, wird nicht freigegeben.

## 15. Nachprüfbare Repositorygrundlagen

- [Security Overview](../../SECURITY-OVERVIEW.md)
- [ARSnova-Session-Cleanup](../../../apps/backend/src/lib/sessionCleanup.ts)
- [ARSnova-Sessionrouter und phasenabhängige Teilnehmerdaten](../../../apps/backend/src/routers/session.ts)
- [Geteilte Zod-Verträge](../../../libs/shared-types/src/schemas.ts)
- [Prisma-Datenmodell](../../../prisma/schema.prisma)
- [Quizbibliothek: Yjs, IndexedDB und Sync](../../architecture/quiz-library-sync.md)
- [Produktions-Compose](../../../docker-compose.prod.yml)
- [Backup-/Restore-Runbook](../../operations/BACKUP-RESTORE-RUNBOOK.md)
- [Security-Härtungsplan](../../SECURITY-HARDENING-PLAN.md)
- [Security-Hardening-Handoff](../../SECURITY-HARDENING-HANDOFF.md)
- [Agentic-Lehrlabor](../CLOUD-COMPUTING-AGENTIC-LEHRLABOR.md)
- [Statistikvorlage für Datenmanagement und Export](../Modulkonzept%20Statistik/P0-02_Datenmanagement_Exportplan.md)
- [Lehrenden-Runbook dieses Moduls](./Lehrenden_Runbook.md)

Diese Quellen belegen Code-, Konfigurations- und dokumentierte Zielzustände. Sie ersetzen weder G1 bis G4 noch einen aktuellen Betriebs-, Lösch- oder Rechtsnachweis der konkret eingesetzten Instanz.
