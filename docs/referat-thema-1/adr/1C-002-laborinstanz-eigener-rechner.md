# 1C-002: Laborinstanz ist der eigene Rechner, Pfad `llm-http`

- **Status:** methodisch (2026-11-05)
- **Kategorie:** Methodik

## Kontext

Die Prüfungsunterlagen legen nahe, dass die Lehrperson eine Laborinstanz mit echter privater Runtime bereitstellt ([Rahmendokument, Recherche](../rahmen/00-rahmen-und-pruefung.md#laborinstanz-und-zweiter-host-recherche-2026-10-24)). Auftrag 1C Schritt 2 verlangt den Weg bis zur privaten Runtime; Teil 2 und 3 hatten ihn nur bis zu einer Test-Runtime auf 127.0.0.1 gezeigt. Offen war, wo der Echtlauf stattfindet (offene Frage 4 im [Rahmendokument](../rahmen/00-rahmen-und-pruefung.md#offene-fragen-an-den-prüfer)).

## Entscheidung

Die Laborinstanz ist der eigene Rechner des Autors (E-Mail des Prüfers, notiert 2026-11-04: „Die Laborinstanz ist Ihr eigener Rechner.“). Gemessen wird über den lokalen Laborpfad des Repositorys, `npm run docker:up:llm:http` (Compose-Profil `llm-http`), mit der Laufharness im selben Rechner. Ein zweiter Host wird für den Laptop-Lauf nicht vorausgesetzt.

## Alternativen

- **Zwei Hosts wie im ausgelieferten Betrieb.** Nicht gewählt: Es gibt keine bereitgestellten VMs. Ob damit die Zwei-Host-Reproduktion in 1B beantwortet ist, hat der Prüfer nicht ausdrücklich gesagt; das bleibt offen ([Rahmendokument](../rahmen/00-rahmen-und-pruefung.md#offene-fragen-an-den-prüfer)).
- **Produktionswrapper `npm run llm:prod`.** Nicht möglich, er lehnt Loopback ab ([Labor-Design 3.1](../specs/2026-10-25-1c-labor-design.md#31-topologie)).
- **App selbst über die UI auslösen, mit separatem Proxy (Frage P3).** Nicht gewählt: Das würde zusätzlich HTTP-tRPC prüfen, braucht aber einen Host-Token und einen eigenen Proxyprozess. Die Harness prüft denselben Code mit derselben Fixture wie Teil 2 und 3 und ist dadurch direkt vergleichbar. Der Prüfer hat P3 nicht ausdrücklich beantwortet ([Labor-Design 11](../specs/2026-10-25-1c-labor-design.md#11-offene-fragen)).

## Belege

- Aufbau und Unterschiede zum ausgelieferten Host (lokal gebautes Image, Loopback statt privater Adresse, 4 CPUs, 5 GiB und 4 Threads statt 8 CPUs, 8 GiB und 8 Threads): [Labor-Design 3.1](../specs/2026-10-25-1c-labor-design.md#31-topologie).
- Hardware, Image-ID, Build, Modell-SHA und Limits des Laptop-Laufs: [Laptop-Protokoll](../evidenz/1C/2026-11-05-labor.md#laufrechner-laptop) und [Umgebung](../evidenz/1C/2026-11-05-labor.md#umgebung).
- Gültigkeitsgrenzen für Zeiten und Übertragbarkeit: [Labor-Design 7](../specs/2026-10-25-1c-labor-design.md#7-gültigkeitsgrenzen).

## Folgen

- Laufprozess und Runtime teilen sich CPU und Speicher. Zeiten (L3) gelten nur für diese Maschine und sind nicht auf den Zwei-Host-Betrieb übertragbar; L1, L2 und L4 hängen von Code, Modell und Runtime-Einstellungen ab, nicht von der Hardware, solange keine Timeouts auftreten.
- Weil der Laptop mit 4 statt 8 CPUs lief, wurde der Timeout im Laptop-Lauf angehoben ([ADR 1C-020](1C-020-timeout-300-s-und-kalibrierungsregel.md)) und ein Zusatzlauf mit Produktionslimits auf einem zweiten Rechner angesetzt ([ADR 1C-021](1C-021-zusatzlauf-produktionslimits-zweiter-rechner.md)).
- Der Lauf ersetzt keinen Betriebstest des ausgelieferten Zwei-Host-Aufbaus.
