import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["ANTHROPIC_API_KEY"] = "test-key"

import pytest
from fastapi.testclient import TestClient

import ai
import main

main.app.dependency_overrides[main.current_user] = lambda: "user-1"
client = TestClient(main.app)

WORK = {"challenge": "Bus tracker", "problem": {"pains": ["Bus is often late"]}, "why_chosen": "Because a live map shows the answer at a glance",
        "interview": [{"question": "Why?", "answer": "I used a large font."}],
        "tests": {"testers": 5, "finished_without_help": 4}}


@pytest.fixture(autouse=True)
def fresh():
    main.HITS.clear()


def fake_scores(skills):
    return {"summary": "Good.", "skills": skills}


def test_health():
    r = client.get("/health").json()
    assert r["status"] == "ok" and r["ai_configured"] is True


def test_requires_login():
    main.app.dependency_overrides.pop(main.current_user)
    try:
        assert client.post("/api/report/score", json=WORK).status_code == 401
    finally:
        main.app.dependency_overrides[main.current_user] = lambda: "user-1"


def test_score_drops_invented_evidence_and_clamps_usability(monkeypatch):
    monkeypatch.setattr(ai, "ask", lambda *a, **k: fake_scores([
        {"name": "Problem understanding", "score": 4, "reason": "ok", "evidence": "Bus is often late", "tip": "t"},
        {"name": "Creative thinking", "score": 5, "reason": "ok", "evidence": "I never wrote this sentence", "tip": "t"},
        {"name": "Usability", "score": 1, "reason": "ok", "evidence": "", "tip": "t"},
        {"name": "Not a skill", "score": 3, "reason": "x", "evidence": "", "tip": ""},
        {"name": "Accessibility", "score": 9, "reason": "x", "evidence": "", "tip": ""}]))
    out = client.post("/api/report/score", json=WORK).json()
    by = {s["name"]: s for s in out["skills"]}
    assert by["Problem understanding"]["evidence"] == "Bus is often late"
    assert by["Creative thinking"]["evidence"] == ""            # invented quote removed
    assert by["Usability"]["score"] == 3                         # 4 of 5 passed -> base 4, AI said 1 -> clamped to 3
    assert "Not a skill" not in by and "Accessibility" not in by  # invalid items dropped


def test_react_returns_reaction_and_next_question(monkeypatch):
    monkeypatch.setattr(ai, "ask", lambda *a, **k: {"reaction": "Nice reason.", "next_question": "How will you test it?"})
    out = client.post("/api/interview/react", json={**WORK, "last": False}).json()
    assert out == {"reaction": "Nice reason.", "next_question": "How will you test it?"}
    last = client.post("/api/interview/react", json={**WORK, "last": True}).json()
    assert last["next_question"] == ""


def test_design_review_limits_points(monkeypatch):
    seen = {}
    monkeypatch.setattr(ai, "ask", lambda model, prompt, max_tokens=0, image_b64=None: seen.update(img=image_b64) or
                        {"works": ["a", "b", "c"], "issues": ["1", "2", "3", "4"]})
    out = client.post("/api/design/review", json={"challenge": "x", "image_b64": "AAAA"}).json()
    assert len(out["works"]) == 2 and len(out["issues"]) == 3 and seen["img"] == "AAAA"


def test_rate_limit(monkeypatch):
    monkeypatch.setenv("AI_CALLS_PER_HOUR", "2")
    monkeypatch.setattr(ai, "ask", lambda *a, **k: {"reaction": "", "next_question": ""})
    codes = [client.post("/api/interview/react", json=WORK).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_ai_failure_becomes_502(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("claude down")
    monkeypatch.setattr(ai, "ask", boom)
    assert client.post("/api/interview/react", json=WORK).status_code == 502


def test_usability_baseline():
    assert ai.baseline_usability({"testers": 5, "finished_without_help": 4}) == 4
    assert ai.baseline_usability({"testers": 0}) == 1
