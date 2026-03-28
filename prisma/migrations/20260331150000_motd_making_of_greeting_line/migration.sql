-- Making-of-MOTD: Grußblock mit Leerzeile vor dem Namen (Markdown-Absatz); contentVersion mindestens 4.
UPDATE "Motd"
SET "contentVersion" = GREATEST("contentVersion", 4), "updatedAt" = NOW()
WHERE "id" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- Ältere Varianten → Zielformat mit \n\n nach Gruß und vor MADE-Zeile
UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Beste Grüße,\nProf. Klaus Quibeldey-Cirkel\nProduct Owner, arsnova.eu\nMade in Europe – arsnova.eu',
  E'Beste Grüße\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'de';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Beste Grüße, Prof. Klaus Quibeldey-Cirkel\n(Product Owner von arsnova.eu)\nMade in Europe – arsnova.eu',
  E'Beste Grüße\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'de';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Best regards,\nProf. Klaus Quibeldey-Cirkel\nProduct Owner, arsnova.eu\nMade in Europe – arsnova.eu',
  E'Best regards\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'en';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Best regards, Prof. Klaus Quibeldey-Cirkel\n(Product Owner of arsnova.eu)\nMade in Europe – arsnova.eu',
  E'Best regards\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'en';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Bien à vous,\nProf. Klaus Quibeldey-Cirkel\nProduct Owner, arsnova.eu\nMade in Europe – arsnova.eu',
  E'Bien à vous\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Bien à vous, Prof. Klaus Quibeldey-Cirkel\n(Product Owner d''arsnova.eu)\nMade in Europe – arsnova.eu',
  E'Bien à vous\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Saludos cordiales,\nProf. Klaus Quibeldey-Cirkel\nProduct Owner, arsnova.eu\nMade in Europe – arsnova.eu',
  E'Saludos cordiales\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'es';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Saludos cordiales, Prof. Klaus Quibeldey-Cirkel\n(Product Owner de arsnova.eu)\nMade in Europe – arsnova.eu',
  E'Saludos cordiales\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'es';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Cordiali saluti,\nProf. Klaus Quibeldey-Cirkel\nProduct Owner, arsnova.eu\nMade in Europe – arsnova.eu',
  E'Cordiali saluti\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'it';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Cordiali saluti, Prof. Klaus Quibeldey-Cirkel\n(Product Owner di arsnova.eu)\nMade in Europe – arsnova.eu',
  E'Cordiali saluti\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'it';

-- Vorherige Fassung: nur ein \n zwischen Gruß und Name
UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Beste Grüße\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE',
  E'Beste Grüße\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'de';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Best regards\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE',
  E'Best regards\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'en';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Bien à vous\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE',
  E'Bien à vous\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Saludos cordiales\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE',
  E'Saludos cordiales\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'es';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  E'Cordiali saluti\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE',
  E'Cordiali saluti\n\nProf. Klaus Quibeldey-Cirkel\n\narsnova.eu – MADE in EUROPE'
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'it';
