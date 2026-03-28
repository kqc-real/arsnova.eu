-- Making-of-MOTD: Marktwert → Herstellungskosten (OpenHub-Schätzung); contentVersion mindestens 5.
UPDATE "Motd"
SET "contentVersion" = GREATEST("contentVersion", 5), "updatedAt" = NOW()
WHERE "id" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $de_old$Die Zahlen sind atemberaubend: Während das bisherige arsnova-Ökosystem (frag.jetzt, arsnova.click) laut OpenHub einen Marktwert von 2 Millionen Dollar repräsentiert, kostete die Neuentwicklung lediglich 400 Dollar an Tokens.$de_old$,
  $de_new$Die Zahlen sind atemberaubend: OpenHub schätzt die Herstellungskosten für das alte ARSnova-Ökosystem auf rund 2 Millionen Dollar, die Neuentwicklung von arsnova.eu hat lediglich 400 Dollar an Tokens gekostet.$de_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'de';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $en_old$The numbers are staggering: While the legacy arsnova ecosystem is valued at $2 million, this new era was built for just $400 in API tokens.$en_old$,
  $en_new$The numbers are staggering: OpenHub estimates the cost to replicate the legacy ARSnova ecosystem at around $2 million; developing arsnova.eu cost just $400 in API tokens.$en_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'en';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $fr_old$Les chiffres parlent d'eux-mêmes : alors que l'écosystème classique est estimé à 2 millions de dollars, cette version a été générée pour seulement 400 dollars de tokens.$fr_old$,
  $fr_new$Les chiffres parlent d'eux-mêmes : OpenHub estime les coûts de reproduction de l'ancien écosystème ARSnova à environ 2 millions de dollars ; développer arsnova.eu n'a coûté que 400 dollars en tokens.$fr_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $es_old$Las cifras son asombrosas: mientras que el ecosistema original está valorado en 2 millones de dólares, la nueva arquitectura costó apenas 400 dólares en tokens.$es_old$,
  $es_new$Las cifras son asombrosas: OpenHub calcula en unos 2 millones de dólares el coste de reproducir el antiguo ecosistema ARSnova; desarrollar arsnova.eu apenas costó 400 dólares en tokens.$es_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'es';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $it_old$I numeri sono incredibili: l'intero ecosistema precedente aveva un valore stimato di 2 milioni di dollari; oggi, la nuova piattaforma è nata con soli 400 dollari di costi in token.$it_old$,
  $it_new$I numeri sono incredibili: OpenHub stima in circa 2 milioni di dollari i costi per replicare l'ex ecosistema ARSnova; sviluppare arsnova.eu è costato solo 400 dollari in token.$it_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'it';
