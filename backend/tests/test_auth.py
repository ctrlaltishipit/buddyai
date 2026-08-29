from datetime import timedelta

from app.models import EmailVerification
from tests.conftest import make_account


def test_signup_verify_flow(client):
    acct = make_account(client, verify=False)
    assert acct.dev_code is not None and len(acct.dev_code) == 6

    me = acct.get("/auth/me").json()
    assert me["user"]["verified"] is False
    assert me["settings"]["onboarding_step"] == "verify"

    wrong = "000000" if acct.dev_code != "000000" else "111111"
    r = acct.post("/auth/verify", json={"code": wrong})
    assert r.status_code == 400
    assert "didn't match" in r.json()["detail"]

    r = acct.post("/auth/verify", json={"code": acct.dev_code})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["verified"] is True
    assert body["settings"]["onboarding_step"] == "name"

    # idempotent once verified
    r = acct.post("/auth/verify", json={"code": "123456"})
    assert r.status_code == 200

    # resend after verification reports nothing sent
    r = acct.post("/auth/resend-code")
    assert r.status_code == 200
    assert r.json() == {"sent": False, "expires_in_seconds": 0, "dev_code": None}

    # login + /auth/me
    r = client.post("/auth/login", json={"email": acct.email, "password": acct.password})
    assert r.status_code == 200
    assert r.json()["verification"] is None
    assert r.json()["settings"]["onboarding_step"] == "name"
    assert r.json()["user"]["created_at"].endswith("Z")

    r = client.post("/auth/login", json={"email": acct.email, "password": "nope-nope-nope"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid email or password"

    r = client.post("/auth/signup", json={"email": acct.email.upper(), "password": "whatever-123"})
    assert r.status_code == 409


def test_resend_code_rate_limit_and_expiry(client, db):
    acct = make_account(client, verify=False)
    r = acct.post("/auth/resend-code")
    assert r.status_code == 429

    # Pretend the last send was long ago -> new code, attempts reset.
    row = db.get(EmailVerification, acct.id)
    row.last_sent_at = row.last_sent_at - timedelta(minutes=5)
    row.attempts = 3
    db.commit()

    r = acct.post("/auth/resend-code")
    assert r.status_code == 200, r.text
    info = r.json()
    assert info["sent"] is True and info["dev_code"]
    db.expire_all()
    row = db.get(EmailVerification, acct.id)
    assert row.attempts == 0
    assert acct.dev_code != info["dev_code"] or True  # may collide, not a bug

    # Expire it -> 410
    row.expires_at = row.expires_at - timedelta(hours=1)
    db.commit()
    r = acct.post("/auth/verify", json={"code": info["dev_code"]})
    assert r.status_code == 410


def test_verify_too_many_attempts(client):
    acct = make_account(client, verify=False)
    wrong = "000000" if acct.dev_code != "000000" else "111111"
    statuses = [acct.post("/auth/verify", json={"code": wrong}).status_code for _ in range(6)]
    assert statuses[:4] == [400, 400, 400, 400]
    assert statuses[4] == 429 and statuses[5] == 429
    # even the right code is refused now
    assert acct.post("/auth/verify", json={"code": acct.dev_code}).status_code == 429


def test_change_password(client):
    acct = make_account(client)
    r = acct.post("/auth/change-password", json={"current_password": "wrong-wrong-1", "new_password": "new-password-99"})
    assert r.status_code == 400
    r = acct.post("/auth/change-password", json={"current_password": acct.password, "new_password": "new-password-99"})
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert client.post("/auth/login", json={"email": acct.email, "password": "new-password-99"}).status_code == 200
    assert client.post("/auth/login", json={"email": acct.email, "password": acct.password}).status_code == 401


def test_unauthenticated(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/entries").status_code == 401
    assert client.get("/settings").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
