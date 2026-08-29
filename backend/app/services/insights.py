"""Insights: summary numbers and the emotion map.

Everything here is computed from THIS user's rows only (every query filters
by user_id) and every sentence is rule-based and derived from the data —
nothing is fabricated, nothing is diagnostic.

"Local day" = (created_at UTC + tz_offset minutes).date().
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from ..models import EntryEmotion, JournalEntry
from ..schemas import (
    InsightsMap,
    InsightsSummary,
    MapBucket,
    MapCard,
    MapMix,
    MapSeries,
)
from . import aware, local_date, now_utc

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
POSITIVE_EMOTIONS = {"joy", "gratitude", "love", "hope", "calm", "pride", "contentment", "peace"}
RANGE_LABELS = {"week": "this week", "month": "this month", "all": "all time"}
MIN_ENTRIES_FOR_NOTICINGS = 3
NO_DATA_SUB = "Write an entry to see this."


# ---------- time helpers ----------

def _day_start_utc(d: date, tz_offset: int) -> datetime:
    """Naive-UTC instant at which local day `d` begins."""
    return datetime.combine(d, time.min) - timedelta(minutes=tz_offset)


def _fmt_day(d: date) -> str:
    return "%s %d" % (d.strftime("%b"), d.day)


def _time_band(dt_local: datetime) -> str:
    h = dt_local.hour
    if h < 5:
        return "night"
    if h < 12:
        return "morning"
    if h < 17:
        return "afternoon"
    if h < 21:
        return "evening"
    return "night"


def _band_plural(band: str) -> str:
    return {"morning": "Mornings", "afternoon": "Afternoons", "evening": "Evenings", "night": "Nights"}[band]


def _hour_label(h: int) -> str:
    h = h % 24
    suffix = "AM" if h < 12 else "PM"
    h12 = h % 12 or 12
    return "%d %s" % (h12, suffix)


def _two_hour_band_label(start_hour: int) -> str:
    end_hour = (start_hour + 2) % 24
    s_suffix = "AM" if start_hour < 12 else "PM"
    e_suffix = "AM" if end_hour < 12 else "PM"
    s12 = start_hour % 12 or 12
    e12 = end_hour % 12 or 12
    if s_suffix == e_suffix:
        return "%d to %d %s" % (s12, e12, s_suffix)
    return "%s to %s" % (_hour_label(start_hour), _hour_label(end_hour))


def _plural(n: int, word: str) -> str:
    if n == 1:
        return "1 %s" % word
    plural = word[:-1] + "ies" if word.endswith("y") else word + "s"
    return "%d %s" % (n, plural)


# ---------- summary ----------

def summary(db: Session, user_id: str, tz_offset: int) -> InsightsSummary:
    now = now_utc()
    today = local_date(now, tz_offset)
    week_start = today - timedelta(days=6)

    total = (
        db.query(func.count(JournalEntry.id))
        .filter(JournalEntry.user_id == user_id)
        .scalar()
        or 0
    )
    last_at = (
        db.query(func.max(JournalEntry.created_at))
        .filter(JournalEntry.user_id == user_id)
        .scalar()
    )

    # All timestamps for this user (cheap for a personal journal; indexed).
    stamps: List[datetime] = [
        row[0]
        for row in db.query(JournalEntry.created_at)
        .filter(JournalEntry.user_id == user_id)
        .all()
    ]
    days = {local_date(s, tz_offset) for s in stamps}

    entries_today = sum(1 for s in stamps if local_date(s, tz_offset) == today)
    entries_week = sum(1 for s in stamps if week_start <= local_date(s, tz_offset) <= today)

    streak = 0
    cursor = today if today in days else today - timedelta(days=1)
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)

    # Rolling window: how many of the last 7 local days have an entry.
    active_7 = sum(1 for i in range(7) if (today - timedelta(days=i)) in days)

    leaning: Optional[str] = None
    if entries_week:
        win_start = _day_start_utc(week_start, tz_offset)
        win_end = _day_start_utc(today + timedelta(days=1), tz_offset)
        rows = (
            db.query(EntryEmotion.emotion, EntryEmotion.confirmed, EntryEmotion.score)
            .join(JournalEntry, JournalEntry.id == EntryEmotion.entry_id)
            .filter(
                EntryEmotion.user_id == user_id,
                JournalEntry.user_id == user_id,
                JournalEntry.created_at >= win_start,
                JournalEntry.created_at < win_end,
            )
            .all()
        )
        confirmed: Dict[str, float] = defaultdict(float)
        everything: Dict[str, float] = defaultdict(float)
        for emotion, is_confirmed, score in rows:
            everything[emotion] += score
            if is_confirmed:
                confirmed[emotion] += score
        pool = confirmed or everything
        if pool:
            leaning = max(sorted(pool.keys()), key=lambda e: pool[e])

    return InsightsSummary(
        entries_this_week=entries_week,
        entries_today=entries_today,
        streak_days=streak,
        active_days_last_7=active_7,
        leaning=leaning,
        total_entries=total,
        last_entry_at=aware(last_at),
    )


# ---------- map ----------

def _month_add(d: date, n: int) -> date:
    m = d.month - 1 + n
    return date(d.year + m // 12, m % 12 + 1, 1)


def _month_index(first: date, d: date) -> int:
    return (d.year - first.year) * 12 + (d.month - first.month)


def _build_buckets(
    db: Session, user_id: str, range_: str, today: date
) -> Tuple[List[MapBucket], List[date], "callable"]:
    """Return (buckets, bucket_start_dates, index_fn(local_date) -> int|None)."""
    if range_ == "week":
        starts = [today - timedelta(days=6 - i) for i in range(7)]
        buckets = [MapBucket(key=d.isoformat(), label=_fmt_day(d)) for d in starts]

        def idx(d: date) -> Optional[int]:
            i = (d - starts[0]).days
            return i if 0 <= i < 7 else None

        return buckets, starts, idx

    if range_ == "month":
        first = today - timedelta(days=29)
        starts = [first + timedelta(days=6 * i) for i in range(5)]
        buckets = [MapBucket(key=d.isoformat(), label=_fmt_day(d)) for d in starts]

        def idx(d: date) -> Optional[int]:
            i = (d - first).days
            return i // 6 if 0 <= i < 30 else None

        return buckets, starts, idx

    # all time: calendar months from first entry month to now, >= 4 months
    first_entry = (
        db.query(func.min(JournalEntry.created_at))
        .filter(JournalEntry.user_id == user_id)
        .scalar()
    )
    this_month = today.replace(day=1)
    if first_entry is not None:
        first_month = first_entry.date().replace(day=1)
        # `first_entry` is UTC; the local month can only be one earlier/later.
        first_month = min(first_month, this_month)
    else:
        first_month = this_month
    n = _month_index(first_month, this_month) + 1
    if n < 4:
        first_month = _month_add(this_month, -3)
        n = 4
    starts = [_month_add(first_month, i) for i in range(n)]
    buckets = [MapBucket(key=d.isoformat(), label=d.strftime("%b")) for d in starts]

    def idx(d: date) -> Optional[int]:
        i = _month_index(first_month, d)
        return i if 0 <= i < n else None

    return buckets, starts, idx


def _largest_remainder(totals: List[float]) -> List[int]:
    grand = sum(totals)
    if grand <= 0:
        return [0 for _ in totals]
    raw = [t / grand * 100.0 for t in totals]
    floors = [int(math.floor(r)) for r in raw]
    remainder = 100 - sum(floors)
    order = sorted(range(len(raw)), key=lambda i: (raw[i] - floors[i]), reverse=True)
    for i in order[:remainder]:
        floors[i] += 1
    return floors


def emotion_map(db: Session, user_id: str, range_: str, tz_offset: int) -> InsightsMap:
    now = now_utc()
    today = local_date(now, tz_offset)
    buckets, starts, bucket_index = _build_buckets(db, user_id, range_, today)
    n_buckets = len(buckets)

    start_utc = _day_start_utc(starts[0], tz_offset)
    end_utc = _day_start_utc(today + timedelta(days=1), tz_offset)

    entries: List[JournalEntry] = (
        db.query(JournalEntry)
        .options(selectinload(JournalEntry.emotions))
        .filter(
            JournalEntry.user_id == user_id,
            JournalEntry.created_at >= start_utc,
            JournalEntry.created_at < end_utc,
        )
        .order_by(JournalEntry.created_at.asc(), JournalEntry.id.asc())
        .all()
    )

    # Per-entry local time + bucket index.
    placed: List[Tuple[JournalEntry, datetime, int]] = []
    for e in entries:
        lt = e.created_at + timedelta(minutes=tz_offset)
        bi = bucket_index(lt.date())
        if bi is None:
            continue
        placed.append((e, lt, bi))
    entry_count = len(placed)

    # Which emotion rows count: confirmed if the user confirmed anything in range.
    any_confirmed = any(em.confirmed for e, _, _ in placed for em in e.emotions)

    def counted(em: EntryEmotion) -> bool:
        return em.confirmed if any_confirmed else True

    totals: Dict[str, float] = defaultdict(float)
    per_bucket: Dict[str, List[float]] = defaultdict(lambda: [0.0] * n_buckets)
    peak: Dict[str, Tuple[float, datetime]] = {}
    for e, lt, bi in placed:
        for em in e.emotions:
            if not counted(em):
                continue
            totals[em.emotion] += em.score
            per_bucket[em.emotion][bi] += em.score
            best = peak.get(em.emotion)
            if best is None or em.score > best[0]:
                peak[em.emotion] = (em.score, lt)

    # Five threads, not three. A fortnight of honest entries rarely has only
    # three feelings in it, and cutting to three hid the range that makes the
    # map worth looking at. Ties break alphabetically so the chart is stable.
    top = sorted(totals.keys(), key=lambda k: (-totals[k], k))[:5]
    series = [
        MapSeries(
            emotion=k,
            values=[round(v, 2) for v in per_bucket[k]],
            total=round(totals[k], 2),
        )
        for k in top
    ]
    max_value = max((v for s in series for v in s.values), default=0.0)
    y_max = float(max(1.0, math.ceil(max_value)))

    pcts = _largest_remainder([totals[k] for k in top])
    mix = [MapMix(emotion=k, pct=p) for k, p in zip(top, pcts)]

    cards = _cards(range_, top, totals, per_bucket, peak, placed, starts, n_buckets)
    noticings = _noticings(range_, top, totals, per_bucket, placed, n_buckets)

    return InsightsMap(
        range=range_,
        range_label=RANGE_LABELS[range_],
        start=aware(start_utc),
        end=aware(min(end_utc, now)),
        buckets=buckets,
        series=series,
        mix=mix,
        cards=cards,
        noticings=noticings,
        entry_count=entry_count,
        y_max=y_max,
    )


def _halves(per_bucket: Dict[str, List[float]], n_buckets: int) -> Dict[str, Tuple[float, float]]:
    split = n_buckets // 2
    out: Dict[str, Tuple[float, float]] = {}
    for emotion, values in per_bucket.items():
        out[emotion] = (sum(values[:split]), sum(values[split:]))
    return out


def _cards(
    range_: str,
    top: List[str],
    totals: Dict[str, float],
    per_bucket: Dict[str, List[float]],
    peak: Dict[str, Tuple[float, datetime]],
    placed: List[Tuple[JournalEntry, datetime, int]],
    starts: List[date],
    n_buckets: int,
) -> List[MapCard]:
    # 1. Most present
    if top:
        top_emotion = top[0]
        _, peak_at = peak[top_emotion]
        most_present = MapCard(
            label="Most present",
            value=top_emotion.capitalize(),
            sub="Peaked %s %s." % (WEEKDAYS[peak_at.weekday()], _time_band(peak_at)),
            emotion=top_emotion,
        )
    else:
        most_present = MapCard(label="Most present", value="None yet", sub=NO_DATA_SUB)

    # 2. Biggest shift: first half vs second half of the range
    shift_card = MapCard(label="Biggest shift", value="None yet", sub=NO_DATA_SUB)
    if top:
        split = n_buckets // 2
        # A shift is only a shift if there is something on both sides of the
        # midpoint. One entry in the second half is a start, not a trend.
        both_halves = any(bi < split for _, _, bi in placed) and any(bi >= split for _, _, bi in placed)
        halves = _halves(per_bucket, n_buckets) if both_halves else {}
        candidates = [(abs(b - a), b - a, emo) for emo, (a, b) in halves.items() if b != a]
        if candidates:
            candidates.sort(key=lambda c: (-c[0], c[2]))
            _, delta, emo = candidates[0]
            since = _fmt_day(starts[split])
            arrow = "↑" if delta > 0 else "↓"
            verb = "Climbing" if delta > 0 else "Fading"
            shift_card = MapCard(
                label="Biggest shift",
                value="%s %s" % (emo.capitalize(), arrow),
                sub="%s since %s." % (verb, since),
                emotion=emo,
            )
        else:
            shift_card = MapCard(
                label="Biggest shift", value="None yet", sub="Nothing has shifted much yet."
            )

    # 3. Most written
    written = MapCard(label="Most written", value="None yet", sub=NO_DATA_SUB)
    if placed:
        if range_ in ("week", "month"):
            counts = Counter(lt.weekday() for _, lt, _ in placed)
            wd = min(counts.keys(), key=lambda k: (-counts[k], k))
            n = counts[wd]
            name = WEEKDAYS[wd]
            value = name if range_ == "week" else name + "s"
            unit = "week" if range_ == "week" else "month"
            written = MapCard(
                label="Most written",
                value=value,
                sub="%s, your busiest day of the %s." % (_plural(n, "entry"), unit),
            )
        else:
            counts = Counter((lt.hour // 2) * 2 for _, lt, _ in placed)
            start_hour = min(counts.keys(), key=lambda k: (-counts[k], k))
            band = _time_band(datetime(2000, 1, 1, start_hour + 1))
            written = MapCard(
                label="Most written",
                value=_two_hour_band_label(start_hour),
                sub="%s are when the words come." % _band_plural(band),
            )

    return [most_present, shift_card, written]


def _noticings(
    range_: str,
    top: List[str],
    totals: Dict[str, float],
    per_bucket: Dict[str, List[float]],
    placed: List[Tuple[JournalEntry, datetime, int]],
    n_buckets: int,
) -> List[str]:
    count = len(placed)
    if count < MIN_ENTRIES_FOR_NOTICINGS:
        return ["Write a few more entries and patterns will start to surface."]

    out: List[str] = []
    label = RANGE_LABELS[range_]

    # a) when the user writes: a weekday or time-of-day pattern
    wd_counts = Counter(lt.weekday() for _, lt, _ in placed)
    wd, wd_n = max(wd_counts.items(), key=lambda kv: (kv[1], -kv[0]))
    band_counts = Counter(_time_band(lt) for _, lt, _ in placed)
    band, band_n = max(band_counts.items(), key=lambda kv: (kv[1], kv[0]))
    if wd_n >= 2 and wd_n / count >= 0.4 and len(wd_counts) > 1:
        out.append(
            "Most of your entries %s land on %ss (%d of %d)."
            % (label, WEEKDAYS[wd], wd_n, count)
        )
    elif band_n >= 2 and band_n / count >= 0.5:
        out.append(
            "You tend to write in the %s: %d of %d entries %s."
            % (band, band_n, count, label)
        )

    # b) trend direction of the most present emotion
    if top:
        emo = top[0]
        values = per_bucket[emo]
        split = n_buckets // 2
        first, second = sum(values[:split]), sum(values[split:])
        if first > 0 and second > 0:
            change = (second - first) / first
            if change >= 0.25:
                out.append("%s has been climbing through %s." % (emo.capitalize(), label))
            elif change <= -0.25:
                out.append("%s has been fading through %s." % (emo.capitalize(), label))
            elif abs(change) < 0.1:
                out.append("%s has stayed fairly steady %s." % (emo.capitalize(), label))

    # c) a keyword that co-occurs with the top positive emotion
    positive = next((e for e in top if e in POSITIVE_EMOTIONS), None)
    if positive is not None and len(out) < 3:
        kw_total: Counter = Counter()
        kw_with: Counter = Counter()
        for e, _, _ in placed:
            has = any(em.emotion == positive for em in e.emotions)
            for kw in set(e.keywords):
                kw_total[kw] += 1
                if has:
                    kw_with[kw] += 1
        best = None
        for kw, n in kw_total.items():
            if n >= 2 and kw_with[kw] == n:
                if best is None or (n, kw) > best:
                    best = (n, kw)
        if best is not None:
            out.append(
                "Entries that mention '%s' tend to land in %s." % (best[1], positive)
            )

    # d) honest volume fallback
    if len(out) < 3:
        words = sum(e.word_count for e, _, _ in placed)
        out.append(
            "You've written %s %s, about %d words." % (_plural(count, "entry"), label, words)
        )

    return out[:3]
