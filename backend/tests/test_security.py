"""JWT secret hygiene: the server must never run on a known or weak secret."""
import pytest
from jose import jwt

from app.config import MIN_SECRET_KEY_LENGTH, require_secret_key, settings
from app.security import decode_token
from tests.conftest import make_account

PLACEHOLDER = "dev-secret-change-me-in-production-this-is-only-for-local"


@pytest.mark.parametrize("value", [None, "", "   ", PLACEHOLDER, "x" * (MIN_SECRET_KEY_LENGTH - 1)])
def test_missing_or_placeholder_secret_refuses_to_boot(value):
    with pytest.raises(RuntimeError):
        require_secret_key(value)


def test_strong_secret_is_accepted():
    assert require_secret_key(" " + "k" * MIN_SECRET_KEY_LENGTH + " ") == "k" * MIN_SECRET_KEY_LENGTH


def test_token_signed_with_placeholder_is_rejected(client):
    victim = make_account(client)
    forged = jwt.encode({"sub": victim.id, "exp": 4102444800}, PLACEHOLDER, algorithm="HS256")
    assert decode_token(forged) is None
    r = client.get("/auth/me", headers={"Authorization": "Bearer %s" % forged})
    assert r.status_code == 401
    assert settings.SECRET_KEY != PLACEHOLDER
