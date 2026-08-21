#!/usr/bin/env python3
"""Optional spaCy lemma sidecar for arsnova.eu word clouds (Story 1.14b).

Unix-socket HTTP API, analog to the PDF worker:
- GET  /health    → 204
- POST /normalize → lemma/POS tokens for de/en/fr/es snapshots

The process never binds a TCP port. Request texts are not written to logs.
"""

from __future__ import annotations

import json
import os
import signal
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable, Iterable, Mapping, Sequence

MAX_REQUEST_BYTES = 1_048_576
MAX_TEXT_CHARS = 4_000
MAX_ITEMS = 500
MAX_TOKENS_PER_TEXT = 2_000
MAX_IN_FLIGHT = 2
SOCKET_MODE = 0o600
DEFAULT_SOCKET_PATH = "/run/spacy/nlp.sock"

MODEL_IDS = {
    "de": "de_core_news_sm@3.8.0",
    "en": "en_core_web_sm@3.8.0",
    "fr": "fr_core_news_sm@3.8.0",
    "es": "es_core_news_sm@3.8.0",
}
MODEL_NAMES = {
    "de": "de_core_news_sm",
    "en": "en_core_web_sm",
    "fr": "fr_core_news_sm",
    "es": "es_core_news_sm",
}
LOAD_EXCLUDES = ("parser", "senter")

Nlp = Callable[..., Any]


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


def tokens_from_doc(doc: Iterable[Any]) -> list[dict[str, str | None]]:
    tokens: list[dict[str, str | None]] = []
    for token in doc:
        if getattr(token, "is_space", False):
            continue
        text = str(getattr(token, "text", "") or "")
        lemma = str(getattr(token, "lemma_", "") or text)
        pos = str(getattr(token, "pos_", "") or "X")
        if not text or not lemma:
            continue
        ent = str(getattr(token, "ent_type_", "") or "") or None
        tag = str(getattr(token, "tag_", "") or "") or None
        tokens.append(
            {
                "text": text[:256],
                "lemma": lemma[:256],
                "pos": pos[:16],
                "tag": None if tag is None else tag[:16],
                "entType": None if ent is None else ent[:32],
            }
        )
        if len(tokens) >= MAX_TOKENS_PER_TEXT:
            break
    return tokens


def parse_normalize_request(raw: bytes) -> tuple[str, list[dict[str, str]]] | str:
    """Return (locale, texts) or an error token: invalid | too_large."""
    if len(raw) > MAX_REQUEST_BYTES:
        return "too_large"
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return "invalid"
    if not isinstance(payload, dict):
        return "invalid"
    locale = payload.get("locale")
    texts = payload.get("texts")
    if locale not in MODEL_IDS or not isinstance(texts, list) or len(texts) > MAX_ITEMS:
        return "invalid"
    normalized: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in texts:
        if not isinstance(item, dict):
            return "invalid"
        item_id = item.get("id")
        text = item.get("text")
        if not isinstance(item_id, str) or not item_id.strip():
            return "invalid"
        if not isinstance(text, str) or not text or len(text) > MAX_TEXT_CHARS:
            return "invalid"
        if item_id in seen:
            return "invalid"
        seen.add(item_id)
        normalized.append({"id": item_id, "text": text})
    return locale, normalized


def normalize_texts(
    locale: str,
    texts: Sequence[Mapping[str, str]],
    nlp: Nlp,
    *,
    lock: threading.Lock | None = None,
) -> dict[str, Any]:
    ordered_texts = [item["text"] for item in texts]
    if hasattr(nlp, "pipe"):
        docs_iter = nlp.pipe(ordered_texts, batch_size=32)
        if lock is None:
            docs = list(docs_iter)
        else:
            with lock:
                docs = list(docs_iter)
    else:
        if lock is None:
            docs = [nlp(text) for text in ordered_texts]
        else:
            with lock:
                docs = [nlp(text) for text in ordered_texts]

    return {
        "locale": locale,
        "modelId": MODEL_IDS[locale],
        "items": [
            {"id": item["id"], "tokens": tokens_from_doc(doc)}
            for item, doc in zip(texts, docs, strict=True)
        ],
    }


def load_models() -> dict[str, Nlp]:
    try:
        import spacy  # type: ignore[import-not-found]
    except ImportError as error:
        raise RuntimeError("spaCy ist im Sidecar-Image nicht installiert") from error

    models: dict[str, Nlp] = {}
    for locale, name in MODEL_NAMES.items():
        models[locale] = spacy.load(name, exclude=list(LOAD_EXCLUDES))
    return models


def create_handler(
    models: Mapping[str, Nlp],
    inflight: threading.BoundedSemaphore,
    nlp_lock: threading.Lock,
) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, _fmt: str, *_args: object) -> None:
            return

        def do_GET(self) -> None:
            if self.path.split("?", 1)[0] != "/health":
                self._send(404)
                return
            self._send(204)

        def do_POST(self) -> None:
            if self.path.split("?", 1)[0] != "/normalize":
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
                parsed = parse_normalize_request(raw)
                if parsed == "too_large":
                    self._send(413)
                    return
                if parsed == "invalid":
                    self._send(400)
                    return
                locale, texts = parsed
                nlp = models.get(locale)
                if nlp is None:
                    self._send(400)
                    return
                body = json.dumps(
                    normalize_texts(locale, texts, nlp, lock=nlp_lock),
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


def create_server(socket_path: str, models: Mapping[str, Nlp]) -> UnixHTTPServer:
    inflight = threading.BoundedSemaphore(MAX_IN_FLIGHT)
    nlp_lock = threading.Lock()
    handler = create_handler(models, inflight, nlp_lock)
    return UnixHTTPServer(socket_path, handler)


def serve(socket_path: str, models: Mapping[str, Nlp]) -> None:
    server = create_server(socket_path, models)
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        server.server_close()
        try:
            os.unlink(socket_path)
        except FileNotFoundError:
            pass


def main() -> None:
    socket_path = os.environ.get("NLP_SOCKET_PATH", DEFAULT_SOCKET_PATH).strip() or DEFAULT_SOCKET_PATH
    models = load_models()
    server = create_server(socket_path, models)

    def stop(_signum: int, _frame: object) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
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
