"""Pydantic request/response schemas — THE API CONTRACT.

Mirrored by web/src/app/lib/types.ts. Keep the two in sync.

Python 3.9 compatible: use Optional[...] / List[...] rather than `X | None`.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------- Vocabulary ----------

CompanionId = Literal["sage", "sol", "ember"]
Region = Literal["IN", "US", "OTHER"]
Tone = Literal["warm", "neutral", "brief"]
TemplateId = Literal["freeform", "cbt", "gratitude", "checkin"]
OnboardingStep = Literal["verify", "name", "companion", "goals", "reminder", "done"]
MapRange = Literal["week", "month", "all"]

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


# ---------- Auth / session ----------

class UserPublic(BaseModel):
    id: str
    email: EmailStr
    verified: bool
    plan_tier: str
    created_at: datetime


class UserSettingsOut(BaseModel):
    display_name: str = ""
    companion: CompanionId = "sage"
    topics: List[str] = Field(default_factory=list)
    reminder_time: str = "21:00"
    reminder_days: List[bool] = Field(default_factory=lambda: [True, True, True, True, True, False, False])
    reminders_enabled: bool = False
    region: Region = "IN"
    tone: Tone = "warm"
    consent_nlp: bool = True
    consent_voice: bool = False
    consent_crash: bool = False
    onboarding_step: OnboardingStep = "verify"
    onboarding_complete: bool = False
    updated_at: datetime


class SettingsPatch(BaseModel):
    """PATCH /settings — every field optional; only provided fields change."""
    display_name: Optional[str] = Field(default=None, max_length=40)
    companion: Optional[CompanionId] = None
    topics: Optional[List[str]] = None
    reminder_time: Optional[str] = None
    reminder_days: Optional[List[bool]] = None
    reminders_enabled: Optional[bool] = None
    region: Optional[Region] = None
    tone: Optional[Tone] = None
    consent_nlp: Optional[bool] = None
    consent_voice: Optional[bool] = None
    consent_crash: Optional[bool] = None
    onboarding_step: Optional[OnboardingStep] = None
    onboarding_complete: Optional[bool] = None

    @field_validator("display_name")
    @classmethod
    def _strip_name(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v is not None else v

    @field_validator("topics")
    @classmethod
    def _topics_ok(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        cleaned = [t.strip() for t in v if t and t.strip()]
        if len(cleaned) > 12:
            raise ValueError("Pick at most 12 topics")
        if any(len(t) > 40 for t in cleaned):
            raise ValueError("Topic labels must be 40 characters or fewer")
        # de-dupe, preserve order
        seen: set = set()
        out: List[str] = []
        for t in cleaned:
            if t not in seen:
                seen.add(t)
                out.append(t)
        return out

    @field_validator("reminder_time")
    @classmethod
    def _time_ok(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not _TIME_RE.match(v):
            raise ValueError("reminder_time must be HH:MM (24h)")
        return v

    @field_validator("reminder_days")
    @classmethod
    def _days_ok(cls, v: Optional[List[bool]]) -> Optional[List[bool]]:
        if v is None:
            return v
        if len(v) != 7:
            raise ValueError("reminder_days must have exactly 7 entries (Monday first)")
        return v


class SessionResponse(BaseModel):
    user: UserPublic
    settings: UserSettingsOut


class VerificationInfo(BaseModel):
    sent: bool
    expires_in_seconds: int
    # Only populated when SMTP is NOT configured (local dev). Never in prod.
    dev_code: Optional[str] = None


class TokenResponse(SessionResponse):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    verification: Optional[VerificationInfo] = None


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str


class OkResponse(BaseModel):
    ok: bool = True


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Always returns ok=True to avoid leaking which emails exist."""
    ok: bool = True
    message: str = "If an account exists for that email, we've sent it a new password."


# ---------- Journal entries ----------

class EmotionScore(BaseModel):
    emotion: str = Field(min_length=1, max_length=32)
    score: float = Field(ge=0.0, le=1.0)
    confirmed: bool = False
    source: Literal["ai", "user"] = "ai"

    @field_validator("emotion")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()


class EntryCreate(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)
    template: TemplateId = "freeform"
    emotions: List[EmotionScore] = Field(default_factory=list, max_length=8)


class EntryPatch(BaseModel):
    text: Optional[str] = Field(default=None, min_length=1, max_length=10_000)
    template: Optional[TemplateId] = None
    emotions: Optional[List[EmotionScore]] = Field(default=None, max_length=8)


class EntryOut(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
    template: TemplateId
    text: str
    word_count: int
    sentiment: float
    intensity: float
    keywords: List[str]
    is_crisis_flagged: bool
    emotions: List[EmotionScore]


class EntryList(BaseModel):
    items: List[EntryOut]
    next_cursor: Optional[str] = None
    total: int


# ---------- Insights ----------

class InsightsSummary(BaseModel):
    entries_this_week: int
    entries_today: int
    streak_days: int
    leaning: Optional[str] = None
    total_entries: int
    last_entry_at: Optional[datetime] = None


class MapBucket(BaseModel):
    key: str
    label: str


class MapSeries(BaseModel):
    emotion: str
    values: List[float]
    total: float


class MapMix(BaseModel):
    emotion: str
    pct: int


class MapCard(BaseModel):
    label: str
    value: str
    sub: str
    emotion: Optional[str] = None


class InsightsMap(BaseModel):
    range: MapRange
    range_label: str
    start: datetime
    end: datetime
    buckets: List[MapBucket]
    series: List[MapSeries]
    mix: List[MapMix]
    cards: List[MapCard]
    noticings: List[str]
    entry_count: int
    y_max: float


# ---------- Export ----------

class ExportPayload(BaseModel):
    exported_at: datetime
    user: UserPublic
    settings: UserSettingsOut
    entries: List[EntryOut]
    note: str


# ---------- Stateless analysis ----------

class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)


class AnalyzeResponse(BaseModel):
    emotions: List[EmotionScore]
    sentiment: float           # -1..1
    intensity: float           # 0..1
    keywords: List[str]
    is_crisis_flagged: bool


# ---------- Reflector ----------

class ReflectorMessage(BaseModel):
    role: Literal["user", "reflector"]
    text: str


class ReflectorRequest(BaseModel):
    history: List[ReflectorMessage] = Field(default_factory=list, max_length=40)
    user_input: str = Field(min_length=1, max_length=4_000)
    dominant_emotion: Optional[str] = None


class ReflectorResponse(BaseModel):
    turn: Literal["validate", "mirror", "ask", "crisis"]
    text: str
    redirect_to_crisis: bool = False


# ---------- Crisis ----------

class CrisisCheckRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)
    locale: str = "IN"  # IN, US, OTHER


class CrisisResource(BaseModel):
    label: str
    phone: Optional[str] = None
    text_line: Optional[str] = None
    url: Optional[str] = None
    note: Optional[str] = None


class CrisisCheckResponse(BaseModel):
    flagged: bool
    matched_phrase: Optional[str] = None
    resources: List[CrisisResource]
