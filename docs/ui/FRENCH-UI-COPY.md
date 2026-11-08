# Französische UI-Texte

Diese Regeln gelten für die französischen UI-Übersetzungen in
`apps/frontend/src/locale/messages.fr.xlf`: Hauptseiten, Navigation, Formulare,
Dialoge, Statusmeldungen, Tooltips und zugängliche Namen.
Für PWA-Schnellaktionen und Screenshot-Beschriftungen gelten dieselben Begriffe;
ihre Texte stehen in `apps/frontend/scripts/patch-pwa-manifest-per-locale.mjs`.
Die französische Landing-Copy in `apps/landing/src/i18n/fr.ts` verwendet dieselben
Produktbegriffe, auch in FAQ, Beispielen, Metadaten und JSON-LD. Die französischen
Landing-Rechtstexte liegen unter `apps/landing/src/pages/fr/`; die Rechtstexte der
Live-App unter `apps/frontend/src/assets/legal/*.fr.md`. Beide beschreiben
unterschiedliche Hosting-Kontexte und dürfen nicht gegenseitig ersetzt werden.

## Ansprache und Aktionen

- Einzelpersonen mit **tu**, **ton/ta/tes** ansprechen, unabhängig von der Rolle.
- Aktionsbuttons und Menüeinträge bevorzugt im Infinitiv formulieren:
  **Créer**, **Modifier**, **Dupliquer**, **Supprimer**, **Enregistrer**.
- Anweisungen in Hilfs- und Fehlertexten dürfen den Imperativ Singular nutzen:
  **Choisis**, **Saisis**, **Vérifie**, **Réessaie**.
- Tatsächliche Gruppenansprache bleibt im Plural: **Échangez**, **votre équipe**,
  **vous êtes en tête**. Nicht pauschal jedes `vous` durch `tu` ersetzen.
- Rechtliche Texte und PDF-Berichtslabels haben eigene Konventionen. Für die
  Berichte gilt das [PDF-i18n-Glossar](../features/session-export-pdf-i18n-glossary.md),
  einschließlich der dort vorgesehenen formellen Ansprache.

## Do’s und Don’ts aus der Übersetzungsprüfung

Die deutsche Bedeutung ist verbindlich; die französische Satzstruktur muss
nicht der deutschen folgen. Zuerst die Funktion und ihren tatsächlichen Zustand
verstehen, dann eine kurze, natürliche Formulierung wählen.

| Situation                      | Do                                                                     | Don’t                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Einzelne Person ansprechen     | **Choisis ton quiz.**                                                  | **Choisissez votre quiz.** in derselben App-Ansicht mit `tu` mischen                       |
| Button beschriften             | **Enregistrer**, **Réessayer**, **Publier**                            | Lange Anweisungssätze auf kompakte Buttons setzen                                          |
| Ladezustand anzeigen           | **Chargement…**, **Enregistrement en cours…**                          | Wörtliche Verlaufsformen wie **Est en train de charger…**                                  |
| Fehler erklären                | **Impossible de charger la page. Réessaie.**                           | Nur **Erreur** anzeigen oder einen Erfolg behaupten, bevor die Aktion bestätigt ist        |
| Suchtreffer benennen           | **Une occurrence trouvée.**                                            | **J’ai trouvé un site.** für einen Treffer im Text                                         |
| Schwärzen benennen             | **Caviarder des passages**; **Passages caviardés**                     | **Noirceur** für die Funktion oder **passages caviardées** mit falscher Kongruenz          |
| Session beitreten              | **Rejoindre une session**                                              | **Adhésion** als Beitrittsaktion verwenden                                                 |
| Session-Code erklären          | **Code à six caractères**                                              | **Code à six chiffres**, wenn der Code auch Buchstaben enthält                             |
| Geräte verbinden               | **Connecter un téléphone**; **confier les commandes**                  | **Login**, **cliqueur de diapos**, **transmettre le contrôle ad hoc** in allgemeiner Hilfe |
| Synchronisation erklären       | **Lien de synchronisation**                                            | Unnötiges Mischvokabular wie **lien de sync**                                              |
| Pädagogisches Signal deuten    | **Possible conception erronée**                                        | Aus einer falschen Antwort mit hoher Sicherheit eine gesicherte Diagnose machen            |
| Nächsten Schritt vorschlagen   | **Prochaine étape** und eine konkrete Aktion                           | Wörtliche Wendungen wie **le prochain geste** als wechselndes Produktlabel                 |
| Lernzielstatus ausdrücken      | **Proposition de l’IA** als Herkunft, **Brouillon** als Status         | Einen KI-Vorschlag allein wegen seiner Herkunft als bestätigt darstellen                   |
| Fragen priorisieren            | **Forte adhésion** für Zustimmung                                      | Zustimmung als fachliche **Richtigkeit** oder **Qualität** der Frage ausgeben              |
| UI-Namen zitieren              | **« Temps ×10 »**, genau wie im Bedienelement                          | Gerade Anführungszeichen, **« Temps ×10 »** oder frei erfundene Buttonnamen                |
| Zahlen und Varianten behandeln | Singular, Plural und grammatisches Geschlecht im konkreten Satz prüfen | Ein einzelnes Wort ersetzen und den übrigen Satz ungeprüft lassen                          |

Diese Beispiele sind kontextabhängig. **Vous** bleibt für tatsächliche Gruppen
und entsprechend dem PDF-Glossar richtig; **adhésion** bleibt als Zustimmung
im Q&R-Kontext richtig. Bestehende Rechtsfassungen verwenden ihre festgelegte
Ansprache. Ein allgemeines Suchen-und-Ersetzen über alle Textquellen ist daher
kein geeignetes Verfahren.

### Stil und fachliche Genauigkeit

- Kurze Sätze mit jeweils einer klaren Aussage verwenden. Deutsche Satzketten
  und Marketingvergleiche nicht wortwörtlich nachbauen.
- Französische Akzente, typografische Apostrophe (**d’apprentissage**) und
  Großschreibung prüfen, insbesondere bei Seitentiteln und Satzanfängen.
- Die neutrale Rollenbeschreibung **la personne qui anime la session** nutzen,
  wenn weder Schule noch Hochschule vorausgesetzt werden soll. Rollen nicht
  unbeabsichtigt auf Lehrende beschränken.
- **Réponses correctes**, **degré de confiance**, **solde des votes** und
  **fiabilité du regroupement** auseinanderhalten. Wörter wie „sicher“ oder
  „gut“ nicht ohne ihren fachlichen Bezug übersetzen.
- Herkunft, Status und Aktion unterscheiden: Ein Entwurf ist kein Fehler,
  eine Veröffentlichung kein Löschen und ein eingefrorenes Bild kein gestoppter
  Eingang neuer Beiträge.
- In Rechtstexten Bedeutung, Zuständigkeiten, Rechtsgrundlagen, Fristen und
  Einschränkungen der Ausgangsfassung erhalten. Keine stärkeren Datenschutz-,
  Anonymitäts- oder Barrierefreiheitszusagen durch sprachliche Glättung erzeugen.
- Kürzere sichtbare Labels im Kontext formulieren, etwa **Générer** oder
  **Objectifs**. Den vollständigen zugänglichen Namen erhalten und das Ergebnis
  bei 320 Pixeln prüfen; Wörter nicht nur bis zur passenden Breite abschneiden.

## Begriffe

| Bedeutung                      | Französische UI                          |
| ------------------------------ | ---------------------------------------- |
| Session                        | session                                  |
| Q&A-Kanal, kompakt             | Q&R                                      |
| Q&A-Kanal, im Satz             | l’espace Q&R oder les questions-réponses |
| Blitzlicht                     | feedback express                         |
| Quiz-Sammlung                  | collection de quiz                       |
| Nickname                       | pseudonyme; kurz: pseudo                 |
| Lobby                          | salle d’attente                          |
| Zeitlimit                      | limite de temps                          |
| Selbsteinschätzung der Antwort | confiance dans la réponse                |
| Single Choice, kompakt         | Réponse unique                           |
| Multiple Choice, kompakt       | Réponses multiples                       |
| Peer Instruction               | Peer Instruction                         |
| Barrierefreies PDF             | Accessible (PDF/UA-1)                    |
| Wiederholen nach Fehler        | Réessayer                                |
| Q&R: deutliche Zustimmung      | Forte adhésion                           |
| Q&R: Stimmensaldo              | Solde des votes                          |
| Q&R: Frage freigeben           | Publier                                  |
| Q&R: freigegebene Frage        | Publiée                                  |
| Wortwolke: Wortgruppen         | Groupes de mots                          |
| Wortwolke: Themen              | Thèmes                                   |
| Passagen schwärzen             | Caviarder des passages                   |

Beim Session-Beitritt **Rejoindre** und **Connexion en cours…** verwenden.
**Adhésion** kann auch Mitgliedschaft bedeuten; im Q&R-Kontext bezeichnet
**Forte adhésion** dagegen die starke Zustimmung zu einer Frage.
Belegte Pseudonyme mit **(déjà pris)** kennzeichnen. Für den stabilen
Betriebszustand **stable**, für funktionierende Dienste **opérationnel** nutzen.
In Erklärtexten die vollständigen Bezeichnungen **question à réponse unique**
und **question à réponses multiples** verwenden. In der Typauswahl bleiben die
kurzen Formen auch auf schmalen Bildschirmen unterscheidbar.

## Q&R, Wortwolken und Blitzlicht

- **Forte adhésion** und **Solde des votes** bezeichnen verschiedene
  Gewichtungen. Hohe Zustimmung ist kein Nachweis fachlicher Richtigkeit.
  Der Titel der Sortierhilfe muss mit dem Namen der Auswahl übereinstimmen.
- **Groupes de mots** bezeichnet Wortgruppen; **Thèmes** bezeichnet die
  inhaltliche Zusammenfassung ähnlicher Beiträge. Die automatische Gruppierung
  darf nicht als Beurteilung der Teilnehmenden oder ihrer Antworten erscheinen.
- **Fiabilité du regroupement** beschreibt nur die Verlässlichkeit dieser
  Gruppierung. Das ist von **Confiance dans la réponse** zu unterscheiden.
- Beim Anhalten einer Wortwolke wird die Anzeige eingefroren. Die Sammlung neuer
  Beiträge läuft weiter; die französische Copy muss diesen Unterschied erhalten.
- Für Blitzlicht durchgehend **feedback express** verwenden, auch in der
  Präsentationsansicht und in Fehlerzuständen. **Tour de comparaison** bezeichnet
  die Vergleichsrunde und impliziert keine Peer-Instruction-Diskussion.
- Beim Schwärzen sind Suchtreffer **occurrences**, ausgewählte Textstellen
  **passages**. Lade-, Erfolgs-, Konflikt- und Fehlertexte müssen den tatsächlichen
  Zustand erklären: Nach einem Konflikt wird der neue Text bereits geladen;
  bei einem Speicherfehler bleibt die Auswahl erhalten.
- Datenanalysen in Kompass und Zusammenfassung heißen **analyse**. **Évaluation**
  bezeichnet eine tatsächliche Bewertung, etwa von Antworten oder einer Session.

## Lernziele, Demo und Nachbereitung

- **Objectif d’apprentissage** ist der durchgängige Begriff in Editor,
  Host-Ansicht, Teilnehmeransicht und Meldungen der serverseitigen Erstellung.
- **Proposition de l’IA** beschreibt die Herkunft eines Vorschlags; **Brouillon**,
  **Confirmé** und **À vérifier** beschreiben seinen Status. Herkunft und Status
  nicht gleichsetzen.
- Generierte Ziele bleiben bis zur Prüfung und Bestätigung Entwürfe. Meldungen
  über Abbruch, Teilfortschritt, Wiederholung und Konflikte müssen erklären,
  welche Entwürfe erhalten bleiben und wo die Erstellung fortgesetzt wird.
- Die Demo-Copy wird im französischen Block von
  `apps/frontend/scripts/apply-demo-quiz-locale-strings.mjs` gepflegt. Danach
  `npm run demo-quiz:locales -w @arsnova/frontend` ausführen. Frageformate,
  Lösungsschlüssel, IDs und numerische Toleranzen bei Sprachkorrekturen erhalten.
- PDF-Labels stehen sowohl im Angular-Katalog als auch in den kuratierten
  `FR_LABEL_OVERRIDES` der Berichtsbibliothek. Korrekturen in beiden pflegen;
  der Sync ergänzt fehlende Werte, überschreibt aber keine kuratierten Texte.
  `labels-locale.util.test.ts` prüft die französische Übereinstimmung anhand der
  tatsächlichen Bindings in `session-results-report-labels.ts`. Die kurzen
  Ein-/Mehrfachantwort-Labels der Vorschau sind eine bewusste Ausnahme.
- Bei Änderungen an Demo- oder Berichtstexten beide französischen Demo-PDFs neu
  erzeugen, rendern und prüfen. PDF/UA zusätzlich mit veraPDF validieren.

## Konsistenz und Prüfung

- Hinweise müssen den tatsächlichen Buttonnamen nennen, etwa **Enregistrer**.
- Sichtbare Labels und zugehörige ARIA-Texte müssen dieselbe Funktion benennen.
- Anführungszeichen: **« … »** mit U+202F nach dem öffnenden und vor dem
  schließenden Zeichen, entsprechend dem [Styleguide](STYLEGUIDE.md).
- XLF-IDs, Platzhalter und ICU-Schlüsselwörter bei Textkorrekturen beibehalten.
  Änderungen nur an französischen Zieltexten erfordern keine Neuübersetzung der
  übrigen Sprachen, solange Bedeutung und Quellvertrag unverändert bleiben.
- `npm run check:i18n -w @arsnova/frontend` und den lokalisierten Build ausführen.
  Längere Labels auf Mobile prüfen, insbesondere Formularfelder, Kanalnavigation
  und Menüs.

### Eine vollständige Prüfung umfasst alle Textquellen

| Quelle                                                | Was zusätzlich zum sichtbaren Haupttext zu prüfen ist                                                                               |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/src/locale/messages.fr.xlf`            | Host-, Teilnehmer- und Präsentationsansichten, Einstellungen, Auswertungen, Dialoge, ARIA-Texte, Lade-/Leer-/Fehlerzustände und SEO |
| Französische Copy in Frontend- und Backend-TypeScript | Sortierhilfen, Zusammenfassungen und Einschränkungen der KI-Lernzielerzeugung; nicht alle Texte kommen aus XLF                      |
| Demo-Generator und `quiz-demo-showcase.fr.json`       | Titel, Einführung, Aufgaben, Antworttexte und Bildbeschreibungen; Generator und erzeugtes Asset gemeinsam pflegen                   |
| Berichtslabels und beide französischen Demo-PDFs      | Kuratierte Overrides, Quellenabgleich, Platzhalter, Umbrüche und tatsächliche PDF-Ausgabe                                           |
| `apps/frontend/src/assets/legal/*.fr.md`              | Impressum, Datenschutz und Barrierefreiheit sowie Übereinstimmung mit sichtbaren UI-Bezeichnern                                     |
| `apps/landing/src/i18n/fr.ts`                         | Hero, Abschnitte, FAQ, Beispielansichten, Navigation, zugängliche Namen, Meta-Beschreibungen und JSON-LD                            |
| `apps/landing/src/pages/fr/`                          | Eigene Hosting-Aussagen der Landing, französische Footer-Ziele, Canonicals und Sitemap                                              |
| PWA-Manifest-Patch                                    | Schnellaktionen und Screenshot-Beschriftungen                                                                                       |

Bei reinen Sprachkorrekturen technische Schlüssel, URLs, Platzhalter,
Lösungsschlüssel, Beispieldaten und Fristen beibehalten. Notwendige fachliche
Korrekturen gesondert anhand der Implementierung belegen. Passende Tests und
Builds ausführen; bei Landing-Änderungen auch deren Sprach- und Browserprüfungen,
bei PDF-Änderungen Rendering und PDF/UA-Prüfung. Ein fehlerfreier Katalogcheck
belegt Vollständigkeit und Platzhalterkonsistenz, aber keine idiomatische
Übersetzung oder vollständige Barrierefreiheit.
