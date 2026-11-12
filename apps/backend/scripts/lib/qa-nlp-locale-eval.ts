import type { QaNlpCategory } from '@arsnova/shared-types';
import {
  QA_NLP_SEED_LOCALES,
  type QaNlpSeedExample,
  type QaNlpSeedLocale,
} from '../../src/lib/qaNlpSeed';

// Separater synthetischer Prüfkorpus. Texte daraus dürfen weder trainieren noch kalibrieren.
const TEXTS: Record<QaNlpSeedLocale, Record<QaNlpCategory, readonly string[]>> = {
  de: {
    content: [
      'Wieso sinkt der Druck, wenn das Volumen zunimmt?',
      'Was passiert bei einer Division durch null?',
      'Wie unterscheiden sich Kohorte und Stichprobe?',
      'Gilt die Formel auch für negative Werte?',
      'Kann eine Regression ohne Achsenabschnitt sinnvoll sein?',
    ],
    organization: [
      'Dürfen wir die Laborpartner nächste Woche wechseln?',
      'Welche Uhrzeit gilt für die Nachholgruppe?',
      'Gibt es für die Projektvorstellung eine feste Reihenfolge?',
      'Wo trage ich mich für die Sprechstunde ein?',
      'Wie lange haben wir für die Vorbereitung des Referats?',
    ],
    technical: [
      'Im eingebetteten Video kommt kein Ton an.',
      'Die Eingabe springt bei jedem Tastendruck an den Anfang.',
      'Mein Bildschirm bleibt nach dem QR-Scan weiß.',
      'Der Download wird nach wenigen Sekunden abgebrochen.',
      'Der Browser meldet beim Hochladen einen Zertifikatsfehler.',
    ],
  },
  en: {
    content: [
      'Why does regularization reduce overfitting?',
      'How can two events be mutually exclusive yet dependent?',
      'What makes this matrix singular?',
      'Would the conclusion still hold for a skewed sample?',
      'How does the enzyme alter the activation energy?',
    ],
    organization: [
      'Can I attend the Tuesday lab instead of the Friday one?',
      'Who assigns the speaking order for the presentations?',
      'Where can I book a slot for the oral assessment?',
      'Do we need to form teams before the workshop?',
      'Can we hand in a joint write-up for this assignment?',
    ],
    technical: [
      'The browser loses my answer whenever I scroll.',
      'I get a blank page after scanning the join code.',
      'The embedded video has no sound on my laptop.',
      'The file upload stops at sixty percent every time.',
      'The submit button is grey after I reconnect.',
    ],
  },
  fr: {
    content: [
      'Pourquoi la pente est-elle négative sur cette partie du graphique ?',
      'Comment interpréter le résidu de cette observation ?',
      'Que devient la variance si on multiplie toutes les valeurs par deux ?',
      'Dans quel cas les deux événements sont-ils indépendants ?',
      'La formule reste-t-elle valable pour un échantillon déséquilibré ?',
    ],
    organization: [
      'Peut-on changer de groupe pour la prochaine séance ?',
      'À quelle heure commence le rattrapage jeudi ?',
      'Où faut-il réserver un créneau pour la soutenance ?',
      'Le compte rendu doit-il être rendu en binôme ?',
      'Y a-t-il un ordre de passage pour les exposés ?',
    ],
    technical: [
      'Le navigateur affiche une page blanche après le scan.',
      'Le son disparaît quand je passe la vidéo en plein écran.',
      'Le téléchargement du fichier s’arrête à mi-chemin.',
      'Le bouton de validation reste grisé après la reconnexion.',
      'Le clavier virtuel masque la zone de réponse.',
    ],
  },
  es: {
    content: [
      '¿Por qué disminuye la presión al aumentar el volumen?',
      '¿Cómo se interpreta el residuo de esta observación?',
      '¿Qué distingue una muestra aleatoria de un censo?',
      '¿En qué condiciones se puede invertir esta matriz?',
      '¿Qué ocurre con la varianza si duplicamos todos los datos?',
    ],
    organization: [
      '¿Podemos cambiar de pareja para la próxima práctica?',
      '¿A qué hora empieza la sesión de recuperación del jueves?',
      '¿Dónde se reserva turno para la presentación oral?',
      '¿Hay que entregar un informe por grupo?',
      '¿En qué orden tendremos que exponer?',
    ],
    technical: [
      'La pantalla se queda en blanco al escanear el código.',
      'El vídeo se reproduce sin sonido en mi portátil.',
      'La subida del archivo se interrumpe a la mitad.',
      'El botón de enviar sigue desactivado tras reconectarme.',
      'El teclado del móvil tapa el campo de respuesta.',
    ],
  },
  it: {
    content: [
      'Perché la pressione diminuisce quando aumenta il volume?',
      'Come si interpreta il residuo di questa osservazione?',
      'Qual è la differenza tra un campione casuale e un censimento?',
      'In quali condizioni questa matrice è invertibile?',
      'Cosa succede alla varianza se raddoppiamo tutti i valori?',
    ],
    organization: [
      'Possiamo cambiare compagno per il prossimo laboratorio?',
      'A che ora inizia il recupero di giovedì?',
      'Dove posso prenotare un turno per la prova orale?',
      'Bisogna consegnare una relazione per gruppo?',
      'In quale ordine si svolgono le presentazioni?',
    ],
    technical: [
      'Dopo aver scansionato il codice vedo una schermata bianca.',
      'Il video parte ma sul mio portatile non si sente nulla.',
      'Il caricamento del file si interrompe a metà.',
      'Dopo la riconnessione il pulsante di invio rimane disattivato.',
      'La tastiera del telefono copre il campo della risposta.',
    ],
  },
  mixed: {
    content: [
      'Pourquoi le biais increases when we select only volunteers?',
      '¿Cómo se interpreta the residual en este gráfico?',
      'Perché la slope diventa negativa dopo quel punto?',
    ],
    organization: [
      'Can I change de grupo para la próxima práctica?',
      'Dove si prenota a time slot per la prova orale?',
      'Bis wann müssen wir submit le compte rendu?',
    ],
    technical: [
      'Le bouton submit ne répond plus après la reconnexion.',
      'El upload no termina, se queda at sixty percent.',
      'Dopo il login bleibt die Seite komplett weiß.',
    ],
  },
};

export const QA_NLP_LOCALE_EVAL: readonly QaNlpSeedExample[] = QA_NLP_SEED_LOCALES.flatMap(
  (locale) =>
    (['content', 'organization', 'technical'] as const).flatMap((category) =>
      TEXTS[locale][category].map((text) => ({
        text,
        category,
        locale,
        split: 'eval',
        tags: [locale === 'mixed' ? 'code-switch' : 'canonical'],
      })),
    ),
);
