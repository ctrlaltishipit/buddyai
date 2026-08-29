from concurrent.futures import ThreadPoolExecutor

from tests.conftest import make_account


def test_users_cannot_touch_each_others_entries(client):
    a = make_account(client, prefix="a")
    b = make_account(client, prefix="b")
    ea = a.post("/entries", json={"text": "A's private happy thoughts"}).json()
    eb = b.post("/entries", json={"text": "B's private anxious thoughts"}).json()

    assert a.get("/entries/%s" % eb["id"]).status_code == 404
    assert a.patch("/entries/%s" % eb["id"], json={"text": "hacked"}).status_code == 404
    assert a.delete("/entries/%s" % eb["id"]).status_code == 404
    assert b.get("/entries/%s" % ea["id"]).status_code == 404

    # B's entry is untouched
    still = b.get("/entries/%s" % eb["id"]).json()
    assert still["text"] == "B's private anxious thoughts"

    la = a.get("/entries").json()
    assert la["total"] == 1 and [i["id"] for i in la["items"]] == [ea["id"]]
    lb = b.get("/entries").json()
    assert lb["total"] == 1 and [i["id"] for i in lb["items"]] == [eb["id"]]

    sa = a.get("/insights/summary").json()
    assert sa["total_entries"] == 1 and sa["leaning"] == "joy"
    sb = b.get("/insights/summary").json()
    assert sb["total_entries"] == 1 and sb["leaning"] == "anxiety"

    ma = a.get("/insights/map?range=week").json()
    assert ma["entry_count"] == 1
    assert [s["emotion"] for s in ma["series"]] == ["joy"]
    mb = b.get("/insights/map?range=all").json()
    assert mb["entry_count"] == 1
    assert [s["emotion"] for s in mb["series"]] == ["anxiety"]

    xa = a.get("/me/export").json()
    assert xa["user"]["id"] == a.id
    assert [e["id"] for e in xa["entries"]] == [ea["id"]]
    assert "1 journal entry" in xa["note"]
    xb = b.get("/me/export").json()
    assert [e["id"] for e in xb["entries"]] == [eb["id"]]

    # settings are per-user too
    a.patch("/settings", json={"display_name": "Alice"})
    assert b.get("/settings").json()["display_name"] == ""


def test_concurrent_writes_stay_isolated(client):
    users = [make_account(client, prefix="c%d" % i) for i in range(4)]
    plan = []  # (user_index, text)
    for i, _ in enumerate(users):
        for j in range(10):
            plan.append((i, "user %d entry %d happy" % (i, j)))

    def create(item):
        i, text = item
        r = users[i].post("/entries", json={"text": text})
        assert r.status_code == 201, r.text
        return i, r.json()["id"]

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(create, plan))

    ids_by_user = {}
    for i, eid in results:
        ids_by_user.setdefault(i, set()).add(eid)
    assert all(len(ids_by_user[i]) == 10 for i in range(4))
    all_ids = set().union(*ids_by_user.values())
    assert len(all_ids) == 40

    for i, u in enumerate(users):
        listing = u.get("/entries?limit=100").json()
        assert listing["total"] == 10
        got = {e["id"] for e in listing["items"]}
        assert got == ids_by_user[i]
        assert all(e["text"].startswith("user %d " % i) for e in listing["items"])
        assert u.get("/insights/summary").json()["total_entries"] == 10
        assert u.get("/insights/map?range=week").json()["entry_count"] == 10


def test_delete_account_cascades(client, db):
    from app.models import EntryEmotion, JournalEntry, User, UserSettings

    acct = make_account(client)
    acct.patch("/settings", json={"display_name": "Gone"})
    for i in range(3):
        acct.post("/entries", json={"text": "grateful and happy %d" % i})
    assert db.query(JournalEntry).filter_by(user_id=acct.id).count() == 3
    assert db.query(EntryEmotion).filter_by(user_id=acct.id).count() > 0

    assert acct.delete("/auth/me", json={"password": "wrong-wrong-1"}).status_code == 400
    r = acct.delete("/auth/me", json={"password": acct.password})
    assert r.status_code == 204

    db.expire_all()
    assert db.get(User, acct.id) is None
    assert db.get(UserSettings, acct.id) is None
    assert db.query(JournalEntry).filter_by(user_id=acct.id).count() == 0
    assert db.query(EntryEmotion).filter_by(user_id=acct.id).count() == 0
    assert client.post("/auth/login", json={"email": acct.email, "password": acct.password}).status_code == 401
    assert acct.get("/auth/me").status_code == 401
