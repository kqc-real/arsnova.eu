#!/usr/bin/env python3
"""W3.7 host-side alert evaluator for arsnova.eu security telemetry."""

from __future__ import annotations

import argparse
import concurrent.futures
import fcntl
import hashlib
import http.client
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

API_BASE_URL = "http://127.0.0.1:3000/trpc"
DEFAULT_STATE_FILE = Path("/var/lib/arsnova-monitoring/state.json")
DEFAULT_WARNING_REPEAT_SECONDS = 6 * 60 * 60
DEFAULT_CRITICAL_REPEAT_SECONDS = 60 * 60
MAX_CONSECUTIVE_SAMPLE_GAP_SECONDS = 150
REQUEST_TIMEOUT_SECONDS = 10
LEVEL_ORDER = {"ok": 0, "warning": 1, "critical": 2}


class MonitorError(RuntimeError):
    """Operational monitor failure with a deliberately non-sensitive message."""


@dataclass(frozen=True)
class Rule:
    alert_id: str
    label: str
    path: tuple[str, ...]
    warning: float
    critical: float


RULES = (
    Rule("session_create_rate", "Erfolgreiche Session-Erstellungen/min", ("sessionCreatesLastMinute",), 30, 60),
    Rule(
        "rate_limit_429_total",
        "Alarmrelevante 429-Ablehnungen/min",
        ("rateLimit429AlertLastMinute",),
        50,
        200,
    ),
    Rule(
        "session_code_entry_failures",
        "Fehlgeschlagene Join- und Codeprüfungen/min",
        ("sessionCodeEntryFailuresLastMinute",),
        100,
        500,
    ),
    Rule(
        "session_code_entry_soft_cap_delays",
        "Soft-Cap-Delays für Join- und Codeprüfungen/min",
        ("sessionCodeEntrySoftCapDelaysLastMinute",),
        10,
        100,
    ),
    Rule(
        "session_code_429",
        "Client-Cap-429 für Join-/Codeprüfungen/min",
        ("rateLimit429ByCategoryLastMinute", "sessionCode"),
        30,
        100,
    ),
    Rule("pdf_rejected", "PDF-Ablehnungen/min", ("pdfRejectedLastMinute",), 5, 20),
    Rule("pdf_failed", "PDF-Fehler/min", ("pdfFailedLastMinute",), 1, 3),
    Rule("csp_dropped", "Verworfene CSP-Reports/min", ("cspReportsDroppedLastMinute",), 10, 100),
    Rule(
        "csp_rate_limited",
        "Rate-limitierte CSP-Reports/min",
        ("cspReportsRateLimitedLastMinute",),
        50,
        500,
    ),
    Rule("csp_eval", "CSP-eval-Meldungen/min", ("cspReportsEvalLastMinute",), 1, 10),
    Rule(
        "csp_script_https",
        "Externe CSP-Script-HTTPS-Meldungen/min",
        ("cspReportsScriptHttpsLastMinute",),
        10,
        100,
    ),
    Rule(
        "trpc_ws_connections",
        "Aktive tRPC-WebSockets",
        ("trpcWebSocketConnectionsActive",),
        600,
        800,
    ),
    Rule(
        "trpc_ws_rejected_upgrades",
        "Abgelehnte tRPC-Upgrades/min",
        ("trpcWebSocketRejectedUpgradesLastMinute",),
        50,
        200,
    ),
    Rule(
        "trpc_ws_payload_rejected",
        "tRPC-Payload-Ablehnungen/min",
        ("trpcWebSocketPayloadRejectedLastMinute",),
        1,
        10,
    ),
    Rule(
        "trpc_ws_rate_limited",
        "tRPC-Message-Rate-Schließungen/min",
        ("trpcWebSocketRateLimitedMessagesLastMinute",),
        10,
        50,
    ),
    Rule(
        "yjs_ws_connections",
        "Aktive Yjs-WebSockets",
        ("yjsWebSocketConnectionsActive",),
        700,
        900,
    ),
    Rule(
        "yjs_ws_rejected_upgrades",
        "Abgelehnte Yjs-Upgrades/min",
        ("yjsWebSocketRejectedUpgradesLastMinute",),
        50,
        200,
    ),
    Rule(
        "yjs_ws_payload_rejected",
        "Yjs-Payload-Ablehnungen/min",
        ("yjsWebSocketPayloadRejectedLastMinute",),
        1,
        10,
    ),
    Rule(
        "yjs_ws_rate_limited",
        "Yjs-Message-Rate-Schließungen/min",
        ("yjsWebSocketRateLimitedMessagesLastMinute",),
        10,
        50,
    ),
    Rule(
        "yjs_ws_awareness_rejected",
        "Yjs-Awareness-Ablehnungen/min",
        ("yjsWebSocketAwarenessRejectedLastMinute",),
        1,
        10,
    ),
)


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> None:
        return None


def nested_number(payload: dict[str, Any], path: tuple[str, ...]) -> float:
    value: Any = payload
    for segment in path:
        if not isinstance(value, dict) or segment not in value:
            raise MonitorError(f"Diagnoseantwort enthält das Pflichtfeld {'.'.join(path)} nicht.")
        value = value[segment]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise MonitorError(f"Diagnosefeld {'.'.join(path)} ist nicht numerisch.")
    if value < 0:
        raise MonitorError(f"Diagnosefeld {'.'.join(path)} ist negativ.")
    return float(value)


def evaluate_rule(rule: Rule, stats: dict[str, Any]) -> dict[str, Any] | None:
    observed = nested_number(stats, rule.path)
    if observed >= rule.critical:
        level = "critical"
        threshold = rule.critical
    elif observed >= rule.warning:
        level = "warning"
        threshold = rule.warning
    else:
        return None
    return {
        "id": rule.alert_id,
        "label": rule.label,
        "level": level,
        "observed": int(observed) if observed.is_integer() else observed,
        "threshold": threshold,
    }


def evaluate(
    security_stats: dict[str, Any],
    health_check: dict[str, Any],
    public_stats: dict[str, Any],
) -> dict[str, Any]:
    alerts = [alert for rule in RULES if (alert := evaluate_rule(rule, security_stats)) is not None]

    if health_check.get("status") != "ok":
        alerts.append(
            {
                "id": "application_health",
                "label": "Anwendungs-Healthcheck",
                "level": "critical",
                "observed": str(health_check.get("status", "missing")),
                "threshold": "ok",
            }
        )
    if health_check.get("redis") != "ok":
        alerts.append(
            {
                "id": "redis_health",
                "label": "Redis-Erreichbarkeit",
                "level": "critical",
                "observed": str(health_check.get("redis", "missing")),
                "threshold": "ok",
            }
        )
    if security_stats.get("databaseStatus") != "ok":
        alerts.append(
            {
                "id": "database_health",
                "label": "PostgreSQL-Erreichbarkeit",
                "level": "critical",
                "observed": str(security_stats.get("databaseStatus", "missing")),
                "threshold": "ok",
            }
        )

    service_status = public_stats.get("serviceStatus")
    if service_status == "critical":
        alerts.append(
            {
                "id": "service_status",
                "label": "Öffentlicher Betriebsstatus",
                "level": "critical",
                "observed": service_status,
                "threshold": "stable",
            }
        )
    elif service_status == "limited":
        alerts.append(
            {
                "id": "service_status",
                "label": "Öffentlicher Betriebsstatus",
                "level": "warning",
                "observed": service_status,
                "threshold": "stable",
            }
        )
    elif service_status != "stable":
        raise MonitorError("health.stats enthält keinen gültigen serviceStatus.")

    level = max((alert["level"] for alert in alerts), key=LEVEL_ORDER.get, default="ok")
    return {
        "level": level,
        "alerts": sorted(alerts, key=lambda item: item["id"]),
        "telemetryAvailable": True,
    }


def probe_failure_result() -> dict[str, Any]:
    return {
        "level": "critical",
        "telemetryAvailable": False,
        "alerts": [
            {
                "id": "monitor_probe_failed",
                "label": "Security-Monitoring-Abfrage",
                "level": "critical",
                "observed": "failed",
                "threshold": "successful",
            }
        ],
    }


def fetch_live_result(diagnostic_secret: str) -> dict[str, Any]:
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        security_future = executor.submit(
            trpc_json,
            "health.securityStats",
            diagnostic_secret,
        )
        health_future = executor.submit(trpc_json, "health.check")
        public_future = executor.submit(trpc_json, "health.stats")
        return evaluate(
            security_future.result(),
            health_future.result(),
            public_future.result(),
        )


def result_signature(result: dict[str, Any]) -> str:
    components = [f"{alert['id']}:{alert['level']}" for alert in result["alerts"]]
    raw = f"{result['level']}|{'|'.join(sorted(components))}".encode()
    return hashlib.sha256(raw).hexdigest()


def empty_state() -> dict[str, Any]:
    return {
        "activeLevel": "ok",
        "activeSignature": result_signature({"level": "ok", "alerts": []}),
        "activeAlerts": [],
        "observationCounts": {},
        "lastObservedAt": 0,
        "lastNotifiedAt": 0,
    }


def notification_decision(
    state: dict[str, Any],
    result: dict[str, Any],
    now: int,
    warning_repeat_seconds: int = DEFAULT_WARNING_REPEAT_SECONDS,
    critical_repeat_seconds: int = DEFAULT_CRITICAL_REPEAT_SECONDS,
) -> tuple[str | None, dict[str, Any], dict[str, Any]]:
    previous_alerts = {
        alert["id"]: alert for alert in state.get("activeAlerts", []) if isinstance(alert, dict)
    }
    observed_alerts = {alert["id"]: alert for alert in result["alerts"]}
    telemetry_available = result.get("telemetryAvailable", True) is True
    previous_counts = state.get("observationCounts", {})
    if not isinstance(previous_counts, dict):
        previous_counts = {}
    previous_observed_at = int(state.get("lastObservedAt", 0))
    if (
        previous_observed_at <= 0
        or now <= previous_observed_at
        or now - previous_observed_at > MAX_CONSECUTIVE_SAMPLE_GAP_SECONDS
    ):
        previous_counts = {}
    observation_counts: dict[str, int] = {}
    next_alerts = dict(previous_alerts)

    for alert_id, alert in observed_alerts.items():
        key = f"{alert_id}:{alert['level']}"
        count = int(previous_counts.get(key, 0)) + 1
        observation_counts[key] = count
        previous = previous_alerts.get(alert_id)
        already_active_at_level = previous is not None and previous["level"] == alert["level"]
        if alert["level"] == "critical" or already_active_at_level or count >= 2:
            next_alerts[alert_id] = alert

    for alert_id, previous in previous_alerts.items():
        if alert_id in observed_alerts:
            continue
        if not telemetry_available and alert_id != "monitor_probe_failed":
            next_alerts[alert_id] = previous
            for key, count in previous_counts.items():
                if key.startswith(f"{alert_id}:"):
                    observation_counts[key] = int(count)
            continue
        key = f"{alert_id}:ok"
        count = int(previous_counts.get(key, 0)) + 1
        observation_counts[key] = count
        if count >= 2:
            next_alerts.pop(alert_id, None)
        else:
            next_alerts[alert_id] = previous

    next_alert_list = sorted(next_alerts.values(), key=lambda alert: alert["id"])
    level = max(
        (alert["level"] for alert in next_alert_list),
        key=LEVEL_ORDER.get,
        default="ok",
    )
    active_result = {"level": level, "alerts": next_alert_list}
    signature = result_signature(active_result)
    active_signature = str(state.get("activeSignature", empty_state()["activeSignature"]))
    resolved_alerts = [
        {"id": alert_id, "previousLevel": previous["level"]}
        for alert_id, previous in sorted(previous_alerts.items())
        if alert_id not in next_alerts or next_alerts[alert_id]["level"] != previous["level"]
    ]
    next_state = {
        **empty_state(),
        **state,
        "activeLevel": level,
        "activeSignature": signature,
        "activeAlerts": next_alert_list,
        "observationCounts": observation_counts,
        "lastObservedAt": now,
    }

    if signature != active_signature:
        next_state["lastNotifiedAt"] = now
        if level == "ok":
            event = "recovery"
        elif not previous_alerts:
            event = "alert"
        else:
            event = "update"
        return event, next_state, {
            "notificationResult": active_result,
            "resolvedAlerts": resolved_alerts,
        }

    if level != "ok":
        repeat_after = critical_repeat_seconds if level == "critical" else warning_repeat_seconds
        if now - int(next_state.get("lastNotifiedAt", 0)) >= repeat_after:
            next_state["lastNotifiedAt"] = now
            return "repeat", next_state, {
                "notificationResult": active_result,
                "resolvedAlerts": [],
            }

    return None, next_state, {
        "notificationResult": active_result,
        "resolvedAlerts": [],
    }


def trpc_json(procedure: str, diagnostic_secret: str | None = None) -> dict[str, Any]:
    request = urllib.request.Request(f"{API_BASE_URL}/{procedure}", method="GET")
    if diagnostic_secret is not None:
        request.add_header("x-admin-diagnostic-secret", diagnostic_secret)
    opener = urllib.request.build_opener(NoRedirectHandler())
    try:
        with opener.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            if response.status != 200:
                raise MonitorError(f"{procedure} antwortet mit HTTP {response.status}.")
            envelope = json.load(response)
    except (
        urllib.error.URLError,
        TimeoutError,
        json.JSONDecodeError,
        http.client.HTTPException,
        OSError,
        UnicodeError,
    ) as error:
        raise MonitorError(f"{procedure} ist nicht zuverlässig abrufbar.") from error
    return extract_trpc_payload(envelope, procedure)


def extract_trpc_payload(envelope: Any, procedure: str) -> dict[str, Any]:
    try:
        data = envelope["result"]["data"]
    except (KeyError, TypeError) as error:
        raise MonitorError(f"{procedure} liefert keine gültige tRPC-Antwort.") from error
    payload = data.get("json", data) if isinstance(data, dict) else data
    if not isinstance(payload, dict):
        raise MonitorError(f"{procedure} liefert kein JSON-Objekt.")
    return payload


def validate_https_url(raw_url: str, label: str) -> str:
    try:
        parsed = urllib.parse.urlsplit(raw_url)
        hostname = parsed.hostname
        parsed.port
    except ValueError as error:
        raise MonitorError(f"{label} ist keine gültige HTTPS-URL.") from error
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or not hostname
        or parsed.username
        or parsed.password
        or parsed.fragment
    ):
        raise MonitorError(f"{label} muss eine HTTPS-URL ohne eingebettete Zugangsdaten sein.")
    return raw_url


def post_json(url: str, payload: dict[str, Any], bearer_token: str | None = None) -> None:
    validate_https_url(url, "MONITORING_WEBHOOK_URL")
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    request = urllib.request.Request(url, data=data, method="POST")
    request.add_header("Content-Type", "application/json")
    request.add_header("User-Agent", "arsnova-monitor/1")
    if bearer_token:
        request.add_header("Authorization", f"Bearer {bearer_token}")
    opener = urllib.request.build_opener(NoRedirectHandler())
    try:
        with opener.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            if not 200 <= response.status < 300:
                raise MonitorError(f"Alarm-Webhook antwortet mit HTTP {response.status}.")
    except (urllib.error.URLError, TimeoutError) as error:
        raise MonitorError("Alarm-Webhook konnte nicht zugestellt werden.") from error


def ping_heartbeat(url: str) -> None:
    validate_https_url(url, "MONITORING_HEARTBEAT_URL")
    request = urllib.request.Request(url, data=b"", method="POST")
    request.add_header("User-Agent", "arsnova-monitor/1")
    opener = urllib.request.build_opener(NoRedirectHandler())
    try:
        with opener.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            if not 200 <= response.status < 300:
                raise MonitorError(f"Monitoring-Heartbeat antwortet mit HTTP {response.status}.")
    except (urllib.error.URLError, TimeoutError) as error:
        raise MonitorError("Monitoring-Heartbeat konnte nicht zugestellt werden.") from error


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return empty_state()
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise MonitorError("Monitoring-Zustand ist nicht lesbar.") from error
    if not isinstance(state, dict):
        raise MonitorError("Monitoring-Zustand ist ungültig.")
    return {**empty_state(), **state}


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=path.parent,
        prefix=".state-",
        delete=False,
    ) as handle:
        json.dump(state, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
        temp_path = Path(handle.name)
    temp_path.chmod(0o600)
    temp_path.replace(path)


def positive_env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise MonitorError(f"{name} muss eine positive Ganzzahl sein.") from error
    if value <= 0:
        raise MonitorError(f"{name} muss eine positive Ganzzahl sein.")
    return value


def build_notification(
    result: dict[str, Any],
    event: str,
    instance: str,
    observed_at: str,
    test_alert: bool = False,
    resolved_alerts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "schema": "arsnova-monitoring-alert/v1",
        "instance": instance,
        "event": event,
        "level": result["level"],
        "observedAt": observed_at,
        "test": test_alert,
        "alerts": result["alerts"],
        "resolvedAlerts": resolved_alerts or [],
    }


def test_result() -> dict[str, Any]:
    return {
        "level": "warning",
        "alerts": [
            {
                "id": "monitor_test_alert",
                "label": "Synthetischer W3.7-Alarmweg-Test",
                "level": "warning",
                "observed": "requested",
                "threshold": "test-only",
            }
        ],
    }


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test-alert", action="store_true", help="Sendet einen synthetischen Alarm.")
    parser.add_argument("--dry-run", action="store_true", help="Wertet aus, sendet aber keinen Webhook.")
    return parser.parse_args(list(argv))


def run(argv: Iterable[str]) -> int:
    args = parse_args(argv)
    diagnostic_secret = os.environ.get("ADMIN_DIAGNOSTIC_SECRET", "")
    webhook_url = os.environ.get("MONITORING_WEBHOOK_URL", "")
    bearer_token = os.environ.get("MONITORING_WEBHOOK_BEARER_TOKEN") or None
    heartbeat_url = os.environ.get("MONITORING_HEARTBEAT_URL") or None
    instance = os.environ.get("MONITORING_INSTANCE", "arsnova-production")
    state_file = DEFAULT_STATE_FILE
    observed_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    if not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", instance):
        raise MonitorError(
            "MONITORING_INSTANCE darf nur A-Z, a-z, 0-9, Punkt, Unterstrich und Bindestrich enthalten."
        )
    if not args.dry_run and not webhook_url:
        raise MonitorError("MONITORING_WEBHOOK_URL fehlt.")
    if webhook_url:
        validate_https_url(webhook_url, "MONITORING_WEBHOOK_URL")
    if heartbeat_url:
        validate_https_url(heartbeat_url, "MONITORING_HEARTBEAT_URL")
    if len(diagnostic_secret) < 32:
        raise MonitorError("ADMIN_DIAGNOSTIC_SECRET fehlt oder ist kürzer als 32 Zeichen.")

    if args.test_alert:
        payload = build_notification(test_result(), "test", instance, observed_at, test_alert=True)
        if args.dry_run:
            print(json.dumps(payload, ensure_ascii=False))
        else:
            post_json(webhook_url, payload, bearer_token)
            print("W3.7-Testalarm wurde zugestellt.")
        return 0

    state_file.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    lock_path = state_file.with_suffix(".lock")
    with lock_path.open("a+", encoding="utf-8") as lock_handle:
        lock_path.chmod(0o600)
        try:
            fcntl.flock(lock_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise MonitorError("Ein anderer Monitoring-Lauf ist noch aktiv.") from error

        try:
            result = fetch_live_result(diagnostic_secret)
        except MonitorError as error:
            print(f"Monitoring-Abfrage fehlgeschlagen: {error}", file=sys.stderr)
            result = probe_failure_result()

        state = load_state(state_file)
        event, next_state, notification = notification_decision(
            state,
            result,
            int(time.time()),
            positive_env_int(
                "MONITORING_WARNING_REPEAT_SECONDS",
                DEFAULT_WARNING_REPEAT_SECONDS,
            ),
            positive_env_int(
                "MONITORING_CRITICAL_REPEAT_SECONDS",
                DEFAULT_CRITICAL_REPEAT_SECONDS,
            ),
        )

        if event is not None:
            payload = build_notification(
                notification["notificationResult"],
                event,
                instance,
                observed_at,
                resolved_alerts=notification["resolvedAlerts"],
            )
            if args.dry_run:
                print(json.dumps(payload, ensure_ascii=False))
            else:
                post_json(webhook_url, payload, bearer_token)

        if not args.dry_run:
            save_state(state_file, next_state)

    if heartbeat_url and not args.dry_run:
        ping_heartbeat(heartbeat_url)
    print(
        json.dumps(
            {
                "observedLevel": result["level"],
                "observedAlertIds": [alert["id"] for alert in result["alerts"]],
                "activeLevel": notification["notificationResult"]["level"],
                "activeAlertIds": [
                    alert["id"] for alert in notification["notificationResult"]["alerts"]
                ],
                "notification": event,
            },
            ensure_ascii=False,
        )
    )
    return 0


def main() -> int:
    try:
        return run(sys.argv[1:])
    except MonitorError as error:
        print(f"Fehler: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
