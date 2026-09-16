-- Rolling-/Rollback-Bridge für alte App-Images:
-- deren Cleanup bestimmt die Löschreife weiterhin aus "startedAt" + 24h.
-- Für beendete Sessions bildet "startedAt" deshalb konservativ das Ende des
-- 14-tägigen Nachbereitungsfensters bzw. eines Legal Holds minus 24h ab.

CREATE OR REPLACE FUNCTION arsnova_bridge_session_retention_to_started_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."endedAt" IS NOT NULL THEN
    NEW."startedAt" := GREATEST(
      NEW."startedAt",
      NEW."endedAt" + INTERVAL '13 days',
      COALESCE(NEW."legalHoldUntil" - INTERVAL '24 hours', NEW."endedAt" + INTERVAL '13 days')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Session_retention_rolling_bridge" ON "Session";
CREATE TRIGGER "Session_retention_rolling_bridge"
BEFORE UPDATE ON "Session"
FOR EACH ROW
EXECUTE FUNCTION arsnova_bridge_session_retention_to_started_at();

-- Bestehende beendete Sessions müssen denselben konservativen Marker erhalten.
-- Der Lifecycle-Trigger schützt "startedAt" normalerweise gegen direkte
-- Änderungen; für dieses deterministische Backfill wird er kurz deaktiviert.
ALTER TABLE "Session" DISABLE TRIGGER "Session_enforce_lifecycle";
UPDATE "Session"
SET "startedAt" = GREATEST(
  "startedAt",
  "endedAt" + INTERVAL '13 days',
  COALESCE("legalHoldUntil" - INTERVAL '24 hours', "endedAt" + INTERVAL '13 days')
)
WHERE "endedAt" IS NOT NULL;
ALTER TABLE "Session" ENABLE TRIGGER "Session_enforce_lifecycle";

-- Auch ein altes Image kann den Sessionkern löschen. Die Datenbank minimiert
-- dann verbliebene Auditbezüge und entfernt sessiongebundene Invite-Jobs.
CREATE OR REPLACE FUNCTION arsnova_minimize_deleted_session_references()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "AdminAuditLog"
  SET
    "sessionId" = NULL,
    "sessionCode" = NULL,
    "sessionReferenceHash" = COALESCE(
      "sessionReferenceHash",
      encode(sha256(convert_to('arsnova-session-audit:' || OLD.id, 'UTF8')), 'hex')
    )
  WHERE "sessionId" = OLD.id
     OR "sessionCode" = OLD.code;

  DELETE FROM "ProductFeedbackInviteJob"
  WHERE "sessionId" = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "Session_minimize_deleted_references" ON "Session";
CREATE TRIGGER "Session_minimize_deleted_references"
AFTER DELETE ON "Session"
FOR EACH ROW
EXECUTE FUNCTION arsnova_minimize_deleted_session_references();

-- Das bisherige Image bereinigt SessionFeedback nur über eine noch vorhandene
-- Sessionrelation und kennt den neuen Admin-Audit-Cleanup nicht. Sein weiterhin
-- minütlich ausgeführtes Feedback-DELETE dient deshalb als bounded TTL-Bridge.
CREATE OR REPLACE FUNCTION arsnova_cleanup_detached_retention_records()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  DELETE FROM "SessionFeedback"
  WHERE "sessionId" IS NULL
    AND "createdAt" < timezone('UTC', statement_timestamp()) - INTERVAL '90 days';

  DELETE FROM "AdminAuditLog"
  WHERE "createdAt" < timezone('UTC', statement_timestamp()) - INTERVAL '365 days';

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "SessionFeedback_cleanup_detached_retention" ON "SessionFeedback";
CREATE TRIGGER "SessionFeedback_cleanup_detached_retention"
BEFORE DELETE ON "SessionFeedback"
FOR EACH STATEMENT
EXECUTE FUNCTION arsnova_cleanup_detached_retention_records();
