"""Synthetic tests only. Opt-in PostgreSQL test server is fixed to port 54629."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("correction_tool", ROOT / "scripts/correct-development-events.py")
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


def action(source, *, changes=None, create=False):
    target_id = str(uuid.uuid4()) if create else source["id"]
    return {"key": "synthetic:" + target_id, "eventId": target_id,
            "sourceEventId": source["id"], "create": create,
            "expected": copy.deepcopy(source), "changes": changes or {"event_type": "PERSONAL"}}


class CorrectionGuardsTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix="planner-correction-test-")
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name)
        self.source = {"id": str(uuid.uuid4()), "calendar_id": str(uuid.uuid4()),
                       "event_type": "PERSONAL", "starts_at": "2026-11-12T15:00:00",
                       "ends_at": "2026-11-12T16:00:00", "payment_status": "PENDING", "received_amount": 0}
        self.plan = {"version": 1, "referenceDate": "2026-11-12", "actorUserId": str(uuid.uuid4()),
                     "actions": [action(self.source)]}

    def load(self):
        path = self.path / "plan.json"
        path.write_text(json.dumps(self.plan), encoding="utf-8")
        return tool.load_plan(path)

    def test_price_boundaries_and_invalid_durations(self):
        for minutes, expected in [(1, 50), (15, 50), (16, 70), (30, 70), (31, 90), (45, 90), (46, 120), (60, 120), (61, 180), (90, 180), (91, 250), (180, 250)]:
            self.assertEqual(tool.price_for_duration(minutes), expected)
        for invalid in [None, 0, -1, True, float("inf"), float("nan"), "30"]:
            with self.assertRaises(tool.CorrectionError):
                tool.price_for_duration(invalid)

    def test_rejects_changed_dates_and_duplicate_ids(self):
        self.plan["actions"][0]["changes"]["ends_at"] = "2026-11-12T17:00:00"
        with self.assertRaises(tool.CorrectionError): self.load()
        del self.plan["actions"][0]["changes"]["ends_at"]
        self.plan["actions"].append(copy.deepcopy(self.plan["actions"][0]))
        with self.assertRaises(tool.CorrectionError): self.load()

    def test_requires_complete_snapshots_and_simulation_reference(self):
        self.plan["actions"][0]["changes"].update(financial_simulation=True, simulation_reference_date="2026-11-13")
        with self.assertRaises(tool.CorrectionError): self.load()
        self.plan["actions"][0]["changes"]["simulation_reference_date"] = "2026-11-12"
        self.assertEqual(self.load()["referenceDate"], "2026-11-12")
        del self.plan["actions"][0]["expected"]["received_amount"]
        with self.assertRaises(tool.CorrectionError): self.load()

    def test_connection_rejects_remote_production_and_unconfirmed_profiles(self):
        path = self.path / "runtime.env"
        def config(url, profile=""):
            path.write_text(f"SPRING_DATASOURCE_URL={url}\nSPRING_DATASOURCE_USERNAME=synthetic\nSPRING_DATASOURCE_PASSWORD=fixture-only\nSPRING_PROFILES_ACTIVE={profile}\n", encoding="utf-8")
        config("jdbc:postgresql://remote.example.invalid:5432/planner_dev", "dev")
        with self.assertRaises(tool.CorrectionError): tool.connection_from_env(path, "planner_dev")
        config("jdbc:postgresql://127.0.0.1:5432/planner_prod", "dev")
        with self.assertRaises(tool.CorrectionError): tool.connection_from_env(path, "planner_prod", development=True)
        config("jdbc:postgresql://127.0.0.1:5432/planner_dev")
        with self.assertRaises(tool.CorrectionError): tool.connection_from_env(path, "planner_dev")
        connection, env = tool.connection_from_env(path, "planner_dev", development=True)
        self.assertIn("planner_dev", connection)
        self.assertNotIn("fixture-only", connection)
        self.assertEqual(env["PGPASSWORD"], "fixture-only")

    def test_rejects_private_paths_inside_repositories(self):
        with self.assertRaises(tool.CorrectionError):
            tool.private_path(ROOT / "scripts/private-plan.json", must_exist=False)

    def test_backup_digest_and_database_are_verified(self):
        backup = self.path / "synthetic.dump"; backup.write_bytes(b"synthetic-test-backup")
        manifest = {"Backup": str(backup), "Bytes": backup.stat().st_size,
                    "SHA256": tool.hashlib.sha256(backup.read_bytes()).hexdigest(), "Baseline": {"database": "planner_dev"}}
        path = self.path / "backup.json"; path.write_text(json.dumps(manifest), encoding="utf-8")
        self.assertEqual(tool.validate_backup(path, "planner_dev")["Bytes"], 21)
        with self.assertRaises(tool.CorrectionError): tool.validate_backup(path, "another_database")
        backup.write_bytes(b"changed")
        with self.assertRaises(tool.CorrectionError): tool.validate_backup(path, "planner_dev")


@unittest.skipUnless(os.environ.get("PLANNER_CORRECTION_PG_TEST") == "1", "Opt in to isolated PostgreSQL port54629")
class CorrectionPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bin = Path.home() / "postgres-local/pgsql/bin"
        cls.database = "planner_correction_tool_test_" + uuid.uuid4().hex[:10]
        cls.connection = ["-h", "127.0.0.1", "-p", "54629", "-U", "planner_test", "-d", cls.database]
        cls.env = os.environ.copy(); cls.env["PGCLIENTENCODING"] = "UTF8"; cls.env.pop("PGPASSWORD", None)
        subprocess.run([str(cls.bin / "createdb.exe"), "-h", "127.0.0.1", "-p", "54629", "-U", "planner_test", "-w", cls.database], check=True, capture_output=True, env=cls.env)
        migrations = sorted((ROOT / "backend/src/main/resources/db/migration").glob("V*__*.sql"), key=lambda p: int(p.name[1:].split("__")[0]))
        cls.sql("\n".join(path.read_text(encoding="utf-8-sig") for path in migrations))

    @classmethod
    def sql(cls, sql):
        result = subprocess.run([str(cls.bin / "psql.exe"), "-X", "-qAt", "-w", "-v", "ON_ERROR_STOP=1", *cls.connection], input=sql, encoding="utf-8", capture_output=True, env=cls.env)
        if result.returncode: raise AssertionError(result.stderr[:1200])
        return result.stdout.strip()

    def setUp(self):
        self.admin, self.user, self.calendar, self.source_id = [str(uuid.uuid4()) for _ in range(4)]
        self.sql(f"""TRUNCATE users CASCADE;
INSERT INTO users(id,full_name,email,password_hash,role,active) VALUES
('{self.admin}','Synthetic administrator','admin@example.invalid','test-only','ADMIN',TRUE),
('{self.user}','Synthetic member','member@example.invalid','test-only','USER',TRUE);
INSERT INTO calendars(id,name,owner_user_id,calendar_type,created_by_user_id) VALUES('{self.calendar}','Synthetic personal','{self.user}','PERSONAL','{self.admin}');
INSERT INTO calendar_members(id,calendar_id,user_id,member_role) VALUES(gen_random_uuid(),'{self.calendar}','{self.user}','ADMIN');
INSERT INTO calendar_member_roles(member_id,role) SELECT id,'ADMIN' FROM calendar_members;
INSERT INTO events(id,calendar_id,created_by_user_id,event_type,status,title,starts_at,ends_at,external_source,person_name)
VALUES('{self.source_id}','{self.calendar}','{self.admin}','PERSONAL','SCHEDULED','Synthetic appointment','2026-11-12T15:00','2026-11-12T16:00','GOOGLE_ICS','Synthetic member');""")
        self.source = json.loads(self.sql(f"SELECT to_jsonb(e) FROM events e WHERE id='{self.source_id}';"))
        self.plan = {"version": 1, "referenceDate": "2026-11-12", "actorUserId": self.admin, "actions": []}

    def run_plan(self, *, apply=True):
        return tool.execute_sql(self.bin / "psql.exe", self.connection, self.env, tool.build_sql(self.plan, apply=apply))

    def test_preview_clone_original_update_idempotence_and_later_user_edit(self):
        shared = str(uuid.uuid4())
        self.plan["sharedCalendar"] = {"id": shared, "name": "Synthetic shared", "ownerId": self.user, "memberIds": [self.user, self.admin]}
        update = action(self.source, changes={"calendar_id": shared, "event_type": "SHARED", "title": "Shared projection"})
        clone = action(self.source, create=True, changes={"title": "Personal projection"})
        # Update first deliberately exercises clone from ORIGINAL snapshot, not changed source.
        self.plan["actions"] = [update, clone]
        preview = self.run_plan(apply=False)
        self.assertEqual((preview["updates"], preview["creates"]), (1, 1))
        self.assertEqual(self.sql("SELECT count(*) FROM events"), "1")
        self.assertEqual(self.sql(f"SELECT count(*) FROM calendars WHERE id='{shared}'"), "0")
        applied = self.run_plan(); self.assertEqual(applied["requested"], 2)
        clone_state = json.loads(self.sql(f"SELECT to_jsonb(e) FROM events e WHERE id='{clone['eventId']}'"))
        self.assertEqual(clone_state["calendar_id"], self.calendar)
        self.assertEqual(clone_state["starts_at"], self.source["starts_at"])
        self.assertEqual(clone_state["ends_at"], self.source["ends_at"])
        self.assertEqual(self.sql("SELECT count(*) FROM development_event_corrections"), "2")
        self.assertEqual(self.sql("SELECT count(*) FROM event_approvals"), "0")
        repeated = self.run_plan(); self.assertEqual(repeated["alreadyApplied"], 2)
        self.assertEqual(self.sql("SELECT count(*) FROM events"), "2")
        self.sql(f"UPDATE events SET title='Later legitimate edit' WHERE id='{clone['eventId']}'")
        repeat_after_edit = self.run_plan(); self.assertEqual(repeat_after_edit["modifiedSkipped"], 1)
        self.assertEqual(self.sql(f"SELECT title FROM events WHERE id='{clone['eventId']}'"), "Later legitimate edit")

    def test_changed_snapshot_rolls_back_every_action_and_calendar(self):
        good = action(self.source, create=True, changes={"title": "Never persisted"})
        bad = action(self.source, changes={"event_type": "SHARED"}); bad["expected"]["title"] = "Not the current title"
        self.plan["actions"] = [good, bad]
        with self.assertRaisesRegex(tool.CorrectionError, "snapshot changed"):
            self.run_plan()
        self.assertEqual(self.sql("SELECT count(*) FROM events"), "1")
        self.assertEqual(self.sql("SELECT count(*) FROM development_event_corrections"), "0")
        self.assertEqual(self.sql("SELECT count(*) FROM audit_logs"), "0")

    def test_paid_simulation_preserves_identity_and_is_not_double_counted(self):
        self.plan["actions"] = [action(self.source, changes={"event_type": "CLIENT", "client_name": "Synthetic client", "person_name": None,
            "work_description": "Synthetic service", "amount": 120, "received_amount": 120, "payment_status": "PAID", "payment_method": "PIX",
            "paid_at": "2026-11-12T23:59:59", "confirmation_status": "PENDING_CONFIRMATION", "financial_simulation": True, "simulation_reference_date": "2026-11-12"})]
        result = self.run_plan(); self.assertEqual(result["updates"], 1)
        self.run_plan()
        total = json.loads(self.sql("SELECT json_build_object('amount',sum(amount),'received',sum(received_amount),'count',count(*),'id',min(id::text)) FROM events"))
        self.assertEqual(total, {"amount": 120, "received": 120, "count": 1, "id": self.source_id})

    def test_preview_v10_without_ledger_or_simulation_columns(self):
        self.sql("DROP TABLE development_event_corrections; ALTER TABLE events DROP CONSTRAINT ck_events_simulation_reference; ALTER TABLE events DROP COLUMN financial_simulation; ALTER TABLE events DROP COLUMN simulation_reference_date;")
        try:
            old_source = {key: value for key, value in self.source.items() if key not in {"financial_simulation", "simulation_reference_date"}}
            self.plan["actions"] = [action(old_source, changes={"title": "Preview only"})]
            result = self.run_plan(apply=False)
            self.assertEqual(result["mode"], "preview")
            self.assertEqual(result["updates"], 1)
            self.assertEqual(self.sql(f"SELECT title FROM events WHERE id='{self.source_id}'"), "Synthetic appointment")
            with self.assertRaisesRegex(tool.CorrectionError, "V12 is required"):
                self.run_plan()
        finally:
            self.sql((ROOT / "backend/src/main/resources/db/migration/V12__development_correction_provenance.sql").read_text(encoding="utf-8-sig"))


if __name__ == "__main__":
    unittest.main()
