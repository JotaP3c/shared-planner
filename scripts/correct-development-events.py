#!/usr/bin/env python3
"""Apply an explicit private correction plan to local development, never infer owners.

Preview is the default. All mutations, audit entries and provenance records commit
in one transaction only after every source snapshot has been checked. Credentials
are passed to psql in its environment; SQL and private plan contents are not logged.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

REPOSITORIES = tuple(Path(p).resolve() for p in (
    r"C:\git\shared-planner", r"C:\git\shared-planner-backend",
    r"C:\git\shared-planner-frontend",
))
ALLOWED_CHANGES = frozenset({
    "calendar_id", "event_type", "title", "client_name", "person_name",
    "description", "work_description", "amount", "status", "payment_status",
    "payment_method", "received_amount", "paid_at", "confirmation_status",
    "financial_simulation", "simulation_reference_date", "client_phone",
})
PAYMENT_METHODS = {"CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD", "BANK_TRANSFER", "MERCADO_PAGO", "OTHER"}


class CorrectionError(Exception):
    """An expected validation/operation failure safe to show without private data."""


def private_path(value: str | Path, *, must_exist: bool = True) -> Path:
    path = Path(value).expanduser().resolve()
    if any(path == repo or path.is_relative_to(repo) for repo in REPOSITORIES):
        raise CorrectionError("Private plans, configuration, backups and reports must stay outside Git repositories.")
    if must_exist and not path.is_file():
        raise CorrectionError("A required private file was not found.")
    return path


def price_for_duration(minutes: float) -> int:
    if isinstance(minutes, bool) or not isinstance(minutes, (int, float)) or not math.isfinite(minutes) or minutes <= 0:
        raise CorrectionError("A positive original duration is required; no duration is invented.")
    for limit, price in ((15, 50), (30, 70), (45, 90), (60, 120), (90, 180)):
        if minutes <= limit:
            return price
    return 250


def valid_uuid(value: object) -> str:
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise CorrectionError("An invalid UUID was supplied in the correction plan.") from exc


def load_plan(path: Path) -> dict:
    try:
        plan = json.loads(path.read_text(encoding="utf-8-sig"))
        if plan.get("version") != 1:
            raise CorrectionError("Only correction plan version 1 is supported.")
        dt.date.fromisoformat(plan["referenceDate"])
        valid_uuid(plan["actorUserId"])
        actions = plan["actions"]
        if not isinstance(actions, list) or not 1 <= len(actions) <= 500:
            raise CorrectionError("A correction plan requires between 1 and 500 explicit actions.")
        keys, ids = set(), set()
        for action in actions:
            key = action["key"]
            if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,180}", key) or key in keys:
                raise CorrectionError("Correction keys must be unique, stable identifiers of at most 180 characters.")
            keys.add(key)
            event_id = valid_uuid(action["eventId"])
            source_id = valid_uuid(action["sourceEventId"])
            if event_id in ids:
                raise CorrectionError("Each target event may appear only once in a plan.")
            ids.add(event_id)
            if type(action.get("create")) is not bool or not isinstance(action.get("expected"), dict):
                raise CorrectionError("Each action requires an explicit create flag and source snapshot.")
            if not action["create"] and event_id != source_id:
                raise CorrectionError("An update must retain its original event ID.")
            if action["create"] and event_id == source_id:
                raise CorrectionError("A derived event requires a separate explicit ID.")
            expected = action["expected"]
            for required in ("id", "calendar_id", "event_type", "starts_at", "ends_at", "payment_status", "received_amount"):
                if required not in expected:
                    raise CorrectionError("The source snapshot is incomplete.")
            if valid_uuid(expected["id"]) != source_id:
                raise CorrectionError("The source snapshot does not identify the planned source.")
            if dt.datetime.fromisoformat(expected["ends_at"]) <= dt.datetime.fromisoformat(expected["starts_at"]):
                raise CorrectionError("The source interval must be positive.")
            changes = action.get("changes")
            if not isinstance(changes, dict) or not changes or set(changes) - ALLOWED_CHANGES:
                raise CorrectionError("An action contains unsupported changes; IDs, dates and source UIDs are immutable.")
            if "calendar_id" in changes:
                valid_uuid(changes["calendar_id"])
            if changes.get("event_type", expected["event_type"]) not in {"CLIENT", "PERSONAL", "SHARED"}:
                raise CorrectionError("Unsupported event type.")
            for field in ("amount", "received_amount"):
                value = changes.get(field)
                if value is not None and (isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or value < 0):
                    raise CorrectionError("Financial values must be finite nonnegative numbers.")
            if changes.get("financial_simulation"):
                if changes.get("simulation_reference_date") != plan["referenceDate"]:
                    raise CorrectionError("Every simulated value must have the frozen reference date.")
            if changes.get("payment_method") is not None and changes["payment_method"] not in PAYMENT_METHODS:
                raise CorrectionError("Unsupported payment method.")
        shared = plan.get("sharedCalendar")
        if shared:
            valid_uuid(shared["id"]); owner = valid_uuid(shared["ownerId"])
            members = [valid_uuid(item) for item in shared["memberIds"]]
            if owner not in members or len(members) != len(set(members)) or len(members) < 2:
                raise CorrectionError("The shared calendar needs its owner and explicit distinct participants.")
            if not isinstance(shared["name"], str) or not shared["name"].strip() or len(shared["name"]) > 120:
                raise CorrectionError("An explicit shared calendar name of at most 120 characters is required.")
        return plan
    except CorrectionError:
        raise
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise CorrectionError("The private correction plan is invalid or incomplete.") from exc


def connection_from_env(path: Path, expected_database: str, *, development: bool = False) -> tuple[list[str], dict]:
    config = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        match = re.fullmatch(r"\s*([A-Z0-9_]+)=(.*)", line)
        if match:
            config[match[1]] = match[2].strip().strip('"').strip("'")
    match = re.fullmatch(r"jdbc:postgresql://(?:localhost|127\.0\.0\.1):(\d+)/([A-Za-z0-9_]+)", config.get("SPRING_DATASOURCE_URL", ""))
    if not match or not re.fullmatch(r"[A-Za-z0-9_]+", expected_database) or match[2] != expected_database:
        raise CorrectionError("The connection must be explicit local PostgreSQL and match the confirmed database.")
    profile = config.get("SPRING_PROFILES_ACTIVE", "").lower()
    if re.search(r"prod|prd", expected_database, re.I) or re.search(r"prod|prd", profile):
        raise CorrectionError("Production environments are not allowed.")
    if not development and profile not in {"dev", "development", "local", "test"}:
        raise CorrectionError("Declare a development profile or pass --development for the confirmed local environment.")
    user = config.get("SPRING_DATASOURCE_USERNAME", "")
    if not user:
        raise CorrectionError("The private runtime configuration does not contain a database user.")
    env = os.environ.copy()
    env["PGPASSWORD"] = config.get("SPRING_DATASOURCE_PASSWORD", "")
    env["PGCLIENTENCODING"] = "UTF8"
    return ["-h", "127.0.0.1", "-p", match[1], "-U", user, "-d", expected_database], env


def validate_backup(path: Path, expected_database: str) -> dict:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8-sig"))
        backup = private_path(manifest["Backup"])
        with backup.open("rb") as source:
            actual = hashlib.file_digest(source, "sha256").hexdigest()
        if actual.lower() != manifest["SHA256"].lower() or backup.stat().st_size != manifest["Bytes"] or backup.stat().st_size <= 0:
            raise CorrectionError("The backup file does not match its manifest.")
        if manifest["Baseline"]["database"] != expected_database:
            raise CorrectionError("The backup belongs to a different database.")
        return manifest
    except CorrectionError:
        raise
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise CorrectionError("A verifiable private backup manifest is required before applying corrections.") from exc


def build_sql(plan: dict, *, apply: bool, baseline_events: int | None = None) -> str:
    payload = base64.b64encode(json.dumps(plan, ensure_ascii=False, allow_nan=False).encode("utf-8")).decode("ascii")
    # Only fixed SQL and base64 (no quotes or control characters) are interpolated.
    applying = "TRUE" if apply else "FALSE"
    baseline = "NULL" if baseline_events is None else str(int(baseline_events))
    update_columns = ", ".join(f"{column}=p.{column}" for column in sorted(ALLOWED_CHANGES))
    return f"""
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='90s';
CREATE TEMP TABLE correction_results (action_key text, event_id uuid, result text) ON COMMIT DROP;
CREATE TEMP TABLE correction_sources (event_id uuid PRIMARY KEY, snapshot jsonb) ON COMMIT DROP;
DO $correction$
DECLARE
  plan jsonb := convert_from(decode('{payload}','base64'),'UTF8')::jsonb;
  applying boolean := {applying};
  action jsonb; shared jsonb; source jsonb; target jsonb; prior jsonb; current_state jsonb;
  actor uuid := (plan->>'actorUserId')::uuid; member_id uuid; member_user uuid;
  ledger_exists boolean := to_regclass('development_event_corrections') IS NOT NULL;
  source_id uuid; target_id uuid; result_count bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('shared-planner:development-corrections'));
  IF applying AND NOT ledger_exists THEN RAISE EXCEPTION 'V12 is required before applying corrections'; END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND active AND role='ADMIN') THEN
    RAISE EXCEPTION 'The correction actor must be an active system administrator';
  END IF;
  IF applying AND {baseline} IS NOT NULL AND (SELECT count(*) FROM events) <> {baseline} THEN
    -- Repeats can legitimately have the derived records already present.
    IF NOT EXISTS(SELECT 1 FROM development_event_corrections WHERE correction_key=plan->'actions'->0->>'key') THEN
      RAISE EXCEPTION 'The database event count changed after the backup';
    END IF;
  END IF;
  -- Lock every source before preflight, and retain its original snapshot for clones.
  FOR source_id IN SELECT DISTINCT (value->>'sourceEventId')::uuid FROM jsonb_array_elements(plan->'actions') ORDER BY 1 LOOP
    IF applying THEN
      SELECT to_jsonb(e) INTO source FROM events e WHERE e.id=source_id FOR UPDATE;
    ELSE
      SELECT to_jsonb(e) INTO source FROM events e WHERE e.id=source_id;
    END IF;
    IF source IS NULL THEN RAISE EXCEPTION 'A planned source event was not found'; END IF;
    INSERT INTO correction_sources VALUES(source_id, source);
  END LOOP;
  FOR action IN SELECT value FROM jsonb_array_elements(plan->'actions') LOOP
    target_id := (action->>'eventId')::uuid; source_id := (action->>'sourceEventId')::uuid; prior := NULL;
    IF ledger_exists THEN
      EXECUTE 'SELECT to_jsonb(l) FROM development_event_corrections l WHERE correction_key=$1'
      INTO prior USING action->>'key';
    END IF;
    IF prior IS NOT NULL THEN
      IF (prior->>'event_id')::uuid<>target_id OR (prior->>'source_event_id')::uuid<>source_id THEN
        RAISE EXCEPTION 'A correction key is already associated with another event';
      END IF;
      SELECT to_jsonb(e) INTO current_state FROM events e WHERE id=target_id;
      INSERT INTO correction_results VALUES(action->>'key',target_id,
        CASE WHEN current_state=prior->'applied_state' THEN 'alreadyApplied' ELSE 'modifiedSkipped' END);
      CONTINUE;
    END IF;
    SELECT snapshot INTO source FROM correction_sources WHERE event_id=source_id;
    IF NOT (source @> (action->'expected')) THEN RAISE EXCEPTION 'A source snapshot changed; no corrections were applied'; END IF;
    IF action ? 'originUid' AND NOT EXISTS(SELECT 1 FROM imported_calendar_events
        WHERE event_id=source_id AND external_uid=action->>'originUid') THEN
      RAISE EXCEPTION 'The planned external UID does not match the source event';
    END IF;
    IF (action->>'create')::boolean AND EXISTS(SELECT 1 FROM events WHERE id=target_id) THEN
      RAISE EXCEPTION 'A derived event ID already exists without matching provenance';
    END IF;
    target := source || (action->'changes');
    IF NOT EXISTS(SELECT 1 FROM calendars WHERE id=(target->>'calendar_id')::uuid)
       AND NOT coalesce((target->>'calendar_id')=(plan->'sharedCalendar'->>'id'),FALSE) THEN
      RAISE EXCEPTION 'A planned target calendar was not found';
    END IF;
    IF target->>'event_type' <> 'CLIENT' AND
       (coalesce((source->>'received_amount')::numeric,0)>0 OR source->>'event_type'='CLIENT' AND source->'amount'<>'null'::jsonb) THEN
      RAISE EXCEPTION 'Converting an existing financial record requires a separate reviewed operation';
    END IF;
    IF (target->>'calendar_id')::uuid <> (source->>'calendar_id')::uuid OR (action->>'create')::boolean THEN
      IF EXISTS(SELECT 1 FROM event_approvals WHERE event_id=source_id) OR coalesce((source->>'approval_round')::int,0)>0 THEN
        RAISE EXCEPTION 'Events with approval history require a separate reviewed move';
      END IF;
      IF EXISTS(SELECT 1 FROM series_occurrences WHERE event_id=source_id) THEN
        RAISE EXCEPTION 'Moving or deriving a recurrence requires a separate reviewed series plan';
      END IF;
    END IF;
    IF target->>'event_type'='CLIENT' THEN
      IF target->'amount'='null'::jsonb OR (target->>'amount')::numeric<0 OR (target->>'received_amount')::numeric<0
          OR (target->>'received_amount')::numeric>(target->>'amount')::numeric THEN
        RAISE EXCEPTION 'Invalid client financial state';
      END IF;
      IF target->>'payment_status'='PAID' AND ((target->>'received_amount')::numeric<>(target->>'amount')::numeric OR target->'payment_method'='null'::jsonb) THEN
        RAISE EXCEPTION 'A paid client requires its exact amount and a payment method';
      END IF;
      IF target->>'payment_status'='PENDING' AND ((target->>'received_amount')::numeric<>0 OR target->'paid_at'<>'null'::jsonb) THEN
        RAISE EXCEPTION 'A pending client cannot have a received amount or payment date';
      END IF;
    END IF;
    INSERT INTO correction_results VALUES(action->>'key',target_id,CASE WHEN (action->>'create')::boolean THEN 'create' ELSE 'update' END);
  END LOOP;
  shared := plan->'sharedCalendar';
  IF shared IS NOT NULL AND shared<>'null'::jsonb THEN
    IF EXISTS(SELECT 1 FROM calendars WHERE id=(shared->>'id')::uuid) THEN
      IF NOT EXISTS(SELECT 1 FROM calendars WHERE id=(shared->>'id')::uuid AND calendar_type='SHARED'
          AND owner_user_id=(shared->>'ownerId')::uuid AND name=shared->>'name') THEN
        RAISE EXCEPTION 'The planned shared calendar ID is in use by another calendar';
      END IF;
      FOR member_user IN SELECT value::uuid FROM jsonb_array_elements_text(shared->'memberIds') LOOP
        IF NOT EXISTS(SELECT 1 FROM calendar_members m JOIN calendar_member_roles r ON r.member_id=m.id
            WHERE m.calendar_id=(shared->>'id')::uuid AND m.user_id=member_user AND r.role='ADMIN') THEN
          RAISE EXCEPTION 'An existing shared calendar has unexpected memberships';
        END IF;
      END LOOP;
    ELSE
      FOR member_user IN SELECT value::uuid FROM jsonb_array_elements_text(shared->'memberIds') LOOP
        IF NOT EXISTS(SELECT 1 FROM users WHERE id=member_user AND active) THEN RAISE EXCEPTION 'A shared participant is not active'; END IF;
      END LOOP;
      IF applying THEN
        INSERT INTO calendars(id,name,owner_user_id,calendar_type,created_by_user_id,created_at)
          VALUES((shared->>'id')::uuid,shared->>'name',(shared->>'ownerId')::uuid,'SHARED',actor,CURRENT_TIMESTAMP);
        FOR member_user IN SELECT value::uuid FROM jsonb_array_elements_text(shared->'memberIds') LOOP
          member_id := gen_random_uuid();
          INSERT INTO calendar_members(id,calendar_id,user_id,member_role,created_by_user_id,created_at)
            VALUES(member_id,(shared->>'id')::uuid,member_user,'ADMIN',actor,CURRENT_TIMESTAMP);
          INSERT INTO calendar_member_roles(member_id,role) VALUES(member_id,'ADMIN');
        END LOOP;
        INSERT INTO audit_logs(id,entity_type,entity_id,calendar_id,action,summary,old_value,new_value,performed_by_user_id,performed_at)
          VALUES(gen_random_uuid(),'CALENDAR',(shared->>'id')::uuid,(shared->>'id')::uuid,'CREATED',
            'Shared calendar created by explicit development correction plan',NULL,shared::text,actor,CURRENT_TIMESTAMP);
      END IF;
    END IF;
  END IF;
  IF applying THEN
    FOR action IN SELECT value FROM jsonb_array_elements(plan->'actions') LOOP
      IF EXISTS(SELECT 1 FROM correction_results WHERE action_key=action->>'key' AND result IN('alreadyApplied','modifiedSkipped')) THEN CONTINUE; END IF;
      source_id := (action->>'sourceEventId')::uuid; target_id := (action->>'eventId')::uuid;
      SELECT snapshot INTO source FROM correction_sources WHERE event_id=source_id;
      target := source || (action->'changes') || jsonb_build_object('id',target_id,'updated_at',CURRENT_TIMESTAMP::timestamp,'updated_by_user_id',actor);
      IF (action->>'create')::boolean THEN
        target := target || jsonb_build_object('created_at',CURRENT_TIMESTAMP::timestamp,'created_by_user_id',actor);
        INSERT INTO events SELECT (jsonb_populate_record(NULL::events,target)).*;
      ELSE
        UPDATE events e SET {update_columns}, updated_at=p.updated_at, updated_by_user_id=p.updated_by_user_id
          FROM jsonb_populate_record(NULL::events,target) p WHERE e.id=target_id;
      END IF;
      SELECT to_jsonb(e) INTO current_state FROM events e WHERE e.id=target_id;
      INSERT INTO development_event_corrections(correction_key,event_id,source_event_id,previous_state,applied_state,reference_date)
        VALUES(action->>'key',target_id,source_id,source,current_state,(plan->>'referenceDate')::date);
      INSERT INTO audit_logs(id,entity_type,entity_id,calendar_id,action,summary,old_value,new_value,performed_by_user_id,performed_at)
        VALUES(gen_random_uuid(),'EVENT',target_id,(current_state->>'calendar_id')::uuid,'UPDATED',
          CASE WHEN (action->>'create')::boolean THEN 'Derived event created by explicit development correction plan'
            ELSE 'Event corrected by explicit development correction plan' END,
          source::text,current_state::text,actor,CURRENT_TIMESTAMP);
    END LOOP;
  END IF;
END $correction$;
SELECT json_build_object(
  'mode',CASE WHEN {applying} THEN 'applied' ELSE 'preview' END,
  'database',current_database(),
  'requested',(SELECT count(*) FROM correction_results),
  'updates',(SELECT count(*) FROM correction_results WHERE result='update'),
  'creates',(SELECT count(*) FROM correction_results WHERE result='create'),
  'alreadyApplied',(SELECT count(*) FROM correction_results WHERE result='alreadyApplied'),
  'modifiedSkipped',(SELECT count(*) FROM correction_results WHERE result='modifiedSkipped'),
  'actions',(SELECT json_agg(row_to_json(r) ORDER BY action_key) FROM correction_results r));
{"COMMIT" if apply else "ROLLBACK"};
"""


def execute_sql(psql: Path, connection: list[str], env: dict, sql: str) -> dict:
    try:
        result = subprocess.run([str(psql), "-X", "-q", "-A", "-t", "-w", "-v", "ON_ERROR_STOP=1", *connection],
                                input=sql, encoding="utf-8", capture_output=True, env=env, timeout=120)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise CorrectionError("The local PostgreSQL operation could not finish; inspect the local service before retrying.") from exc
    if result.returncode:
        # PostgreSQL CONTEXT may include the private payload; never print it.
        message = next((line.split("ERROR:", 1)[1].strip() for line in result.stderr.splitlines() if "ERROR:" in line), "Local PostgreSQL validation failed")
        safe = message if not re.search(r"password|jdbc|decode\(|base64", message, re.I) else "Local PostgreSQL validation failed"
        raise CorrectionError(f"Transaction rolled back: {safe[:240]}")
    try:
        return json.loads(result.stdout.strip())
    except ValueError as exc:
        raise CorrectionError("The PostgreSQL result was not valid JSON; verify the private operation status before retrying.") from exc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--env-file", required=True)
    parser.add_argument("--expected-database", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--development", action="store_true", help="Confirm this loopback database is the authorized development environment.")
    parser.add_argument("--backup-manifest")
    parser.add_argument("--postgres-bin", default=str(Path.home() / "postgres-local/pgsql/bin"))
    args = parser.parse_args(argv)
    try:
        plan_path = private_path(args.plan); env_path = private_path(args.env_file)
        report_path = private_path(args.report, must_exist=False)
        if report_path.exists():
            raise CorrectionError("Use a new private report path; existing evidence is not overwritten.")
        plan = load_plan(plan_path)
        connection, env = connection_from_env(env_path, args.expected_database, development=args.development)
        manifest = None
        if args.apply:
            if not args.backup_manifest:
                raise CorrectionError("--apply requires a verifiable --backup-manifest.")
            manifest = validate_backup(private_path(args.backup_manifest), args.expected_database)
        sql = build_sql(plan, apply=args.apply, baseline_events=manifest.get("Baseline", {}).get("events") if manifest else None)
        report = execute_sql(Path(args.postgres_bin) / ("psql.exe" if os.name == "nt" else "psql"), connection, env, sql)
        report["planSha256"] = hashlib.sha256(plan_path.read_bytes()).hexdigest()
        report["referenceDate"] = plan["referenceDate"]
        report["reportedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
        if manifest:
            report["backupSha256"] = manifest["SHA256"]
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with report_path.open("x", encoding="utf-8") as output:
            json.dump(report, output, ensure_ascii=False, indent=2)
        print(json.dumps({key: value for key, value in report.items() if key != "actions"}, ensure_ascii=True))
        return 0
    except CorrectionError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
