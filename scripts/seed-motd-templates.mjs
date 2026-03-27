#!/usr/bin/env node
/**
 * Legt drei Standard-MOTD-Textvorlagen an (idempotent per fester UUID).
 * Nutzung: DATABASE_URL gesetzt oder Default wie ensure-schema.
 *   npm run seed:motd-templates
 */
import pg from 'pg';

const DEFAULT_DATABASE_URL =
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';

/** Feste IDs — ON CONFLICT aktualisiert Name, Beschreibung und alle Markdown-Felder */
const ROWS = [
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    name: 'Wartungsankündigung',
    description: 'Sachliche Ankündigung geplanter Ausfallzeiten; Platzhalter für Datum und Uhrzeit anpassen.',
    de: `## Geplante Wartung

Wir führen am **TT.MM.JJJJ** zwischen **HH:MM** und **HH:MM Uhr** (Ortszeit) Wartungsarbeiten durch. In dieser Zeit kann **arsnova** kurzzeitig **nicht erreichbar** sein oder nur **eingeschränkt** nutzbar sein.

Wir entschuldigen uns für etwaige Unannehmlichkeiten und danken dir für dein Verständnis.`,
    en: `## Scheduled maintenance

We will perform **maintenance** on **DD/MM/YYYY** between **HH:MM** and **HH:MM** (local time). During this window, **arsnova** may be **temporarily unavailable** or only **partially available**.

We apologise for any inconvenience and appreciate your understanding.`,
    fr: `## Maintenance planifiée

Une **maintenance** est prévue le **JJ.MM.AAAA**, entre **HH:MM** et **HH:MM** (heure locale). Pendant cette période, **arsnova** peut être **temporairement indisponible** ou **partiellement limitée**.

Merci pour votre compréhension ; nous nous excusons pour la gêne occasionnée.`,
    es: `## Mantenimiento programado

Realizaremos un **mantenimiento** el **DD.MM.AAAA** entre las **HH:MM** y las **HH:MM** (hora local). Durante ese intervalo, **arsnova** puede no estar **disponible** o ofrecer un **servicio limitado**.

Gracias por tu paciencia; lamentamos las molestias.`,
    it: `## Manutenzione programmata

Eseguiremo una **manutenzione** il **GG.MM.AAAA** tra le **HH:MM** e le **HH:MM** (ora locale). In quell’intervallo **arsnova** potrebbe risultare **non disponibile** o **limitata**.

Ci scusiamo per gli eventuali disagi e ti ringraziamo per la comprensione.`,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    name: 'Neues Feature',
    description: 'Freundlicher Hinweis auf eine Verbesserung; Kurzbeschreibung und Nutzen konkretisieren.',
    de: `## Neu für dich

Wir haben **arsnova** verbessert. **Kurzbeschreibung des Features einfügen** — damit wird die Nutzung für dich **einfacher** oder **übersichtlicher**.

- **Was sich ändert:** …
- **Wo du es findest:** …

Wir freuen uns, wenn du es ausprobierst.`,
    en: `## Something new for you

We’ve improved **arsnova**. **Add a short description of the feature** — it should make things **clearer** or **easier** for you.

- **What’s changing:** …
- **Where to find it:** …

We hope you enjoy using it.`,
    fr: `## Une nouveauté pour vous

Nous avons amélioré **arsnova**. **Indiquez en quelques mots la nouveauté** — pour rendre l’usage **plus simple** ou **plus clair**.

- **Ce qui change :** …
- **Où la trouver :** …

N’hésitez pas à la découvrir.`,
    es: `## Novedad para ti

Hemos mejorado **arsnova**. **Añade una breve descripción de la novedad** para que el uso te resulte **más claro** o **más sencillo**.

- **Qué cambia:** …
- **Dónde encontrarlo:** …

Esperamos que te sea útil.`,
    it: `## Novità per te

Abbiamo migliorato **arsnova**. **Aggiungi una breve descrizione della novità** — per un utilizzo **più chiaro** o **più semplice**.

- **Cosa cambia:** …
- **Dove la trovi:** …

Ti auguriamo buon lavoro con la piattaforma.`,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    name: 'Spendenaufruf',
    description: 'Respektvoller Hinweis auf freiwillige Unterstützung; Link oder Zahlungsweg ergänzen.',
    de: `## arsnova unterstützen

**arsnova** soll für Lehrende und Lernende **kostenlos** nutzbar bleiben. Wenn dir die Plattform hilft, freuen wir uns über eine **freiwillige Unterstützung** — z. B. für **Betrieb** und **Weiterentwicklung**.

**[Link oder Hinweis zur Spendenmöglichkeit einfügen]**

Vielen Dank, dass du **arsnova** nutzt.`,
    en: `## Support arsnova

**arsnova** is intended to stay **free to use** for educators and learners. If the platform helps you, we welcome **voluntary support** — for example for **operations** and **ongoing development**.

**[Add your donation link or instructions here]**

Thank you for using **arsnova**.`,
    fr: `## Soutenir arsnova

**arsnova** reste **gratuit** pour les enseignant·es et les apprenant·es. Si la plateforme vous aide, vous pouvez **soutenir le projet** de façon **volontaire** — par exemple pour l’**exploitation** et l’**évolution**.

**[Ajoutez ici le lien ou les modalités de don]**

Merci d’utiliser **arsnova**.`,
    es: `## Apoya a arsnova

**arsnova** pretende seguir siendo **gratuita** para docentes y estudiantes. Si te resulta útil, agradecemos cualquier **apoyo voluntario** — por ejemplo para el **servicio** y la **mejora continua**.

**[Añade aquí el enlace o la forma de donar]**

Gracias por usar **arsnova**.`,
    it: `## Sostieni arsnova

**arsnova** resta **gratuita** per docenti e studenti. Se la piattaforma ti è utile, ogni **contributo volontario** è benvenuto — ad esempio per **esercizio** e **sviluppo**.

**[Inserisci qui link o istruzioni per la donazione]**

Grazie per utilizzare **arsnova**.`,
  },
];

async function upsertTemplate(client, row) {
  await client.query(
    `INSERT INTO "MotdTemplate" (
      "id","name","description","markdownDe","markdownEn","markdownFr","markdownEs","markdownIt","createdAt","updatedAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "markdownDe" = EXCLUDED."markdownDe",
      "markdownEn" = EXCLUDED."markdownEn",
      "markdownFr" = EXCLUDED."markdownFr",
      "markdownEs" = EXCLUDED."markdownEs",
      "markdownIt" = EXCLUDED."markdownIt",
      "updatedAt" = NOW()`,
    [row.id, row.name, row.description, row.de, row.en, row.fr, row.es, row.it],
  );
}

async function main() {
  const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    for (const row of ROWS) {
      await upsertTemplate(client, row);
    }
    console.log(`${ROWS.length} MOTD-Vorlagen gesichert (Upsert).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
