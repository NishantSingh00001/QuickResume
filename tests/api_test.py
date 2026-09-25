#!/usr/bin/env python3
"""End-to-end API tests for QuickResume (Python 3 standard library only).

Run the app with `netlify dev`, then:  python3 tests/api_test.py [base-url]
It creates test resumes, so it refuses to run against anything but localhost
unless you pass --yes.
"""
import json, sys, urllib.request

args = [a for a in sys.argv[1:] if not a.startswith("--")]
B = (args[0] if args else "http://localhost:8888").rstrip("/")
if not B.startswith(("http://localhost", "http://127.0.0.1")) and "--yes" not in sys.argv:
    sys.exit(f"Refusing to create test data on {B}. Pass --yes if you really mean it.")
FAILED = []

def call(method, path, body=None, key=None):
    h = {"content-type": "application/json"} if body is not None else {}
    if key: h["x-edit-key"] = key
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        b = e.read()
        try: return e.code, json.loads(b)
        except Exception: return e.code, {"raw": b[:200]}

def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: FAILED.append(msg)

resume = {
    "title": "Test resume", "targetRole": "Backend Engineer",
    "basics": {"name": "Test Person", "headline": "Backend Engineer", "email": "t@example.com", "phone": "+91 90000 00000", "location": "Mumbai", "links": [{"label": "GitHub", "url": "github.com/test"}]},
    "summary": "Backend engineer who builds reliable APIs in Go and PostgreSQL and likes making slow things fast.",
    "sections": [
        {"kind": "experience", "title": "Experience", "items": [{"role": "Intern", "org": "Acme", "start": "Jan 2026", "end": "Jun 2026", "bullets": ["Built a Go service handling 2M requests/day", "Responsible for testing"]}]},
        {"kind": "skills", "title": "Skills", "groups": [{"name": "Languages", "skills": "Go, SQL, Python"}]},
        {"kind": "bogus", "title": "Dropped"},
    ],
    "settings": {"template": "classic", "accent": "#123456", "fontScale": 5, "paper": "letter"},
    "evil": "<script>",
}
JD = "Backend Engineer\nRequirements:\n- Go or Node.js, PostgreSQL, Redis, Docker\n- 1+ years building REST APIs\nNice to have:\n- Kubernetes"

s, h = call("GET", "/api/health"); ok(s == 200 and h["ok"], f"health: {h}")
s, r = call("POST", "/api/resumes", {"resume": resume}); ok(s == 201 and len(r["id"]) == 10 and len(r["key"]) >= 30, f"create -> {s} {r.get('id')}")
rid, key = r["id"], r["key"]
s, r = call("GET", f"/api/resumes/{rid}"); ok(s == 401, f"read without key -> {s}")
s, r = call("GET", f"/api/resumes/{rid}", key="wrong-key-wrong-key-wrong"); ok(s == 401, f"read with wrong key -> {s}")
s, r = call("GET", f"/api/resumes/{rid}", key=key); ok(s == 200, "read with key")
saved = r["resume"]
ok(saved["settings"]["fontScale"] == 1.15 and saved["settings"]["template"] == "classic" and saved["settings"]["paper"] == "letter", f"settings clamped: {saved['settings']}")
ok(len(saved["sections"]) == 2 and "evil" not in saved, "unknown sections and fields dropped")
ok(saved["sections"][0]["items"][0]["bullets"][0]["text"].startswith("Built") and saved["sections"][0]["items"][0]["bullets"][0]["id"], "string bullets normalised with ids")
s, r = call("GET", "/api/resumes/NOTANID", key=key); ok(s == 400, f"bad id -> {s}")
s, r = call("GET", "/api/resumes/abcdefghij", key=key); ok(s == 410, f"missing resume -> {s}")

saved["summary"] = "Updated summary for the test."
s, r = call("PUT", f"/api/resumes/{rid}", {"resume": saved}, key=key); ok(s == 200 and r["updatedAt"], "save")
s, r = call("GET", f"/api/resumes/{rid}", key=key); ok(r["resume"]["summary"] == "Updated summary for the test.", "save persisted")
s, r = call("PUT", f"/api/resumes/{rid}", {"resume": saved}, key="nope-nope-nope-nope-nope"); ok(s == 401, f"save without key -> {s}")

s, r = call("POST", "/api/resumes/list", {"items": [{"id": rid, "key": key}, {"id": "abcdefghij", "key": "x"}]})
ok(s == 200 and r["resumes"][0]["title"] == "Test resume" and r["resumes"][1].get("gone"), f"list: {[x.get('title') or x for x in r['resumes']]}")

s, r = call("POST", f"/api/resumes/{rid}/publish", key=key); slug = r.get("slug", ""); ok(s == 201 and slug.startswith("test-person-"), f"publish -> {slug}")
s, r2 = call("POST", f"/api/resumes/{rid}/publish", key=key); ok(r2.get("slug") == slug, "publishing twice keeps the same link")
s, p1 = call("GET", f"/api/public/{slug}"); ok(s == 200 and p1["resume"]["basics"]["name"] == "Test Person" and "keyHash" not in json.dumps(p1), "public view (no secrets)")
s, p2 = call("GET", f"/api/public/{slug}"); ok(p1["views"] == 1 and p2["views"] == 1, f"views counted once per visitor: {p1['views']}, {p2['views']}")
s, r = call("DELETE", f"/api/resumes/{rid}/publish", key=key); ok(s == 200 and r["slug"] is None, "unpublish")
s, r = call("GET", f"/api/public/{slug}"); ok(s == 410, f"public link gone -> {s}")

s, r = call("POST", "/api/ats", {"resume": saved, "jd": JD}); rep = r.get("report", {})
ok(s == 200 and 0 < rep.get("total", 0) <= 100 and len(rep["parts"]) == 6, f"ATS score {rep.get('total')}: {[(p['id'], p['score']) for p in rep.get('parts', [])]}")
miss = [k["term"] for k in rep["keywords"] if not k["found"]]
ok("Redis" in miss and "Go" not in miss, f"missing keywords: {miss}")
ok(any("Responsible for" in t["text"] or "responsible for" in t["text"] for t in rep["tips"]), "weak bullet flagged in tips")
s, r = call("POST", "/api/ats", {"resume": saved}); ok(s == 200 and not r["report"]["hasJd"] and len(r["report"]["parts"]) == 4, "ATS without a job description")
s, r = call("POST", "/api/ats", {"resume": saved, "jd": "x" * 13000}); ok(s == 413, f"oversized JD -> {s}")

s, r = call("POST", "/api/ai/interview", {"resume": saved, "jd": JD, "count": 8})
ok(s == 200 and len(r["questions"]) == 8 and r["model"] is None, f"interview questions (built-in bank): {[q['kind'] for q in r.get('questions', [])]}")
if not h["ai"]["enabled"]:
    s, r = call("POST", "/api/ai/bullet", {"text": "worked on api", "mode": "improve"}); ok(s == 503, f"AI without key -> {s}")

s, r = call("GET", "/api/nope"); ok(s == 400, f"unknown route -> {s}")
s, r = call("DELETE", f"/api/resumes/{rid}", key=key); ok(s == 200, "delete")
s, r = call("GET", f"/api/resumes/{rid}", key=key); ok(s == 410, f"deleted resume -> {s}")

print()
print(f"{len(FAILED)} failed" if FAILED else "All checks passed.")
sys.exit(1 if FAILED else 0)
