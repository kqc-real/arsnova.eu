-- Aktuelle Feature-MOTD: Numerische Schaetzfrage.
-- Feste ID; idempotent fuer lokale Seeds und produktive Migrationen.
-- Markdown-Bild: /assets/images/numeric-estimate-1789-host.png

INSERT INTO "Motd" (
  "id",
  "status",
  "priority",
  "startsAt",
  "endsAt",
  "visibleInArchive",
  "contentVersion",
  "templateId",
  "createdAt",
  "updatedAt"
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'PUBLISHED',
  30,
  '2026-06-17 00:00:00'::timestamp(3),
  '2026-11-30 23:59:59.999'::timestamp(3),
  true,
  4,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "status" = EXCLUDED."status",
  "priority" = EXCLUDED."priority",
  "startsAt" = EXCLUDED."startsAt",
  "endsAt" = EXCLUDED."endsAt",
  "visibleInArchive" = EXCLUDED."visibleInArchive",
  "contentVersion" = EXCLUDED."contentVersion",
  "templateId" = EXCLUDED."templateId",
  "updatedAt" = NOW();

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'de',
  $mdde$# Schätzen, diskutieren, vergleichen

![Host-Ansicht einer numerischen Schätzfrage zur Französischen Revolution](/assets/images/numeric-estimate-1789-host.png)

Mit der **numerischen Schätzfrage** kannst du in arsnova.eu konkrete Zahlenwerte schätzen lassen, entweder in einer einfachen Runde oder in zwei Runden mit kurzer Diskussion dazwischen.

**Wofür sie gedacht ist**

- Vorwissen sichtbar machen, ohne sofort eine richtige Antwort zu verraten.
- Schätzungen nach einer Diskussion noch einmal einsammeln.
- Referenzwert, akzeptierten Bereich und Veränderung zwischen Runde 1 und Runde 2 übersichtlich auswerten.

**Details**

- Ganzzahlen oder Dezimalwerte.
- Absolutes Intervall oder relatives Toleranzband.
- Vor der Ergebnisfreigabe sehen Teilnehmende keine Verteilung und keine Lösungsnähe.
- Statistische Kennzahlen bleiben in der Host-Ansicht bewusst in einem ausklappbaren Detailbereich.

Bitte probiere die Schätzfrage in einer echten Veranstaltung aus. Ist der Ablauf verständlich? Sind Grafik und Statistik hilfreich? Fehlt etwas für deine Lehrsituation?

Dein Feedback hilft bei der weiteren Feinabstimmung.$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'en',
  $mden$# Estimate, discuss, compare

![Host view of a numeric estimate question about the French Revolution](/assets/images/numeric-estimate-1789-host.png)

The **numeric estimate question** lets you collect real number estimates in arsnova.eu, either in a single round or in two rounds with a short discussion in between.

**What it is for**

- Make prior knowledge visible without revealing the answer too early.
- Let learners estimate again after a discussion.
- Review the reference value, accepted range and the change from round 1 to round 2 in a calm result view.

**Details**

- Integer or decimal input.
- Absolute interval or relative tolerance band.
- Before results are released, participants do not see the distribution or how close they are to the solution.
- Statistics in the host view stay in an expandable detail section.

Please try the estimate question in a real class. Is the flow clear? Are the graphics and statistics useful? Is anything missing for your teaching situation?

Your feedback will help with the final refinement.$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'fr',
  $mdfr$# Estimer, discuter, comparer

![Vue hôte d'une question d'estimation numérique sur la Révolution française](/assets/images/numeric-estimate-1789-host.png)

La **question d'estimation numérique** permet de recueillir de vraies estimations chiffrées dans arsnova.eu, en un seul tour ou en deux tours avec une courte discussion entre les deux.

**À quoi elle sert**

- Rendre visibles les connaissances préalables sans révéler trop tôt la réponse.
- Redemander une estimation après une discussion.
- Examiner calmement la valeur de référence, la plage acceptée et l'évolution entre le premier et le second tour.

**Détails**

- Valeurs entières ou décimales.
- Intervalle absolu ou bande de tolérance relative.
- Avant la publication des résultats, les participantes et participants ne voient ni distribution ni proximité avec la solution.
- Les statistiques dans la vue hôte restent dans une section de détails dépliable.

Essaie cette question d'estimation dans un vrai cours. Le déroulement est-il clair ? Les graphiques et les statistiques sont-ils utiles ? Manque-t-il quelque chose pour ta situation d'enseignement ?

Ton retour aidera à finaliser les réglages.$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'es',
  $mdes$# Estimar, debatir, comparar

![Vista del anfitrión de una pregunta de estimación numérica sobre la Revolución francesa](/assets/images/numeric-estimate-1789-host.png)

La **pregunta de estimación numérica** permite recoger estimaciones con números reales en arsnova.eu, en una sola ronda o en dos rondas con una breve discusión intermedia.

**Para qué sirve**

- Hacer visible el conocimiento previo sin revelar la respuesta demasiado pronto.
- Volver a recoger estimaciones después de una discusión.
- Revisar con calma el valor de referencia, el rango aceptado y el cambio entre la ronda 1 y la ronda 2.

**Detalles**

- Entrada de números enteros o decimales.
- Intervalo absoluto o banda de tolerancia relativa.
- Antes de publicar los resultados, las personas participantes no ven la distribución ni su cercanía a la solución.
- Las estadísticas en la vista del anfitrión quedan en una sección desplegable de detalles.

Prueba la pregunta de estimación en una clase real. ¿El flujo se entiende? ¿Los gráficos y las estadísticas ayudan? ¿Falta algo para tu situación docente?

Tus comentarios ayudarán a afinarla.$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'it',
  $mdit$# Stimare, discutere, confrontare

![Vista host di una domanda di stima numerica sulla Rivoluzione francese](/assets/images/numeric-estimate-1789-host.png)

La **domanda di stima numerica** permette di raccogliere stime con numeri reali in arsnova.eu, in un solo turno oppure in due turni con una breve discussione intermedia.

**A cosa serve**

- Rendere visibili le conoscenze pregresse senza svelare subito la risposta.
- Raccogliere una seconda stima dopo una discussione.
- Esaminare con calma valore di riferimento, intervallo accettato e cambiamento tra turno 1 e turno 2.

**Dettagli**

- Numeri interi o decimali.
- Intervallo assoluto o banda di tolleranza relativa.
- Prima della pubblicazione dei risultati, le persone partecipanti non vedono la distribuzione né la vicinanza alla soluzione.
- Le statistiche nella vista host restano in una sezione dettagli espandibile.

Prova la domanda di stima in una lezione reale. Il flusso è chiaro? Grafici e statistiche sono utili? Manca qualcosa per la tua situazione didattica?

Il tuo feedback aiuterà a rifinirla.$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
