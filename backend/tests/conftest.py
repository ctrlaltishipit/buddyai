"""Test harness: isolated SQLite file per session, TestClient over the real app.

BUDDY_DATABASE_URL is set BEFORE `app` is imported so the engine never points
at the developer's buddy.db.
"""
import os
import tempfile
import uuid

_TMP = tempfile.mkdtemp(prefix="buddy-test-")
os.environ["BUDDY_DATABASE_URL"] = "sqlite:///%s/test.db" % _TMP
os.environ.pop("BUDDY_SMTP_HOST", None)  # dev_code must be present in tests
os.environ["BUDDY_SECRET_KEY"] = "test-only-secret-" + uuid.uuid4().hex  # never the placeholder

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.db import SessionLocal, init_db  # noqa: E402


init_db()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


class Account:
    """A signed-up (optionally verified) user with auth headers."""

    def __init__(self, client: TestClient, email: str, password: str, data: dict):
        self.client = client
        self.email = email
        self.password = password
        self.token = data["access_token"]
        self.id = data["user"]["id"]
        self.dev_code = (data.get("verification") or {}).get("dev_code")

    @property
    def headers(self) -> dict:
        return {"Authorization": "Bearer %s" % self.token}

    def get(self, path, **kw):
        return self.client.get(path, headers=self.headers, **kw)

    def post(self, path, json=None, **kw):
        return self.client.post(path, json=json, headers=self.headers, **kw)

    def patch(self, path, json=None, **kw):
        return self.client.patch(path, json=json, headers=self.headers, **kw)

    def delete(self, path, **kw):
        return self.client.request("DELETE", path, headers=self.headers, **kw)


def make_account(client: TestClient, verify: bool = True, prefix: str = "u") -> Account:
    email = "%s-%s@example.com" % (prefix, uuid.uuid4().hex[:10])
    password = "correct-horse-battery"
    r = client.post("/auth/signup", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    acct = Account(client, email, password, r.json())
    if verify:
        v = acct.post("/auth/verify", json={"code": acct.dev_code})
        assert v.status_code == 200, v.text
    return acct


@pytest.fixture()
def account(client):
    return make_account(client)
