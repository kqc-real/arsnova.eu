# Session-Capabilities und atomare Teilnehmerkennungen

Epic #405 ersetzt öffentlich sichtbare Participant-IDs als
Wiederbeitrittsnachweis durch opake, sessiongebundene Browser-Capabilities.

## Join und Kennungsvergabe

Jeder Join enthält eine im Browser per CSPRNG erzeugte 256-Bit-Idempotency-ID.
Sie wird nur im tRPC-Body übertragen und in PostgreSQL HMAC-indiziert. Der
Server sperrt die Sessionzeile und erhöht `nextParticipantNumber` innerhalb
derselben Transaktion, in der Participant, gehashte Rejoin-Capability und
Replaydatensatz entstehen.

Vorgegebene und anonyme Nicknames erhalten eine sichtbare, monotone Nummer.
Tier-Pseudonyme haben dafür je Raum und Tier einen eigenen Zähler, der bei 1
beginnt und die lokalisierten Namen desselben Tiers zusammenfasst.
Lobby, Teilnahme, Präsentation und Q&A zeigen das Tier-Emoji mit dieser Nummer.
Die Vergabe läuft in derselben Transaktion wie der interne Raumzähler.
Frei gewählte Nicknames behalten ihre Schreibweise und führen bei einem echten
Unique-Konflikt zu einer verständlichen Fehlermeldung.

Ein fehlgeschlagener Transaktionsversuch erhöht den Zähler nicht. Nummern
bereits bestätigter und später gelöschter Teilnahmen werden dagegen nicht
wiederverwendet. Das verhindert Identitätsverwechslungen und macht die
Kennungen monoton statt lückenlos.

Ein PostgreSQL-`BEFORE INSERT`-Trigger vergibt die Nummer auch für ältere
App-Images, die das neue Feld während eines Rolling Deployments noch nicht
schreiben.

## Idempotentes Replay

Bis höchstens zehn Minuten nach dem ersten serverseitigen Empfang gibt derselbe
Schlüssel exakt dieselbe Teilnahme und eine gleichwertige Capability zurück.
Das dafür nötige Response-Material liegt nur als AES-256-GCM-Envelope vor.
Nach Ablauf entfernt der Cleanup das Envelope, behält aber bis zum Session-Purge
den HMAC-Tombstone. Derselbe Schlüssel wird deshalb nach der Frist abgelehnt und
erzeugt nicht still eine zweite Teilnahme.

Nach bestätigtem Clientempfang wird der lokale Schlüssel entfernt. Ein neuer,
unabhängiger Join verwendet einen neuen Schlüssel.

## Wiederbeitritt und Grenzen

Die Capability liegt dauerhaft nur im selben Browser. Backend und
WebSocket-Verbindung übertragen sie als eigenen Berechtigungsnachweis; eine
Participant-ID, sichtbare Nummer oder ein Nickname reicht nicht aus.

Eine gültige Capability:

- findet ausschließlich die Teilnahme derselben Session,
- erzeugt bei Rejoin keinen weiteren Participant-Datensatz,
- bewahrt Nummer, Nickname, Team und Kontingente und
- folgt für die erste Ansicht dem aktuell persistierten Einstiegskanal.

Nach gelöschten Browserdaten, Privatmodus-Verlust oder Gerätewechsel entsteht
eine neue Teilnahme. Es gibt im MVP weder Transfercode noch
geräteübergreifende Kontowiederherstellung. Die Kennung identifiziert keine
natürliche Person. Host-Token, Browser-Capability und Teilnehmer-Capability
können parallel liegen; die Eintrittsmatrix steht in
[session-entry-host-vote.md](session-entry-host-vote.md).

Globales Sessionende oder `expiresAt` beendet Join und Rejoin. Q&A liefert dann
auch mit Capability nur den inhaltsfreien terminalen Zustand; Q&A-Lese- und
Schreibzugriffe sind nicht mehr möglich. Der Session-Purge widerruft den
Nachweis endgültig durch das kaskadierende Löschen des Capability-Hashes.
