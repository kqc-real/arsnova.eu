#!/usr/bin/env python3
"""Private word-cloud encoder sidecar (Story 1.14c Stufe 1).

Unix-socket HTTP API, analog to spaCy:
- GET  /health → 204
- POST /embed  → { locale, snapshotHash, items: [{ id, text }] }
                 ← { modelId, modelVersion, items: [{ id, embedding }] }

Optional loopback HTTP via WORD_CLOUD_ENCODER_HTTP_BIND=127.0.0.1:8790 (macOS host-npm).
The process does not publish a Docker port. Request texts are not written to logs.
"""

from __future__ import annotations

import json
import os
import signal
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from embed import Embedder, load_embedder

MAX_REQUEST_BYTES = 1_048_576
MAX_TEXT_CHARS = 4_000
MAX_ITEMS = 500
MAX_IN_FLIGHT = 1
SOCKET_MODE = 0o600
DEFAULT_SOCKET_PATH = "/run/wordcloud-encoder/encoder.sock"
SUPPORTED_LOCALES = {"de", "en"}


class UnixHTTPServer(ThreadingHTTPServer):
    address_family = socket.AF_UNIX
    daemon_threads = True
    allow_reuse_address = True

    def server_bind(self) -> None:
        path = self.server_address
        if isinstance(path, bytes):
            path = path.decode("utf-8")
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        try:
            os.unlink(path)
        except FileNotFoundError:
            pass
        super().server_bind()
        os.chmod(path, SOCKET_MODE)

    def get_request(self):  # type: ignore[override]
        request, _client = super().get_request()
        return request, ("unix", 0)


def parse_embed_request(raw: bytes) -> dict[str, Any] | str:
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return "invalid"
    if not isinstance(parsed, dict):
        return "invalid"
    locale = parsed.get("locale")
    snapshot_hash = parsed.get("snapshotHash")
    items = parsed.get("items")
    if locale not in SUPPORTED_LOCALES:
        return "invalid"
    if not isinstance(snapshot_hash, str) or len(snapshot_hash) != 64:
        return "invalid"
    if not isinstance(items, list) or len(items) > MAX_ITEMS:
        return "too_large" if isinstance(items, list) else "invalid"
    cleaned: list[dict[str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            return "invalid"
        extra = set(item.keys()) - {"id", "text"}
        if extra:
            return "invalid"
        item_id = item.get("id")
        text = item.get("text")
        if not isinstance(item_id, str) or not item_id.strip():
            return "invalid"
        if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT_CHARS:
            return "invalid"
        cleaned.append({"id": item_id.strip(), "text": text.strip()})
    return {"locale": locale, "snapshotHash": snapshot_hash, "items": cleaned}


def embed_items(payload: dict[str, Any], embedder: Embedder, lock: threading.Lock) -> dict[str, Any]:
    texts = [item["text"] for item in payload["items"]]
    with lock:
        vectors = embedder.embed(texts)
    return {
        "modelId": embedder.model_id,
        "modelVersion": embedder.model_version,
        "items": [
            {"id": item["id"], "embedding": vector}
            for item, vector in zip(payload["items"], vectors, strict=True)
        ],
    }


def create_handler(embedder: Embedder, inflight: threading.BoundedSemaphore, lock: threading.Lock):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, format: str, *args: object) -> None:  # noqa: A003
            return

        def do_GET(self) -> None:
            if self.path.split("?", 1)[0] != "/health":
                self._send(404)
                return
            self._send(204)

        def do_POST(self) -> None:
            if self.path.split("?", 1)[0] != "/embed":
                self._send(404)
                return
            if not inflight.acquire(blocking=False):
                self._send(503)
                return
            try:
                length_header = self.headers.get("Content-Length")
                if length_header is None or not length_header.isdigit():
                    self._send(400)
                    return
                length = int(length_header)
                if length > MAX_REQUEST_BYTES:
                    self._send(413)
                    return
                raw = self.rfile.read(length)
                parsed = parse_embed_request(raw)
                if parsed == "too_large":
                    self._send(413)
                    return
                if parsed == "invalid" or isinstance(parsed, str):
                    self._send(400)
                    return
                body = json.dumps(
                    embed_items(parsed, embedder, lock),
                    ensure_ascii=False,
                    separators=(",", ":"),
                ).encode("utf-8")
                self._send(200, body, "application/json")
            finally:
                inflight.release()

        def _send(self, status: int, body: bytes = b"", content_type: str | None = None) -> None:
            self.send_response(status)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            if content_type:
                self.send_header("Content-Type", content_type)
            self.end_headers()
            if body:
                self.wfile.write(body)

    return Handler


def create_unix_server(socket_path: str, embedder: Embedder) -> UnixHTTPServer:
    inflight = threading.BoundedSemaphore(MAX_IN_FLIGHT)
    lock = threading.Lock()
    handler = create_handler(embedder, inflight, lock)
    return UnixHTTPServer(socket_path, handler)


def create_tcp_server(host: str, port: int, embedder: Embedder) -> ThreadingHTTPServer:
    inflight = threading.BoundedSemaphore(MAX_IN_FLIGHT)
    lock = threading.Lock()
    handler = create_handler(embedder, inflight, lock)
    server = ThreadingHTTPServer((host, port), handler)
    server.daemon_threads = True
    return server


def _stop_on_signal(server: ThreadingHTTPServer) -> None:
    def handle(_signum: int, _frame: object) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, handle)
    signal.signal(signal.SIGINT, handle)


def main() -> None:
    socket_path = (
        os.environ.get("WORD_CLOUD_ENCODER_SOCKET_PATH", DEFAULT_SOCKET_PATH).strip()
        or DEFAULT_SOCKET_PATH
    )
    embedder = load_embedder()
    http_bind = os.environ.get("WORD_CLOUD_ENCODER_HTTP_BIND", "").strip()
    if http_bind:
        host, port_text = http_bind.rsplit(":", 1)
        server = create_tcp_server(host, int(port_text), embedder)
        _stop_on_signal(server)
        try:
            server.serve_forever(poll_interval=0.5)
        finally:
            server.server_close()
        return

    server = create_unix_server(socket_path, embedder)
    _stop_on_signal(server)
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        server.server_close()
        try:
            os.unlink(socket_path)
        except FileNotFoundError:
            pass


if __name__ == "__main__":
    main()
