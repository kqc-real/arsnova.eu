-- Willkommens-MOTD: kompakter Launch-Text in allen Locales, contentVersion 5.
UPDATE "Motd"
SET "contentVersion" = 5, "updatedAt" = NOW()
WHERE "id" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

UPDATE "MotdLocale"
SET "markdown" = $v5de$# In 30 Sekunden live.

Quiz erstellen, QR-Code teilen, loslegen: Abstimmung, Peer Instruction, Q&A, Team-Modus und Bonus-Code – ohne Account, ohne Tracking, Open Source und DSGVO-orientiert. Weniger Plattform-Overhead als Particify, weniger Vendor-Lock-in als Mentimeter, lehrnäher als Kahoot, schlanker als Slido.

**Jetzt ausprobieren**$v5de$
WHERE "motdId" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND "locale" = 'de';

UPDATE "MotdLocale"
SET "markdown" = $v5en$# Live in 30 seconds.

Create a quiz, share the QR code, start teaching: polling, Peer Instruction, Q&A, team mode and bonus codes — no account, no tracking, open source and privacy-first. Less platform overhead than Particify, less vendor lock-in than Mentimeter, more teaching-focused than Kahoot, leaner than Slido.

**Try it now**$v5en$
WHERE "motdId" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND "locale" = 'en';

UPDATE "MotdLocale"
SET "markdown" = $v5fr$# En direct en 30 secondes.

Créez un quiz, partagez le QR code, lancez la séance : vote, Peer Instruction, Q&R, mode équipes et codes bonus — sans compte, sans pistage, open source et pensé pour la confidentialité. Moins lourd que Particify, moins verrouillé que Mentimeter, plus pédagogique que Kahoot, plus direct que Slido.

**Essayer maintenant**$v5fr$
WHERE "motdId" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = $v5es$# En vivo en 30 segundos.

Crea un quiz, comparte el código QR y empieza: votaciones, Peer Instruction, preguntas y respuestas, modo equipos y códigos bonus — sin cuenta, sin rastreo, open source y con privacidad desde el diseño. Menos carga que Particify, menos dependencia que Mentimeter, más orientado a la docencia que Kahoot, más ágil que Slido.

**Pruébalo ahora**$v5es$
WHERE "motdId" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND "locale" = 'es';

UPDATE "MotdLocale"
SET "markdown" = $v5it$# Live in 30 secondi.

Crea un quiz, condividi il QR code e parti: sondaggi, Peer Instruction, Q&A, modalità team e codici bonus — senza account, senza tracking, open source e privacy-first. Meno struttura di Particify, meno lock-in di Mentimeter, più didattico di Kahoot, più snello di Slido.

**Provalo ora**$v5it$
WHERE "motdId" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND "locale" = 'it';
