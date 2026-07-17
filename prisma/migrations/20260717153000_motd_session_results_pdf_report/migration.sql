-- Aktuelle Feature-MOTD: PDF-Auswertungsreport fuer Lehrkraefte.
-- Feste ID; idempotent fuer lokale Seeds und produktive Migrationen.

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
  'c0222222-c222-4c22-8c22-c02222222222',
  'PUBLISHED',
  55,
  '2026-07-17 00:00:00'::timestamp(3),
  '2027-03-31 23:59:59.999'::timestamp(3),
  true,
  2,
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
  'c0222222-c222-4c22-8c22-c02222222222',
  'de',
  $mdde$### Neu: Der PDF-Auswertungsreport für Lehrkräfte

Nach dem Quiz zeigt dir arsnova.eu nicht nur die Ergebnisse, sondern auch, **was du daraus für deine Lehre ableiten kannst**.

⚠️ **Fehlkonzepte erkennen** – falsch geantwortet und trotzdem sicher.

🧩 **Lernlücken aufdecken** – geringe Lösungsquote oder hohe Unsicherheit.

✅ **Richtige Antworten festigen** – korrekt, aber noch nicht sicher verankert.

🔄 **Peer Instruction auswerten** – mit direktem Vergleich der beiden Abstimmungsrunden.

🎯 **Typische Antwortfehler verstehen** – einschließlich auffälliger falscher Optionen und übersehener richtiger Antworten.

Auf der ersten Seite erhältst du einen automatisch priorisierten **Nachbesprechungsplan** mit einem konkreten Vorschlag für den Einstieg. Der Report enthält außerdem Lernstand und Selbsteinschätzung, Sessionfeedback, Team-Lernprofile sowie eine detaillierte Auswertung jeder Frage.

Alle Ergebnisse bleiben anonym zusammengefasst und werden übersichtlich als PDF aufbereitet.

**Quiz durchführen, PDF öffnen, gezielt nachbesprechen.**$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0222222-c222-4c22-8c22-c02222222222',
  'en',
  $mden$### New: The PDF results report for instructors

After a quiz, arsnova.eu shows you more than the results. It also highlights **what they mean for your teaching**.

⚠️ **Spot misconceptions** – answers that were wrong but given with confidence.

🧩 **Identify gaps in understanding** – low success rates or high uncertainty.

✅ **Reinforce correct answers** – correct, but not yet firmly understood.

🔄 **Evaluate Peer Instruction** – with a direct comparison of both voting rounds.

🎯 **Understand common answer patterns** – including misleading options and correct choices that were often missed.

The first page gives you an automatically prioritised **debriefing plan**, including a clear recommendation on where to start. The report also covers learning progress and confidence, participant feedback, team learning profiles, and a detailed breakdown of every question.

All results remain anonymously aggregated and are presented in a clear PDF report.

**Run the quiz, open the PDF, and focus your debrief where it matters most.**$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0222222-c222-4c22-8c22-c02222222222',
  'fr',
  $mdfr$### Nouveau : le rapport PDF d’évaluation pour les enseignants

Après le quiz, arsnova.eu ne se contente pas d’afficher les résultats. La plateforme montre aussi **ce qu’ils impliquent pour votre enseignement**.

⚠️ **Repérez les conceptions erronées** – des réponses fausses données avec assurance.

🧩 **Identifiez les lacunes** – un faible taux de réussite ou une forte incertitude.

✅ **Consolidez les bonnes réponses** – justes, mais pas encore solidement acquises.

🔄 **Évaluez l’effet de la Peer Instruction** – grâce à une comparaison directe des deux tours de vote.

🎯 **Comprenez les erreurs récurrentes** – notamment les options trompeuses et les bonnes réponses souvent oubliées.

La première page propose un **plan de débriefing automatiquement hiérarchisé**, avec une recommandation claire pour commencer. Le rapport présente également le niveau de maîtrise, le degré de confiance, les retours des participants, les profils d’apprentissage des équipes et une analyse détaillée de chaque question.

Tous les résultats restent agrégés de manière anonyme et sont présentés dans un PDF clair et structuré.

**Lancez le quiz, ouvrez le PDF et ciblez précisément le débriefing.**$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0222222-c222-4c22-8c22-c02222222222',
  'it',
  $mdit$### Novità: il report PDF dei risultati per docenti

Dopo il quiz, arsnova.eu non mostra soltanto i risultati, ma anche **che cosa indicano per la didattica**.

⚠️ **Individua le convinzioni errate** – risposte sbagliate date con sicurezza.

🧩 **Rileva le lacune** – percentuali basse di risposte corrette o forte incertezza.

✅ **Consolida le risposte corrette** – giuste, ma non ancora pienamente acquisite.

🔄 **Valuta la Peer Instruction** – confrontando direttamente i due turni di voto.

🎯 **Comprendi gli errori ricorrenti** – comprese le opzioni fuorvianti e le risposte corrette spesso trascurate.

Nella prima pagina trovi un **piano di revisione ordinato automaticamente per priorità**, con un’indicazione concreta su da dove iniziare. Il report include inoltre livello di apprendimento e sicurezza nelle risposte, feedback dei partecipanti, profili di apprendimento dei team e un’analisi dettagliata di ogni domanda.

Tutti i risultati restano aggregati in forma anonima e vengono presentati in un PDF chiaro e ben strutturato.

**Svolgi il quiz, apri il PDF e concentra la revisione sui punti davvero importanti.**$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0222222-c222-4c22-8c22-c02222222222',
  'es',
  $mdes$### Novedad: el informe PDF de resultados para docentes

Después del cuestionario, arsnova.eu no solo muestra los resultados, sino también **qué implicaciones tienen para la enseñanza**.

⚠️ **Detecta ideas erróneas** – respuestas incorrectas dadas con seguridad.

🧩 **Identifica lagunas de aprendizaje** – bajo porcentaje de aciertos o mucha inseguridad.

✅ **Refuerza las respuestas correctas** – acertadas, pero todavía no bien consolidadas.

🔄 **Evalúa la Peer Instruction** – mediante una comparación directa de las dos rondas de votación.

🎯 **Comprende los errores más frecuentes** – incluidas las opciones engañosas y las respuestas correctas que se pasaron por alto.

En la primera página encontrarás un **plan de revisión priorizado automáticamente**, con una recomendación clara sobre por dónde empezar. El informe también incluye el nivel de aprendizaje y la seguridad en las respuestas, la valoración de los participantes, los perfiles de aprendizaje de los equipos y un análisis detallado de cada pregunta.

Todos los resultados se mantienen agregados de forma anónima y se presentan en un PDF claro y bien estructurado.

**Realiza el cuestionario, abre el PDF y centra la revisión en lo que realmente importa.**$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
