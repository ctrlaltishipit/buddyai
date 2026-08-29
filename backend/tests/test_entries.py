from app.models import JournalEntry
from tests.conftest import make_account


def test_entry_crud_and_analysis(client):
    acct = make_account(client)
    r = acct.post("/entries", json={"text": "I feel so happy and grateful today, what a wonderful walk.", "template": "gratitude"})
    assert r.status_code == 201, r.text
    e = r.json()
    assert e["word_count"] == 11
    assert e["sentiment"] > 0
    assert e["intensity"] > 0
    assert "walk" in e["keywords"]
    assert e["is_crisis_flagged"] is False
    assert e["template"] == "gratitude"
    assert e["created_at"].endswith("Z")
    # AI fallback emotions when client sends none
    assert e["emotions"] and all(em["source"] == "ai" and em["confirmed"] is False for em in e["emotions"])
    assert {em["emotion"] for em in e["emotions"]} >= {"joy", "gratitude"}

    got = acct.get("/entries/%s" % e["id"])
    assert got.status_code == 200 and got.json()["id"] == e["id"]

    # patch text -> analysis recomputed; emotions replaced with client set
    r = acct.patch(
        "/entries/%s" % e["id"],
        json={
            "text": "Feeling anxious and stressed about work.",
            "emotions": [{"emotion": "Anxiety", "score": 0.9, "confirmed": True, "source": "user"}],
        },
    )
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["word_count"] == 6
    assert p["sentiment"] < 0
    assert p["emotions"] == [{"emotion": "anxiety", "score": 0.9, "confirmed": True, "source": "user"}]
    assert p["updated_at"] >= p["created_at"]

    # patch only template keeps emotions
    r = acct.patch("/entries/%s" % e["id"], json={"template": "cbt"})
    assert r.json()["template"] == "cbt"
    assert r.json()["emotions"][0]["emotion"] == "anxiety"

    assert acct.delete("/entries/%s" % e["id"]).status_code == 204
    assert acct.get("/entries/%s" % e["id"]).status_code == 404
    assert acct.delete("/entries/%s" % e["id"]).status_code == 404


def test_entry_client_emotions_stored_verbatim_and_capped(client):
    acct = make_account(client)
    emotions = [{"emotion": "e%d" % i, "score": 0.1 * (i + 1), "confirmed": True, "source": "user"} for i in range(8)]
    r = acct.post("/entries", json={"text": "hello there", "emotions": emotions})
    assert r.status_code == 201
    assert len(r.json()["emotions"]) == 8
    assert r.json()["emotions"][0]["confirmed"] is True
    r = acct.post("/entries", json={"text": "hello there", "emotions": emotions + [{"emotion": "x", "score": 0.5}]})
    assert r.status_code == 422


def test_crisis_flag(client):
    acct = make_account(client)
    r = acct.post("/entries", json={"text": "Some days I feel like I want to die and nothing helps."})
    assert r.status_code == 201
    assert r.json()["is_crisis_flagged"] is True


def test_entry_validation(client):
    acct = make_account(client)
    assert acct.post("/entries", json={"text": ""}).status_code == 422
    assert acct.post("/entries", json={"text": "hi", "template": "nope"}).status_code == 422
    assert acct.get("/entries?limit=0").status_code == 422
    assert acct.get("/entries?limit=101").status_code == 422
    assert acct.get("/entries?cursor=not-a-date").status_code == 422


def test_pagination_with_cursor(client):
    acct = make_account(client)
    created = [acct.post("/entries", json={"text": "entry number %d" % i}).json()["id"] for i in range(25)]

    seen = []
    cursor = None
    pages = 0
    while True:
        url = "/entries?limit=10" + ("&cursor=%s" % cursor if cursor else "")
        r = acct.get(url)
        assert r.status_code == 200, r.text
        page = r.json()
        assert page["total"] == 25
        assert len(page["items"]) <= 10
        seen.extend(i["id"] for i in page["items"])
        pages += 1
        # newest first within a page
        stamps = [i["created_at"] for i in page["items"]]
        assert stamps == sorted(stamps, reverse=True)
        if not page["next_cursor"]:
            break
        cursor = page["next_cursor"]
    assert pages == 3
    assert len(seen) == 25
    assert len(set(seen)) == 25
    assert set(seen) == set(created)
    assert seen == list(reversed(created))


def test_pagination_is_stable_across_identical_timestamps(client, db):
    """Two entries sharing a created_at on a page boundary are neither skipped nor repeated."""
    acct = make_account(client)
    ids = [acct.post("/entries", json={"text": "tie %d" % i}).json()["id"] for i in range(3)]
    # Pin the two newest to the exact same instant; the third stays older.
    rows = [db.get(JournalEntry, i) for i in ids]
    shared = rows[2].created_at
    rows[1].created_at = shared
    db.commit()

    seen = []
    cursor = None
    while True:
        r = acct.get("/entries?limit=1" + ("&cursor=%s" % cursor if cursor else ""))
        assert r.status_code == 200, r.text
        page = r.json()
        assert len(page["items"]) == 1
        seen.append(page["items"][0]["id"])
        if not page["next_cursor"]:
            break
        assert "|" in page["next_cursor"]
        cursor = page["next_cursor"]
    assert len(seen) == 3 and set(seen) == set(ids)
    assert seen[:2] == sorted(ids[1:], reverse=True)  # tie broken by id desc
    assert seen[2] == ids[0]

    # A bare timestamp cursor (older clients) still paginates strictly older rows.
    bare = client.get("/entries?limit=1", headers=acct.headers).json()["next_cursor"].split("|")[0]
    r = acct.get("/entries?limit=10&cursor=%s" % bare)
    assert r.status_code == 200
    assert [i["id"] for i in r.json()["items"]] == [ids[0]]
