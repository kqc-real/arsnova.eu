#!/usr/bin/env python3

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

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


def result(level, *alert_ids):
    return {
        "level": level,
        "alerts": [
            {
                "id": alert_id,
                "label": alert_id,
                "level": level,
                "observed": 1,
                "threshold": 1,
            }
            for alert_id in alert_ids
        ],
    }


class EvaluationTests(unittest.TestCase):
    def evaluate(self, stats=None, health=None, public=None):
        return monitor.evaluate(
            stats or healthy_security_stats(),
            health or {"status": "ok", "redis": "ok"},
            public or {"serviceStatus": "stable"},
        )

    def test_healthy_payload_is_ok(self):
        self.assertEqual(
            self.evaluate(),
            {"level": "ok", "alerts": [], "telemetryAvailable": True},
        )

    def test_rule_thresholds_match_monitoring_runbook(self):
        expected = {
            "session_create_rate": (30, 60),
            "rate_limit_429_total": (50, 200),
            "session_code_entry_failures": (100, 500),
            "session_code_entry_soft_cap_delays": (10, 100),
            "soft_cap_utilization": (80, 95),
            "session_code_429": (30, 100),
            "pdf_rejected": (5, 20),
            "pdf_failed": (1, 3),
            "csp_dropped": (10, 100),
            "csp_rate_limited": (50, 500),
            "csp_eval": (1, 10),
            "csp_script_https": (10, 100),
            "trpc_ws_connections": (600, 800),
            "trpc_ws_rejected_upgrades": (50, 200),
            "trpc_ws_payload_rejected": (1, 10),
            "trpc_ws_rate_limited": (10, 50),
            "yjs_ws_connections": (700, 900),
            "yjs_ws_rejected_upgrades": (50, 200),
            "yjs_ws_payload_rejected": (1, 10),
            "yjs_ws_rate_limited": (10, 50),
            "yjs_ws_awareness_rejected": (1, 10),
        }
        self.assertEqual(
            {rule.alert_id: (rule.warning, rule.critical) for rule in monitor.RULES},
            expected,
        )

    def test_every_rule_uses_inclusive_warning_and_critical_boundaries(self):
        for rule in monitor.RULES:
            with self.subTest(rule=rule.alert_id, level="warning"):
                stats = healthy_security_stats()
                cursor = stats
                for segment in rule.path[:-1]:
                    cursor = cursor[segment]
                cursor[rule.path[-1]] = rule.warning
                evaluated = self.evaluate(stats=stats)
                self.assertEqual(evaluated["level"], "warning")
                self.assertEqual(evaluated["alerts"][0]["id"], rule.alert_id)

            with self.subTest(rule=rule.alert_id, level="critical"):
                stats = healthy_security_stats()
                cursor = stats
                for segment in rule.path[:-1]:
                    cursor = cursor[segment]
                cursor[rule.path[-1]] = rule.critical
                evaluated = self.evaluate(stats=stats)
                self.assertEqual(evaluated["level"], "critical")
                self.assertEqual(evaluated["alerts"][0]["id"], rule.alert_id)

    def test_pdf_capacity_without_rejection_is_not_an_alert(self):
        stats = healthy_security_stats()
        stats["pdfActiveJobs"] = stats["pdfMaxConcurrentJobs"]
        self.assertEqual(self.evaluate(stats=stats)["level"], "ok")

    def test_automatic_poll_failures_do_not_trigger_entry_alert(self):
        stats = healthy_security_stats()
        stats["sessionCodeFailuresLastMinute"] = 5_000
        stats["sessionCodeFailuresBySourceLastMinute"] = {
            "join": 0,
            "lookup": 0,
            "pollReconnect": 5_000,
            "other": 0,
        }
        self.assertEqual(self.evaluate(stats=stats)["level"], "ok")

    def test_redis_failure_is_critical_even_when_rolling_counters_are_zero(self):
        evaluated = self.evaluate(health={"status": "ok", "redis": "unavailable"})
        self.assertEqual(evaluated["level"], "critical")
        self.assertEqual(evaluated["alerts"][0]["id"], "redis_health")

    def test_database_failure_is_critical(self):
        stats = healthy_security_stats()
        stats["databaseStatus"] = "unavailable"
        evaluated = self.evaluate(stats=stats)
        self.assertEqual(evaluated["level"], "critical")
        self.assertEqual(evaluated["alerts"][0]["id"], "database_health")

    def test_limited_and_critical_service_status_are_alerted(self):
        warning = self.evaluate(public={"serviceStatus": "limited"})
        critical = self.evaluate(public={"serviceStatus": "critical"})
        self.assertEqual(warning["level"], "warning")
        self.assertEqual(critical["level"], "critical")

    def test_missing_metric_fails_closed(self):
        stats = healthy_security_stats()
        del stats["sessionCreatesLastMinute"]
        with self.assertRaises(monitor.MonitorError):
            self.evaluate(stats=stats)


class NotificationStateTests(unittest.TestCase):
    def test_warning_requires_two_consecutive_samples(self):
        state = monitor.empty_state()
        first_event, state, _ = monitor.notification_decision(
            state, result("warning", "warn"), 100
        )
        second_event, state, _ = monitor.notification_decision(
            state, result("warning", "warn"), 160
        )
        self.assertIsNone(first_event)
        self.assertEqual(second_event, "alert")
        self.assertEqual(state["activeLevel"], "warning")

    def test_critical_alert_is_immediate(self):
        event, state, _ = monitor.notification_decision(
            monitor.empty_state(), result("critical", "crit"), 100
        )
        self.assertEqual(event, "alert")
        self.assertEqual(state["activeLevel"], "critical")

    def test_recovery_requires_two_consecutive_healthy_samples(self):
        _, active, _ = monitor.notification_decision(
            monitor.empty_state(), result("critical", "crit"), 100
        )
        first_event, active, _ = monitor.notification_decision(active, result("ok"), 160)
        second_event, active, notification = monitor.notification_decision(
            active, result("ok"), 220
        )
        self.assertIsNone(first_event)
        self.assertEqual(second_event, "recovery")
        self.assertEqual(active["activeLevel"], "ok")
        self.assertEqual(
            notification["resolvedAlerts"],
            [{"id": "crit", "previousLevel": "critical"}],
        )

    def test_unchanged_critical_alert_repeats_after_interval(self):
        active_result = result("critical", "crit")
        _, state, _ = monitor.notification_decision(monitor.empty_state(), active_result, 100)
        early, state, _ = monitor.notification_decision(
            state,
            active_result,
            199,
            critical_repeat_seconds=100,
        )
        due, _, _ = monitor.notification_decision(
            state,
            active_result,
            200,
            critical_repeat_seconds=100,
        )
        self.assertIsNone(early)
        self.assertEqual(due, "repeat")

    def test_changed_warning_signature_restarts_confirmation(self):
        state = monitor.empty_state()
        _, state, _ = monitor.notification_decision(state, result("warning", "one"), 100)
        event, state, _ = monitor.notification_decision(state, result("warning", "two"), 160)
        self.assertIsNone(event)
        self.assertEqual(state["observationCounts"], {"two:warning": 1})

    def test_warning_confirmation_expires_across_monitoring_gap(self):
        state = monitor.empty_state()
        first_event, state, _ = monitor.notification_decision(
            state, result("warning", "warn"), 100
        )
        delayed_event, state, _ = monitor.notification_decision(
            state, result("warning", "warn"), 300
        )
        self.assertIsNone(first_event)
        self.assertIsNone(delayed_event)
        self.assertEqual(state["observationCounts"], {"warn:warning": 1})

    def test_recovery_confirmation_expires_across_monitoring_gap(self):
        _, state, _ = monitor.notification_decision(
            monitor.empty_state(), result("critical", "crit"), 100
        )
        first_event, state, _ = monitor.notification_decision(state, result("ok"), 160)
        delayed_event, state, notification = monitor.notification_decision(
            state, result("ok"), 400
        )
        self.assertIsNone(first_event)
        self.assertIsNone(delayed_event)
        self.assertEqual(notification["notificationResult"]["level"], "critical")
        self.assertEqual(state["observationCounts"], {"crit:ok": 1})

    def test_new_warning_is_debounced_while_critical_alert_remains_active(self):
        _, state, _ = monitor.notification_decision(
            monitor.empty_state(), result("critical", "critical-one"), 100
        )
        combined = {
            "level": "critical",
            "alerts": result("critical", "critical-one")["alerts"]
            + result("warning", "new-warning")["alerts"],
        }
        first_event, state, _ = monitor.notification_decision(state, combined, 160)
        second_event, state, notification = monitor.notification_decision(state, combined, 220)
        self.assertIsNone(first_event)
        self.assertEqual(second_event, "update")
        self.assertEqual(
            [alert["id"] for alert in notification["notificationResult"]["alerts"]],
            ["critical-one", "new-warning"],
        )

    def test_probe_failures_freeze_existing_metric_alerts(self):
        _, state, _ = monitor.notification_decision(
            monitor.empty_state(),
            result("critical", "redis_health"),
            100,
        )
        _, state, _ = monitor.notification_decision(
            state,
            monitor.probe_failure_result(),
            160,
        )
        _, state, notification = monitor.notification_decision(
            state,
            monitor.probe_failure_result(),
            220,
        )
        self.assertEqual(
            [alert["id"] for alert in notification["notificationResult"]["alerts"]],
            ["monitor_probe_failed", "redis_health"],
        )
        self.assertEqual(notification["resolvedAlerts"], [])


class PayloadAndUrlTests(unittest.TestCase):
    def test_trpc_v11_json_transport_envelope_is_unwrapped(self):
        payload = {"status": "ok", "redis": "ok"}
        self.assertEqual(
            monitor.extract_trpc_payload(
                {"result": {"data": {"json": payload}}},
                "health.check",
            ),
            payload,
        )

    def test_unwrapped_trpc_data_remains_supported(self):
        payload = {"status": "ok", "redis": "ok"}
        self.assertEqual(
            monitor.extract_trpc_payload(
                {"result": {"data": payload}},
                "health.check",
            ),
            payload,
        )

    def test_webhook_requires_https_without_embedded_credentials(self):
        with self.assertRaises(monitor.MonitorError):
            monitor.validate_https_url("http://alerts.example.test/hook", "Webhook")
        with self.assertRaises(monitor.MonitorError):
            monitor.validate_https_url("https://user:secret@example.test/hook", "Webhook")
        with self.assertRaises(monitor.MonitorError):
            monitor.validate_https_url("https://[::1", "Webhook")
        with self.assertRaises(monitor.MonitorError):
            monitor.validate_https_url("https://example.test:not-a-port/hook", "Webhook")
        self.assertEqual(
            monitor.validate_https_url("https://alerts.example.test/hook", "Webhook"),
            "https://alerts.example.test/hook",
        )

    def test_notification_contains_only_aggregate_alert_data(self):
        payload = monitor.build_notification(
            result("critical", "rate_limit_429_total"),
            "alert",
            "arsnova-production",
            "2026-07-26T14:00:00Z",
        )
        serialized = str(payload)
        self.assertNotIn("ADMIN_DIAGNOSTIC_SECRET", serialized)
        self.assertNotIn("x-admin-diagnostic-secret", serialized)
        self.assertEqual(payload["schema"], "arsnova-monitoring-alert/v1")

    def test_webhook_uses_bearer_header_without_putting_token_in_body(self):
        class Response:
            status = 204

            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

        opener = mock.Mock()
        opener.open.return_value = Response()
        with mock.patch.object(monitor.urllib.request, "build_opener", return_value=opener):
            monitor.post_json(
                "https://alerts.example.test/hook",
                {"schema": "arsnova-monitoring-alert/v1"},
                "private-token",
            )

        request = opener.open.call_args.args[0]
        self.assertEqual(request.get_header("Authorization"), "Bearer private-token")
        self.assertNotIn(b"private-token", request.data)

    def test_heartbeat_is_an_empty_https_post(self):
        class Response:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

        opener = mock.Mock()
        opener.open.return_value = Response()
        with mock.patch.object(monitor.urllib.request, "build_opener", return_value=opener):
            monitor.ping_heartbeat("https://heartbeat.example.test/id")

        request = opener.open.call_args.args[0]
        self.assertEqual(request.method, "POST")
        self.assertEqual(request.data, b"")

    def test_instance_label_is_bounded_and_machine_readable(self):
        with mock.patch.dict(
            monitor.os.environ,
            {"MONITORING_INSTANCE": "contains spaces and personal data"},
            clear=True,
        ):
            with self.assertRaises(monitor.MonitorError):
                monitor.run(["--test-alert", "--dry-run"])

    def test_diagnostic_secret_uses_backend_character_length_rule(self):
        with mock.patch.dict(
            monitor.os.environ,
            {"ADMIN_DIAGNOSTIC_SECRET": "é" * 20},
            clear=True,
        ):
            with self.assertRaisesRegex(monitor.MonitorError, "32 Zeichen"):
                monitor.run(["--test-alert", "--dry-run"])

    def test_dry_run_does_not_persist_untransmitted_alert_state(self):
        stats = healthy_security_stats()
        stats["sessionCreatesLastMinute"] = 60
        with tempfile.TemporaryDirectory() as directory:
            state_file = Path(directory) / "state.json"
            with (
                mock.patch.object(monitor, "DEFAULT_STATE_FILE", state_file),
                mock.patch.object(
                    monitor,
                    "fetch_live_result",
                    return_value=monitor.evaluate(
                        stats,
                        {"status": "ok", "redis": "ok"},
                        {"serviceStatus": "stable"},
                    ),
                ),
                mock.patch.dict(
                    monitor.os.environ,
                    {"ADMIN_DIAGNOSTIC_SECRET": "x" * 32},
                    clear=True,
                ),
            ):
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(monitor.run(["--dry-run"]), 0)
            self.assertFalse(state_file.exists())


if __name__ == "__main__":
    unittest.main()
