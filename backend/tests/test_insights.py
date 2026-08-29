from datetime import datetime, timedelta

from app.models import JournalEntry
from tests.conftest import make_account

TZ = 330  # IST, minutes east of UTC


def _set_created(db, entry_id, when_local):
    """Pin an entry's created_at to a given *local* (IST) datetime."""
    row = db.get(JournalEntry, entry_id)
    row.created_at = when_local - timedelta(minutes=TZ)
    db.commit()


def _today_local():
    return (datetime.utcnow() + timedelta(minutes=TZ)).date()


def _make(acct, db, text, when_local, emotions=None):
    body = {"text": text}
    if emotions:
        body["emotions"] = emotions
    e = acct.post("/entries", json=body).json()
    _set_created(db, e["id"], when_local)
    return e


def test_empty_summary_and_map(client):
    acct = make_account(client)
    s = acct.get("/insights/summary?tz_offset=%d" % TZ).json()
    assert s == {
        "entries_this_week": 0, "entries_today": 0, "streak_days": 0,
        "active_days_last_7": 0,
        "leaning": None, "total_entries": 0, "last_entry_at": None,
    }
    for rng, n in (("week", 7), ("month", 5), ("all", 4)):
        m = acct.get("/insights/map?range=%s&tz_offset=%d" % (rng, TZ)).json()
        assert m["range"] == rng
        assert len(m["buckets"]) == n
        assert m["series"] == [] and m["mix"] == []
        assert m["y_max"] == 1.0
        assert m["entry_count"] == 0
        assert [c["label"] for c in m["cards"]] == ["Most present", "Biggest shift", "Most written"]
        assert all(c["value"] == "None yet" for c in m["cards"])
        assert m["noticings"] == ["Write a few more entries and patterns will start to surface."]
        assert m["start"].endswith("Z") and m["end"].endswith("Z")
    assert acct.get("/insights/map?range=year").status_code == 422


def test_streak_and_leaning(client, db):
    acct = make_account(client)
    today = _today_local()
    noon = datetime.combine(today, datetime.min.time()).replace(hour=12)
    anx = [{"emotion": "anxiety", "score": 0.9, "confirmed": True, "source": "user"}]
    joy = [{"emotion": "joy", "score": 0.6, "confirmed": True, "source": "user"}]

    # 3 consecutive days ending today; a gap; then one more 5 days ago
    _make(acct, db, "today happy", noon, joy)
    _make(acct, db, "yesterday anxious", noon - timedelta(days=1), anx)
    _make(acct, db, "two days ago anxious", noon - timedelta(days=2), anx)
    _make(acct, db, "five days ago", noon - timedelta(days=5))
    _make(acct, db, "long ago", noon - timedelta(days=40))

    s = acct.get("/insights/summary?tz_offset=%d" % TZ).json()
    assert s["total_entries"] == 5
    assert s["entries_today"] == 1
    assert s["entries_this_week"] == 4
    assert s["streak_days"] == 3
    assert s["leaning"] == "anxiety"  # 1.8 confirmed vs 0.6
    assert s["last_entry_at"].endswith("Z")

    # Streak still counts when today has nothing yet (ends yesterday)
    db.query(JournalEntry).filter(JournalEntry.text == "today happy").delete()
    db.commit()
    s = acct.get("/insights/summary?tz_offset=%d" % TZ).json()
    assert s["streak_days"] == 2 and s["entries_today"] == 0


def test_streak_respects_timezone(client, db):
    """An entry at 01:00 IST today is 'yesterday' in UTC — tz_offset decides."""
    acct = make_account(client)
    today = _today_local()
    one_am = datetime.combine(today, datetime.min.time()).replace(hour=1)
    _make(acct, db, "early bird", one_am)
    s_ist = acct.get("/insights/summary?tz_offset=%d" % TZ).json()
    assert s_ist["entries_today"] == 1
    s_utc = acct.get("/insights/summary?tz_offset=0").json()
    utc_today = datetime.utcnow().date()
    expected = 1 if (one_am - timedelta(minutes=TZ)).date() == utc_today else 0
    assert s_utc["entries_today"] == expected


def test_map_week_buckets_series_mix_cards(client, db):
    acct = make_account(client)
    today = _today_local()
    evening = datetime.combine(today, datetime.min.time()).replace(hour=19)
    conf = lambda emo, score: [{"emotion": emo, "score": score, "confirmed": True, "source": "user"}]

    _make(acct, db, "a", evening, conf("joy", 0.5))
    _make(acct, db, "b", evening - timedelta(days=1), conf("joy", 0.9))
    _make(acct, db, "c", evening - timedelta(days=1), conf("anxiety", 0.6))
    _make(acct, db, "d", evening - timedelta(days=6), conf("anxiety", 0.9))
    _make(acct, db, "e", evening - timedelta(days=6), conf("sadness", 0.2))
    _make(acct, db, "old", evening - timedelta(days=7), conf("shame", 0.99))  # outside the week

    m = acct.get("/insights/map?range=week&tz_offset=%d" % TZ).json()
    assert m["range_label"] == "this week"
    assert m["entry_count"] == 5
    assert len(m["buckets"]) == 7
    assert m["buckets"][-1]["key"] == today.isoformat()
    assert m["buckets"][0]["key"] == (today - timedelta(days=6)).isoformat()
    assert m["buckets"][-1]["label"] == "%s %d" % (today.strftime("%b"), today.day)

    by_emotion = {s["emotion"]: s for s in m["series"]}
    assert list(by_emotion) == ["anxiety", "joy", "sadness"]  # most present first (1.5, 1.4, 0.2)
    assert by_emotion["joy"]["values"] == [0, 0, 0, 0, 0, 0.9, 0.5]
    assert by_emotion["anxiety"]["values"] == [0.9, 0, 0, 0, 0, 0.6, 0]
    assert by_emotion["joy"]["total"] == 1.4
    assert m["y_max"] == 1.0
    assert sum(x["pct"] for x in m["mix"]) == 100
    assert m["mix"][0]["emotion"] == "anxiety"

    cards = {c["label"]: c for c in m["cards"]}
    assert cards["Most present"]["value"] == "Anxiety"
    assert cards["Most present"]["emotion"] == "anxiety"
    assert cards["Most present"]["sub"].startswith("Peaked ") and "evening" in cards["Most present"]["sub"]
    assert cards["Biggest shift"]["value"] == "Joy ↑"
    assert cards["Biggest shift"]["sub"].startswith("Climbing since ")
    assert cards["Most written"]["value"] in (
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
    )
    assert "2 entries" in cards["Most written"]["sub"]
    assert 1 <= len(m["noticings"]) <= 3
    assert m["noticings"] != ["Write a few more entries and patterns will start to surface."]

    # "old" shows up in month and all
    mm = acct.get("/insights/map?range=month&tz_offset=%d" % TZ).json()
    assert mm["entry_count"] == 6 and len(mm["buckets"]) == 5
    assert mm["buckets"][0]["key"] == (today - timedelta(days=29)).isoformat()
    ma = acct.get("/insights/map?range=all&tz_offset=%d" % TZ).json()
    assert ma["entry_count"] == 6 and len(ma["buckets"]) >= 4
    assert ma["buckets"][-1]["key"] == today.replace(day=1).isoformat()
    written = {c["label"]: c for c in ma["cards"]}["Most written"]
    assert "PM" in written["value"] or "AM" in written["value"]
    assert written["sub"].endswith("are when the words come.")


def test_map_unconfirmed_fallback_and_larger_y_max(client, db):
    acct = make_account(client)
    today = _today_local()
    noon = datetime.combine(today, datetime.min.time()).replace(hour=12)
    for _ in range(3):
        _make(acct, db, "so so happy and happy", noon)  # ai joy ~0.8 unconfirmed
    m = acct.get("/insights/map?range=week&tz_offset=%d" % TZ).json()
    assert [s["emotion"] for s in m["series"]] == ["joy"]
    assert m["series"][0]["total"] > 2.0
    assert m["y_max"] == 3.0
    assert m["mix"] == [{"emotion": "joy", "pct": 100}]


def test_single_entry_does_not_claim_a_shift(client, db):
    """One entry in the second half of the week is a start, not a trend."""
    acct = make_account(client)
    today = _today_local()
    evening = datetime.combine(today, datetime.min.time()).replace(hour=19)
    conf = [{"emotion": "anxiety", "score": 0.8, "confirmed": True, "source": "user"}]
    _make(acct, db, "only one", evening, conf)

    m = acct.get("/insights/map?range=week&tz_offset=%d" % TZ).json()
    cards = {c["label"]: c for c in m["cards"]}
    assert cards["Most present"]["value"] == "Anxiety"
    assert cards["Biggest shift"]["value"] == "None yet"
    assert cards["Biggest shift"]["sub"] == "Nothing has shifted much yet."
    assert "Climbing" not in cards["Biggest shift"]["sub"]


def test_rolling_window_survives_a_missed_day(client, db):
    """A gap breaks the consecutive streak but must not empty the 7-day window.

    This is the whole point of the rolling count: someone who misses a day has
    still shown up, and the UI must never have to render that as a failure.
    """
    acct = make_account(client)
    today = _today_local()
    # Wrote today, yesterday, then a gap at 2 days ago, then 3 and 4 days ago.
    for offset in (0, 1, 3, 4):
        _make(acct, db, "entry %d" % offset, today - timedelta(days=offset))

    s = acct.get("/insights/summary?tz_offset=%d" % TZ).json()
    assert s["streak_days"] == 2, "consecutive run is today plus yesterday"
    assert s["active_days_last_7"] == 4, "all four days still count in the window"


def test_rolling_window_ignores_days_older_than_seven(client, db):
    acct = make_account(client)
    today = _today_local()
    _make(acct, db, "recent", today)
    _make(acct, db, "ancient", today - timedelta(days=9))

    s = acct.get("/insights/summary?tz_offset=%d" % TZ).json()
    assert s["active_days_last_7"] == 1
