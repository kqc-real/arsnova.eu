-- Vollständiger Copy-Audit der 14 redaktionell veröffentlichten MOTDs.
-- Korrigiert Anrede, locale-spezifische Anführungszeichen und missverständliche
-- Übersetzungen. Die festen Versionsnummern halten das Dev-Re-Seeding idempotent.

UPDATE "MotdLocale"
SET "markdown" = $welcome_fr$# Un clic. Tu es en direct.

Lance un feedback express — ou utilise les quiz, les sondages, les questions-réponses, la Peer Instruction, le mode équipe et les codes bonus. Une interaction façon Mentimeter sans dépendre d’un fournisseur. L’énergie de Kahoot avec une vraie valeur pédagogique. Des questions-réponses façon Slido, avec une interaction en direct complète. Sans compte, sans suivi, open source et gratuit.

**Essaie maintenant**$welcome_fr$
WHERE "motdId" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = $welcome_es$# Un clic. Estás en directo.

Lanza un feedback rápido — o usa cuestionarios, votaciones, preguntas y respuestas, Peer Instruction, modo por equipos y códigos de bonificación. Interacción al estilo Mentimeter sin depender de un proveedor. La energía de Kahoot con verdadero valor didáctico. Preguntas y respuestas al estilo Slido, con una interacción en directo completa. Sin cuenta, sin rastreo, de código abierto y gratis.

**Pruébalo ahora**$welcome_es$
WHERE "motdId" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND "locale" = 'es';

UPDATE "MotdLocale"
SET "markdown" = $welcome_it$# Un clic. Sei in diretta.

Avvia subito un feedback rapido — oppure usa quiz, sondaggi, domande e risposte, Peer Instruction, modalità a squadre e codici bonus. Interazione in stile Mentimeter senza dipendere da un fornitore. L’energia di Kahoot con un vero valore didattico. Domande e risposte in stile Slido, con un’interazione in diretta completa. Senza account, senza tracciamento, open source e gratis.

**Provalo ora**$welcome_it$
WHERE "motdId" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND "locale" = 'it';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", 'El "Making of" de arsnova.eu', 'El «Making of» de arsnova.eu')
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'es';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", 'Il "Making of" di arsnova.eu', 'Il «Making of» di arsnova.eu')
WHERE "motdId" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND "locale" = 'it';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", 'real number estimates', 'numerical estimates')
WHERE "motdId" = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' AND "locale" = 'en';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", 'de vraies estimations chiffrées', 'des estimations chiffrées')
WHERE "motdId" = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", 'estimaciones con números reales', 'estimaciones numéricas')
WHERE "motdId" = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' AND "locale" = 'es';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", 'stime con numeri reali', 'stime numeriche')
WHERE "motdId" = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' AND "locale" = 'it';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", '**„Quiz mit KI erstellen“**', '**»Quiz mit KI erstellen«**')
WHERE "motdId" = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0' AND "locale" = 'de';

UPDATE "MotdLocale"
SET "markdown" = $ai_fr$# Transforme tes supports en quiz.

# 📚 → 🤖 → 🎯

**Génération de quiz avec l’IA pour préparer tes cours**

Des diapositives, des notes de cours ou des objectifs d’apprentissage suffisent. Dans ta bibliothèque de quiz, ouvre « Créer un quiz avec l’IA », copie le **modèle de génération** dans ton chat avec l’IA et ajoute tes supports.

Envoie ensuite le **modèle de vérification** dans le même chat. Il harmonise les options de réponse, améliore les distracteurs et vérifie le JSON avant l’import.

**Résultat :** en quelques minutes, tu obtiens un brouillon de quiz importable que tu peux vérifier dans arsnova.eu, ajuster et utiliser en cours.

**À retrouver dans ta bibliothèque de quiz.**$ai_fr$
WHERE "motdId" = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", '**« Dernière évaluation »**', '**« Dernière évaluation »**')
WHERE "motdId" = 'c0111111-c111-4c11-8c11-c01111111111' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", '**« Última evaluación »**', '**«Última evaluación»**')
WHERE "motdId" = 'c0111111-c111-4c11-8c11-c01111111111' AND "locale" = 'es';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", '**« Ultima valutazione »**', '**«Ultima valutazione»**')
WHERE "motdId" = 'c0111111-c111-4c11-8c11-c01111111111' AND "locale" = 'it';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", '**„Letzte Auswertung“**', '**»Letzte Auswertung«**')
WHERE "motdId" = 'c0111111-c111-4c11-8c11-c01111111111' AND "locale" = 'de';

UPDATE "MotdLocale"
SET "markdown" = $pdf_fr$### Nouveau : le plan de débriefing en PDF

Après le quiz, arsnova.eu ne se contente pas d’afficher les résultats. La plateforme te montre aussi **ce qu’ils impliquent pour ton enseignement**.

⚠️ **Repère les conceptions erronées** – des réponses fausses données avec assurance.

🧩 **Identifie les lacunes** – un faible taux de réussite ou une forte incertitude.

✅ **Consolide les bonnes réponses** – justes, mais pas encore solidement acquises.

🔄 **Évalue l’effet de la Peer Instruction** – grâce à une comparaison directe des deux tours de vote.

🎯 **Comprends les erreurs récurrentes** – notamment les options trompeuses et les bonnes réponses souvent oubliées.

La première page te propose un **plan de débriefing automatiquement hiérarchisé**, avec une recommandation claire pour commencer. Le plan présente également le niveau de maîtrise, le degré de confiance, les retours des participants, les profils d’apprentissage des équipes et une analyse détaillée de chaque question.

Tous les résultats restent agrégés de manière anonyme et sont présentés dans un PDF clair et structuré.

**Voir un exemple :** [Ouvrir le plan de débriefing en PDF](/assets/demo/demo-session-results-30.fr.pdf)

**Lance le quiz, ouvre le plan de débriefing et cible précisément les points à revoir.**$pdf_fr$
WHERE "motdId" = 'c0222222-c222-4c22-8c22-c02222222222' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = $accessibility_fr$### Une accessibilité utile à toutes et à tous

Dans le cadre de notre démarche en faveur de l’accessibilité, nous avons entièrement aligné arsnova.eu sur les **WCAG 2.2, niveau AA**, puis réalisé des tests techniques et manuels approfondis. L’application est ainsi plus claire, plus fiable et plus souple à utiliser pour tout le monde.

🧭 **T’orienter plus facilement** – des titres clairs, des libellés compréhensibles et un indicateur de focus clavier bien visible te guident dans l’application.

⌨️ **Choisir ton mode d’utilisation** – toutes les fonctions essentielles sont accessibles avec un écran tactile, un clavier, un lecteur d’écran ou un fort niveau de zoom.

📣 **Suivre les changements** – de brefs messages d’état signalent ton entrée dans une session, l’enregistrement de ton vote et le passage à une nouvelle phase.

⏱️ **Répondre à ton rythme** – pour les questions avec compte à rebours, choisis entre **Standard**, **Temps ×10** et **Sans limite de temps**.

🧘 **Limiter les distractions** – tu peux masquer l’affichage du score en direct. Les réglages système pour réduire les animations et renforcer les contrastes sont pris en compte.

📄 **Consulter les résultats de manière accessible** – les rapports de quiz sont disponibles sous forme de documents PDF accessibles, clairement structurés et conformes à **PDF/UA**.

Tout le monde bénéficie de commandes plus grandes, d’indications claires et d’interactions prévisibles. Si tu utilises un lecteur d’écran, navigues exclusivement au clavier, as besoin de davantage de temps ou adaptes les animations et les contrastes, tu disposes de moyens fiables pour participer.

**[En savoir plus sur l’accessibilité d’arsnova.eu](/fr/legal/accessibility)**

**Essaie les réglages qui te conviennent le mieux.**$accessibility_fr$
WHERE "motdId" = 'c0333333-c333-4c33-8c33-c03333333333' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", '**« Améliorer arsnova.eu »**', '**« Améliorer arsnova.eu »**')
WHERE "motdId" = 'c0666666-c666-4c66-8c66-c06666666666' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE("markdown", '**„arsnova.eu verbessern“**', '**»arsnova.eu verbessern«**')
WHERE "motdId" = 'c0666666-c666-4c66-8c66-c06666666666' AND "locale" = 'de';

UPDATE "MotdLocale"
SET "markdown" = $personal_time_fr$### Le temps ne doit pas être un obstacle.

Avec « Temps personnalisé », les participants bénéficient du temps de réponse supplémentaire dont ils ont besoin – par exemple en cas de dyslexie, de dyscalculie ou de déficience visuelle, ou lors de l’utilisation d’un lecteur d’écran. Une fois le compte à rebours terminé, seul le minimum de points est accordé afin que la compétition reste équitable. Tu peux désactiver l’option dans l’éditeur du quiz – dans la mesure du possible, laisse-la activée afin que tout le monde puisse participer dans des conditions équitables.$personal_time_fr$
WHERE "motdId" = 'c0777777-c777-4c77-8c77-c07777777777' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  '### 🧩 Recueille les questions avant – arrive préparé.',
  '### 🧩 Recueille les questions à l’avance – prépare ta séance.'
)
WHERE "motdId" = 'c0888888-c888-4c88-8c88-c08888888888' AND "locale" = 'fr';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  '### 🧩 Recoge las preguntas antes – y llega con la sesión pensada.',
  '### 🧩 Recoge las preguntas antes y prepara la sesión.'
)
WHERE "motdId" = 'c0888888-c888-4c88-8c88-c08888888888' AND "locale" = 'es';

UPDATE "MotdLocale"
SET "markdown" = REPLACE(
  "markdown",
  '### 🧩 Raccogli le domande prima – e arriva preparato.',
  '### 🧩 Raccogli le domande prima e prepara la sessione.'
)
WHERE "motdId" = 'c0888888-c888-4c88-8c88-c08888888888' AND "locale" = 'it';

UPDATE "MotdLocale"
SET "markdown" = $host_ux_fr$### Animer plus facilement des quiz, des questions-réponses et des sondages rapides

Nous voulons rendre arsnova.eu plus simple à utiliser pour les personnes qui enseignent ou animent des événements. Sur la page d’accueil, un choix rapide t’aidera à partir de ton besoin du moment : accompagner un cours, animer un événement ou lancer rapidement une seule activité. Pendant une session, la prochaine action et les informations essentielles seront mises en avant. Les autres réglages et outils resteront accessibles au besoin.

Notre objectif est de te permettre de démarrer plus vite et de mieux garder le fil pendant l’animation. Quelles commandes as-tu du mal à trouver aujourd’hui ? Où dois-tu faire trop de choix ? Écris-nous par courriel à l’adresse indiquée dans les [mentions légales](https://arsnova.eu/fr/legal/imprint/). Les exemples concrets tirés de tes sessions nous aideront particulièrement.$host_ux_fr$
WHERE "motdId" = 'c0999999-c999-4c99-8c99-c09999999999' AND "locale" = 'fr';

UPDATE "Motd"
SET "contentVersion" = CASE "id"
  WHEN 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' THEN GREATEST("contentVersion", 8)
  WHEN 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' THEN GREATEST("contentVersion", 9)
  WHEN 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' THEN GREATEST("contentVersion", 5)
  WHEN 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0' THEN GREATEST("contentVersion", 2)
  WHEN 'c0111111-c111-4c11-8c11-c01111111111' THEN GREATEST("contentVersion", 10)
  WHEN 'c0222222-c222-4c22-8c22-c02222222222' THEN GREATEST("contentVersion", 7)
  WHEN 'c0333333-c333-4c33-8c33-c03333333333' THEN GREATEST("contentVersion", 2)
  WHEN 'c0666666-c666-4c66-8c66-c06666666666' THEN GREATEST("contentVersion", 2)
  WHEN 'c0777777-c777-4c77-8c77-c07777777777' THEN GREATEST("contentVersion", 2)
  WHEN 'c0888888-c888-4c88-8c88-c08888888888' THEN GREATEST("contentVersion", 3)
  WHEN 'c0999999-c999-4c99-8c99-c09999999999' THEN GREATEST("contentVersion", 2)
  ELSE "contentVersion"
END,
"updatedAt" = NOW()
WHERE "id" IN (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0',
  'c0111111-c111-4c11-8c11-c01111111111',
  'c0222222-c222-4c22-8c22-c02222222222',
  'c0333333-c333-4c33-8c33-c03333333333',
  'c0666666-c666-4c66-8c66-c06666666666',
  'c0777777-c777-4c77-8c77-c07777777777',
  'c0888888-c888-4c88-8c88-c08888888888',
  'c0999999-c999-4c99-8c99-c09999999999'
);

-- Der Audit umfasst alle fest ausgelieferten veröffentlichten MOTDs, auch wenn
-- ihre Copy unverändert bleiben konnte. Jede davon muss fünf nichtleere Locales besitzen.
DO $audit$
DECLARE
  incomplete_count integer;
BEGIN
  WITH audited_ids(id) AS (
    VALUES
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
      ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
      ('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'),
      ('c0111111-c111-4c11-8c11-c01111111111'),
      ('c0222222-c222-4c22-8c22-c02222222222'),
      ('c0333333-c333-4c33-8c33-c03333333333'),
      ('c0444444-c444-4c44-8c44-c04444444444'),
      ('c0555555-c555-4c55-8c55-c05555555555'),
      ('c0666666-c666-4c66-8c66-c06666666666'),
      ('c0777777-c777-4c77-8c77-c07777777777'),
      ('c0888888-c888-4c88-8c88-c08888888888'),
      ('c0999999-c999-4c99-8c99-c09999999999')
  ), locale_coverage AS (
    SELECT a.id,
      COUNT(*) FILTER (
        WHERE ml.locale IN ('de', 'en', 'fr', 'es', 'it')
          AND BTRIM(ml.markdown) <> ''
      ) AS complete_locales
    FROM audited_ids a
    LEFT JOIN "Motd" m ON m.id = a.id AND m.status = 'PUBLISHED'
    LEFT JOIN "MotdLocale" ml ON ml."motdId" = m.id
    GROUP BY a.id
  )
  SELECT COUNT(*) INTO incomplete_count
  FROM locale_coverage
  WHERE complete_locales <> 5;

  IF incomplete_count > 0 THEN
    RAISE EXCEPTION 'Published MOTD copy audit failed: % entries lack de/en/fr/es/it copy', incomplete_count;
  END IF;
END
$audit$;
