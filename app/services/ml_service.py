import os
import joblib
import numpy as np
from typing import Optional

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "ml", "models")

_eta_model = None
_delay_model = None


def _load_models():
    global _eta_model, _delay_model
    eta_path = os.path.join(MODEL_DIR, "eta_model.pkl")
    delay_path = os.path.join(MODEL_DIR, "delay_model.pkl")
    if os.path.exists(eta_path):
        _eta_model = joblib.load(eta_path)
    if os.path.exists(delay_path):
        _delay_model = joblib.load(delay_path)


def get_eta_prediction(distance_km: float, hour_of_day: int, day_of_week: int,
                        package_weight: float, agent_workload: int,
                        traffic_level: float = 1.0) -> Optional[float]:
    global _eta_model
    if _eta_model is None:
        _load_models()
    if _eta_model is None:
        # Fallback rule-based estimate
        base = distance_km * 3.5
        traffic_mult = {1.0: 1.0, 2.0: 1.3, 3.0: 1.7}.get(traffic_level, 1.0)
        return round(base * traffic_mult + agent_workload * 2, 1)

    features = np.array([[distance_km, hour_of_day, day_of_week,
                           package_weight, agent_workload, traffic_level]])
    return round(float(_eta_model.predict(features)[0]), 1)


def get_delay_prediction(distance_km: float, hour_of_day: int, day_of_week: int,
                          package_weight: float, agent_workload: int,
                          traffic_level: float = 1.0,
                          priority: str = "medium") -> dict:
    global _delay_model
    if _delay_model is None:
        _load_models()

    priority_enc = {"low": 0, "medium": 1, "high": 2, "urgent": 3}.get(priority, 1)
    features = np.array([[distance_km, hour_of_day, day_of_week,
                           package_weight, agent_workload, traffic_level, priority_enc]])

    if _delay_model is None:
        # Fallback rule-based risk
        risk_score = (distance_km / 20) + (agent_workload / 10) + (traffic_level / 3)
        if risk_score < 0.5:
            return {"risk": "low", "probability": round(risk_score * 0.5, 2)}
        elif risk_score < 0.9:
            return {"risk": "medium", "probability": round(0.4 + risk_score * 0.3, 2)}
        else:
            return {"risk": "high", "probability": round(min(0.95, 0.6 + risk_score * 0.2), 2)}

    proba = _delay_model.predict_proba(features)[0]
    risk_idx = int(np.argmax(proba))
    risk_labels = ["low", "medium", "high"]
    return {
        "risk": risk_labels[risk_idx],
        "probability": round(float(proba[risk_idx]), 2),
        "probabilities": {
            "low": round(float(proba[0]), 2),
            "medium": round(float(proba[1]), 2),
            "high": round(float(proba[2]), 2),
        }
    }


def generate_explanation(delay_risk: str, delay_prob: float, distance_km: float,
                          agent_workload: int, traffic_level: float,
                          hour_of_day: int) -> str:
    """Generate human-readable explanation for delay risk."""
    factors = []

    if distance_km > 10:
        factors.append(f"Long delivery distance ({distance_km:.1f} km)")
    if traffic_level >= 2.5:
        factors.append("Heavy traffic conditions")
    elif traffic_level >= 1.5:
        factors.append("Moderate traffic")
    if agent_workload >= 5:
        factors.append(f"High agent workload ({agent_workload} active deliveries)")
    elif agent_workload >= 3:
        factors.append(f"Moderate agent workload ({agent_workload} deliveries)")
    if 7 <= hour_of_day <= 9 or 17 <= hour_of_day <= 20:
        factors.append("Peak hour traffic window")
    if not factors:
        factors.append("Normal delivery conditions")

    reasons = " • ".join(factors)
    risk_emoji = {"low": "🟢", "medium": "🟡", "high": "🔴"}.get(delay_risk, "⚪")
    return f"{risk_emoji} {delay_risk.upper()} RISK ({delay_prob * 100:.0f}%) — Factors: {reasons}"
