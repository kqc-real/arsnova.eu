-- Making-of-MOTD (bbbbbbbb-…): Banner `![](/assets/images/AI-REVOLUTION.png)` unter der Überschrift (alle Locales).
-- contentVersion mindestens 8, sobald DE-Markdown das Bild enthält (idempotent bei erneutem Lauf).

-- de
UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $de_old$# The Making of arsnova.eu: Die KI-Revolution frisst ihre Kinder

Was du hier siehst$de_old$,
  $de_new$# The Making of arsnova.eu: Die KI-Revolution frisst ihre Kinder

![](/assets/images/AI-REVOLUTION.png)

Was du hier siehst$de_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND "locale" = 'de'
  AND "markdown" NOT LIKE '%/assets/images/AI-REVOLUTION.png%';

-- en
UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $en_old$# The Making of arsnova.eu: The AI Revolution Devours Its Children

What you're looking at$en_old$,
  $en_new$# The Making of arsnova.eu: The AI Revolution Devours Its Children

![](/assets/images/AI-REVOLUTION.png)

What you're looking at$en_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND "locale" = 'en'
  AND "markdown" NOT LIKE '%/assets/images/AI-REVOLUTION.png%';

-- fr
UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $fr_old$# Les coulisses d'arsnova.eu : La révolution de l'IA dévore ses enfants

Ce n'est pas$fr_old$,
  $fr_new$# Les coulisses d'arsnova.eu : La révolution de l'IA dévore ses enfants

![](/assets/images/AI-REVOLUTION.png)

Ce n'est pas$fr_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND "locale" = 'fr'
  AND "markdown" NOT LIKE '%/assets/images/AI-REVOLUTION.png%';

-- es
UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $es_old$# El "Making of" de arsnova.eu: La revolución de la IA devora a sus hijos

Esto no es$es_old$,
  $es_new$# El "Making of" de arsnova.eu: La revolución de la IA devora a sus hijos

![](/assets/images/AI-REVOLUTION.png)

Esto no es$es_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND "locale" = 'es'
  AND "markdown" NOT LIKE '%/assets/images/AI-REVOLUTION.png%';

-- it
UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $it_old$# Il "Making of" di arsnova.eu: La rivoluzione dell'IA divora i suoi figli

Non è un semplice$it_old$,
  $it_new$# Il "Making of" di arsnova.eu: La rivoluzione dell'IA divora i suoi figli

![](/assets/images/AI-REVOLUTION.png)

Non è un semplice$it_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND "locale" = 'it'
  AND "markdown" NOT LIKE '%/assets/images/AI-REVOLUTION.png%';

UPDATE "Motd"
SET
  "contentVersion" = GREATEST("contentVersion", 8),
  "updatedAt" = NOW()
WHERE "id" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND EXISTS (
    SELECT 1
    FROM "MotdLocale" ml
    WHERE ml."motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      AND ml."locale" = 'de'
      AND ml."markdown" LIKE '%/assets/images/AI-REVOLUTION.png%'
  );
