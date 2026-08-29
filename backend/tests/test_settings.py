from app.models import UserSettings
from app.services.settings import get_or_create_settings
from tests.conftest import make_account


def test_settings_defaults_and_partial_patch(client):
    acct = make_account(client)
    s = acct.get("/settings").json()
    assert s["companion"] == "sage"
    assert s["reminder_days"] == [True, True, True, True, True, False, False]
    assert s["onboarding_step"] == "name"
    assert s["updated_at"].endswith("Z")

    r = acct.patch("/settings", json={"display_name": "  Manu ", "topics": ["Work", "work", " Sleep "]})
    assert r.status_code == 200, r.text
    s2 = r.json()
    assert s2["display_name"] == "Manu"
    assert s2["topics"] == ["Work", "work", "Sleep"] or s2["topics"] == ["Work", "Sleep"]
    # untouched fields keep their values
    assert s2["companion"] == "sage"
    assert s2["reminder_time"] == "21:00"

    r = acct.patch("/settings", json={"companion": "ember", "onboarding_step": "goals"})
    assert r.status_code == 200
    assert r.json()["companion"] == "ember"
    assert r.json()["display_name"] == "Manu"
    assert r.json()["onboarding_step"] == "goals"


def test_settings_validation(client):
    acct = make_account(client)
    assert acct.patch("/settings", json={"reminder_days": [True, False]}).status_code == 422
    assert acct.patch("/settings", json={"reminder_time": "25:99"}).status_code == 422
    assert acct.patch("/settings", json={"reminder_time": "9pm"}).status_code == 422
    assert acct.patch("/settings", json={"companion": "bob"}).status_code == 422
    assert acct.patch("/settings", json={"topics": ["x"] * 13}).status_code == 422
    assert acct.patch("/settings", json={"display_name": "x" * 41}).status_code == 422
    ok = acct.patch("/settings", json={"reminder_time": "07:30", "reminder_days": [False] * 7})
    assert ok.status_code == 200
    assert ok.json()["reminder_time"] == "07:30"


def test_onboarding_complete_sets_step_done(client):
    acct = make_account(client)
    r = acct.patch("/settings", json={"onboarding_complete": True})
    assert r.status_code == 200
    assert r.json()["onboarding_complete"] is True
    assert r.json()["onboarding_step"] == "done"


def test_legacy_user_gets_name_step(client, db):
    """A verified user with no settings row (pre-migration) starts at 'name'."""
    acct = make_account(client)
    db.query(UserSettings).filter(UserSettings.user_id == acct.id).delete()
    db.commit()
    s = acct.get("/settings").json()
    assert s["onboarding_step"] == "name"
    assert s["onboarding_complete"] is False
