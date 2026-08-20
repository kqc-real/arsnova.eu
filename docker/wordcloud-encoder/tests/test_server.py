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

import embed  # noqa: E402
import healthcheck  # noqa: E402
import server  # noqa: E402


class UnixHttpConnection(HTTPConnection):
    def __init__(self, socket_path: str) -> None:
        super().__init__("localhost")
        self.socket_path = socket_path

    def connect(self) -> None:
        sock = socket(AF_UNIX, SOCK_STREAM)
        sock.connect(self.socket_path)
        self.sock = sock


def start_server() -> tuple[str, object, threading.Thread, tempfile.TemporaryDirectory]:
    directory = tempfile.TemporaryDirectory(prefix="arsnova-encoder-")
    socket_path = os.path.join(directory.name, "encoder.sock")
    http_server = server.create_unix_server(socket_path, embed.StubEmbedder())
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
    raise AssertionError("Encoder-Socket startete nicht")


class EncoderServerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.socket_path, self.http_server, self.thread, self.directory = start_server()

    def tearDown(self) -> None:
        self.http_server.shutdown()
        self.http_server.server_close()
        self.directory.cleanup()

    def test_health_is_204(self) -> None:
        self.assertEqual(healthcheck.probe_health(self.socket_path), 204)

    def test_embed_returns_vectors_without_extra_fields(self) -> None:
        payload = {
            "locale": "de",
            "snapshotHash": "a" * 64,
            "items": [
                {"id": "qa-question:1", "text": "Kommt Kapitel 4 in die Klausur?"},
                {"id": "qa-question:2", "text": "Die Folien von letzter Woche fehlen im Moodle."},
            ],
        }
        connection = UnixHttpConnection(self.socket_path)
        body = json.dumps(payload).encode("utf-8")
        connection.request("POST", "/embed", body=body, headers={"Content-Type": "application/json"})
        response = connection.getresponse()
        raw = response.read().decode("utf-8")
        connection.close()
        self.assertEqual(response.status, 200)
        parsed = json.loads(raw)
        self.assertEqual(set(parsed.keys()), {"modelId", "modelVersion", "items"})
        self.assertEqual(len(parsed["items"]), 2)
        self.assertIn("embedding", parsed["items"][0])
        self.assertNotIn("text", parsed["items"][0])
        self.assertNotIn("Klausur", raw)

    def test_rejects_extra_snapshot_fields(self) -> None:
        payload = {
            "locale": "de",
            "snapshotHash": "b" * 64,
            "items": [{"id": "qa-question:1", "text": "Hallo", "nickname": "Ada"}],
        }
        connection = UnixHttpConnection(self.socket_path)
        body = json.dumps(payload).encode("utf-8")
        connection.request("POST", "/embed", body=body, headers={"Content-Type": "application/json"})
        response = connection.getresponse()
        response.read()
        connection.close()
        self.assertEqual(response.status, 400)

    def test_parse_rejects_overlong_text(self) -> None:
        parsed = server.parse_embed_request(
            json.dumps(
                {
                    "locale": "en",
                    "snapshotHash": "c" * 64,
                    "items": [{"id": "qa-question:1", "text": "x" * 4001}],
                }
            ).encode("utf-8")
        )
        self.assertEqual(parsed, "invalid")


if __name__ == "__main__":
    unittest.main()
