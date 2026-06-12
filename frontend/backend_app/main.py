"""
Sentinel AI — FastAPI Backend
Real-time signal validation engine.
Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid
import hashlib
from datetime import datetime, timezone
import math
from collections import defaultdict

from database import db
from ai_engine import symptom_extractor, confidence_engine
from trends_fetcher import get_trends_score, get_trends_raw
from idsp_loader import get_idsp_summary, get_district_idsp, get_anchor_score
from prediction_engine import prediction_engine

app = FastAPI(title="Sentinel AI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── IP RATE LIMITING ─────────────────────────────────────────────────────────
# In-memory sliding window: IP → list of timestamps
_ip_requests: dict = defaultdict(list)
IP_WINDOW_SECONDS = 3600   # 1 hour window
IP_MAX_REPORTS    = 5      # max reports per IP per hour

def _check_ip_rate_limit(ip: str) -> bool:
    """Returns True if this IP is over the rate limit."""
    now = datetime.now(timezone.utc).timestamp()
    window_start = now - IP_WINDOW_SECONDS
    # Prune old entries
    _ip_requests[ip] = [t for t in _ip_requests[ip] if t > window_start]
    if len(_ip_requests[ip]) >= IP_MAX_REPORTS:
        return True
    _ip_requests[ip].append(now)
    return False

def _get_client_ip(request: Request) -> str:
    """Extract real client IP, supporting X-Forwarded-For proxies (Railway/Vercel)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

# ── MODELS ──────────────────────────────────────────────────────────────────

class ReportIn(BaseModel):
    district: str
    symptoms: List[str]
    free_text: Optional[str] = ""

class ReportOut(BaseModel):
    anon_id: str
    district: str
    symptoms: List[str]
    timestamp: str
    signal_contribution: float

class SignalOut(BaseModel):
    id: str
    name: str
    district: str
    confidence: float
    status: str
    report_count: int
    sources: List[str]
    symptoms: List[str]
    created_at: str
    last_updated: str

class HeatmapPoint(BaseModel):
    district: str
    confidence: float
    report_count: int
    dominant_symptom: str

# ── HELPERS ─────────────────────────────────────────────────────────────────

def make_anon_id(ip_hint: str = "") -> str:
    """Generate a reproducible but anonymous hex ID."""
    raw = f"{uuid.uuid4()}{ip_hint}"
    return hashlib.sha256(raw.encode()).hexdigest()[:8].upper()

# ── ROUTES ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Sentinel AI active", "version": "2.0.0"}


@app.post("/api/report", response_model=ReportOut)
def submit_report(report: ReportIn, request: Request):
    """
    Submit an anonymous health report.
    - IP rate limiting (5 reports/hour per IP)
    - Symptom extraction via AI engine
    - Spam/duplicate detection
    - Stores in DB
    - Triggers signal recalculation for the hex
    """
    client_ip = _get_client_ip(request)

    # IP rate limit check
    if _check_ip_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many reports from your IP address. Please wait before submitting again."
        )

    anon_id = make_anon_id(client_ip)
    now = datetime.now(timezone.utc).isoformat()

    # AI: extract & normalize symptoms
    normalized = symptom_extractor.normalize(report.symptoms, report.free_text)

    # Spam check
    is_spam = db.is_duplicate_or_spam(report.district, normalized)
    if is_spam:
        raise HTTPException(status_code=429, detail="Duplicate or spam report detected.")

    # Store report
    report_record = {
        "anon_id": anon_id,
        "district": report.district,
        "symptoms": normalized,
        "free_text": report.free_text or "",
        "timestamp": now,
        "is_spam": False,
    }
    db.insert_report(report_record)

    # Recalculate signal confidence for this hex
    if "hex_id" in report_record:
        confidence_engine.recalculate_hex(report_record["hex_id"])
    confidence_engine.recalculate(report.district)

    # Estimate how much this report contributed
    contribution = confidence_engine.estimate_contribution(
        district=report.district,
        symptoms=normalized,
        has_text=bool(report.free_text),
    )

    return ReportOut(
        anon_id=anon_id,
        district=report.district,
        symptoms=normalized,
        timestamp=now,
        signal_contribution=round(contribution, 2),
    )


@app.get("/api/signals", response_model=List[SignalOut])
def get_signals(district: Optional[str] = None):
    """Returns all active signals, optionally filtered by district."""
    signals = db.get_signals(district=district)
    return [
        SignalOut(
            id=s["id"],
            name=s["name"],
            district=s["district"],
            confidence=round(s["confidence"], 1),
            status=_status_label(s["confidence"]),
            report_count=s["report_count"],
            sources=s["sources"],
            symptoms=s["symptoms"],
            created_at=s["created_at"],
            last_updated=s["last_updated"],
        )
        for s in signals
    ]


@app.get("/api/heatmap")
def get_heatmap():
    """Returns confidence per H3 hex for the live Mapbox/Deck.gl heatmap."""
    return db.get_all_hex_summary()


@app.get("/api/timeline")
def get_timeline():
    """Returns historical frames of the outbreak for the timeline player."""
    return db.get_timeline()


@app.get("/api/stats")
def get_stats():
    """Dashboard metrics: active signals, total reports, spam blocked, top confidence."""
    stats = db.get_stats()
    # Enrich with live trends score
    stats["trends_score"] = get_trends_score()
    return stats


@app.get("/api/reports/recent")
def get_recent_reports(limit: int = 20):
    """Returns most recent anonymous reports for the feed."""
    return db.get_recent_reports(limit=limit)


@app.get("/api/predictions")
def get_predictions():
    """
    Returns 6-hour outbreak trajectory predictions per H3 hex.
    Forecasts which zones will breach the 80% alert threshold.
    """
    hex_summary = db.get_all_hex_summary()
    return prediction_engine.predict_hex_trajectory(hex_summary)


@app.get("/api/forecast")
def get_forecast():
    """
    Returns overall outbreak trajectory assessment with threat level.
    CRITICAL / HIGH / ELEVATED / GUARDED / LOW.
    """
    hex_summary = db.get_all_hex_summary()
    return prediction_engine.get_outbreak_forecast(hex_summary)


@app.get("/api/trends")
def get_trends():
    """
    Returns live Google Trends keyword scores for disease surveillance keywords.
    Falls back to CSV seed data if pytrends is unavailable.
    """
    raw = get_trends_raw()
    score = get_trends_score()
    return {
        "trends_score": score,
        "keywords": raw,
        "geo": "IN-MP (Madhya Pradesh)",
        "source": "Google Trends via pytrends (fallback: CSV seed)",
    }


@app.get("/api/groundtruth")
def get_ground_truth(district: Optional[str] = None):
    """
    Returns WHO/IDSP retrospective ground truth data.
    Provides the anchor/validation layer for confidence scoring.
    """
    if district:
        records = get_district_idsp(district)
        anchor = get_anchor_score(district, [])
        return {
            "district": district,
            "anchor_score": anchor,
            "idsp_records": records,
            "source": "IDSP - Integrated Disease Surveillance Programme, India",
        }
    return {
        "idsp_records": get_idsp_summary(),
        "source": "IDSP - Integrated Disease Surveillance Programme, India",
        "coverage": "Bhopal, Madhya Pradesh — Weeks 18–22, 2026",
    }


def _status_label(conf: float) -> str:
    if conf >= 80:
        return "strong"
    if conf >= 40:
        return "emerging"
    return "noise"
