from __future__ import annotations

import os
import sys
import unittest
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from embed import load_embedder  # noqa: E402

# Je drei Fragen zu Standardabweichung, WLAN und Abgabefrist.
GROUPS = {'de': ['Wie berechnet man die Standardabweichung?',
        'Wie bestimmt man die Standardabweichung?',
        'Wie finde ich die Standardabweichung?',
        'Mein WLAN verbindet sich nicht.',
        'Die WLAN-Verbindung bricht ab.',
        'Ich kann mich nicht mit dem WLAN verbinden.',
        'Wann muss die Hausarbeit abgegeben werden?',
        'Bis wann ist die Hausarbeit fällig?',
        'Was ist die Abgabefrist für die Hausarbeit?'],
 'en': ['How do we calculate the standard deviation?',
        'How is the standard deviation computed?',
        'What is the formula for standard deviation?',
        "My Wi-Fi won't connect.",
        'The Wi-Fi connection keeps dropping.',
        'I cannot connect to the Wi-Fi.',
        'When is the term paper due?',
        "What's the deadline for the term paper?",
        'By when do we submit the term paper?'],
 'fr': ['Comment calcule-t-on l’écart type ?',
        'Comment déterminer l’écart type ?',
        'Quelle formule donne l’écart type ?',
        'Mon appareil ne se connecte pas au Wi-Fi.',
        'Le Wi-Fi se déconnecte sans arrêt.',
        'Impossible de se connecter au Wi-Fi.',
        'Quand faut-il rendre le dossier ?',
        'Quelle est la date limite pour rendre le dossier ?',
        'Jusqu’à quand peut-on remettre le dossier ?'],
 'es': ['¿Cómo se calcula la desviación estándar?',
        '¿Cómo obtengo la desviación estándar?',
        '¿Cuál es la fórmula de la desviación estándar?',
        'No me puedo conectar a la wifi.',
        'La conexión wifi se corta todo el tiempo.',
        'Mi equipo no se conecta a la wifi.',
        '¿Cuándo hay que entregar el trabajo?',
        '¿Cuál es la fecha límite de entrega del trabajo?',
        '¿Hasta cuándo se puede entregar el trabajo?'],
 'it': ['Come si calcola la deviazione standard?',
        'Come si determina la deviazione standard?',
        'Qual è la formula della deviazione standard?',
        'Non riesco a connettermi al Wi-Fi.',
        'Il Wi-Fi si disconnette di continuo.',
        'Il mio dispositivo non si connette al Wi-Fi.',
        'Quando dobbiamo consegnare la relazione?',
        'Qual è la scadenza per consegnare la relazione?',
        'Entro quando va consegnata la relazione?']}

@unittest.skipUnless(os.environ.get("WORD_CLOUD_ENCODER_MODEL_DIR"), "requires ONNX weights")
class RealModelLocaleTests(unittest.TestCase):
    def test_separates_paraphrases_from_other_topics(self) -> None:
        model = load_embedder()
        for locale, texts in GROUPS.items():
            with self.subTest(locale=locale):
                vectors = model.embed(texts)
                for left, right in combinations(range(len(texts)), 2):
                    similarity = sum(
                        a * b for a, b in zip(vectors[left], vectors[right], strict=True)
                    )
                    self.assertEqual(
                        similarity >= 0.87, left // 3 == right // 3,
                        f"{locale}: {left}, {right}, cosine={similarity:.3f}",
                    )
