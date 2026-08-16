from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import time
import unittest
from http.client import HTTPConnection
from pathlib import Path
from socket import AF_UNIX, SOCK_STREAM, socket

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import healthcheck  # noqa: E402
import server  # noqa: E402


class FakeToken:
    def __init__(
        self,
        text: str,
        lemma: str,
        pos: str,
        ent_type: str = "",
        is_space: bool = False,
    ) -> None:
        self.text = text
        self.lemma_ = lemma
        self.pos_ = pos
        self.ent_type_ = ent_type
        self.is_space = is_space


class FakeDoc:
    def __init__(self, tokens: list[FakeToken]) -> None:
        self._tokens = tokens

    def __iter__(self):
        return iter(self._tokens)


class FakeNlp:
    def __init__(self, mapping: dict[str, list[FakeToken]]) -> None:
        self.mapping = mapping

    def pipe(self, texts, batch_size=32):
        for text in texts:
            yield FakeDoc(self.mapping.get(text, [FakeToken(text, text, "NOUN")]))


class UnixHttpConnection(HTTPConnection):
    def __init__(self, socket_path: str) -> None:
        super().__init__("localhost")
        self.socket_path = socket_path

    def connect(self) -> None:
        sock = socket(AF_UNIX, SOCK_STREAM)
        sock.connect(self.socket_path)
        self.sock = sock


def start_server(models: dict[str, FakeNlp]) -> tuple[str, object, threading.Thread, tempfile.TemporaryDirectory]:
    directory = tempfile.TemporaryDirectory(prefix="arsnova-spacy-")
    socket_path = os.path.join(directory.name, "nlp.sock")
    http_server = server.create_server(socket_path, models)
    thread = threading.Thread(target=http_server.serve_forever, kwargs={"poll_interval": 0.1}, daemon=True)
    thread.start()
    deadline = time.time() + 2
    while time.time() < deadline:
        if os.path.exists(socket_path):
            try:
                if healthcheck.probe_health(socket_path) == 204:
                    return socket_path, http_server, thread, directory
            except OSError:
                time.sleep(0.02)
                continue
        time.sleep(0.02)
    http_server.shutdown()
    directory.cleanup()
    raise AssertionError("Sidecar-Testserver startete nicht")


class ParseNormalizeRequestTests(unittest.TestCase):
    def test_accepts_de_snapshot(self) -> None:
        raw = json.dumps(
            {"locale": "de", "texts": [{"id": "a", "text": "Häuser"}]},
            ensure_ascii=False,
        ).encode("utf-8")
        parsed = server.parse_normalize_request(raw)
        self.assertEqual(parsed, ("de", [{"id": "a", "text": "Häuser"}]))

    def test_accepts_bundled_locales_and_rejects_italian(self) -> None:
        for locale, text in (("de", "Häuser"), ("en", "houses"), ("fr", "maisons"), ("es", "casas")):
            parsed = server.parse_normalize_request(
                json.dumps({"locale": locale, "texts": [{"id": "a", "text": text}]}).encode()
            )
            self.assertEqual(parsed, (locale, [{"id": "a", "text": text}]))
        self.assertEqual(
            server.parse_normalize_request(
                json.dumps({"locale": "it", "texts": [{"id": "a", "text": "ciao"}]}).encode()
            ),
            "invalid",
        )
        self.assertEqual(
            server.parse_normalize_request(
                json.dumps(
                    {"locale": "de", "texts": [{"id": "a", "text": "x" * (server.MAX_TEXT_CHARS + 1)}]}
                ).encode()
            ),
            "invalid",
        )

    def test_maps_noun_lemma_and_keeps_entity_type(self) -> None:
        doc = FakeDoc(
            [
                FakeToken("Häuser", "Haus", "NOUN"),
                FakeToken("Berlin", "Berlin", "PROPN", ent_type="GPE"),
                FakeToken(" ", " ", "SPACE", is_space=True),
            ]
        )
        self.assertEqual(
            server.tokens_from_doc(doc),
            [
                {"text": "Häuser", "lemma": "Haus", "pos": "NOUN", "entType": None},
                {"text": "Berlin", "lemma": "Berlin", "pos": "PROPN", "entType": "GPE"},
            ],
        )


class UnixSocketApiTests(unittest.TestCase):
    def setUp(self) -> None:
        nlp = FakeNlp(
            {
                "Häuser": [FakeToken("Häuser", "Haus", "NOUN")],
            }
        )
        self.socket_path, self._http_server, self._thread, self._tmp = start_server(
            {"de": nlp, "en": nlp, "fr": nlp, "es": nlp}
        )

    def tearDown(self) -> None:
        self._http_server.shutdown()
        self._http_server.server_close()
        self._thread.join(timeout=1)
        self._tmp.cleanup()

    def test_health_and_normalize_over_unix_socket(self) -> None:
        self.assertEqual(healthcheck.probe_health(self.socket_path), 204)
        connection = UnixHttpConnection(self.socket_path)
        try:
            body = json.dumps(
                {"locale": "de", "texts": [{"id": "item-1", "text": "Häuser"}]},
                ensure_ascii=False,
            ).encode("utf-8")
            connection.request(
                "POST",
                "/normalize",
                body=body,
                headers={"Content-Type": "application/json", "Content-Length": str(len(body))},
            )
            response = connection.getresponse()
            payload = json.loads(response.read().decode("utf-8"))
        finally:
            connection.close()

        self.assertEqual(response.status, 200)
        self.assertEqual(payload["modelId"], "de_core_news_sm@3.8.0")
        self.assertEqual(
            payload["items"][0]["tokens"],
            [{"text": "Häuser", "lemma": "Haus", "pos": "NOUN", "entType": None}],
        )

    def test_unknown_path_is_not_found(self) -> None:
        connection = UnixHttpConnection(self.socket_path)
        try:
            connection.request("GET", "/secrets")
            status = connection.getresponse().status
        finally:
            connection.close()
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
