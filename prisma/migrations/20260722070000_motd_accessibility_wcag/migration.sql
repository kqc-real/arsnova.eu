-- Aktuelle Feature-MOTD: Barrierefreiheit / WCAG 2.2 AA.
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
  'c0333333-c333-4c33-8c33-c03333333333',
  'PUBLISHED',
  60,
  '2026-07-22 00:00:00'::timestamp(3),
  '2027-03-31 23:59:59.999'::timestamp(3),
  true,
  1,
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
  'c0333333-c333-4c33-8c33-c03333333333',
  'de',
  $mdde$### Barrierefreiheit, die allen hilft

Mit unserer Initiative für Barrierefreiheit haben wir arsnova.eu umfassend an **WCAG 2.2 AA** ausgerichtet und technisch wie manuell geprüft. Das macht die App für alle klarer, verlässlicher und flexibler bedienbar.

🧭 **Schneller zurechtfinden** – klare Überschriften, verständliche Beschriftungen und ein sichtbarer Tastaturfokus führen sicher durch die App.

⌨️ **Flexibel bedienen** – die zentralen Funktionen lassen sich mit Touchscreen, Tastatur, Screenreader und starker Vergrößerung nutzen.

📣 **Änderungen mitbekommen** – kurze Statusmeldungen informieren über den Beitritt, die Stimmabgabe und neue Phasen einer Session.

⏱️ **Im eigenen Tempo antworten** – bei Fragen mit Countdown stehen **Standard**, **10× Zeit** und **Ohne Frist** zur Wahl.

🧘 **Ablenkungen reduzieren** – die Live-Punktanzeige lässt sich ausblenden. Systemeinstellungen für weniger Bewegung und höheren Kontrast werden berücksichtigt.

📄 **Ergebnisse zugänglich nutzen** – Quizberichte stehen als klar strukturierte, barrierefreie PDF-Dokumente nach **PDF/UA** bereit.

Davon profitieren alle: durch größere Bedienelemente, klare Rückmeldungen und vorhersehbare Abläufe. Wer einen Screenreader nutzt, ausschließlich mit der Tastatur arbeitet, mehr Zeit benötigt oder Kontrast und Bewegung anpasst, erhält passende und verlässliche Zugänge.

**[Mehr über Barrierefreiheit auf arsnova.eu erfahren](/legal/accessibility)**

**Probiere aus, was für dich am besten funktioniert.**$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0333333-c333-4c33-8c33-c03333333333',
  'en',
  $mden$### Accessibility that benefits everyone

As part of our accessibility initiative, we have comprehensively aligned arsnova.eu with **WCAG 2.2 Level AA** and tested it both technically and manually. This makes the app clearer, more reliable and more flexible for everyone.

🧭 **Find your way around more easily** – clear headings, meaningful labels and a visible keyboard focus indicator guide you through the app.

⌨️ **Use the app your way** – all essential functions work with a touchscreen, keyboard, screen reader and high levels of zoom.

📣 **Keep up with changes** – concise status announcements let you know when you join, submit a vote or the session moves to a new phase.

⏱️ **Answer at your own pace** – for questions with a countdown, choose **Standard**, **10× Time** or **No Time Limit**.

🧘 **Reduce distractions** – you can hide the live score display. System settings for reduced motion and higher contrast are respected.

📄 **Use results accessibly** – quiz reports are available as clearly structured, accessible PDF documents conforming to **PDF/UA**.

Everyone benefits from larger controls, clear feedback and predictable interactions. People who use a screen reader, navigate exclusively by keyboard, need more time or adjust motion and contrast receive reliable ways to participate.

**[Learn more about accessibility on arsnova.eu](/legal/accessibility)**

**Try the settings that work best for you.**$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0333333-c333-4c33-8c33-c03333333333',
  'fr',
  $mdfr$### Une accessibilité utile à toutes et à tous

Dans le cadre de notre démarche en faveur de l’accessibilité, nous avons entièrement aligné arsnova.eu sur les **WCAG 2.2, niveau AA**, puis réalisé des tests techniques et manuels approfondis. L’application est ainsi plus claire, plus fiable et plus souple à utiliser pour tout le monde.

🧭 **S’orienter plus facilement** – des titres clairs, des libellés compréhensibles et un indicateur de focus clavier bien visible vous guident dans l’application.

⌨️ **Choisir son mode d’utilisation** – toutes les fonctions essentielles sont accessibles avec un écran tactile, un clavier, un lecteur d’écran ou un fort niveau de zoom.

📣 **Suivre les changements** – de brefs messages d’état signalent l’entrée dans une session, l’enregistrement d’un vote et le passage à une nouvelle phase.

⏱️ **Répondre à son rythme** – pour les questions avec compte à rebours, choisissez entre **Standard**, **Temps ×10** et **Sans limite de temps**.

🧘 **Limiter les distractions** – l’affichage du score en direct peut être masqué. Les réglages système pour réduire les animations et renforcer les contrastes sont pris en compte.

📄 **Consulter les résultats de manière accessible** – les rapports de quiz sont disponibles sous forme de documents PDF accessibles, clairement structurés et conformes à **PDF/UA**.

Tout le monde bénéficie de commandes plus grandes, d’indications claires et d’interactions prévisibles. Les personnes qui utilisent un lecteur d’écran, naviguent exclusivement au clavier, ont besoin de davantage de temps ou adaptent les animations et les contrastes disposent de moyens fiables pour participer.

**[En savoir plus sur l’accessibilité d’arsnova.eu](/legal/accessibility)**

**Essayez les réglages qui vous conviennent le mieux.**$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0333333-c333-4c33-8c33-c03333333333',
  'it',
  $mdit$### Un’accessibilità utile a tutte le persone

Con la nostra iniziativa per l’accessibilità abbiamo allineato in modo completo arsnova.eu alle **WCAG 2.2, livello AA**, sottoponendo l’applicazione a verifiche tecniche e manuali approfondite. L’app è così più chiara, affidabile e flessibile per tutte le persone.

🧭 **Orientarsi più facilmente** – titoli chiari, etichette comprensibili e un indicatore visibile del focus da tastiera guidano nell’utilizzo dell’app.

⌨️ **Scegliere come usare l’app** – tutte le funzioni principali sono disponibili tramite touchscreen, tastiera, screen reader e livelli elevati di ingrandimento.

📣 **Sapere cosa sta succedendo** – brevi messaggi di stato segnalano l’accesso, l’invio di una risposta e il passaggio a una nuova fase della sessione.

⏱️ **Rispondere secondo i propri tempi** – per le domande con conto alla rovescia è possibile scegliere tra **Standard**, **Tempo ×10** e **Senza limite di tempo**.

🧘 **Ridurre le distrazioni** – la visualizzazione in tempo reale del punteggio può essere nascosta. L’app rispetta le impostazioni di sistema per la riduzione dei movimenti e l’aumento del contrasto.

📄 **Consultare i risultati in modo accessibile** – i report dei quiz sono disponibili come documenti PDF accessibili, chiaramente strutturati e conformi a **PDF/UA**.

Tutte le persone beneficiano di controlli più grandi, riscontri chiari e interazioni prevedibili. Chi usa uno screen reader, naviga esclusivamente da tastiera, necessita di più tempo o personalizza movimento e contrasto dispone di modalità affidabili per partecipare.

**[Scopri di più sull’accessibilità di arsnova.eu](/legal/accessibility)**

**Prova le impostazioni più adatte alle tue esigenze.**$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0333333-c333-4c33-8c33-c03333333333',
  'es',
  $mdes$### Accesibilidad que beneficia a todo el mundo

Con nuestra iniciativa de accesibilidad hemos alineado de forma integral arsnova.eu con las **WCAG 2.2, nivel AA**, y hemos realizado pruebas técnicas y manuales exhaustivas. Así, la aplicación es más clara, fiable y flexible para todo el mundo.

🧭 **Orientarse más fácilmente** – unos encabezados claros, etiquetas comprensibles y un indicador visible del foco del teclado guían por la aplicación.

⌨️ **Elegir cómo utilizar la aplicación** – todas las funciones principales se pueden usar mediante pantalla táctil, teclado, lector de pantalla y niveles altos de ampliación.

📣 **Saber qué está sucediendo** – los mensajes breves de estado informan al entrar, enviar una respuesta y pasar a una nueva fase de la sesión.

⏱️ **Responder al propio ritmo** – en las preguntas con cuenta atrás se puede elegir entre **Estándar**, **10× de tiempo** y **Sin límite de tiempo**.

🧘 **Reducir las distracciones** – la puntuación en directo se puede ocultar. La aplicación respeta los ajustes del sistema para reducir el movimiento y aumentar el contraste.

📄 **Consultar los resultados de forma accesible** – los informes de los cuestionarios están disponibles como documentos PDF accesibles, claramente estructurados y conformes con **PDF/UA**.

Todo el mundo se beneficia de controles más grandes, indicaciones claras e interacciones predecibles. Quienes utilizan un lector de pantalla, navegan exclusivamente con el teclado, necesitan más tiempo o personalizan el movimiento y el contraste cuentan con formas fiables de participar.

**[Más información sobre la accesibilidad de arsnova.eu](/legal/accessibility)**

**Prueba los ajustes que mejor se adapten a ti.**$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
