"""SkillProof AI backend (FastAPI).
Run:  uvicorn main:app --reload      Docs: http://127.0.0.1:8000/docs"""
import json
import logging
import os
import time

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

import ai

log = logging.getLogger("skillproof")
app = FastAPI(title="SkillProof AI backend")

origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:5500,http://localhost:5500").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])

_sb = None
HITS: dict[str, list[float]] = {}


def get_sb():
    """Supabase client, created the first time it is needed."""
    global _sb
    if _sb is None:
        from supabase import create_client
        _sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    return _sb


def current_user(authorization: str | None = Header(default=None)) -> str:
    """Only logged-in users may use the AI (this protects your API credits)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Please log in.")
    try:
        res = get_sb().auth.get_user(authorization[7:])
        user = res.user if res else None
    except Exception:
        user = None
    if not user:
        raise HTTPException(401, "Your login has expired. Please log in again.")
    return user.id


def limited(uid: str = Depends(current_user)) -> str:
    limit = int(os.getenv("AI_CALLS_PER_HOUR", "60"))
    now = time.time()
    recent = [t for t in HITS.get(uid, []) if now - t < 3600]
    if len(recent) >= limit:
        raise HTTPException(429, "Too many AI requests. Try again later.")
    HITS[uid] = recent + [now]
    return uid


class QA(BaseModel):
    question: str = Field(max_length=600)
    answer: str = Field(max_length=4000)


class Work(BaseModel):
    model_config = ConfigDict(extra="allow")  # the frontend sends many optional fields
    challenge: str = Field(max_length=600)
    interview: list[QA] = Field(default_factory=list, max_length=8)
    last: bool = False


class DesignReq(BaseModel):
    challenge: str = Field(max_length=600)
    image_b64: str = Field(max_length=6_000_000)


def run(fn, *args):
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "AI is not configured on the server.")
    try:
        return fn(*args)
    except HTTPException:
        raise
    except Exception:
        log.exception("AI call failed")
        raise HTTPException(502, "The AI service had a problem. Please try again.")


def payload(work: Work) -> dict:
    data = work.model_dump()
    if len(json.dumps(data)) > 60_000:
        raise HTTPException(413, "Your work is too long to score.")
    return data


@app.get("/health")
def health():
    return {"status": "ok", "ai_configured": bool(os.getenv("ANTHROPIC_API_KEY")),
            "auth_configured": bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_ANON_KEY"))}


@app.post("/api/interview/react")
def interview_react(work: Work, uid: str = Depends(limited)):
    return run(ai.react, payload(work))


@app.post("/api/report/score")
def report_score(work: Work, uid: str = Depends(limited)):
    return run(ai.score_report, payload(work))


@app.post("/api/design/review")
def design_review(req: DesignReq, uid: str = Depends(limited)):
    return run(ai.review_design, req.challenge, req.image_b64)
