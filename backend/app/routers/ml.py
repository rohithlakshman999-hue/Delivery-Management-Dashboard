from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Order, Agent, MLPrediction, User
from app.schemas.schemas import ETARequest, DelayRequest
from app.services.auth_service import get_current_user
from app.services.ml_service import get_eta_prediction, get_delay_prediction, generate_explanation
from app.services.dispatch import haversine_distance, get_agent_active_orders
from datetime import datetime

router = APIRouter(prefix="/api/ml", tags=["ml"])


@router.post("/predict-eta")
def predict_eta(req: ETARequest, current_user: User = Depends(get_current_user)):
    eta = get_eta_prediction(
        req.distance_km, req.hour_of_day, req.day_of_week,
        req.package_weight, req.agent_workload, req.traffic_level
    )
    return {"predicted_eta_minutes": eta, "confidence": "Random Forest" if True else "Rule-based"}


@router.post("/predict-delay")
def predict_delay(req: DelayRequest, current_user: User = Depends(get_current_user)):
    result = get_delay_prediction(
        req.distance_km, req.hour_of_day, req.day_of_week,
        req.package_weight, req.agent_workload, req.traffic_level, req.priority
    )
    explanation = generate_explanation(
        result["risk"], result["probability"],
        req.distance_km, req.agent_workload, req.traffic_level, req.hour_of_day
    )
    return {**result, "explanation": explanation}


@router.post("/predict-order/{order_id}")
def predict_for_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    agent = db.query(Agent).filter(Agent.id == order.assigned_agent_id).first() if order.assigned_agent_id else None

    dist_km = haversine_distance(
        order.pickup_lat, order.pickup_lng,
        order.delivery_lat, order.delivery_lng
    )
    now = datetime.utcnow()
    hour = now.hour
    day = now.weekday()
    traffic = 2.0 if 7 <= hour <= 9 or 17 <= hour <= 20 else 1.0
    workload = get_agent_active_orders(agent.id, db) if agent else 3

    eta = get_eta_prediction(dist_km, hour, day, order.package_weight or 1.0, workload, traffic)
    delay_result = get_delay_prediction(dist_km, hour, day, order.package_weight or 1.0,
                                         workload, traffic, order.priority or "medium")
    explanation = generate_explanation(
        delay_result["risk"], delay_result["probability"], dist_km, workload, traffic, hour
    )

    # Save prediction to DB
    pred = MLPrediction(
        order_id=order_id,
        predicted_eta_minutes=eta,
        delay_risk=delay_result["risk"],
        delay_probability=delay_result["probability"],
        explanation=explanation,
    )
    db.add(pred)
    db.commit()

    return {
        "order_id": order_id,
        "order_code": order.order_code,
        "predicted_eta_minutes": eta,
        "delay_risk": delay_result["risk"],
        "delay_probability": delay_result["probability"],
        "distance_km": round(dist_km, 2),
        "explanation": explanation,
        "factors": {
            "distance_km": round(dist_km, 2),
            "agent_workload": workload,
            "traffic_level": traffic,
            "hour_of_day": hour,
            "package_weight": order.package_weight,
        }
    }
