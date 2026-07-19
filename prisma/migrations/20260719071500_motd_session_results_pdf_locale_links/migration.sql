-- Demo-Nachbesprechungsplan: MOTD-Links auf locale-spezifische PDFs
-- (demo-session-results-30.{locale}.pdf). Idempotent: ersetzt nur, wenn alter Link noch gesetzt ist.

UPDATE "Motd"
SET
  "contentVersion" = 6,
  "updatedAt" = NOW()
WHERE "id" = 'c0222222-c222-4c22-8c22-c02222222222';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  '](/assets/demo/demo-session-results-30.pdf)',
  '](/assets/demo/demo-session-results-30.de.pdf)'
)
WHERE "motdId" = 'c0222222-c222-4c22-8c22-c02222222222'
  AND "locale" = 'de'
  AND "markdown" LIKE '%](/assets/demo/demo-session-results-30.pdf)%';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  '](/assets/demo/demo-session-results-30.pdf)',
  '](/assets/demo/demo-session-results-30.en.pdf)'
)
WHERE "motdId" = 'c0222222-c222-4c22-8c22-c02222222222'
  AND "locale" = 'en'
  AND "markdown" LIKE '%](/assets/demo/demo-session-results-30.pdf)%';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  '](/assets/demo/demo-session-results-30.pdf)',
  '](/assets/demo/demo-session-results-30.fr.pdf)'
)
WHERE "motdId" = 'c0222222-c222-4c22-8c22-c02222222222'
  AND "locale" = 'fr'
  AND "markdown" LIKE '%](/assets/demo/demo-session-results-30.pdf)%';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  '](/assets/demo/demo-session-results-30.pdf)',
  '](/assets/demo/demo-session-results-30.it.pdf)'
)
WHERE "motdId" = 'c0222222-c222-4c22-8c22-c02222222222'
  AND "locale" = 'it'
  AND "markdown" LIKE '%](/assets/demo/demo-session-results-30.pdf)%';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  '](/assets/demo/demo-session-results-30.pdf)',
  '](/assets/demo/demo-session-results-30.es.pdf)'
)
WHERE "motdId" = 'c0222222-c222-4c22-8c22-c02222222222'
  AND "locale" = 'es'
  AND "markdown" LIKE '%](/assets/demo/demo-session-results-30.pdf)%';
