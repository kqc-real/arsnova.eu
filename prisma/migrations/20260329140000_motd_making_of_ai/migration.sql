-- Making-of / KI-News MOTD: nach der Willkommens-MOTD (Priorität -110 unter effektiv -101).
-- Feste ID bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb; startsAt = Willkommen (24.03.), sonst Lücke bis 28.03.
INSERT INTO "Motd" (
  "id", "status", "priority", "startsAt", "endsAt",
  "visibleInArchive", "contentVersion", "templateId",
  "createdAt", "updatedAt"
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'PUBLISHED',
  -110,
  '2026-03-24 00:00:00'::timestamp(3),
  '2026-09-28 23:59:59.999'::timestamp(3),
  true,
  6,
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
VALUES (gen_random_uuid()::text, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'de', $mdde$# The Making of arsnova.eu: Die KI-Revolution frisst ihre Kinder

Was du hier siehst, ist kein gewöhnliches Update – es ist das Ende der Software-Entwicklung, wie wir sie kennen. arsnova.eu wurde komplett von KI-Agenten programmiert.

Die Zahlen sind atemberaubend: OpenHub schätzt die Herstellungskosten für das alte ARSnova-Ökosystem auf rund 2 Millionen Dollar, die Neuentwicklung von arsnova.eu hat lediglich 400 Dollar an Tokens gekostet. Der KI-Agent schrieb unter meiner Regie über 100.000 Zeilen Code in wenigen Stunden. Meine Rolle als Product Owner, Architekt und QA-Tester beanspruchte insgesamt weniger als eine Arbeitswoche.

Mein Appell: Wir müssen das Informatik-Curriculum jetzt radikal auf den Kopf stellen! Wir sollten aufhören, Programmiersyntax zu pauken und Codezeilen zu schreiben. Stattdessen müssen wir lehren, Anforderungen tiefgreifend zu verstehen und als Architekten und Dirigenten die Entwicklung durch KI-Agenten zu meistern. Das ist die neue Kunst der Effizienz.

Beste Grüße

Prof. Klaus Quibeldey-Cirkel

arsnova.eu – MADE in EUROPE$mdde$)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";


INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (gen_random_uuid()::text, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'en', $mden$# The Making of arsnova.eu: The AI Revolution Devours Its Children

What you're looking at isn't just an update—it's a paradigm shift. The new arsnova.eu was coded entirely by AI agents.

The numbers are staggering: OpenHub estimates the cost to replicate the legacy ARSnova ecosystem at around $2 million; developing arsnova.eu cost just $400 in API tokens. Under my direction, the AI agent generated over 100,000 lines of code in just a few hours. My entire role as Product Owner, architect, and QA tester took less than a single work week.

My appeal: We must radically overhaul the computer science curriculum now! We should stop focusing on memorizing syntax and writing lines of code. Instead, we must teach how to deeply understand requirements and how to act as architects and conductors of AI-driven development. This is the new art of efficiency.

Best regards

Prof. Klaus Quibeldey-Cirkel

arsnova.eu – MADE in EUROPE$mden$)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";


INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (gen_random_uuid()::text, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'fr', $mdfr$# Les coulisses d'arsnova.eu : La révolution de l'IA dévore ses enfants

Ce n'est pas une mise à jour, c'est une rupture technologique. Le nouvel arsnova.eu a été intégralement programmé par des agents d'IA.

Les chiffres parlent d'eux-mêmes : OpenHub estime les coûts de reproduction de l'ancien écosystème ARSnova à environ 2 millions de dollars ; développer arsnova.eu n'a coûté que 400 dollars en tokens. L'agent d'IA a rédigé plus de 100 000 lignes de code en quelques heures sous ma direction. Mon travail de Product Owner, d'architecte et de testeur QA a duré moins d'une semaine.

Mon appel : Nous devons radicalement transformer le cursus informatique dès maintenant ! Nous devrions cesser de rabâcher la syntaxe de programmation. Nous devons plutôt enseigner la compréhension profonde des besoins et apprendre à devenir les architectes et les chefs d'orchestre du développement par IA. C'est l'art nouveau de l'efficience.

Bien à vous

Prof. Klaus Quibeldey-Cirkel

arsnova.eu – MADE in EUROPE$mdfr$)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";


INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (gen_random_uuid()::text, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'es', $mdes$# El "Making of" de arsnova.eu: La revolución de la IA devora a sus hijos

Esto no es una actualización, es una disrupción total. El nuevo arsnova.eu ha sido programado íntegramente por agentes de IA.

Las cifras son asombrosas: OpenHub calcula en unos 2 millones de dólares el coste de reproducir el antiguo ecosistema ARSnova; desarrollar arsnova.eu apenas costó 400 dólares en tokens. El agente de IA generó más de 100.000 líneas de código en unas pocas horas bajo mi dirección. Mi labor como Product Owner y arquitecto tomó menos de una semana de trabajo.

Mi llamamiento: ¡Debemos transformar radicalmente el currículo de informática ahora! Deberíamos dejar de memorizar sintaxis y escribir líneas de código. En su lugar, debemos enseñar a entender profundamente los requisitos y a actuar como arquitectos y directores del desarrollo basado en IA. Es el nuevo arte de la eficiencia.

Saludos cordiales

Prof. Klaus Quibeldey-Cirkel

arsnova.eu – MADE in EUROPE$mdes$)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";


INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (gen_random_uuid()::text, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'it', $mdit$# Il "Making of" di arsnova.eu: La rivoluzione dell'IA divora i suoi figli

Non è un semplice restyling, è un salto nel futuro. Il nuovo arsnova.eu è stato interamente programmato da agenti di intelligenza artificiale.

I numeri sono incredibili: OpenHub stima in circa 2 milioni di dollari i costi per replicare l'ex ecosistema ARSnova; sviluppare arsnova.eu è costato solo 400 dollari in token. Sotto la mia regia, l'agente IA ha scritto oltre 100.000 righe di codice in poche ore. Il mio ruolo di Product Owner e architetto ha richiesto meno di una settimana di lavoro.

Il mio appello: Dobbiamo rivoluzionare radicalmente il curriculum di informatica adesso! Dovremmo smettere di imparare la sintassi a memoria. Dobbiamo invece insegnare a comprendere a fondo i requisiti e a diventare architetti e direttori dello sviluppo tramite agenti IA. Questa è la nuova arte dell'efficienza.

Cordiali saluti

Prof. Klaus Quibeldey-Cirkel

arsnova.eu – MADE in EUROPE$mdit$)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
