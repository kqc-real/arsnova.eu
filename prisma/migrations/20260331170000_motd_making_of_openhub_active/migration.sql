-- Making-of-MOTD: passive „Laut OpenHub würden … geschätzt“ → aktive OpenHub-Formulierung (alle Locales); contentVersion mindestens 6.
UPDATE "Motd"
SET "contentVersion" = GREATEST("contentVersion", 6), "updatedAt" = NOW()
WHERE "id" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $de_old$Die Zahlen sind atemberaubend: Laut OpenHub würden die Herstellungskosten für das bisherige arsnova-Ökosystem (frag.jetzt, arsnova.click) auf rund 2 Millionen Dollar geschätzt, während die Neuentwicklung lediglich 400 Dollar an Tokens kostete.$de_old$,
  $de_new$Die Zahlen sind atemberaubend: OpenHub schätzt die Herstellungskosten für das alte ARSnova-Ökosystem auf rund 2 Millionen Dollar, die Neuentwicklung von arsnova.eu hat lediglich 400 Dollar an Tokens gekostet.$de_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'de';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $en_old$The numbers are staggering: OpenHub estimates the cost to replicate the legacy arsnova ecosystem (frag.jetzt, arsnova.click) at around $2 million, while this new development cost just $400 in API tokens.$en_old$,
  $en_new$The numbers are staggering: OpenHub estimates the cost to replicate the legacy ARSnova ecosystem at around $2 million; developing arsnova.eu cost just $400 in API tokens.$en_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'en';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $fr_old$Les chiffres parlent d'eux-mêmes : OpenHub estime le coût de reproduction de l'écosystème historique (frag.jetzt, arsnova.click) à environ 2 millions de dollars, alors que cette version n'a coûté que 400 dollars en tokens.$fr_old$,
  $fr_new$Les chiffres parlent d'eux-mêmes : OpenHub estime les coûts de reproduction de l'ancien écosystème ARSnova à environ 2 millions de dollars ; développer arsnova.eu n'a coûté que 400 dollars en tokens.$fr_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $es_old$Las cifras son asombrosas: OpenHub estima que reproducir el ecosistema anterior (frag.jetzt, arsnova.click) costaría unos 2 millones de dólares, mientras que este nuevo desarrollo apenas supuso 400 dólares en tokens.$es_old$,
  $es_new$Las cifras son asombrosas: OpenHub calcula en unos 2 millones de dólares el coste de reproducir el antiguo ecosistema ARSnova; desarrollar arsnova.eu apenas costó 400 dólares en tokens.$es_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'es';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  $it_old$I numeri sono incredibili: OpenHub stima in circa 2 milioni di dollari i costi necessari a replicare l'ecosistema precedente (frag.jetzt, arsnova.click); lo sviluppo qui presente, invece, è costato solo 400 dollari in token.$it_old$,
  $it_new$I numeri sono incredibili: OpenHub stima in circa 2 milioni di dollari i costi per replicare l'ex ecosistema ARSnova; sviluppare arsnova.eu è costato solo 400 dollari in token.$it_new$
)
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'it';
