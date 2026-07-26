#!/usr/bin/env python3

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import arsnova_monitor as monitor  # noqa: E402


def healthy_security_stats():
    payload = {"databaseStatus": "ok"}
    for rule in monitor.RULES:
        cursor = payload
        for segment in rule.path[:-1]:
            cursor = cursor.setdefault(segment, {})
        cursor[rule.path[-1]] = 0
    payload.update({"pdfActiveJobs": 0, "pdfMaxConcurrentJobs": 1})
    return payload


class Handler(BaseHTTPRequestHandler):
    RESPONSES = {
        "/trpc/health.securityStats": healthy_security_stats(),
        "/trpc/health.check": {"status": "ok", "redis": "ok"},
        "/trpc/health.stats": {"serviceStatus": "stable"},
    }

    def do_GET(self):
        payload = self.RESPONSES.get(self.path)
        if payload is None:
            self.send_error(404)
            return
        encoded = json.dumps({"result": {"data": {"json": payload}}}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_):
        return


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 3000), Handler).serve_forever()
