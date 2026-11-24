#!/usr/bin/env node
// Baut reference-dataset.v2.json: übernimmt die v1-Items im Umfang de/en/fr/es/mixed
// und ergänzt handgeschriebene Fragen auf genau 500 Items.
// Aufruf: node build-dataset-v2.mjs <reference-dataset.v1.json> <reference-dataset.v2.json>
import { readFileSync, writeFileSync } from 'node:fs';

const [v1Path, v2Path] = process.argv.slice(2);
const v1 = JSON.parse(readFileSync(v1Path, 'utf8'));
const SCOPE = ['de', 'en', 'fr', 'es', 'mixed'];
const TARGET_TOTAL = 500;
const MIN_PER_LANG = { de: 5, en: 3, fr: 2, es: 2 };

// ---------- Neue Familien (zu den 17 aus v1) ----------
const NEW_FAMILIES = [
  { id: 'C-CI', category: 'content', label: 'Konfidenzintervall interpretieren' },
  { id: 'C-CORR', category: 'content', label: 'Korrelation vs. Kausalität' },
  { id: 'C-NORM', category: 'content', label: 'z-Wert / Standardisierung der Normalverteilung' },
  { id: 'C-SAMPLE', category: 'content', label: 'Nötige Stichprobengröße bestimmen' },
  { id: 'O-GRADE', category: 'organization', label: 'Zusammensetzung der Note / Bonuspunkte' },
  { id: 'O-REG', category: 'organization', label: 'Anmeldung zur Klausur' },
  { id: 'O-TUT', category: 'organization', label: 'Tutoriumsgruppe wechseln' },
  { id: 'O-OFFICE', category: 'organization', label: 'Sprechstunde: Zeit, Ort, Termin' },
  { id: 'T-LOGIN', category: 'technical', label: 'Login ins Lernportal scheitert' },
  { id: 'T-STREAM', category: 'technical', label: 'Livestream friert ein / schwarzes Bild' },
  { id: 'T-QR', category: 'technical', label: 'QR-Code lässt sich nicht scannen' },
  { id: 'T-POWER', category: 'technical', label: 'Steckdosen am Platz ohne Strom' },
  { id: 'T-LIGHT', category: 'technical', label: 'Beleuchtung im Hörsaal ausgefallen / flackert' },
  // Near-Miss-Familien: lexikalisch nah an anderen Familien, untereinander dieselbe Antwort
  { id: 'N-ZEXAM', category: 'content', label: 'Klausurrelevanz des z-Werts' },
  { id: 'N-BONUSRETAKE', category: 'organization', label: 'Bonuspunkte auch in der Nachklausur?' },
  {
    id: 'N-OFFICECONTENT',
    category: 'organization',
    label: 'Sprechstunde für Stofffragen nutzen?',
  },
  { id: 'N-SLIDESUP', category: 'organization', label: 'Wann/ob die Folien hochgeladen sind' },
  { id: 'N-TUTMOODLE', category: 'organization', label: 'Tutorium zusätzlich im Moodle anmelden?' },
  { id: 'N-CORREXAM', category: 'content', label: 'Klausurrelevanz von Korrelation/Kausalität' },
  { id: 'N-WIFIPASS', category: 'organization', label: 'Wo steht das Gast-WLAN-Passwort?' },
];
// v1-Singleton S-SLIDE-TYPO wird zur Familie (Übersetzungen kommen hinzu)
const PROMOTED = [
  { id: 'S-SLIDE-TYPO', category: 'content', label: 'Vermuteter Formelfehler auf Folie 12' },
];

// ---------- Neue Familien-Items: [locale, tags, text, note?] ----------
const ADD = {
  'C-REG': [
    ['de', '', 'Wäre ein zweites Rechenbeispiel zur Regressionsgeraden möglich?'],
    ['en', '', 'More practice problems on linear regression would really help.'],
    ['en', '', 'Can we do one more regression example step by step?'],
    ['fr', '', 'On pourrait refaire un exercice de régression ensemble ?'],
    ['es', 'canonical', '¿Podemos resolver otro ejercicio de regresión lineal?'],
    ['es', '', 'Más ejemplos de regresión, por favor, no me quedó claro.'],
    ['mixed', 'code-switch', 'Können wir noch ein regression example machen?'],
  ],
  'C-HYP': [
    ['de', '', 'Kommen Hypothesentests in der Klausur dran?'],
    ['de', '', 'Wird Kapitel 5 mit den Tests abgefragt?'],
    ['en', '', 'Will we be tested on the t-test?'],
    ['en', 'canonical', 'Is chapter 5 on hypothesis tests examinable?'],
    ['fr', 'canonical', "Les tests d'hypothèses tombent-ils à l'examen ?"],
    ['fr', '', "Faut-il réviser le chapitre 5 pour l'examen ?"],
    ['es', '', '¿Hay que estudiar el capítulo 5 para el examen?'],
    ['mixed', 'code-switch', 'Ist hypothesis testing klausurrelevant?'],
  ],
  'C-PVAL': [
    ['de', '', 'Heißt ein p-Wert von 0,03, dass die Hypothese zu 3 % stimmt?'],
    ['de', '', 'Ich verstehe nicht, wie man den p-Wert interpretiert.'],
    ['de', 'short', 'p-Wert noch einmal erklären?'],
    ['en', '', 'Is the p-value the probability that the null hypothesis is true?'],
    ['en', 'typo slang', 'can u explain p values again'],
    ['fr', '', "La valeur p, c'est la probabilité que H0 soit vraie ?"],
    ['es', '', 'No entiendo cómo interpretar el valor p.'],
  ],
  'C-OVF': [
    ['de', '', 'Woran sehe ich, dass mein Modell überangepasst ist?'],
    ['de', '', 'Entsteht Overfitting, wenn das Modell zu viele Parameter hat?'],
    ['de', 'slang short', 'Overfitting?? check ich nicht'],
    ['en', 'canonical', "What's the difference between overfitting and underfitting?"],
    ['en', '', 'How do we detect overfitting in practice?'],
    ['fr', 'canonical', 'Comment savoir si un modèle fait du surapprentissage ?'],
    ['fr', '', 'Quelle différence entre surapprentissage et sous-apprentissage ?'],
    ['es', '', '¿Qué diferencia hay entre sobreajuste y subajuste?'],
    ['mixed', 'code-switch', 'Wie erkenne ich overfitting bei meinem model?'],
  ],
  'C-DERIV': [
    ['de', '', 'Könnten Sie die Umformung auf Folie 17 langsamer zeigen?'],
    ['de', '', 'Wie kommt man auf Folie 17 von der zweiten zur dritten Zeile?'],
    ['de', 'typo', 'folie 17 zeile 3 versteh ich nicht'],
    ['en', '', 'Where does the square on slide 17 come from?'],
    ['en', '', 'Could you redo the derivation on slide 17 more slowly?'],
    ['fr', '', 'Je ne comprends pas le passage de la ligne 2 à la ligne 3, diapo 17.'],
    ['es', '', 'En la diapositiva 17, ¿de dónde sale el cuadrado?'],
    ['es', '', '¿Puede repetir la derivación de la diapositiva 17?'],
  ],
  'C-BAYES': [
    [
      'de',
      '',
      'Ich hab den Satz von Bayes noch nicht verstanden, gibt es ein Beispiel aus dem Alltag?',
    ],
    ['de', '', 'Können Sie Bayes mal mit einem medizinischen Test erklären?'],
    ['de', 'short', 'Bayes nochmal an einem Beispiel?'],
    ['en', '', "Could you show Bayes' rule with a medical test example?"],
    ['en', 'slang', "I still don't get Bayes, any simple example?"],
    ['fr', 'canonical', 'Pouvez-vous donner un exemple concret du théorème de Bayes ?'],
    ['fr', '', 'Un exemple de Bayes avec un test médical ?'],
    ['es', '', '¿Puede explicar Bayes con un ejemplo cotidiano?'],
  ],
  'C-CI': [
    ['de', 'canonical', 'Was bedeutet ein 95-%-Konfidenzintervall eigentlich genau?'],
    ['de', '', 'Liegt der wahre Wert mit 95 % Wahrscheinlichkeit im Intervall?'],
    ['de', '', 'Wie interpretiere ich das Konfidenzintervall aus der Übung?'],
    ['de', '', 'Kann man sagen, der Mittelwert liegt sicher im Konfidenzintervall?'],
    ['de', 'short', 'Konfidenzintervall – wie deuten?'],
    ['en', 'canonical', 'What does a 95% confidence interval actually mean?'],
    ['en', '', 'Does the true mean lie in the interval with 95% probability?'],
    ['en', 'typo', 'how do i interpret a confidence interval'],
    ['fr', 'canonical', 'Comment interpréter un intervalle de confiance à 95 % ?'],
    ['fr', '', "Le vrai paramètre est-il dans l'intervalle avec 95 % de probabilité ?"],
    ['es', 'canonical', '¿Qué significa realmente un intervalo de confianza del 95 %?'],
    ['es', '', '¿Cómo se interpreta el intervalo de confianza?'],
    ['mixed', 'code-switch', 'Was heißt das confidence interval genau?'],
  ],
  'C-CORR': [
    ['de', '', 'Heißt eine hohe Korrelation automatisch, dass das eine das andere verursacht?'],
    ['de', 'canonical', 'Worin unterscheiden sich Korrelation und Kausalität?'],
    ['de', '', 'Kann man aus r = 0,9 auf Ursache und Wirkung schließen?'],
    ['de', 'short', 'Korrelation gleich Kausalität oder nicht?'],
    ['de', '', 'Warum darf man beim Eisverkauf-Beispiel nicht auf eine Ursache schließen?'],
    ['en', 'short', 'Does correlation imply causation here?'],
    ['en', 'canonical', "What's the difference between correlation and causation?"],
    ['en', '', 'If r is 0.9, can we say X causes Y?'],
    ['fr', '', 'Une forte corrélation implique-t-elle une causalité ?'],
    ['fr', 'canonical', 'En quoi corrélation et causalité sont-elles différentes ?'],
    ['es', 'short', '¿Correlación implica causalidad?'],
    ['es', 'canonical', '¿Cuál es la diferencia entre correlación y causalidad?'],
  ],
  'C-NORM': [
    ['de', 'canonical', 'Wie berechne ich den z-Wert?'],
    ['de', '', 'Wozu standardisiert man eine Normalverteilung?'],
    ['de', '', 'Was genau sagt ein z-Wert von 2 aus?'],
    ['de', '', 'Wie lese ich die Tabelle der Standardnormalverteilung ab?'],
    ['de', 'short', 'z-Transformation nochmal erklären?'],
    ['en', 'canonical', 'How do I compute a z-score?'],
    ['en', '', 'Why do we standardize the normal distribution?'],
    ['en', '', 'What does a z-score of 2 mean?'],
    ['fr', 'canonical', 'Comment calcule-t-on le score z ?'],
    ['fr', '', 'Pourquoi centrer et réduire une loi normale ?'],
    ['es', 'canonical', '¿Cómo se calcula la puntuación z?'],
    ['es', '', '¿Para qué sirve estandarizar una normal?'],
    ['mixed', 'code-switch', 'Wie rechnet man den z-score aus?'],
  ],
  'C-SAMPLE': [
    ['de', 'canonical', 'Wie groß muss meine Stichprobe mindestens sein?'],
    ['de', '', 'Woher weiß ich, wie viele Personen ich befragen muss?'],
    ['de', '', 'Wie berechnet man den nötigen Stichprobenumfang?'],
    ['de', '', 'Gibt es eine Faustregel für die Stichprobengröße?'],
    ['de', 'short', 'Stichprobengröße berechnen – wie?'],
    ['en', 'canonical', 'How large does my sample need to be?'],
    ['en', '', 'How do we calculate the required sample size?'],
    ['en', '', 'Is there a rule of thumb for sample size?'],
    ['fr', 'canonical', "Comment déterminer la taille de l'échantillon ?"],
    ['fr', '', 'Combien de personnes faut-il interroger au minimum ?'],
    ['es', 'canonical', '¿Cómo se calcula el tamaño de la muestra?'],
    ['es', '', '¿Cuántas personas hay que encuestar como mínimo?'],
  ],
  'O-DEAD': [
    ['de', '', 'Ist die Frist für Übungsblatt 2 diesen Freitag?'],
    ['en', 'short', 'When is sheet 2 due?'],
    ['en', '', 'Is the deadline for the second exercise sheet Friday or Sunday?'],
    ['fr', '', 'On doit rendre la feuille 2 quand ?'],
    ['es', 'canonical', '¿Cuándo hay que entregar la hoja 2?'],
    ['es', '', '¿La entrega de la segunda hoja es el viernes?'],
    ['mixed', 'code-switch', 'Deadline für Blatt 2 ist Freitag, right?'],
  ],
  'O-ATT': [
    ['de', '', 'Gibt es eine Anwesenheitsliste in der Vorlesung?'],
    ['de', '', 'Wird geprüft, ob wir in der Vorlesung sind?'],
    ['en', 'canonical', 'Is attendance taken in the lectures?'],
    ['en', '', 'Do we have to sign an attendance sheet?'],
    ['fr', 'canonical', 'La présence en cours est-elle obligatoire ?'],
    ['fr', '', "Est-ce qu'on fait l'appel en cours ?"],
    ['es', 'short', '¿Pasan lista en clase?'],
    ['mixed', 'code-switch', 'Ist attendance hier Pflicht?'],
  ],
  'O-ROOM': [
    ['de', '', 'In welchem Gebäude ist die Wiederholungsprüfung?'],
    ['de', '', 'Schreiben wir die Nachklausur wieder im großen Hörsaal?'],
    ['de', '', 'Wo ist der Nachtermin für die Klausur?'],
    ['en', '', 'Where will the retake take place?'],
    ['en', '', 'Is the resit in the same lecture hall as the first exam?'],
    ['fr', 'canonical', "Où se passe l'examen de rattrapage ?"],
    ['es', 'canonical', '¿Dónde se hará la recuperación?'],
    ['es', '', '¿En qué edificio es la recuperación?'],
  ],
  'O-AIDS': [
    ['de', '', 'Ist ein selbst geschriebener Spickzettel in der Klausur erlaubt?'],
    ['de', 'canonical', 'Welche Hilfsmittel sind in der Klausur zugelassen?'],
    ['de', '', 'Darf man den Taschenrechner mit Grafikfunktion mitnehmen?'],
    ['en', 'canonical', 'Which aids are allowed in the exam?'],
    ['en', '', 'Is a graphing calculator allowed in the exam?'],
    ['fr', '', "A-t-on droit à la calculatrice à l'examen ?"],
    ['fr', 'canonical', "Quels documents sont autorisés à l'examen ?"],
    ['es', '', '¿Se permite llevar un formulario al examen?'],
  ],
  'O-CANC': [
    ['de', '', 'Haben wir nächsten Donnerstag frei?'],
    ['de', '', 'Entfällt die Vorlesung am Feiertag?'],
    ['de', 'short', 'Do. Vorlesung oder nicht?'],
    ['en', '', 'Are we off next Thursday because of the holiday?'],
    ['en', 'short', "Is Thursday's lecture still on?"],
    ['fr', '', 'Il y a cours jeudi malgré le jour férié ?'],
    ['es', '', '¿Se cancela la clase del jueves por el festivo?'],
  ],
  'O-REC': [
    ['de', '', 'Gibt es von heute eine Aufzeichnung?'],
    ['de', '', 'Wird die Aufnahme später im Moodle bereitgestellt?'],
    ['de', '', 'Werden die Vorlesungen eigentlich mitgeschnitten?'],
    ['en', 'canonical', 'Are the lectures being recorded?'],
    ['en', '', "Will today's recording be posted on Moodle?"],
    ['fr', '', "L'enregistrement sera-t-il mis en ligne ?"],
    ['es', 'canonical', '¿Se graba la clase de hoy?'],
    ['es', '', '¿Subirán la grabación a Moodle?'],
    ['mixed', 'code-switch', 'Kommt das recording später online?'],
  ],
  'O-GRADE': [
    ['de', '', 'Zählen die Übungsblätter zur Endnote?'],
    ['de', 'canonical', 'Wie setzt sich die Note zusammen?'],
    ['de', '', 'Gibt es Bonuspunkte für die Übungen?'],
    ['de', '', 'Wie viel Prozent macht die Klausur an der Gesamtnote aus?'],
    ['de', 'short', 'Bonuspunkte – wie viele maximal?'],
    ['en', 'canonical', 'How is the final grade calculated?'],
    ['en', '', 'Do the exercise sheets count towards the grade?'],
    ['en', '', 'Are there bonus points for homework?'],
    ['fr', 'canonical', 'Comment est calculée la note finale ?'],
    ['fr', '', 'Les exercices comptent-ils dans la note ?'],
    ['es', 'canonical', '¿Cómo se calcula la nota final?'],
    ['es', '', '¿Cuentan las hojas de ejercicios para la nota?'],
    ['mixed', 'code-switch', 'Zählen die homework points zur Note?'],
  ],
  'O-REG': [
    ['de', 'canonical', 'Bis wann muss man sich zur Klausur anmelden?'],
    ['de', '', 'Über welches Portal läuft die Prüfungsanmeldung?'],
    ['de', '', 'Ist die Prüfungsanmeldung schon offen?'],
    ['de', '', 'Kann ich mich nach Fristende noch zur Klausur anmelden?'],
    ['de', 'short', 'Anmeldefrist Klausur?'],
    ['en', 'canonical', "What's the deadline to sign up for the exam?"],
    ['en', '', 'Where do I enrol for the exam?'],
    ['en', '', 'Is exam registration already open?'],
    ['fr', 'canonical', "Jusqu'à quand peut-on s'inscrire à l'examen ?"],
    ['fr', '', "Où s'inscrit-on pour l'examen ?"],
    ['es', 'canonical', '¿Hasta cuándo hay que inscribirse al examen?'],
    ['es', '', '¿Dónde me inscribo para el examen?'],
    ['mixed', 'code-switch', 'Wo ist die registration für die Klausur?'],
  ],
  'O-TUT': [
    ['de', 'canonical', 'Kann ich in eine andere Tutoriumsgruppe wechseln?'],
    ['de', '', 'Ist ein Wechsel des Tutoriums noch möglich?'],
    ['de', '', 'Ich hab eine Überschneidung, darf ich die Übungsgruppe tauschen?'],
    ['de', '', 'Wie tausche ich meinen Tutoriumstermin?'],
    ['de', 'typo short', 'tutorium wechseln geht das'],
    ['en', 'canonical', 'Can I switch to a different tutorial group?'],
    ['en', '', 'Is it still possible to change my tutorial slot?'],
    ['en', '', 'I have a clash, can I swap tutorial groups?'],
    ['fr', 'canonical', "Est-ce qu'on peut changer de groupe de TD ?"],
    ['fr', '', "J'ai un conflit d'horaire, je peux changer de TD ?"],
    ['es', 'canonical', '¿Puedo cambiarme a otro grupo de prácticas?'],
    ['es', '', 'Tengo un solapamiento, ¿puedo cambiar de grupo de prácticas?'],
  ],
  'O-OFFICE': [
    ['de', 'canonical', 'Wann ist Ihre Sprechstunde?'],
    ['de', '', 'Kann ich einen Termin in der Sprechstunde bekommen?'],
    ['de', '', 'Ist die Sprechstunde in Präsenz oder per Video?'],
    ['de', '', 'Wo ist Ihr Büro für die Sprechstunde?'],
    ['de', 'short', 'Sprechstunde wann?'],
    ['en', 'canonical', 'When are your office hours?'],
    ['en', '', 'Can I book a slot in your office hours?'],
    ['en', '', 'Are office hours in person or online?'],
    ['fr', 'canonical', 'Quand sont vos heures de permanence ?'],
    ['fr', '', 'Peut-on prendre rendez-vous pour une permanence ?'],
    ['es', 'canonical', '¿Cuándo tiene horario de atención?'],
    ['es', '', '¿Puedo pedir cita para su horario de atención?'],
  ],
  'T-WIFI': [
    ['de', '', 'Kein Internet hier im Hörsaal, geht das nur mir so?'],
    ['de', '', 'Das WLAN verbindet sich hier gar nicht.'],
    ['en', '', "There's no Wi-Fi signal in this room."],
    ['en', '', "eduroam won't connect at all here."],
    ['fr', 'canonical', "Pas de réseau wifi dans l'amphi."],
    ['fr', '', 'Impossible de se connecter à eduroam ici.'],
    ['es', '', 'No hay conexión wifi en el aula.'],
    ['mixed', 'code-switch short', 'WLAN is down again'],
  ],
  'T-AUDIO': [
    ['de', '', 'Das Mikrofon rauscht und man versteht nichts.'],
    ['de', '', 'Hinten kommt kein Ton an.'],
    ['en', '', "The microphone is crackling, we can't understand anything."],
    ['en', '', 'Could you turn the mic up a bit?'],
    ['fr', '', 'Pouvez-vous monter le son du micro ?'],
    ['es', 'canonical', 'No se oye nada al fondo, ¿puede subir el micro?'],
    ['es', '', 'El micrófono hace ruido y no se entiende.'],
  ],
  'T-BEAM': [
    ['de', '', 'Der Beamer zeigt alles abgeschnitten an.'],
    ['de', '', 'Das Bild vom Projektor flackert die ganze Zeit.'],
    ['de', '', 'Die Farben am Beamer sind so blass, man erkennt nichts.'],
    ['en', '', 'The projector image keeps flickering.'],
    ['en', '', 'The projection is too faint to read.'],
    ['fr', 'canonical', 'Le vidéoprojecteur coupe le bas des diapos.'],
    ['fr', '', "L'image du projecteur clignote."],
    ['es', '', 'La imagen del proyector parpadea todo el rato.'],
  ],
  'T-VOTE': [
    ['de', '', 'Bei mir erscheint die Umfrage nicht, nur ein leerer Bildschirm.'],
    ['de', '', 'Ich kann nicht abstimmen, der Button reagiert nicht.'],
    ['en', '', "I can't vote, the button doesn't respond."],
    ['en', '', 'The voting page just stays blank for me.'],
    ['fr', '', "Je n'arrive pas à voter, le bouton ne répond pas."],
    ['es', '', 'No puedo votar, el botón no responde.'],
    ['es', '', 'La encuesta no carga en mi móvil.'],
    ['mixed', 'code-switch short', 'Das voting lädt nicht'],
  ],
  'T-PDF': [
    ['de', '', 'Die Foliendatei im Moodle lässt sich nicht herunterladen.'],
    ['de', 'short', 'Das PDF mit den Folien ist kaputt.'],
    ['de', '', 'Beim Öffnen der Folien sagt der Reader, die Datei sei beschädigt.'],
    ['en', '', "The slides PDF won't open, it says the file is damaged."],
    ['en', '', 'Downloading the lecture slides gives an error.'],
    ['fr', 'canonical', 'Le PDF du cours est corrompu.'],
    ['fr', '', 'Impossible de télécharger les diapos sur Moodle.'],
    ['es', '', 'No puedo descargar las diapositivas de Moodle.'],
  ],
  'T-LOGIN': [
    ['de', 'canonical', 'Ich komme mit meiner Uni-Kennung nicht ins Moodle.'],
    ['de', '', 'Die Anmeldung über Shibboleth hängt in einer Schleife.'],
    ['de', '', 'Mein Passwort wird im Lernportal nicht akzeptiert.'],
    ['de', '', 'Seit heute Morgen kann ich mich nicht mehr einloggen.'],
    ['de', 'typo short', 'einloggen klappt nicht, fehlermeldung'],
    ['en', 'canonical', "My university account won't let me log into Moodle."],
    ['en', '', 'The single sign-on keeps looping back to the login page.'],
    ['en', '', "My password isn't accepted on the learning platform."],
    ['fr', 'canonical', "Je n'arrive pas à me connecter à Moodle avec mon compte."],
    ['fr', '', 'La connexion unique tourne en boucle.'],
    ['es', 'canonical', 'No puedo entrar en Moodle con mi usuario.'],
    ['es', '', 'El inicio de sesión se queda en bucle.'],
    ['mixed', 'code-switch', 'Login ins Moodle failed immer'],
  ],
  'T-STREAM': [
    ['de', 'canonical', 'Der Livestream bleibt ständig hängen.'],
    ['de', '', 'Im Stream sieht man nur ein schwarzes Bild.'],
    ['de', '', 'Die Übertragung für die Leute zu Hause ist abgebrochen.'],
    ['de', '', 'Der Stream hängt zwei Minuten hinterher.'],
    ['de', 'short', 'stream schwarz'],
    ['en', 'canonical', 'The livestream keeps freezing.'],
    ['en', '', 'The stream only shows a black screen.'],
    ['en', '', 'The broadcast for people at home has dropped.'],
    ['fr', 'canonical', 'Le direct se fige tout le temps.'],
    ['fr', '', "On ne voit qu'un écran noir sur le stream."],
    ['es', 'canonical', 'La transmisión en directo se congela.'],
    ['es', '', 'En el streaming solo se ve negro.'],
    ['mixed', 'code-switch', 'Der livestream freezed dauernd'],
  ],
  'T-QR': [
    ['de', 'canonical', 'Mein Handy erkennt den QR-Code auf der Leinwand nicht.'],
    ['de', '', 'Der QR-Code ist von hinten zu klein zum Scannen.'],
    ['de', '', 'Können Sie den QR-Code größer zeigen? Die Kamera erfasst ihn nicht.'],
    ['de', '', 'Beim Scannen des Codes passiert gar nichts.'],
    ['de', 'short', 'QR scannt nicht'],
    ['en', 'canonical', "My phone won't pick up the QR code on the screen."],
    ['en', '', 'From the back rows the QR code is too small for my camera.'],
    ['en', '', 'Scanning the code does nothing.'],
    ['fr', 'canonical', 'Mon téléphone ne lit pas le QR code.'],
    ['fr', '', 'Le QR code est trop petit pour être scanné du fond.'],
    ['es', 'canonical', 'Mi móvil no reconoce el código QR.'],
    ['es', '', 'El código QR es demasiado pequeño desde atrás.'],
  ],
  'T-POWER': [
    ['de', 'canonical', 'Die Steckdosen in Reihe 12 haben keinen Strom.'],
    ['de', '', 'Gibt es hier irgendwo funktionierende Steckdosen? Mein Akku ist leer.'],
    ['de', '', 'Die Steckdosenleiste unter den Tischen ist tot.'],
    ['de', '', 'Mein Laptop lädt an den Tischsteckdosen nicht.'],
    ['de', 'short', 'Strom an den Plätzen geht nicht'],
    ['en', 'canonical', "The power sockets in row 12 aren't working."],
    ['en', '', "My laptop won't charge from the desk outlets."],
    ['en', '', 'None of the outlets under the desks have power.'],
    ['fr', 'canonical', 'Les prises de la rangée 12 ne marchent pas.'],
    ['fr', '', 'Mon ordinateur ne charge pas sur les prises des tables.'],
    ['es', 'canonical', 'Los enchufes de la fila 12 no funcionan.'],
    ['es', '', 'Mi portátil no carga en los enchufes de las mesas.'],
  ],
  'T-LIGHT': [
    ['de', 'canonical', 'Das Licht im hinteren Teil des Hörsaals ist ausgefallen.'],
    ['de', '', 'Die Deckenbeleuchtung flackert ständig.'],
    ['de', '', 'Hinten ist es so dunkel, dass man nicht mitschreiben kann.'],
    ['de', '', 'Bei uns in Reihe 15 ist das Licht aus und lässt sich nicht einschalten.'],
    ['de', 'short', 'Licht hinten kaputt'],
    ['en', 'canonical', 'The lights at the back of the hall are out.'],
    ['en', '', 'The ceiling lights keep flickering.'],
    ['en', '', "It's too dark at the back to take notes, the lights are off."],
    ['fr', 'canonical', "La lumière au fond de l'amphi ne marche plus."],
    ['fr', '', 'Les néons clignotent sans arrêt.'],
    ['es', 'canonical', 'Las luces del fondo del aula no funcionan.'],
    ['es', '', 'Las luces del techo parpadean todo el rato.'],
  ],
  // Near-Miss-Familien (alle Items zusätzlich mit Tag near-miss)
  'N-ZEXAM': [
    [
      'de',
      '',
      'Kommt die z-Transformation auch in der Klausur dran?',
      'Nah an C-NORM und C-HYP; Anliegen: Klausurrelevanz z-Wert.',
    ],
    ['fr', '', "Le score z sera-t-il à l'examen ?"],
    ['es', '', '¿Entra la puntuación z en el examen?'],
  ],
  'N-BONUSRETAKE': [
    [
      'de',
      '',
      'Werden die Bonuspunkte auch für die Nachklausur angerechnet?',
      'Nah an O-GRADE und O-ROOM.',
    ],
    ['fr', '', 'Les points bonus comptent-ils aussi pour le rattrapage ?'],
    ['es', '', '¿Los puntos extra cuentan también en la recuperación?'],
  ],
  'N-OFFICECONTENT': [
    [
      'de',
      '',
      'Kann man die Sprechstunde auch für Fragen zu Bayes nutzen?',
      'Nah an O-OFFICE und C-BAYES; Regelfrage → organization.',
    ],
    ['en', '', 'Can we use the office hours to go over the p-value example?'],
    ['fr', '', 'Peut-on venir en permanence pour parler de Bayes ?'],
    ['es', '', '¿Puedo ir a su horario de atención para preguntar sobre Bayes?'],
  ],
  'N-SLIDESUP': [
    [
      'de',
      '',
      'Werden die Folien vor der Vorlesung oder erst danach hochgeladen?',
      'Nah an T-PDF; Bereitstellung → organization.',
    ],
    ['en', '', 'Are the slides with the regression examples uploaded yet?'],
    ['fr', '', 'Les diapos de la régression sont-elles déjà en ligne ?'],
    ['es', '', '¿Ya están subidas las diapositivas de regresión?'],
  ],
  'N-TUTMOODLE': [
    [
      'de',
      '',
      'Muss ich mich für das Tutorium auch extra im Moodle anmelden?',
      'Nah an O-TUT und T-LOGIN.',
    ],
    ['fr', '', "Faut-il s'inscrire sur Moodle pour le TD ?"],
    ['es', '', '¿Hay que apuntarse en Moodle para el grupo de prácticas?'],
  ],
  'N-CORREXAM': [
    ['en', '', 'Will correlation vs causation be part of the exam?', 'Nah an C-CORR und C-HYP.'],
    ['fr', '', "Corrélation et causalité, ça tombe à l'examen ?"],
    ['es', '', '¿La correlación entra en el examen?'],
  ],
  'N-WIFIPASS': [
    [
      'de',
      '',
      'Ist das WLAN-Passwort für Gäste irgendwo hinterlegt?',
      'Nah an T-WIFI; Informationsfrage, keine Störung.',
    ],
    ['fr', '', 'Le mot de passe du wifi invité est affiché où ?'],
  ],
  'S-SLIDE-TYPO': [
    ['en', '', 'The formula on slide 12 has a mistake, right?'],
    ['fr', '', 'La formule de la diapo 12 est fausse, non ?'],
    ['es', '', 'La fórmula de la diapositiva 12 tiene un error, ¿no?'],
  ],
};

// ---------- Neue Near-Miss-Singletons: [locale, category, text, note] ----------
const NEAR_MISS_SINGLETONS = [
  [
    'de',
    'organization',
    'Gibt es zur Regression auch eine Aufzeichnung aus dem letzten Semester?',
    'Nah an O-REC und C-REG.',
  ],
  [
    'de',
    'content',
    'Die Formel für den z-Wert auf Folie 9 ist anders als im Skript, welche stimmt?',
    'Nah an C-NORM und T-PDF.',
  ],
  [
    'de',
    'organization',
    'Zählt die Anwesenheit im Tutorium für die Note?',
    'Nah an O-ATT und O-GRADE.',
  ],
  [
    'de',
    'organization',
    'Kann man im Stream auch Fragen stellen?',
    'Nah an T-STREAM; Informationsfrage.',
  ],
  [
    'de',
    'organization',
    'Kommt Overfitting nur in der Übung oder auch in der Vorlesung dran?',
    'Nah an C-OVF; Frage nach Veranstaltungsablauf.',
  ],
  [
    'de',
    'organization',
    'Gibt es einen QR-Code für die Anmeldung zur Klausur?',
    'Nah an T-QR und O-REG.',
  ],
  [
    'de',
    'content',
    'Ist das Konfidenzintervall auf dem Übungsblatt mit 95 oder 99 % gemeint?',
    'Nah an C-CI und O-DEAD.',
  ],
  [
    'de',
    'organization',
    'Ist der Raum für die Nachklausur barrierefrei?',
    'Nah an O-ROOM; anderes Anliegen.',
  ],
  ['en', 'organization', 'Will the z-table be provided in the exam?', 'Nah an O-AIDS und C-NORM.'],
  [
    'en',
    'organization',
    'Does the attendance app need a separate login?',
    'Nah an T-LOGIN und O-ATT.',
  ],
  ['en', 'organization', 'Do bonus points expire after this semester?', 'Nah an O-GRADE.'],
  [
    'en',
    'organization',
    'Is there a tutorial session on hypothesis tests this week?',
    'Nah an O-TUT und C-HYP.',
  ],
  [
    'en',
    'organization',
    'Is the sample size question from the exercise sheet graded?',
    'Nah an C-SAMPLE und O-GRADE.',
  ],
  [
    'en',
    'organization',
    'Where can I find the QR code if I arrive late?',
    'Nah an T-QR; Informationsfrage.',
  ],
];

// ---------- Neue mehrdeutige Items: [locale, text, bestGuess, acceptable] ----------
const AMBIGUOUS = [
  ['de', 'Ist das wichtig?', 'content', ['content', 'organization']],
  ['de', 'Und was heißt das jetzt?', 'content', ['content']],
  ['de', 'Kommt das noch?', 'content', ['content', 'organization']],
  ['de', 'Wo finde ich das?', 'organization', ['organization', 'technical']],
  ['de', 'Geht das schon?', 'technical', ['technical', 'organization']],
  ['de', 'Wann ist das fällig?', 'organization', ['organization']],
  ['de', 'Gilt das auch für uns?', 'organization', ['organization']],
  ['de', 'Kann man das ändern?', 'organization', ['organization', 'technical']],
  ['de', 'Hä?', 'content', ['content']],
  ['de', 'Das verstehe ich nicht ganz.', 'content', ['content']],
  ['de', 'Ist das so richtig?', 'content', ['content']],
  ['de', 'Noch einmal, bitte?', 'content', ['content', 'technical']],
  ['de', 'Wird das noch hochgeladen?', 'organization', ['organization']],
  ['de', 'Brauchen wir das für später?', 'content', ['content']],
  ['de', 'Warum?', 'content', ['content']],
  ['de', 'Funktioniert das bei euch?', 'technical', ['technical']],
  ['en', 'Does that matter?', 'content', ['content', 'organization']],
  ['en', 'Where can I find it?', 'organization', ['organization', 'technical']],
  ['en', 'Does this apply to us too?', 'organization', ['organization']],
  ['en', 'Can you repeat that?', 'content', ['content', 'technical']],
  ['en', 'How come?', 'content', ['content']],
  ['en', 'Until when?', 'organization', ['organization']],
  ['en', 'Will that be uploaded?', 'organization', ['organization']],
  ['en', 'Is it working for anyone else?', 'technical', ['technical']],
  ['en', 'Do we need to know this?', 'content', ['content']],
  ['fr', "C'est important ?", 'content', ['content', 'organization']],
  ['fr', 'Ça marche chez vous ?', 'technical', ['technical']],
  ['fr', "Jusqu'à quand ?", 'organization', ['organization']],
  ['fr', 'Vous pouvez répéter ?', 'content', ['content', 'technical']],
  ['fr', 'Pourquoi ?', 'content', ['content']],
  ['fr', 'On doit savoir ça ?', 'content', ['content']],
  ['fr', "C'est où ?", 'organization', ['organization']],
  ['es', '¿Es importante?', 'content', ['content', 'organization']],
  ['es', '¿Hasta cuándo?', 'organization', ['organization']],
  ['es', '¿Puede repetir?', 'content', ['content', 'technical']],
  ['es', '¿Por qué?', 'content', ['content']],
  ['es', '¿Dónde lo encuentro?', 'organization', ['organization', 'technical']],
  ['es', '¿Eso entra?', 'content', ['content']],
  ['es', '¿A alguien más le funciona?', 'technical', ['technical']],
];

// ---------- Neue Rausch-Items: [locale, tags, text] ----------
const NOISE = [
  ['de', 'short', 'Danke!'],
  ['de', '', 'Super Vorlesung heute'],
  ['de', 'short', 'Guten Morgen'],
  ['de', 'short slang', 'Hahaha'],
  ['de', 'short', 'Test'],
  ['de', 'short', '👍'],
  ['de', 'short slang', 'Moin'],
  ['de', '', 'Sehr gut erklärt, danke'],
  ['de', 'slang', 'Wer ist noch wach?'],
  ['de', 'short slang', 'Mahlzeit'],
  ['en', 'short', 'Thanks!'],
  ['en', 'short', 'Great lecture'],
  ['en', '', 'Good morning everyone'],
  ['en', 'short slang', 'lmao'],
  ['en', 'short', 'test 123'],
  ['en', 'short', 'Nice'],
  ['en', 'short', 'Hi'],
  ['en', 'slang', 'Who else is here?'],
  ['fr', 'short', 'Merci !'],
  ['fr', 'short', 'Bonjour à tous'],
  ['fr', 'short', 'Super cours'],
  ['fr', 'short slang', 'mdr'],
  ['fr', 'short slang', 'Coucou'],
  ['fr', 'short', 'Bravo'],
  ['es', 'short', 'Buenos días'],
  ['es', 'short', 'Muy buena clase'],
  ['es', 'short slang', 'jajaja'],
  ['es', 'short', 'Hola a todos'],
  ['es', 'short', 'Genial'],
  ['es', 'short', 'Gracias, profe'],
];

// ---------- Zusammenbauen ----------
const families = [...v1.families, ...PROMOTED, ...NEW_FAMILIES];
const famById = new Map(families.map((f) => [f.id, f]));
const tagList = (s) => s.split(' ').filter(Boolean);
const items = [];

for (const it of v1.items.filter((i) => SCOPE.includes(i.locale))) {
  const { id, ...rest } = it;
  items.push({ ...rest, v1Id: id });
}
for (const [family, list] of Object.entries(ADD)) {
  const fam = famById.get(family);
  if (!fam) throw new Error(`unbekannte Familie ${family}`);
  const nearMiss = family.startsWith('N-') || family.startsWith('S-');
  for (const [locale, tags, text, note] of list) {
    const t = tagList(tags);
    if (nearMiss && !t.includes('near-miss')) t.push('near-miss');
    items.push({
      family,
      category: fam.category,
      locale,
      tags: t,
      text,
      ...(note ? { note } : {}),
    });
  }
}
NEAR_MISS_SINGLETONS.forEach(([locale, category, text, note], k) =>
  items.push({
    family: `S-NM-${String(k + 1).padStart(2, '0')}`,
    category,
    locale,
    tags: ['near-miss'],
    text,
    note,
  }),
);
AMBIGUOUS.forEach(([locale, text, category, acceptable], k) =>
  items.push({
    family: `S-AMB2-${String(k + 1).padStart(2, '0')}`,
    category,
    locale,
    tags: ['ambiguous', 'short'],
    text,
    expectUncertain: true,
    acceptableCategories: acceptable,
  }),
);
NOISE.forEach(([locale, tags, text], k) =>
  items.push({
    family: `S-NOISE2-${String(k + 1).padStart(2, '0')}`,
    category: null,
    locale,
    tags: ['noise', ...tagList(tags).filter((t) => t !== 'noise')],
    text,
    expectUncertain: true,
  }),
);

// Familien-Items vor Singletons, innerhalb stabil; neue IDs Q001…
const famOrder = new Map(families.map((f, k) => [f.id, k]));
items.sort((a, b) => (famOrder.get(a.family) ?? 1e6) - (famOrder.get(b.family) ?? 1e6));
items.forEach((it, k) => {
  it.id = `Q${String(k + 1).padStart(3, '0')}`;
});

// ---------- Prüfungen ----------
const errors = [];
if (items.length !== TARGET_TOTAL) errors.push(`Gesamt ${items.length} ≠ ${TARGET_TOTAL}`);
const norm = (s) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const seen = new Map();
for (const it of items) {
  const k = norm(it.text) || it.text;
  if (seen.has(k)) errors.push(`Duplikat: ${seen.get(k)} / ${it.id} »${it.text}«`);
  seen.set(k, it.id);
  const fam = famById.get(it.family);
  if (fam && fam.category !== it.category) errors.push(`${it.id}: Kategorie ≠ Familie`);
}
const mainFamilies = families.filter((f) => /^[COT]-/.test(f.id));
for (const f of mainFamilies) {
  for (const [lang, min] of Object.entries(MIN_PER_LANG)) {
    const n = items.filter((i) => i.family === f.id && i.locale === lang).length;
    if (n < min) errors.push(`${f.id}: ${lang} ${n} < ${min}`);
  }
}
for (const f of families) {
  const n = items.filter((i) => i.family === f.id).length;
  if (n < 2) errors.push(`Familie ${f.id} hat ${n} Items`);
}

const meta = structuredClone(v1.meta);
meta.version = '2.0.0-draft';
meta.created = '2026-10-21';
meta.status =
  'Entwurf – synthetisch, mit KI-Assistenz erstellt; vor der Auswertung einfrieren (SHA-256 dokumentieren)';
meta.scope =
  'de, en, fr, es und mixed. Italienisch ausgeschlossen, weil die Wortwolke es nicht unterstützt (WORD_CLOUD_LEMMA_LOCALES).';
meta.composition =
  '30 Hauptfamilien mit je mind. 5 de, 3 en, 2 fr, 2 es; Near-Miss-Familien (N-*, S-SLIDE-TYPO) und -Singletons; mehrdeutige und Rausch-Items als Singletons.';
meta.familyRules.nearMiss =
  'Near-Miss-Items haben ein anderes Anliegen als die lexikalisch nahe Familie. Erhalten mehrere Near-Miss-Items untereinander dieselbe Antwort (z. B. Übersetzungen), bilden sie eine eigene Familie (N-*); sonst Singleton (S-*).';
meta.idNote = 'IDs ab v2 neu (Q001–Q500). Aus v1 übernommene Items tragen v1Id.';

const out = { meta, families, items, contextOnly: v1.contextOnly };
const count = (key) =>
  items.reduce((m, i) => {
    for (const k of [].concat(key(i))) m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});
console.log(`Items ${items.length}, Familien ${families.length} (Haupt ${mainFamilies.length})`);
console.log(
  'Sprache:  ',
  count((i) => i.locale),
);
console.log(
  'Kategorie:',
  count((i) => String(i.category)),
);
console.log(
  'Art:      ',
  count((i) =>
    i.expectUncertain
      ? i.category === null
        ? 'noise'
        : 'ambiguous'
      : /^[COT]-/.test(i.family)
        ? 'family'
        : 'near-miss',
  ),
);
if (errors.length) {
  console.error(`\n${errors.length} Fehler:`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
writeFileSync(v2Path, JSON.stringify(out, null, 2) + '\n');
console.log(`geschrieben: ${v2Path}`);
