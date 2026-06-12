"""
Sentinel AI — AI Engine
Two components:
  1. SymptomExtractor  — normalizes raw user text + chip selections to canonical tags
  2. ConfidenceEngine  — calculates a real confidence score per district using:
       trends_score    +35% weight  (organic growth over time)
       report_score    +30% weight  (report volume, diversity of wording)
       multi_symptom   +20% weight  (multiple distinct symptom types)
       spam_clear      +15% weight  (how clean the signal is)

No external API key required for the MVP — rule-based NLP.
To upgrade to BioBERT / OpenAI, replace SymptomExtractor.normalize().
"""

import math
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional
from collections import Counter


# ── SYMPTOM VOCABULARY ──────────────────────────────────────────────────────
# Maps raw user input → canonical tags (handles typos, synonyms, languages)

SYNONYM_MAP = {
    # Respiratory
    "cough": "cough",
    "coughing": "cough",
    "dry cough": "cough",
    "wet cough": "cough",
    "khansi": "cough",
    "fever": "fever",
    "high temperature": "fever",
    "bukhar": "fever",
    "temperature": "fever",
    "loss of smell": "loss of smell",
    "cant smell": "loss of smell",
    "can't smell": "loss of smell",
    "no smell": "loss of smell",
    "smell gone": "loss of smell",
    "anosmia": "loss of smell",
    "sore throat": "sore throat",
    "throat pain": "sore throat",
    "gala dard": "sore throat",
    "shortness of breath": "shortness of breath",
    "breathless": "shortness of breath",
    "breathing difficulty": "shortness of breath",
    "sans lene mein takleef": "shortness of breath",
    # General
    "fatigue": "fatigue",
    "tired": "fatigue",
    "weakness": "fatigue",
    "thakan": "fatigue",
    "kamzori": "fatigue",
    "headache": "headache",
    "head pain": "headache",
    "sir dard": "headache",
    "body ache": "body ache",
    "muscle pain": "body ache",
    "badan dard": "body ache",
    # GI
    "nausea": "nausea",
    "vomiting": "nausea",
    "ulti": "nausea",
    "diarrhea": "diarrhea",
    "loose motions": "diarrhea",
    "stomach pain": "stomach pain",
    "pet dard": "stomach pain",
}

FREE_TEXT_KEYWORDS = {
    "smell": "loss of smell",
    "anosmia": "loss of smell",
    "breathless": "shortness of breath",
    "cough": "cough",
    "fever": "fever",
    "tired": "fatigue",
    "weak": "fatigue",
    "headache": "headache",
    "nausea": "nausea",
    "vomit": "nausea",
    "throat": "sore throat",
    "diarrhea": "diarrhea",
    "loose": "diarrhea",
    "ache": "body ache",
    "pain": "body ache",
}


class SymptomExtractor:
    """
    Normalizes symptom chips + free text into canonical symptom tags.
    Upgraded to use HuggingFace BioMedical NER model for free text extraction.
    """
    def __init__(self):
        try:
            print("Sentinel AI: Loading HuggingFace BioMedical NER model... (this may take a moment)")
            from transformers import pipeline
            self.ner = pipeline("ner", model="d4data/biomedical-ner-all", aggregation_strategy="simple")
            print("Sentinel AI: NER model loaded successfully.")
        except Exception as e:
            print(f"Sentinel AI: Warning - failed to load HuggingFace NER model: {e}. Falling back to rule-based.")
            self.ner = None

    def normalize(self, chips: List[str], free_text: str = "") -> List[str]:
        tags = set()

        # From chip selections
        for chip in chips:
            key = chip.lower().strip()
            if key in SYNONYM_MAP:
                tags.add(SYNONYM_MAP[key])
            else:
                tags.add(key)

        # From free text via HuggingFace NER
        if free_text and self.ner:
            try:
                entities = self.ner(free_text)
                for ent in entities:
                    if ent['entity_group'] in ['Sign_symptom', 'Disease_disorder', 'Detailed_description']:
                        word = ent['word'].lower().strip()
                        # Try to map extracted entity to our standard vocabulary
                        matched = False
                        for raw_keyword, standard_tag in SYNONYM_MAP.items():
                            if word in raw_keyword or raw_keyword in word:
                                tags.add(standard_tag)
                                matched = True
                                break
                        if not matched and len(word) > 2:
                            tags.add(word)
            except Exception as e:
                print(f"NER extraction error: {e}")

        # Fallback keyword matching (or to supplement NER)
        if free_text:
            text_lower = free_text.lower()
            for keyword, tag in FREE_TEXT_KEYWORDS.items():
                if keyword in text_lower:
                    tags.add(tag)

        return sorted(tags)


class ConfidenceEngine:
    """
    Calculates real signal confidence for a district.

    Formula (matches the architecture diagram):
      confidence = (trends * 0.35) + (report_score * 0.30)
                 + (multi_symptom * 0.20) + (spam_clear * 0.15)

    Each sub-score is 0–100 before weighting.
    """

    WEIGHTS = {
        "trends": 0.35,
        "reports": 0.30,
        "multi_symptom": 0.20,
        "spam_clear": 0.15,
    }

    def recalculate(self, district: str, db=None):
        """Full recalculation for a district. Updates or creates a signal."""
        if db is None:
            from database import db as _db
            db = _db

        genuine = [
            r for r in db._reports
            if r["district"] == district and not r["is_spam"]
        ]
        spam = [
            r for r in db._reports
            if r["district"] == district and r["is_spam"]
        ]

        if not genuine:
            return  # No data yet, no signal

        # ── SUB-SCORES ────────────────────────────────────────────────────

        # 1. Trends score (0–100): REAL Google Trends data via pytrends
        #    Falls back to symptom variety if trends unavailable
        try:
            from trends_fetcher import get_trends_score
            trends_score = get_trends_score()
        except Exception:
            unique_combos = len(set(frozenset(r["symptoms"]) for r in genuine))
            trends_score = min(unique_combos * 12, 100)

        # 2. Report score (0–100): volume of genuine reports
        report_score = min(math.log1p(len(genuine)) * 18, 100)

        # 3. Multi-symptom score (0–100): multiple distinct symptom types
        all_symptoms = [s for r in genuine for s in r["symptoms"]]
        unique_symptoms = len(set(all_symptoms))
        multi_score = min(unique_symptoms * 14, 100)

        # 4. Spam-clear score (0–100): ratio of genuine vs spam
        total = len(genuine) + len(spam)
        spam_clear = (len(genuine) / total * 100) if total > 0 else 100

        # 5. IDSP anchor boost: if IDSP confirms outbreak in this district,
        #    it increases confidence as the retrospective ground truth anchor
        try:
            from idsp_loader import get_anchor_score
            idsp_anchor = get_anchor_score(district, list(set(all_symptoms)))
        except Exception:
            idsp_anchor = 0

        # ── FINAL CONFIDENCE ──────────────────────────────────────────────
        raw = (
            trends_score   * self.WEIGHTS["trends"]   +
            report_score   * self.WEIGHTS["reports"]  +
            multi_score    * self.WEIGHTS["multi_symptom"] +
            spam_clear     * self.WEIGHTS["spam_clear"]
        )
        # IDSP anchor: if IDSP shows alert/outbreak, boost confidence by up to 10 pts
        idsp_boost = (idsp_anchor / 100) * 10
        confidence = round(min(raw + idsp_boost, 99), 1)

        # ── BUILD SYMPTOM SUMMARY ────────────────────────────────────────
        sym_counter = Counter(all_symptoms)
        top_symptoms = [s for s, _ in sym_counter.most_common(4)]

        # ── DETERMINE SOURCES ─────────────────────────────────────────────
        sources = ["user reports"]
        if trends_score > 40:
            sources.append("trend signals")
        if idsp_anchor > 0:
            sources.append("IDSP ground truth")
        if len(genuine) > 50:
            sources.append("geo clustering")

        # ── ENFORCE 2-SOURCE MINIMUM (Convergence Rule) ────────────────
        # Signal is only created/updated if we have ≥2 independent data sources
        if len(sources) < 2:
            return  # Not enough convergence yet

        # ── UPSERT SIGNAL ────────────────────────────────────────────────
        existing = next(
            (s for s in db._signals.values() if s.get("district") == district),
            None,
        )
        now = datetime.now(timezone.utc).isoformat()

        if existing:
            existing["confidence"] = confidence
            existing["report_count"] = len(genuine)
            existing["symptoms"] = top_symptoms
            existing["sources"] = sources
            existing["last_updated"] = now
        else:
            sig_id = str(uuid.uuid4())[:8]
            symptom_name = self._name_signal(top_symptoms)
            db._signals[sig_id] = {
                "id": sig_id,
                "name": f"{symptom_name} · {district}",
                "district": district,
                "confidence": confidence,
                "report_count": len(genuine),
                "symptoms": top_symptoms,
                "sources": sources,
                "created_at": now,
                "last_updated": now,
            }

    def recalculate_hex(self, hex_id: str, db=None):
        """Full recalculation for a specific H3 hexagon."""
        if db is None:
            from database import db as _db
            db = _db

        genuine = [r for r in db._reports if r.get("hex_id") == hex_id and not r.get("is_spam")]
        spam = [r for r in db._reports if r.get("hex_id") == hex_id and r.get("is_spam")]

        if not genuine:
            return

        # 1. Trends score
        unique_combos = len(set(frozenset(r["symptoms"]) for r in genuine))
        trends_score = min(unique_combos * 12, 100)

        # 2. Report score
        report_score = min(math.log1p(len(genuine)) * 18, 100)

        # 3. Multi-symptom score
        all_symptoms = [s for r in genuine for s in r["symptoms"]]
        unique_symptoms = len(set(all_symptoms))
        multi_score = min(unique_symptoms * 14, 100)

        # 4. Spam-clear score
        total = len(genuine) + len(spam)
        spam_clear = (len(genuine) / total * 100) if total > 0 else 100

        # FINAL CONFIDENCE
        raw = (
            trends_score * self.WEIGHTS["trends"] +
            report_score * self.WEIGHTS["reports"] +
            multi_score * self.WEIGHTS["multi_symptom"] +
            spam_clear * self.WEIGHTS["spam_clear"]
        )
        confidence = round(min(raw, 99), 1)

        sym_counter = Counter(all_symptoms)
        top_symptoms = [s for s, _ in sym_counter.most_common(4)]

        sources = ["user reports"]
        if trends_score > 40: sources.append("trend signals")
        if len(genuine) > 10: sources.append("geo clustering")

        # Use the most common district name in this hex for labeling
        districts_in_hex = [r.get("district") for r in genuine if r.get("district")]
        district_label = Counter(districts_in_hex).most_common(1)[0][0] if districts_in_hex else "Unknown"

        existing = db._signals.get(hex_id)
        now = datetime.now(timezone.utc).isoformat()

        if existing:
            existing["confidence"] = confidence
            existing["report_count"] = len(genuine)
            existing["symptoms"] = top_symptoms
            existing["sources"] = sources
            existing["last_updated"] = now
            existing["district"] = district_label
        else:
            symptom_name = self._name_signal(top_symptoms)
            db._signals[hex_id] = {
                "id": hex_id,
                "hex_id": hex_id,
                "name": f"{symptom_name} · {district_label}",
                "district": district_label,
                "confidence": confidence,
                "report_count": len(genuine),
                "symptoms": top_symptoms,
                "sources": sources,
                "created_at": now,
                "last_updated": now,
            }

    def estimate_contribution(
        self, district: str, symptoms: List[str], has_text: bool
    ) -> float:
        base = len(symptoms) * 0.8
        if has_text:
            base += 0.5
        return round(min(base, 8.0), 2)

    def _name_signal(self, symptoms: List[str]) -> str:
        respiratory = {"cough", "fever", "loss of smell", "shortness of breath", "sore throat"}
        gi = {"nausea", "diarrhea", "stomach pain"}
        s = set(symptoms)
        if s & respiratory:
            return "Respiratory cluster"
        if s & gi:
            return "GI disturbance"
        return "Unclassified cluster"

# Singletons
symptom_extractor = SymptomExtractor()
confidence_engine = ConfidenceEngine()
