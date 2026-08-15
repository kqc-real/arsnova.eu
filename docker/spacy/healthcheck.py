#!/usr/bin/env python3
"""Unix-socket healthcheck for the spaCy sidecar. Exit 0 only on HTTP 204."""

from __future__ import annotations

import os
import socket
import sys

DEFAULT_SOCKET_PATH = "/run/spacy/nlp.sock"


def probe_health(socket_path: str, timeout_seconds: float = 2.0) -> int:
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(timeout_seconds)
    try:
        sock.connect(socket_path)
        sock.sendall(b"GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
        chunks = bytearray()
        while True:
            data = sock.recv(1024)
            if not data:
                break
            chunks.extend(data)
            if b"\r\n" in chunks:
                break
    finally:
        sock.close()

    status_line = bytes(chunks).split(b"\r\n", 1)[0]
    parts = status_line.split()
    if len(parts) >= 2 and parts[1] == b"204":
        return 204
    return 0


def main() -> None:
    socket_path = os.environ.get("NLP_SOCKET_PATH", DEFAULT_SOCKET_PATH).strip() or DEFAULT_SOCKET_PATH
    status = probe_health(socket_path)
    if status != 204:
        sys.stderr.write("NLP-Sidecar-Healthcheck fehlgeschlagen\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
