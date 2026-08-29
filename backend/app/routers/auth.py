"""/auth/* — signup, login, me, verify, resend-code, forgot/change password, delete."""
from __future__ import annotations

import hashlib
import math
import os
import secrets
import string
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..config import settings as cfg
from ..db import get_db
from ..deps import get_current_user
from ..mailer import send_email
from ..models import EmailVerification, User, UserSettings
from ..schemas import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    OkResponse,
    SessionResponse,
    SignupRequest,
    TokenResponse,
    UserPublic,
    VerificationInfo,
    VerifyRequest,
)
from ..security import create_access_token, hash_password, verify_password
from ..services import aware, now_utc
from ..services.settings import get_or_create_settings, settings_out


router = APIRouter(prefix="/auth", tags=["auth"])


# Pool deliberately excludes ambiguous characters (0/O, 1/l/I) for clean copy-paste.
_TEMP_PW_ALPHABET = "".join(
    c for c in string.ascii_letters + string.digits if c not in "0OIl1"
)


def _make_temp_password(length: int = 12) -> str:
    return "".join(secrets.choice(_TEMP_PW_ALPHABET) for _ in range(length))


def _forgot_password_email_body(temp_pw: str) -> str:
    return (
        "Hi,\n\n"
        "Someone (hopefully you) asked Buddy to reset the password for this account.\n\n"
        "Your new temporary password is:\n\n"
        f"    {temp_pw}\n\n"
        "Sign in with it, then change it from Settings as soon as you can.\n"
        "If this wasn't you, no action is needed. Only this email received the password.\n\n"
        "Buddy\n"
    )


def _verification_email_body(code: str) -> str:
    minutes = int(cfg.VERIFICATION_TTL.total_seconds() // 60)
    return (
        "Hi,\n\n"
        "Your Buddy verification code is:\n\n"
        f"    {code}\n\n"
        f"It expires in {minutes} minutes. If you didn't sign up for Buddy, you can ignore this.\n\n"
        "Buddy\n"
    )


def _to_public(u: User) -> UserPublic:
    return UserPublic(
        id=u.id,
        email=u.email,
        verified=u.verified,
        plan_tier=u.plan_tier,
        created_at=aware(u.created_at),
    )


def _session(db: Session, user: User) -> SessionResponse:
    return SessionResponse(user=_to_public(user), settings=settings_out(get_or_create_settings(db, user)))


# ---------- verification codes ----------

def _smtp_configured() -> bool:
    return bool(os.getenv("BUDDY_SMTP_HOST"))


def _new_code() -> str:
    return "%06d" % secrets.randbelow(1_000_000)


def _hash_code(code: str) -> str:
    return hashlib.sha256((code + cfg.SECRET_KEY).encode("utf-8")).hexdigest()


def _issue_code(db: Session, user: User) -> VerificationInfo:
    """Create/replace the user's verification row and email the code.

    Does not commit — the caller owns the transaction.
    """
    code = _new_code()
    now = now_utc()
    row = db.get(EmailVerification, user.id)
    if row is None:
        row = EmailVerification(user_id=user.id)
        db.add(row)
    row.code_hash = _hash_code(code)
    row.expires_at = now + cfg.VERIFICATION_TTL
    row.attempts = 0
    row.last_sent_at = now
    send_email(to=user.email, subject="Your Buddy verification code", body=_verification_email_body(code))
    return VerificationInfo(
        sent=True,
        expires_in_seconds=int(cfg.VERIFICATION_TTL.total_seconds()),
        # Plain code ONLY when SMTP is unset (local dev). Never otherwise.
        dev_code=None if _smtp_configured() else code,
    )


# ---------- endpoints ----------

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = body.email.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password=hash_password(body.password),
        verified=False,
        plan_tier="free",
    )
    db.add(user)
    prefs = UserSettings(user_id=user.id, onboarding_step="verify")
    db.add(prefs)
    verification = _issue_code(db, user)
    db.commit()

    token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=token,
        user=_to_public(user),
        settings=settings_out(prefs),
        verification=verification,
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(subject=user.id)
    prefs = get_or_create_settings(db, user)
    return TokenResponse(access_token=token, user=_to_public(user), settings=settings_out(prefs))


@router.get("/me", response_model=SessionResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SessionResponse:
    return _session(db, user)


@router.post("/verify", response_model=SessionResponse)
def verify(
    body: VerifyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionResponse:
    row = db.get(EmailVerification, user.id)

    if user.verified:
        # Idempotent: already done. Tidy up any leftover code.
        if row is not None:
            db.delete(row)
            db.commit()
        return _session(db, user)

    if row is None:
        raise HTTPException(status_code=410, detail="Code expired. Request a new one")
    if row.attempts >= cfg.VERIFICATION_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code")
    if row.expires_at < now_utc():
        raise HTTPException(status_code=410, detail="Code expired. Request a new one")
    if not secrets.compare_digest(row.code_hash, _hash_code(body.code)):
        row.attempts += 1
        db.commit()
        if row.attempts >= cfg.VERIFICATION_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Too many attempts. Request a new code")
        raise HTTPException(status_code=400, detail="That code didn't match")

    user.verified = True
    db.delete(row)
    prefs = get_or_create_settings(db, user)
    if prefs.onboarding_step == "verify":
        prefs.onboarding_step = "name"
    db.commit()
    return _session(db, user)


@router.post("/resend-code", response_model=VerificationInfo)
def resend_code(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VerificationInfo:
    if user.verified:
        return VerificationInfo(sent=False, expires_in_seconds=0, dev_code=None)

    row = db.get(EmailVerification, user.id)
    if row is not None:
        elapsed = now_utc() - row.last_sent_at
        if elapsed < cfg.VERIFICATION_RESEND_COOLDOWN:
            wait = int(math.ceil((cfg.VERIFICATION_RESEND_COOLDOWN - elapsed).total_seconds()))
            raise HTTPException(
                status_code=429,
                detail="Please wait %d seconds before requesting another code" % max(wait, 1),
            )
    info = _issue_code(db, user)
    db.commit()
    return info


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    body: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> ForgotPasswordResponse:
    """Issue a new temp password and email it. Always 200 (no enumeration)."""
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user is not None:
        temp_pw = _make_temp_password()
        user.hashed_password = hash_password(temp_pw)
        db.add(user)
        db.commit()
        send_email(
            to=user.email,
            subject="Your new Buddy password",
            body=_forgot_password_email_body(temp_pw),
        )
    return ForgotPasswordResponse()


@router.post("/change-password", response_model=OkResponse)
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OkResponse:
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return OkResponse()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_account(
    body: DeleteAccountRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete the account and everything it owns (settings, entries, emotions)."""
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    db.delete(user)  # ON DELETE CASCADE removes every owned row
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
